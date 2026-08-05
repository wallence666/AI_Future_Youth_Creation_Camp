// 管理後台（spec F8）：商家審核 / 活動審核 / 店舖下架 / 評論管理 / 概覽
const express = require('express');
const { db } = require('../db');
const { requireRole } = require('../middleware/auth');
const { macauDayStart } = require('../services/util');

const router = express.Router();
router.use(requireRole('admin'));

function parseShop(s) {
  return s && { ...s, photos: JSON.parse(s.photos || '[]'), menu: JSON.parse(s.menu || '[]') };
}

// GET /api/admin/merchants?status=pending|approved|rejected|takedown（無參 = 全部商家）
router.get('/merchants', (req, res) => {
  const status = String(req.query.status || '');
  let sql = `SELECT u.id AS merchant_id, u.username, u.created_at AS registered_at, s.*
             FROM users u LEFT JOIN shops s ON s.merchant_id = u.id WHERE u.role = 'merchant'`;
  const params = [];
  if (['pending', 'approved', 'rejected', 'takedown'].includes(status)) {
    sql += ' AND s.status = ?'; params.push(status);
  }
  sql += ' ORDER BY s.updated_at DESC, u.id DESC';
  res.json({ items: db.prepare(sql).all(...params).map(r => parseShop(r) || { menu: [], photos: [] }) });
});

// POST /api/admin/merchants/:id/approve（:id = 商家 user id）
router.post('/merchants/:id/approve', (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE merchant_id = ?').get(Number(req.params.id));
  if (!shop) return res.status(400).json({ error: '該商家尚未提交店舖資料' });
  db.prepare("UPDATE shops SET status = 'approved', reject_reason = NULL, updated_at = ? WHERE id = ?")
    .run(Date.now(), shop.id);
  res.json({ ok: true });
});

// POST /api/admin/merchants/:id/reject {reason}
router.post('/merchants/:id/reject', (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE merchant_id = ?').get(Number(req.params.id));
  if (!shop) return res.status(400).json({ error: '該商家尚未提交店舖資料' });
  db.prepare("UPDATE shops SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?")
    .run(String(req.body?.reason || '').slice(0, 120) || '資料不符要求', Date.now(), shop.id);
  res.json({ ok: true });
});

// POST /api/admin/shops/:id/takedown
router.post('/shops/:id/takedown', (req, res) => {
  const r = db.prepare("UPDATE shops SET status = 'takedown', updated_at = ? WHERE id = ?")
    .run(Date.now(), Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: '店舖不存在' });
  res.json({ ok: true });
});

// GET /api/admin/promos?status=pending
router.get('/promos', (req, res) => {
  const status = String(req.query.status || 'pending');
  const items = db.prepare(`
    SELECT p.*, s.name AS shop_name FROM promos p JOIN shops s ON s.id = p.shop_id
    WHERE p.status = ? ORDER BY p.id DESC`).all(status);
  res.json({ items });
});

// POST /api/admin/promos/:id/approve | reject
router.post('/promos/:id/approve', (req, res) => {
  const r = db.prepare("UPDATE promos SET status = 'approved' WHERE id = ?").run(Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: '活動不存在' });
  res.json({ ok: true });
});
router.post('/promos/:id/reject', (req, res) => {
  const r = db.prepare("UPDATE promos SET status = 'rejected' WHERE id = ?").run(Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: '活動不存在' });
  res.json({ ok: true });
});

// GET /api/admin/comments（最新 100 條，含作者與目標）
router.get('/comments', (req, res) => {
  const items = db.prepare(`
    SELECT c.id, c.target_type, c.target_id, c.content, c.photos, c.status, c.created_at, u.username
    FROM comments c JOIN users u ON u.id = c.user_id
    ORDER BY c.id DESC LIMIT 100`).all()
    .map(r => ({ ...r, photos: JSON.parse(r.photos) }));
  res.json({ items });
});

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const dayStart = macauDayStart();
  res.json({
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    visitors: db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'visitor'").get().c,
    merchants: db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'merchant'").get().c,
    pendingShops: db.prepare("SELECT COUNT(*) c FROM shops WHERE status = 'pending'").get().c,
    pendingPromos: db.prepare("SELECT COUNT(*) c FROM promos WHERE status = 'pending'").get().c,
    approvedShops: db.prepare("SELECT COUNT(*) c FROM shops WHERE status = 'approved'").get().c,
    todayCheckins: db.prepare('SELECT COUNT(*) c FROM checkins WHERE created_at >= ?').get(dayStart).c,
    todayReports: db.prepare('SELECT COUNT(*) c FROM crowd_reports WHERE created_at >= ?').get(dayStart).c,
    comments: db.prepare("SELECT COUNT(*) c FROM comments WHERE status = 'visible'").get().c,
    couponsIssued: db.prepare('SELECT COUNT(*) c FROM coupons').get().c,
  });
});

module.exports = router;
