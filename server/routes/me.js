// 「我的」：資料 / 積分流水 / 代金券（spec F1、F7）
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/me
router.get('/', requireAuth, (req, res) => {
  const u = req.user;
  const checkins = db.prepare('SELECT COUNT(*) c FROM checkins WHERE user_id = ?').get(u.id).c;
  const comments = db.prepare("SELECT COUNT(*) c FROM comments WHERE user_id = ? AND status = 'visible'").get(u.id).c;
  res.json({ user: { id: u.id, username: u.username, role: u.role, points: u.points, checkins, comments } });
});

// GET /api/me/points
router.get('/points', requireAuth, (req, res) => {
  const items = db.prepare(
    'SELECT id, delta, reason, ref_id, created_at FROM points_log WHERE user_id = ? ORDER BY id DESC LIMIT 100'
  ).all(req.user.id);
  res.json({ points: req.user.points, items });
});

// GET /api/me/coupons（遊客）
router.get('/coupons', requireAuth, (req, res) => {
  const now = Date.now();
  // 過期懶標記
  db.prepare(`UPDATE coupons SET status = 'expired'
              WHERE user_id = ? AND status = 'unused'
                AND promo_id IN (SELECT id FROM promos WHERE end_at < ?)`).run(req.user.id, now);
  const items = db.prepare(`
    SELECT c.id, c.code, c.status, c.created_at, c.redeemed_at,
           p.title, p.coupon_value, p.end_at, s.name AS shop_name
    FROM coupons c
    JOIN promos p ON p.id = c.promo_id
    JOIN shops s ON s.id = p.shop_id
    WHERE c.user_id = ?
    ORDER BY c.id DESC`).all(req.user.id);
  res.json({ items });
});

module.exports = router;
