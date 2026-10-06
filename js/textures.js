'use strict';
// =====================================================================
// 절차적 텍스처 생성기 - 모든 블록/아이템 그림을 코드로 그린다 (외부 에셋 없음)
// 16x16 픽셀아트 → WebGL 텍스처 배열(레이어)로 올린다.
// =====================================================================
const TEX = { list: [], byName: Object.create(null), isItem: [], names: [] };
function T(name) {
  const i = TEX.byName[name];
  if (i === undefined) { console.warn('텍스처 없음:', name); return 0; }
  return i;
}
const DYES = [
  ['white', '흰색', [233, 236, 236]], ['orange', '주황색', [240, 118, 19]], ['magenta', '자홍색', [189, 68, 179]],
  ['light_blue', '하늘색', [58, 175, 217]], ['yellow', '노란색', [248, 197, 39]], ['lime', '연두색', [112, 185, 25]],
  ['pink', '분홍색', [237, 141, 172]], ['gray', '회색', [62, 68, 71]], ['light_gray', '밝은 회색', [142, 142, 134]],
  ['cyan', '청록색', [21, 137, 145]], ['purple', '보라색', [121, 42, 172]], ['blue', '파란색', [53, 57, 157]],
  ['brown', '갈색', [114, 71, 40]], ['green', '초록색', [84, 109, 27]], ['red', '빨간색', [160, 39, 34]], ['black', '검은색', [20, 21, 25]],
];
const FONT3x5 = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'], 'A': ['010', '101', '111', '101', '101'], 'N': ['101', '111', '111', '101', '101'],
  'D': ['110', '101', '101', '101', '110'], 'O': ['111', '101', '101', '101', '111'], 'R': ['110', '101', '110', '101', '101'],
  'X': ['101', '101', '010', '101', '101'], 'T': ['111', '010', '010', '010', '010'],
};

class Painter {
  constructor(name) {
    this.d = new Uint8ClampedArray(16 * 16 * 4);
    this.rnd = mulberry32(strHash(name));
  }
  r() { return this.rnd(); }
  set(x, y, c, a) {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    const i = ((y | 0) * 16 + (x | 0)) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2];
    this.d[i + 3] = a !== undefined ? a : (c[3] !== undefined ? c[3] : 255);
  }
  get(x, y) { const i = (y * 16 + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  alpha(x, y) { return this.d[(y * 16 + x) * 4 + 3]; }
  clear() { this.d.fill(0); }
  fill(c) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) this.set(x, y, c); }
  noise(c, v, a) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = (this.r() - 0.5) * 2 * v;
      this.set(x, y, [c[0] + k, c[1] + k, c[2] + k], a);
    }
  }
  vary(c, v) { const k = (this.r() - 0.5) * 2 * v; return [c[0] + k, c[1] + k, c[2] + k]; }
  rect(x, y, w, h, c, a) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c, a); }
  rectN(x, y, w, h, c, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, this.vary(c, v)); }
  shade(x, y, f) {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    const i = (y * 16 + x) * 4; this.d[i] *= f; this.d[i + 1] *= f; this.d[i + 2] *= f;
  }
  border(c, a) { for (let i = 0; i < 16; i++) { this.set(i, 0, c, a); this.set(i, 15, c, a); this.set(0, i, c, a); this.set(15, i, c, a); } }
  line(x0, y0, x1, y1, c, th) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      this.set(x, y, c);
      if (th > 1) this.set(x + 1, y, c);
    }
  }
  disc(cx, cy, r, c, v) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) this.set(x, y, v ? this.vary(c, v) : c);
    }
  }
  blobs(n, c, v, rmin, rmax, cond) {
    for (let k = 0; k < n; k++) {
      const cx = 1 + this.r() * 14, cy = 1 + this.r() * 14, r = rmin + this.r() * (rmax - rmin);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r && (!cond || cond(x, y))) this.set(x, y, this.vary(c, v));
      }
    }
  }
  copy(name) { const src = TEX.data[name]; if (src) this.d.set(src); }
  text(str, x, y, c, scale) {
    scale = scale || 1;
    for (const ch of str) {
      const g = FONT3x5[ch];
      if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '1')
        for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) this.set(x + i * scale + a, y + j * scale + b, c);
      x += 4 * scale;
    }
  }
  art(rows, pal) {
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch !== '.' && pal[ch]) this.set(x, y, pal[ch]);
    }
  }
  outline(dark) {
    const a = new Uint8Array(256);
    for (let i = 0; i < 256; i++) a[i] = this.d[i * 4 + 3] > 0 ? 1 : 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (a[y * 16 + x]) continue;
      const n = (x > 0 && a[y * 16 + x - 1]) || (x < 15 && a[y * 16 + x + 1]) || (y > 0 && a[y * 16 + x - 16]) || (y < 15 && a[y * 16 + x + 16]);
      if (n) this.set(x, y, dark || [40, 30, 30]);
    }
  }
}

TEX.data = Object.create(null);
function addTex(name, fn, isItem) {
  const p = new Painter(name);
  fn(p);
  TEX.data[name] = p.d;
  TEX.byName[name] = TEX.list.length;
  TEX.list.push(p.d);
  TEX.isItem.push(!!isItem);
  TEX.names.push(name);
}

// ---------------- 파스텔 색감 (말랑한 장난감 블록 느낌) ----------------
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2rgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const PASTEL_SKIP = /^(end_portal$|nether_portal$|fire$|end_eye$|end_frame_top_eye$|crack_|display_|white$|player_skin$|wire$|gate_|clip$|ic_|needle_|coil_n$|coil_s$|magnet_|redstone_torch|lamp_on|bulb_glass_on|led_glass_on|sci_wire_on)/;
function pastelizeTextures() {
  for (let li = 0; li < TEX.list.length; li++) {
    const name = TEX.names[li], d = TEX.list[li], item = TEX.isItem[li];
    if (PASTEL_SKIP.test(name)) continue;
    let n = 0, mr = 0, mg = 0, mb = 0, opaque = true;
    for (let i = 0; i < 1024; i += 4) { if (d[i + 3] > 0) { mr += d[i]; mg += d[i + 1]; mb += d[i + 2]; n++; } if (d[i + 3] < 255) opaque = false; }
    if (!n) continue;
    mr /= n; mg /= n; mb /= n;
    const smooth = item ? 0.1 : 0.42;
    for (let i = 0; i < 1024; i += 4) {
      if (!d[i + 3]) continue;
      const r = lerp(d[i], mr, smooth), g = lerp(d[i + 1], mg, smooth), b = lerp(d[i + 2], mb, smooth);
      let [h, s, l] = rgb2hsl(r, g, b);
      l = item ? 0.08 + l * 0.88 : 0.2 + l * 0.7;
      s = Math.min(1, s * 0.92 + (s > 0.05 ? 0.07 : 0));
      const o = hsl2rgb(h, s, l);
      d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
    }
    // 둥근 모서리 느낌 (빛받는 윗/왼쪽, 그늘진 아래/오른쪽)
    if (opaque && !item) {
      for (let k = 0; k < 16; k++) {
        const hi = (x, y, f) => { const i = (y * 16 + x) * 4; d[i] = Math.min(255, d[i] * f + 10); d[i + 1] = Math.min(255, d[i + 1] * f + 10); d[i + 2] = Math.min(255, d[i + 2] * f + 10); };
        const lo = (x, y, f) => { const i = (y * 16 + x) * 4; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; };
        hi(k, 0, 1.06); hi(0, k, 1.06); lo(k, 15, 0.86); lo(15, k, 0.86);
      }
    }
  }
}

function buildTextures() {
  const R = (p) => p.r();
  // ---------- 자연 ----------
  addTex('stone', p => { p.noise([126, 126, 126], 10); p.blobs(6, [108, 108, 108], 6, 0.6, 1.3); });
  addTex('smooth_stone', p => { p.noise([160, 160, 160], 5); p.border([120, 120, 120]); });
  addTex('dirt', p => { p.noise([170, 112, 80], 14); p.blobs(7, [110, 78, 52], 8, 0.5, 1.1); p.blobs(3, [150, 112, 80], 6, 0.4, 0.8); });
  addTex('grass_top', p => { p.noise([118, 192, 118], 10); p.blobs(8, [104, 176, 106], 8, 0.4, 0.9); });
  addTex('grass_side', p => {
    p.copy('dirt');
    for (let x = 0; x < 16; x++) {
      const h = 3 + (p.r() * 2.2 | 0);
      for (let y = 0; y < h; y++) p.set(x, y, p.vary([118, 192, 118], 10));
    }
  });
  addTex('snow', p => { p.noise([240, 248, 252], 5); });
  addTex('grass_snow_side', p => {
    p.copy('dirt');
    for (let x = 0; x < 16; x++) { const h = 3 + (p.r() * 2.5 | 0); for (let y = 0; y < h; y++) p.set(x, y, p.vary([240, 246, 250], 5)); }
  });
  addTex('cobblestone', p => {
    p.noise([120, 120, 120], 8);
    // 돌 조각 (보로노이 비슷하게)
    const pts = []; for (let i = 0; i < 9; i++) pts.push([p.r() * 16, p.r() * 16, 95 + p.r() * 50]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let d1 = 1e9, d2 = 1e9, best = 0;
      for (const q of pts) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
        const dx = x - q[0] - ox, dy = y - q[1] - oy, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; best = q[2]; } else if (d < d2) d2 = d;
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1) < 1.1;
      const b = edge ? 70 : best + (p.r() - 0.5) * 14;
      p.set(x, y, [b, b, b]);
    }
  });
  addTex('mossy_cobblestone', p => { p.copy('cobblestone'); p.blobs(7, [80, 125, 50], 12, 0.8, 2); });
  addTex('bedrock', p => { p.noise([80, 80, 80], 30); p.blobs(10, [40, 40, 40], 10, 0.6, 1.8); });
  addTex('sand', p => { p.noise([219, 207, 163], 10); p.blobs(5, [200, 188, 140], 6, 0.4, 0.8); });
  addTex('gravel', p => { p.noise([130, 124, 122], 10); p.blobs(14, [100, 94, 92], 12, 0.6, 1.4); p.blobs(8, [160, 150, 145], 10, 0.5, 1.1); });
  addTex('sandstone', p => { p.noise([216, 203, 155], 6); for (let x = 0; x < 16; x++) { p.set(x, 3, p.vary([195, 180, 130], 5)); p.set(x, 9, p.vary([200, 186, 138], 5)); } });
  addTex('sandstone_top', p => { p.noise([222, 210, 164], 6); });
  addTex('clay', p => { p.noise([160, 166, 179], 6); });
  addTex('ice', p => { p.noise([150, 190, 250], 10, 190); for (let i = 0; i < 4; i++) p.line(2 + i * 3, 2, 5 + i * 3, 12, [200, 225, 255, 200], 1); });
  addTex('obsidian', p => { p.noise([20, 16, 32], 8); p.blobs(8, [50, 30, 80], 10, 0.5, 1.2); });
  addTex('water', p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.vary([70, 170, 230], 10), 200); });
  addTex('lava', p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = p.r(); p.set(x, y, [230 + v * 25, 90 + v * 90, 10 + v * 20]);
    }
    p.blobs(6, [255, 200, 60], 10, 0.8, 1.8);
  });
  const oreBase = (name, col, n) => addTex(name, p => {
    p.copy('stone');
    for (let k = 0; k < n; k++) {
      const cx = 2 + p.r() * 12 | 0, cy = 2 + p.r() * 12 | 0;
      p.set(cx, cy, col); p.set(cx + 1, cy, p.vary(col, 20)); p.set(cx, cy + 1, p.vary(col, 20));
      if (p.r() < 0.5) p.set(cx + 1, cy + 1, [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7]);
    }
  });
  oreBase('coal_ore', [40, 40, 40], 7); oreBase('iron_ore', [216, 175, 147], 6); oreBase('gold_ore', [250, 220, 70], 6);
  oreBase('diamond_ore', [90, 235, 225], 6); oreBase('redstone_ore', [230, 20, 20], 7);
  // ---------- 나무 ----------
  const planks = (name, c) => addTex(name, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.vary(c, 6));
    for (let b = 0; b < 4; b++) {
      for (let x = 0; x < 16; x++) p.set(x, b * 4 + 3, [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72]);
      const seam = (p.r() * 16) | 0; for (let y = b * 4; y < b * 4 + 3; y++) p.set(seam, y, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8]);
      for (let k = 0; k < 3; k++) { const x = p.r() * 16 | 0, y = b * 4 + (p.r() * 3 | 0); p.shade(x, y, 0.88); p.shade(x + 1, y, 0.9); }
    }
  });
  planks('oak_planks', [162, 130, 78]); planks('birch_planks', [196, 179, 123]); planks('spruce_planks', [114, 84, 48]);
  const logSide = (name, c, dark, birch) => addTex(name, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const stripe = (x % 4 === 0 || x % 5 === 2) ? 0.78 : 1;
      p.set(x, y, p.vary([c[0] * stripe, c[1] * stripe, c[2] * stripe], 8));
    }
    if (birch) for (let k = 0; k < 7; k++) { const x = p.r() * 14 | 0, y = p.r() * 16 | 0; p.rect(x, y, 2 + (p.r() * 2 | 0), 1, dark); }
  });
  logSide('oak_log', [104, 83, 50]); logSide('spruce_log', [60, 42, 24]); logSide('birch_log', [220, 220, 210], [50, 50, 45], true);
  const logTop = (name, c, bark) => addTex(name, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const ring = (d | 0) % 2 === 0 ? 1 : 0.86;
      p.set(x, y, p.vary([c[0] * ring, c[1] * ring, c[2] * ring], 5));
    }
    p.border(bark); for (let i = 1; i < 15; i++) { p.set(i, 1, bark); p.set(1, i, bark); p.set(14, i, bark); p.set(i, 14, bark); }
  });
  logTop('oak_log_top', [176, 144, 90], [104, 83, 50]); logTop('spruce_log_top', [130, 98, 60], [60, 42, 24]); logTop('birch_log_top', [206, 190, 140], [220, 220, 210]);
  const leaves = (name, c) => addTex(name, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (p.r() < 0.07) continue;
      const k = p.r() < 0.3 ? 0.75 : 1;
      p.set(x, y, p.vary([c[0] * k, c[1] * k, c[2] * k], 14));
    }
  });
  leaves('oak_leaves', [86, 164, 98]); leaves('birch_leaves', [132, 186, 110]); leaves('spruce_leaves', [70, 132, 104]);
  addTex('glass', p => {
    p.clear(); p.border([210, 230, 240]);
    p.set(3, 3, [255, 255, 255]); p.set(4, 4, [255, 255, 255]); p.set(4, 3, [230, 240, 250]); p.set(11, 10, [240, 250, 255]); p.set(12, 11, [240, 250, 255]);
  });
  addTex('cactus_side', p => {
    p.clear();
    for (let y = 0; y < 16; y++) for (let x = 1; x < 15; x++) p.set(x, y, p.vary(x % 4 === 1 ? [40, 100, 30] : [60, 140, 45], 8));
    for (let k = 0; k < 8; k++) p.set(p.r() < 0.5 ? 1 : 14, p.r() * 16 | 0, [230, 230, 180]);
  });
  addTex('cactus_top', p => { p.clear(); for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) p.set(x, y, p.vary([70, 150, 50], 8)); p.disc(8, 8, 3, [110, 170, 80]); });
  addTex('bricks', p => {
    p.noise([150, 150, 140], 6);
    for (let r = 0; r < 4; r++) for (let b = 0; b < 2; b++) {
      const ox = (r % 2) * 4 + b * 8;
      for (let y = r * 4; y < r * 4 + 3; y++) for (let x = ox; x < ox + 7; x++) p.set(x % 16, y, p.vary([150, 70, 55], 12));
    }
  });
  addTex('stone_bricks', p => {
    p.noise([122, 122, 122], 6);
    for (let r = 0; r < 2; r++) for (let b = 0; b < 2; b++) {
      const ox = (r % 2) * 4 + b * 8;
      for (let y = r * 8; y < r * 8 + 7; y++) for (let x = ox; x < ox + 7; x++) p.set(x % 16, y, p.vary([128, 128, 128], 7));
    }
    for (let x = 0; x < 16; x++) { p.set(x, 7, [80, 80, 80]); p.set(x, 15, [80, 80, 80]); }
  });
  addTex('bookshelf', p => {
    p.copy('oak_planks');
    const cols = [[160, 40, 40], [40, 80, 160], [50, 130, 60], [170, 140, 40], [120, 60, 140], [60, 60, 60]];
    for (let s = 0; s < 2; s++) {
      let x = 1;
      while (x < 15) { const w = 1 + (p.r() * 2 | 0); const c = cols[p.r() * cols.length | 0]; const h = 5 + (p.r() * 2 | 0); p.rectN(x, s * 8 + 8 - h - 1 + 1, w, h - 1, c, 10); x += w + (p.r() < 0.2 ? 1 : 0); }
    }
  });
  addTex('crafting_table_top', p => { p.copy('oak_planks'); p.border([90, 60, 30]); for (let i = 0; i < 16; i++) { p.set(i, 7, [110, 75, 40]); p.set(7, i, [110, 75, 40]); } });
  addTex('crafting_table_side', p => {
    p.copy('oak_planks'); p.rect(0, 0, 16, 3, [110, 75, 40]);
    p.rect(3, 6, 2, 8, [120, 90, 60]); p.rect(2, 5, 4, 2, [150, 150, 150]); // 망치
    p.rect(10, 5, 1, 9, [120, 90, 60]); p.rect(9, 5, 3, 1, [150, 150, 150]); p.rect(11, 6, 2, 2, [150, 150, 150]); // 톱
  });
  addTex('furnace_side', p => { p.copy('cobblestone'); p.rect(0, 0, 16, 2, [100, 100, 100]); });
  addTex('furnace_top', p => { p.noise([110, 110, 110], 8); p.border([90, 90, 90]); });
  const furnFront = (name, lit) => addTex(name, p => {
    p.copy('furnace_side'); p.rect(3, 3, 10, 3, [70, 70, 70]); p.rect(4, 9, 8, 5, [30, 30, 30]);
    if (lit) { for (let x = 4; x < 12; x++) for (let y = 10; y < 14; y++) p.set(x, y, p.r() < 0.5 ? [255, 160, 40] : [255, 220, 90]); }
  });
  furnFront('furnace_front', false); furnFront('furnace_front_lit', true);
  addTex('chest_side', p => { p.noise([160, 110, 50], 8); p.border([80, 50, 20]); for (let x = 0; x < 16; x++) p.set(x, 5, [80, 50, 20]); });
  addTex('chest_front', p => { p.copy('chest_side'); p.rect(7, 4, 2, 4, [200, 200, 200]); p.set(7, 7, [60, 60, 60]); });
  addTex('chest_top', p => { p.noise([160, 110, 50], 8); p.border([80, 50, 20]); });
  addTex('glowstone', p => { p.noise([200, 160, 90], 18); p.blobs(9, [255, 230, 150], 18, 0.8, 1.6); p.blobs(4, [140, 100, 50], 10, 0.4, 0.8); });
  const metal = (name, c, hi) => addTex(name, p => {
    p.noise(c, 5); p.border([c[0] * 0.7, c[1] * 0.7, c[2] * 0.7]);
    for (let i = 1; i < 15; i++) { p.set(i, 1, hi); p.set(1, i, hi); }
  });
  metal('iron_block', [210, 210, 210], [245, 245, 245]); metal('gold_block', [245, 205, 60], [255, 245, 150]);
  metal('diamond_block', [100, 220, 215], [200, 255, 250]); metal('coal_block', [28, 28, 28], [60, 60, 60]);
  addTex('redstone_block', p => { p.noise([175, 25, 15], 12); p.border([120, 10, 5]); for (let i = 2; i < 14; i += 3) { p.set(i, 4, [240, 70, 50]); p.set(i + 1, 10, [240, 70, 50]); } });
  addTex('lapis_block', p => { p.noise([35, 70, 170], 10); });
  addTex('farmland', p => { p.noise([100, 66, 40], 10); for (let y = 1; y < 16; y += 4) for (let x = 0; x < 16; x++) p.set(x, y, [70, 45, 25]); });
  addTex('farmland_wet', p => { p.noise([70, 44, 26], 8); for (let y = 1; y < 16; y += 4) for (let x = 0; x < 16; x++) p.set(x, y, [45, 28, 15]); });
  for (const [n, , c] of DYES) {
    addTex('wool_' + n, p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.vary(c, (x + y) % 3 === 0 ? 14 : 6)); });
    addTex('concrete_' + n, p => { p.noise(c, 3); });
  }
  // ---------- 식물 ----------
  addTex('tallgrass', p => {
    p.clear();
    for (let k = 0; k < 9; k++) {
      let x = 1 + p.r() * 14 | 0; const h = 6 + p.r() * 9 | 0;
      for (let y = 15; y > 15 - h; y--) { p.set(x, y, p.vary([100, 176, 100], 16)); if (p.r() < 0.25) x += p.r() < 0.5 ? -1 : 1; }
    }
  });
  const flower = (name, c, cc) => addTex(name, p => {
    p.clear(); p.line(7, 8, 7, 15, [60, 130, 40], 1); p.set(6, 12, [60, 140, 40]); p.set(8, 11, [60, 140, 40]);
    p.disc(7.5, 5.5, 2.8, c, 10); p.set(7, 5, cc); p.set(8, 5, cc);
  });
  flower('dandelion', [250, 225, 40], [255, 180, 0]); flower('poppy', [220, 30, 30], [40, 20, 10]); flower('blue_orchid', [60, 170, 240], [200, 240, 255]);
  addTex('dead_bush', p => { p.clear(); p.line(7, 15, 7, 8, [120, 80, 40]); p.line(7, 11, 3, 6, [120, 80, 40]); p.line(7, 10, 12, 5, [120, 80, 40]); p.line(4, 7, 3, 3, [110, 75, 35]); });
  addTex('sapling', p => { p.clear(); p.line(7, 15, 7, 8, [100, 70, 40]); p.disc(7.5, 6, 4, [60, 140, 40], 20); p.disc(5, 9, 2, [70, 150, 45], 15); });
  addTex('sugar_cane', p => { p.clear(); for (const x of [3, 8, 12]) for (let y = 0; y < 16; y++) p.set(x, y, y % 5 === 0 ? [140, 190, 90] : p.vary([110, 180, 70], 10)); });
  for (let s = 0; s < 8; s++) addTex('wheat_' + s, p => {
    p.clear(); const h = 3 + s * 1.6 | 0; const col = s < 7 ? [80 + s * 12, 160 - s * 4, 40] : [200, 170, 60];
    for (const x of [2, 5, 8, 11, 13]) for (let y = 15; y > 15 - h; y--) p.set(x + (y % 3 === 0 ? 1 : 0), y, p.vary(col, 12));
    if (s === 7) for (const x of [2, 5, 8, 11, 13]) p.rect(x, 15 - h, 2, 3, [180, 140, 50]);
  });
  addTex('torch', p => { p.clear(); p.rect(7, 6, 2, 10, [120, 90, 50]); p.rect(7, 4, 2, 2, [255, 230, 120]); p.set(7, 3, [255, 255, 200]); p.set(8, 5, [255, 180, 60]); });
  addTex('ladder', p => { p.clear(); p.rect(2, 0, 2, 16, [120, 90, 50]); p.rect(12, 0, 2, 16, [120, 90, 50]); for (let y = 2; y < 16; y += 4) p.rect(2, y, 12, 2, [140, 105, 60]); });
  addTex('door_oak_bottom', p => { p.copy('oak_planks'); p.border([100, 75, 40]); p.rect(3, 3, 4, 10, [140, 110, 65]); p.rect(9, 3, 4, 10, [140, 110, 65]); p.rect(12, 1, 2, 2, [80, 80, 80]); });
  addTex('door_oak_top', p => { p.copy('oak_planks'); p.border([100, 75, 40]); p.rect(3, 3, 4, 5, [0, 0, 0], 0); p.rect(9, 3, 4, 5, [0, 0, 0], 0); });
  addTex('door_iron_bottom', p => { p.noise([200, 200, 200], 6); p.border([140, 140, 140]); for (let y = 3; y < 14; y += 3) p.rect(3, y, 10, 1, [160, 160, 160]); p.rect(12, 1, 2, 2, [90, 90, 90]); });
  addTex('door_iron_top', p => { p.noise([200, 200, 200], 6); p.border([140, 140, 140]); p.rect(3, 3, 10, 6, [0, 0, 0], 0); p.rect(7, 3, 2, 6, [180, 180, 180]); });
  addTex('trapdoor_oak', p => { p.copy('oak_planks'); p.border([100, 75, 40]); p.rect(3, 3, 3, 3, [0, 0, 0], 0); p.rect(10, 3, 3, 3, [0, 0, 0], 0); p.rect(3, 10, 3, 3, [0, 0, 0], 0); p.rect(10, 10, 3, 3, [0, 0, 0], 0); });
  addTex('trapdoor_iron', p => { p.noise([200, 200, 200], 6); p.border([140, 140, 140]); p.rect(4, 4, 8, 8, [170, 170, 170]); });
  addTex('tnt_side', p => { p.noise([200, 40, 30], 10); for (let x = 0; x < 16; x++) for (let y = 5; y < 11; y++) p.set(x, y, [235, 235, 225]); p.text('TNT', 2, 6, [30, 30, 30]); });
  addTex('tnt_top', p => { p.noise([200, 40, 30], 8); p.disc(8, 8, 2.5, [230, 230, 220]); p.set(7, 7, [40, 40, 40]); });
  addTex('tnt_bottom', p => { p.noise([200, 40, 30], 8); });
  // ---------- 전기 회로(레드스톤) ----------
  addTex('wire', p => { p.noise([230, 230, 230], 18); });
  const rtorch = (name, lit) => addTex(name, p => {
    p.clear(); p.rect(7, 6, 2, 10, [120, 90, 50]);
    const c = lit ? [255, 40, 20] : [90, 20, 15];
    p.rect(7, 4, 2, 2, c); p.set(7, 3, lit ? [255, 150, 120] : [70, 20, 15]); p.set(6, 5, c); p.set(9, 5, c);
  });
  rtorch('redstone_torch', true); rtorch('redstone_torch_off', false);
  addTex('lever_handle', p => { p.noise([120, 90, 50], 10); });
  addTex('button', p => { p.noise([150, 150, 150], 8); });
  addTex('lever_icon', p => { p.clear(); p.rect(3, 11, 10, 4, [130, 130, 130]); p.line(7, 11, 11, 3, [130, 95, 55], 2); p.set(11, 2, [100, 70, 40]); }, true);
  addTex('repeater_top', p => {
    p.copy('smooth_stone');
    for (let y = 2; y < 14; y++) p.set(7, y, [160, 30, 20]), p.set(8, y, [160, 30, 20]);
    p.set(6, 3, [160, 30, 20]); p.set(9, 3, [160, 30, 20]); p.set(5, 4, [160, 30, 20]); p.set(10, 4, [160, 30, 20]);
  });
  addTex('comparator_top', p => {
    p.copy('smooth_stone');
    for (let y = 3; y < 13; y++) p.set(7, y, [160, 30, 20]), p.set(8, y, [160, 30, 20]);
    for (let x = 3; x < 13; x++) p.set(x, 9, [160, 30, 20]);
  });
  addTex('repeater_icon', p => { p.clear(); p.rect(1, 8, 14, 6, [160, 160, 160]); p.rect(3, 4, 2, 4, [200, 40, 30]); p.rect(11, 4, 2, 4, [200, 40, 30]); p.rect(3, 10, 10, 1, [180, 30, 20]); }, true);
  addTex('comparator_icon', p => { p.clear(); p.rect(1, 8, 14, 6, [160, 160, 160]); p.rect(3, 4, 2, 4, [200, 40, 30]); p.rect(11, 4, 2, 4, [200, 40, 30]); p.rect(7, 2, 2, 6, [200, 40, 30]); }, true);
  addTex('lamp_off', p => {
    p.noise([110, 70, 40], 8);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) if ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) p.set(x, y, [150, 110, 60]);
    p.border([70, 45, 25]);
  });
  addTex('lamp_on', p => {
    p.noise([250, 210, 120], 10);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) if ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) p.set(x, y, [255, 250, 210]);
    p.border([160, 110, 50]);
  });
  addTex('color_lamp', p => { p.noise([235, 235, 235], 6); for (let y = 1; y < 15; y += 3) for (let x = 0; x < 16; x++) p.set(x, y, [255, 255, 255]); p.border([180, 180, 180]); });
  addTex('piston_side', p => { p.copy('cobblestone'); for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.vary([160, 130, 80], 8)); for (let x = 0; x < 16; x++) p.set(x, 4, [90, 70, 40]); });
  addTex('piston_top', p => { p.copy('oak_planks'); p.border([90, 90, 90]); p.rect(6, 6, 4, 4, [140, 140, 140]); });
  addTex('piston_top_sticky', p => { p.copy('piston_top'); p.blobs(6, [100, 190, 90], 20, 1.2, 2.5, (x, y) => x > 1 && y > 1 && x < 14 && y < 14); });
  addTex('piston_bottom', p => { p.copy('cobblestone'); p.rect(5, 5, 6, 6, [90, 90, 90]); });
  addTex('piston_inner', p => { p.copy('cobblestone'); p.rect(4, 4, 8, 8, [60, 60, 60]); p.rect(6, 6, 4, 4, [150, 150, 150]); });
  addTex('piston_arm', p => { p.noise([160, 130, 80], 8); });
  addTex('note_block', p => {
    p.noise([110, 70, 45], 10); p.border([70, 45, 25]);
    p.rect(9, 3, 1, 8, [30, 20, 10]); p.rect(6, 10, 4, 3, [30, 20, 10]); p.rect(10, 3, 3, 1, [30, 20, 10]); p.rect(12, 4, 1, 2, [30, 20, 10]);
  });
  addTex('observer_front', p => { p.noise([100, 100, 100], 8); p.rect(3, 5, 4, 3, [40, 40, 40]); p.rect(9, 5, 4, 3, [40, 40, 40]); p.rect(4, 11, 8, 2, [60, 60, 60]); p.border([70, 70, 70]); });
  addTex('observer_back', p => { p.noise([100, 100, 100], 8); p.border([70, 70, 70]); p.disc(8, 8, 2.2, [60, 20, 15]); });
  addTex('observer_back_on', p => { p.noise([100, 100, 100], 8); p.border([70, 70, 70]); p.disc(8, 8, 2.2, [255, 40, 20]); });
  addTex('observer_side', p => { p.noise([100, 100, 100], 8); p.border([70, 70, 70]); for (let y = 4; y < 12; y++) p.set(8, y, [160, 30, 20]); p.set(7, 5, [160, 30, 20]); p.set(9, 5, [160, 30, 20]); });
  addTex('observer_top', p => { p.noise([100, 100, 100], 8); p.border([70, 70, 70]); for (let x = 2; x < 14; x++) p.set(x, 8, [90, 90, 90]); });
  addTex('daylight_top', p => { p.noise([190, 210, 230], 6); for (let i = 0; i < 16; i += 5) for (let j = 0; j < 16; j++) { p.set(i, j, [120, 100, 70]); p.set(j, i, [120, 100, 70]); } });
  addTex('daylight_top_inv', p => { p.noise([60, 80, 140], 6); for (let i = 0; i < 16; i += 5) for (let j = 0; j < 16; j++) { p.set(i, j, [120, 100, 70]); p.set(j, i, [120, 100, 70]); } });
  addTex('dispenser_front', p => { p.copy('furnace_side'); p.disc(8, 8, 3.2, [40, 40, 40]); p.disc(8, 8, 1.8, [20, 20, 20]); });
  addTex('dropper_front', p => { p.copy('furnace_side'); p.rect(5, 6, 6, 4, [30, 30, 30]); });
  const rail = (name, curve, rc, powered) => addTex(name, p => {
    p.clear();
    const tie = [110, 80, 45];
    if (!curve) {
      for (let y = 1; y < 16; y += 3) p.rect(2, y, 12, 2, p.vary(tie, 10));
      for (let y = 0; y < 16; y++) { p.set(3, y, rc); p.set(12, y, rc); }
      if (powered) for (let y = 0; y < 16; y++) { p.set(7, y, powered); p.set(8, y, powered); }
    } else {
      for (let k = 0; k < 6; k++) { const a = k / 5 * Math.PI / 2; p.line(Math.round(15 - Math.cos(a) * 12), Math.round(15 - Math.sin(a) * 12), Math.round(15 - Math.cos(a) * 3), Math.round(15 - Math.sin(a) * 3), tie); }
      for (let k = 0; k <= 30; k++) {
        const a = k / 30 * Math.PI / 2;
        p.set(Math.round(15 - Math.cos(a) * 12), Math.round(15 - Math.sin(a) * 12), rc);
        p.set(Math.round(15 - Math.cos(a) * 3.5), Math.round(15 - Math.sin(a) * 3.5), rc);
      }
    }
  });
  rail('rail', false, [160, 160, 160]); rail('rail_curve', true, [160, 160, 160]);
  rail('powered_rail', false, [230, 190, 60], [90, 30, 20]); rail('powered_rail_on', false, [230, 190, 60], [255, 50, 30]);
  rail('detector_rail', false, [150, 150, 150], [110, 30, 20]); rail('detector_rail_on', false, [150, 150, 150], [255, 60, 40]);
  // 논리 게이트 (교육용 확장 블록): 윗면에 이름과 출력 화살표
  const gate = (name, label, on) => addTex(name, p => {
    p.noise(on ? [70, 70, 80] : [55, 55, 62], 4); p.border([35, 35, 40]);
    const w = label.length * 4 - 1; p.text(label, 8 - (w >> 1), 7, on ? [255, 90, 60] : [220, 220, 230]);
    // 출력 방향 화살표 (텍스처 위쪽 = 북 = 기본 출력 방향)
    p.set(7, 1, [255, 60, 40]); p.set(8, 1, [255, 60, 40]); p.set(6, 2, [255, 60, 40]); p.set(9, 2, [255, 60, 40]); p.set(7, 2, [255, 60, 40]); p.set(8, 2, [255, 60, 40]); p.rect(7, 3, 2, 2, [255, 60, 40]);
    if (label !== 'NOT') { p.rect(1, 13, 2, 2, [80, 160, 255]); p.rect(13, 13, 2, 2, [80, 160, 255]); }
    else p.rect(7, 13, 2, 2, [80, 160, 255]);
  });
  for (const g of ['AND', 'OR', 'XOR', 'NOT']) { gate('gate_' + g, g, false); gate('gate_' + g + '_on', g, true); }
  addTex('gate_side', p => { p.noise([55, 55, 62], 4); p.rect(0, 0, 16, 1, [35, 35, 40]); });
  for (let v = 0; v < 16; v++) addTex('display_' + v, p => {
    p.fill([18, 20, 22]); p.border([60, 60, 66]);
    const s = String(v); const col = v === 0 ? [80, 30, 30] : [255, 60 + v * 8, 40];
    if (s.length === 1) p.text(s, 5, 3, col, 2); else { p.text(s[0], 1, 3, col, 2); p.text(s[1], 9, 3, col, 2); }
  });
  addTex('display_side', p => { p.noise([60, 60, 66], 5); p.border([40, 40, 44]); });
  addTex('clock_top', p => {
    p.noise([60, 60, 70], 4); p.border([35, 35, 40]); p.disc(8, 8, 5.5, [220, 220, 200]); p.disc(8, 8, 4.5, [250, 250, 235]);
    p.line(8, 8, 8, 4, [40, 40, 40]); p.line(8, 8, 11, 8, [200, 30, 30]);
  });
  addTex('clock_top_on', p => { p.copy('clock_top'); p.border([255, 60, 40]); });
  addTex('sensor_front', p => { p.noise([60, 70, 80], 5); p.border([35, 40, 45]); p.disc(8, 8, 4, [240, 240, 240]); p.disc(8, 8, 2.2, [40, 120, 220]); p.set(8, 8, [10, 10, 10]); });
  addTex('sensor_front_on', p => { p.copy('sensor_front'); p.disc(8, 8, 2.2, [255, 60, 40]); p.set(8, 8, [10, 10, 10]); });
  addTex('sensor_side', p => { p.noise([60, 70, 80], 5); p.border([35, 40, 45]); });
  addTex('target', p => { p.noise([230, 220, 200], 6); p.disc(8, 8, 7, [200, 40, 40]); p.disc(8, 8, 5, [235, 225, 205]); p.disc(8, 8, 3, [200, 40, 40]); p.disc(8, 8, 1.2, [235, 225, 205]); });
  addTex('slime_block', p => { p.noise([110, 200, 90], 10, 200); p.border([80, 170, 60], 220); p.rect(4, 4, 8, 8, [90, 180, 70], 230); });
  addTex('speaker', p => { p.noise([50, 50, 55], 5); p.disc(8, 8, 6, [30, 30, 32]); p.disc(8, 8, 3, [80, 80, 90]); p.disc(8, 8, 1.2, [160, 160, 170]); p.border([90, 90, 100]); });
  addTex('fan_front', p => { p.noise([150, 160, 170], 5); p.border([90, 95, 100]); p.disc(8, 8, 6.5, [40, 44, 50]); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.5; p.line(8, 8, Math.round(8 + Math.cos(a) * 5.5), Math.round(8 + Math.sin(a) * 5.5), [200, 210, 220], 2); } p.disc(8, 8, 1.5, [120, 120, 130]); });
  addTex('fan_side', p => { p.noise([150, 160, 170], 5); p.border([90, 95, 100]); for (let y = 3; y < 14; y += 3) p.rect(3, y, 10, 1, [110, 115, 120]); });
  addTex('elevator', p => { p.noise([170, 175, 185], 5); p.border([90, 95, 105]); p.rect(6, 3, 4, 2, [60, 200, 90]); p.rect(7, 2, 2, 1, [60, 200, 90]); p.rect(6, 11, 4, 2, [230, 80, 60]); p.rect(7, 13, 2, 1, [230, 80, 60]); });
  addTex('bed_top', p => { p.noise([175, 40, 40], 10); p.rect(1, 1, 14, 5, [240, 240, 235]); p.rect(1, 6, 14, 1, [130, 25, 25]); for (let y = 8; y < 16; y += 3) p.rect(0, y, 16, 1, [150, 30, 30]); });
  addTex('bed_side', p => { p.noise([175, 40, 40], 8); p.rect(0, 9, 16, 7, [150, 110, 60]); p.rect(0, 8, 16, 1, [120, 25, 25]); p.rect(1, 12, 2, 4, [110, 80, 45]); p.rect(13, 12, 2, 4, [110, 80, 45]); });
  addTex('hopper_top', p => { p.noise([72, 72, 78], 6); p.border([40, 40, 44]); p.rect(3, 3, 10, 10, [28, 28, 30]); p.rect(3, 3, 10, 1, [55, 55, 60]); });
  addTex('hopper_side', p => { p.noise([82, 82, 88], 6); p.border([45, 45, 50]); p.rect(0, 5, 16, 1, [50, 50, 56]); });
  const conv = (name, arrow) => addTex(name, p => {
    p.noise([48, 50, 56], 4); for (let y = 0; y < 16; y += 2) p.rect(1, y, 14, 1, [62, 64, 72]);
    for (let k = 0; k < 2; k++) { const oy = 2 + k * 7; p.rect(7, oy, 2, 1, arrow); p.rect(6, oy + 1, 4, 1, arrow); p.rect(5, oy + 2, 6, 1, arrow); p.rect(7, oy + 3, 2, 2, arrow); }
    p.rect(0, 0, 1, 16, [130, 130, 140]); p.rect(15, 0, 1, 16, [130, 130, 140]);
  });
  conv('conveyor_top', [200, 160, 40]); conv('conveyor_top_on', [90, 255, 110]);
  addTex('conveyor_side', p => { p.noise([115, 118, 128], 5); p.rect(0, 0, 16, 3, [48, 50, 56]); p.disc(4, 9, 2.6, [70, 72, 80]); p.disc(12, 9, 2.6, [70, 72, 80]); p.set(4, 9, [30, 30, 30]); p.set(12, 9, [30, 30, 30]); });
  // 균열 단계 0~9
  for (let s = 0; s < 10; s++) addTex('crack_' + s, p => {
    p.clear(); const rnd = mulberry32(99);
    const segs = 6 + s * 7;
    let pts = [[8, 8]];
    for (let k = 0; k < segs; k++) {
      const b = pts[(rnd() * pts.length) | 0];
      const a = rnd() * Math.PI * 2; const nx = clamp(Math.round(b[0] + Math.cos(a) * 2), 0, 15), ny = clamp(Math.round(b[1] + Math.sin(a) * 2), 0, 15);
      p.line(b[0], b[1], nx, ny, [20, 20, 20, 200], 1); pts.push([nx, ny]);
    }
  });
  addTex('white', p => p.fill([255, 255, 255]));
  addTex('player_skin', p => p.fill([255, 255, 255]));

  // ---------- 아이템 ----------
  const it = (name, fn) => addTex(name, p => { p.clear(); fn(p); p.outline(); }, true);
  it('stick', p => { p.line(3, 13, 12, 3, [140, 100, 55], 1); p.line(4, 13, 13, 3, [110, 78, 40], 1); });
  it('coal', p => { p.disc(8, 8.5, 5, [40, 40, 42], 10); p.disc(6.5, 7, 1.5, [90, 90, 95]); });
  it('charcoal', p => { p.disc(8, 8.5, 5, [55, 45, 38], 10); p.disc(6.5, 7, 1.5, [100, 90, 80]); });
  const ingot = (name, c, hi) => it(name, p => {
    for (let y = 6; y < 11; y++) for (let x = 2 + (10 - y); x < 14 - (y - 6) / 2; x++) p.set(x, y, c);
    for (let x = 7; x < 13; x++) p.set(x, 6, hi);
  });
  ingot('iron_ingot', [200, 200, 200], [250, 250, 250]); ingot('gold_ingot', [240, 200, 50], [255, 250, 160]);
  it('diamond', p => { p.art(['......aaaa......', '.....abbbba.....', '....abbccbba....', '...abbccccbba...', '...bbccccccbb...', '....bccccccb....', '.....bccccb.....', '......bccb......', '.......bb.......'].map(r => r), { a: [200, 255, 250], b: [90, 230, 220], c: [40, 180, 170] }); });
  it('redstone', p => { p.blobs(7, [200, 20, 10], 30, 1, 1.8, (x, y) => (x - 8) * (x - 8) + (y - 9) * (y - 9) < 30); p.set(6, 6, [255, 120, 100]); });
  it('apple', p => { p.disc(8, 9.5, 5, [220, 30, 30], 10); p.set(6, 7, [255, 150, 140]); p.line(8, 5, 9, 2, [100, 70, 30]); p.rect(10, 3, 2, 2, [60, 150, 40]); });
  it('bread', p => { for (let y = 7; y < 12; y++) for (let x = 2; x < 14; x++) if ((x - 8) * (x - 8) / 36 + (y - 9.5) * (y - 9.5) / 6.5 < 1) p.set(x, y, p.vary([200, 140, 60], 10)); for (const x of [5, 8, 11]) p.set(x, 8, [240, 200, 120]); });
  it('wheat', p => { for (const x of [5, 7, 9, 11]) p.line(x, 14, x - 1, 3, [210, 180, 70]); p.rect(3, 2, 9, 3, [230, 200, 90]); p.rect(5, 10, 6, 1, [150, 110, 40]); });
  it('seeds', p => { for (let k = 0; k < 6; k++) { const x = 4 + p.r() * 8 | 0, y = 5 + p.r() * 7 | 0; p.set(x, y, [90, 160, 50]); p.set(x + 1, y, [70, 130, 40]); } });
  const meat = (name, c, fat) => it(name, p => { p.disc(8, 8, 5, c, 12); p.disc(9, 9, 2.5, fat); p.line(3, 12, 5, 10, [240, 240, 230]); });
  meat('porkchop', [230, 140, 140], [250, 200, 200]); meat('cooked_porkchop', [180, 110, 60], [220, 170, 110]);
  meat('beef', [200, 50, 50], [240, 200, 190]); meat('steak', [120, 70, 40], [170, 120, 80]);
  meat('chicken', [240, 200, 180], [255, 230, 220]); meat('cooked_chicken', [200, 140, 70], [230, 180, 110]);
  it('rotten_flesh', p => { p.disc(8, 8, 5, [120, 110, 60], 18); p.blobs(3, [80, 100, 40], 10, 1, 1.6); });
  it('gunpowder', p => { p.blobs(10, [100, 100, 100], 30, 0.8, 1.5, (x, y) => (x - 8) * (x - 8) + (y - 9) * (y - 9) < 28); });
  it('bone', p => { p.line(4, 12, 11, 4, [235, 235, 225], 2); p.disc(4, 12.5, 1.6, [235, 235, 225]); p.disc(12, 3.5, 1.6, [235, 235, 225]); });
  it('string', p => { for (let x = 2; x < 14; x++) p.set(x, 8 + Math.round(Math.sin(x) * 2), [240, 240, 240]); });
  it('feather', p => { p.line(4, 13, 12, 3, [240, 240, 240], 2); p.line(4, 13, 6, 11, [180, 180, 180]); });
  it('arrow', p => { p.line(3, 12, 12, 3, [130, 95, 55]); p.rect(11, 2, 3, 3, [160, 160, 160]); p.set(13, 1, [200, 200, 200]); p.rect(2, 11, 2, 3, [240, 240, 240]); p.set(4, 13, [240, 240, 240]); });
  it('bow', p => { for (let k = 0; k <= 20; k++) { const a = -0.3 + k / 20 * 2.2; p.set(Math.round(3 + Math.cos(a) * 9), Math.round(12 - Math.sin(a) * 9), [130, 90, 45]); } p.line(3, 3, 12, 12, [230, 230, 230]); });
  const bucket = (name, fill) => it(name, p => {
    for (let y = 5; y < 14; y++) for (let x = 3 + (y - 5) / 4; x < 13 - (y - 5) / 4; x++) p.set(x | 0, y, [180, 180, 185]);
    p.rect(3, 5, 10, 1, [210, 210, 215]);
    if (fill) p.rect(4, 6, 8, 2, fill);
    p.line(3, 5, 5, 2, [150, 150, 155]); p.line(12, 5, 10, 2, [150, 150, 155]); p.line(5, 2, 10, 2, [150, 150, 155]);
  });
  bucket('bucket', null); bucket('water_bucket', [60, 110, 230]); bucket('lava_bucket', [250, 130, 30]);
  it('flint_and_steel', p => { for (let k = 0; k <= 14; k++) { const a = k / 14 * Math.PI * 1.4 + 0.8; p.set(Math.round(10 + Math.cos(a) * 3.5), Math.round(5 + Math.sin(a) * 3.5), [180, 180, 185]); } p.disc(5, 11, 3, [60, 60, 65], 10); });
  it('slime_ball', p => { p.disc(8, 8, 5, [110, 200, 90], 10); p.disc(6.5, 6.5, 1.5, [190, 250, 170]); });
  it('minecart', p => { p.rect(2, 5, 12, 7, [120, 120, 125]); p.rect(3, 6, 10, 4, [70, 70, 75]); p.disc(5, 13, 1.6, [40, 40, 40]); p.disc(11, 13, 1.6, [40, 40, 40]); });
  it('snowball', p => { p.disc(8, 8, 4.5, [245, 250, 255], 6); });
  it('brick', p => { for (let y = 7; y < 11; y++) for (let x = 3; x < 13; x++) p.set(x, y, p.vary([170, 80, 60], 12)); });
  it('clay_ball', p => { p.disc(8, 8.5, 4.5, [165, 170, 185], 8); });
  it('sugar', p => { p.blobs(8, [245, 245, 245], 10, 0.8, 1.4, (x, y) => (x - 8) * (x - 8) + (y - 9) * (y - 9) < 24); });
  it('paper', p => { p.rect(3, 2, 10, 12, [240, 240, 230]); for (let y = 4; y < 13; y += 2) p.rect(4, y, 8, 1, [200, 200, 190]); });
  it('book', p => { p.rect(3, 2, 10, 12, [130, 60, 40]); p.rect(11, 2, 2, 12, [240, 235, 220]); p.rect(3, 6, 8, 1, [200, 170, 60]); });
  it('egg', p => { for (let y = 3; y < 14; y++) for (let x = 3; x < 13; x++) if ((x - 7.5) * (x - 7.5) / 16 + (y - 8.5) * (y - 8.5) / 25 < 1) p.set(x, y, p.vary([235, 220, 190], 6)); });
  it('door_oak_item', p => { p.rect(4, 1, 8, 14, [160, 125, 75]); p.rect(5, 2, 2, 4, [0, 0, 0], 0); p.rect(9, 2, 2, 4, [0, 0, 0], 0); p.set(10, 9, [60, 60, 60]); });
  it('door_iron_item', p => { p.rect(4, 1, 8, 14, [205, 205, 205]); p.rect(5, 2, 6, 4, [0, 0, 0], 0); p.set(10, 9, [90, 90, 90]); });
  it('builder_remote', p => { p.rect(4, 3, 8, 11, [60, 70, 90]); p.rect(5, 4, 6, 4, [120, 220, 255]); p.disc(6.5, 10.5, 1, [255, 80, 60]); p.disc(9.5, 10.5, 1, [80, 220, 90]); p.line(8, 3, 11, 0, [150, 150, 160]); });
  it('wrench', p => { p.line(4, 12, 10, 6, [170, 175, 185], 2); p.disc(11.5, 4.5, 2.6, [170, 175, 185]); p.rect(11, 3, 2, 2, [0, 0, 0], 0); p.set(12, 2, [0, 0, 0], 0); });
  it('multimeter', p => { p.rect(3, 2, 10, 12, [230, 190, 40]); p.rect(4, 3, 8, 4, [30, 40, 30]); p.text('15', 4, 3, [120, 255, 120]); p.disc(8, 10.5, 2, [60, 60, 60]); p.line(5, 14, 3, 15, [200, 30, 30]); p.line(11, 14, 13, 15, [30, 30, 30]); });
  // 도구 (재질별)
  const MAT = { wood: [[150, 115, 65], [110, 80, 40]], stone: [[140, 140, 140], [95, 95, 95]], iron: [[225, 225, 225], [160, 160, 160]], gold: [[250, 215, 70], [200, 160, 30]], diamond: [[100, 235, 225], [40, 170, 160]] };
  const HANDLE = [120, 85, 45];
  for (const m in MAT) {
    const [c, d] = MAT[m];
    it(m + '_pickaxe', p => {
      p.line(3, 13, 9, 7, HANDLE, 1); p.line(4, 13, 10, 7, [95, 65, 35], 1);
      for (let x = 2; x <= 14; x++) { const y = Math.round(2 + (x - 8.5) * (x - 8.5) / 9); p.set(x, y, c); p.set(x, y + 1, d); }
      p.line(9, 7, 11, 4, HANDLE, 1);
    });
    it(m + '_axe', p => { p.line(3, 13, 11, 5, HANDLE, 1); p.line(4, 13, 12, 5, [95, 65, 35], 1); p.rect(8, 2, 4, 4, c); p.rect(6, 3, 3, 5, c); p.rect(6, 7, 2, 1, d); p.rect(9, 5, 3, 1, d); p.set(12, 2, d); });
    it(m + '_shovel', p => { p.line(3, 13, 9, 7, HANDLE, 1); p.line(4, 13, 10, 7, [95, 65, 35], 1); p.disc(11, 5, 3.2, c); p.set(12, 4, d); p.set(11, 6, d); });
    it(m + '_sword', p => { p.line(5, 10, 13, 2, c, 2); p.line(6, 10, 13, 3, d, 1); p.line(2, 8, 7, 13, [80, 60, 40], 1); p.line(2, 13, 4, 11, HANDLE, 1); p.set(1, 14, d); });
    it(m + '_hoe', p => { p.line(3, 13, 10, 6, HANDLE, 1); p.line(4, 13, 11, 6, [95, 65, 35], 1); p.rect(7, 3, 6, 2, c); p.rect(7, 5, 2, 1, d); });
  }
  if (typeof buildSurvivalTextures === 'function') buildSurvivalTextures();
  if (typeof buildDimTextures === 'function') buildDimTextures();
  if (typeof buildVanillaTextures === 'function') buildVanillaTextures();
  if (typeof buildNatureTextures === 'function') buildNatureTextures();
  if (typeof buildParkourTextures === 'function') buildParkourTextures();
  if (typeof buildMc2Textures === 'function') buildMc2Textures();
  if (typeof buildMc3Textures === 'function') buildMc3Textures();
}
