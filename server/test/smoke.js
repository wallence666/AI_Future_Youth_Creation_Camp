// 端到端煙測：遊客閉環 + 商家閉環 + 管理員審核（對應 spec 功能流）
// 運行：node server/test/smoke.js（需服務器已啟動）
const BASE = process.env.BASE || 'http://localhost:8000';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}
async function api(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let payload;
  if (form) { payload = form; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(BASE + path, { method, headers, body: payload });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
}

(async () => {
  const ts = Date.now().toString(36);
  console.log('== 1. 註冊/登入 ==');
  const visitor = await api('POST', '/api/auth/register', { body: { username: 'v_' + ts, password: '123456', role: 'visitor' } });
  ok('遊客註冊', visitor.status === 200 && visitor.data.token, JSON.stringify(visitor.data));
  ok('註冊送 20 積分', visitor.data.user?.points === 20, `points=${visitor.data.user?.points}`);
  const vTok = visitor.data.token;

  const merchant = await api('POST', '/api/auth/register', { body: { username: 'm_' + ts, password: '123456', role: 'merchant' } });
  ok('商家註冊', merchant.status === 200 && merchant.data.token);
  const mTok = merchant.data.token;

  const admin = await api('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
  ok('管理員登入', admin.status === 200 && admin.data.user?.role === 'admin');
  const aTok = admin.data.token;

  const badLogin = await api('POST', '/api/auth/login', { body: { username: 'admin', password: 'wrong' } });
  ok('錯誤密碼拒絕', badLogin.status === 401);

  console.log('== 2. 遊客閉環 ==');
  const spots = await api('GET', '/api/spots');
  ok('景點列表', spots.status === 200 && spots.data.spots.length === 18, `n=${spots.data?.spots?.length}`);
  const spotId = 'ruins-st-paul';
  const spot = spots.data.spots.find(s => s.id === spotId);

  const rep = await api('POST', `/api/spots/${spotId}/reports`, { token: vTok, body: { level: 3 } });
  ok('人流回報 +6', rep.status === 200 && rep.data.points === 26, JSON.stringify(rep.data));
  const repDup = await api('POST', `/api/spots/${spotId}/reports`, { token: vTok, body: { level: 2 } });
  ok('30 分鐘內重複回報被拒', repDup.status === 429);

  const live = await api('GET', '/api/crowd/live');
  ok('U 因子聚合', live.status === 200 && live.data.spots[spotId]?.n >= 1 && Math.abs(live.data.spots[spotId].u - 0.9) < 1e-6, JSON.stringify(live.data.spots[spotId]));

  const ck = await api('POST', '/api/checkins', { token: vTok, body: { targetType: 'spot', targetId: spotId, lat: spot.lat + 0.001, lng: spot.lng } });
  ok('打卡 +10（500m 內）', ck.status === 200 && ck.data.points === 36, JSON.stringify(ck.data));
  const ckDup = await api('POST', '/api/checkins', { token: vTok, body: { targetType: 'spot', targetId: spotId, lat: spot.lat, lng: spot.lng } });
  ok('重複打卡被拒', ckDup.status === 409);
  const ckFar = await api('POST', '/api/checkins', { token: vTok, body: { targetType: 'spot', targetId: spotId, lat: 22.30, lng: 113.60 } });
  ok('超距打卡被拒', ckFar.status === 403);

  const cm = await api('POST', '/api/comments', { token: vTok, body: { targetType: 'spot', targetId: spotId, content: '測試評論：傍晚人少好拍！' } });
  ok('評論 +5', cm.status === 200 && cm.data.points === 41, JSON.stringify(cm.data));
  const cmList = await api('GET', `/api/comments?targetType=spot&targetId=${spotId}`);
    ok('評論列表', cmList.status === 200 && cmList.data.items.some(i => i.id === cm.data.id && i.content.includes('測試')), JSON.stringify(cmList.data).slice(0, 120));
  const cmDel = await api('DELETE', `/api/comments/${cm.data.id}`, { token: vTok });
  ok('作者刪評論', cmDel.status === 200);

  const summary = await api('GET', `/api/targets/spot/${spotId}/summary`, { token: vTok });
  ok('目標摘要（打卡數/已打卡）', summary.status === 200 && summary.data.checkins >= 1 && summary.data.myCheckinToday === true, JSON.stringify(summary.data));

  console.log('== 3. 商家閉環 + 審核 ==');
  const putShop = await api('PUT', '/api/merchant/shop', {
    token: mTok, body: {
      name: '煙測餅家', cuisine: '手信', price: 45, lat: 22.1965, lng: 113.5405,
      addr: '澳門新馬路 1 號', hours: '10:00–20:00', intro: '煙測專用店舖',
      menu: [{ name: '杏仁餅', price: 35 }],
    },
  });
  ok('商家提交店舖（待審核）', putShop.status === 200 && putShop.data.shop?.status === 'pending', JSON.stringify(putShop.data).slice(0, 200));
  const shopId = putShop.data.shop.id;

  const notOnMap = await api('GET', '/api/shops');
  ok('未審核不上地圖', notOnMap.status === 200 && !notOnMap.data.shops.some(s => s.id === shopId));

  const pending = await api('GET', '/api/admin/merchants?status=pending', { token: aTok });
  ok('管理員看到待審核', pending.status === 200 && pending.data.items.some(i => i.merchant_id === merchant.data.user.id));

  const approve = await api('POST', `/api/admin/merchants/${merchant.data.user.id}/approve`, { token: aTok });
  ok('審核通過', approve.status === 200);
  const onMap = await api('GET', '/api/shops');
  ok('上架地圖（含店舖）', onMap.data.shops.some(s => s.id === shopId && s.name === '煙測餅家'));

  const promoForbidden = await api('POST', '/api/promos/1/exchange', { token: mTok });
  ok('商家不能兌換', promoForbidden.status === 403);

  const now = Date.now();
  const promo = await api('POST', '/api/merchant/promos', {
    token: mTok, body: {
      title: '開業禮', descr: '50 分換 10 元券', points_cost: 50, coupon_value: 10,
      start_at: now - 3600e3, end_at: now + 86400e3, stock: 2,
    },
  });
  ok('發佈活動（待審核）', promo.status === 200, JSON.stringify(promo.data));
  const promoId = promo.data.id;

  const exEarly = await api('POST', `/api/promos/${promoId}/exchange`, { token: vTok });
  ok('未審核活動不能兌換', exEarly.status === 404);

  await api('POST', `/api/admin/promos/${promoId}/approve`, { token: aTok });
  const exPoor = await api('POST', `/api/promos/${promoId}/exchange`, { token: vTok });
  ok('積分不足提示', exPoor.status === 400, JSON.stringify(exPoor.data));

  // 給遊客補足積分：再發 1 條評論（+5 仍不夠，直接用 DB 不便——改為多發幾條評論）
  for (let i = 0; i < 2; i++) {
    await api('POST', '/api/comments', { token: vTok, body: { targetType: 'food', targetId: 'mok-yi-kei', content: '煙測補分 ' + i } });
  }
  const meNow = await api('GET', '/api/me', { token: vTok });
  ok('積分累計', meNow.data.user.points >= 50, `points=${meNow.data.user.points}`);

  const ex = await api('POST', `/api/promos/${promoId}/exchange`, { token: vTok });
  ok('兌換代金券', ex.status === 200 && /^[A-Z2-9]{6}$/.test(ex.data.coupon?.code || ''), JSON.stringify(ex.data));
  ok('兌換扣分', ex.data.points === meNow.data.user.points - 50);
  const code = ex.data.coupon.code;

  const coupons = await api('GET', '/api/me/coupons', { token: vTok });
  ok('我的代金券', coupons.data.items.some(c => c.code === code && c.status === 'unused'));

  const redeemWrong = await api('POST', '/api/merchant/redeem', { token: mTok, body: { code: 'XXXXXX' } });
  ok('無效核銷碼', redeemWrong.status === 404);
  const redeem = await api('POST', '/api/merchant/redeem', { token: mTok, body: { code } });
  ok('商家核銷', redeem.status === 200 && redeem.data.couponValue === 10, JSON.stringify(redeem.data));
  const redeemAgain = await api('POST', '/api/merchant/redeem', { token: mTok, body: { code } });
  ok('重複核銷被拒', redeemAgain.status === 409);

  console.log('== 3.5 店舖互動（第三輪修訂：店舖開放打卡/評論） ==');
  const shopCk = await api('POST', '/api/checkins', { token: vTok, body: { targetType: 'shop', targetId: String(shopId), lat: 22.1965, lng: 113.5405 } });
  ok('店舖打卡 +10', shopCk.status === 200, JSON.stringify(shopCk.data));
  const shopCkDup = await api('POST', '/api/checkins', { token: vTok, body: { targetType: 'shop', targetId: 'shop_' + shopId, lat: 22.1965, lng: 113.5405 } });
  ok('shop_ 前綴歸一 → 重複打卡被拒', shopCkDup.status === 409);
  const shopCm = await api('POST', '/api/comments', { token: vTok, body: { targetType: 'shop', targetId: String(shopId), content: '店舖評論：杏仁餅好食！' } });
  ok('店舖評論 +5', shopCm.status === 200, JSON.stringify(shopCm.data));
  const shopSum = await api('GET', `/api/targets/shop/${shopId}/summary`, { token: vTok });
  ok('店舖摘要（已打卡）', shopSum.status === 200 && shopSum.data.checkins >= 1 && shopSum.data.myCheckinToday === true, JSON.stringify(shopSum.data));

  console.log('== 4. 權限與概覽 ==');
  const noAuth = await api('GET', '/api/me');
  ok('未登入 401', noAuth.status === 401);
  const forbidden = await api('GET', '/api/admin/stats', { token: vTok });
  ok('遊客訪問管理接口 403', forbidden.status === 403);
  const stats = await api('GET', '/api/admin/stats', { token: aTok });
  ok('管理概覽', stats.status === 200 && stats.data.todayReports >= 1 && stats.data.todayCheckins >= 1, JSON.stringify(stats.data));

  console.log(`\n結果：${pass} 通過, ${fail} 失敗`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('煙測異常:', e); process.exit(1); });
