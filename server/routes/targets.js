// 目標摘要：任意 target（spot/food/shop）的打卡數/評論數/我的狀態（詳情抽屜用）
const express = require('express');
const { db } = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { resolveTarget } = require('../services/poi');
const { macauDay } = require('../services/util');

const router = express.Router();

// GET /api/targets/:type/:id/summary
router.get('/:type/:id/summary', optionalAuth, (req, res) => {
  const target = resolveTarget(req.params.type, req.params.id);
  if (!target) return res.status(404).json({ error: '目標不存在或未上架' });
  const checkins = db.prepare(
    'SELECT COUNT(*) c FROM checkins WHERE target_type = ? AND target_id = ?'
  ).get(target.type, target.id).c;
  const comments = db.prepare(
    "SELECT COUNT(*) c FROM comments WHERE target_type = ? AND target_id = ? AND status = 'visible'"
  ).get(target.type, target.id).c;
  let myCheckinToday = false;
  if (req.user) {
    myCheckinToday = !!db.prepare(
      'SELECT id FROM checkins WHERE user_id = ? AND target_type = ? AND target_id = ? AND day = ?'
    ).get(req.user.id, target.type, target.id, macauDay());
  }
  res.json({ name: target.name, checkins, comments, myCheckinToday });
});

module.exports = router;
