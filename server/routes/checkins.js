// 打卡（spec F3）：景點＋店舖通用，500m 定位校驗，同目標每日 1 次，+10 積分
const express = require('express');
const { db } = require('../db');
const config = require('../config');
const { requireRole } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { award } = require('../services/points');
const { resolveTarget } = require('../services/poi');
const { macauDay, haversineM } = require('../services/util');

const router = express.Router();

// POST /api/checkins {targetType, targetId, lat, lng}
router.post('/', requireRole('visitor'), writeLimiter, (req, res) => {
  const { targetType, targetId, lat, lng } = req.body || {};
  const target = resolveTarget(String(targetType || ''), String(targetId || ''));
  if (!target) return res.status(404).json({ error: '打卡目標不存在或未上架' });
  const uLat = Number(lat), uLng = Number(lng);
  if (!Number.isFinite(uLat) || !Number.isFinite(uLng)) {
    return res.status(400).json({ error: '缺少定位資訊，請授權定位後再試' });
  }
  const dist = haversineM(uLat, uLng, target.lat, target.lng);
  if (dist > config.CHECKIN_RADIUS_M) {
    return res.status(403).json({ error: `距離「${target.name}」約 ${Math.round(dist)} m，需在 ${config.CHECKIN_RADIUS_M} m 內才能打卡` });
  }
  const day = macauDay();
  try {
    db.prepare('INSERT INTO checkins(user_id, target_type, target_id, day, created_at) VALUES(?,?,?,?,?)')
      .run(req.user.id, target.type, target.id, day, Date.now());
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '今日已在此打卡，明天再來吧' });
    }
    throw e;
  }
  const points = award(req.user.id, config.POINTS.checkin, 'checkin', `${target.type}:${target.id}`);
  res.json({ ok: true, points, target: target.name });
});

module.exports = router;
