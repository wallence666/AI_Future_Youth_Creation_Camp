// 商家中心（spec F6）：店舖資料 / 照片 / 菜單 / 限時活動 / 核銷
const express = require('express');
const { db } = require('../db');
const { requireRole } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(requireRole('merchant'));

const CUISINES = ['葡國菜', '粵菜', '甜品', '茶餐廳', '小吃', '手信', '咖啡', '其他'];
// 澳門行政範圍粗校驗
const inMacau = (lat, lng) => lat >= 22.08 && lat <= 22.24 && lng >= 113.52 && lng <= 113.65;

function myShop(uid) {
  return db.prepare('SELECT * FROM shops WHERE merchant_id = ?').get(uid);
}
function parseShop(s) {
  return s && { ...s, photos: JSON.parse(s.photos || '[]'), menu: JSON.parse(s.menu || '[]') };
}

// GET /api/merchant/shop（含我的活動列表）
router.get('/shop', (req, res) => {
  const shop = myShop(req.user.id);
  const promos = shop
    ? db.prepare('SELECT * FROM promos WHERE shop_id = ? ORDER BY id DESC').all(shop.id)
    : [];
  res.json({ shop: parseShop(shop), promos });
});

// PUT /api/merchant/shop：upsert；改名/重審狀態流轉見 spec F6
router.put('/shop', (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name || name.length > 30) return res.status(400).json({ error: '店名必填且不超過 30 字' });
  if (!CUISINES.includes(b.cuisine)) return res.status(400).json({ error: '菜系分類無效' });
  const price = Math.round(Number(b.price));
  if (!Number.isFinite(price) || price <= 0 || price > 100000) return res.status(400).json({ error: '人均消費無效' });
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!inMacau(lat, lng)) return res.status(400).json({ error: '請在澳門範圍內選點' });
  const menu = Array.isArray(b.menu) ? b.menu.slice(0, 30).map(m => ({
    name: String(m.name || '').slice(0, 30), price: Math.max(0, Number(m.price) || 0),
  })).filter(m => m.name) : [];

  const now = Date.now();
  const existing = myShop(req.user.id);
  if (!existing) {
    const info = db.prepare(`INSERT INTO shops(merchant_id, name, cuisine, price, lat, lng, addr, hours, intro, menu, status, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?,?)`)
      .run(req.user.id, name, b.cuisine, price, lat, lng,
        String(b.addr || '').slice(0, 80), String(b.hours || '').slice(0, 60), String(b.intro || '').slice(0, 300),
        JSON.stringify(menu), now, now);
    return res.json({ ok: true, shop: parseShop(myShop(req.user.id)), id: Number(info.lastInsertRowid) });
  }
  // 已上架店改名 → 回到待審核；被拒/下架後重新提交 → 待審核
  let status = existing.status;
  if (existing.status === 'approved' && existing.name !== name) status = 'pending';
  if (existing.status === 'rejected' || existing.status === 'takedown') status = 'pending';
  db.prepare(`UPDATE shops SET name=?, cuisine=?, price=?, lat=?, lng=?, addr=?, hours=?, intro=?, menu=?, status=?, reject_reason=NULL, updated_at=?
    WHERE id = ?`)
    .run(name, b.cuisine, price, lat, lng,
      String(b.addr || '').slice(0, 80), String(b.hours || '').slice(0, 60), String(b.intro || '').slice(0, 300),
      JSON.stringify(menu), status, now, existing.id);
  res.json({ ok: true, shop: parseShop(myShop(req.user.id)) });
});

// POST /api/merchant/shop/photos（≤3 張/次，累計 ≤6 張）
router.post('/shop/photos', writeLimiter, upload.array('photos', 3), (req, res) => {
  const shop = myShop(req.user.id);
  if (!shop) return res.status(400).json({ error: '請先提交店舖資料' });
  const photos = JSON.parse(shop.photos || '[]');
  for (const f of req.files || []) photos.push('/uploads/' + f.filename);
  if (photos.length > 6) return res.status(400).json({ error: '照片最多 6 張，請先刪除部分照片' });
  db.prepare('UPDATE shops SET photos = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(photos), Date.now(), shop.id);
  res.json({ ok: true, photos });
});

// DELETE /api/merchant/shop/photos {url}
router.delete('/shop/photos', (req, res) => {
  const shop = myShop(req.user.id);
  if (!shop) return res.status(400).json({ error: '請先提交店舖資料' });
  const url = String(req.body?.url || '');
  const photos = JSON.parse(shop.photos || '[]').filter(p => p !== url);
  db.prepare('UPDATE shops SET photos = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(photos), Date.now(), shop.id);
  res.json({ ok: true, photos });
});

// ---------- 限時活動（代金券） ----------

function validPromo(b) {
  const title = String(b.title || '').trim();
  if (!title || title.length > 30) return { error: '活動標題必填且不超過 30 字' };
  const pointsCost = Math.round(Number(b.points_cost));
  if (!Number.isFinite(pointsCost) || pointsCost <= 0) return { error: '所需積分無效' };
  const couponValue = Number(b.coupon_value);
  if (!Number.isFinite(couponValue) || couponValue <= 0) return { error: '券面價值無效' };
  const startAt = Number(b.start_at), endAt = Number(b.end_at);
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return { error: '活動起止時間無效' };
  const stock = Math.round(Number(b.stock));
  if (!Number.isFinite(stock) || stock < 1 || stock > 10000) return { error: '庫存須為 1–10000' };
  return { title, pointsCost, couponValue, startAt, endAt, stock, descr: String(b.descr || '').slice(0, 120) };
}

function myApprovedShop(req, res) {
  const shop = myShop(req.user.id);
  if (!shop) { res.status(400).json({ error: '請先提交店舖資料' }); return null; }
  if (shop.status !== 'approved') { res.status(400).json({ error: '店舖通過審核後才能發佈活動' }); return null; }
  return shop;
}

// POST /api/merchant/promos（新建 → 待審核）
router.post('/promos', (req, res) => {
  const shop = myApprovedShop(req, res); if (!shop) return;
  const v = validPromo(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  const info = db.prepare(`INSERT INTO promos(shop_id, title, descr, points_cost, coupon_value, start_at, end_at, stock, status, created_at)
    VALUES(?,?,?,?,?,?,?,?,'pending',?)`)
    .run(shop.id, v.title, v.descr, v.pointsCost, v.couponValue, v.startAt, v.endAt, v.stock, Date.now());
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

// PUT /api/merchant/promos/:id（修改 → 重新待審核；status:offline 可直接下架）
router.put('/promos/:id', (req, res) => {
  const shop = myApprovedShop(req, res); if (!shop) return;
  const promo = db.prepare('SELECT * FROM promos WHERE id = ? AND shop_id = ?').get(Number(req.params.id), shop.id);
  if (!promo) return res.status(404).json({ error: '活動不存在' });
  if (req.body?.status === 'offline') {
    db.prepare("UPDATE promos SET status = 'offline' WHERE id = ?").run(promo.id);
    return res.json({ ok: true });
  }
  const v = validPromo(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  db.prepare(`UPDATE promos SET title=?, descr=?, points_cost=?, coupon_value=?, start_at=?, end_at=?, stock=?, status='pending' WHERE id = ?`)
    .run(v.title, v.descr, v.pointsCost, v.couponValue, v.startAt, v.endAt, v.stock, promo.id);
  res.json({ ok: true });
});

// DELETE /api/merchant/promos/:id
router.delete('/promos/:id', (req, res) => {
  const shop = myShop(req.user.id);
  if (!shop) return res.status(400).json({ error: '請先提交店舖資料' });
  db.prepare('DELETE FROM promos WHERE id = ? AND shop_id = ?').run(Number(req.params.id), shop.id);
  res.json({ ok: true });
});

// POST /api/merchant/redeem {code}（核銷）
router.post('/redeem', writeLimiter, (req, res) => {
  const shop = myShop(req.user.id);
  if (!shop) return res.status(400).json({ error: '請先提交店舖資料' });
  const code = String(req.body?.code || '').trim().toUpperCase();
  const c = db.prepare(`
    SELECT c.*, p.title, p.coupon_value, p.end_at, p.shop_id
    FROM coupons c JOIN promos p ON p.id = c.promo_id
    WHERE c.code = ?`).get(code);
  if (!c) return res.status(404).json({ error: '核銷碼無效' });
  if (c.shop_id !== shop.id) return res.status(403).json({ error: '此券不屬於你的店舖' });
  if (c.status === 'redeemed') return res.status(409).json({ error: '此券已核銷' });
  if (c.end_at < Date.now() || c.status === 'expired') {
    db.prepare("UPDATE coupons SET status = 'expired' WHERE id = ?").run(c.id);
    return res.status(410).json({ error: '此券已過期' });
  }
  db.prepare("UPDATE coupons SET status = 'redeemed', redeemed_at = ? WHERE id = ?").run(Date.now(), c.id);
  res.json({ ok: true, title: c.title, couponValue: c.coupon_value, code: c.code });
});

module.exports = router;
