// POI 解析：靜態景點/美食（app/data/*.json）+ 入駐店舖（DB shops）
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { db } = require('../db');

function loadJson(file, key) {
  const j = JSON.parse(fs.readFileSync(path.join(config.APP_DIR, 'data', file), 'utf-8'));
  return Array.isArray(j) ? j : (j[key] || []);
}

const spots = loadJson('spots.json', 'spots');
const foods = loadJson('foods.json', 'foods');

/**
 * 解析打卡/評論目標 → { type, id, name, lat, lng }，不存在返回 null。
 * shop 僅限已上架（approved）才允許互動。
 */
function resolveTarget(targetType, targetId) {
  if (targetType === 'spot') {
    const s = spots.find(x => x.id === targetId);
    return s && { type: 'spot', id: s.id, name: s.name, lat: s.lat, lng: s.lng };
  }
  if (targetType === 'food') {
    const f = foods.find(x => x.id === targetId);
    return f && { type: 'food', id: f.id, name: f.name, lat: f.lat, lng: f.lng };
  }
  if (targetType === 'shop') {
    // 容忍前端「shop_」前綴（spec F4），歸一為 DB 數字 id，避免與靜態 food id 衝突
    const s = db.prepare("SELECT * FROM shops WHERE id = ? AND status = 'approved'").get(Number(String(targetId).replace(/^shop_/, '')));
    return s && { type: 'shop', id: String(s.id), name: s.name, lat: s.lat, lng: s.lng };
  }
  return null;
}

module.exports = { spots, foods, resolveTarget };
