// U 因子聚合（spec 第 3 節）：近 30 分鐘回報按 15 分鐘半衰期指數加權
const { db } = require('../db');
const config = require('../config');

const LEVEL_VALUE = { 1: 0.2, 2: 0.55, 3: 0.9 }; // 暢通 / 一般 / 擁擠
const LAM = Math.LN2 / (config.U_HALF_LIFE_MIN * 60000);

/** @returns {Object} spotId → { u: 加權擁擠度 0~1, n: 有效回報數 } */
function liveU(now = Date.now()) {
  const since = now - config.U_WINDOW_MIN * 60000;
  const rows = db.prepare('SELECT spot_id, level, created_at FROM crowd_reports WHERE created_at > ?').all(since);
  const bySpot = {};
  for (const r of rows) {
    const w = Math.exp(-LAM * (now - r.created_at));
    const g = bySpot[r.spot_id] || (bySpot[r.spot_id] = { sw: 0, sv: 0, n: 0 });
    g.sw += w; g.sv += LEVEL_VALUE[r.level] * w; g.n += 1;
  }
  const out = {};
  for (const [id, g] of Object.entries(bySpot)) {
    out[id] = { u: Math.round((g.sv / g.sw) * 1000) / 1000, n: g.n };
  }
  return out;
}

module.exports = { liveU, LEVEL_VALUE };
