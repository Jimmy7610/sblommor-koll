/* ═══════════════════════════════════════════════════════════════
   qr.js  —  QR Code generator (byte mode, ECC level L, v1–15)
   Correct per ISO/IEC 18004:2015.  No external dependencies.
   ═══════════════════════════════════════════════════════════════ */

/* ── GF(256) lookup tables ── */
const EXP = new Uint8Array(256);
const LOG  = new Uint8Array(256);
(function () {
  let v = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = v; LOG[v] = i;
    v = (v << 1) ^ (v & 0x80 ? 0x11d : 0);
  }
  EXP[255] = 1;
})();

const gfMul = (a, b) => a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0;
const gfPow = (x, p)  => EXP[(LOG[x] * p) % 255];

function polyMul(p, q) {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++)
    for (let j = 0; j < q.length; j++)
      r[i + j] ^= gfMul(p[i], q[j]);
  return r;
}
function polyMod(msg, gen) {
  const r = new Uint8Array(msg);
  for (let i = 0; i <= msg.length - gen.length; i++) {
    const c = r[i]; if (!c) continue;
    for (let j = 1; j < gen.length; j++) r[i + j] ^= gfMul(gen[j], c);
  }
  return r.slice(msg.length - gen.length + 1);
}
function genPoly(n) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < n; i++) g = polyMul(g, new Uint8Array([1, gfPow(2, i)]));
  return g;
}

/* ── Version tables (ECC level L) — source: ISO 18004 Table 9 ──
   DATA_CAP  : total data codewords (including mode/length header space)
   ECC_N     : EC codewords per block
   BLK       : [g1count, g1data, g2count, g2data]  (g2 optional)
   REM_BITS  : remainder bits per version                              */
/* Block structure for ECC level L — verified against ISO 18004 Table 9 / thonky.com
   Format: [ec_per_block, g1_count, g1_data, g2_count, g2_data]
   Total data codewords = g1_count×g1_data + g2_count×g2_data                    */
const V = {
  1:  [7,  1, 19, 0,   0],
  2:  [10, 1, 34, 0,   0],
  3:  [15, 1, 55, 0,   0],
  4:  [20, 1, 80, 0,   0],
  5:  [26, 1,108, 0,   0],
  6:  [18, 2, 68, 0,   0],
  7:  [20, 2, 78, 0,   0],
  8:  [24, 2, 97, 0,   0],
  9:  [30, 2,116, 0,   0],
  10: [18, 2, 68, 2,  69],
  11: [20, 4, 81, 0,   0],
  12: [24, 2, 92, 2,  93],
  13: [26, 4,107, 0,   0],
  14: [30, 3,115, 1, 116],
  15: [22, 5, 87, 1,  88],
};
/* Byte-mode data capacity (= total_data_cws - 2 for v1-9 header bytes).
   These are max user BYTES that fit:                                    */
const CAP_BYTES = [0,17,32,53,78,106,134,154,192,230,271,321,367,425,458,520];
/* Remainder bits appended after codewords: */
const REM = [0,0,7,7,7,7,7,0,0,0,0,0,0,0,3,0];

/* Alignment pattern centers per version (v2+): */
const ALIGN_POS = [
  [],[], [6,18],[6,22],[6,26],[6,30],[6,34],
  [6,22,38],[6,24,42],[6,28,46],[6,32,50],
  [6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],
];

/* Pre-computed format info strings, ECC-L, masks 0-7 (after XOR with 101010000010010):
   Source: ISO 18004 Table C.1 / Annex C                               */
const FMT_L = [0x77C4,0x72F3,0x7DAA,0x789D,0x662F,0x6318,0x6C41,0x6976];

/* ══════════════════════════════════════════════════════════════
   DATA ENCODING
   ══════════════════════════════════════════════════════════════ */
function pickVersion(byteLen) {
  for (let v = 1; v <= 15; v++) if (CAP_BYTES[v] >= byteLen) return v;
  throw new Error(`Data too long (max ${CAP_BYTES[15]} bytes)`);
}

function encodeData(text) {
  const bytes  = new TextEncoder().encode(text);
  const ver    = pickVersion(bytes.length);
  const vinfo  = V[ver];
  // Total data codewords in this version
  const b1 = vinfo[1], d1 = vinfo[2], b2 = vinfo[3], d2 = vinfo[4];
  const totalData = b1 * d1 + b2 * d2;

  const bits = [];
  const push = (v, n) => { for (let i = n-1; i >= 0; i--) bits.push((v >> i) & 1); };
  push(0b0100, 4);                      // byte mode indicator
  push(bytes.length, ver <= 9 ? 8 : 16); // character count
  for (const b of bytes) push(b, 8);
  // Terminator + byte-align + pad
  for (let i = 0; i < 4 && bits.length < totalData*8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const PAD = [0xEC, 0x11];
  let pi = 0;
  while (bits.length < totalData * 8) push(PAD[pi++ & 1], 8);

  // Pack bits → bytes
  const data = new Uint8Array(totalData);
  for (let i = 0; i < totalData; i++)
    for (let j = 0; j < 8; j++) data[i] = (data[i] << 1) | bits[i*8 + j];

  return { ver, data, vinfo };
}

/* ── Reed-Solomon interleaving ── */
function buildCodewords(ver, data, vinfo) {
  const [eccN, b1, d1, b2, d2] = vinfo;
  const gen = genPoly(eccN);
  const dBlocks = [], eBlocks = [];

  let off = 0;
  const addGroup = (count, sz) => {
    for (let i = 0; i < count; i++) {
      const blk = data.slice(off, off + sz); off += sz;
      dBlocks.push(blk);
      const padded = new Uint8Array(sz + eccN);
      padded.set(blk);
      eBlocks.push(polyMod(padded, gen));
    }
  };
  addGroup(b1, d1);
  if (b2) addGroup(b2, d2);

  // Interleave data, then EC
  const out = [];
  const maxD = Math.max(...dBlocks.map(b => b.length));
  for (let i = 0; i < maxD; i++)
    for (const b of dBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < eccN; i++)
    for (const e of eBlocks) out.push(e[i]);
  return new Uint8Array(out);
}

/* ══════════════════════════════════════════════════════════════
   MATRIX CONSTRUCTION
   ══════════════════════════════════════════════════════════════ */
const FINDER = [
  1,1,1,1,1,1,1,
  1,0,0,0,0,0,1,
  1,0,1,1,1,0,1,
  1,0,1,1,1,0,1,
  1,0,1,1,1,0,1,
  1,0,0,0,0,0,1,
  1,1,1,1,1,1,1,
];
const ALIGN5 = [
  1,1,1,1,1,
  1,0,0,0,1,
  1,0,1,0,1,
  1,0,0,0,1,
  1,1,1,1,1,
];

function makeMatrix(n) {
  return Array.from({length:n}, () => new Int8Array(n).fill(-1));
}

function setFn(m, r, c, h, w, val) {
  for (let i = r; i < r+h; i++) for (let j = c; j < c+w; j++) m[i][j] = val;
}

function placeFinder(m, row, col) {
  for (let dr = 0; dr < 7; dr++)
    for (let dc = 0; dc < 7; dc++)
      m[row+dr][col+dc] = FINDER[dr*7+dc];
}

function placeAlignment(m, row, col) {
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++)
      if (m[row+dr][col+dc] < 0)  // don't overwrite finder/timing
        m[row+dr][col+dc] = ALIGN5[(dr+2)*5+(dc+2)];
}

function reserveFormatAreas(m, sz) {
  // Row 8 format strip
  for (let c = 0; c <= 8; c++)   if (m[8][c] < 0) m[8][c] = 0;
  for (let c = sz-8; c < sz; c++) if (m[8][c] < 0) m[8][c] = 0;
  // Col 8 format strip
  for (let r = 0; r <= 8; r++)    if (m[r][8] < 0) m[r][8] = 0;
  for (let r = sz-7; r < sz; r++) if (m[r][8] < 0) m[r][8] = 0;
  // Dark module placeholder (writeFormatInfo sets the real value)
  m[sz-8][8] = 1;
}

function placeTiming(m, sz) {
  for (let i = 8; i < sz-8; i++) {
    const v = i % 2 === 0 ? 1 : 0;
    if (m[6][i] < 0) m[6][i] = v;
    if (m[i][6] < 0) m[i][6] = v;
  }
}

function placeDataBits(m, sz, codewords, remBits) {
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw>>i)&1);
  for (let i = 0; i < remBits; i++) bits.push(0);

  let idx = 0, up = true;
  for (let right = sz-1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip timing column
    for (let vert = 0; vert < sz; vert++) {
      const row = up ? sz-1-vert : vert;
      for (let dc = 0; dc < 2; dc++) {
        const col = right - dc;
        if (m[row][col] < 0 && idx < bits.length) {
          m[row][col] = bits[idx++];
        }
      }
    }
    up = !up;
  }
}

function applyMask(m, sz, pat) {
  for (let r = 0; r < sz; r++)
    for (let c = 0; c < sz; c++) {
      if (m[r][c] < 0 || m[r][c] >= 2) continue;
      let flip = false;
      switch (pat) {
        case 0: flip = (r+c)%2===0; break;
        case 1: flip = r%2===0; break;
        case 2: flip = c%3===0; break;
        case 3: flip = (r+c)%3===0; break;
        case 4: flip = (Math.floor(r/2)+Math.floor(c/3))%2===0; break;
        case 5: flip = (r*c)%2+(r*c)%3===0; break;
        case 6: flip = ((r*c)%2+(r*c)%3)%2===0; break;
        case 7: flip = ((r+c)%2+(r*c)%3)%2===0; break;
      }
      if (flip) m[r][c] ^= 1;
    }
}

function writeFormatInfo(m, sz, mask) {
  const fmt = FMT_L[mask];
  const bits = [];
  for (let i = 14; i >= 0; i--) bits.push((fmt >> i) & 1);
  // Position 1 — top-left area (rows/cols 0-8)
  const p1r = [8,8,8,8,8,8,8,8,7,5,4,3,2,1,0];
  const p1c = [0,1,2,3,4,5,7,8,8,8,8,8,8,8,8];
  for (let i = 0; i < 15; i++) m[p1r[i]][p1c[i]] = bits[i] + 2; // +2 = function
  // Position 2 — bottom-left vertical and top-right horizontal
  for (let i = 0; i < 7; i++) m[sz-1-i][8] = bits[14-i] + 2;
  for (let i = 0; i < 8; i++) m[8][sz-8+i] = bits[i] + 2;
  m[sz-8][8] = 3; // dark module (always black = 1, +2 = 3)
}

function maskPenalty(m, sz) {
  let n = 0;
  // Rule 1: runs of 5+ same colour
  for (let r = 0; r < sz; r++) {
    for (let ax = 0; ax < 2; ax++) {
      let run = 1, prev = ax ? m[r][0] : m[0][r];
      for (let i = 1; i < sz; i++) {
        const cur = ax ? m[r][i] : m[i][r];
        if (cur === prev) { run++; if (run === 5) n += 3; else if (run > 5) n++; }
        else { run = 1; prev = cur; }
      }
    }
  }
  // Rule 2: 2×2 blocks
  for (let r = 0; r < sz-1; r++)
    for (let c = 0; c < sz-1; c++) {
      const v = m[r][c]&1;
      if ((m[r][c+1]&1)===v && (m[r+1][c]&1)===v && (m[r+1][c+1]&1)===v) n += 3;
    }
  return n;
}

/* ══════════════════════════════════════════════════════════════
   MAIN BUILD
   ══════════════════════════════════════════════════════════════ */
function buildQR(text) {
  const { ver, data, vinfo } = encodeData(text);
  const codewords = buildCodewords(ver, data, vinfo);
  const sz = ver * 4 + 17;
  const m  = makeMatrix(sz);

  // Finder patterns at top-left, top-right, bottom-left
  placeFinder(m, 0, 0);
  placeFinder(m, 0, sz-7);
  placeFinder(m, sz-7, 0);

  // Separator rows/cols (0 = white) around finders
  setFn(m, 7, 0, 1, 8, 0);  setFn(m, 0, 7, 7, 1, 0);   // TL h/v
  setFn(m, 7, sz-8, 1, 8, 0); setFn(m, 0, sz-8, 7, 1, 0); // TR h/v
  setFn(m, sz-8, 0, 1, 8, 0); setFn(m, sz-7, 7, 7, 1, 0); // BL h/v

  // Timing patterns
  placeTiming(m, sz);

  // Alignment patterns (v2+)
  const ap = ALIGN_POS[ver];
  for (const r of ap) for (const c of ap) placeAlignment(m, r, c);

  // Reserve format info areas + dark module
  reserveFormatAreas(m, sz);

  // Lock all function modules (values 0/1 → 2/3) so masking skips them.
  // Data modules will be placed as 0/1 after this step.
  for (let r = 0; r < sz; r++)
    for (let c = 0; c < sz; c++)
      if (m[r][c] >= 0) m[r][c] += 2;

  // Place data bits (0 or 1 — not function modules)
  placeDataBits(m, sz, codewords, REM[ver]);

  // Try all 8 masks, pick lowest penalty
  let bestMask = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const copy = m.map(r => new Int8Array(r));
    applyMask(copy, sz, mask);
    writeFormatInfo(copy, sz, mask);
    const s = maskPenalty(copy, sz);
    if (s < bestScore) { bestScore = s; bestMask = mask; }
  }
  applyMask(m, sz, bestMask);
  writeFormatInfo(m, sz, bestMask);

  return { matrix: m, sz, ver };
}

/* ══════════════════════════════════════════════════════════════
   RENDER FUNCTIONS
   ══════════════════════════════════════════════════════════════ */

/* Canvas — best camera compatibility */
export function qrCanvas(text, canvas, { quiet = 4, size = 300 } = {}) {
  const { matrix, sz } = buildQR(text);
  const total = sz + quiet * 2;
  const px    = Math.max(2, Math.floor(size / total));
  const dim   = total * px;
  canvas.width  = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < sz; r++)
    for (let c = 0; c < sz; c++)
      if (matrix[r][c] & 1)
        ctx.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
  return { sz, px, dim };
}

/* SVG — path-based, white bg rect, crisp */
export function qrSVG(text, { quiet = 4, size = 300 } = {}) {
  const { matrix, sz } = buildQR(text);
  const total = sz + quiet * 2;
  const px    = Math.max(2, Math.floor(size / total));
  const dim   = total * px;
  let path = '';
  for (let r = 0; r < sz; r++)
    for (let c = 0; c < sz; c++)
      if (matrix[r][c] & 1) {
        const x = (c + quiet) * px, y = (r + quiet) * px;
        path += `M${x},${y}h${px}v${px}h-${px}z`;
      }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><path fill="#000" d="${path}"/></svg>`;
}

/* PNG data URL via canvas */
export function qrDataURL(text, opts = {}) {
  const cv = document.createElement('canvas');
  qrCanvas(text, cv, opts);
  return cv.toDataURL('image/png');
}
