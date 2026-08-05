/* core/pwa.js — Service Worker 註冊 + iOS 安裝引導（spec F9）
 * 無依賴（僅 App 命名空間），三個頁面均引入：
 *  - 主應用：register() + maybeShowIosHint()
 *  - 商家中心/管理後台：register()
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};

  function register() {
    if (!('serviceWorker' in navigator)) return;
    // 直接註冊（非阻塞）：不能等 window load——地圖瓦片請求在無網環境會長期掛起，load 可能遲遲不觸發
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(err => console.warn('[pwa] SW 註冊失敗', err));
  }

  /* iOS Safari 不支持 beforeinstallprompt，需引導手動「分享 → 加入主屏幕」 */
  function maybeShowIosHint() {
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true
      || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    if (!isIos || standalone) return;
    if (localStorage.getItem('axwz_ios_hint_off')) return;
    if (document.getElementById('iosHint')) return;
    const bar = document.createElement('div');
    bar.id = 'iosHint';
    bar.className = 'ios-hint';
    bar.innerHTML =
      '<span class="ih-text">📲 將「澳行無阻」加入主屏幕：Safari 底部 <b>分享</b> → <b>加入主屏幕</b>，獲得全屏體驗</span>' +
      '<button class="ih-close" aria-label="關閉">×</button>';
    bar.querySelector('.ih-close').onclick = () => {
      bar.remove();
      localStorage.setItem('axwz_ios_hint_off', '1');
    };
    document.body.appendChild(bar);
    setTimeout(() => bar.classList.add('show'), 800);
  }

  App.pwa = { register, maybeShowIosHint };
})();
