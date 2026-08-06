/* map/basemap.js — 地圖初始化、瓦片源管理（Geoq→Carto 降級）、定位
 * 邏輯自原 app.js 搬遷，行為不變；跨模塊調用改走 App 命名空間。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = App.state;

  async function init() {
    const map = L.map('map', {
      zoomControl: false, attributionControl: true,
      minZoom: 11, maxZoom: 18,
      maxBounds: L.latLngBounds([22.03, 113.42], [22.30, 113.72]), maxBoundsViscosity: 0.7,
      zoomSnap: 0.25,
    });
    map.attributionControl.setPrefix(false);
    S.map = map;
    // 必須等探測完成、S.useGcj 確定後才能繼續——buildHeat()/buildFood() 會用 App.ll() 依 S.useGcj
    // 決定座標要不要轉 GCJ-02，若不等待，資料載入（本地 JSON，通常 <100ms）很可能比探測（至多 1.5 秒）
    // 先跑完，屆時 S.useGcj 還停在 store.js 的預設值 true，等於不管最終選中哪個底圖源都硬套 GCJ-02
    // 轉換，跟實際底圖的座標系不一致，熱力圖/店鋪標記就會整體偏移，見 pickTiles() 註解。
    await pickTiles();   // 依實際可達性挑選底圖源
    map.fitBounds(L.latLngBounds(App.config.MACAU_BOUNDS[0], App.config.MACAU_BOUNDS[1]));
    map.on('click', () => {
      App.layers.hideLayerPop();
      if (Date.now() - S.drawerOpenedAt > 350) App.drawer.close();
    });
    map.on('zoomend', () => App.layers.updateLabels());
  }

  /**
   * 底圖源快速可達性探測（解決「地圖加載很慢」）：
   * 舊版直接掛上 Geoq（中國大陸服務）作為預設底圖，只有累積超過 8 次瓦片載入失敗才降級 Carto——
   * 但每次瓦片失敗要等瀏覽器自己的連線逾時（可能長達數十秒），且一個視窗會同時發出十幾個瓦片請求，
   * 在 Geoq 不可達的網絡環境下（例如非中國大陸網段、公司/校園防火牆、VPN），會呈現「地圖長時間空白
   * 或極慢才跳出」的體驗，而不是乾脆地切換。
   * 改為：先用一個短逾時（1.5 秒）的探測請求試 Geoq 是否可達，可達才用；探測逾時或失敗，直接改用
   * Carto（全球 CDN，可達性較穩定）。探測跑在使用者自己的瀏覽器/網絡環境下，比在開發環境猜測準確。
   */
  function probeReachable(kind, timeoutMs) {
    const cfg = App.config.TILES[kind];
    const sub = (cfg.subdomains || 'a')[0];
    const url = cfg.url.replace('{s}', sub).replace('{z}', '11').replace('{x}', '1706').replace('{y}', '843').replace('{r}', '');
    return new Promise(resolve => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => { ctrl.abort(); resolve(false); }, timeoutMs);
      fetch(url, { signal: ctrl.signal, mode: 'no-cors', cache: 'no-store' })
        .then(() => { clearTimeout(timer); resolve(true); })
        .catch(() => { clearTimeout(timer); resolve(false); });
    });
  }
  async function pickTiles() {
    const ok = await probeReachable('geoq', 1500);
    setTiles(ok ? 'geoq' : 'carto');
  }

  function setTiles(kind) {
    const cfg = App.config.TILES[kind];
    if (S.tileLayer) S.map.removeLayer(S.tileLayer);
    S.useGcj = cfg.gcj;
    S.tileErrs = 0;
    S.tileLayer = L.tileLayer(cfg.url, {
      maxZoom: 18, subdomains: cfg.subdomains || 'abc', attribution: cfg.attr,
    });
    S.tileLayer.on('tileerror', () => {
      if (kind === 'geoq' && ++S.tileErrs > 4) {  // Geoq 中途失聯 → 降級 Carto(WGS-84)
        setTiles('carto');
        rebuildOverlays();
        App.toast('已切換備用地圖源');
      }
    });
    S.tileLayer.addTo(S.map);
  }

  function rebuildOverlays() {
    Object.values(S.heat).forEach(h => { S.map.removeLayer(h.glow); S.map.removeLayer(h.core); });
    if (S.foodCluster) S.map.removeLayer(S.foodCluster);   // 標記活在分群群組裡，整組移除，不逐一 removeLayer
    S.heat = {}; S.foodMarks = {}; S.foodCluster = null;
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
