// 店舖公開查詢：已上架店舖（含進行中活動），供地圖美食圖層合併（spec F6/F7）
const express = require('express');
const { db } = require('../db');

const router = express.Router();

function activePromos(shopId) {
  const now = Date.now();
  return db.prepare(`
    SELECT id, title, descr, points_cost, coupon_value, start_at, end_at, stock
    FROM promos
    WHERE shop_id = ? AND status = 'approved' AND start_at <= ? AND end_at >= ? AND stock > 0
    ORDER BY id DESC`).all(shopId, now, now);
}

function parseShop(s) {
  return { ...s, photos: JSON.parse(s.photos || '[]'), menu: JSON.parse(s.menu || '[]') };
}

// GET /api/shops
router.get('/', (req, res) => {
  const shops = db.prepare("SELECT * FROM shops WHERE status = 'approved' ORDER BY id DESC").all()
    .map(s => ({ ...parseShop(s), promos: activePromos(s.id) }));
  res.json({ shops });
});

// GET /api/shops/:id
router.get('/:id', (req, res) => {
  const s = db.prepare("SELECT * FROM shops WHERE id = ? AND status = 'approved'").get(Number(req.params.id));
  if (!s) return res.status(404).json({ error: '店舖不存在或未上架' });
  res.json({ shop: { ...parseShop(s), promos: activePromos(s.id) } });
});

module.exports = router;
