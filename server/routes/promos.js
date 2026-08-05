// 代金券兌換（spec F7）：扣積分 + 扣庫存 + 生成 6 位核銷碼，事務保證一致
const express = require('express');
const { db, tx } = require('../db');
const { requireRole } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { genCode } = require('../services/util');

const router = express.Router();

// POST /api/promos/:id/exchange
router.post('/:id/exchange', requireRole('visitor'), writeLimiter, (req, res) => {
  const now = Date.now();
  const promo = db.prepare('SELECT * FROM promos WHERE id = ?').get(Number(req.params.id));
  if (!promo || promo.status !== 'approved') return res.status(404).json({ error: '活動不存在或未上架' });
  if (promo.start_at > now) return res.status(400).json({ error: '活動尚未開始' });
  if (promo.end_at < now) return res.status(400).json({ error: '活動已結束' });
  if (promo.stock <= 0) return res.status(409).json({ error: '代金券已被兌換完畢' });

  const me = db.prepare('SELECT points FROM users WHERE id = ?').get(req.user.id);
  if (me.points < promo.points_cost) {
    return res.status(400).json({ error: `積分不足（需要 ${promo.points_cost}，現有 ${me.points}）` });
  }

  try {
    const coupon = tx(() => {
      // 條件更新防超兌
      const r = db.prepare("UPDATE promos SET stock = stock - 1 WHERE id = ? AND stock > 0").run(promo.id);
      if (r.changes === 0) throw Object.assign(new Error('代金券已被兌換完畢'), { status: 409 });
      db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(promo.points_cost, req.user.id);
      db.prepare('INSERT INTO points_log(user_id, delta, reason, ref_id, created_at) VALUES(?,?,?,?,?)')
        .run(req.user.id, -promo.points_cost, 'exchange', promo.id, now);
      let code, tries = 0;
      do {
        code = genCode(6);
        tries++;
      } while (tries < 20 && db.prepare('SELECT id FROM coupons WHERE code = ?').get(code));
      const info = db.prepare('INSERT INTO coupons(promo_id, user_id, code, created_at) VALUES(?,?,?,?)')
        .run(promo.id, req.user.id, code, now);
      return { id: Number(info.lastInsertRowid), code };
    });
    const points = db.prepare('SELECT points FROM users WHERE id = ?').get(req.user.id).points;
    res.json({ ok: true, coupon, points, title: promo.title, couponValue: promo.coupon_value, endAt: promo.end_at });
  } catch (e) {
    console.error('[exchange]', e);
    res.status(e.status || 500).json({ error: e.message || '兌換失敗' });
  }
});

module.exports = router;
