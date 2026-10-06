'use strict';
// =====================================================================
// 월드: 청크 저장, 지형 생성, 빛 전파, 예약 틱, 유체/중력
// =====================================================================
let OPACITY, EMIT_STATIC, IS_OPAQUE, IS_SOLIDCUBE, IS_FLUID, IS_REPLACE;
function buildBlockTables() {
  OPACITY = new Uint8Array(256); EMIT_STATIC = new Int8Array(256); IS_OPAQUE = new Uint8Array(256);
  IS_FLUID = new Uint8Array(256); IS_REPLACE = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const d = BLOCKS[i];
    if (!d) { OPACITY[i] = 0; continue; }
    OPACITY[i] = d.opacity; IS_OPAQUE[i] = d.opaque && d.shape === 'cube' ? 1 : 0;
    EMIT_STATIC[i] = typeof d.emit === 'function' ? -1 : d.emit;
    IS_FLUID[i] = d.fluid ? 1 : 0; IS_REPLACE[i] = d.replace ? 1 : 0;
  }
}
const BIOMES = [
  { name: '바다', grass: [0.95, 1.0, 0.95] }, { name: '해변', grass: [1.0, 1.0, 0.9] }, { name: '사막', grass: [1.25, 1.05, 0.62] },
  { name: '설원', grass: [0.8, 0.95, 0.95] }, { name: '숲', grass: [0.82, 0.97, 0.78] }, { name: '산', grass: [0.82, 0.92, 0.86] },
  { name: '눈 덮인 봉우리', grass: [0.8, 0.95, 0.95] }, { name: '평원', grass: [1.02, 1.02, 0.92] }, { name: '자작나무 숲', grass: [0.95, 1.05, 0.85] },
];

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.ids = new Uint8Array(16 * 16 * HEIGHT);
    this.meta = new Uint8Array(16 * 16 * HEIGHT);
    this.light = new Uint8Array(16 * 16 * HEIGHT); // 상위 4비트 하늘빛, 하위 4비트 블록빛
    this.biome = new Uint8Array(256);
    this.heights = new Uint8Array(256);
    this.state = 0;   // 0 없음, 1 생성됨, 2 빛 계산됨
    this.dirty = true; this.mesh = null; this.meshing = false; this.lastMeshed = 0;
  }
}
const CI = (x, y, z) => x | (z << 4) | (y << 8);
const ckey = (cx, cz) => ((cx + 32768) << 16) | ((cz + 32768) & 0xffff);

class World {
  constructor(seed, type, dim) {
    this.seed = seed | 0; this.type = type || 'normal';
    this.dim = dim || 'overworld';    // overworld | nether | end
    this.lootAt = new Map();          // 생성된 보물 상자 "x,y,z" → 보물 표 이름 (처음 열 때 채움)
    this.chunks = new Map();
    this.mods = new Map();      // 청크키 → Map(idx → id | meta<<8)
    this.be = new Map();        // "x,y,z" → 블록 엔티티(상자 등)
    this.tick = 0; this.time = 1000; this.dayLength = 24000;
    this.sched = new Map(); this.schedKeys = new Set();
    this.remote = false;        // 멀티플레이 참가자(시뮬레이션 안 함)
    this.onChange = null;       // (x,y,z,oldId,oldMeta,id,meta,flags)
    this.onScheduled = null;    // (x,y,z,kind)
    this._cc = null;
    const s = this.seed;
    this.nC = new Noise(s + 1); this.nE = new Noise(s + 2); this.nH = new Noise(s + 3); this.nD = new Noise(s + 4);
    this.nM = new Noise(s + 5); this.nR = new Noise(s + 6); this.nT = new Noise(s + 7); this.nW = new Noise(s + 8);
    this.nCave1 = new Noise(s + 9); this.nCave2 = new Noise(s + 10); this.nCave3 = new Noise(s + 11);
    this.lightQ = []; this.lightDirty = new Set();
  }
  // ---------------- 접근 ----------------
  getChunk(cx, cz) {
    const c = this._cc;
    if (c && c.cx === cx && c.cz === cz) return c;
    const r = this.chunks.get(ckey(cx, cz));
    if (r) this._cc = r;
    return r;
  }
  chunkReady(cx, cz) { const c = this.getChunk(cx, cz); return c && c.state >= 2; }
  getBlock(x, y, z) {
    if (y < 0) return BL.bedrock; if (y >= HEIGHT) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.state < 1) return 0;
    return c.ids[(x & 15) | ((z & 15) << 4) | (y << 8)];
  }
  getMeta(x, y, z) {
    if (y < 0 || y >= HEIGHT) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.state < 1) return 0;
    return c.meta[(x & 15) | ((z & 15) << 4) | (y << 8)];
  }
  getLight(x, y, z) {
    if (y >= HEIGHT) return 0xF0; if (y < 0) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.state < 2) return 0xF0;
    return c.light[(x & 15) | ((z & 15) << 4) | (y << 8)];
  }
  isLoadedAt(x, z) { const c = this.getChunk(x >> 4, z >> 4); return !!c && c.state >= 2; }
  heightAt(x, z) { const c = this.getChunk(x >> 4, z >> 4); return c ? c.heights[(x & 15) | ((z & 15) << 4)] : 0; }
  biomeAt(x, z) { const c = this.getChunk(x >> 4, z >> 4); return c ? c.biome[(x & 15) | ((z & 15) << 4)] : 7; }
  // 표면(가장 위의 고체 블록 +1)
  surfaceY(x, z) {
    for (let y = HEIGHT - 1; y > 0; y--) { const id = this.getBlock(x, y, z); if (id && BLOCKS[id].solid) return y + 1; }
    return 1;
  }

  // ---------------- 블록 설정 ----------------
  // flags: 1 기록 안 함, 2 이웃 알림 안 함
  setBlock(x, y, z, id, meta, flags) {
    meta = meta | 0; flags = flags | 0;
    if (y < 0 || y >= HEIGHT) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    const lx = x & 15, lz = z & 15, i = lx | (lz << 4) | (y << 8);
    if (!(flags & 1)) this.recordMod(x >> 4, z >> 4, i, id, meta);
    if (!c || c.state < 1) return false;
    const oid = c.ids[i], om = c.meta[i];
    if (oid === id && om === meta) return false;
    c.ids[i] = id; c.meta[i] = meta;
    // 높이맵
    const hi = lx | (lz << 4);
    if (OPACITY[id] > 0 && y >= c.heights[hi]) c.heights[hi] = y + 1;
    else if (OPACITY[id] === 0 && y === c.heights[hi] - 1) {
      let yy = y; while (yy > 0 && OPACITY[c.ids[lx | (lz << 4) | ((yy - 1) << 8)]] === 0) yy--;
      c.heights[hi] = yy;
    }
    if (c.state >= 2) this.updateLightAt(x, y, z, oid, om, id, meta);
    this.markDirty(x, y, z);
    if (this.onChange) this.onChange(x, y, z, oid, om, id, meta, flags);
    return true;
  }
  setMeta(x, y, z, meta, flags) { return this.setBlock(x, y, z, this.getBlock(x, y, z), meta, flags); }
  recordMod(cx, cz, i, id, meta) {
    const k = ckey(cx, cz);
    let m = this.mods.get(k);
    if (!m) { m = new Map(); this.mods.set(k, m); }
    m.set(i, id | (meta << 8));
  }
  markDirty(x, y, z) {
    const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
    const c = this.getChunk(cx, cz); if (c) { c.dirty = true; c.urgent = true; }
    if (lx === 0) this._dirtyC(cx - 1, cz); else if (lx === 15) this._dirtyC(cx + 1, cz);
    if (lz === 0) this._dirtyC(cx, cz - 1); else if (lz === 15) this._dirtyC(cx, cz + 1);
    if (lx === 0 && lz === 0) this._dirtyC(cx - 1, cz - 1); if (lx === 15 && lz === 0) this._dirtyC(cx + 1, cz - 1);
    if (lx === 0 && lz === 15) this._dirtyC(cx - 1, cz + 1); if (lx === 15 && lz === 15) this._dirtyC(cx + 1, cz + 1);
  }
  _dirtyC(cx, cz) { const c = this.getChunk(cx, cz); if (c) { c.dirty = true; c.urgent = true; } }

  // ---------------- 지형 생성 ----------------
  column(x, z) {
    if (this.type === 'flat') return { h: 4, biome: 7 };
    const cont = this.nC.fbm2(x / 700, z / 700, 4);
    const hills = this.nH.fbm2(x / 90, z / 90, 3);
    const detail = this.nD.n2(x / 24, z / 24);
    let h;
    if (cont < -0.18) {
      h = SEA - 2 + (cont + 0.18) * 60 + hills * 3;
    } else {
      const land = cont + 0.18;
      h = SEA + 1 + land * 22 + hills * (5 + land * 10) + detail * 1.5;
      const m = this.nM.fbm2(x / 350, z / 350, 4);
      if (m > 0.12) {
        const r = 1 - Math.abs(this.nR.fbm2(x / 140, z / 140, 3));
        const mt = (m - 0.12) * 2.2;
        h += mt * mt * (22 + r * r * 42);
      }
    }
    h = Math.floor(h);
    if (h < 4) h = 4; if (h > 122) h = 122;
    const temp = this.nT.fbm2(x / 800, z / 800, 2);
    const hum = this.nW.fbm2(x / 600 + 300, z / 600, 2);
    let biome;
    if (h < SEA - 1 && cont < -0.18) biome = 0;
    else if (h <= SEA + 2 && cont < -0.08) biome = 1;
    else if (h > 100) biome = 6;
    else if (h > 86) biome = 5;
    else if (temp > 0.28 && hum < 0.08) biome = 2;
    else if (temp < -0.3) biome = 3;
    else if (hum > 0.12) biome = temp > 0.1 ? 8 : 4;
    else biome = 7;
    return { h, biome };
  }
  generate(c) {
    if (this.dim === 'nether') return this.genNether(c);
    if (this.dim === 'end') return this.genEnd(c);
    const bx = c.cx * 16, bz = c.cz * 16;
    const ids = c.ids, meta = c.meta;
    if (this.type === 'flat') {
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        ids[CI(x, 0, z)] = BL.bedrock; ids[CI(x, 1, z)] = BL.dirt; ids[CI(x, 2, z)] = BL.dirt; ids[CI(x, 3, z)] = BL.grass;
        c.biome[x | z << 4] = 7;
      }
      this.applyMods(c); c.state = 1; return;
    }
    const cols = new Array(256);
    const rnd = mulberry32(hashInt(c.cx, 0, c.cz, this.seed));
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const col = this.column(bx + x, bz + z); cols[x | z << 4] = col;
      const h = col.h, bi = col.biome;
      c.biome[x | z << 4] = bi;
      const hash = hash01(bx + x, 1, bz + z, this.seed);
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let id = 0;
        if (y === 0 || (y < 4 && hash01(bx + x, y, bz + z, this.seed) < 0.5 - y * 0.12)) id = BL.bedrock;
        else if (y < h - 3) id = BL.stone;
        else if (y < h) {
          if (bi === 2) id = y < h - 2 ? BL.sandstone : BL.sand;
          else if (bi === 1 || bi === 0) id = h < SEA - 6 && hash < 0.3 ? BL.gravel : (bi === 0 && hash > 0.85 ? BL.clay : BL.sand);
          else if (bi === 5 || bi === 6) id = BL.stone;
          else id = BL.dirt;
        } else if (y === h) {
          if (bi === 2 || bi === 1) id = BL.sand;
          else if (bi === 0) id = hash < 0.25 ? BL.gravel : BL.sand;
          else if (bi === 6) id = h > 104 ? BL.snow_block : BL.stone;
          else if (bi === 5) id = h > 94 ? BL.stone : BL.grass;
          else if (bi === 3) id = BL.grass_snow;
          else id = h < SEA ? BL.dirt : BL.grass;
        } else if (y <= SEA) {
          id = (bi === 3 && y === SEA) ? BL.ice : BL.water;
        }
        ids[CI(x, y, z)] = id;
      }
    }
    // 동굴: 4x4x4 격자로 노이즈를 샘플링하고 보간
    this.carveCaves(c, cols);
    // 광석
    // 에듀 크래프트: 아이들이 금방 찾도록 광석을 넉넉하게 (원래보다 1.5~2배, 더 얕게)
    const ores = [[BL.coal_ore, 30, 10, 5, 110], [BL.iron_ore, 22, 7, 5, 76], [BL.gold_ore, 7, 6, 5, 40], [BL.redstone_ore, 12, 6, 4, 28], [BL.diamond_ore, 4, 5, 4, 20]];
    for (const [id, cnt, size, y0, y1] of ores) {
      for (let k = 0; k < cnt; k++) {
        let x = rnd() * 16 | 0, y = y0 + (rnd() * (y1 - y0) | 0), z = rnd() * 16 | 0;
        for (let s = 0; s < size; s++) {
          if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < HEIGHT && ids[CI(x, y, z)] === BL.stone) ids[CI(x, y, z)] = id;
          const d = rnd() * 6 | 0; x += DX[d]; y += DY[d]; z += DZ[d];
        }
      }
    }
    this.extraOres(c, ids, cols);
    if (this.surfaceOres) this.surfaceOres(c, ids, cols);
    // 나무 (이웃 청크 범위까지 고려해 경계에서 잘리지 않게)
    for (let tz = -3; tz < 19; tz++) for (let tx = -3; tx < 19; tx++) {
      const wx = bx + tx, wz = bz + tz;
      const hv = hash01(wx, 7, wz, this.seed);
      if (hv > 0.05) continue;
      const inside = tx >= 0 && tx < 16 && tz >= 0 && tz < 16;
      const col = inside ? cols[tx | tz << 4] : this.column(wx, wz);
      const bi = col.biome;
      const dens = bi === 4 ? 0.05 : bi === 8 ? 0.045 : bi === 3 ? 0.022 : bi === 7 ? 0.012 : bi === 5 ? 0.014 : bi === 2 ? 0.002 : 0;
      if (hv >= dens || col.h < SEA + 1) continue;
      if (inside) { const top = ids[CI(tx, col.h, tz)]; if (top !== BL.grass && top !== BL.grass_snow && top !== BL.dirt) continue; }
      let type = 0; // 0 참나무 1 자작 2 가문비
      if (bi === 3 || bi === 5) type = 2; else if (bi === 8) type = hash01(wx, 9, wz, this.seed) < 0.7 ? 1 : 0; else if (bi === 4) type = hash01(wx, 9, wz, this.seed) < 0.2 ? 1 : 0;
      this.placeTree(c, tx, col.h + 1, tz, type, hashInt(wx, 3, wz, this.seed));
    }
    // 풀, 꽃, 선인장
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const col = cols[x | z << 4], h = col.h, bi = col.biome;
      if (h + 1 >= HEIGHT) continue;
      const top = ids[CI(x, h, z)], above = ids[CI(x, h + 1, z)];
      if (above !== 0) continue;
      const r = hash01(bx + x, 5, bz + z, this.seed);
      if (top === BL.grass) {
        const gd = bi === 7 ? 0.22 : bi === 4 || bi === 8 ? 0.12 : 0.06;
        if (r < gd) ids[CI(x, h + 1, z)] = BL.tallgrass;
        else if (r < gd + 0.012) ids[CI(x, h + 1, z)] = r < gd + 0.006 ? BL.dandelion : BL.poppy;
        else if (r < gd + 0.014 && bi === 4) ids[CI(x, h + 1, z)] = BL.blue_orchid;
      } else if (top === BL.sand && bi === 2) {
        if (r < 0.006 && x > 0 && x < 15 && z > 0 && z < 15) { const ch = 1 + (r * 1000 | 0) % 3; for (let k = 1; k <= ch; k++) ids[CI(x, h + k, z)] = BL.cactus; }
        else if (r < 0.014) ids[CI(x, h + 1, z)] = BL.dead_bush;
      } else if (top === BL.sand && bi === 1 && r < 0.03) {
        // 물가 사탕수수
        let nearWater = false;
        for (let d = 2; d < 6; d++) { const nx = x + DX[d], nz = z + DZ[d]; if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16 && ids[CI(nx, h, nz)] === BL.water) nearWater = true; }
        if (nearWater) { const ch = 1 + (r * 1000 | 0) % 3; for (let k = 1; k <= ch; k++) ids[CI(x, h + k, z)] = BL.sugar_cane; }
      }
    }
    if (this.structures) this.structures(c, cols);
    this.applyMods(c);
    c.state = 1;
  }
  carveCaves(c, cols) {
    const bx = c.cx * 16, bz = c.cz * 16;
    const GX = 5, GY = 33, GZ = 5;
    const g = new Float32Array(GX * GY * GZ);
    for (let gx = 0; gx < GX; gx++) for (let gz = 0; gz < GZ; gz++) for (let gy = 0; gy < GY; gy++) {
      const x = bx + gx * 4, y = gy * 4, z = bz + gz * 4;
      const a = this.nCave1.n3(x / 44, y / 28, z / 44), b = this.nCave2.n3(x / 44, y / 28, z / 44);
      let v = a * a + b * b; // 작을수록 동굴 (터널)
      const ch = this.nCave3.n3(x / 90, y / 45, z / 90);
      if (ch > 0.5) v -= (ch - 0.5) * 0.3; // 큰 동굴방
      g[(gx * GZ + gz) * GY + gy] = v;
    }
    const ids = c.ids;
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const col = cols[x | z << 4];
      const top = col.h < SEA + 2 ? col.h - 5 : col.h;
      const gx = x >> 2, fx = (x & 3) / 4, gz = z >> 2, fz = (z & 3) / 4;
      for (let y = 1; y <= top && y < 124; y++) {
        const gy = y >> 2, fy = (y & 3) / 4;
        const i000 = (gx * GZ + gz) * GY + gy, i100 = ((gx + 1) * GZ + gz) * GY + gy, i010 = (gx * GZ + gz + 1) * GY + gy, i110 = ((gx + 1) * GZ + gz + 1) * GY + gy;
        const v0 = lerp(lerp(g[i000], g[i100], fx), lerp(g[i010], g[i110], fx), fz);
        const v1 = lerp(lerp(g[i000 + 1], g[i100 + 1], fx), lerp(g[i010 + 1], g[i110 + 1], fx), fz);
        const v = lerp(v0, v1, fy);
        if (v < 0.011) {
          const i = CI(x, y, z), id = ids[i];
          if (id === BL.bedrock || id === BL.water || id === BL.ice) continue;
          if (y + 1 < HEIGHT && (ids[i + 256] === BL.water)) continue;
          ids[i] = y <= 10 ? BL.lava : 0;
          // 동굴 천장에 노출된 잔디 아래 흙 처리
          if (y === col.h && ids[i + 256] === 0) { /* 표면 구멍 */ }
        }
      }
    }
  }
  placeTree(c, tx, ty, tz, type, h) {
    const rnd = mulberry32(h);
    const ids = c.ids, meta = c.meta;
    const put = (x, y, z, id, force) => {
      if (x < 0 || x > 15 || z < 0 || z > 15 || y < 1 || y >= HEIGHT) return;
      const i = CI(x, y, z), cur = ids[i];
      if (cur === 0 || cur === BL.tallgrass || (force && (cur === BL.oak_leaves || cur === BL.birch_leaves || cur === BL.spruce_leaves))) { ids[i] = id; meta[i] = 0; }
    };
    if (type === 2) {
      const th = 6 + (rnd() * 4 | 0);
      let r = 0;
      for (let y = ty + th; y >= ty + 2; y--) {
        const rr = y === ty + th ? 0 : (r = r >= 2 ? 1 : r + 1);
        for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
          if (Math.abs(dx) === rr && Math.abs(dz) === rr && rr > 0) continue;
          put(tx + dx, y, tz + dz, BL.spruce_leaves);
        }
      }
      put(tx, ty + th + 1, tz, BL.spruce_leaves);
      for (let y = 0; y < th; y++) put(tx, ty + y, tz, BL.spruce_log, true);
      if (tx >= 0 && tx < 16 && tz >= 0 && tz < 16 && ty > 0) { const i = CI(tx, ty - 1, tz); if (ids[i] === BL.grass || ids[i] === BL.grass_snow) ids[i] = BL.dirt; }
      return;
    }
    const logId = type === 1 ? BL.birch_log : BL.oak_log, leafId = type === 1 ? BL.birch_leaves : BL.oak_leaves;
    const th = (type === 1 ? 5 : 4) + (rnd() * 3 | 0);
    for (let y = ty + th - 3; y <= ty + th; y++) {
      const rr = y >= ty + th - 1 ? 1 : 2;
      for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
        if (Math.abs(dx) === rr && Math.abs(dz) === rr && (y === ty + th || rnd() < 0.5)) continue;
        put(tx + dx, y, tz + dz, leafId);
      }
    }
    for (let y = 0; y < th; y++) put(tx, ty + y, tz, logId, true);
    if (tx >= 0 && tx < 16 && tz >= 0 && tz < 16 && ty > 0) { const i = CI(tx, ty - 1, tz); if (ids[i] === BL.grass) ids[i] = BL.dirt; }
  }
  // 게임 중 묘목 성장
  growTree(x, y, z) {
    const rnd = mulberry32(hashInt(x, y, z, this.tick));
    const type = rnd() < 0.25 ? 1 : 0;
    const logId = type === 1 ? BL.birch_log : BL.oak_log, leafId = type === 1 ? BL.birch_leaves : BL.oak_leaves;
    const th = 4 + (rnd() * 3 | 0);
    for (let k = 1; k <= th + 1; k++) { const id = this.getBlock(x, y + k, z); if (id && !BLOCKS[id].replace && !BLOCKS[id].wave) return false; }
    for (let yy = y + th - 3; yy <= y + th; yy++) {
      const rr = yy >= y + th - 1 ? 1 : 2;
      for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
        if (Math.abs(dx) === rr && Math.abs(dz) === rr && (yy === y + th || rnd() < 0.5)) continue;
        const id = this.getBlock(x + dx, yy, z + dz); if (id === 0 || BLOCKS[id].replace) this.setBlock(x + dx, yy, z + dz, leafId, 0);
      }
    }
    for (let k = 0; k < th; k++) this.setBlock(x, y + k, z, logId, 0);
    return true;
  }
  applyMods(c) {
    const m = this.mods.get(ckey(c.cx, c.cz));
    if (!m) return;
    for (const [i, v] of m) { c.ids[i] = v & 255; c.meta[i] = (v >> 8) & 255; }
  }

  // ---------------- 빛 ----------------
  initLight(c, sliced) {
    const ids = c.ids, light = c.light;
    light.fill(0);
    const skyQ = [], blkQ = [];
    const bx = c.cx * 16, bz = c.cz * 16;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let y = HEIGHT - 1;
      while (y >= 0 && OPACITY[ids[x | z << 4 | y << 8]] === 0) { light[x | z << 4 | y << 8] = 0xF0; y--; }
      c.heights[x | z << 4] = y + 1;
    }
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const h = c.heights[x | z << 4];
      let maxN = h;
      for (let d = 2; d < 6; d++) {
        const nx = x + DX[d], nz = z + DZ[d];
        let nh;
        if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16) nh = c.heights[nx | nz << 4];
        else {
          const nc = this.getChunk(c.cx + (nx >> 4), c.cz + (nz >> 4));
          if (!nc || nc.state < 2) continue;
          nh = nc.heights[(nx & 15) | ((nz & 15) << 4)];
        }
        if (nh > maxN) maxN = nh;
      }
      for (let y = h; y < maxN && y < HEIGHT; y++) skyQ.push(bx + x, y, bz + z);
      if (h < HEIGHT && h > 0) skyQ.push(bx + x, h, bz + z);
    }
    // 발광 블록
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]; if (!id) continue;
      let e = EMIT_STATIC[id]; if (e === -1) e = blockEmit(id, c.meta[i]);
      if (e > 0) { light[i] = (light[i] & 0xF0) | e; blkQ.push(bx + (i & 15), i >> 8, bz + ((i >> 4) & 15)); }
    }
    c.state = 2;
    // 이미 빛이 계산된 이웃 청크의 경계에서 빛을 끌어옴
    for (let d = 2; d < 6; d++) {
      const n = this.getChunk(c.cx + DX[d], c.cz + DZ[d]);
      if (!n || n.state < 2) continue;
      for (let y = 0; y < HEIGHT; y++) for (let k = 0; k < 16; k++) {
        let lx, lz;
        if (d === 2) { lx = k; lz = 15; } else if (d === 3) { lx = k; lz = 0; } else if (d === 4) { lx = 15; lz = k; } else { lx = 0; lz = k; }
        const L = n.light[lx | lz << 4 | y << 8];
        const wx = n.cx * 16 + lx, wz = n.cz * 16 + lz;
        if (L >> 4 > 1) skyQ.push(wx, y, wz);
        if ((L & 15) > 1) blkQ.push(wx, y, wz);
      }
    }
    c.dirty = true;
    // sliced: 빛 퍼뜨리기를 여러 프레임에 나눠서 (continueLight). 끝날 때까지 이 청크와 이웃은 메시를 안 만듦
    if (sliced) { c._lightJob = { q: [skyQ, blkQ], k: 0, i: 0 }; return; }
    this.propagate(skyQ, 0);
    this.propagate(blkQ, 1);
  }
  // 나눠 하는 빛 퍼뜨리기를 tEnd(performance.now 기준)까지 이어서 함. 다 끝나면 true
  continueLight(c, tEnd) {
    const J = c._lightJob; if (!J) return true;
    while (J.k < 2) {
      const r = this.propagate(J.q[J.k], J.k, tEnd, J.i);
      if (r >= 0) { J.i = r; return false; }
      J.k++; J.i = 0;
    }
    c._lightJob = null; c.dirty = true;
    return true;
  }
  _lget(x, y, z, ch) {
    const c = this.getChunk(x >> 4, z >> 4); if (!c || c.state < 2) return -1;
    const L = c.light[(x & 15) | ((z & 15) << 4) | (y << 8)];
    return ch === 0 ? L >> 4 : L & 15;
  }
  _lset(x, y, z, ch, v) {
    const c = this.getChunk(x >> 4, z >> 4); if (!c || c.state < 2) return;
    const i = (x & 15) | ((z & 15) << 4) | (y << 8);
    c.light[i] = ch === 0 ? (c.light[i] & 15) | (v << 4) : (c.light[i] & 0xF0) | v;
    this.markDirty(x, y, z);
  }
  // tEnd 를 주면 시간이 다 됐을 때 멈추고 이어서 할 위치를 돌려줌 (다 끝나면 -1)
  propagate(q, ch, tEnd, start) {
    let i = start || 0, n = 0;
    while (i < q.length) {
      if (tEnd && (++n & 511) === 0 && performance.now() > tEnd) return i;
      const x = q[i++], y = q[i++], z = q[i++];
      const c = this.getChunk(x >> 4, z >> 4); if (!c || c.state < 2) continue;
      const L0 = c.light[(x & 15) | ((z & 15) << 4) | (y << 8)];
      const L = ch === 0 ? L0 >> 4 : L0 & 15;
      if (L <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const ny = y + DY[d]; if (ny < 0 || ny >= HEIGHT) continue;
        const nx = x + DX[d], nz = z + DZ[d];
        const nc = (nx >> 4 === c.cx && nz >> 4 === c.cz) ? c : this.getChunk(nx >> 4, nz >> 4);
        if (!nc || nc.state < 2) continue;
        const ni = (nx & 15) | ((nz & 15) << 4) | (ny << 8);
        const op = OPACITY[nc.ids[ni]];
        if (op >= 15) continue;
        let nl = L - (op > 1 ? op : 1);
        if (ch === 0 && d === 0 && L === 15 && op === 0) nl = 15;
        const cur = ch === 0 ? nc.light[ni] >> 4 : nc.light[ni] & 15;
        if (cur < nl) {
          nc.light[ni] = ch === 0 ? (nc.light[ni] & 15) | (nl << 4) : (nc.light[ni] & 0xF0) | nl;
          q.push(nx, ny, nz);
          this.markLightDirty(nc, nx & 15, nz & 15);
        }
      }
      if (i > 3000000) { q.length = 0; break; }
    }
    return -1;
  }
  markLightDirty(c, lx, lz) {
    c.dirty = true;
    if (lx === 0) this._dirtyL(c.cx - 1, c.cz); else if (lx === 15) this._dirtyL(c.cx + 1, c.cz);
    if (lz === 0) this._dirtyL(c.cx, c.cz - 1); else if (lz === 15) this._dirtyL(c.cx, c.cz + 1);
  }
  _dirtyL(cx, cz) { const c = this.getChunk(cx, cz); if (c) c.dirty = true; }
  removeLight(rq, ch) {
    const addQ = [];
    let i = 0;
    while (i < rq.length) {
      const x = rq[i++], y = rq[i++], z = rq[i++], L = rq[i++];
      for (let d = 0; d < 6; d++) {
        const ny = y + DY[d]; if (ny < 0 || ny >= HEIGHT) continue;
        const nx = x + DX[d], nz = z + DZ[d];
        const nl = this._lget(nx, ny, nz, ch);
        if (nl <= 0) continue;
        if (nl < L || (ch === 0 && d === 0 && L === 15 && nl === 15)) {
          this._lset(nx, ny, nz, ch, 0);
          rq.push(nx, ny, nz, nl);
          if (ch === 1) {
            const id = this.getBlock(nx, ny, nz); const e = blockEmit(id, this.getMeta(nx, ny, nz));
            if (e > 0) { this._lset(nx, ny, nz, 1, e); addQ.push(nx, ny, nz); }
          }
        } else addQ.push(nx, ny, nz);
      }
      if (i > 2000000) break;
    }
    this.propagate(addQ, ch);
  }
  updateLightAt(x, y, z, oid, om, id, meta) {
    const oldOp = OPACITY[oid], newOp = OPACITY[id];
    const oldE = blockEmit(oid, om), newE = blockEmit(id, meta);
    // 블록빛
    if (newOp > oldOp || newE < oldE) {
      const cur = this._lget(x, y, z, 1);
      if (cur > 0) { this._lset(x, y, z, 1, 0); this.removeLight([x, y, z, cur], 1); }
    }
    if (newE > 0 && this._lget(x, y, z, 1) < newE) { this._lset(x, y, z, 1, newE); this.propagate([x, y, z], 1); }
    // 하늘빛
    if (newOp > oldOp) {
      const cur = this._lget(x, y, z, 0);
      if (cur > 0) { this._lset(x, y, z, 0, 0); this.removeLight([x, y, z, cur], 0); }
    }
    if (newOp < oldOp) {
      const qs = [], qb = [];
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (ny < 0) continue;
        if (ny >= HEIGHT) { this._lset(x, y, z, 0, 15); qs.push(x, y, z); continue; }
        if (this._lget(nx, ny, nz, 0) > 0) qs.push(nx, ny, nz);
        if (this._lget(nx, ny, nz, 1) > 0) qb.push(nx, ny, nz);
      }
      this.propagate(qs, 0); this.propagate(qb, 1);
    }
  }

  // ---------------- 예약 틱 ----------------
  schedule(x, y, z, delay, kind) {
    const k = x + ',' + y + ',' + z + ',' + kind;
    if (this.schedKeys.has(k)) return;
    this.schedKeys.add(k);
    const t = this.tick + Math.max(1, delay | 0);
    let arr = this.sched.get(t); if (!arr) { arr = []; this.sched.set(t, arr); }
    arr.push(x, y, z, kind);
  }
  isScheduled(x, y, z, kind) { return this.schedKeys.has(x + ',' + y + ',' + z + ',' + kind); }
  runScheduled() {
    const arr = this.sched.get(this.tick);
    if (!arr) return;
    this.sched.delete(this.tick);
    for (let i = 0; i < arr.length; i += 4) {
      const x = arr[i], y = arr[i + 1], z = arr[i + 2], kind = arr[i + 3];
      this.schedKeys.delete(x + ',' + y + ',' + z + ',' + kind);
      if (!this.isLoadedAt(x, z)) continue;
      if (kind === 0) this.fluidTick(x, y, z);
      else if (kind === 2) this.gravityTick(x, y, z);
      else if (kind === 3) { if (this.getBlock(x, y, z) === BL.fire && this.getBlock(x, y - 1, z) !== BL.netherrack && this.getBlock(x, y - 1, z) !== BL.magma_block) this.setBlock(x, y, z, 0, 0); }
      else if (this.onScheduled) this.onScheduled(x, y, z, kind);
    }
  }

  // ---------------- 유체 ----------------
  fluidTick(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (id !== BL.water && id !== BL.lava) return;
    const meta = this.getMeta(x, y, z);
    const isW = id === BL.water, step = isW ? 1 : 2, other = isW ? BL.lava : BL.water;
    // 용암-물 반응
    if (!isW) {
      for (let d = 1; d < 6; d++) {
        if (this.getBlock(x + DX[d], y + DY[d], z + DZ[d]) === BL.water) {
          this.setBlock(x, y, z, meta === 0 ? BL.obsidian : BL.cobblestone, 0); return;
        }
      }
    }
    if (meta !== 0) {
      let nm;
      if (this.getBlock(x, y + 1, z) === id) nm = 8;
      else {
        let min = 99, sources = 0;
        for (let d = 2; d < 6; d++) {
          const nx = x + DX[d], nz = z + DZ[d];
          if (this.getBlock(nx, y, nz) === id) {
            const m = this.getMeta(nx, y, nz); const lv = m >= 8 ? 0 : m;
            if (m === 0) sources++;
            if (lv < min) min = lv;
          }
        }
        nm = min + step; if (nm >= 8) nm = -1;
        if (isW && sources >= 2) { const b = this.getBlock(x, y - 1, z); if ((b && BLOCKS[b].solid) || (b === BL.water && this.getMeta(x, y - 1, z) === 0)) nm = 0; }
      }
      if (nm !== meta) {
        if (nm < 0) { this.setBlock(x, y, z, 0, 0); return; }
        this.setBlock(x, y, z, id, nm);
      }
    }
    const m = this.getMeta(x, y, z);
    const below = this.getBlock(x, y - 1, z);
    if (y > 0 && this.canFlowInto(below, x, y - 1, z, id, 8)) {
      if (below === other) { this.setBlock(x, y - 1, z, isW ? (this.getMeta(x, y - 1, z) === 0 ? BL.obsidian : BL.cobblestone) : BL.stone, 0); return; }
      this.dropReplaced(x, y - 1, z, below);
      this.setBlock(x, y - 1, z, id, 8);
      if (m !== 0) return;
    }
    const lv = m >= 8 ? 0 : m;
    const nl = lv + step;
    if (nl >= 8) return;
    if (below === id && m !== 0) return;
    for (let d = 2; d < 6; d++) {
      const nx = x + DX[d], nz = z + DZ[d];
      const nb = this.getBlock(nx, y, nz);
      if (this.canFlowInto(nb, nx, y, nz, id, nl)) {
        if (nb === other) { this.setBlock(nx, y, nz, isW ? BL.cobblestone : BL.cobblestone, 0); continue; }
        this.dropReplaced(nx, y, nz, nb);
        this.setBlock(nx, y, nz, id, nl);
      }
    }
  }
  canFlowInto(b, x, y, z, id, level) {
    if (b === 0) return true;
    if (b === id) {
      const m = this.getMeta(x, y, z); if (m === 0) return false;
      if (level === 8) return m < 8;
      return level < (m >= 8 ? 0 : m);
    }
    if (b === BL.water || b === BL.lava) return true;
    const d = BLOCKS[b];
    return !!(d && !d.solid && (d.replace || d.push === 'break'));
  }
  dropReplaced(x, y, z, id) { if (id && this.onFluidBreak && !BLOCKS[id].fluid) this.onFluidBreak(x, y, z, id); }

  // ---------------- 중력 블록 ----------------
  gravityTick(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!BLOCKS[id] || !BLOCKS[id].gravity) return;
    const below = this.getBlock(x, y - 1, z);
    if (y > 0 && (below === 0 || IS_FLUID[below] || IS_REPLACE[below])) {
      if (this.onFalling) { this.setBlock(x, y, z, 0, 0); this.onFalling(x, y, z, id); }
      else { this.setBlock(x, y, z, 0, 0); this.setBlock(x, y - 1, z, id, 0); }
    }
  }

  // ---------------- 무작위 틱 (작물 성장, 잔디 번짐 등) ----------------
  randomTicks(centers) {
    const done = new Set();
    for (const [pcx, pcz] of centers) {
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const cx = pcx + dx, cz = pcz + dz, k = ckey(cx, cz);
        if (done.has(k)) continue; done.add(k);
        const c = this.getChunk(cx, cz); if (!c || c.state < 2) continue;
        for (let s = 0; s < 8; s++) for (let n = 0; n < 3; n++) {
          const r = Math.random() * 4096 | 0;
          const lx = r & 15, lz = (r >> 4) & 15, y = s * 16 + (r >> 8);
          const i = lx | lz << 4 | y << 8, id = c.ids[i];
          if (!id) continue;
          this.randomTickBlock(cx * 16 + lx, y, cz * 16 + lz, id, c.meta[i], c.light[i]);
        }
      }
    }
  }
  randomTickBlock(x, y, z, id, meta, light) {
    if (id === BL.grass) {
      const above = this.getBlock(x, y + 1, z);
      if (above && OPACITY[above] >= 15) { this.setBlock(x, y, z, BL.dirt, 0); return; }
      const nx = x + (Math.random() * 3 | 0) - 1, ny = y + (Math.random() * 3 | 0) - 1, nz = z + (Math.random() * 3 | 0) - 1;
      if (this.getBlock(nx, ny, nz) === BL.dirt && OPACITY[this.getBlock(nx, ny + 1, nz)] < 15 && (this.getLight(nx, ny + 1, nz) >> 4) >= 9) this.setBlock(nx, ny, nz, BL.grass, 0);
    } else if ((id === BL.oak_leaves || id === BL.birch_leaves || id === BL.spruce_leaves) && !(meta & 1)) {
      if (!this.logNear(x, y, z, 4)) { this.setBlock(x, y, z, 0, 0); if (this.onLeafDecay) this.onLeafDecay(x, y, z, id); }
    } else if (id === BL.wheat) {
      const L = Math.max(this.getLight(x, y, z) >> 4, this.getLight(x, y, z) & 15);
      if ((meta & 7) < 7 && L >= 9 && Math.random() < 0.33) this.setBlock(x, y, z, BL.wheat, (meta & 7) + 1);
    } else if (id === BL.sapling) {
      if (Math.random() < 0.12 && (this.getLight(x, y, z) >> 4) >= 9) { this.setBlock(x, y, z, 0, 0); if (!this.growTree(x, y, z)) this.setBlock(x, y, z, BL.sapling, 0); }
    } else if ((id === BL.cactus || id === BL.sugar_cane) && this.getBlock(x, y + 1, z) === 0) {
      let h = 1; while (this.getBlock(x, y - h, z) === id) h++;
      if (h < 3 && Math.random() < 0.1) this.setBlock(x, y + 1, z, id, 0);
    } else if (id === BL.farmland) {
      let wet = false;
      for (let dx = -4; dx <= 4 && !wet; dx++) for (let dz = -4; dz <= 4; dz++) if (this.getBlock(x + dx, y, z + dz) === BL.water) { wet = true; break; }
      if ((wet ? 1 : 0) !== meta) this.setBlock(x, y, z, BL.farmland, wet ? 1 : 0);
    }
  }

  logNear(x, y, z, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > r + 1) continue;
      if (!this.isLoadedAt(x + dx, z + dz)) return true;
      const id = this.getBlock(x + dx, y + dy, z + dz);
      if (id === BL.oak_log || id === BL.birch_log || id === BL.spruce_log) return true;
    }
    return false;
  }
  // 태양 고도 기반 낮 정도 (0 밤 ~ 1 낮)
  dayFactor() {
    if (this.dim !== 'overworld') return 0;
    const t = (this.time % 24000) / 24000;
    const s = Math.sin(t * Math.PI * 2);   // 0 해뜸, 0.25 정오
    return clamp(s * 3 + 0.5, 0, 1);
  }
  sunAngle() { return (this.time % 24000) / 24000 * Math.PI * 2; }
  skyLightLevel() { return Math.round(this.dayFactor() * 11 + 4); }
}
