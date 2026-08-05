/* core/store.js — 共享狀態、事件總線、通用小工具
 * 狀態集中於 App.state；模塊間以 App.bus（on/emit）解耦。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const state = {
    map: null, tileLayer: null, useGcj: true, tileErrs: 0,
    spots: [], foods: [], events: [],
    heat: {},            // spotId -> {glow, core}
    foodMarks: {},       // foodId -> marker（入駐店舖以 shop_<id> 為鍵）
    layerMode: 'both',
    filters: { near: false, cuisine: null, tag: null, price: null },
    userLoc: null, meMarker: null, pendingNear: false,
    selSpot: null, selFood: null,
    drawerOpenedAt: 0,
    uLive: {},           // spotId -> {u, n}（後端實時回報因子，blend.js 維護）
  };

  const listeners = {};
  App.state = state;
  App.bus = {
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit(ev, arg) {
      (listeners[ev] || []).forEach(fn => {
        try { fn(arg); } catch (e) { console.error('[bus]', ev, e); }
      });
    },
  };

  App.$ = id => document.getElementById(id);
  App.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** WGS-84 → 當前底圖座標系 */
  App.ll = function (lat, lng) {
    if (state.useGcj) { const [gLng, gLat] = Geo.wgs84ToGcj02(lng, lat); return L.latLng(gLat, gLng); }
    return L.latLng(lat, lng);
  };
  App.distFromUser = function (item) {
    const ref = state.userLoc || App.config.REF_POINT;
    return Geo.distanceM(ref.lat, ref.lng, item.lat, item.lng);
  };
  App.tierOf = price => price <= 50 ? '1' : price <= 100 ? '2' : '3';
})();
