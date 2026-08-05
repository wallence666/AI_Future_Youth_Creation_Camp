// 積分服務：發放/扣減 + 流水（spec F5）
const { db, tx } = require('../db');

/** 發放積分（可為負數），寫流水，返回最新餘額 */
function award(userId, delta, reason, refId = null) {
  return tx(() => {
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(delta, userId);
    db.prepare('INSERT INTO points_log(user_id, delta, reason, ref_id, created_at) VALUES(?,?,?,?,?)')
      .run(userId, delta, reason, refId == null ? null : String(refId), Date.now());
    return db.prepare('SELECT points FROM users WHERE id = ?').get(userId).points;
  });
}

module.exports = { award };
