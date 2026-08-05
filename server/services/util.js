// 通用工具：澳門日曆日、haversine 測距、核銷碼生成
const MACAU_OFFSET_MS = 8 * 3600 * 1000;

/** 澳門時區的 YYYY-MM-DD */
function macauDay(ts = Date.now()) {
  return new Date(ts + MACAU_OFFSET_MS).toISOString().slice(0, 10);
}

/** 澳門時區當日 0 點對應的 epoch ms */
function macauDayStart(ts = Date.now()) {
  const day = macauDay(ts);
  return Date.parse(day + 'T00:00:00.000Z') - MACAU_OFFSET_MS;
}

/** haversine 距離（米） */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 6 位核銷碼（去除易混淆字符 0/O/1/I） */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

module.exports = { macauDay, macauDayStart, haversineM, genCode };
