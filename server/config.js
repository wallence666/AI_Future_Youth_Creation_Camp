// 全局配置：環境變量優先，默認值僅供本地開發
const path = require('path');

module.exports = {
  PORT: Number(process.env.PORT || 8000),
  JWT_SECRET: process.env.JWT_SECRET || 'axwz-dev-secret-change-me',
  JWT_EXPIRES: '7d',
  ROOT: path.join(__dirname, '..'),
  APP_DIR: path.join(__dirname, '..', 'app'),
  DB_PATH: path.join(__dirname, 'data', 'app.db'),
  UPLOAD_DIR: path.join(__dirname, 'data', 'uploads'),
  MAX_UPLOAD_MB: 5,
  // 業務參數（對應 spec 第 9 節）
  CHECKIN_RADIUS_M: 500,        // 打卡有效半徑
  REPORT_COOLDOWN_MIN: 30,      // 人流回報同景點限頻
  U_HALF_LIFE_MIN: 15,          // U 因子半衰期
  U_WINDOW_MIN: 30,             // U 因子統計窗口
  // 積分（對應 spec F5）
  POINTS: {
    register: 20,
    report: 6,
    checkin: 10,
    comment: 5,
    commentPhoto: 8,
    commentDeleted: -5,
  },
};

