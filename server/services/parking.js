// DSAT 停車場即時空位率（docs/01 §3.1 Park(s,t) 模型唯一即時訊號）
// API 只回傳「剩餘車位數」(Car_CNT)，沒有總車位數欄位，故無法直接算出官方定義的「空位率」。
// 採用「歷史觀測最大值」近似總容量：occupancy = 1 - Car_CNT / observedMax(該停車場)。
// observedMax 持久化到 PARKING_MAX_PATH，跨重啟累積，樣本越多估計越準；冷啟動（首次看到的
// 數字直接當作 100% 容量）在剛部署或凌晨低峰啟動時會失真，屬已知限制，見 docs/01 §3.2。
const fs = require('fs');
const config = require('../config');

let latest = {};      // carparkId(String) -> { name, car, occupancy, updatedAt }
let observedMax = {};
let timer = null;

function loadMax() {
  try { observedMax = JSON.parse(fs.readFileSync(config.PARKING_MAX_PATH, 'utf8')); }
  catch { observedMax = {}; }
}
function saveMax() {
  try { fs.writeFileSync(config.PARKING_MAX_PATH, JSON.stringify(observedMax)); }
  catch (e) { console.error('[parking] 寫入 observedMax 失敗', e.message); }
}

/** 極簡屬性解析：<Car_park_info ID="x" name="y" ... Car_CNT="z" .../>，避免額外引入 XML 依賴 */
function parseXml(xml) {
  const out = [];
  const re = /<Car_park_info\s+([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = {};
    const attrRe = /(\w+)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(m[1]))) attrs[a[1]] = a[2];
    out.push(attrs);
  }
  return out;
}

async function poll() {
  try {
    const res = await fetch(config.DSAT_URL, {
      headers: { Authorization: 'APPCODE ' + config.DSAT_APPCODE },
    });
    if (!res.ok) throw new Error('upstream ' + res.status);
    const xml = await res.text();
    const entries = parseXml(xml);
    const next = {};
    let dirty = false;
    for (const e of entries) {
      const id = e.ID;
      const car = Number(e.Car_CNT);
      if (!id || Number.isNaN(car)) continue;    // Car_CNT="" 等空值：該停車場暫無回報，略過
      if (!(id in observedMax) || car > observedMax[id]) { observedMax[id] = car; dirty = true; }
      const max = observedMax[id];
      next[id] = {
        name: e.name || '',
        car,
        occupancy: max > 0 ? Math.min(Math.max(1 - car / max, 0), 1) : null,
        updatedAt: Date.now(),
      };
    }
    latest = next;
    if (dirty) saveMax();
  } catch (e) {
    console.error('[parking] 取得 DSAT 數據失敗，沿用上次結果：', e.message);
  }
}

function start() {
  loadMax();
  poll();
  timer = setInterval(poll, config.DSAT_POLL_MS);
}
function stop() { if (timer) clearInterval(timer); }
function getParking() { return latest; }

module.exports = { start, stop, getParking };
