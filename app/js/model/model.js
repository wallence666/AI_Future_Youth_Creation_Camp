/* model.js — CrowdIndex 人流估算引擎（對應 docs/01 技術文檔 §3.1 v1.2）
 * 由 js/model.js 原樣遷入 model/，行為不變（U 因子融合見 model/blend.js）。
 *
 *   CrowdIndex(s,t) = [ w1·B(s)·Tc(s,t) + w2·Park(s,t) ] × I(t) × W(s,t) × H(t)
 *
 *   B(s)     景點基準熱度      —— model.json（旅遊局分區統計，開方壓縮）× 區內權重
 *   Tc(s,t)  分群時段曲線      —— model.json 四類 24h 曲線，按分鐘線性插值
 *   Park(s,t) 停車場即時空位率 —— 生產環境接 DSAT API；MVP 依文檔 §5.1 備援：
 *                                 以 Tc 排程期望為均值的隨機遊走模擬即時訊號
 *   I(t)     口岸通關權重      —— PSP 數據未公開，依文檔預設 1.0（週末微調）
 *   W(s,t)   天氣修正          —— Open-Meteo 即時天氣，依室內/室外翻轉方向
 *   H(t)     節假日/活動放大   —— events.json（自研爬蟲）：公眾假期 + 演唱會場館鄰近放大
 *
 * 預測（功能 01「何時去最好」）：即時訊號 Park 以指數時間衰減回歸排程期望
 *   Park(t+Δ) = E[Park(t+Δ)] + (Park(t) − E[Park(t+Δ)]) · e^(−λΔ)   （半衰期 45 分鐘）
 * 排程項 B·Tc、I、W、H 直接按未來時刻查表，再與衰減後的 Park 合成預測值。
 */
(function (global) {
  const W1 = 0.6, W2 = 0.4;          // 文檔建議權重 w1=0.6, w2=0.4
  const CURVE_MAX = 1.2;             // Tc 值域上限
  const DECAY_HALF_MIN = 45;         // 即時訊號半衰期（分鐘）
  const LAM = Math.LN2 / DECAY_HALF_MIN;
  const BANDS = [
    { key: 'green',  label: '暢通', max: 0.38, color: '#3E9C6C' },
    { key: 'yellow', label: '緩行', max: 0.68, color: '#E9C46A' },
    { key: 'red',    label: '擁擠', max: 1.01, color: '#D24833' },
  ];
  // 演唱會場館座標（events.json venue → 就近放大範圍）
  const VENUES = {
    'galaxy arena':   { lat: 22.14930, lng: 113.55303, name: '銀河綜藝館' },
    'venetian arena': { lat: 22.14798, lng: 113.56039, name: '威尼斯人綜藝館' },
    'londoner arena': { lat: 22.14844, lng: 113.56493, name: '倫敦人綜藝館' },
  };
  const CONCERT_RADIUS_M = 1800;

  let districts = null, curves = null, spots = [], events = [];
  let weather = { code: null, temp: null, wOutdoor: 1, wIndoor: 1 };
  let parkState = {};                // spotId -> 即時訊號當前值
  let lastTick = 0;
  let normBounds = { min: 0, max: 1 };
  let latest = [];                   // 最近一次 tick 的計算結果

  /* ---------- 工具 ---------- */
  /** 澳門標準時間（UTC+8，無夏令時）：無論設備時區如何，模型一律以澳門當地時間運算。
   *  返回「平移後的 Date」，需以 getUTC* 方法讀取。 */
  function macauNow() { return new Date(Date.now() + 8 * 3600 * 1000); }
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }
  function hourFloat(d) { return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600; }
  function curveAt(group, d) {
    const vals = (curves[group] || curves.pedestrian).values;
    const hf = hourFloat(d);
    const h0 = Math.floor(hf) % 24, h1 = (h0 + 1) % 24, f = hf - Math.floor(hf);
    return vals[h0] + (vals[h1] - vals[h0]) * f;   // 分鐘級線性插值
  }
  function bandOf(norm) {
    for (const b of BANDS) if (norm < b.max) return b;
    return BANDS[BANDS.length - 1];
  }
  function dateStr(d) {
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  /* ---------- 天氣 W(s,t)：室外受阻、室內反向受惠 ---------- */
  function weatherFactors(code) {
    if (code == null) return { wOutdoor: 1, wIndoor: 1 };
    if ([95, 96, 99, 82, 81, 65, 67].includes(code)) return { wOutdoor: 0.35, wIndoor: 1.22 }; // 暴雨/雷暴
    if ([80, 63, 61, 57, 55, 53, 51].includes(code)) return { wOutdoor: 0.7, wIndoor: 1.1 };   // 降雨
    if ([45, 48].includes(code)) return { wOutdoor: 0.9, wIndoor: 1.0 };                        // 霧
    if ([0, 1].includes(code)) return { wOutdoor: 1.03, wIndoor: 1.0 };                         // 晴
    return { wOutdoor: 1, wIndoor: 1 };
  }
  function setWeather(w) {
    weather = { code: w.code ?? null, temp: w.temp ?? null, ...weatherFactors(w.code) };
  }

  /* ---------- H(t)：假期 + 演唱會 ---------- */
  function todayEvents(now) {
    const ds = dateStr(now);
    const list = [];
    for (const ev of events) {
      if (!ev.start_date) continue;
      if (ev.start_date <= ds && (ev.end_date || ev.start_date) >= ds) {
        const vkey = ev.venue ? ev.venue.toLowerCase().replace(/^the\s+/, '') : null;
        const venue = vkey ? VENUES[vkey] || null : null;
        const holiday = ev.tag === 'Public Holiday';
        list.push({ title: ev.title, venue, holiday, source: ev.source });
      }
    }
    return list;
  }
  function holidayBoost(now) {
    let h = 1.0;
    const day = now.getUTCDay();
    if (day === 0 || day === 6) h *= 1.15;                       // 週末
    for (const ev of todayEvents(now)) {
      if (ev.holiday) h *= 1.3;                                   // 公眾假期
      else if (ev.source === 'MGTO') h *= 1.1;                    // 官方節慶
    }
    return Math.min(h, 1.6);
  }
  function concertBoost(spot, now) {
    const h = now.getUTCHours();
    // 演唱會散場效應：15 時起升溫，17–20 入場高峰，20–23 散場高峰
    let timeF = 0.12;
    if (h >= 15 && h < 17) timeF = 0.5;
    else if (h >= 17 && h < 20) timeF = 1.0;
    else if (h >= 20 && h < 24) timeF = 1.2;
    let boost = 1.0;
    for (const ev of todayEvents(now)) {
      if (!ev.venue) continue;
      const d = global.Geo.distanceM(spot.lat, spot.lng, ev.venue.lat, ev.venue.lng);
      if (d <= CONCERT_RADIUS_M) boost = Math.max(boost, 1 + 0.55 * timeF);
    }
    return boost;
  }
  function H(spot, now) { return Math.min(holidayBoost(now) * concertBoost(spot, now), 2.0); }
  function I(now) { return 1.0; }  // PSP 口岸數據未公開，依文檔 §5.1 預設 1.0
  function W(spot) { return spot.indoor ? weather.wIndoor : weather.wOutdoor; }
  function B(spot) {
    // 景點基準熱度 = 景點權重 ×（0.55 權重保底 + 0.45 分區基準）
    // 純分區客流量會令路氹度假區（吞吐量龐大）永久壓過大三巴等步行區的「擁擠體感」，
    // 故以景點權重為主、分區基準為輔做校準，baseRaw 仍保留於 model.json 備查。
    const d = districts[spot.district];
    return (spot.weight || 1) * (0.55 + 0.45 * (d ? d.base : 0.3));
  }

  /* ---------- Park(s,t)：即時訊號（MVP 模擬，見文檔 §5.1 備援方案） ---------- */
  function parkExpect(spot, d) { return Math.min(curveAt(spot.group, d) / CURVE_MAX, 1); }
  function parkNow(spot, d) {
    if (!(spot.id in parkState)) {
      const seed = hashSeed(spot.id);
      parkState[spot.id] = Math.min(Math.max(parkExpect(spot, d) * (0.8 + 0.4 * seed), 0.05), 0.98);
    }
    return parkState[spot.id];
  }
  function parkNowCurrent(spot) { return parkNow(spot, macauNow()); }
  function evolvePark(now) {
    for (const s of spots) {
      const target = parkExpect(s, now);
      const jitter = (hashSeed(s.id + Math.floor(now.getTime() / 30000)) - 0.5) * 0.09;
      let v = parkNow(s, now);
      v += (target - v) * 0.08 + jitter;                        // 均值回歸 + 隨機抖動
      parkState[s.id] = Math.min(Math.max(v, 0.04), 0.98);
    }
  }
  /** 時間衰減：未來 Δ 分鐘後的 Park 預測（即時訊號指數衰減回歸排程期望） */
  function parkForecast(spot, futureDate, deltaMin) {
    const exp = parkExpect(spot, futureDate);
    return Math.min(Math.max(exp + (parkNowCurrent(spot) - exp) * Math.exp(-LAM * deltaMin), 0.02), 1);
  }

  /* ---------- 核心計算 ---------- */
  function rawIndex(spot, date, parkVal) {
    return (W1 * B(spot) * curveAt(spot.group, date) + W2 * parkVal) * I(date) * W(spot) * H(spot, date);
  }
  function tick(now) {
    now = now || macauNow();
    if (now.getTime() - lastTick > 25000) { evolvePark(now); lastTick = now.getTime(); }
    const raws = spots.map(s => rawIndex(s, now, parkNow(s, now)));
    const min = Math.min(...raws), max = Math.max(...raws);
    normBounds = { min, max: max > min ? max : min + 1e-6 };
    latest = spots.map((s, i) => {
      const norm = (raws[i] - normBounds.min) / (normBounds.max - normBounds.min);
      return { spot: s, raw: raws[i], norm, band: bandOf(norm) };
    });
    return latest;
  }
  function normalize(raw) {
    return Math.min(Math.max((raw - normBounds.min) / (normBounds.max - normBounds.min), 0), 1);
  }
  /** 未來 deltaMin 分鐘的預測（以當前正規化區間映射，保證與當前色帶可比） */
  function forecast(spot, deltaMin) {
    const future = new Date(macauNow().getTime() + deltaMin * 60000);
    return normalize(rawIndex(spot, future, parkForecast(spot, future, deltaMin)));
  }
  /** 未來 spanH 小時的趨勢序列（每 stepMin 一點） */
  function series(spot, stepMin, spanH) {
    stepMin = stepMin || 30; spanH = spanH || 12;
    const out = [];
    for (let m = 0; m <= spanH * 60; m += stepMin) {
      const t = new Date(macauNow().getTime() + m * 60000);
      const norm = forecast(spot, m);
      out.push({ t, norm, band: bandOf(norm) });
    }
    return out;
  }
  /** 「何時去最好」：未來 8 小時內首個轉綠時點，或全程最低點 */
  function bestTime(spot) {
    const pts = series(spot, 30, 8);
    const nowBand = bandOf(pts[0].norm);
    const minPt = pts.reduce((a, b) => (b.norm < a.norm ? b : a), pts[0]);
    const hhmm = d => String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    if (nowBand.key === 'green') {
      const stay = pts.filter(p => p.band.key === 'green').length * 0.5;
      return { type: 'now', text: `現在正是好時機，預計未來約 ${Math.min(stay, 8)} 小時維持暢通。` };
    }
    const first = pts.find((p, i) => i > 0 && p.band.key === 'green');
    if (first) return { type: 'later', time: hhmm(first.t), text: `建議 ${hhmm(first.t)} 後前往，預計屆時轉為暢通。` };
    if (minPt.norm < pts[0].norm - 0.05) {
      return { type: 'min', time: hhmm(minPt.t), text: `未來 8 小時人流持續偏高，${hhmm(minPt.t)} 相對最空。` };
    }
    return { type: 'busy', text: '未來 8 小時預計持續擁擠，建議改往其他綠色景區。' };
  }
  function citySummary() {
    const c = { green: 0, yellow: 0, red: 0 };
    latest.forEach(r => c[r.band.key]++);
    return { ...c, total: latest.length, updatedAt: macauNow() };
  }

  function init(modelData, spotList, eventList) {
    districts = modelData.districts; curves = modelData.curves;
    spots = spotList; events = eventList || [];
    tick(macauNow());
  }

  global.CrowdEngine = {
    BANDS, init, setWeather, tick, forecast, series, bestTime, citySummary, todayEvents, macauNow,
    get weather() { return weather; },
    get latest() { return latest; },
  };
})(window);
