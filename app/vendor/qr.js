/* vendor/qr.js — 極簡 QR 二維碼本地生成器（無外部依賴）
 * 用途：代金券 6 位核銷碼 → QR（spec F7：前端本地生成，不請求外部服務）。
 * 實現範圍：字節模式（byte mode）、版本 1–9 自選、糾錯級別 M、8 種掩碼擇優。
 * 依據 ISO/IEC 18004；算法結構參考 qrcode-generator（MIT）。
 * 對外：window.QRGen.toCanvas(text, px) → <canvas>。
 */
(function (global) {
  'use strict';

  /* ================= GF(256) 域運算（本原多項式 0x11d） ================= */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gexp = i => EXP[((i % 255) + 255) % 255];
  const glog = n => LOG[n];

  /* ================= 多項式（Reed-Solomon 用） ================= */
  function polyStrip(nums) {           // 去除高位零係數
    let off = 0;
    while (off < nums.length - 1 && nums[off] === 0) off++;
    return nums.slice(off);
  }
  function polyMul(a, b) {
    const out = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < b.length; j++)
        out[i + j] ^= gexp(glog(a[i]) + glog(b[j]));
    return out;
  }
  function polyMod(data, gen) {        // data mod gen → 餘式（EC 碼字）
    let res = polyStrip(data.slice());
    while (res.length >= gen.length) {
      const ratio = (glog(res[0]) - glog(gen[0]) + 255) % 255;
      for (let i = 0; i < gen.length; i++) res[i] ^= gexp(glog(gen[i]) + ratio);
      res = polyStrip(res);
    }
    return res;
  }
  function genPoly(ecCount) {          // 生成多項式 Π(x + α^i)
    let g = [1];
    for (let i = 0; i < ecCount; i++) g = polyMul(g, [1, gexp(i)]);
    return g;
  }

  /* ================= RS 塊表（版本 1–9 × L/M/Q/H：count, totalCount, dataCount） ================= */
  const RS_TABLE = {
    1: [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9]],
    2: [[1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16]],
    3: [[1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13]],
    4: [[1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9]],
    5: [[1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12]],
    6: [[2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15]],
    7: [[2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14]],
    8: [[2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15]],
    9: [[2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13]],
  };
  const EC_INDEX = { M: 1, L: 0, Q: 2, H: 3 };   // 本項目固定用 M
  const EC_BITS = { M: 0, L: 1, Q: 3, H: 2 };    // 格式資訊中的 2-bit 標識

  // 對齊圖案中心座標（版本 1–9）
  const ALIGN_POS = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46],
  };

  function rsBlocks(version, ecLevel) {
    const raw = RS_TABLE[version][EC_INDEX[ecLevel]];
    const blocks = [];
    for (let i = 0; i < raw.length; i += 3)
      for (let j = 0; j < raw[i]; j++)
        blocks.push({ total: raw[i + 1], data: raw[i + 2] });
    return blocks;
  }

  /* ================= BCH 糾錯（格式/版本資訊） ================= */
  const G15 = 0x0537, G18 = 0x1F25, G15_MASK = 0x5412;
  function bchDigit(d) { let n = 0; while (d) { n++; d >>>= 1; } return n; }
  function bchTypeInfo(data) {         // 15-bit 格式資訊
    let d = data << 10;
    while (bchDigit(d) - bchDigit(G15) >= 0) d ^= G15 << (bchDigit(d) - bchDigit(G15));
    return ((data << 10) | d) ^ G15_MASK;
  }
  function bchTypeNumber(version) {    // 18-bit 版本資訊（V≥7）
    let d = version << 12;
    while (bchDigit(d) - bchDigit(G18) >= 0) d ^= G18 << (bchDigit(d) - bchDigit(G18));
    return (version << 12) | d;
  }

  /* ================= 掩碼函數 ================= */
  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
    (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
  ];

  /* ================= 位流緩衝 ================= */
  function BitBuffer() { this.buf = []; this.len = 0; }
  BitBuffer.prototype.put = function (num, length) {
    for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
  };
  BitBuffer.prototype.putBit = function (bit) {
    const i = Math.floor(this.len / 8);
    if (this.buf.length <= i) this.buf.push(0);
    if (bit) this.buf[i] |= 0x80 >>> (this.len % 8);
    this.len++;
  };

  /* ================= 主生成流程 ================= */
  function createData(bytes, version, ecLevel) {
    const blocks = rsBlocks(version, ecLevel);
    const totalData = blocks.reduce((s, b) => s + b.data, 0);

    const buf = new BitBuffer();
    buf.put(4, 4);                      // 字節模式 0100
    buf.put(bytes.length, 8);           // V1–9 字節模式長度佔 8 bit
    for (const b of bytes) buf.put(b, 8);
    if (buf.len + 4 <= totalData * 8) buf.put(0, 4);          // 終止符
    while (buf.len % 8) buf.putBit(0);                        // 對齊字節
    const PAD = [0xEC, 0x11];
    for (let i = 0; buf.len < totalData * 8; i++) buf.put(PAD[i % 2], 8);

    // 分塊 + 計 EC + 交織
    let offset = 0, maxDc = 0, maxEc = 0;
    const dcdata = [], ecdata = [];
    for (const blk of blocks) {
      const dc = buf.buf.slice(offset, offset + blk.data); offset += blk.data;
      const ecCount = blk.total - blk.data;
      let ec = polyMod(dc.concat(new Array(ecCount).fill(0)), genPoly(ecCount));
      if (ec.length < ecCount) ec = new Array(ecCount - ec.length).fill(0).concat(ec); // 左補零對齊
      dcdata.push(dc); ecdata.push(ec);
      maxDc = Math.max(maxDc, dc.length); maxEc = Math.max(maxEc, ec.length);
    }
    const out = [];
    for (let i = 0; i < maxDc; i++) for (let r = 0; r < blocks.length; r++)
      if (i < dcdata[r].length) out.push(dcdata[r][i]);
    for (let i = 0; i < maxEc; i++) for (let r = 0; r < blocks.length; r++)
      if (i < ecdata[r].length) out.push(ecdata[r][i]);
    return out;
  }

  function buildMatrix(bytes, version, ecLevel, maskPattern, test) {
    const count = 17 + version * 4;
    const m = Array.from({ length: count }, () => new Array(count).fill(null));

    function finder(row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r < 0 || count <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c < 0 || count <= col + c) continue;
          m[row + r][col + c] =
            (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4);
        }
      }
    }
    finder(0, 0); finder(count - 7, 0); finder(0, count - 7);

    // 對齊圖案
    const pos = ALIGN_POS[version];
    for (const row of pos) for (const col of pos) {
      if (m[row][col] !== null) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++)
        m[row + r][col + c] = (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0));
    }
    // 時序圖案
    for (let i = 8; i < count - 8; i++) {
      if (m[i][6] === null) m[i][6] = i % 2 === 0;
      if (m[6][i] === null) m[6][i] = i % 2 === 0;
    }
    // 格式資訊
    const fmtBits = bchTypeInfo((EC_BITS[ecLevel] << 3) | maskPattern);
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((fmtBits >> i) & 1) === 1;
      if (i < 6) m[i][8] = mod;
      else if (i < 8) m[i + 1][8] = mod;
      else m[count - 15 + i][8] = mod;
      if (i < 8) m[8][count - i - 1] = mod;
      else if (i < 9) m[8][15 - i - 1 + 1] = mod;
      else m[8][15 - i - 1] = mod;
    }
    m[count - 8][8] = !test;            // 暗模塊
    // 版本資訊（V≥7）
    if (version >= 7) {
      const vBits = bchTypeNumber(version);
      for (let i = 0; i < 18; i++) {
        const mod = !test && ((vBits >> i) & 1) === 1;
        m[Math.floor(i / 3)][i % 3 + count - 11] = mod;
        m[i % 3 + count - 11][Math.floor(i / 3)] = mod;
      }
    }
    // 數據填充（Z 字形 + 掩碼）
    const data = createData(bytes, version, ecLevel);
    const mask = MASKS[maskPattern];
    let inc = -1, row = count - 1, bitIndex = 7, byteIndex = 0;
    for (let col = count - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (m[row][col - c] === null) {
            let dark = byteIndex < data.length && ((data[byteIndex] >>> bitIndex) & 1) === 1;
            if (mask(row, col - c)) dark = !dark;
            m[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || count <= row) { row -= inc; inc = -inc; break; }
      }
    }
    return m;
  }

  /* ================= 掩碼罰分（ISO 四規則） ================= */
  function lostPoint(m) {
    const count = m.length;
    let lost = 0;
    // 規則 1：行/列連同色 ≥5
    for (let row = 0; row < count; row++) {
      let sameCount = 0, prev = null;
      for (let col = 0; col < count; col++) {
        const dark = m[row][col];
        if (dark === prev) sameCount++;
        else sameCount = 1;
        if (sameCount === 5) lost += 3;
        else if (sameCount > 5) lost += 1;
        prev = dark;
      }
    }
    for (let col = 0; col < count; col++) {
      let sameCount = 0, prev = null;
      for (let row = 0; row < count; row++) {
        const dark = m[row][col];
        if (dark === prev) sameCount++;
        else sameCount = 1;
        if (sameCount === 5) lost += 3;
        else if (sameCount > 5) lost += 1;
        prev = dark;
      }
    }
    // 規則 2：2×2 同色塊
    for (let row = 0; row < count - 1; row++)
      for (let col = 0; col < count - 1; col++) {
        const d = m[row][col];
        if (d === m[row][col + 1] && d === m[row + 1][col] && d === m[row + 1][col + 1]) lost += 3;
      }
    // 規則 3：1011101 + 前/後四連淺色
    const pat = [true, false, true, true, true, false, true];
    function matchAt(get) {           // get(i) → 模塊色（越界視為淺色）
      for (let i = 0; i < 7; i++) if (get(i) !== pat[i]) return false;
      const before = [-4, -3, -2, -1].every(x => !get(x));
      const after = [7, 8, 9, 10].every(x => !get(x));
      return before || after;
    }
    for (let row = 0; row < count; row++)
      for (let col = 0; col < count - 6; col++)
        if (matchAt(x => (col + x < 0 || col + x >= count) ? false : m[row][col + x])) lost += 40;
    for (let col = 0; col < count; col++)
      for (let row = 0; row < count - 6; row++)
        if (matchAt(x => (row + x < 0 || row + x >= count) ? false : m[row + x][col])) lost += 40;
    // 規則 4：暗模塊佔比
    let dark = 0;
    for (const r of m) for (const v of r) if (v) dark++;
    const ratio = Math.abs((100 * dark) / (count * count) - 50) / 5;
    lost += Math.floor(ratio) * 10;
    return lost;
  }

  /* ================= 對外 API ================= */
  const MAX_VERSION = 9;

  /** 生成矩陣（true=暗模塊）。失敗拋錯（文本過長）。 */
  function toMatrix(text, ecLevel) {
    ecLevel = ecLevel || 'M';
    const bytes = Array.from(new TextEncoder().encode(text));
    for (let v = 1; v <= MAX_VERSION; v++) {
      const capacity = rsBlocks(v, ecLevel).reduce((s, b) => s + b.data, 0);
      const needBits = 4 + 8 + bytes.length * 8;
      if (needBits > capacity * 8) continue;
      // 8 掩碼擇優（test 矩陣評分 → 以最佳掩碼正式生成）
      let bestLost = Infinity, bestMask = 0;
      for (let mp = 0; mp < 8; mp++) {
        const lost = lostPoint(buildMatrix(bytes, v, ecLevel, mp, true));
        if (lost < bestLost) { bestLost = lost; bestMask = mp; }
      }
      return { modules: buildMatrix(bytes, v, ecLevel, bestMask, false), version: v, mask: bestMask };
    }
    throw new Error('QR 文本過長（超過版本 9-M 容量）');
  }

  /** 渲染到 canvas（含 4 模塊靜區）。 */
  function toCanvas(text, px) {
    px = px || 192;
    const { modules } = toMatrix(text, 'M');
    const count = modules.length, quiet = 4;
    const cell = Math.max(2, Math.floor(px / (count + quiet * 2)));
    const size = cell * (count + quiet * 2);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0A1327';
    for (let r = 0; r < count; r++)
      for (let c = 0; c < count; c++)
        if (modules[r][c]) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    return canvas;
  }

  global.QRGen = { toMatrix, toCanvas, _debug: { genPoly, polyMod, createData, rsBlocks } };
})(window);
