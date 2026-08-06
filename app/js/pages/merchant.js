/* pages/merchant.js — 商家中心（spec F6）
 * 登入守衛（僅 merchant 角色）→ 店舖資料/照片/菜單/限時活動/核銷 五區塊。
 * 地圖選點：geoq 底圖（GCJ-02 顯示，點擊座標逆轉回 WGS-84 存儲）。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const $ = App.$;

  const S = {
    user: null, shop: null, promos: [],
    pick: null,          // {lat, lng} WGS-84（表單暫存）
    map: null, marker: null,
    editingPromo: null,  // null = 新建
  };

  const STATUS_TEXT = {
    pending: ['⏳ 店舖資料審核中，通過後將顯示在地圖美食圖層', 'pending'],
    approved: ['✅ 店舖已上架：遊客可在地圖上看到並打卡/評論/兌換代金券', 'approved'],
    rejected: ['❌ 審核被拒絕', 'rejected'],
    takedown: ['⛔ 店舖已被管理員下架，可修改資料後重新提交審核', 'takedown'],
  };

  function fmtTs(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  const toInput = ts => fmtTs(ts).replace(' ', 'T');
  const fromInput = v => (v ? new Date(v).getTime() : NaN);

  /* ================= 登入守衛 ================= */
  function showLogin(err) {
    $('loginView').hidden = false;
    $('mainView').hidden = true;
    $('userChip').hidden = true; $('logoutBtn').hidden = true;
    if (err) { $('loginErr').textContent = err; $('loginErr').hidden = false; }
  }
  function showMain() {
    $('loginView').hidden = true;
    $('mainView').hidden = false;
    $('userChip').hidden = false; $('logoutBtn').hidden = false;
    $('userChip').textContent = `🏪 ${S.user.username}`;
    if (!S.map) initPickMap();
  }
  async function tryResume() {
    if (!localStorage.getItem(App.api.TOKEN_KEY)) return showLogin();
    try {
      const j = await App.api.get('/api/me', { silent401: true });
      if (j.user.role !== 'merchant') return showLogin('此賬號非商家角色，請換商家賬號登入');
      S.user = j.user;
      showMain();
      loadShop();
    } catch (e) { showLogin(); }
  }
  async function doLogin() {
    const username = $('loginUser').value.trim(), password = $('loginPass').value;
    if (!username || !password) return showLogin('請填寫用戶名與密碼');
    $('loginBtn').disabled = true;
    try {
      const j = await App.api.post('/api/auth/login', { username, password });
      if (j.user.role !== 'merchant') {
        return showLogin('此賬號非商家角色，請換商家賬號登入');
      }
      localStorage.setItem(App.api.TOKEN_KEY, j.token);
      S.user = j.user;
      showMain();
      loadShop();
    } catch (e) {
      showLogin(e.message);
    } finally {
      $('loginBtn').disabled = false;
    }
  }

  /* ================= 店舖資料 ================= */
  async function loadShop() {
    try {
      const j = await App.api.get('/api/merchant/shop');
      S.shop = j.shop; S.promos = j.promos || [];
      renderBanner(); fillForm(); renderPhotos(); renderPromos();
    } catch (e) {
      App.toast(e.message);
    }
  }
  function renderBanner() {
    const b = $('shopBanner');
    if (!S.shop) {
      b.className = 'shop-banner st-none';
      b.innerHTML = '📝 尚未提交店舖資料 — 填寫下方表格並提交，管理員審核通過後店舖即上地圖';
      return;
    }
    const [text, cls] = STATUS_TEXT[S.shop.status] || [S.shop.status, 'pending'];
    b.className = 'shop-banner st-' + cls;
    b.innerHTML = App.esc(text) +
      (S.shop.status === 'rejected' && S.shop.reject_reason ? `：${App.esc(S.shop.reject_reason)}` : '');
  }
  function fillForm() {
    const s = S.shop || {};
    $('fName').value = s.name || '';
    $('fCuisine').value = s.cuisine || '其他';
    $('fPrice').value = s.price || '';
    $('fAddr').value = s.addr || '';
    $('fHours').value = s.hours || '';
    $('fIntro').value = s.intro || '';
    S.pick = (s.lat && s.lng) ? { lat: s.lat, lng: s.lng } : null;
    renderMenuRows(s.menu || []);
    updatePickUI();
  }
  async function saveShop() {
    const menu = [];
    $('menuRows').querySelectorAll('.menu-ed').forEach(row => {
      const name = row.querySelector('.mi-name').value.trim();
      const price = Number(row.querySelector('.mi-price').value);
      if (name) menu.push({ name, price: Number.isFinite(price) ? price : 0 });
    });
    const body = {
      name: $('fName').value.trim(), cuisine: $('fCuisine').value,
      price: Number($('fPrice').value), addr: $('fAddr').value.trim(),
      hours: $('fHours').value.trim(), intro: $('fIntro').value.trim(),
      menu,
    };
    if (!S.pick) { $('shopMsg').textContent = '請先在地圖上選點'; return; }
    body.lat = S.pick.lat; body.lng = S.pick.lng;
    $('shopSave').disabled = true;
    try {
      const j = await App.api.put('/api/merchant/shop', body);
      S.shop = j.shop;
      $('shopMsg').textContent = '';
      App.toast(j.shop.status === 'pending' ? '已提交，等待管理員審核' : '已保存');
      renderBanner();
    } catch (e) {
      $('shopMsg').textContent = e.message;
    } finally {
      $('shopSave').disabled = false;
    }
  }
  /* ================= 菜單編輯 ================= */
  function renderMenuRows(menu) {
    $('menuRows').innerHTML = '';
    menu.forEach(m => addMenuRow(m.name, m.price));
    if (!menu.length) addMenuRow('', '');
  }
  function addMenuRow(name, price) {
    const rows = $('menuRows');
    if (rows.children.length >= 30) return App.toast('菜單最多 30 條');
    const div = document.createElement('div');
    div.className = 'menu-ed';
    div.innerHTML = `
      <input class="mi-name" maxlength="30" placeholder="菜名" value="${App.esc(name)}">
      <input class="mi-price" type="number" min="0" placeholder="MOP" value="${price === '' ? '' : App.esc(String(price))}">
      <button class="mi-del" title="刪除">×</button>`;
    div.querySelector('.mi-del').onclick = () => div.remove();
    rows.appendChild(div);
  }

  /* ================= 地圖選點 ================= */
  // 用 Carto（WGS-84，見 docs/01 底圖可達性問題）而非 Geoq，避免中國大陸底圖在部分網絡環境
  // 不可達導致地圖空白；useGcj 對應設為 false，否則座標系不符會讓標記位置偏移（同 basemap.js 的教訓）。
  function initPickMap() {
    const cfg = App.config.TILES.carto;
    App.state.useGcj = false;
    S.map = L.map('pickMap', { attributionControl: false, zoomControl: true })
      .setView(App.ll(22.1936, 113.5461), 14);
    L.tileLayer(cfg.url, { maxZoom: 18, subdomains: cfg.subdomains || 'abcd' }).addTo(S.map);
    S.map.on('click', e => {
      const [wLng, wLat] = Geo.gcj02ToWgs84(e.latlng.lng, e.latlng.lat);
      S.pick = { lat: +wLat.toFixed(6), lng: +wLng.toFixed(6) };
      updatePickUI();
    });
  }
  // 自訂 divIcon（accent 藍圓點）取代 Leaflet 預設圖釘——專案沒有 vendor 預設圖示圖片
  // （marker-icon.png/marker-shadow.png 404），且自訂圖示才符合 DESIGN.md 的視覺語言。
  const PICK_ICON = L.divIcon({
    className: '', iconSize: [20, 20], iconAnchor: [10, 10],
    html: '<div class="pick-marker"></div>',
  });
  function updatePickUI() {
    if (S.pick && S.map) {
      const ll = App.ll(S.pick.lat, S.pick.lng);
      if (!S.marker) {
        S.marker = L.marker(ll, { icon: PICK_ICON }).addTo(S.map);
      } else S.marker.setLatLng(ll);
      S.map.setView(ll, Math.max(S.map.getZoom(), 15));
      $('pickHint').textContent = `已選點：${S.pick.lat}, ${S.pick.lng}`;
    } else {
      $('pickHint').textContent = '尚未選點';
    }
  }

  /* ================= 照片 ================= */
  function renderPhotos() {
    const photos = (S.shop && S.shop.photos) || [];
    $('photoGrid').innerHTML = photos.length
      ? photos.map(p => `
        <div class="ph-item">
          <img src="${App.esc(p)}" alt="店舖照片">
          <button class="ph-del" data-url="${App.esc(p)}" title="刪除">×</button>
        </div>`).join('')
      : '<div class="me-empty">尚未上傳照片</div>';
    $('photoGrid').querySelectorAll('.ph-del').forEach(btn => {
      btn.onclick = async () => {
        try {
          await App.api.del('/api/merchant/shop/photos', { url: btn.dataset.url });
          App.toast('已刪除');
          loadShop();
        } catch (e) { App.toast(e.message); }
      };
    });
  }
  async function uploadPhotos(files) {
    if (!files.length) return;
    if (files.length > 3) return App.toast('每次最多上傳 3 張');
    const form = new FormData();
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) return App.toast(`「${f.name}」超過 5MB`);
      form.append('photos', f);
    }
    try {
      await App.api.postForm('/api/merchant/shop/photos', form);
      App.toast('照片已上傳');
      loadShop();
    } catch (e) { App.toast(e.message); }
  }

  /* ================= 限時活動 ================= */
  const PROMO_STATUS = {
    pending: ['待審核', 'pending'], approved: ['已上架', 'approved'],
    rejected: ['已拒絕', 'rejected'], offline: ['已下架', 'offline'],
  };
  function renderPromos() {
    const list = $('promoList');
    if (!S.promos.length) {
      list.innerHTML = '<div class="me-empty">尚未發佈活動</div>';
      return;
    }
    list.innerHTML = S.promos.map(p => {
      const [label, cls] = PROMO_STATUS[p.status] || [p.status, 'pending'];
      return `
      <div class="promo-item" data-id="${p.id}">
        <div class="pi-main">
          <b>${App.esc(p.title)}</b>
          <div class="pi-meta">
            <span class="pc-value">MOP ${p.coupon_value} 券</span>
            <span>${p.points_cost} 積分</span>
            <span>庫存 ${p.stock}</span>
            <span class="promo-status ps-${cls}">${label}</span>
          </div>
          <div class="pi-time">${fmtTs(p.start_at)} ~ ${fmtTs(p.end_at)}</div>
        </div>
        <div class="pi-ops">
          <button class="btn-ghost btn-sm pi-edit" data-id="${p.id}">編輯</button>
          ${p.status === 'approved' ? `<button class="btn-ghost btn-sm pi-off" data-id="${p.id}">下架</button>` : ''}
          <button class="btn-ghost btn-sm pi-del" data-id="${p.id}">刪除</button>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('.pi-edit').forEach(b => b.onclick = () => openPromoForm(S.promos.find(p => p.id === Number(b.dataset.id))));
    list.querySelectorAll('.pi-off').forEach(b => b.onclick = () => offlinePromo(Number(b.dataset.id)));
    list.querySelectorAll('.pi-del').forEach(b => b.onclick = () => delPromo(Number(b.dataset.id)));
  }
  function openPromoForm(p) {
    S.editingPromo = p || null;
    $('promoFormTitle').textContent = p ? '編輯活動（重新提交審核）' : '新活動';
    $('pTitle').value = p ? p.title : '';
    $('pDescr').value = p ? (p.descr || '') : '';
    $('pPoints').value = p ? p.points_cost : '';
    $('pValue').value = p ? p.coupon_value : '';
    $('pStart').value = p ? toInput(p.start_at) : toInput(Date.now());
    $('pEnd').value = p ? toInput(p.end_at) : toInput(Date.now() + 7 * 864e5);
    $('pStock').value = p ? p.stock : '';
    $('promoMsg').textContent = '';
    $('promoForm').hidden = false;
    $('promoNewBtn').hidden = true;
  }
  function closePromoForm() {
    $('promoForm').hidden = true;
    $('promoNewBtn').hidden = false;
    S.editingPromo = null;
  }
  async function savePromo() {
    const body = {
      title: $('pTitle').value.trim(), descr: $('pDescr').value.trim(),
      points_cost: Number($('pPoints').value), coupon_value: Number($('pValue').value),
      start_at: fromInput($('pStart').value), end_at: fromInput($('pEnd').value),
      stock: Number($('pStock').value),
    };
    $('promoSave').disabled = true;
    try {
      if (S.editingPromo) await App.api.put(`/api/merchant/promos/${S.editingPromo.id}`, body);
      else await App.api.post('/api/merchant/promos', body);
      App.toast('已提交，等待管理員審核');
      closePromoForm();
      loadShop();
    } catch (e) {
      $('promoMsg').textContent = e.message;
    } finally {
      $('promoSave').disabled = false;
    }
  }
  async function offlinePromo(id) {
    if (!confirm('確定下架此活動？已兌換的代金券仍可核銷。')) return;
    try {
      await App.api.put(`/api/merchant/promos/${id}`, { status: 'offline' });
      App.toast('已下架');
      loadShop();
    } catch (e) { App.toast(e.message); }
  }
  async function delPromo(id) {
    if (!confirm('確定刪除此活動？')) return;
    try {
      await App.api.del(`/api/merchant/promos/${id}`);
      App.toast('已刪除');
      loadShop();
    } catch (e) { App.toast(e.message); }
  }

  /* ================= 核銷 ================= */
  async function doRedeem() {
    const code = $('redeemCode').value.trim().toUpperCase();
    if (code.length !== 6) return App.toast('請輸入 6 位核銷碼');
    $('redeemBtn').disabled = true;
    const box = $('redeemResult');
    try {
      const j = await App.api.post('/api/merchant/redeem', { code });
      box.className = 'redeem-result ok';
      box.innerHTML = `✅ 核銷成功<br><b>${App.esc(j.title)}</b> · 面額 MOP ${j.couponValue} · 碼 ${App.esc(j.code)}`;
      box.hidden = false;
      $('redeemCode').value = '';
    } catch (e) {
      box.className = 'redeem-result err';
      box.textContent = '❌ ' + e.message;
      box.hidden = false;
    } finally {
      $('redeemBtn').disabled = false;
    }
  }

  /* ================= 綁定 ================= */
  function bind() {
    $('loginBtn').onclick = doLogin;
    $('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    $('logoutBtn').onclick = () => {
      localStorage.removeItem(App.api.TOKEN_KEY);
      localStorage.removeItem('axwz_user');
      location.reload();
    };
    $('shopSave').onclick = saveShop;
    $('menuAdd').onclick = () => addMenuRow('', '');
    $('photoInput').addEventListener('change', e => {
      uploadPhotos(Array.from(e.target.files));
      e.target.value = '';
    });
    $('promoNewBtn').onclick = () => openPromoForm(null);
    $('promoSave').onclick = savePromo;
    $('promoCancel').onclick = closePromoForm;
    $('redeemBtn').onclick = doRedeem;
    $('redeemCode').addEventListener('keydown', e => { if (e.key === 'Enter') doRedeem(); });
    App.bus.on('auth-required', msg => showLogin(msg || '登入已過期，請重新登入'));
  }

  // 調試/測試句柄（演示與自動化驗收用）
  window.AXWZ_M = { state: S, setPick: (lat, lng) => { S.pick = { lat, lng }; updatePickUI(); } };
  document.addEventListener('DOMContentLoaded', () => { if (App.pwa) App.pwa.register(); bind(); tryResume(); });
})();
