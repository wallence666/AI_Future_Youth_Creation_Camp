// 認證：註冊 / 登入（spec F1）
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { sign } = require('../middleware/auth');
const { award } = require('../services/points');
const config = require('../config');

const router = express.Router();
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, points: u.points };
}

// POST /api/auth/register {username, password, role: visitor|merchant}
router.post('/register', (req, res) => {
  const { username, password, role } = req.body || {};
  if (!USERNAME_RE.test(String(username || ''))) {
    return res.status(400).json({ error: '用戶名須為 3–20 位英文、數字或底線' });
  }
  if (String(password || '').length < 6) {
    return res.status(400).json({ error: '密碼至少 6 位' });
  }
  if (!['visitor', 'merchant'].includes(role)) {
    return res.status(400).json({ error: '角色須為 visitor 或 merchant' });
  }
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: '用戶名已被使用' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users(username, password_hash, role, points, created_at) VALUES(?,?,?,0,?)')
    .run(username, hash, role, Date.now());
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  // 遊客註冊即送積分（spec F5）
  if (role === 'visitor') {
    award(user.id, config.POINTS.register, 'register');
    user.points = db.prepare('SELECT points FROM users WHERE id = ?').get(user.id).points;
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

// POST /api/auth/login {username, password}
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || ''));
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: '用戶名或密碼錯誤' });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

module.exports = router;
