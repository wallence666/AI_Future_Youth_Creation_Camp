/* pages/admin.js — 管理後台（spec F8）
 * 登入守衛（僅 admin 角色）→ 數據概覽 + 四頁籤：待審商家/待審活動/店舖管理/評論管理。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const $ = App.$;

  const S = { user: null, tab: 'merchants' };

  function fmtTs(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  const TARGET_LABEL = { spot: '景點', food: '美食', shop: '店舖' };

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
    $('userChip').textContent = `🛡️ ${S.user.username}`;
  }
  async function tryResume() {
    if (!localStorage.getItem(App.api.TOKEN_KEY)) return showLogin();
    try {
      const j = await App.api.get('/api/me', { silent401: true });
      if (j.user.role !== 'admin') return showLogin('此賬號非管理員角色');
      S.user = j.user;
      showMain();
      loadStats(); loadTab();
    } catch (e) { showLogin(); }
  }
  async function doLogin() {
    const username = $('loginUser').value.trim(), password = $('loginPass').value;
    if (!username || !password) return showLogin('請填寫用戶名與密碼');
    $('loginBtn').disabled = true;
    try {
      const j = await App.api.post('/api/auth/login', { username, password });
      if (j.user.role !== 'admin') return showLogin('此賬號非管理員角色');
      localStorage.setItem(App.api.TOKEN_KEY, j.token);
      S.user = j.user;
      showMain();
      loadStats(); loadTab();
    } catch (e) {
      showLogin(e.message);
    } finally {
      $('loginBtn').disabled = false;
    }
  }

  /* ================= 數據概覽 ================= */
  async function loadStats() {
    try {
      const s = await App.api.get('/api/admin/stats');
      $('statsGrid').innerHTML = [
        ['註冊用戶', s.users, `遊客 ${s.visitors} · 商家 ${s.merchants}`],
        ['待審商家', s.pendingShops, ''],
        ['待審活動', s.pendingPromos, ''],
        ['已上架店舖', s.approvedShops, ''],
        ['今日打卡', s.todayCheckins, ''],
        ['今日人流回報', s.todayReports, ''],
        ['可見評論', s.comments, ''],
        ['已發代金券', s.couponsIssued, ''],
      ].map(([k, v, sub]) => `<div class="stat-card"><b>${v}</b><span>${k}</span>${sub ? `<small>${sub}</small>` : ''}</div>`).join('');
      const bm = $('badgeMerchants'), bp = $('badgePromos');
      bm.textContent = s.pendingShops; bm.hidden = !s.pendingShops;
      bp.textContent = s.pendingPromos; bp.hidden = !s.pendingPromos;
    } catch (e) { App.toast(e.message); }
  }

  /* ================= 頁籤 ================= */
  function loadTab() {
    document.querySelectorAll('#admTabs button').forEach(b =>
      b.classList.toggle('on', b.dataset.tab === S.tab));
    const list = $('admList');
    list.innerHTML = '<div class="me-empty">載入中…</div>';
    ({ merchants: loadMerchants, promos: loadPromos, shops: loadShops, comments: loadComments })[S.tab]();
  }

  /* ---------- 待審商家 ---------- */
  async function loadMerchants() {
    try {
      const j = await App.api.get('/api/admin/merchants?status=pending');
      $('admList').innerHTML = j.items.length ? j.items.map(m => `
        <div class="card adm-card">
          <div class="adm-head">
            <b>${App.esc(m.name || '（未填店名）')}</b>
            <span class="dc-tag">${App.esc(m.cuisine || '')}</span>
            <span class="adm-user">商家：${App.esc(m.username)} · 註冊於 ${fmtTs(m.registered_at)}</span>
          </div>
          <div class="adm-body">
            ${m.intro ? `<p>${App.esc(m.intro)}</p>` : ''}
            <div class="adm-meta">
              <span>人均 MOP ${m.price ?? '—'}</span>
              <span>${App.esc(m.hours || '')}</span>
              <span>${App.esc(m.addr || '')}</span>
              <span>(${m.lat}, ${m.lng})</span>
            </div>
            ${(m.menu && m.menu.length) ? `<div class="menu-list adm-menu">${m.menu.map(x =>
              `<div class="menu-item"><span>${App.esc(x.name)}</span><b>MOP ${x.price}</b></div>`).join('')}</div>` : ''}
            ${(m.photos && m.photos.length) ? `<div class="shop-photos">${m.photos.map(p =>
              `<img src="${App.esc(p)}" alt="店舖照片" loading="lazy">`).join('')}</div>` : ''}
          </div>
          <div class="adm-ops">
            <button class="btn-gold btn-sm adm-approve" data-mid="${m.merchant_id}">✓ 通過上架</button>
            <button class="btn-ghost btn-sm adm-reject" data-mid="${m.merchant_id}">✗ 拒絕</button>
          </div>
        </div>`).join('') : '<div class="me-empty">無待審商家 🎉</div>';
      bindMerchantOps();
    } catch (e) { $('admList').innerHTML = `<div class="me-empty">${App.esc(e.message)}</div>`; }
  }
  function bindMerchantOps() {
    $('admList').querySelectorAll('.adm-approve').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        await App.api.post(`/api/admin/merchants/${b.dataset.mid}/approve`);
        App.toast('已通過上架');
        loadStats(); loadMerchants();
      } catch (e) { App.toast(e.message); b.disabled = false; }
    });
    $('admList').querySelectorAll('.adm-reject').forEach(b => b.onclick = async () => {
      const reason = prompt('拒絕原因（將展示給商家）：', '資料不完整');
      if (reason === null) return;
      try {
        await App.api.post(`/api/admin/merchants/${b.dataset.mid}/reject`, { reason });
        App.toast('已拒絕');
        loadStats(); loadMerchants();
      } catch (e) { App.toast(e.message); }
    });
  }

  /* ---------- 待審活動 ---------- */
  async function loadPromos() {
    try {
      const j = await App.api.get('/api/admin/promos?status=pending');
      $('admList').innerHTML = j.items.length ? j.items.map(p => `
        <div class="card adm-card">
          <div class="adm-head">
            <b>${App.esc(p.title)}</b>
            <span class="dc-tag">${App.esc(p.shop_name)}</span>
          </div>
          <div class="adm-body">
            ${p.descr ? `<p>${App.esc(p.descr)}</p>` : ''}
            <div class="adm-meta">
              <span class="pc-value">MOP ${p.coupon_value} 券</span>
              <span>${p.points_cost} 積分</span>
              <span>庫存 ${p.stock}</span>
              <span>${fmtTs(p.start_at)} ~ ${fmtTs(p.end_at)}</span>
            </div>
          </div>
          <div class="adm-ops">
            <button class="btn-gold btn-sm pa-approve" data-id="${p.id}">✓ 通過上架</button>
            <button class="btn-ghost btn-sm pa-reject" data-id="${p.id}">✗ 拒絕</button>
          </div>
        </div>`).join('') : '<div class="me-empty">無待審活動 🎉</div>';
      $('admList').querySelectorAll('.pa-approve').forEach(b => b.onclick = async () => {
        b.disabled = true;
        try {
          await App.api.post(`/api/admin/promos/${b.dataset.id}/approve`);
          App.toast('活動已上架');
          loadStats(); loadPromos();
        } catch (e) { App.toast(e.message); b.disabled = false; }
      });
      $('admList').querySelectorAll('.pa-reject').forEach(b => b.onclick = async () => {
        if (!confirm('確定拒絕此活動？')) return;
        try {
          await App.api.post(`/api/admin/promos/${b.dataset.id}/reject`);
          App.toast('已拒絕');
          loadStats(); loadPromos();
        } catch (e) { App.toast(e.message); }
      });
    } catch (e) { $('admList').innerHTML = `<div class="me-empty">${App.esc(e.message)}</div>`; }
  }

  /* ---------- 店舖管理 ---------- */
  async function loadShops() {
    try {
      const j = await App.api.get('/api/admin/merchants?status=approved');
      $('admList').innerHTML = j.items.length ? j.items.map(m => `
        <div class="card adm-card">
          <div class="adm-head">
            <b>${App.esc(m.name)}</b>
            <span class="dc-tag">${App.esc(m.cuisine || '')}</span>
            <span class="adm-user">商家：${App.esc(m.username)}</span>
          </div>
          <div class="adm-meta">
            <span>人均 MOP ${m.price ?? '—'}</span><span>${App.esc(m.addr || '')}</span>
          </div>
          <div class="adm-ops">
            <button class="btn-ghost btn-sm shop-down" data-id="${m.id}">⛔ 下架店舖</button>
          </div>
        </div>`).join('') : '<div class="me-empty">暫無已上架店舖</div>';
      $('admList').querySelectorAll('.shop-down').forEach(b => b.onclick = async () => {
        if (!confirm('確定下架此店舖？將從地圖移除，其進行中活動亦不可兌換。')) return;
        try {
          await App.api.post(`/api/admin/shops/${b.dataset.id}/takedown`);
          App.toast('已下架');
          loadStats(); loadShops();
        } catch (e) { App.toast(e.message); }
      });
    } catch (e) { $('admList').innerHTML = `<div class="me-empty">${App.esc(e.message)}</div>`; }
  }

  /* ---------- 評論管理 ---------- */
  async function loadComments() {
    try {
      const j = await App.api.get('/api/admin/comments');
      $('admList').innerHTML = j.items.length ? j.items.map(c => `
        <div class="card adm-card ${c.status === 'deleted' ? 'adm-deleted' : ''}">
          <div class="adm-head">
            <b>${App.esc(c.username)}</b>
            <span class="dc-tag">${TARGET_LABEL[c.target_type] || c.target_type} #${App.esc(c.target_id)}</span>
            <span class="adm-user">${fmtTs(c.created_at)}</span>
            ${c.status === 'deleted' ? '<span class="dc-tag">已刪除</span>' : ''}
          </div>
          <div class="adm-body">
            <p>${App.esc(c.content)}</p>
            ${(c.photos && c.photos.length) ? `<div class="shop-photos">${c.photos.map(p =>
              `<img src="${App.esc(p)}" alt="評論照片" loading="lazy">`).join('')}</div>` : ''}
          </div>
          ${c.status === 'visible' ? `<div class="adm-ops">
            <button class="btn-ghost btn-sm cm-del" data-id="${c.id}">🗑 刪除（作者 −5 積分）</button>
          </div>` : ''}
        </div>`).join('') : '<div class="me-empty">暫無評論</div>';
      $('admList').querySelectorAll('.cm-del').forEach(b => b.onclick = async () => {
        if (!confirm('確定刪除此評論？作者將被扣 5 積分。')) return;
        try {
          await App.api.del(`/api/comments/${b.dataset.id}`);
          App.toast('已刪除');
          loadStats(); loadComments();
        } catch (e) { App.toast(e.message); }
      });
    } catch (e) { $('admList').innerHTML = `<div class="me-empty">${App.esc(e.message)}</div>`; }
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
    document.querySelectorAll('#admTabs button').forEach(b => {
      b.onclick = () => { S.tab = b.dataset.tab; loadTab(); };
    });
    App.bus.on('auth-required', msg => showLogin(msg || '登入已過期，請重新登入'));
  }

  document.addEventListener('DOMContentLoaded', () => { if (App.pwa) App.pwa.register(); bind(); tryResume(); });
})();
