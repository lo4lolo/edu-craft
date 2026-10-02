'use strict';
// =====================================================================
// 전기 회로(레드스톤) 시뮬레이션
//  - 전선망은 매번 "최대 전력 - 거리" 방식으로 한 번에 다시 계산 (순서 무관, 결정적)
//  - 지연 소자(횃불, 중계기, 비교기, 게이트, 관측기, 클럭)는 예약 틱 사용
//  - 강한 전력/약한 전력 구분 (마인크래프트 규칙)
// =====================================================================
const RS_TICK = 2; // 레드스톤 1틱 = 게임 2틱

// 전선이 방향 dir(전선→대상)의 블록에 시각적으로 연결되는지
function wireConnectsTo(id, meta, dir) {
  const d = BLOCKS[id]; if (!d || !d.rs) return false;
  switch (d.rs) {
    case 'wire': case 'lever': case 'button': case 'plate': case 'torch': case 'source': case 'daylight':
    case 'clock': case 'sensor': case 'drail': case 'target': case 'display': case 'comparator':
      return true;
    case 'repeater': { const f = meta & 7; return f === dir || f === OPP[dir]; }
    case 'gate': { const f = meta & 7; if (d.gate === 'NOT') return f === dir || f === OPP[dir]; return true; }
    case 'observer': return (meta & 7) === dir;
  }
  return false;
}
// g(dx,dy,dz) → 블록 id, gm → meta (전선 위치 기준 상대좌표). 결과: conn[방향] 0 없음, 1 옆, 2 위로 올라감
function wireShape(g, gm) {
  const conn = [0, 0, 0, 0, 0, 0];
  const aboveSolid = IS_OPAQUE[g(0, 1, 0)];
  for (let d = 2; d < 6; d++) {
    const dx = DX[d], dz = DZ[d];
    const nid = g(dx, 0, dz);
    if (wireConnectsTo(nid, gm(dx, 0, dz), d)) { conn[d] = 1; continue; }
    if (!aboveSolid && IS_OPAQUE[nid] && g(dx, 1, dz) === BL.redstone_wire) { conn[d] = 2; continue; }
    if (!IS_OPAQUE[nid] && g(dx, -1, dz) === BL.redstone_wire) conn[d] = 1;
  }
  return conn;
}
function wirePointDirs(conn) {
  let cnt = 0; for (let d = 2; d < 6; d++) if (conn[d]) cnt++;
  const r = [0, 0, 0, 0, 0, 0];
  if (cnt === 0) { r[2] = r[3] = r[4] = r[5] = 1; return r; }
  for (let d = 2; d < 6; d++) if (conn[d]) { r[d] = 1; if (cnt === 1) r[OPP[d]] = 1; }
  return r;
}

// ---------- 레일 모양 ----------
// 0 남북, 1 동서, 2 동쪽 오르막, 3 서쪽, 4 북쪽, 5 남쪽, 6 남동, 7 남서, 8 북서, 9 북동
const RAIL_DIRS = [[2, 3], [4, 5], [4, 5], [4, 5], [2, 3], [2, 3], [3, 5], [3, 4], [2, 4], [2, 5]];
const RAIL_UP = [-1, -1, 5, 4, 2, 3, -1, -1, -1, -1]; // 올라가는 방향
function railShapeOf(id, meta) { return id === BL.rail ? (meta & 15) : (meta & 7); }
function isRail(id) { return id === BL.rail || id === BL.powered_rail || id === BL.detector_rail; }

class Redstone {
  constructor(world, game) {
    this.w = world; this.game = game;
    this.queue = []; this.queued = new Set();
    this.wireDirty = new Set();
    this.torchHist = new Map();
    this.busy = false;
  }
  // ================= 전력 계산 =================
  weak(x, y, z, d) {
    const w = this.w, id = w.getBlock(x, y, z), def = BLOCKS[id];
    if (!def || !def.rs) return 0;
    const m = w.getMeta(x, y, z);
    switch (def.rs) {
      case 'source': return 15;
      case 'lever': case 'button': case 'plate': case 'sensor': case 'drail': return m & 8 ? 15 : 0;
      case 'torch': return (m & 8) || d === (m & 7) ? 0 : 15;
      case 'repeater': return (m & 32) && d === (m & 7) ? 15 : 0;
      case 'gate': return (m & 8) && d === (m & 7) ? 15 : 0;
      case 'comparator': return d === (m & 7) ? this.compOut(x, y, z) : 0;
      case 'observer': return (m & 8) && d === OPP[m & 7] ? 15 : 0;
      case 'daylight': return m & 15;
      case 'clock': return m & 4 ? 15 : 0;
      case 'target': return m & 15;
      case 'wire': {
        const p = m & 15; if (!p || d === 1) return 0;
        if (d === 0) return p;
        return this.wirePoints(x, y, z)[d] ? p : 0;
      }
    }
    return 0;
  }
  strong(x, y, z, d) {
    const w = this.w, id = w.getBlock(x, y, z), def = BLOCKS[id];
    if (!def || !def.rs) return 0;
    const m = w.getMeta(x, y, z);
    switch (def.rs) {
      case 'lever': case 'button': return (m & 8) && d === (m & 7) ? 15 : 0;
      case 'plate': case 'drail': return (m & 8) && d === 0 ? 15 : 0;
      case 'torch': return !(m & 8) && d === 1 ? 15 : 0;
      case 'repeater': return (m & 32) && d === (m & 7) ? 15 : 0;
      case 'gate': return (m & 8) && d === (m & 7) ? 15 : 0;
      case 'comparator': return d === (m & 7) ? this.compOut(x, y, z) : 0;
      case 'observer': return (m & 8) && d === OPP[m & 7] ? 15 : 0;
    }
    return 0;
  }
  isConductor(id) { const d = BLOCKS[id]; return !!(d && d.conductor); }
  // 전도성 블록이 받은 전력 (강한 전력 + 선택적으로 전선의 약한 전력)
  blockPower(x, y, z, withWire) {
    let p = 0;
    for (let d = 0; d < 6; d++) {
      const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
      const nid = this.w.getBlock(nx, ny, nz);
      const nd = BLOCKS[nid]; if (!nd || !nd.rs) continue;
      const s = this.strong(nx, ny, nz, OPP[d]);
      if (s > p) p = s;
      if (withWire && nid === BL.redstone_wire) { const wv = this.weak(nx, ny, nz, OPP[d]); if (wv > p) p = wv; }
      if (p >= 15) return 15;
    }
    return p;
  }
  // 소비 소자(x,y,z)가 방향 d의 이웃에게서 받는 전력
  inputFrom(x, y, z, d) {
    const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
    const nid = this.w.getBlock(nx, ny, nz); const nd = BLOCKS[nid];
    if (!nd || !nid) return 0;
    let p = 0;
    if (nd.rs) p = this.weak(nx, ny, nz, OPP[d]);
    if (p < 15 && nd.conductor) p = Math.max(p, this.blockPower(nx, ny, nz, true));
    return p;
  }
  powerAt(x, y, z, exclude) {
    let p = 0;
    for (let d = 0; d < 6; d++) { if (d === exclude) continue; const v = this.inputFrom(x, y, z, d); if (v > p) p = v; if (p >= 15) break; }
    return p;
  }
  wirePoints(x, y, z) {
    const w = this.w;
    return wirePointDirs(wireShape((dx, dy, dz) => w.getBlock(x + dx, y + dy, z + dz), (dx, dy, dz) => w.getMeta(x + dx, y + dy, z + dz)));
  }
  wireExternal(x, y, z) {
    let p = 0;
    for (let d = 0; d < 6; d++) {
      const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
      const nid = this.w.getBlock(nx, ny, nz);
      if (nid === BL.redstone_wire || !nid) continue;
      const nd = BLOCKS[nid];
      if (nd.rs) { const v = this.weak(nx, ny, nz, OPP[d]); if (v > p) p = v; }
      if (nd.conductor) { const v = this.blockPower(nx, ny, nz, false); if (v > p) p = v; }
      if (p >= 15) return 15;
    }
    return p;
  }
  // 전선망에서 이어진 전선 이웃들
  wireNeighbors(x, y, z, out) {
    const w = this.w;
    const aboveSolid = IS_OPAQUE[w.getBlock(x, y + 1, z)];
    for (let d = 2; d < 6; d++) {
      const nx = x + DX[d], nz = z + DZ[d];
      const side = w.getBlock(nx, y, nz);
      if (side === BL.redstone_wire) out.push(nx, y, nz);
      else if (IS_OPAQUE[side]) { if (!aboveSolid && w.getBlock(nx, y + 1, nz) === BL.redstone_wire) out.push(nx, y + 1, nz); }
      else if (w.getBlock(nx, y - 1, nz) === BL.redstone_wire) out.push(nx, y - 1, nz);
    }
  }
  compOut(x, y, z) { const b = this.w.be.get(fmtKey(x, y, z)); return b && b.o ? b.o : 0; }
  setCompOut(x, y, z, v) {
    const k = fmtKey(x, y, z); let b = this.w.be.get(k);
    if (!b) { b = { t: 'cmp', o: 0 }; this.w.be.set(k, b); }
    b.o = v;
  }

  // ================= 업데이트 큐 =================
  queueAt(x, y, z) {
    const k = x + ',' + y + ',' + z;
    if (this.queued.has(k)) return;
    this.queued.add(k); this.queue.push(x, y, z);
  }
  queueAround(x, y, z) {
    this.queueAt(x, y, z);
    for (let d = 0; d < 6; d++) {
      const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
      this.queueAt(nx, ny, nz);
      if (IS_OPAQUE[this.w.getBlock(nx, ny, nz)]) for (let e = 0; e < 6; e++) this.queueAt(nx + DX[e], ny + DY[e], nz + DZ[e]);
    }
  }
  process() {
    if (this.w.remote || this.busy) return;
    this.busy = true;
    let guard = 0;
    try {
      while ((this.queue.length || this.wireDirty.size) && guard++ < 64) {
        let n = 0;
        while (this.queue.length && n++ < 20000) {
          const q = this.queue; this.queue = []; this.queued.clear();
          for (let i = 0; i < q.length; i += 3) this.update(q[i], q[i + 1], q[i + 2]);
        }
        if (this.wireDirty.size) { const s = Array.from(this.wireDirty); this.wireDirty.clear(); this.updateWires(s); }
      }
    } finally { this.busy = false; }
    if (guard >= 64) { this.queue = []; this.queued.clear(); this.wireDirty.clear(); }
  }
  // 블록이 바뀌었을 때 (게임에서 호출)
  onBlockChange(x, y, z, oid, om, id, meta, flags) {
    if (this.w.remote) return;
    // 관측기: 자기 앞 블록이 변하면 펄스
    for (let d = 0; d < 6; d++) {
      const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
      if (this.w.getBlock(nx, ny, nz) === BL.observer && (this.w.getMeta(nx, ny, nz) & 7) === OPP[d]) {
        if (!(this.w.getMeta(nx, ny, nz) & 8)) this.w.schedule(nx, ny, nz, RS_TICK, 1);
      }
    }
    if (flags & 2) return;
    this.queueAround(x, y, z);
    // 새로 놓인 주기 소자
    const d = BLOCKS[id];
    if (d && d.rs && id !== oid) {
      if (d.rs === 'daylight' || d.rs === 'sensor') this.w.schedule(x, y, z, 5, 1);
      else if (d.rs === 'clock') this.w.schedule(x, y, z, 2, 1);
    }
    if (oid === BL.comparator && id !== BL.comparator) this.w.be.delete(fmtKey(x, y, z));
  }
  // 청크를 불러온 뒤 주기 소자 깨우기
  onChunkLoaded(c) {
    if (this.w.remote) return;
    const ids = c.ids;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id < 110) continue;
      const d = BLOCKS[id]; if (!d || !d.rs) continue;
      const x = c.cx * 16 + (i & 15), y = i >> 8, z = c.cz * 16 + ((i >> 4) & 15);
      if (d.rs === 'daylight' || d.rs === 'sensor' || d.rs === 'clock') this.w.schedule(x, y, z, 5 + (i % 10), 1);
      else if (d.rs === 'button' && (c.meta[i] & 8)) this.w.schedule(x, y, z, 10, 1);
      else if (d.rs === 'plate' && (c.meta[i] & 8)) this.w.schedule(x, y, z, 10, 1);
    }
  }

  // ================= 개별 소자 업데이트 =================
  update(x, y, z) {
    const w = this.w;
    const id = w.getBlock(x, y, z); const d = BLOCKS[id];
    if (!d || !d.rs) return;
    const m = w.getMeta(x, y, z);
    switch (d.rs) {
      case 'wire': this.wireDirty.add(x + ',' + y + ',' + z); return;
      case 'torch': {
        const a = m & 7;
        const input = this.blockPower(x + DX[a], y + DY[a], z + DZ[a], true);
        const lit = !(m & 8);
        if ((input === 0) !== lit && !w.isScheduled(x, y, z, 1)) w.schedule(x, y, z, RS_TICK, 1);
        return;
      }
      case 'repeater': {
        const f = m & 7;
        const locked = this.repeaterLocked(x, y, z, f);
        if (locked !== !!(m & 64)) { w.setBlock(x, y, z, id, locked ? (m | 64) : (m & ~64), 2); }
        if (locked) return;
        const want = this.inputFrom(x, y, z, OPP[f]) > 0;
        if (want !== !!(m & 32) && !w.isScheduled(x, y, z, 1)) w.schedule(x, y, z, (((m >> 3) & 3) + 1) * RS_TICK, 1);
        return;
      }
      case 'comparator': {
        const out = this.comparatorCalc(x, y, z, m);
        if ((out !== this.compOut(x, y, z) || (out > 0) !== !!(m & 16)) && !w.isScheduled(x, y, z, 1)) w.schedule(x, y, z, RS_TICK, 1);
        return;
      }
      case 'gate': {
        const want = this.gateCalc(x, y, z, m, d.gate);
        if (want !== !!(m & 8) && !w.isScheduled(x, y, z, 1)) w.schedule(x, y, z, RS_TICK, 1);
        return;
      }
      case 'lamp': {
        const p = this.powerAt(x, y, z) > 0;
        if (p && !(m & 1)) w.setBlock(x, y, z, id, 1);
        else if (!p && (m & 1) && !w.isScheduled(x, y, z, 1)) w.schedule(x, y, z, 4, 1);
        return;
      }
      case 'colorlamp': case 'display': {
        const p = this.powerAt(x, y, z);
        if (p !== (m & 15)) w.setBlock(x, y, z, id, p, 2);
        return;
      }
      case 'piston': {
        const f = m & 7;
        const p = this.powerAt(x, y, z, f) > 0;
        if (p !== !!(m & 8) && !w.isScheduled(x, y, z, 1)) w.schedule(x, y, z, 1, 1);
        return;
      }
      case 'door': {
        if (d.shape === 'door') {
          const ly = m & 16 ? y - 1 : y;
          if (w.getBlock(x, ly, z) !== id) return;
          const lm = w.getMeta(x, ly, z);
          const p = this.powerAt(x, ly, z) > 0 || this.powerAt(x, ly + 1, z) > 0;
          if (p !== !!(lm & 64)) {
            const nm = (lm & ~(64 | 8)) | (p ? 64 | 8 : 0);
            if (!!(lm & 8) !== p && this.game) this.game.sfx(p ? 'door_open' : 'door_close', x + 0.5, ly + 1, z + 0.5);
            w.setBlock(x, ly, z, id, nm, 2);
            const um = w.getMeta(x, ly + 1, z);
            if (w.getBlock(x, ly + 1, z) === id) w.setBlock(x, ly + 1, z, id, (um & ~(64 | 8)) | (p ? 64 | 8 : 0) | 16, 2);
          }
        } else {
          const p = this.powerAt(x, y, z) > 0;
          if (p !== !!(m & 32)) {
            if (!!(m & 8) !== p && this.game) this.game.sfx(p ? 'door_open' : 'door_close', x + 0.5, y + 0.5, z + 0.5);
            w.setBlock(x, y, z, id, (m & ~(32 | 8)) | (p ? 32 | 8 : 0), 2);
          }
        }
        return;
      }
      case 'note': {
        const p = this.powerAt(x, y, z);
        if (p > 0 && !(m & 32)) {
          w.setBlock(x, y, z, id, m | 32, 2);
          if (this.game) this.game.playNoteBlock(x, y, z, d.speaker ? p : (m & 31));
        } else if (p === 0 && (m & 32)) w.setBlock(x, y, z, id, m & ~32, 2);
        return;
      }
      case 'tnt': if (this.powerAt(x, y, z) > 0 && this.game) this.game.igniteTNT(x, y, z); return;
      case 'dispenser': {
        const p = this.powerAt(x, y, z) > 0;
        if (p && !(m & 8)) { w.setBlock(x, y, z, id, m | 8, 2); w.schedule(x, y, z, RS_TICK * 2, 1); }
        else if (!p && (m & 8)) w.setBlock(x, y, z, id, m & ~8, 2);
        return;
      }
      case 'prail': {
        const p = this.poweredRail(x, y, z);
        if (p !== !!(m & 8)) {
          w.setBlock(x, y, z, id, p ? m | 8 : m & ~8, 2);
          for (const dd of RAIL_DIRS[m & 7]) for (const oy of [-1, 0, 1]) { const nx = x + DX[dd], nz = z + DZ[dd]; if (w.getBlock(nx, y + oy, nz) === BL.powered_rail) this.queueAt(nx, y + oy, nz); }
        }
        return;
      }
      case 'hopper': case 'conveyor': {
        const p = this.powerAt(x, y, z) > 0;
        if (p !== !!(m & 8)) w.setBlock(x, y, z, id, p ? m | 8 : m & ~8, 2);
        return;
      }
      case 'fan': {
        const p = this.powerAt(x, y, z) > 0;
        if (p !== !!(m & 8)) w.setBlock(x, y, z, id, p ? m | 8 : m & ~8, 2);
        return;
      }
      case 'elevator': {
        const p = this.powerAt(x, y, z) > 0;
        if (p !== !!(m & 1)) { w.setBlock(x, y, z, id, p ? 1 : 0, 2); if (p && this.game) this.game.elevatorLaunch(x, y, z); }
        return;
      }
    }
  }
  repeaterLocked(x, y, z, f) {
    for (const s of [CW[f], CCW[f]]) {
      const nx = x + DX[s], nz = z + DZ[s];
      const nid = this.w.getBlock(nx, y, nz); const nm = this.w.getMeta(nx, y, nz);
      if (nid === BL.repeater && (nm & 32) && (nm & 7) === OPP[s]) return true;
      if (nid === BL.comparator && (nm & 7) === OPP[s] && this.compOut(nx, y, nz) > 0) return true;
    }
    return false;
  }
  containerSignal(x, y, z) {
    const b = this.w.be.get(fmtKey(x, y, z));
    if (!b || !b.items) return -1;
    let sum = 0, any = false;
    for (const it of b.items) if (it) { any = true; sum += it.n / itemMaxStack(it.id); }
    if (!any) return 0;
    return Math.floor(1 + sum / b.items.length * 14);
  }
  comparatorCalc(x, y, z, m) {
    const f = m & 7, back = OPP[f];
    const bx = x + DX[back], bz = z + DZ[back];
    let rear = this.containerSignal(bx, y, bz);
    if (rear < 0) rear = this.inputFrom(x, y, z, back);
    let side = 0;
    for (const s of [CW[f], CCW[f]]) {
      const nx = x + DX[s], nz = z + DZ[s];
      const nid = this.w.getBlock(nx, y, nz);
      if (nid && BLOCKS[nid].rs) side = Math.max(side, this.weak(nx, y, nz, OPP[s]));
    }
    if (m & 8) return Math.max(0, rear - side);
    return rear >= side ? rear : 0;
  }
  gateCalc(x, y, z, m, g) {
    const f = m & 7;
    if (g === 'NOT') return this.inputFrom(x, y, z, OPP[f]) === 0;
    const a = this.inputFrom(x, y, z, CCW[f]) > 0, b = this.inputFrom(x, y, z, CW[f]) > 0;
    if (g === 'AND') return a && b;
    if (g === 'OR') return a || b;
    return a !== b;
  }
  poweredRail(x, y, z) {
    if (this.powerAt(x, y, z) > 0) return true;
    // 같은 줄의 전동 레일을 따라 최대 8칸까지 전력 전달
    const w = this.w;
    const shape = w.getMeta(x, y, z) & 7;
    for (const dir of RAIL_DIRS[shape]) {
      let cx = x, cy = y, cz = z;
      for (let i = 0; i < 8; i++) {
        let nx = cx + DX[dir], nz = cz + DZ[dir], ny = cy;
        if (w.getBlock(nx, ny, nz) !== BL.powered_rail) { if (w.getBlock(nx, ny + 1, nz) === BL.powered_rail) ny++; else if (w.getBlock(nx, ny - 1, nz) === BL.powered_rail) ny--; else break; }
        const s = w.getMeta(nx, ny, nz) & 7;
        if (RAIL_DIRS[s][0] !== dir && RAIL_DIRS[s][1] !== dir && RAIL_DIRS[s][0] !== OPP[dir] && RAIL_DIRS[s][1] !== OPP[dir]) break;
        if (this.powerAt(nx, ny, nz) > 0) return true;
        cx = nx; cy = ny; cz = nz;
      }
    }
    return false;
  }
  // ================= 전선망 재계산 =================
  updateWires(seeds) {
    const w = this.w;
    const net = new Map(); // key → [x,y,z,level]
    const stack = [];
    for (const k of seeds) { const [x, y, z] = parseKey(k); if (w.getBlock(x, y, z) === BL.redstone_wire) stack.push(x, y, z); }
    while (stack.length && net.size < 4000) {
      const z = stack.pop(), y = stack.pop(), x = stack.pop();
      const k = x + ',' + y + ',' + z;
      if (net.has(k)) continue;
      const nb = []; this.wireNeighbors(x, y, z, nb);
      net.set(k, { x, y, z, lv: 0, nb, old: w.getMeta(x, y, z) & 15 });
      for (let i = 0; i < nb.length; i += 3) { const kk = nb[i] + ',' + nb[i + 1] + ',' + nb[i + 2]; if (!net.has(kk)) stack.push(nb[i], nb[i + 1], nb[i + 2]); }
    }
    const buckets = []; for (let i = 0; i <= 15; i++) buckets.push([]);
    for (const e of net.values()) { e.lv = this.wireExternal(e.x, e.y, e.z); if (e.lv > 0) buckets[e.lv].push(e); }
    for (let L = 15; L >= 2; L--) {
      for (const e of buckets[L]) {
        if (e.lv !== L) continue;
        for (let i = 0; i < e.nb.length; i += 3) {
          const n = net.get(e.nb[i] + ',' + e.nb[i + 1] + ',' + e.nb[i + 2]);
          if (n && n.lv < L - 1) { n.lv = L - 1; buckets[L - 1].push(n); }
        }
      }
    }
    const changed = [];
    for (const e of net.values()) if (e.lv !== e.old) { w.setBlock(e.x, e.y, e.z, BL.redstone_wire, e.lv, 2); changed.push(e); }
    for (const e of changed) {
      const { x, y, z } = e;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        const nid = w.getBlock(nx, ny, nz);
        if (nid !== BL.redstone_wire) this.queueAt(nx, ny, nz);
        if (IS_OPAQUE[nid] || (BLOCKS[nid] && BLOCKS[nid].conductor)) for (let d2 = 0; d2 < 6; d2++) { const ax = nx + DX[d2], ay = ny + DY[d2], az = nz + DZ[d2]; if (w.getBlock(ax, ay, az) !== BL.redstone_wire) this.queueAt(ax, ay, az); }
      }
    }
  }

  // ================= 예약 틱 =================
  scheduledTick(x, y, z) {
    const w = this.w;
    const id = w.getBlock(x, y, z); const d = BLOCKS[id];
    if (!d || !d.rs) return;
    const m = w.getMeta(x, y, z);
    switch (d.rs) {
      case 'torch': {
        const a = m & 7;
        const input = this.blockPower(x + DX[a], y + DY[a], z + DZ[a], true);
        const lit = !(m & 8), want = input === 0;
        const k = fmtKey(x, y, z);
        let h = this.torchHist.get(k);
        if (h && h.burnt && w.tick < h.burnt) { w.schedule(x, y, z, h.burnt - w.tick, 1); return; }
        if (want !== lit) {
          if (want) {
            if (!h) { h = { t: [] }; this.torchHist.set(k, h); }
            h.t = h.t.filter(t => w.tick - t < 60); h.t.push(w.tick);
            if (h.t.length > 10) { h.burnt = w.tick + 160; h.t = []; if (this.game) this.game.sfx('fizz', x + 0.5, y + 0.5, z + 0.5); w.setBlock(x, y, z, id, m | 8); w.schedule(x, y, z, 161, 1); return; }
          }
          w.setBlock(x, y, z, id, want ? (m & ~8) : (m | 8));
        }
        return;
      }
      case 'repeater': {
        const f = m & 7;
        if (this.repeaterLocked(x, y, z, f)) return;
        const want = this.inputFrom(x, y, z, OPP[f]) > 0;
        const on = !!(m & 32);
        if (!on) { w.setBlock(x, y, z, id, m | 32); }
        else if (!want) { w.setBlock(x, y, z, id, m & ~32); }
        this.queueAt(x, y, z);
        return;
      }
      case 'comparator': {
        const out = this.comparatorCalc(x, y, z, m);
        const old = this.compOut(x, y, z);
        this.setCompOut(x, y, z, out);
        const nm = out > 0 ? m | 16 : m & ~16;
        if (nm !== m) w.setBlock(x, y, z, id, nm);
        else if (out !== old) { this.queueAround(x, y, z); w.markDirty(x, y, z); }
        return;
      }
      case 'gate': {
        const want = this.gateCalc(x, y, z, m, d.gate);
        if (want !== !!(m & 8)) w.setBlock(x, y, z, id, want ? m | 8 : m & ~8);
        return;
      }
      case 'lamp': if (this.powerAt(x, y, z) === 0 && (m & 1)) w.setBlock(x, y, z, id, 0); return;
      case 'piston': {
        const f = m & 7;
        const p = this.powerAt(x, y, z, f) > 0;
        if (p && !(m & 8)) this.extend(x, y, z, id, m);
        else if (!p && (m & 8)) this.retract(x, y, z, id, m);
        return;
      }
      case 'button':
        if (m & 8) { w.setBlock(x, y, z, id, m & ~8); if (this.game) this.game.sfx('click_off', x + 0.5, y + 0.5, z + 0.5); this.queueAround(x + DX[m & 7], y + DY[m & 7], z + DZ[m & 7]); }
        return;
      case 'plate': {
        const occ = this.game ? this.game.entitiesOnPlate(x, y, z, !!d.anyEntity) : false;
        if (!occ && (m & 8)) { w.setBlock(x, y, z, id, m & ~8); this.queueAround(x, y - 1, z); if (this.game) this.game.sfx('click_off', x + 0.5, y, z + 0.5); }
        else if (occ) w.schedule(x, y, z, 10, 1);
        return;
      }
      case 'observer': {
        if (!(m & 8)) { w.setBlock(x, y, z, id, m | 8); w.schedule(x, y, z, RS_TICK, 1); }
        else w.setBlock(x, y, z, id, m & ~8);
        const b = OPP[m & 7]; this.queueAround(x + DX[b], y + DY[b], z + DZ[b]);
        return;
      }
      case 'daylight': {
        const sky = w.getLight(x, y, z) >> 4;
        const day = w.dayFactor();
        let p = Math.round(sky / 15 * day * 15);
        if (m & 16) p = Math.round(sky / 15 * (1 - day) * 15);
        if (p !== (m & 15)) w.setBlock(x, y, z, id, (m & 16) | p);
        w.schedule(x, y, z, 20, 1);
        return;
      }
      case 'clock': {
        const period = [10, 20, 40, 80][m & 3];
        if (m & 8) { if (m & 4) w.setBlock(x, y, z, id, m & ~4); w.schedule(x, y, z, 20, 1); return; }
        w.setBlock(x, y, z, id, m ^ 4);
        w.schedule(x, y, z, period, 1);
        return;
      }
      case 'sensor': {
        const near = this.game ? this.game.entitiesNear(x + 0.5, y + 0.5, z + 0.5, 5) : false;
        if (near !== !!(m & 8)) w.setBlock(x, y, z, id, near ? m | 8 : m & ~8);
        w.schedule(x, y, z, 5, 1);
        return;
      }
      case 'drail': {
        const has = this.game ? this.game.cartOn(x, y, z) : false;
        if (has !== !!(m & 8)) { w.setBlock(x, y, z, id, has ? m | 8 : m & ~8); this.queueAround(x, y - 1, z); }
        if (has) w.schedule(x, y, z, 10, 1);
        return;
      }
      case 'target': if (m & 15) { w.setBlock(x, y, z, id, 0); } return;
      case 'dispenser': if (this.game) this.game.dispense(x, y, z, m & 7, !!d.dropper); return;
      case 'lever': return;
    }
  }
  // ================= 피스톤 =================
  canPush(id) {
    if (!id) return 'empty';
    const d = BLOCKS[id];
    if (d.fluid || (d.replace && !d.solid)) return 'empty';
    if (d.push === 'break') return 'break';
    if (d.push === 'block' || d.hard < 0 || id === BL.obsidian) return 'no';
    return 'yes';
  }
  extend(x, y, z, id, m) {
    const w = this.w, f = m & 7;
    const list = [];
    let bx = x, by = y, bz = z, endState = null, endPos = null;
    for (let i = 1; i <= 13; i++) {
      bx += DX[f]; by += DY[f]; bz += DZ[f];
      if (by < 0 || by >= HEIGHT) return false;
      const bid = w.getBlock(bx, by, bz);
      let st = this.canPush(bid);
      if ((bid === BL.piston || bid === BL.sticky_piston) && (w.getMeta(bx, by, bz) & 8)) st = 'no';
      if (st === 'no') return false;
      if (st === 'empty' || st === 'break') { endState = st; endPos = [bx, by, bz]; break; }
      if (i === 13) return false;
      list.push([bx, by, bz, bid, w.getMeta(bx, by, bz)]);
    }
    if (!endPos) return false;
    if (endState === 'break' && this.game) this.game.breakBlockDrop(endPos[0], endPos[1], endPos[2]);
    for (let k = list.length - 1; k >= 0; k--) {
      const [px, py, pz, pid, pm] = list[k];
      w.setBlock(px + DX[f], py + DY[f], pz + DZ[f], pid, pm);
    }
    w.setBlock(x + DX[f], y + DY[f], z + DZ[f], BL.piston_head, f | (id === BL.sticky_piston ? 8 : 0));
    w.setBlock(x, y, z, id, m | 8);
    if (this.game) {
      this.game.sfx('piston_out', x + 0.5, y + 0.5, z + 0.5);
      const cells = list.map(b => [b[0] + DX[f], b[1] + DY[f], b[2] + DZ[f]]); cells.push([x + DX[f], y + DY[f], z + DZ[f]]);
      this.game.pushEntities(cells, f);
      this.game.pistonAnim(list.map(b => [b[0], b[1], b[2], b[3], b[4]]), f, x, y, z, true);
    }
    return true;
  }
  retract(x, y, z, id, m) {
    const w = this.w, f = m & 7;
    const hx = x + DX[f], hy = y + DY[f], hz = z + DZ[f];
    w.setBlock(x, y, z, id, m & ~8);
    if (w.getBlock(hx, hy, hz) === BL.piston_head) w.setBlock(hx, hy, hz, 0, 0);
    if (id === BL.sticky_piston) {
      const bx = hx + DX[f], by = hy + DY[f], bz = hz + DZ[f];
      const bid = w.getBlock(bx, by, bz);
      const st = this.canPush(bid);
      const extended = (bid === BL.piston || bid === BL.sticky_piston) && (w.getMeta(bx, by, bz) & 8);
      if (st === 'yes' && !extended && bid !== BL.piston_head) {
        const bm = w.getMeta(bx, by, bz);
        w.setBlock(bx, by, bz, 0, 0);
        w.setBlock(hx, hy, hz, bid, bm);
        if (this.game) this.game.pistonAnim([[bx, by, bz, bid, bm]], OPP[f], x, y, z, false);
      }
    }
    if (this.game) this.game.sfx('piston_in', x + 0.5, y + 0.5, z + 0.5);
  }

  // ================= 정보 (멀티미터/HUD) =================
  describe(x, y, z) {
    const w = this.w, id = w.getBlock(x, y, z), d = BLOCKS[id];
    if (!d || !id) return null;
    const m = w.getMeta(x, y, z);
    const on = (b) => b ? '켜짐 ⚡' : '꺼짐';
    switch (d.rs) {
      case 'wire': return `전선 · 전력 ${m & 15}/15`;
      case 'torch': return `레드스톤 횃불 · ${on(!(m & 8))} (붙은 블록 전력: ${this.blockPower(x + DX[m & 7], y + DY[m & 7], z + DZ[m & 7], true)})`;
      case 'lever': return `레버 · ${on(m & 8)}`;
      case 'button': return `버튼 · ${on(m & 8)}`;
      case 'plate': return `압력판 · ${on(m & 8)}`;
      case 'repeater': return `중계기 · 지연 ${((m >> 3) & 3) + 1}틱 · ${on(m & 32)}${m & 64 ? ' · 잠김🔒' : ''}`;
      case 'comparator': return `비교기 · ${m & 8 ? '빼기' : '비교'} 모드 · 출력 ${this.compOut(x, y, z)}`;
      case 'gate': return `${d.gate} 게이트 · 출력 ${on(m & 8)}`;
      case 'lamp': return `램프 · ${on(m & 1)} · 입력 ${this.powerAt(x, y, z)}`;
      case 'colorlamp': return `색깔 램프 · 입력 ${m & 15}`;
      case 'display': return `숫자 표시기 · ${m & 15}`;
      case 'piston': return `피스톤 · ${m & 8 ? '늘어남' : '줄어듦'} · 입력 ${this.powerAt(x, y, z, m & 7)}`;
      case 'observer': return `관측기 · ${on(m & 8)}`;
      case 'daylight': return `햇빛 감지기 · ${m & 16 ? '밤 감지' : '낮 감지'} · 출력 ${m & 15}`;
      case 'clock': return `클럭 · 주기 ${[1, 2, 4, 8][m & 3]}초 · ${m & 8 ? '정지' : '작동'} · ${on(m & 4)}`;
      case 'sensor': return `플레이어 감지기 · ${on(m & 8)}`;
      case 'source': return '레드스톤 블록 · 항상 15';
      case 'note': return `${d.k} · 음 ${m & 31} · 입력 ${this.powerAt(x, y, z)}`;
      case 'prail': return `전동 레일 · ${on(m & 8)}`;
      case 'drail': return `감지 레일 · ${on(m & 8)}`;
      case 'fan': return `선풍기 · ${on(m & 8)}`;
      case 'door': return `${d.k} · 입력 ${this.powerAt(x, y, z)}`;
      case 'dispenser': return `${d.k} · 입력 ${this.powerAt(x, y, z)}`;
      case 'tnt': return `TNT · 입력 ${this.powerAt(x, y, z)}`;
      case 'elevator': return `엘리베이터 · 입력 ${this.powerAt(x, y, z)}`;
      case 'hopper': return `깔때기 · ${m & 8 ? '멈춤(전기 받음)' : '작동 중'}`;
      case 'conveyor': return `컨베이어 벨트 · ${on(m & 8)}`;
      case 'target': return `과녁 · 출력 ${m & 15}`;
    }
    if (d.conductor) {
      const s = this.blockPower(x, y, z, false), wk = this.blockPower(x, y, z, true);
      return `${d.k} · ${s > 0 ? '강한 전력 ' + s : wk > 0 ? '약한 전력 ' + wk : '전력 없음'}`;
    }
    return null;
  }
}

// ---------- 레일 모양 결정 ----------
function railConnectable(w, x, y, z) {
  for (const oy of [0, 1, -1]) { const id = w.getBlock(x, y + oy, z); if (isRail(id)) return oy; }
  return null;
}
function railNeighborDirs(w, x, y, z) {
  const r = [];
  for (let d = 2; d < 6; d++) {
    const oy = railConnectable(w, x + DX[d], y, z + DZ[d]);
    if (oy !== null) r.push([d, oy]);
  }
  return r;
}
function computeRailShape(w, x, y, z, id, prefDir) {
  const nb = railNeighborDirs(w, x, y, z);
  const canCurve = id === BL.rail;
  let a = null, b = null;
  // 이미 우리를 향하는 이웃 우선
  const pointing = nb.filter(([d, oy]) => { const nx = x + DX[d], ny = y + oy, nz = z + DZ[d]; const s = railShapeOf(w.getBlock(nx, ny, nz), w.getMeta(nx, ny, nz)); return RAIL_DIRS[s].includes(OPP[d]); });
  const pick = pointing.concat(nb.filter(n => !pointing.includes(n)));
  if (pick.length) a = pick[0];
  for (const n of pick.slice(1)) { if (!b && (n[0] === OPP[a[0]] || canCurve)) b = n; }
  if (b && b[0] !== OPP[a[0]] && !canCurve) b = null;
  const straightOf = (d) => d === 2 || d === 3 ? 0 : 1;
  if (!a) return prefDir === 4 || prefDir === 5 ? 1 : 0;
  if (!b) {
    if (a[1] === 1) return a[0] === 5 ? 2 : a[0] === 4 ? 3 : a[0] === 2 ? 4 : 5;
    return straightOf(a[0]);
  }
  if (b[0] === OPP[a[0]]) {
    const up = a[1] === 1 ? a[0] : b[1] === 1 ? b[0] : -1;
    if (up >= 0) return up === 5 ? 2 : up === 4 ? 3 : up === 2 ? 4 : 5;
    return straightOf(a[0]);
  }
  const s = new Set([a[0], b[0]]);
  if (s.has(3) && s.has(5)) return 6; if (s.has(3) && s.has(4)) return 7;
  if (s.has(2) && s.has(4)) return 8; return 9;
}
