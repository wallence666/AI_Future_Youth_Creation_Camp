/* core/api.js — fetch 封裝（spec 第 4 節）
 * 統一處理：baseURL、token 注入（localStorage）、401 清理與廣播、錯誤規格化。
 * 依賴：core/config.js；App.auth 於運行時才引用（避免加載順序耦合）。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const TOKEN_KEY = 'axwz_token';

  async function request(method, path, { body, form, silent401 } = {}) {
    const headers = {};
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = 'Bearer ' + token;
    let payload;
    if (form) payload = form;                                   // FormData：瀏覽器自帶 boundary
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

    let res;
    try {
      res = await fetch(App.config.API_BASE + path, { method, headers, body: payload });
    } catch (e) {
      throw Object.assign(new Error('網絡連接失敗，請稍後再試'), { status: 0 });
    }
    let data = null;
    try { data = await res.json(); } catch { /* 空響應 */ }

    if (res.status === 401) {
      if (App.auth) App.auth.clearLocal();
      if (!silent401) App.bus.emit('auth-required', (data && data.error) || '請先登入');
    }
    if (!res.ok) {
      throw Object.assign(new Error((data && data.error) || `請求失敗（${res.status}）`), { status: res.status, data });
    }
    return data;
  }

  App.api = {
    TOKEN_KEY,
    get: (path, opts) => request('GET', path, opts),
    post: (path, body, opts) => request('POST', path, { ...opts, body }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body }),
    postForm: (path, form, opts) => request('POST', path, { ...opts, form }),
    del: (path, body, opts) => request('DELETE', path, { ...opts, body }), // body 可選（如商家刪照片帶 url）
  };
})();
