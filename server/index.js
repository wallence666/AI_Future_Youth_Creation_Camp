// 澳行無阻後端入口：API 路由 + 靜態託管（app/ 前端、uploads/ 照片、團隊頁）
const path = require('path');
const express = require('express');
const config = require('./config');
require('./db'); // 初始化 DB + seed

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------- API ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/me', require('./routes/me'));
app.use('/api/spots', require('./routes/spots'));
app.use('/api/spots', require('./routes/reports'));   // POST /api/spots/:id/reports
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/crowd', require('./routes/crowd'));
app.use('/api/holidays', require('./routes/holidays'));
app.use('/api/parking', require('./routes/parking'));
require('./services/parking').start();   // 背景輪詢 DSAT 停車場數據（docs/01 §3.1 Park(s,t)）
app.use('/api/targets', require('./routes/targets'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/promos', require('./routes/promos'));
app.use('/api/merchant', require('./routes/merchant'));
app.use('/api/admin', require('./routes/admin'));

// API 404 與錯誤處理（統一 JSON）
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  res.status(status).json({ error: err.message || '服務器錯誤' });
});

// ---------- 靜態託管 ----------
app.use('/uploads', express.static(config.UPLOAD_DIR));
app.use('/app', express.static(config.APP_DIR));
// Service Worker 需根 scope（覆蓋 /api 與 /app），文件本體在 app/sw.js
app.get('/sw.js', (req, res) => res.sendFile(path.join(config.APP_DIR, 'sw.js'), { headers: { 'Cache-Control': 'no-cache' } }));
app.use('/assets', express.static(path.join(config.ROOT, 'assets')));
app.get('/', (req, res) => res.sendFile(path.join(config.ROOT, 'index.html')));

app.listen(config.PORT, () => {
  console.log(`[axwz] server ready → http://localhost:${config.PORT}/  (應用: /app/)`);
});
