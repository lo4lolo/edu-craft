'use strict';
// =====================================================================
// 메셔: 청크 → 정점 버퍼 (부드러운 조명 + 앰비언트 오클루전 + 특수 모양)
// 정점 32바이트: pos(3f) uv(2f) info(2u16: layer, flags) light(4u8) tint(4u8)
// flags: 0-2 법선, 3-4 흔들림(1 잎 2 풀 3 물), 5 발광, 7 식물 조명
// =====================================================================
const VSTRIDE = 32;
const PX = 18, PXZ = 324, PH = HEIGHT + 2;
const P_ID = new Uint8Array(PXZ * PH), P_META = new Uint8Array(PXZ * PH), P_LIGHT = new Uint8Array(PXZ * PH);
const pidx = (x, y, z) => (x + 1) + (z + 1) * PX + (y + 1) * PXZ;
const NOFF = [-PXZ, PXZ, -PX, PX, -1, 1];
const TINT_ONE = 170; // 1.0 (셰이더에서 x1.5)

class MeshBuf {
  constructor(cap) {
    this.cap = cap || 2048; this.n = 0;
    this._alloc(this.cap);
  }
  _alloc(cap) {
    const nb = new ArrayBuffer(cap * VSTRIDE);
    if (this.buf) new Uint8Array(nb).set(new Uint8Array(this.buf, 0, this.n * VSTRIDE));
    this.buf = nb; this.cap = cap;
    this.f32 = new Float32Array(nb); this.u16 = new Uint16Array(nb); this.u8 = new Uint8Array(nb);
  }
  reset() { this.n = 0; }
  vert(x, y, z, u, v, layer, flags, sky, blk, ao, top, r, g, b) {
    if (this.n >= this.cap) this._alloc(this.cap * 2);
    const o = this.n * 8;
    const f = this.f32, s = this.u16, c = this.u8;
    f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = u; f[o + 4] = v;
    s[o * 2 + 10] = layer; s[o * 2 + 11] = flags;
    const b8 = o * 4 + 24;
    c[b8] = sky; c[b8 + 1] = blk; c[b8 + 2] = ao; c[b8 + 3] = top;
    c[b8 + 4] = r; c[b8 + 5] = g; c[b8 + 6] = b; c[b8 + 7] = 255;
    this.n++;
  }
  slice() { return new Uint8Array(this.buf.slice(0, this.n * VSTRIDE)); }
}

// ---------- 면 정의 ----------
const FACES = [];
(function initFaces() {
  for (let f = 0; f < 6; f++) {
    const n = [DX[f], DY[f], DZ[f]];
    const axis = f < 2 ? 1 : f < 4 ? 2 : 0;
    const plane = (f & 1) ? 1 : 0;
    const others = [0, 1, 2].filter(a => a !== axis);
    const uA = others[0], vA = others[1];
    let pts = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => { const p = [0, 0, 0]; p[axis] = plane; p[uA] = a; p[vA] = b; return p; });
    const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
    const e2 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) pts = [pts[0], pts[3], pts[2], pts[1]];
    const ao = pts.map(p => {
      const tu = [0, 0, 0], tv = [0, 0, 0]; tu[uA] = p[uA] * 2 - 1; tv[vA] = p[vA] * 2 - 1;
      const toOff = (v) => v[0] + v[2] * PX + v[1] * PXZ;
      return [toOff([n[0] + tu[0], n[1] + tu[1], n[2] + tu[2]]), toOff([n[0] + tv[0], n[1] + tv[1], n[2] + tv[2]]),
        toOff([n[0] + tu[0] + tv[0], n[1] + tu[1] + tv[1], n[2] + tu[2] + tv[2]])];
    });
    FACES.push({ pts, ao, axis, uA, vA, n });
  }
})();
function faceUV(f, x, y, z) {
  switch (f) {
    case 0: return [x, 1 - z]; case 1: return [x, z]; case 2: return [1 - x, 1 - y];
    case 3: return [x, 1 - y]; case 4: return [z, 1 - y]; default: return [1 - z, 1 - y];
  }
}
const FACE_UV = FACES.map((F, f) => F.pts.map(p => faceUV(f, p[0], p[1], p[2])));
const CF_AO = new Float32Array(4), CF_SK = new Float32Array(4), CF_BL = new Float32Array(4);
function rotUV(u, v, r) { switch (r) { case 1: return [v, 1 - u]; case 2: return [1 - u, 1 - v]; case 3: return [1 - v, u]; } return [u, v]; }
const FACING_ROT = [0, 0, 0, 2, 3, 1]; // 2북→0, 5동→1, 3남→2, 4서→3

// ---------- 변환 (모델 회전) ----------
// 수평 회전: 기본 모델은 북(2)을 향함
function xfH(facing) {
  switch (facing) {
    case 5: return p => [1 - p[2], p[1], p[0]];
    case 3: return p => [1 - p[0], p[1], 1 - p[2]];
    case 4: return p => [p[2], p[1], 1 - p[0]];
  }
  return null;
}
// 6방향: 기본 모델은 위(1)를 향함
function xf6(facing) {
  switch (facing) {
    case 0: return p => [p[0], 1 - p[1], 1 - p[2]];
    case 2: return p => [p[0], p[2], 1 - p[1]];
    case 3: return p => [p[0], 1 - p[2], p[1]];
    case 4: return p => [1 - p[1], p[0], p[2]];
    case 5: return p => [p[1], 1 - p[0], p[2]];
  }
  return null;
}
// 부착 방향: 기본 모델은 바닥(0)에 붙음
function xfAttach(a) {
  switch (a) {
    case 1: return p => [p[0], 1 - p[1], 1 - p[2]];
    case 2: return p => [p[0], p[2], p[1]];
    case 3: return p => [1 - p[0], p[2], 1 - p[1]];
    case 4: return p => [p[1], p[2], 1 - p[0]];
    case 5: return p => [1 - p[1], p[2], p[0]];
  }
  return null;
}
function compose(a, b) { if (!a) return b; if (!b) return a; return p => b(a(p)); }
function dirOf(v) {
  const ax = Math.abs(v[0]), ay = Math.abs(v[1]), az = Math.abs(v[2]);
  if (ay >= ax && ay >= az) return v[1] > 0 ? 1 : 0;
  if (az >= ax) return v[2] > 0 ? 3 : 2;
  return v[0] > 0 ? 5 : 4;
}

// ---------- 메시 컨텍스트 ----------
class Mesher {
  constructor() {
    this.bufs = [new MeshBuf(8192), new MeshBuf(4096), new MeshBuf(2048)];
    this.fancyLeaves = true;
  }
  fill(world, c) {
    for (let pz = 0; pz < PX; pz++) for (let px = 0; px < PX; px++) {
      const wx = c.cx * 16 + px - 1, wz = c.cz * 16 + pz - 1;
      const n = world.getChunk(wx >> 4, wz >> 4);
      let di = px + pz * PX;
      P_ID[di] = BL.bedrock; P_LIGHT[di] = 0; P_META[di] = 0;
      const top = di + (PH - 1) * PXZ; P_ID[top] = 0; P_LIGHT[top] = 0xF0; P_META[top] = 0;
      di += PXZ;
      if (!n || n.state < 1) {
        for (let y = 0; y < HEIGHT; y++, di += PXZ) { P_ID[di] = 0; P_META[di] = 0; P_LIGHT[di] = 0xF0; }
        continue;
      }
      let si = (wx & 15) | ((wz & 15) << 4);
      const ids = n.ids, meta = n.meta, light = n.light, lit = n.state >= 2;
      for (let y = 0; y < HEIGHT; y++, di += PXZ, si += 256) {
        P_ID[di] = ids[si]; P_META[di] = meta[si]; P_LIGHT[di] = lit ? light[si] : 0xF0;
      }
    }
  }
  // 청크 메시 생성 → [opaque, cutout, trans] Uint8Array
  build(world, c) {
    this.world = world; this.chunk = c;
    this.fill(world, c);
    for (const b of this.bufs) b.reset();
    this.bx = c.cx * 16; this.bz = c.cz * 16;
    let maxY = 0;
    for (let i = 0; i < 256; i++) if (c.heights[i] > maxY) maxY = c.heights[i];
    // 높이맵은 불투명 블록 기준이므로 유리/횃불 등 투명 블록이 더 위에 있을 수 있음 → 전체 검사하되 빈 층은 건너뜀
    let minY = HEIGHT, maxY2 = -1;
    for (let y = 0; y < HEIGHT; y++) {
      let any = false;
      const base = y << 8;
      for (let i = 0; i < 256; i++) if (c.ids[base + i]) { any = true; break; }
      if (!any) continue;
      if (y < minY) minY = y; maxY2 = y;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const pi = pidx(x, y, z);
        const id = P_ID[pi];
        if (id === 0) continue;
        // (최적화) 여섯 면이 모두 불투명 블록에 막힌 불투명 블록은 그릴 면이 없음 — 땅속 블록 대부분을 바로 건너뜀
        if (IS_OPAQUE[id] && IS_OPAQUE[P_ID[pi + 1]] && IS_OPAQUE[P_ID[pi - 1]] && IS_OPAQUE[P_ID[pi + PX]] && IS_OPAQUE[P_ID[pi - PX]] && IS_OPAQUE[P_ID[pi + PXZ]] && IS_OPAQUE[P_ID[pi - PXZ]]) continue;
        this.block(x, y, z, pi, id, P_META[pi]);
      }
    }
    c.minY = Math.max(0, minY - 1); c.maxY = Math.min(HEIGHT, maxY2 + 2);
    return this.bufs.map(b => b.n ? b.slice() : null);
  }
  biomeTint(x, z) {
    const bi = this.chunk ? this.chunk.biome[(x & 15) | ((z & 15) << 4)] : 7;
    const t = BIOMES[bi] ? BIOMES[bi].grass : [1, 1, 1];
    return [clamp(t[0] / 1.5 * 255, 0, 255) | 0, clamp(t[1] / 1.5 * 255, 0, 255) | 0, clamp(t[2] / 1.5 * 255, 0, 255) | 0];
  }
  block(x, y, z, pi, id, meta) {
    const d = BLOCKS[id]; if (!d) return;
    switch (d.shape) {
      case 'cube': return this.cube(x, y, z, pi, id, meta, d);
      case 'cross': return this.cross(x, y, z, pi, id, meta, d);
      case 'crop': return this.crop(x, y, z, pi, id, meta, d);
      case 'fluid': return this.fluid(x, y, z, pi, id, meta, d);
      case 'wire': return this.wire(x, y, z, pi, id, meta, d);
      case 'rail': return this.rail(x, y, z, pi, id, meta, d);
      case 'none': return;
      default: return this.custom(x, y, z, pi, id, meta, d);
    }
  }
  // ---------- 정육면체 ----------
  cube(x, y, z, pi, id, meta, d) {
    const buf = this.bufs[d.layer];
    const opaque = IS_OPAQUE[id];
    let flags = (d.wave << 3) | (isEmissive(d, meta) ? 32 : 0);
    let tint = null;
    if (d.tint === 'leaves') tint = this.biomeTint(x, z);
    else if (d.tint === 'colorlamp') tint = colorLampTint(meta & 15);
    for (let f = 0; f < 6; f++) {
      const ni = pi + NOFF[f], nid = P_ID[ni];
      if (IS_OPAQUE[nid]) continue;
      if (!opaque && nid === id && !(d.wave === 1 && this.fancyLeaves)) continue;
      const layer = blockTex(d, meta, f);
      let t = tint;
      if (d.tint === 'grasstop') t = f === 1 ? this.biomeTint(x, z) : null;
      this.cubeFace(buf, x, y, z, pi, f, layer, flags | f, t, opaque);
    }
  }
  // (최적화) 면마다 배열을 새로 만들지 않고 미리 만든 배열·UV 표를 씀 — 청크 하나에 면이 수만 개라 GC 가 크게 줄어듦
  cubeFace(buf, x, y, z, pi, f, layer, flags, tint, doAO) {
    const F = FACES[f];
    const fi = pi + NOFF[f];
    const L0 = P_LIGHT[fi];
    const tr = tint ? tint[0] : TINT_ONE, tg = tint ? tint[1] : TINT_ONE, tb = tint ? tint[2] : TINT_ONE;
    const ao = CF_AO, sk = CF_SK, bl = CF_BL;
    for (let k = 0; k < 4; k++) {
      const o = F.ao[k];
      const i1 = pi + o[0], i2 = pi + o[1], i3 = pi + o[2];
      const s1 = IS_OPAQUE[P_ID[i1]], s2 = IS_OPAQUE[P_ID[i2]], s3 = IS_OPAQUE[P_ID[i3]];
      ao[k] = doAO ? (s1 && s2 ? 0 : 3 - s1 - s2 - s3) : 3;
      let ss = L0 >> 4, bb = L0 & 15, cnt = 1;
      if (!s1) { ss += P_LIGHT[i1] >> 4; bb += P_LIGHT[i1] & 15; cnt++; }
      if (!s2) { ss += P_LIGHT[i2] >> 4; bb += P_LIGHT[i2] & 15; cnt++; }
      if (!s3 && !(s1 && s2)) { ss += P_LIGHT[i3] >> 4; bb += P_LIGHT[i3] & 15; cnt++; }
      sk[k] = ss / cnt; bl[k] = bb / cnt;
    }
    const flip = ao[1] + ao[3] > ao[0] + ao[2] ? 1 : 0, uvs = FACE_UV[f];
    for (let j = 0; j < 4; j++) {
      const k = (j + flip) & 3, p = F.pts[k], uv = uvs[k];
      buf.vert(x + p[0], y + p[1], z + p[2], uv[0], uv[1], layer, flags, sk[k] * 17 | 0, bl[k] * 17 | 0, ao[k] * 85, 0, tr, tg, tb);
    }
  }
  // ---------- 일반 상자 (모델) ----------
  // box: [x0,y0,z0,x1,y1,z1] (0~1), texs: 배열(월드 방향) 또는 함수(월드방향)→레이어
  box(buf, x, y, z, pi, bx, texs, o) {
    o = o || {};
    const xf = o.xf;
    const L = o.light !== undefined ? o.light : P_LIGHT[pi];
    const sky = (L >> 4) * 17, blk = (L & 15) * 17;
    const tint = o.tint;
    const tr = tint ? tint[0] : TINT_ONE, tg = tint ? tint[1] : TINT_ONE, tb = tint ? tint[2] : TINT_ONE;
    const baseFlags = o.flags || 0;
    for (let f = 0; f < 6; f++) {
      if (o.mask !== undefined && !(o.mask & (1 << f))) continue;
      const F = FACES[f];
      // 경계면 컬링 (변환 없는 경우만)
      if (!xf && o.cull !== false) {
        const onB = (f === 0 && bx[1] <= 0) || (f === 1 && bx[4] >= 1) || (f === 2 && bx[2] <= 0) || (f === 3 && bx[5] >= 1) || (f === 4 && bx[0] <= 0) || (f === 5 && bx[3] >= 1);
        if (onB && IS_OPAQUE[P_ID[pi + NOFF[f]]]) continue;
      }
      const pts = [], uvs = [];
      for (let k = 0; k < 4; k++) {
        const c = F.pts[k];
        const px = c[0] ? bx[3] : bx[0], py = c[1] ? bx[4] : bx[1], pz = c[2] ? bx[5] : bx[2];
        let uv = faceUV(f, px, py, pz);
        if (o.uvRot && f === 1) uv = rotUV(uv[0], uv[1], o.uvRot);
        if (o.uvOver && o.uvOver[f]) { const r = o.uvOver[f]; uv = [lerp(r[0], r[2], uv[0]), lerp(r[1], r[3], uv[1])]; }
        uvs.push(uv);
        pts.push(xf ? xf([px, py, pz]) : [px, py, pz]);
      }
      let wd = f;
      if (xf) {
        const cx = (bx[0] + bx[3]) / 2, cy = (bx[1] + bx[4]) / 2, cz = (bx[2] + bx[5]) / 2;
        const a = xf([cx, cy, cz]), b = xf([cx + F.n[0] * 0.01, cy + F.n[1] * 0.01, cz + F.n[2] * 0.01]);
        wd = dirOf([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
        // 감김 순서 보정
        const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
        const e2 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
        const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        if (cr[0] * DX[wd] + cr[1] * DY[wd] + cr[2] * DZ[wd] < 0) { let t = pts[1]; pts[1] = pts[3]; pts[3] = t; t = uvs[1]; uvs[1] = uvs[3]; uvs[3] = t; }
      }
      const layer = typeof texs === 'function' ? texs(wd, f) : Array.isArray(texs) ? texs[wd] : texs;
      const flags = baseFlags | wd;
      for (let k = 0; k < 4; k++) {
        const p = pts[k];
        buf.vert(x + p[0], y + p[1], z + p[2], uvs[k][0], uvs[k][1], layer, flags, sky, blk, 255, o.topFlag && p[1] > 0.5 ? 255 : 0, tr, tg, tb);
      }
    }
  }
  quad(buf, x, y, z, pts, uvs, layer, flags, L, top, tint) {
    const sky = (L >> 4) * 17, blk = (L & 15) * 17;
    const tr = tint ? tint[0] : TINT_ONE, tg = tint ? tint[1] : TINT_ONE, tb = tint ? tint[2] : TINT_ONE;
    for (let k = 0; k < 4; k++) buf.vert(x + pts[k][0], y + pts[k][1], z + pts[k][2], uvs[k][0], uvs[k][1], layer, flags, sky, blk, 255, top && pts[k][1] > 0.3 ? 255 : 0, tr, tg, tb);
  }
  // ---------- 풀/꽃 (X자) ----------
  cross(x, y, z, pi, id, meta, d) {
    const buf = this.bufs[1];
    const layer = blockTex(d, meta, 1);
    const tint = d.tint ? this.biomeTint(x, z) : null;
    const L = P_LIGHT[pi];
    let ox = 0, oz = 0;
    if (id === BL.tallgrass) { const h = hashInt(this.bx + x, y, this.bz + z, 7); ox = ((h & 255) / 255 - 0.5) * 0.3; oz = (((h >> 8) & 255) / 255 - 0.5) * 0.3; }
    const a = 0.15 + ox, b = 0.85 + ox, c = 0.15 + oz, e = 0.85 + oz;
    const flags = (d.wave << 3) | 128 | 1 | (isEmissive(d, meta) ? 32 : 0);
    const uvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
    this.quad(buf, x, y, z, [[a, 0, c], [b, 0, e], [b, 1, e], [a, 1, c]], uvs, layer, flags, L, true, tint);
    this.quad(buf, x, y, z, [[a, 0, e], [b, 0, c], [b, 1, c], [a, 1, e]], uvs, layer, flags, L, true, tint);
  }
  crop(x, y, z, pi, id, meta, d) {
    const buf = this.bufs[1];
    const layer = blockTex(d, meta, 1);
    const L = P_LIGHT[pi];
    const flags = (d.wave << 3) | 128 | 1;
    const uvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
    const yb = -1 / 16;
    for (const t of [0.25, 0.75]) {
      this.quad(buf, x, y, z, [[t, yb, 0], [t, yb, 1], [t, 1 + yb, 1], [t, 1 + yb, 0]], uvs, layer, flags, L, true);
      this.quad(buf, x, y, z, [[0, yb, t], [1, yb, t], [1, 1 + yb, t], [0, 1 + yb, t]], uvs, layer, flags, L, true);
    }
  }
  // ---------- 유체 ----------
  fluidHeight(pi, id) {
    if (P_ID[pi + PXZ] === id) return 1;
    const m = P_META[pi];
    if (m === 0 || m >= 8) return 0.875;
    return Math.max(0.12, (8 - m) / 9);
  }
  fluid(x, y, z, pi, id, meta, d) {
    const isWater = id === BL.water;
    const buf = this.bufs[isWater ? 2 : 0];
    const h = this.fluidHeight(pi, id);
    const layer = d.tex[1];
    const flags0 = isWater ? (3 << 3) : 32;
    for (let f = 0; f < 6; f++) {
      const ni = pi + NOFF[f], nid = P_ID[ni];
      if (nid === id) continue;
      if (IS_OPAQUE[nid] && f !== 1) continue;
      if (f === 1 && h >= 1) continue;
      if (isWater && nid === BL.ice) continue;
      const F = FACES[f];
      const L = P_LIGHT[f === 1 ? pi : ni] || P_LIGHT[pi];
      const sky = (L >> 4) * 17, blk = (L & 15) * 17;
      for (let k = 0; k < 4; k++) {
        const c = F.pts[k];
        const py = c[1] ? h : 0;
        const uv = faceUV(f, c[0], py, c[2]);
        buf.vert(x + c[0], y + py, z + c[2], uv[0], uv[1], layer, flags0 | f, sky, blk, 255, (f === 1 || c[1]) && h < 1 ? 255 : 0, TINT_ONE, TINT_ONE, TINT_ONE);
      }
    }
  }
  // ---------- 레드스톤 가루 ----------
  wire(x, y, z, pi, id, meta, d) {
    const buf = this.bufs[1];
    const g = (dx, dy, dz) => P_ID[pi + dx + dz * PX + dy * PXZ];
    const gm = (dx, dy, dz) => P_META[pi + dx + dz * PX + dy * PXZ];
    const conn = wireShape(g, gm);
    const power = meta & 15;
    const tint = wireTint(power);
    const flags = power > 0 ? 32 : 0;
    const layer = d.tex[1];
    const h = 1 / 64;
    const o = { tint, flags, mask: 2, cull: false };
    this.box(buf, x, y, z, pi, [5 / 16, 0, 5 / 16, 11 / 16, h, 11 / 16], layer, o);
    let cnt = 0; for (let k = 2; k < 6; k++) if (conn[k]) cnt++;
    const draw = [0, 0, 0, 0, 0, 0];
    if (cnt === 0) draw[2] = draw[3] = draw[4] = draw[5] = 1;
    else for (let k = 2; k < 6; k++) if (conn[k]) { draw[k] = 1; if (cnt === 1) draw[OPP[k]] = 1; }
    const w0 = 6.5 / 16, w1 = 9.5 / 16;
    if (draw[2]) this.box(buf, x, y, z, pi, [w0, 0, 0, w1, h, 0.5], layer, o);
    if (draw[3]) this.box(buf, x, y, z, pi, [w0, 0, 0.5, w1, h, 1], layer, o);
    if (draw[4]) this.box(buf, x, y, z, pi, [0, 0, w0, 0.5, h, w1], layer, o);
    if (draw[5]) this.box(buf, x, y, z, pi, [0.5, 0, w0, 1, h, w1], layer, o);
    // 벽을 타고 오르는 부분
    const up = { tint, flags, cull: false };
    if (conn[2] === 2) this.box(buf, x, y, z, pi, [w0, 0, 0, w1, 1, h], layer, Object.assign({ mask: 1 << 3 }, up));
    if (conn[3] === 2) this.box(buf, x, y, z, pi, [w0, 0, 1 - h, w1, 1, 1], layer, Object.assign({ mask: 1 << 2 }, up));
    if (conn[4] === 2) this.box(buf, x, y, z, pi, [0, 0, w0, h, 1, w1], layer, Object.assign({ mask: 1 << 5 }, up));
    if (conn[5] === 2) this.box(buf, x, y, z, pi, [1 - h, 0, w0, 1, 1, w1], layer, Object.assign({ mask: 1 << 4 }, up));
  }
  // ---------- 레일 ----------
  rail(x, y, z, pi, id, meta, d) {
    const buf = this.bufs[1];
    const shape = meta & 7 | (id === BL.rail ? meta & 8 : 0);
    const s = id === BL.rail ? (meta & 15) : (meta & 7);
    const layer = blockTex(d, meta, 1);
    const L = P_LIGHT[pi];
    const e = 1 / 16;
    let rot = 0, y0 = [e, e, e, e]; // 모서리 높이: (0,0)(1,0)(1,1)(0,1) → (x,z)
    if (s === 1) rot = 1;
    else if (s === 2) { rot = 1; y0 = [e, 1 + e, 1 + e, e]; }       // 동쪽으로 오름
    else if (s === 3) { rot = 1; y0 = [1 + e, e, e, 1 + e]; }       // 서쪽
    else if (s === 4) { rot = 0; y0 = [1 + e, 1 + e, e, e]; }       // 북쪽
    else if (s === 5) { rot = 0; y0 = [e, e, 1 + e, 1 + e]; }       // 남쪽
    else if (s >= 6) rot = s - 6;
    const cs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const pts = cs.map((c, i) => [c[0], y0[i], c[1]]);
    const uvs = cs.map(c => rotUV(c[0], c[1], rot));
    const flags = 1 | ((d.rs === 'prail' || d.rs === 'drail') && (meta & 8) ? 32 : 0);
    this.quad(buf, x, y, z, pts, uvs, layer, flags, L, false);
  }
  // ---------- 기타 모양 ----------
  custom(x, y, z, pi, id, meta, d) {
    const buf = this.bufs[d.layer];
    const tf = (wd) => blockTex(d, meta, wd);
    const texs = d.texf ? tf : d.tex;
    const flags = isEmissive(d, meta) ? 32 : 0;
    const px = 1 / 16;
    switch (d.shape) {
      case 'slab': return this.box(buf, x, y, z, pi, meta & 1 ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1], texs);
      case 'stairs': for (const b of blockBoxes(id, meta, false)) this.box(buf, x, y, z, pi, b, texs); return;
      case 'cactus':
        this.box(buf, x, y, z, pi, [px, 0, px, 1 - px, 1, 1 - px], texs, { mask: 0b111100 });
        this.box(buf, x, y, z, pi, [0, 0, 0, 1, 1, 1], texs, { mask: 0b11 });
        return;
      case 'chest': return this.box(buf, x, y, z, pi, [px, 0, px, 1 - px, 14 * px, 1 - px], texs);
      case 'farmland': return this.box(buf, x, y, z, pi, [0, 0, 0, 1, 15 * px, 1], texs);
      case 'daylight': return this.box(buf, x, y, z, pi, [0, 0, 0, 1, 6 * px, 1], texs);
      case 'plate': return this.box(buf, x, y, z, pi, [px, 0, px, 1 - px, meta & 8 ? 0.5 * px : px, 1 - px], texs);
      case 'door': return this.box(buf, x, y, z, pi, doorBox(meta), texs, { cull: false });
      case 'trapdoor': return this.box(buf, x, y, z, pi, trapBox(meta), texs, { cull: false });
      case 'ladder': {
        const a = meta & 7;
        const b = wallBox(a, 0, 0, px, 1);
        const mask = a === 2 ? 1 << 3 : a === 3 ? 1 << 2 : a === 4 ? 1 << 5 : 1 << 4;
        return this.box(buf, x, y, z, pi, b, texs, { mask, cull: false });
      }
      case 'fence': {
        this.box(buf, x, y, z, pi, [6 * px, 0, 6 * px, 10 * px, 1, 10 * px], texs);
        const g = (dx, dz) => { const n = P_ID[pi + dx + dz * PX]; return (BLOCKS[n] && BLOCKS[n].shape === 'fence') || IS_OPAQUE[n]; };
        for (const yy of [6, 12]) {
          const y0 = yy * px, y1 = (yy + 3) * px;
          if (g(0, -1)) this.box(buf, x, y, z, pi, [7 * px, y0, 0, 9 * px, y1, 6 * px], texs);
          if (g(0, 1)) this.box(buf, x, y, z, pi, [7 * px, y0, 10 * px, 9 * px, y1, 1], texs);
          if (g(-1, 0)) this.box(buf, x, y, z, pi, [0, y0, 7 * px, 6 * px, y1, 9 * px], texs);
          if (g(1, 0)) this.box(buf, x, y, z, pi, [10 * px, y0, 7 * px, 1, y1, 9 * px], texs);
        }
        return;
      }
      case 'torch': {
        const a = meta & 7;
        const layer = blockTex(d, meta, 1);
        let xf = null;
        if (a >= 2) { const wx = DX[a], wz = DZ[a]; xf = p => [p[0] + wx * (0.375 - p[1] * 0.45), p[1] + 0.2, p[2] + wz * (0.375 - p[1] * 0.45)]; }
        return this.box(buf, x, y, z, pi, [7 * px, 0, 7 * px, 9 * px, 12 * px, 9 * px], layer, { xf, flags: 32, uvOver: { 1: [7 / 16, 4 / 16, 9 / 16, 6 / 16], 0: [7 / 16, 14 / 16, 9 / 16, 1] }, cull: false });
      }
      case 'lever': {
        const at = xfAttach(meta & 7);
        this.box(buf, x, y, z, pi, [5 * px, 0, 4 * px, 11 * px, 3 * px, 12 * px], T('cobblestone'), { xf: at || (p => p) });
        const on = meta & 8 ? -1 : 1;
        const sh = p => [p[0], p[1], p[2] + (p[1] - px) * 0.55 * on];
        return this.box(buf, x, y, z, pi, [7 * px, 1 * px, 7 * px, 9 * px, 10 * px, 9 * px], T('lever_handle'), { xf: compose(sh, at) });
      }
      case 'button': {
        const at = xfAttach(meta & 7);
        const dpt = meta & 8 ? 1 * px : 2 * px;
        return this.box(buf, x, y, z, pi, [5 * px, 0, 6 * px, 11 * px, dpt, 10 * px], texs, { xf: at || (p => p) });
      }
      case 'diode': return this.diode(buf, x, y, z, pi, id, meta, d);
      case 'portal': {
        // 지옥문: 얇은 판. 옆 칸도 지옥문이면 그쪽 면은 안 그림
        const ax = meta & 1, th = 5 * px;
        const same = (o) => P_ID[pi + o] === id;
        let mask = 0;
        if (ax === 0) { mask = (1 << 2) | (1 << 3); if (!same(-1)) mask |= 1 << 4; if (!same(1)) mask |= 1 << 5; if (!same(-PXZ)) mask |= 1; if (!same(PXZ)) mask |= 2; return this.box(buf, x, y, z, pi, [0, 0, 0.5 - th, 1, 1, 0.5 + th], texs, { mask, flags: 32, cull: false }); }
        mask = (1 << 4) | (1 << 5); if (!same(-PX)) mask |= 1 << 2; if (!same(PX)) mask |= 1 << 3; if (!same(-PXZ)) mask |= 1; if (!same(PXZ)) mask |= 2;
        return this.box(buf, x, y, z, pi, [0.5 - th, 0, 0, 0.5 + th, 1, 1], texs, { mask, flags: 32, cull: false });
      }
      case 'endportal': return this.box(buf, x, y, z, pi, [0, 0, 0, 1, 12 * px, 1], texs, { mask: 2, flags: 32 });
      case 'endframe': {
        this.box(buf, x, y, z, pi, [0, 0, 0, 1, 13 * px, 1], texs);
        if (meta & 4) this.box(buf, x, y, z, pi, [4 * px, 13 * px, 4 * px, 12 * px, 16 * px, 12 * px], T('end_eye'), { flags: 32 });
        return;
      }
      case 'egg': {
        this.box(buf, x, y, z, pi, [2 * px, 0, 2 * px, 14 * px, 9 * px, 14 * px], texs);
        this.box(buf, x, y, z, pi, [3 * px, 9 * px, 3 * px, 13 * px, 13 * px, 13 * px], texs);
        return this.box(buf, x, y, z, pi, [5 * px, 13 * px, 5 * px, 11 * px, 16 * px, 11 * px], texs);
      }
      case 'bed': case 'conveyor': {
        const xf = xfH(meta & 7) || (p => p);
        const h = d.shape === 'bed' ? 9 * px : 6 * px;
        return this.box(buf, x, y, z, pi, [0, 0, 0, 1, h, 1], (wd, f) => blockTex(d, meta, f), { xf });
      }
      case 'hopper': {
        this.box(buf, x, y, z, pi, [0, 10 * px, 0, 1, 1, 1], texs);
        this.box(buf, x, y, z, pi, [4 * px, 4 * px, 4 * px, 12 * px, 10 * px, 12 * px], texs);
        const f = meta & 7;
        if (f === 0) return this.box(buf, x, y, z, pi, [6 * px, 0, 6 * px, 10 * px, 4 * px, 10 * px], texs);
        const sp = [6 * px, 4 * px, 0, 10 * px, 8 * px, 4 * px];
        return this.box(buf, x, y, z, pi, sp, texs, { xf: xfH(f) || (p => p) });
      }
      case 'piston': {
        const f = meta & 7, ext = meta & 8;
        const xf = xf6(f) || (p => p);
        const tfx = (wd) => blockTex(d, meta, wd);
        if (!ext) return this.box(buf, x, y, z, pi, [0, 0, 0, 1, 1, 1], tfx, { xf });
        return this.box(buf, x, y, z, pi, [0, 0, 0, 1, 12 * px, 1], tfx, { xf });
      }
      case 'pistonhead': {
        const f = meta & 7;
        const xf = xf6(f) || (p => p);
        this.box(buf, x, y, z, pi, [0, 12 * px, 0, 1, 1, 1], (wd) => blockTex(d, meta, wd), { xf });
        return this.box(buf, x, y, z, pi, [6 * px, -4 * px, 6 * px, 10 * px, 12 * px, 10 * px], T('piston_arm'), { xf, mask: 0b111100 });
      }
    }
    return this.box(buf, x, y, z, pi, [0, 0, 0, 1, 1, 1], texs, { flags });
  }
  diode(buf, x, y, z, pi, id, meta, d) {
    const px = 1 / 16;
    const facing = meta & 7;
    const xf = xfH(facing);
    const tf = (wd, f) => f === 1 ? blockTex(d, meta, 1) : blockTex(d, meta, 2);
    this.box(buf, x, y, z, pi, [0, 0, 0, 1, 2 * px, 1], tf, { xf: xf || (p => p) });
    const torch = (tx, tz, lit) => {
      const layer = T(lit ? 'redstone_torch' : 'redstone_torch_off');
      this.box(buf, x, y, z, pi, [tx * px, 2 * px, tz * px, (tx + 2) * px, 7 * px, (tz + 2) * px], layer,
        { xf: xf || (p => p), flags: lit ? 32 : 0, uvOver: { 1: [7 / 16, 4 / 16, 9 / 16, 6 / 16], 0: [7 / 16, 14 / 16, 9 / 16, 1], 2: [7 / 16, 3 / 16, 9 / 16, 8 / 16], 3: [7 / 16, 3 / 16, 9 / 16, 8 / 16], 4: [7 / 16, 3 / 16, 9 / 16, 8 / 16], 5: [7 / 16, 3 / 16, 9 / 16, 8 / 16] } });
    };
    if (d.rs === 'repeater') {
      const on = !!(meta & 32), delay = (meta >> 3) & 3;
      torch(7, 2, on);
      if (meta & 64) this.box(buf, x, y, z, pi, [2 * px, 2 * px, (6 + delay * 2) * px, 14 * px, 4 * px, (8 + delay * 2) * px], T('bedrock'), { xf: xf || (p => p) });
      else torch(7, 6 + delay * 2, on);
    } else if (d.rs === 'comparator') {
      const on = !!(meta & 16);
      torch(3, 11, on); torch(11, 11, on);
      torch(7, 2, !!(meta & 8));
    } else if (d.rs === 'gate') {
      if (meta & 8) torch(7, 1, true);
    }
  }
}

// 색깔 램프: 전력 → 무지개 색 (0은 회색)
function colorLampTint(p) {
  if (!p) return [60, 60, 64];
  const h = (p - 1) / 14 * 0.8;
  const i = Math.floor(h * 6), f = h * 6 - i, q = 1 - f;
  let r, g, b;
  switch (i % 6) { case 0: r = 1; g = f; b = 0; break; case 1: r = q; g = 1; b = 0; break; case 2: r = 0; g = 1; b = f; break; case 3: r = 0; g = q; b = 1; break; case 4: r = f; g = 0; b = 1; break; default: r = 1; g = 0; b = q; }
  const k = 255 / 1.5;
  return [(0.25 + r * 0.75) * k | 0, (0.25 + g * 0.75) * k | 0, (0.25 + b * 0.75) * k | 0];
}
function wireTint(p) {
  const k = 255 / 1.5;
  return [(0.3 + p / 15 * 0.7) * k | 0, (p > 0 ? 0.03 + p / 15 * 0.12 : 0) * k | 0, 0];
}

// 손에 든 블록/떨어진 블록용 단독 메시 (중심 원점, -0.5~0.5)
const ITEM_MESH_CACHE = new Map();
function meshSingleBlock(mesher, id, meta) {
  const key = id * 256 + meta;
  if (ITEM_MESH_CACHE.has(key)) return ITEM_MESH_CACHE.get(key);
  // 패딩 배열 일부를 비우고 블록 하나만 놓는다 (청크 메시 사이에만 호출)
  const cx = 8, cy = 64, cz = 8;
  for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const i = pidx(cx + dx, cy + dy, cz + dz); P_ID[i] = 0; P_META[i] = 0; P_LIGHT[i] = 0xF0;
  }
  const pi = pidx(cx, cy, cz);
  P_ID[pi] = id; P_META[pi] = meta;
  const saved = mesher.chunk; mesher.chunk = null;
  for (const b of mesher.bufs) b.reset();
  mesher.bx = 0; mesher.bz = 0;
  const d = BLOCKS[id];
  if (d.shape === 'cube') {
    const buf = mesher.bufs[d.layer];
    let tint = d.tint === 'leaves' ? mesher.biomeTint(0, 0) : d.tint === 'colorlamp' ? colorLampTint(meta & 15) : null;
    for (let f = 0; f < 6; f++) mesher.cubeFace(buf, cx, cy, cz, pi, f, blockTex(d, meta, f), (isEmissive(d, meta) ? 32 : 0) | f, d.tint === 'grasstop' && f === 1 ? mesher.biomeTint(0, 0) : tint, false);
  } else mesher.block(cx, cy, cz, pi, id, meta);
  mesher.chunk = saved;
  // 모든 레이어 합쳐서 한 버퍼로, 중심 이동
  const total = mesher.bufs.reduce((s, b) => s + b.n, 0);
  const out = new MeshBuf(Math.max(4, total));
  for (const b of mesher.bufs) {
    for (let v = 0; v < b.n; v++) {
      const o = v * 8;
      const dst = out.n * 8;
      new Uint8Array(out.buf, dst * 4, VSTRIDE).set(new Uint8Array(b.buf, o * 4, VSTRIDE));
      out.f32[dst] -= cx + 0.5; out.f32[dst + 1] -= cy + 0.5; out.f32[dst + 2] -= cz + 0.5;
      out.n++;
    }
  }
  for (const b of mesher.bufs) b.reset();
  const res = { data: out.slice(), count: out.n, gpu: null };
  ITEM_MESH_CACHE.set(key, res);
  return res;
}
