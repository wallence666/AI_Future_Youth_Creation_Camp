// 寫接口限流（spec 第 7 節）：按用戶 id（已登入）或 IP，10 分鐘 60 次
const { rateLimit } = require('express-rate-limit');

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? 'u' + req.user.id : req.ip),
  message: { error: '操作過於頻繁，請稍後再試' },
});

module.exports = { writeLimiter };
