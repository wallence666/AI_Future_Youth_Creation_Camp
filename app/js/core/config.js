/* core/config.js — 全局常量與 API 配置（對應 spec 第 4 節目錄結構）
 * 僅存放靜態配置；運行時狀態見 core/store.js。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};

  App.config = {
    API_BASE: '',                       // 同源部署：後端 server/index.js 託管 app/ 靜態文件
    MACAU_BOUNDS: [[22.098, 113.515], [22.232, 113.628]],
    REF_POINT: { lat: 22.19361, lng: 113.53961 }, // 議事亭前地（未取得定位時的參考點）
    TILES: {
      geoq: {
        url: 'https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunity/MapServer/tile/{z}/{y}/{x}',
        gcj: true, attr: '© Geoq 智圖 · © OpenStreetMap contributors · 數據僅供演示',
      },
      carto: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        gcj: false, subdomains: 'abcd', attr: '© OpenStreetMap contributors © CARTO',
      },
    },
    CUISINE_ICON: { '葡國菜': '🍽️', '粵菜': '🥢', '甜品': '🍮', '茶餐廳': '🧋', '小吃': '🍢', '手信': '🎁', '咖啡': '☕' },
    CHIP_DEFS: [
      { group: 'near', key: 'near', label: '📍 附近 1km' },
      { group: 'cuisine', key: '葡國菜' }, { group: 'cuisine', key: '粵菜' },
      { group: 'cuisine', key: '甜品' }, { group: 'cuisine', key: '茶餐廳' },
      { group: 'cuisine', key: '小吃' }, { group: 'cuisine', key: '手信' },
      { group: 'tag', key: '老字號' }, { group: 'tag', key: '米芝蓮' },
      { group: 'price', key: '1', label: '$ ≤50' }, { group: 'price', key: '2', label: '$$ 51–100' },
      { group: 'price', key: '3', label: '$$$ >100' },
    ],
    // 互動參數（對應 spec 第 9 節默認值，與 server/config.js 保持一致）
    REPORT_RADIUS_M: 150,               // 自動問卷觸發半徑
    REPORT_COOLDOWN_MIN: 30,            // 同景點問卷冷卻
    CHECKIN_RADIUS_M: 500,              // 打卡有效半徑（前端提示用，校驗在後端）
    POINTS: { report: 6, checkin: 10, comment: 5, commentPhoto: 8 }, // 展示用
  };
})();
