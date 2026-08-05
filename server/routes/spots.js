// 景點：列表（含打卡/評論計數）與詳情（spec F3/F4 計數展示）
const express = require('express');
const { db } = require('../db');
const { spots } = require('../services/poi');
const { liveU } = require('../services/crowd');

const router = express.Router();

function spotCounts() {
  const ck = db.prepare("SELECT target_id id, COUNT(*) c FROM checkins WHERE target_type = 'spot' GROUP BY target_id").all();
  const cm = db.prepare("SELECT target_id id, COUNT(*) c FROM comments WHERE target_type = 'spot' AND status = 'visible' GROUP BY target_id").all();
  const map = {};
  for (const r of ck) (map[r.id] ||= {}).checkins = r.c;
  for (const r of cm) (map[r.id] ||= {}).comments = r.c;
  return map;
}

// GET /api/spots
router.get('/', (req, res) => {
  const counts = spotCounts();
  const u = liveU();
  res.json({
    spots: spots.map(s => ({
      ...s,
      checkins: counts[s.id]?.checkins || 0,
      comments: counts[s.id]?.comments || 0,
      reports: u[s.id]?.n || 0,
    })),
  });
});

// GET /api/spots/:id
router.get('/:id', (req, res) => {
  const s = spots.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: '景點不存在' });
  const counts = spotCounts()[s.id] || {};
  const u = liveU()[s.id] || null;
  res.json({ spot: { ...s, checkins: counts.checkins || 0, comments: counts.comments || 0, liveU: u } });
});

module.exports = router;
