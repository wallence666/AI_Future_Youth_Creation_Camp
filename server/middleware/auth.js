// JWT 認證與角色鑒權
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');

function sign(user) {
  return jwt.sign({ uid: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES });
}

function readToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function loadUser(uid) {
  return db.prepare('SELECT id, username, role, points, created_at FROM users WHERE id = ?').get(uid);
}

/** 必須登入；token 無效 → 401 */
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: '請先登入' });
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const user = loadUser(payload.uid);
    if (!user) return res.status(401).json({ error: '賬號不存在' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: '登入已過期，請重新登入' });
  }
}

/** 可選登入：有有效 token 則附帶 req.user，無則放行 */
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.JWT_SECRET);
      req.user = loadUser(payload.uid) || null;
    } catch { req.user = null; }
  }
  next();
}

/** 限定角色 */
function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: '沒有權限執行此操作' });
      }
      next();
    });
  };
}

module.exports = { sign, requireAuth, optionalAuth, requireRole };
