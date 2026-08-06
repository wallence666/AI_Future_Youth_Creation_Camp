/* map/layers.js — 熱力圖層（功能 01）、美食圖層（功能 02）、雙圖層模式（功能 03）
 * 自原 app.js 搬遷；唯一行為增量：refreshHeat 接入 blend.js 的 U 因子融合（spec 第 3 節），
 * 以及美食圖層支援入駐店舖標記（fm-shop 樣式）。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = App.state;

  /* ================= 功能 01：熱力圖層 ================= */
  function buildHeat() {
    for (const spot of S.spots) {
      const pos = App.ll(spot.lat, spot.lng);
      const glow = L.circle(pos, { radius: spot.radius * 1.75, stroke: false, fillOpacity: 0.16, bubblingMouseEvents: false });
      const core = L.circle(pos, {
        radius: spot.radius, color: '#fff', weight: 1, opacity: 0.55,
        fillOpacity: 0.5, bubblingMouseEvents: false,
      });
      const onTap = () => App.drawer.openSpot(spot);
      glow.on('click', onTap); core.on('click', onTap);
      core.bindTooltip(spot.name, { permanent: true, direction: 'center', className: 'spot-label', interactive: false });
      S.heat[spot.id] = { glow, core, spot };
    }
    applyLayerMode();
  }

  function refreshHeat() {
    const results = CrowdEngine.tick(CrowdEngine.macauNow());
    App.blend.apply(results);                       // v2：融合用戶實時回報 U
    for (const r of results) {
      const h = S.heat[r.spot.id];
      if (!h) continue;
      const color = r.band.color;
      h.glow.setStyle({ fillColor: color });
      h.core.setStyle({ fillColor: color });
      h.core.setRadius(r.spot.radius * (0.8 + 0.4 * r.norm));
    }
    updateLabels();
    App.sheet.updateCityPill(results);
    if (App.$('sheet').classList.contains('open')) App.sheet.render(results);
  }

  function updateLabels() {
    const z = S.map.getZoom();
    const showHeat = z >= 13.75 && S.layerMode !== 'food';
    Object.values(S.heat).forEach(h => showHeat ? h.core.openTooltip() : h.core.closeTooltip());
    // 美食標記不再用常駐 tooltip（見 buildFood 註解），改由分群（cluster）處理密集度，
    // 名稱只在點擊開抽屜時顯示，updateLabels 不需要再對 foodMarks 做任何事。
  }

  /* ================= 功能 02：美食圖層（含入駐店舖，分群顯示） ================= */
  /**
   * 密集商家標記分群（v1.7 修正「太雜亂太醜」）：舊版每個標記都用 permanent tooltip 常駐顯示店名，
   * 官也街/龍環葡韻這類商家密集區在夠近的縮放層級會有 10+ 個標記＋文字標籤互相重疊，完全無法閱讀。
   * 改用 Leaflet.markercluster——縮小或商家密集時自動合併成一個帶數量的圓形徽章，放大或點擊徽章才
   * 展開成個別商家標記；同時拿掉常駐店名標籤，名稱只在點擊個別標記開抽屜時顯示，呼應 DESIGN.md
   * 「資訊優先、低裝飾」方向（Google 地圖同樣不會在地圖上常駐顯示每個 POI 的名稱）。
   */
  function buildFood() {
    S.foodCluster = L.markerClusterGroup({
      maxClusterRadius: 52,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction(cluster) {
        const n = cluster.getChildCount();
        const size = n >= 20 ? 44 : n >= 8 ? 38 : 32;
        return L.divIcon({
          html: `<div class="food-cluster" style="width:${size}px;height:${size}px">${n}</div>`,
          className: '', iconSize: [size, size],
        });
      },
    });
    for (const food of S.foods) {
      const isShop = food.targetType === 'shop';
      const icon = L.divIcon({
        className: '', iconSize: [34, 34], iconAnchor: [17, 33],
        html: `<div class="food-marker ${isShop ? 'fm-shop' : 'fm-' + App.esc(food.cuisine)}"><span>${isShop ? '🏪' : (App.config.CUISINE_ICON[food.cuisine] || '🍴')}</span></div>`,
      });
      const m = L.marker(App.ll(food.lat, food.lng), { icon, bubblingMouseEvents: false });
      m._food = food;
      m.bindTooltip(food.name, { direction: 'bottom', offset: [0, 33], className: 'food-label', interactive: false }); // 非常駐，僅 hover/長按顯示
      m.on('click', () => App.drawer.openFood(food));
      S.foodMarks[food.id] = m;
    }
    applyFoodFilters(false);
    applyLayerMode();
  }

  function foodMatch(food) {
    const f = S.filters;
    if (f.cuisine && food.cuisine !== f.cuisine) return false;
    if (f.tag && !(food.tags || []).includes(f.tag)) return false;
    if (f.price && App.tierOf(food.price) !== f.price) return false;
    if (f.near && App.distFromUser(food) > 1000) return false;
    return true;
  }

  function applyFoodFilters(notify = true) {
    let n = 0;
    const show = S.layerMode !== 'heat';
    for (const food of S.foods) {
      const m = S.foodMarks[food.id];
      const on = S.foodCluster.hasLayer(m);
      const match = foodMatch(food);
      if (match) n++;
      if (match && show) { if (!on) S.foodCluster.addLayer(m); }
      else if (on) S.foodCluster.removeLayer(m);
    }
    updateLabels();
    if (notify) {
      const active = S.filters.near || S.filters.cuisine || S.filters.tag || S.filters.price;
      if (active) App.toast(`篩選出 ${n} 家美食`);
    }
    return n;
  }

  /* ================= 功能 03：雙圖層切換 ================= */
  function applyLayerMode() {
    const mode = S.layerMode;
    Object.values(S.heat).forEach(h => {
      const on = S.map.hasLayer(h.core);
      if (mode === 'food') { if (on) { S.map.removeLayer(h.glow); S.map.removeLayer(h.core); } }
      else if (!on) { h.glow.addTo(S.map); h.core.addTo(S.map); }
    });
    if (S.foodCluster) {   // buildHeat() 先於 buildFood() 執行，初次呼叫時分群群組還沒建立
      const showFood = mode !== 'heat';
      const clusterOn = S.map.hasLayer(S.foodCluster);
      if (showFood && !clusterOn) S.foodCluster.addTo(S.map);
      else if (!showFood && clusterOn) S.map.removeLayer(S.foodCluster);
    }
    // 個別標記的增刪交由 applyFoodFilters 依篩選條件處理（加/移出 S.foodCluster）
    document.querySelectorAll('.lp-item').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    updateLabels();
  }

  function setLayerMode(mode) {
    S.layerMode = mode;
    applyLayerMode();
    applyFoodFilters(false);
  }

  function hideLayerPop() { App.$('layerPop').hidden = true; }

  App.layers = {
    buildHeat, buildFood, refreshHeat, updateLabels,
    applyFoodFilters, applyLayerMode, setLayerMode, hideLayerPop,
  };
})();
