/* sw.js — Service Worker（spec F9）
 * 註冊於根 scope（server 將 /sw.js 映射至此文件），覆蓋 /app、/api、團隊頁。
 * 策略：
 *  - 預緩存靜態資源：cache-first（版本號升級即全量換新）
 *  - 導航請求：network-first，離線回退預緩存頁面（主應用離線可開）
 *  - /api/ GET：network-first，成功副本入數據緩存；離線回退副本，無副本返回 503 JSON 兜底提示
 *  - 其他同源/字體：stale-while-revalidate；地圖瓦片不干預（走瀏覽器 HTTP 緩存）
 */
'use strict';

const VERSION = 'v1.2.1-20260807e';
const STATIC_CACHE = 'axwz-static-' + VERSION;
const DATA_CACHE = 'axwz-data-' + VERSION;

const PRECACHE = [
  '/app/', '/app/index.html', '/app/merchant.html', '/app/admin.html', '/app/manifest.webmanifest',
  '/app/css/app.css', '/app/css/app-v2.css',
  '/app/vendor/leaflet.css', '/app/vendor/leaflet.js', '/app/vendor/qr.js',
  '/app/vendor/leaflet.markercluster.js', '/app/vendor/MarkerCluster.css', '/app/vendor/MarkerCluster.Default.css',
  '/app/js/core/config.js', '/app/js/core/api.js', '/app/js/core/store.js', '/app/js/core/pwa.js',
  '/app/js/map/geo.js', '/app/js/map/basemap.js', '/app/js/map/layers.js',
  '/app/js/model/model.js', '/app/js/model/blend.js',
  '/app/js/ui/drawer.js', '/app/js/ui/filters.js', '/app/js/ui/search.js', '/app/js/ui/sheet.js', '/app/js/ui/toast.js',
  '/app/js/features/auth.js', '/app/js/features/coupon.js', '/app/js/features/report.js', '/app/js/features/social.js',
  '/app/js/pages/app.js', '/app/js/pages/merchant.js', '/app/js/pages/admin.js',
  '/app/icons/icon-192.png', '/app/icons/icon-512.png',
  '/app/data/model.json', '/app/data/spots.json', '/app/data/foods.json', '/app/data/events.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('axwz-') && k !== STATIC_CACHE && k !== DATA_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---------- 各類請求策略 ---------- */

// API：network-first + 數據緩存回退 + 離線 JSON 兜底
async function apiFetch(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    return new Response(JSON.stringify({ error: '當前處於離線狀態，請檢查網絡連接' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// 導航：network-first，離線回退預緩存頁面
async function navFetch(req) {
  try {
    return await fetch(req);
  } catch (e) {
    let p = new URL(req.url).pathname;
    if (p === '/app') p = '/app/';
    if (p === '/app/') p = '/app/index.html';
    const hit = await caches.match(p) || await caches.match('/app/index.html');
    if (hit) return hit;
    return new Response('<h1 style="font-family:sans-serif;padding:2em">當前處於離線狀態</h1>', {
      status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

// 靜態/字體：stale-while-revalidate（命中即返回，背景更新副本）
async function swrFetch(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) return hit;
  const res = await net;
  if (res) return res;
  throw new Error('offline and no cache');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // 寫操作不攔截（離線時由前端報錯提示）
  const url = new URL(req.url);

  if (url.origin !== location.origin) {
    // 跨域：僅字體走 SWR；地圖瓦片等不干預
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(swrFetch(req, STATIC_CACHE));
    }
    return;
  }

  if (url.pathname.startsWith('/api/')) { e.respondWith(apiFetch(req)); return; }
  if (req.mode === 'navigate') { e.respondWith(navFetch(req)); return; }
  e.respondWith(swrFetch(req, STATIC_CACHE));
});
