/* features/report.js — 人流互助問卷（spec F2）
 * 雙通道：
 *   1. 手動：景點詳情卡常駐「我在現場，回報人流」按鈕（不需定位）。
 *   2. 自動：授權定位後 watchPosition，進入景點 150m 彈快捷問卷（同景點 30 分鐘不重複）。
 * 提交成功即時以響應中的 liveU 更新本地 U 因子並刷新熱力（+6 積分）。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = App.state;
  const LEVELS = [
    { level: 1, cls: 'ro-g', emoji: '🟢', label: '暢通', sub: '不用排隊' },
    { level: 2, cls: 'ro-y', emoji: '🟡', label: '一般', sub: '略有等候' },
    { level: 3, cls: 'ro-r', emoji: '🔴', label: '擁擠', sub: '人頭湧湧' },
  ];
  let modalSpot = null;      // 手動問卷目標
  let barSpot = null;        // 快捷條目標
  let watchStarted = false;

  /* ---------- 冷卻（localStorage，與後端 30 分鐘限頻對齊） ---------- */
  const cdKey = id => 'axwz_rp_' + id;
  function inCooldown(spotId) {
    const t = Number(localStorage.getItem(cdKey(spotId)) || 0);
    return Date.now() - t < App.config.REPORT_COOLDOWN_MIN * 60000;
  }
  function setCooldown(spotId) { localStorage.setItem(cdKey(spotId), String(Date.now())); }

  /* ---------- 提交 ---------- */
  async function submit(spot, level) {
    try {
      const j = await App.api.post(`/api/spots/${spot.id}/reports`, { level });
      setCooldown(spot.id);
      if (j.liveU) S.uLive[spot.id] = j.liveU;
      App.layers.refreshHeat();
      App.toast(`感謝回報！+${App.config.POINTS.report} 積分`);
      return true;
    } catch (e) {
      if (e.status === 429) setCooldown(spot.id);
      App.toast(e.message);
      return false;
    }
  }

  /* ---------- 手動通道：詳情卡按鈕 + 三檔 modal ---------- */
  function enhanceSpot(spot) {
    const zone = App.$('reportZone');
    if (!zone) return;
    zone.innerHTML = `<button class="btn btn-report" id="reportBtn">
      📢 我在現場，回報人流 <small>+${App.config.POINTS.report} 分</small>
    </button>`;
    App.$('reportBtn').onclick = () => {
      if (!App.auth.requireLogin()) return;
      modalSpot = spot;
      App.$('reportSpotName').textContent = `「${spot.name}」現在的人流情況？`;
      App.$('reportModal').hidden = false;
    };
  }

  function bindModal() {
    App.$('reportOpts').querySelectorAll('.ro').forEach(b => {
      b.onclick = async () => {
        if (!modalSpot) return;
        App.$('reportModal').hidden = true;
        await submit(modalSpot, Number(b.dataset.level));
        modalSpot = null;
      };
    });
    App.$('reportCancel').onclick = () => { App.$('reportModal').hidden = true; modalSpot = null; };
    App.$('reportModal').addEventListener('click', e => {
      if (e.target.id === 'reportModal') { App.$('reportModal').hidden = true; modalSpot = null; }
    });
  }

  /* ---------- 自動通道：定位觸發快捷問卷條 ---------- */
  function ensureWatch() {
    if (watchStarted || !navigator.geolocation) return;
    watchStarted = true;
    navigator.geolocation.watchPosition(onPosition, () => {}, { enableHighAccuracy: true, maximumAge: 30000 });
  }

  function onPosition(pos) {
    const me = App.auth.currentUser && App.auth.currentUser();
    if (!me) return hideBar();                                  // 未登入不打擾
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    let best = null, bestD = Infinity;
    for (const s of S.spots) {
      const d = Geo.distanceM(lat, lng, s.lat, s.lng);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best || bestD > App.config.REPORT_RADIUS_M) return hideBar();
    if (barSpot && barSpot.id === best.id && !App.$('reportBar').hidden) return; // 已展示同景點
    if (inCooldown(best.id)) return hideBar();
    showBar(best);
  }

  function showBar(spot) {
    barSpot = spot;
    setCooldown(spot.id);                                       // 30 分鐘內不重複彈（spec F2）
    App.$('reportBarTxt').textContent = `你在「${spot.name}」附近 — 現場人流如何？`;
    App.$('reportBar').hidden = false;
  }
  function hideBar() {
    barSpot = null;
    const bar = App.$('reportBar');
    if (bar) bar.hidden = true;
  }

  function bindBar() {
    App.$('reportBarOpts').querySelectorAll('.rb').forEach(b => {
      b.onclick = async () => {
        const spot = barSpot;
        hideBar();
        if (spot) await submit(spot, Number(b.dataset.level));
      };
    });
    App.$('reportBarX').onclick = hideBar;
  }

  function init() {
    bindModal();
    bindBar();
    App.bus.on('located', ensureWatch);   // 首次手動定位成功後啟動持續監聽
  }

  App.report = { init, enhanceSpot };
})();
