// SQLite 連接 + 建表 + 預置管理員（對應 spec 第 6 節 Schema）
// 驅動：Node 內建 node:sqlite（零原生依賴，同步 API 與 better-sqlite3 一致）
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const config = require('./config');

fs.mkdirSync(path.dirname(config.DB_PATH), { recursive: true });
fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(config.DB_PATH);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('visitor','merchant','admin')),
  points INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('spot','food','shop')),
  target_id TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, target_type, target_id, day)
);

CREATE TABLE IF NOT EXISTS crowd_reports(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  spot_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK(level IN (1,2,3)),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_time ON crowd_reports(created_at);

CREATE TABLE IF NOT EXISTS comments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('spot','food','shop')),
  target_id TEXT NOT NULL,
  content TEXT NOT NULL,
  photos TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','deleted')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id, status);

CREATE TABLE IF NOT EXISTS points_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_points_user ON points_log(user_id, created_at);

CREATE TABLE IF NOT EXISTS shops(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER UNIQUE NOT NULL,
  name TEXT, cuisine TEXT, price INTEGER, lat REAL, lng REAL,
  addr TEXT, hours TEXT, intro TEXT,
  photos TEXT NOT NULL DEFAULT '[]',
  menu TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','takedown')),
  reject_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS promos(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  title TEXT NOT NULL, descr TEXT,
  points_cost INTEGER NOT NULL,
  coupon_value REAL NOT NULL,
  start_at INTEGER NOT NULL, end_at INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','offline')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promo_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','redeemed','expired')),
  created_at INTEGER NOT NULL,
  redeemed_at INTEGER
);
`);

// 預置管理員（spec F8：admin / admin123）
if (!db.prepare('SELECT id FROM users WHERE role = ?').get('admin')) {
  db.prepare('INSERT INTO users(username, password_hash, role, points, created_at) VALUES(?,?,?,?,?)')
    .run('admin', bcrypt.hashSync('admin123', 10), 'admin', 0, Date.now());
  console.log('[db] seeded admin / admin123');
}

// 演示數據：僅在全新庫（無店舖）時注入——示範商家/已上架店舖/已上架活動/演示遊客
if (!db.prepare('SELECT id FROM shops LIMIT 1').get()) {
  const now = Date.now();
  const m = db.prepare('INSERT INTO users(username, password_hash, role, points, created_at) VALUES(?,?,?,?,?)')
    .run('merchant_demo', bcrypt.hashSync('demo123456', 10), 'merchant', 0, now);
  const shop = db.prepare(`INSERT INTO shops(merchant_id, name, cuisine, price, lat, lng, addr, hours, intro, photos, menu, status, created_at, updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,'approved',?,?)`).run(
    m.lastInsertRowid, '陳記餅家', '手信', 45, 22.15388, 113.55698,
    '氹仔官也街 28 號地下', '10:00–21:00',
    '三代傳承的手工杏仁餅，即場炭燒，滿街飄香。',
    '[]',
    JSON.stringify([
      { name: '炭燒杏仁餅', price: 48 },
      { name: '鳳凰卷', price: 38 },
      { name: '花生糖', price: 28 },
      { name: '肉心杏仁餅', price: 55 },
    ]),
    now, now);
  db.prepare(`INSERT INTO promos(shop_id, title, descr, points_cost, coupon_value, start_at, end_at, stock, status, created_at)
    VALUES(?,?,?,?,?,?,?,?,'approved',?)`).run(
    shop.lastInsertRowid, '滿 100 減 20 代金券', '全場手信通用，每單限用一張',
    20, 20, now - 864e5, now + 30 * 864e5, 100, now);
  db.prepare('INSERT INTO users(username, password_hash, role, points, created_at) VALUES(?,?,?,?,?)')
    .run('demo', bcrypt.hashSync('demo123456', 10), 'visitor', 20, now);
  console.log('[db] seeded demo: merchant_demo / demo（遊客）/ 陳記餅家 + 代金券活動');
}

/** 簡易事務包裝：fn 拋錯則回滾 */
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { db, tx };
