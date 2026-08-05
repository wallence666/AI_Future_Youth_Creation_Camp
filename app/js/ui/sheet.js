/* ui/sheet.js — 全澳景區總覽列表 + 城市概況 pill（自原 app.js 搬遷，行為不變） */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = App.state;

  function fmtMacau(d) {
    return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  }

  function updateCityPill(results) {
    const c = { green: 0, yellow: 0, red: 0 };
    results.forEach(r => c[r.band.key]++);
    const now = CrowdEngine.macauNow();
    App.$('cityPillTxt').textContent = `全澳 🟢${c.green} 🟡${c.yellow} 🔴${c.red} · ${fmtMacau(now)} 更新`;
    App.$('eventDot').hidden = CrowdEngine.todayEvents(now).length === 0;
  }

  function render(results) {
    const now = CrowdEngine.macauNow();
    const hhmm = fmtMacau(now);
    App.$('sheetSub').textContent = `${hhmm} 更新 · 旅遊局逐時統計 × CrowdIndex 模型估算`;
    const evs = CrowdEngine.todayEvents(now);
    const evBox = App.$('sheetEvents');
    if (evs.length) {
      evBox.hidden = false;
      evBox.innerHTML = '<b>今日活動（H(t) 放大中）</b><br>' + evs.map(e =>
        `🎤 ${App.esc(e.title)}${e.venue ? ' @ ' + App.esc(e.venue.name) : ''}${e.holiday ? '（公眾假期）' : ''}`).join('<br>');
    } else evBox.hidden = true;
    const sorted = [...results].sort((a, b) => b.norm - a.norm);
    App.$('sheetList').innerHTML = sorted.map(r => {
      const f1 = CrowdEngine.forecast(r.spot, 60);
      const diff = f1 - r.norm;
      const cls = diff > 0.04 ? 'up' : diff < -0.04 ? 'down' : '';
      const arrow = diff > 0.04 ? '↑ 升溫' : diff < -0.04 ? '↓ 回落' : '→ 平穩';
      return `<button class="sl-item" data-id="${r.spot.id}">
        <span class="sl-dot" style="background:${r.band.color}"></span>
        <span class="sl-main"><span class="sl-name">${App.esc(r.spot.name)}</span>
        <span class="sl-sub">${App.esc(r.spot.district)}</span></span>
        <span class="sl-right"><span class="sl-band" style="background:${r.band.color}">${r.band.label}</span>
        <span class="sl-fc ${cls}">1 小時後 ${arrow}</span></span>
      </button>`;
    }).join('');
    App.$('sheetList').querySelectorAll('.sl-item').forEach(el => {
      el.onclick = () => {
        const s = S.spots.find(x => x.id === el.dataset.id);
        close(); App.basemap.flyTo(s.lat, s.lng, 15); App.drawer.openSpot(s);
      };
    });
  }

  function open() {
    App.drawer.close();
    App.$('sheet').classList.add('open'); App.$('sheet').setAttribute('aria-hidden', 'false');
    render(CrowdEngine.latest.length ? CrowdEngine.latest : CrowdEngine.tick(CrowdEngine.macauNow()));
  }
  function close() { App.$('sheet').classList.remove('open'); App.$('sheet').setAttribute('aria-hidden', 'true'); }

  App.sheet = { updateCityPill, render, open, close };
})();
