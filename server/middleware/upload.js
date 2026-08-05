// 照片上傳：multer 磁盤存儲，5MB 上限，jpg/png/webp 白名單（spec 第 7 節）
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: config.UPLOAD_DIR,
  filename: (req, file, cb) => {
    cb(null, Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex') + ALLOWED[file.mimetype]);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new Error('僅支援 jpg / png / webp 圖片'));
    cb(null, true);
  },
});

module.exports = upload;
