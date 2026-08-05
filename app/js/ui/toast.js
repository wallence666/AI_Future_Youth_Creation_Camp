/* ui/toast.js — 輕提示（自原 app.js 搬遷） */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  let timer = null;
  App.toast = function (msg) {
    const t = App.$('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { t.hidden = true; }, 2400);
  };
})();
