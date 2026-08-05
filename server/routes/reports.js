// 人流回報（spec F2）：三檔問卷，同景點 30 分鐘限 1 次，+6 積分
const express = require('express');
const { db } = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { award } = require('../services/points');
const { liveU } = require('../services/crowd');
const { spots } = require('../services/poi');

const router = express.Router();

// POST /api/spots/:id/reports {level: 1|2|3}
router.post('/:id/reports', requireAuth, writeLimiter, (req, res) => {
  const spot = spots.find(x => x.id === req.params.id);
  if (!spot) return res.status(404).json({ error: '景點不存在' });
  const level = Number(req.body?.level);
  if (![1, 2, 3].includes(level)) {
    return res.status(400).json({ error: 'level 須為 1（暢通）/ 2（一般）/ 3（擁擠）' });
  }
  const since = Date.now() - config.REPORT_COOLDOWN_MIN * 60000;
  const dup = db.prepare('SELECT id FROM crowd_reports WHERE user_id = ? AND spot_id = ? AND created_at > ?')
    .get(req.user.id, spot.id, since);
  if (dup) {
    return res.status(429).json({ error: `${config.REPORT_COOLDOWN_MIN} 分鐘內已回報過此景點` });
  }
  db.prepare('INSERT INTO crowd_reports(user_id, spot_id, level, created_at) VALUES(?,?,?,?)')
    .run(req.user.id, spot.id, level, Date.now());
  const points = award(req.user.id, config.POINTS.report, 'report', spot.id);
  res.json({ ok: true, points, liveU: liveU()[spot.id] || null });
});

module.exports = router;
