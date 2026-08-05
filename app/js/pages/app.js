/* pages/app.js — 地圖主應用入口
 * 職責：啟動流程（數據加載 → 圖層構建 → 定時刷新）、全局按鈕綁定、天氣 W 係數。
 * 入駐店舖自 GET /api/shops 合併進美食圖層（spec §6：帶「入駐」角標）。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = App.state;

  /* ---------- 入駐店舖 → 美食圖層數據形 ---------- */
  function normalizeShop(s) {
    return {
      targetType: 'shop',
      id: 'shop_' + s.id,                 // 本地鍵（避免與靜態 food id 衝突）
      apiId: String(s.id),                // API 互動用（checkin/comment）
      name: s.name,
      cuisine: s.cuisine || '其他',
      price: s.price || 0,
      lat: s.lat, lng: s.lng,
      addr: s.addr || '', hours: s.hours || '',
      intro: s.intro || '',
      photos: s.photos || [], menu: s.menu || [], promos: s.promos || [],
      tags: ['入駐'],
      signature: (s.menu || []).slice(0, 4).map(m => m.name),
    };
  }

  /* ================= 天氣（W 係數） ================= */
  function weatherIcon(code) {
    if (code == null) return '🌡️';
    if (code === 0) return '☀️';
    if ([1, 2].includes(code)) return '⛅';
    if (code === 3) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
    if ([95, 96, 99].includes(code)) return '⛈️';
    return '🌡️';
  }
  async function fetchWeather() {
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=22.1987&longitude=113.5439&current=temperature_2m,weather_code&timezone=Asia%2FMacau';
      const res = await fetch(url);
      const j = await res.json();
      const code = j.current.weather_code, temp = Math.round(j.current.temperature_2m);
      CrowdEngine.setWeather({ code, temp });
      const pill = App.$('weatherPill');
      pill.hidden = false;
      pill.textContent = `${weatherIcon(code)} 澳門 ${temp}°C`;
      App.layers.refreshHeat();   // 天氣變化後重算
    } catch (e) { /* 離線時靜默降級，W=1 */ }
  }

  /* ---------- 30 秒熱力刷新（先拉 U 再重算） ---------- */
  async function refreshCycle() {
    await App.blend.refresh();
    App.layers.refreshHeat();
  }

  /* ================= 全局按鈕 ================= */
  function bindUI() {
    App.$('layerFab').onclick = e => { e.stopPropagation(); App.$('layerPop').hidden = !App.$('layerPop').hidden; };
    document.querySelectorAll('.lp-item').forEach(b => {
      b.onclick = () => { App.layers.setLayerMode(b.dataset.mode); App.layers.hideLayerPop(); };
    });
    App.$('locateFab').onclick = () => {
      App.basemap.locate();
      if (S.userLoc) App.basemap.flyTo(S.userLoc.lat, S.userLoc.lng, 15.5);
    };
    App.$('infoFab').onclick = () => { App.$('infoModal').hidden = false; };
    App.$('brandBtn').onclick = () => { App.$('infoModal').hidden = false; };
    App.$('infoOk').onclick = () => { App.$('infoModal').hidden = true; };
    App.$('infoModal').addEventListener('click', e => { if (e.target.id === 'infoModal') App.$('infoModal').hidden = true; });
    App.$('cityPill').onclick = App.sheet.open;
    App.$('sheetClose').onclick = App.sheet.close;
    App.search.bind();
    App.drawer.bindDrag();
  }

  /* ================= 啟動 ================= */
  async function init() {
    if (App.pwa) { App.pwa.register(); App.pwa.maybeShowIosHint(); }
    App.basemap.init();
    bindUI();
    App.auth.init();
    App.report.init();
    try {
      const [model, spotsJ, foodsJ, eventsJ, shopsJ] = await Promise.all([
        fetch('data/model.json').then(r => r.json()),
        fetch('data/spots.json').then(r => r.json()),
        fetch('data/foods.json').then(r => r.json()),
        fetch('data/events.json').then(r => r.json()).catch(() => []),
        App.api.get('/api/shops').catch(() => ({ shops: [] })),   // 後端離線 → 僅官方收錄
      ]);
      S.spots = spotsJ.spots;
      S.foods = [...foodsJ.foods, ...(shopsJ.shops || []).map(normalizeShop)];
      S.events = Array.isArray(eventsJ) ? eventsJ : [];
      CrowdEngine.init(model, S.spots, S.events);
      App.layers.buildHeat();
      App.layers.buildFood();
      App.filters.renderChips();
      App.layers.refreshHeat();
      App.blend.refresh().then(() => App.layers.refreshHeat());  // 首次 U 因子
      setInterval(refreshCycle, 30000);          // 30 秒即時訊號刷新（含 U）
      fetchWeather();
      setInterval(fetchWeather, 600000);        // 10 分鐘天氣刷新
      if (!sessionStorage.getItem('axwz_seen')) {  // 首次進入展示模型說明
        App.$('infoModal').hidden = false;
        sessionStorage.setItem('axwz_seen', '1');
      }
    } catch (e) {
      console.error(e);
      App.toast('數據載入失敗，請重新整理');
      App.$('cityPillTxt').textContent = '數據載入失敗';
    }
  }

  // 調試/測試句柄（演示與自動化驗收用）
  window.AXWZ = {
    state: S,
    openSpot: (...a) => App.drawer.openSpot(...a),
    openFood: (...a) => App.drawer.openFood(...a),
    setLayerMode: (...a) => App.layers.setLayerMode(...a),
    flyTo: (...a) => App.basemap.flyTo(...a),
    refreshHeat: () => App.layers.refreshHeat(),
  };
  document.addEventListener('DOMContentLoaded', init);
})();
