// 評論（spec F4）：景點＋店舖通用，多態 target；文字 ≤200 字，照片 ≤3 張
const express = require('express');
const { db } = require('../db');
const config = require('../config');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const upload = require('../middleware/upload');
const { award } = require('../services/points');
const { resolveTarget } = require('../services/poi');
const { macauDayStart } = require('../services/util');

const router = express.Router();
const PAGE_SIZE = 10;

// GET /api/comments?targetType=&targetId=&page=1
router.get('/', (req, res) => {
  const { targetType, targetId } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const total = db.prepare(
    "SELECT COUNT(*) c FROM comments WHERE target_type = ? AND target_id = ? AND status = 'visible'"
  ).get(String(targetType), String(targetId)).c;
  const items = db.prepare(`
    SELECT c.id, c.content, c.photos, c.created_at, u.id AS user_id, u.username
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.target_type = ? AND c.target_id = ? AND c.status = 'visible'
    ORDER BY c.id DESC LIMIT ? OFFSET ?`)
    .all(String(targetType), String(targetId), PAGE_SIZE, (page - 1) * PAGE_SIZE)
    .map(r => ({ ...r, photos: JSON.parse(r.photos) }));
  res.json({ total, page, pageSize: PAGE_SIZE, items });
});

// POST /api/comments（multipart：content, targetType, targetId, photos[]≤3）
router.post('/', requireRole('visitor'), writeLimiter, upload.array('photos', 3), (req, res) => {
  const { targetType, targetId, content } = req.body || {};
  const target = resolveTarget(String(targetType || ''), String(targetId || ''));
  if (!target) return res.status(404).json({ error: '評論目標不存在或未上架' });
  const text = String(content || '').trim();
  if (!text) return res.status(400).json({ error: '評論內容不能為空' });
  if (text.length > 200) return res.status(400).json({ error: '評論最多 200 字' });
  const photos = (req.files || []).map(f => '/uploads/' + f.filename);

  const dayStart = macauDayStart();
  // 計分限額（spec F5）：同目標每日 3 條計分；附照片每日 2 條計分
  const todayOnTarget = db.prepare(
    'SELECT COUNT(*) c FROM comments WHERE user_id = ? AND target_type = ? AND target_id = ? AND created_at >= ?'
  ).get(req.user.id, target.type, target.id, dayStart).c;
  const todayWithPhotos = db.prepare(
    "SELECT COUNT(*) c FROM comments WHERE user_id = ? AND created_at >= ? AND photos != '[]'"
  ).get(req.user.id, dayStart).c;

  const info = db.prepare(
    'INSERT INTO comments(user_id, target_type, target_id, content, photos, created_at) VALUES(?,?,?,?,?,?)'
  ).run(req.user.id, target.type, target.id, text, JSON.stringify(photos), Date.now());

  let points = req.user.points, gained = 0;
  if (todayOnTarget < 3) {
    points = award(req.user.id, config.POINTS.comment, 'comment', info.lastInsertRowid);
    gained += config.POINTS.comment;
  }
  if (photos.length && todayWithPhotos < 2) {
    points = award(req.user.id, config.POINTS.commentPhoto, 'comment_photo', info.lastInsertRowid);
    gained += config.POINTS.commentPhoto;
  }
  res.json({ ok: true, id: Number(info.lastInsertRowid), gained, points });
});

// DELETE /api/comments/:id（作者本人或管理員；管理員刪他人評論 → 作者 −5）
router.delete('/:id', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(req.params.id));
  if (!c || c.status === 'deleted') return res.status(404).json({ error: '評論不存在' });
  const isOwner = c.user_id === req.user.id;
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只能刪除自己的評論' });
  }
  db.prepare("UPDATE comments SET status = 'deleted' WHERE id = ?").run(c.id);
  if (!isOwner) award(c.user_id, config.POINTS.commentDeleted, 'comment_deleted', c.id);
  res.json({ ok: true });
});

module.exports = router;
