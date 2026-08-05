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
    const showFood = z >= 15 && S.layerMode !== 'heat';
    Object.values(S.heat).forEach(h => showHeat ? h.core.openTooltip() : h.core.closeTooltip());
    Object.values(S.foodMarks).forEach(m => {
      if (showFood && S.map.hasLayer(m)) m.openTooltip(); else m.closeTooltip();
    });
  }

  /* ================= 功能 02：美食圖層（含入駐店舖） ================= */
  function buildFood() {
    for (const food of S.foods) {
      const isShop = food.targetType === 'shop';
      const icon = L.divIcon({
        className: '', iconSize: [34, 34], iconAnchor: [17, 33],
        html: `<div class="food-marker ${isShop ? 'fm-shop' : 'fm-' + App.esc(food.cuisine)}"><span>${isShop ? '🏪' : (App.config.CUISINE_ICON[food.cuisine] || '🍴')}</span></div>`,
      });
      const m = L.marker(App.ll(food.lat, food.lng), { icon, bubblingMouseEvents: false });
      m._food = food;
      m.bindTooltip(food.name, { permanent: true, direction: 'bottom', offset: [0, 33], className: 'food-label', interactive: false });
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
      const on = S.map.hasLayer(m);
      const match = foodMatch(food);
      if (match) n++;
      if (match && show) { if (!on) m.addTo(S.map); }
      else if (on) S.map.removeLayer(m);
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
    // 美食標註的增刪統一交由 applyFoodFilters 依圖層模式 + 篩選條件處理
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
