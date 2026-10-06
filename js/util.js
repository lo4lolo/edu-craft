'use strict';
// =====================================================================
// 오푸스 크래프트 - 공용 유틸 (수학, 난수, 노이즈, 행렬)
// 월드 생성에 쓰는 함수는 모든 기기에서 같은 결과가 나오도록
// 사칙연산/floor/sqrt 만 사용한다 (Math.sin 등 금지).
// =====================================================================
const CHUNK = 16, HEIGHT = 128, SEA = 62;
// 방향: 0 아래, 1 위, 2 북(-z), 3 남(+z), 4 서(-x), 5 동(+x)
const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0];
const OPP = [1, 0, 3, 2, 5, 4];
const DIR_NAME = ['아래', '위', '북', '남', '서', '동'];
// 수평 회전 (위에서 볼 때 시계방향): 북→동→남→서
const CW = [0, 1, 5, 4, 2, 3];
const CCW = [0, 1, 4, 5, 3, 2];

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashInt(x, y, z, s) {
  let h = (s | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440670441);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}
function hash01(x, y, z, s) { return hashInt(x, y, z, s) / 4294967296; }
function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------------- Simplex noise (Stefan Gustavson 방식, 시드 가능) ----------------
class Noise {
  constructor(seed) {
    const rnd = mulberry32(seed | 0);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.perm = new Uint8Array(512); this.pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.pm12[i] = this.perm[i] % 12; }
  }
  n2(xin, yin) {
    const F2 = 0.36602540378443865, G2 = 0.21132486540518713;
    const perm = this.perm, pm = this.pm12, g = GRAD3;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1; if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const gi = pm[ii + perm[jj]] * 3; t0 *= t0; n0 = t0 * t0 * (g[gi] * x0 + g[gi + 1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const gi = pm[ii + i1 + perm[jj + j1]] * 3; t1 *= t1; n1 = t1 * t1 * (g[gi] * x1 + g[gi + 1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const gi = pm[ii + 1 + perm[jj + 1]] * 3; t2 *= t2; n2 = t2 * t2 * (g[gi] * x2 + g[gi + 1] * y2); }
    return 70 * (n0 + n1 + n2);
  }
  n3(xin, yin, zin) {
    const F3 = 1 / 3, G3 = 1 / 6;
    const perm = this.perm, pm = this.pm12, g = GRAD3;
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) { const gi = pm[ii + perm[jj + perm[kk]]] * 3; t0 *= t0; n0 = t0 * t0 * (g[gi] * x0 + g[gi + 1] * y0 + g[gi + 2] * z0); }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) { const gi = pm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; t1 *= t1; n1 = t1 * t1 * (g[gi] * x1 + g[gi + 1] * y1 + g[gi + 2] * z1); }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) { const gi = pm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; t2 *= t2; n2 = t2 * t2 * (g[gi] * x2 + g[gi + 1] * y2 + g[gi + 2] * z2); }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) { const gi = pm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; t3 *= t3; n3 = t3 * t3 * (g[gi] * x3 + g[gi + 1] * y3 + g[gi + 2] * z3); }
    return 32 * (n0 + n1 + n2 + n3);
  }
  fbm2(x, y, oct) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n2(x * f, y * f); norm += a; a *= 0.5; f *= 2; }
    return s / norm;
  }
  fbm3(x, y, z, oct) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n3(x * f, y * f, z * f); norm += a; a *= 0.5; f *= 2; }
    return s / norm;
  }
}
const GRAD3 = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);

// ---------------- 4x4 행렬 (열 우선) ----------------
const M4_MUL_TMP = new Float32Array(16);
const M4_RING = { i: 0, a: Array.from({ length: 256 }, () => new Float32Array(16)) };
const M4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  identity(m) { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
    return out;
  },
  ortho(out, l, r, b, t, n, f) {
    out.fill(0);
    out[0] = 2 / (r - l); out[5] = 2 / (t - b); out[10] = -2 / (f - n);
    out[12] = -(r + l) / (r - l); out[13] = -(t + b) / (t - b); out[14] = -(f + n) / (f - n); out[15] = 1;
    return out;
  },
  // (최적화) 곱할 때마다 새 배열을 만들지 않고 미리 만든 임시 배열에 계산 (out 이 a·b 와 같아도 됨)
  mul(out, a, b) {
    const r = M4_MUL_TMP;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      r[i * 4 + j] = s;
    }
    out.set(r); return out;
  },
  // 잠깐 쓰고 버리는 행렬 (돌려 쓰는 256개 중 하나, 내용은 단위 행렬 아님). 몸통·팔다리처럼 바로 쓰고 끝나는 곳에만
  tmp() { const i = M4_RING.i = (M4_RING.i + 1) & 255; return M4_RING.a[i]; },
  copyTmp(src) { const m = M4.tmp(); m.set(src); return m; },
  lookAt(out, eye, center, up) {
    let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  },
  invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },
  translate(out, x, y, z) { M4.identity(out); out[12] = x; out[13] = y; out[14] = z; return out; },
  rotY(out, a) { M4.identity(out); const c = Math.cos(a), s = Math.sin(a); out[0] = c; out[2] = -s; out[8] = s; out[10] = c; return out; },
  rotX(out, a) { M4.identity(out); const c = Math.cos(a), s = Math.sin(a); out[5] = c; out[6] = s; out[9] = -s; out[10] = c; return out; },
  rotZ(out, a) { M4.identity(out); const c = Math.cos(a), s = Math.sin(a); out[0] = c; out[1] = s; out[4] = -s; out[5] = c; return out; },
  transformPoint(m, x, y, z, out) {
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    return out;
  },
};

// 절두체 평면 추출 (viewProj) → 6개 평면 [a,b,c,d]
function frustumPlanes(m, out) {
  // out(평면 6개 배열)을 주면 그 안에 채움 (매 프레임 새 배열 안 만듦)
  const p = out || [];
  let n = 0;
  const r = (a, b, c, d) => { const l = Math.hypot(a, b, c); if (out) { const q = out[n++]; q[0] = a / l; q[1] = b / l; q[2] = c / l; q[3] = d / l; } else p.push([a / l, b / l, c / l, d / l]); };
  r(m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
  r(m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
  r(m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
  r(m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
  r(m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
  r(m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
  return p;
}
function aabbInFrustum(planes, x0, y0, z0, x1, y1, z1) {
  for (const pl of planes) {
    const x = pl[0] > 0 ? x1 : x0, y = pl[1] > 0 ? y1 : y0, z = pl[2] > 0 ? z1 : z0;
    if (pl[0] * x + pl[1] * y + pl[2] * z + pl[3] < 0) return false;
  }
  return true;
}

// 수식 계산기 (블록코딩 입력칸용)
//  숫자, 변수, + - * / % ( ), 비교(< > <= >= == != =), 논리(and or not, && || !, 그리고 또는 아니다),
//  함수 random(a,b)/무작위(a,b), abs, min, max, floor, round, sqrt, sin/cos(도), 목록 [a,b,c][i]
//  처음 볼 때 한 번만 해석해 함수로 만들어 둠 (빌더봇이 빠르게 돌 때 같은 식을 수천 번 계산하므로)
const EXPR_CACHE = new Map();
const EXPR_FN = {
  random: (a, b) => { if (b === undefined) { b = a; a = 1; } const lo = Math.ceil(Math.min(a, b)), hi = Math.floor(Math.max(a, b)); return lo + Math.floor(Math.random() * (hi - lo + 1)); },
  abs: Math.abs, min: Math.min, max: Math.max, floor: Math.floor, round: Math.round, sqrt: (v) => Math.sqrt(Math.max(0, v)),
  sin: (d) => Math.sin(d * Math.PI / 180), cos: (d) => Math.cos(d * Math.PI / 180), pow: Math.pow,
};
EXPR_FN['무작위'] = EXPR_FN.random; EXPR_FN['절댓값'] = EXPR_FN.abs; EXPR_FN['반올림'] = EXPR_FN.round; EXPR_FN['내림'] = EXPR_FN.floor;
function compileExpr(src, raw) {
  const toks = [], re = /\s*("[^"]*"|'[^']*'|\d*\.?\d+|[a-zA-Z가-힣_][a-zA-Z0-9가-힣_]*|<=|>=|==|!=|&&|\|\||[-+*/%()<>=!,\[\]])/y;
  let m; re.lastIndex = 0;
  while (re.lastIndex < src.length && (m = re.exec(src))) toks.push(m[1]);
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const WORD_OR = new Set(['or', '||', '또는']), WORD_AND = new Set(['and', '&&', '그리고']), WORD_NOT = new Set(['not', '!', '아니다']);
  const num = (v) => typeof v === 'number' && isFinite(v) ? v : 0;
  function primary() {
    const t = next();
    if (t === undefined) return () => 0;
    if (t === '(') { const e = or(); if (peek() === ')') i++; return e; }
    if (t === '-') { const e = unary(); return (v) => -e(v); }
    if (t === '[') {
      const items = []; while (peek() !== undefined && peek() !== ']') { items.push(or()); if (peek() === ',') i++; else break; }
      if (peek() === ']') i++;
      if (peek() === '[') { i++; const idx = or(); if (peek() === ']') i++; return (v) => { if (!items.length) return 0; const k = Math.round(num(idx(v))); return items[((k % items.length) + items.length) % items.length](v); }; }
      return items.length ? items[0] : () => 0;
    }
    if (/^\d|^\./.test(t)) { const n = parseFloat(t); return () => n; }
    if (t[0] === '"' || t[0] === "'") { const str = t.slice(1, -1); return () => str; }   // 글자 (block_is("f", "glass") 같은 데에 씀)
    if (/^[a-zA-Z가-힣_]/.test(t)) {
      if (t === 'true' || t === '참' || t === 'True') return () => 1;
      if (t === 'false' || t === '거짓' || t === 'False') return () => 0;
      // 목록 길이: len(목록)
      if (t === 'len' && peek() === '(' && /^[a-zA-Z가-힣_]/.test(toks[i + 1] || '') && toks[i + 2] === ')') { const name = toks[i + 1]; i += 3; return (v) => { const x = v && v[name]; return Array.isArray(x) ? x.length : 0; }; }
      // 목록 항목: 목록[i] (0부터)
      if (peek() === '[' && !EXPR_FN[t]) { i++; const idx = or(); if (peek() === ']') i++; return (v) => { const x = v && v[t]; if (!Array.isArray(x)) return 0; const k = Math.floor(num(idx(v))); const y = x[k]; return typeof y === 'number' || typeof y === 'string' ? y : 0; }; }
      if (peek() === '(' && EXPR_FN[t.toLowerCase ? t.toLowerCase() : t]) {
        i++; const args = [];
        while (peek() !== undefined && peek() !== ')') { args.push(or()); if (peek() === ',') i++; else break; }
        if (peek() === ')') i++;
        const f = EXPR_FN[t.toLowerCase()];
        return (v) => { const r = f(...args.map(a => a(v))); return typeof r === 'string' ? r : num(r); };   // 글자를 돌려주는 함수도 (join, answer)
      }
      return (v) => { const x = v && v[t]; return typeof x === 'number' ? x : typeof x === 'string' ? x : 0; };
    }
    return () => 0;
  }
  function unary() { if (WORD_NOT.has(peek())) { i++; const e = unary(); return (v) => e(v) ? 0 : 1; } if (peek() === '-') { i++; const e = unary(); return (v) => -e(v); } return primary(); }
  function mul() {
    let l = unary();
    while (peek() === '*' || peek() === '/' || peek() === '%') { const op = next(), r = unary(), a = l; l = op === '*' ? (v) => a(v) * r(v) : op === '/' ? (v) => { const d = r(v); return d ? a(v) / d : 0; } : (v) => { const d = r(v); return d ? a(v) % d : 0; }; }
    return l;
  }
  // + : 둘 다 숫자(숫자 모양 글자 포함)면 더하기, 아니면 글자 잇기
  const nOf = (x) => typeof x === 'number' ? x : typeof x === 'string' && /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(x) ? +x : null;
  function add() { let l = mul(); while (peek() === '+' || peek() === '-') { const op = next(), r = mul(), a = l; l = op === '+' ? (v) => { const x = a(v), y = r(v); if (typeof x === 'number' && typeof y === 'number') return x + y; const nx = nOf(x), ny = nOf(y); return nx !== null && ny !== null ? nx + ny : String(x) + String(y); } : (v) => a(v) - r(v); } return l; }
  function cmp() {
    let l = add();
    if (peek() === 'in' && /^[a-zA-Z가-힣_]/.test(toks[i + 1] || '')) { const name = toks[i + 1]; i += 2; const a0 = l; l = (v) => { const x = v && v[name]; const r0 = a0(v); return Array.isArray(x) && x.some(y => (typeof y === 'string' || typeof r0 === 'string') ? String(y) === String(r0) : Math.abs(y - r0) < 1e-9) ? 1 : 0; }; }
    while (['<', '>', '<=', '>=', '==', '!=', '='].includes(peek())) {
      const op = next(), r = add(), a = l;
      l = op === '==' || op === '=' ? (v) => { const x = a(v), y = r(v); return typeof x === 'string' || typeof y === 'string' ? +(String(x) === String(y)) : +(Math.abs(x - y) < 1e-9); } : op === '!=' ? (v) => { const x = a(v), y = r(v); return typeof x === 'string' || typeof y === 'string' ? +(String(x) !== String(y)) : +(x !== y); } : op === '<' ? (v) => +(a(v) < r(v)) : op === '>' ? (v) => +(a(v) > r(v)) : op === '<=' ? (v) => +(a(v) <= r(v)) : op === '>=' ? (v) => +(a(v) >= r(v)) : op === '!=' ? (v) => +(a(v) !== r(v)) : (v) => +(Math.abs(a(v) - r(v)) < 1e-9);
    }
    return l;
  }
  function and() { let l = cmp(); while (WORD_AND.has(peek())) { i++; const r = cmp(), a = l; l = (v) => +(!!a(v) && !!r(v)); } return l; }
  function or() { let l = and(); while (WORD_OR.has(peek())) { i++; const r = and(), a = l; l = (v) => +(!!a(v) || !!r(v)); } return l; }
  try { const f = or(); return raw ? (v) => { try { const r = f(v); return typeof r === 'string' ? r : num(r); } catch (e) { return 0; } } : (v) => { try { return num(f(v)); } catch (e) { return 0; } }; } catch (e) { return () => 0; }
}
function evalExpr(str, vars) {
  const s = String(str);
  let f = EXPR_CACHE.get(s);
  if (!f) { f = compileExpr(s); if (EXPR_CACHE.size > 2000) EXPR_CACHE.clear(); EXPR_CACHE.set(s, f); }
  return f(vars);
}
// 글자 값도 그대로 돌려주는 계산 (말하기·글자 합치기·대답 비교용)
const EXPR_CACHE_RAW = new Map();
function evalExprRaw(str, vars) {
  const s = String(str);
  let f = EXPR_CACHE_RAW.get(s);
  if (!f) { f = compileExpr(s, true); if (EXPR_CACHE_RAW.size > 2000) EXPR_CACHE_RAW.clear(); EXPR_CACHE_RAW.set(s, f); }
  return f(vars);
}

function fmtKey(x, y, z) { return x + ',' + y + ',' + z; }
function parseKey(k) { const a = k.split(','); return [+a[0], +a[1], +a[2]]; }
// 조작 방식: 설정에서 강제할 수 있고, 아니면 주 입력장치로 판단 (터치스크린 노트북은 마우스 조작)
const isTouchDevice = () => {
  try { const f = localStorage.getItem('educraft.control'); if (f === 'touch') return true; if (f === 'mouse') return false; } catch (e) { }
  const mm = (q) => !!(window.matchMedia && matchMedia(q).matches);
  return mm('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mm('(any-pointer: fine)'));
};

// ---------------------------------------------------------------------
// 업데이트 직후 캐시 섞임 자동 복구
// GitHub Pages는 index.html을 약 10분 동안 브라우저에 남겨 둬서, 새로 올린 직후에는
// 예전 index.html + 새 js 파일이 섞여 "○○ is not defined" 오류가 날 수 있어요.
// 필요한 기능이 모두 읽혔는지 확인하고, 빠졌으면 주소에 ?r=시각 을 붙여 한 번만 새로 불러와요.
// ---------------------------------------------------------------------
const REQUIRED_GLOBALS = ['buildSurvivalTextures', 'Survival', 'Game', 'defineDimBlocks', 'defineVanillaBlocks', 'packFile', 'compileExpr', 'defineNatureBlocks', 'PK', 'ACH_LIST', 'CM_LIST'];
function reloadFresh(reason) {
  try {
    if (sessionStorage.getItem('educraft.freshReload') === '1') return false;   // 한 번만
    sessionStorage.setItem('educraft.freshReload', '1');
  } catch (e) { return false; }
  window.__reloadingFresh = true;
  console.warn('파일 버전이 섞여서 새로 불러와요:', reason);
  const u = new URL(location.href); u.searchParams.set('r', Date.now().toString(36));
  location.replace(u.toString());
  return true;
}
document.addEventListener('DOMContentLoaded', () => {
  const missing = REQUIRED_GLOBALS.filter(n => { try { return typeof eval(n) === 'undefined'; } catch (e) { return true; } });
  if (missing.length) reloadFresh('빠진 기능: ' + missing.join(', '));
  else { try { sessionStorage.removeItem('educraft.freshReload'); } catch (e) { } }
});
