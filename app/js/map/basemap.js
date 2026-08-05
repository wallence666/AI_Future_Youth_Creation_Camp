/* map/basemap.js — 地圖初始化、瓦片源管理（Geoq→Carto 降級）、定位
 * 邏輯自原 app.js 搬遷，行為不變；跨模塊調用改走 App 命名空間。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = App.state;

  function init() {
    const map = L.map('map', {
      zoomControl: false, attributionControl: true,
      minZoom: 11, maxZoom: 18,
      maxBounds: L.latLngBounds([22.03, 113.42], [22.30, 113.72]), maxBoundsViscosity: 0.7,
      zoomSnap: 0.25,
    });
    map.attributionControl.setPrefix(false);
    S.map = map;
    setTiles('geoq');
    map.fitBounds(L.latLngBounds(App.config.MACAU_BOUNDS[0], App.config.MACAU_BOUNDS[1]));
    map.on('click', () => {
      App.layers.hideLayerPop();
      if (Date.now() - S.drawerOpenedAt > 350) App.drawer.close();
    });
    map.on('zoomend', () => App.layers.updateLabels());
  }

  function setTiles(kind) {
    const cfg = App.config.TILES[kind];
    if (S.tileLayer) S.map.removeLayer(S.tileLayer);
    S.useGcj = cfg.gcj;
    S.tileLayer = L.tileLayer(cfg.url, {
      maxZoom: 18, subdomains: cfg.subdomains || 'abc', attribution: cfg.attr,
    });
    S.tileLayer.on('tileerror', () => {
      if (kind === 'geoq' && ++S.tileErrs > 8) {  // Geoq 不可達 → 降級 Carto(WGS-84)
        setTiles('carto');
        rebuildOverlays();
        App.toast('已切換備用地圖源');
      }
    });
    S.tileLayer.addTo(S.map);
  }

  function rebuildOverlays() {
    Object.values(S.heat).forEach(h => { S.map.removeLayer(h.glow); S.map.removeLayer(h.core); });
    Object.values(S.foodMarks).forEach(m => S.map.removeLayer(m));
    S.heat = {}; S.foodMarks = {};
    if (S.meMarker) { S.map.removeLayer(S.meMarker); S.meMarker = null; }
    App.layers.buildHeat(); App.layers.buildFood(); App.layers.refreshHeat();
    if (S.userLoc) placeMe(S.userLoc);
  }

  function flyTo(lat, lng, zoom) {
    S.map.flyTo(App.ll(lat, lng), zoom || 15.5, { duration: 0.7 });
  }

  /* ---------- 定位 ---------- */
  function locate() {
    if (!navigator.geolocation) { App.toast('此裝置不支援定位'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        S.userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        placeMe(S.userLoc);
        App.bus.emit('located', S.userLoc);
        if (S.pendingNear) { S.pendingNear = false; App.layers.applyFoodFilters(); }
        App.toast('已定位');
      },
      () => { App.toast('未能取得定位，距離以議事亭前地計算'); S.pendingNear = false; App.layers.applyFoodFilters(false); },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    );
  }

  function placeMe(loc) {
    const pos = App.ll(loc.lat, loc.lng);
    if (!S.meMarker) {
      S.meMarker = L.marker(pos, {
        icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false, zIndexOffset: 500,
      }).addTo(S.map);
    } else S.meMarker.setLatLng(pos);
  }

  App.basemap = { init, setTiles, rebuildOverlays, flyTo, locate, placeMe };
})();
