/* ui/drawer.js — 底部詳情抽屜：景點卡 / 美食卡 / 入駐店舖卡 + 趨勢圖 + 導航
 * 自原 app.js 搬遷；增量：
 *   - 景點卡掛載 reportZone（人流問卷，features/report.js）；
 *   - 三類卡片均掛載 socialZone（打卡 + 評論，features/social.js）；
 *   - 店舖卡預留 promoZone（代金券，P3 features/coupon.js 填充）；
 *   - 景點卡顯示 U 融合標註（CrowdIndex v2）。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = App.state;

  /* ================= 抽屜骨架 ================= */
  function open(html) {
    const d = App.$('drawer');
    App.$('drawerBody').innerHTML = html;
    d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
    S.drawerOpenedAt = Date.now();
  }
  function close() {
    const d = App.$('drawer');
    if (!d.classList.contains('open')) return;
    d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
    S.selSpot = null; S.selFood = null;
  }
  function bindDrag() {
    const handle = App.$('drawerHandle'), d = App.$('drawer');
    let startY = 0, dy = 0, dragging = false;
    handle.addEventListener('touchstart', e => { dragging = true; startY = e.touches[0].clientY; dy = 0; d.classList.add('dragging'); }, { passive: true });
    handle.addEventListener('touchmove', e => {
      if (!dragging) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      d.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    handle.addEventListener('touchend', () => {
      dragging = false; d.classList.remove('dragging'); d.style.transform = '';
      if (dy > 90) close();
    });
    App.$('drawerClose').onclick = close;
  }

  /* ---------- 景點詳情卡 ---------- */
  function openSpot(spot) {
    S.selSpot = spot; S.selFood = null;
    const r = CrowdEngine.latest.find(x => x.spot.id === spot.id) || CrowdEngine.tick(CrowdEngine.macauNow()).find(x => x.spot.id === spot.id);
    const best = CrowdEngine.bestTime(spot);
    const fcs = [30, 60, 120].map(m => {
      const norm = CrowdEngine.forecast(spot, m);
      const band = bandOf(norm);
      const diff = norm - r.norm;
      const arrow = diff > 0.04 ? '↑' : diff < -0.04 ? '↓' : '→';
      const label = m === 30 ? '+30分' : m === 60 ? '+1時' : '+2時';
      return `<div class="fc-chip"><div class="t">${label}</div><div class="v" style="color:${band.color}">${arrow} ${band.label}</div></div>`;
    }).join('');
    const grpLabel = { temple_plaza: '廟宇廣場型', pedestrian: '商業步行街型', indoor: '室內場館型', waterfront: '濱海戶外型' }[spot.group] || '';
    const uNote = r.u ? ` · 含 ${r.u.n} 份現場回報` : '';
    open(`
      <div class="dc-head">
        <div class="dc-title">
          <div class="dc-name">${App.esc(spot.name)}</div>
          <div class="dc-meta">${App.esc(spot.district)} · ${grpLabel} · ${spot.indoor ? '室內' : '室外'}</div>
        </div>
        <span class="band-badge band-${r.band.key}">${r.band.label}</span>
      </div>
      <div class="crowd-now">
        <div class="crowd-idx" style="color:${r.band.color}">${Math.round(r.norm * 100)}<small> /100 擁擠指數</small></div>
        <div class="crowd-note">全澳 ${S.spots.length} 個景區 Min-Max 正規化相對排名${uNote}</div>
      </div>
      <div class="fc-row">${fcs}</div>
      <div class="chart-wrap">
        <div class="chart-title"><b>未來 12 小時人流趨勢</b><span>虛線＝時間衰減預測</span></div>
        <canvas id="trendChart"></canvas>
      </div>
      <div class="best-box"><span class="bb-ic">🕐</span><div><b>何時去最好</b> · ${App.esc(best.text)}</div></div>
      <div id="reportZone"></div>
      <div class="info-rows">
        <div class="info-row"><span class="k">開放時間</span><span>${App.esc(spot.hours)}</span></div>
        <div class="info-row"><span class="k">門票</span><span>${App.esc(spot.ticket)}</span></div>
        <div class="info-row"><span class="k">簡介</span><span>${App.esc(spot.desc)}</span></div>
      </div>
      <div id="socialZone"></div>
      <div class="btn-row">
        <a class="btn btn-gold" href="${navUrl(spot.name, spot.lat, spot.lng, spot.district)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24"><path d="M21.71 11.29l-9-9a1 1 0 0 0-1.42 0l-9 9a1 1 0 0 0 0 1.42l9 9a1 1 0 0 0 1.42 0l9-9a1 1 0 0 0 0-1.42zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z"/></svg>
          微信導航前往
        </a>
      </div>`);
    requestAnimationFrame(() => drawTrendChart(App.$('trendChart'), CrowdEngine.series(spot, 30, 12)));
    if (App.report) App.report.enhanceSpot(spot);
    if (App.social) App.social.enhance('spot', spot.id);
  }
  function bandOf(norm) { return CrowdEngine.BANDS.find(b => norm < b.max) || CrowdEngine.BANDS[2]; }

  /* ---------- 美食詳情卡（官方收錄） ---------- */
  function openFood(food) {
    if (food.targetType === 'shop') return openShop(food);
    S.selFood = food; S.selSpot = null;
    const stars = '★'.repeat(Math.round(food.rating)) + '☆'.repeat(5 - Math.round(food.rating));
    const tags = [food.cuisine, ...(food.tags || [])].map(t =>
      `<span class="dc-tag ${t === '米芝蓮' ? 'hot' : ''}">${App.esc(t)}</span>`).join('');
    const dishes = (food.signature || []).map(d => `<span class="dish">${App.esc(d)}</span>`).join('');
    const dist = S.userLoc ? Geo.fmtDistance(App.distFromUser(food)) : null;
    open(`
      <div class="dc-head">
        <div class="dc-title">
          <div class="dc-name">${App.esc(food.name)}</div>
          <div class="dc-meta">${App.esc(food.addr)}</div>
        </div>
      </div>
      <div class="dc-tags">${tags}</div>
      <div class="rate-row">
        <span class="stars">${stars}</span>
        <span class="rate-num">${food.rating.toFixed(1)}</span>
        <span class="rate-cnt">${food.reviews} 則評價</span>
        <span class="price-pill">人均 MOP ${food.price}</span>
      </div>
      <div class="dish-row">${dishes}</div>
      <div class="review-box">「${App.esc(food.review)}」</div>
      <div class="info-rows">
        <div class="info-row"><span class="k">營業時間</span><span>${App.esc(food.hours)}</span></div>
        <div class="info-row"><span class="k">地址</span><span>${App.esc(food.addr)}</span></div>
        ${dist ? `<div class="info-row"><span class="k">距離</span><span>約 ${dist}${S.userLoc ? '' : '（以議事亭前地計）'}</span></div>` : ''}
      </div>
      <div id="socialZone"></div>
      <div class="btn-row">
        <a class="btn btn-gold" href="${navUrl(food.name, food.lat, food.lng, food.addr)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24"><path d="M21.71 11.29l-9-9a1 1 0 0 0-1.42 0l-9 9a1 1 0 0 0 0 1.42l9 9a1 1 0 0 0 1.42 0l9-9a1 1 0 0 0 0-1.42zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z"/></svg>
          微信導航前往
        </a>
        <button class="btn btn-ghost" id="copyAddrBtn" style="flex:.62">複製地址</button>
      </div>`);
    App.$('copyAddrBtn').onclick = () => {
      const text = `${food.name} ${food.addr}`;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(() => App.toast('地址已複製'))
        .catch(() => App.toast(text));
    };
    if (App.social) App.social.enhance('food', food.id);
  }

  /* ---------- 入駐店舖詳情卡（spec F3/F4：店舖同樣開放打卡/評論） ---------- */
  function openShop(shop) {
    S.selFood = shop; S.selSpot = null;
    const tags = ['入駐', shop.cuisine].map(t =>
      `<span class="dc-tag ${t === '入駐' ? 'hot' : ''}">${App.esc(t)}</span>`).join('');
    const photos = (shop.photos || []).length
      ? `<div class="shop-photos">${shop.photos.map(p => `<img src="${App.esc(p)}" alt="店舖照片" loading="lazy">`).join('')}</div>` : '';
    const menu = (shop.menu || []).length
      ? `<div class="menu-list">${shop.menu.map(m => `<div class="menu-item"><span>${App.esc(m.name)}</span><b>MOP ${App.esc(String(m.price))}</b></div>`).join('')}</div>` : '';
    const dist = S.userLoc ? Geo.fmtDistance(App.distFromUser(shop)) : null;
    open(`
      <div class="dc-head">
        <div class="dc-title">
          <div class="dc-name">${App.esc(shop.name)}</div>
          <div class="dc-meta">${App.esc(shop.addr || '')}</div>
        </div>
        <span class="price-pill" style="margin:4px 0 0">人均 MOP ${shop.price || '—'}</span>
      </div>
      <div class="dc-tags">${tags}</div>
      ${photos}
      ${shop.intro ? `<div class="review-box">${App.esc(shop.intro)}</div>` : ''}
      ${menu}
      <div id="promoZone"></div>
      <div class="info-rows">
        ${shop.hours ? `<div class="info-row"><span class="k">營業時間</span><span>${App.esc(shop.hours)}</span></div>` : ''}
        <div class="info-row"><span class="k">地址</span><span>${App.esc(shop.addr || '')}</span></div>
        ${dist ? `<div class="info-row"><span class="k">距離</span><span>約 ${dist}</span></div>` : ''}
      </div>
      <div id="socialZone"></div>
      <div class="btn-row">
        <a class="btn btn-gold" href="${navUrl(shop.name, shop.lat, shop.lng, shop.addr)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24"><path d="M21.71 11.29l-9-9a1 1 0 0 0-1.42 0l-9 9a1 1 0 0 0 0 1.42l9 9a1 1 0 0 0 1.42 0l9-9a1 1 0 0 0 0-1.42zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z"/></svg>
          微信導航前往
        </a>
      </div>`);
    if (App.coupon) App.coupon.enhanceShop(shop);      // P3：限時活動 + 兌換
    if (App.social) App.social.enhance('shop', shop.apiId);
  }

  /* ---------- 趨勢圖（canvas） ---------- */
  function drawTrendChart(canvas, pts) {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const padL = 6, padR = 6, padT = 12, padB = 20;
    const iw = W - padL - padR, ih = H - padT - padB;
    const X = i => padL + (i / (pts.length - 1)) * iw;
    const Y = v => padT + (1 - v) * ih;
    // 三色帶背景
    const zones = [[0, 0.38, 'rgba(62,156,108,.09)'], [0.38, 0.68, 'rgba(233,196,106,.12)'], [0.68, 1, 'rgba(210,72,51,.09)']];
    for (const [a, b, c] of zones) { ctx.fillStyle = c; ctx.fillRect(padL, Y(b), iw, Y(a) - Y(b)); }
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(27,36,56,.18)'; ctx.lineWidth = 1;
    [0.38, 0.68].forEach(v => { ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(padL + iw, Y(v)); ctx.stroke(); });
    ctx.setLineDash([]);
    // 面積漸變
    const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
    grad.addColorStop(0, 'rgba(229,176,78,.34)'); grad.addColorStop(1, 'rgba(229,176,78,.02)');
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p.norm)) : ctx.moveTo(X(0), Y(p.norm)));
    ctx.lineTo(X(pts.length - 1), H - padB); ctx.lineTo(X(0), H - padB); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // 實線（當前→第一預測點）+ 虛線（預測段）
    ctx.lineWidth = 2.2; ctx.strokeStyle = '#0A1327'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(X(0), Y(pts[0].norm)); ctx.lineTo(X(1), Y(pts[1].norm)); ctx.stroke();
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(X(1), Y(pts[1].norm));
    for (let i = 2; i < pts.length; i++) ctx.lineTo(X(i), Y(pts[i].norm));
    ctx.stroke(); ctx.setLineDash([]);
    // 數據點（按色帶著色）
    pts.forEach((p, i) => {
      if (i % 2 && i !== 0) return;
      ctx.beginPath(); ctx.arc(X(i), Y(p.norm), i === 0 ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = p.band.color; ctx.fill();
      if (i === 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    });
    // 時間軸
    ctx.fillStyle = 'rgba(27,36,56,.55)'; ctx.font = '10px "Noto Sans TC"'; ctx.textAlign = 'center';
    for (let i = 0; i < pts.length; i += 4) ctx.fillText(i === 0 ? '現在' : fmtMacau(pts[i].t), X(i), H - 6);
  }
  function fmtMacau(d) {
    return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  }

  /* ================= 導航 ================= */
  function navUrl(name, lat, lng, addr) {
    // 騰訊地圖 URI：微信內可直接拉起導航，瀏覽器則打開騰訊地圖頁
    return 'https://apis.map.qq.com/uri/v1/marker?marker=' +
      encodeURIComponent(`coord:${lat},${lng};title:${name};addr:${addr || ''}`) +
      '&referer=aoxingwuzu.app';
  }

  App.drawer = { open, close, bindDrag, openSpot, openFood, navUrl };
})();
