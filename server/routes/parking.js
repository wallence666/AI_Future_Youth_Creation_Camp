// GET /api/parking/live → DSAT 停車場即時空位率（後端每 30 秒輪詢一次，見 services/parking.js）
const express = require('express');
const parking = require('../services/parking');

const router = express.Router();

router.get('/live', (req, res) => {
  res.json({ carparks: parking.getParking(), ts: Date.now() });
});

module.exports = router;
