// 內地法定假日日曆代理（docs/01 §3.1 H(t) 4 檔假期分級）
// 前端瀏覽器直連 api.jiejiariapi.com 會被 CORS 擋下（該服務未回傳 Access-Control-Allow-Origin），
// 故由後端代為請求並加 in-memory 快取（同一年份僅需請求一次外部 API，也隔離其暫時性故障）。
const express = require('express');

const router = express.Router();
const cache = new Map(); // year -> { data, ts }
const TTL_MS = 24 * 3600 * 1000;

router.get('/:year', async (req, res) => {
  const year = Number(req.params.year);
  if (!Number.isInteger(year) || year < 2007 || year > 2100) {
    return res.status(400).json({ error: '年份無效' });
  }
  const hit = cache.get(year);
  if (hit && Date.now() - hit.ts < TTL_MS) return res.json(hit.data);
  try {
    const r = await fetch(`https://api.jiejiariapi.com/v1/holidays/${year}`);
    if (!r.ok) throw new Error('upstream ' + r.status);
    const data = await r.json();
    cache.set(year, { data, ts: Date.now() });
    res.json(data);
  } catch (e) {
    if (hit) return res.json(hit.data); // 過期快取也比沒有好，外部 API 故障時降級使用
    res.status(502).json({ error: '假期日曆服務暫時無法取得' });
  }
});

module.exports = router;
