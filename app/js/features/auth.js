/* features/auth.js — 賬號系統（spec F1）
 * 註冊/登入 modal、token 管理（localStorage）、「我的」面板（積分/打卡/評論/流水）。
 * 其他模塊經 requireLogin() 守衛互動入口；401 時由 api.js 廣播 auth-required。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const USER_KEY = 'axwz_user';
  let me = null;                     // 當前登入用戶（含 points）
  let authMode = 'login';

  const ROLE_LABEL = { visitor: '遊客', merchant: '商家', admin: '管理員' };
  const REASON_LABEL = {
    register: '註冊獎勵', report: '人流回報', checkin: '打卡',
    comment: '發表評論', comment_photo: '評論附圖', comment_deleted: '評論被刪除',
    exchange: '兌換代金券',
  };

  /* ---------- 本地狀態 ---------- */
  function token() { return localStorage.getItem(App.api.TOKEN_KEY); }
  function clearLocal() {
    me = null;
    localStorage.removeItem(App.api.TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    updateUserBtn();
    App.bus.emit('auth-changed', null);
  }
  function currentUser() { return me; }

  function fmtTime(ts) {
    const d = new Date(ts + 8 * 3600e3);   // 澳門時間
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0'), mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${mm}-${dd} ${hh}:${mi}`;
  }

  /* ---------- 頂欄用戶按鈕 ---------- */
  function updateUserBtn() {
    const btn = App.$('userBtn');
    if (!btn) return;
    if (me) {
      btn.classList.add('logged');
      App.$('userBtnTxt').textContent = me.username.slice(0, 1).toUpperCase();
      btn.title = `${me.username}（${ROLE_LABEL[me.role]}）· 積分 ${me.points}`;
    } else {
      btn.classList.remove('logged');
      App.$('userBtnTxt').textContent = '登入';
      btn.title = '登入 / 註冊';
    }
  }

  /* ---------- 登入 / 註冊 modal ---------- */
  function openAuth(mode) {
    setMode(mode || 'login');
    App.$('authModal').hidden = false;
    setTimeout(() => App.$('authUser').focus(), 60);
  }
  function closeAuth() { App.$('authModal').hidden = true; }
  function setMode(mode) {
    authMode = mode;
    App.$('authTabLogin').classList.toggle('on', mode === 'login');
    App.$('authTabReg').classList.toggle('on', mode === 'register');
    App.$('roleField').hidden = mode !== 'register';
    App.$('authSubmit').textContent = mode === 'login' ? '登入' : '註冊並登入';
    App.$('authErr').hidden = true;
    App.$('authTip').textContent = mode === 'login'
      ? '登入後可打卡、評論、回報人流賺積分'
      : '遊客註冊即送 20 積分；商家註冊後可申請店舖入駐';
  }
  function authError(msg) {
    const el = App.$('authErr');
    el.textContent = msg; el.hidden = false;
  }
  async function submitAuth() {
    const username = App.$('authUser').value.trim();
    const password = App.$('authPass').value;
    if (!username || !password) return authError('請填寫用戶名與密碼');
    const btn = App.$('authSubmit');
    btn.disabled = true;
    try {
      const j = authMode === 'login'
        ? await App.api.post('/api/auth/login', { username, password })
        : await App.api.post('/api/auth/register', {
            username, password,
            role: document.querySelector('input[name="authRole"]:checked').value,
          });
      localStorage.setItem(App.api.TOKEN_KEY, j.token);
      me = j.user;
      localStorage.setItem(USER_KEY, JSON.stringify(me));
      closeAuth();
      updateUserBtn();
      App.bus.emit('auth-changed', me);
      App.toast(authMode === 'register'
        ? (me.role === 'visitor' ? '註冊成功，已送 20 積分 🎉' : '商家註冊成功，請到商家中心完善店舖資料')
        : `歡迎回來，${me.username}`);
      if (me.role === 'merchant' && authMode !== 'register') {
        setTimeout(() => App.toast('商家請前往「商家中心」管理店舖'), 2600);
      }
    } catch (e) {
      authError(e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- 「我的」面板 ---------- */
  async function openMe() {
    if (!me) return openAuth('login');
    const modal = App.$('meModal');
    modal.hidden = false;
    App.$('meName').textContent = me.username;
    App.$('meRole').textContent = ROLE_LABEL[me.role] || me.role;
    App.$('mePoints').textContent = me.points;
    App.$('meCheckins').textContent = '—';
    App.$('meComments').textContent = '—';
    App.$('meLog').innerHTML = '<div class="me-empty">載入中…</div>';
    App.$('meMerchant').hidden = me.role !== 'merchant';
    try {
      const [info, log] = await Promise.all([
        App.api.get('/api/me'),
        App.api.get('/api/me/points'),
      ]);
      me = { ...me, ...info.user };
      localStorage.setItem(USER_KEY, JSON.stringify(me));
      updateUserBtn();
      App.$('mePoints').textContent = info.user.points;
      App.$('meCheckins').textContent = info.user.checkins;
      App.$('meComments').textContent = info.user.comments;
      if (App.coupon) App.coupon.renderMine();        // 我的代金券（P3）
      App.$('meLog').innerHTML = log.items.length
        ? log.items.map(it => `<div class="me-log-item">
            <span class="ml-delta ${it.delta >= 0 ? 'plus' : 'minus'}">${it.delta >= 0 ? '+' : ''}${it.delta}</span>
            <span class="ml-reason">${App.esc(REASON_LABEL[it.reason] || it.reason)}</span>
            <span class="ml-time">${fmtTime(it.created_at)}</span>
          </div>`).join('')
        : '<div class="me-empty">暫無積分記錄</div>';
    } catch (e) {
      App.$('meLog').innerHTML = `<div class="me-empty">${App.esc(e.message)}</div>`;
    }
  }
  function logout() {
    clearLocal();
    App.$('meModal').hidden = true;
    App.toast('已登出');
  }

  /* ---------- 對外 ---------- */
  /** 互動守衛：未登入 → 提示 + 彈登入框，返回 false */
  function requireLogin() {
    if (me) return true;
    App.toast('請先登入');
    openAuth('login');
    return false;
  }

  function bind() {
    App.$('userBtn').onclick = () => (me ? openMe() : openAuth('login'));
    App.$('authTabLogin').onclick = () => setMode('login');
    App.$('authTabReg').onclick = () => setMode('register');
    App.$('authSubmit').onclick = submitAuth;
    App.$('authPass').addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
    App.$('authClose').onclick = closeAuth;
    App.$('authModal').addEventListener('click', e => { if (e.target.id === 'authModal') closeAuth(); });
    App.$('meClose').onclick = () => { App.$('meModal').hidden = true; };
    App.$('meModal').addEventListener('click', e => { if (e.target.id === 'meModal') App.$('meModal').hidden = true; });
    App.$('meLogout').onclick = logout;
    App.bus.on('auth-required', msg => { App.toast(msg || '請先登入'); openAuth('login'); });
  }

  /** 啟動：有 token 則靜默續期用戶資料 */
  async function init() {
    bind();
    if (!token()) { updateUserBtn(); return; }
    try {
      me = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch { me = null; }
    updateUserBtn();
    try {
      const j = await App.api.get('/api/me', { silent401: true });
      me = j.user;
      localStorage.setItem(USER_KEY, JSON.stringify(me));
      updateUserBtn();
      App.bus.emit('auth-changed', me);
    } catch (e) { /* token 失效：clearLocal 已由 api.js 處理 */ }
  }

  /** 靜默刷新用戶資料（兌換積分變動等場景） */
  async function refresh() {
    if (!token()) return;
    try {
      const j = await App.api.get('/api/me', { silent401: true });
      me = { ...me, ...j.user };
      localStorage.setItem(USER_KEY, JSON.stringify(me));
      updateUserBtn();
    } catch (e) { /* 離線忽略 */ }
  }

  App.auth = { init, requireLogin, currentUser, clearLocal, openAuth, openMe, refresh };
})();
