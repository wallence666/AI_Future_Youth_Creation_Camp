// 實時 U 因子（spec 第 3 節）：前端 model.js 融合用
const express = require('express');
const { liveU } = require('../services/crowd');

const router = express.Router();

// GET /api/crowd/live → { spots: { spotId: {u, n} }, ts }
router.get('/live', (req, res) => {
  res.json({ spots: liveU(), ts: Date.now() });
});

module.exports = router;
