'use strict';
// =====================================================================
// 개체: 떨어진 아이템, 몹, TNT, 떨어지는 블록, 화살, 광산 수레, 파티클
// =====================================================================
let NEXT_EID = 1;
const MOB_TYPES = {
  pig: { k: '돼지', hp: 10, w: 0.9, h: 0.9, speed: 1.6, hostile: false, drops: [['porkchop', 1, 3]] },
  cow: { k: '소', hp: 10, w: 0.9, h: 1.4, speed: 1.4, hostile: false, drops: [['beef', 1, 3]] },
  sheep: { k: '양', hp: 8, w: 0.9, h: 1.3, speed: 1.5, hostile: false, drops: [['wool_white', 1, 1]] },
  chicken: { k: '닭', hp: 4, w: 0.45, h: 0.7, speed: 1.4, hostile: false, drops: [['chicken', 1, 1], ['feather', 0, 2]] },
  zombie: { k: '좀비', hp: 20, w: 0.6, h: 1.95, speed: 2.4, hostile: true, dmg: 3, burns: true, drops: [['rotten_flesh', 0, 2], ['string', 0, 1]] },
  skeleton: { k: '스켈레톤', hp: 20, w: 0.6, h: 1.99, speed: 2.3, hostile: true, ranged: true, burns: true, drops: [['bone', 0, 2], ['arrow', 0, 2]] },
  creeper: { k: '크리퍼', hp: 20, w: 0.6, h: 1.7, speed: 2.1, hostile: true, creeper: true, drops: [['gunpowder', 0, 2]] },
};
const ETYPE_CODES = ['item', 'mob', 'tnt', 'falling', 'arrow', 'cart', 'moving'];

class Entity extends Body {
  constructor(type, w, h) {
    super(w, h);
    this.type = type; this.eid = NEXT_EID++; this.dead = false; this.age = 0; this.yaw = 0; this.pitch = 0;
    this.stepHeight = 0.5;
  }
  lightAt(world) {
    const L = world.getLight(Math.floor(this.x), Math.floor(this.y + Math.min(this.h, 1) * 0.5), Math.floor(this.z));
    return [(L >> 4) / 15, (L & 15) / 15];
  }
}

class ItemEntity extends Entity {
  constructor(item, x, y, z) {
    super('item', 0.25, 0.25);
    this.item = item; this.x = x; this.y = y; this.z = z;
    this.vx = (Math.random() - 0.5) * 3; this.vy = 4; this.vz = (Math.random() - 0.5) * 3;
    this.pickup = 0.5; this.spin = Math.random() * 6; this.stepHeight = 0;
  }
  update(dt, g) {
    this.age += dt;
    if (this.age > 300) { this.dead = true; return; }
    this.checkFluids(g.world);
    if (this.inWater) { this.vy += (2 - this.vy) * dt * 2; }
    else this.vy -= 20 * dt;
    const fr = this.onGround ? Math.exp(-8 * dt) : Math.exp(-0.5 * dt);
    this.vx *= fr; this.vz *= fr;
    this.move(g.world, this.vx * dt, this.vy * dt, this.vz * dt);
    if (this.pickup > 0) this.pickup -= dt;
    this.spin += dt * 1.5;
    // 병합
    this.mergeT = (this.mergeT || Math.random() * 0.5) - dt;
    if (this.mergeT <= 0 && this.onGround) for (const e of g.ents.list) {
      if (e === this || e.dead || e.type !== 'item' || e.item.id !== this.item.id || e.item.d) continue;
      if (Math.abs(e.x - this.x) < 0.8 && Math.abs(e.y - this.y) < 0.8 && Math.abs(e.z - this.z) < 0.8) {
        const max = itemMaxStack(this.item.id);
        if (this.item.n + e.item.n <= max) { this.item.n += e.item.n; e.dead = true; }
      }
    }
    if (this.mergeT <= 0) this.mergeT = 0.5;
    this.pickupCheck(dt, g);
  }
  pickupCheck(dt, g) {
    const p = g.player;
    if (this.pickup <= 0 && !p.dead) {
      const dx = p.x - this.x, dy = (p.y + 0.8) - this.y, dz = p.z - this.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 2.2 * 2.2) {
        if (d2 < 1.1) {
          const left = p.give(this.item.id, this.item.n, this.item.d);
          if (left < this.item.n) g.sfx('pop', this.x, this.y, this.z);
          if (left <= 0) this.dead = true; else this.item.n = left;
        } else { const k = 10 * dt / Math.sqrt(d2); this.x += dx * k; this.y += dy * k; this.z += dz * k; }
      }
    }
  }
  render(g, R, cam) {
    const mesh = g.itemMesh(this.item.id);
    const m = M4.create(), t = M4.create();
    const bob = Math.sin(this.age * 3) * 0.06 + 0.15;
    M4.translate(m, this.x - cam[0], this.y + bob - cam[1], this.z - cam[2]);
    M4.mul(m, m, M4.rotY(t, this.spin));
    const sc = mesh.flat ? 0.45 : 0.28;
    const sm = M4.create(); sm[0] = sm[5] = sm[10] = sc; M4.mul(m, m, sm);
    const L = this.lightAt(g.world);
    const n = this.item.n > 16 ? 3 : this.item.n > 1 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const mm = new Float32Array(m);
      if (i) { mm[12] += 0.06 * i; mm[13] += 0.04 * i; mm[14] += 0.05 * i; }
      g.frame.blockEnts.push({ mesh, model: mm, light: L });
    }
  }
}

class TNTEntity extends Entity {
  constructor(x, y, z, fuse) {
    super('tnt', 0.98, 0.98); this.x = x; this.y = y; this.z = z; this.fuse = fuse || 80; this.vy = 3; this.stepHeight = 0;
    this.vx = (Math.random() - 0.5) * 0.8; this.vz = (Math.random() - 0.5) * 0.8;
  }
  update(dt, g) {
    this.vy -= 20 * dt; this.vx *= Math.exp(-2 * dt); this.vz *= Math.exp(-2 * dt);
    this.move(g.world, this.vx * dt, this.vy * dt, this.vz * dt);
    this.fuse -= dt * 20;
    if (this.fuse <= 0) { this.dead = true; g.explode(this.x, this.y + 0.5, this.z, 4); }
  }
  render(g, R, cam) {
    const mesh = g.blockMesh(BL.tnt, 0);
    const m = M4.create(); M4.translate(m, this.x - cam[0], this.y + 0.49 - cam[1], this.z - cam[2]);
    const sw = this.fuse < 10 ? 1 + (10 - this.fuse) / 10 * 0.2 : 1;
    const sm = M4.create(); sm[0] = sm[5] = sm[10] = sw; M4.mul(m, m, sm);
    g.frame.blockEnts.push({ mesh, model: m, light: this.lightAt(g.world), flash: (Math.floor(this.fuse / 5) % 2) ? 0.6 : 0 });
  }
}

class FallingBlock extends Entity {
  constructor(x, y, z, id) { super('falling', 0.98, 0.98); this.x = x + 0.5; this.y = y; this.z = z + 0.5; this.block = id; this.stepHeight = 0; }
  update(dt, g) {
    this.vy -= 30 * dt;
    this.move(g.world, 0, this.vy * dt, 0);
    this.age += dt;
    if (this.onGround || this.age > 20) {
      this.dead = true;
      const bx = Math.floor(this.x), by = Math.round(this.y), bz = Math.floor(this.z);
      const cur = g.world.getBlock(bx, by, bz);
      if (!cur || BLOCKS[cur].replace) g.world.setBlock(bx, by, bz, this.block, 0);
      else g.dropItem(bx + 0.5, by + 0.5, bz + 0.5, { id: this.block, n: 1 });
    }
  }
  render(g, R, cam) {
    const mesh = g.blockMesh(this.block, 0);
    const m = M4.create(); M4.translate(m, this.x - cam[0], this.y + 0.49 - cam[1], this.z - cam[2]);
    g.frame.blockEnts.push({ mesh, model: m, light: this.lightAt(g.world) });
  }
}

// 피스톤으로 밀리는 블록 애니메이션 (시각 효과 전용)
class MovingBlockFx extends Entity {
  constructor(x, y, z, id, meta, dir) { super('moving', 1, 1); this.x = x; this.y = y; this.z = z; this.block = id; this.meta = meta; this.dir = dir; this.t = 0; }
  update(dt) { this.t += dt; if (this.t > 0.12) this.dead = true; }
  render(g, R, cam) {
    const k = Math.min(1, this.t / 0.1) - 1;
    const d = this.dir;
    const mesh = g.blockMesh(this.block, this.meta);
    const m = M4.create();
    M4.translate(m, this.x + 0.5 + DX[d] * (1 + k) - cam[0], this.y + 0.5 + DY[d] * (1 + k) - cam[1], this.z + 0.5 + DZ[d] * (1 + k) - cam[2]);
    const sm = M4.create(); sm[0] = sm[5] = sm[10] = 1.002; M4.mul(m, m, sm);
    const L = g.world.getLight(this.x + DX[d], this.y + DY[d], this.z + DZ[d]);
    g.frame.blockEnts.push({ mesh, model: m, light: [(L >> 4) / 15, (L & 15) / 15] });
  }
}

class ArrowEntity extends Entity {
  constructor(x, y, z, vx, vy, vz, owner) {
    super('arrow', 0.25, 0.25); this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz; this.owner = owner; this.stuck = false; this.stepHeight = 0;
  }
  update(dt, g) {
    this.age += dt;
    if (this.age > 60) { this.dead = true; return; }
    if (this.stuck) {
      // 박힌 화살 줍기
      const p = g.player;
      if (this.owner === 'player' && Math.abs(p.x - this.x) < 1 && Math.abs(p.y + 0.5 - this.y) < 1.5 && Math.abs(p.z - this.z) < 1) { if (!p.creative) p.give(I('arrow'), 1); g.sfx('pop', this.x, this.y, this.z); this.dead = true; }
      if (!g.world.getBlock(this.sx, this.sy, this.sz)) this.stuck = false;
      return;
    }
    this.vy -= 20 * dt;
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const nx = this.x + this.vx * dt / steps, ny = this.y + this.vy * dt / steps, nz = this.z + this.vz * dt / steps;
      const bx = Math.floor(nx), by = Math.floor(ny), bz = Math.floor(nz);
      const id = g.world.getBlock(bx, by, bz);
      if (id && BLOCKS[id].solid) {
        this.stuck = true; this.sx = bx; this.sy = by; this.sz = bz;
        g.sfx('arrow_hit', nx, ny, nz);
        if (id === BL.target) g.targetHit(bx, by, bz);
        if (id === BL.tnt && this.fire) g.igniteTNT(bx, by, bz);
        return;
      }
      this.x = nx; this.y = ny; this.z = nz;
      // 개체 명중
      const hit = g.hitTestEntities(this.x, this.y, this.z, 0.3, this.owner);
      if (hit) {
        const sp = Math.hypot(this.vx, this.vy, this.vz);
        g.damageEntity(hit, Math.ceil(sp / 8), this.vx / sp, this.vz / sp, 'arrow');
        this.dead = true; return;
      }
    }
    this.yaw = Math.atan2(-this.vx, -this.vz); this.pitch = Math.atan2(this.vy, Math.hypot(this.vx, this.vz));
    this.checkFluids(g.world);
    if (this.inWater) { this.vx *= 0.9; this.vy *= 0.9; this.vz *= 0.9; }
  }
  render(g, R, cam) {
    const m = M4.create(), t = M4.create();
    M4.translate(m, this.x - cam[0], this.y - cam[1], this.z - cam[2]);
    M4.mul(m, m, M4.rotY(t, this.yaw)); M4.mul(m, m, M4.rotX(t, this.pitch));
    const L = this.lightAt(g.world);
    R.ent.addBox(m, -0.03, -0.03, -0.25, 0.03, 0.03, 0.25, [0.45, 0.33, 0.2], L[0], L[1]);
    R.ent.addBox(m, -0.05, -0.05, -0.32, 0.05, 0.05, -0.25, [0.7, 0.7, 0.72], L[0], L[1]);
    R.ent.addBox(m, -0.07, -0.01, 0.15, 0.07, 0.01, 0.25, [0.95, 0.95, 0.95], L[0], L[1]);
  }
}

// ------------------ 광산 수레 ------------------
class Minecart extends Entity {
  constructor(x, y, z) { super('cart', 0.98, 0.7); this.x = x; this.y = y; this.z = z; this.speed = 0; this.dir = [0, 0]; this.rider = null; this.stepHeight = 0; this.hp = 6; }
  pushDir(look, dt) {
    if (Math.abs(this.speed) < 0.5 || this.onRail) {
      const f = [look[0], look[2]]; const l = Math.hypot(f[0], f[1]) || 1;
      this.vx += f[0] / l * 4 * dt; this.vz += f[1] / l * 4 * dt;
    }
  }
  railAt(g) {
    const bx = Math.floor(this.x), bz = Math.floor(this.z);
    for (const oy of [0, -1]) { const by = Math.floor(this.y + 0.1) + oy; const id = g.world.getBlock(bx, by, bz); if (isRail(id)) return [bx, by, bz, id, g.world.getMeta(bx, by, bz)]; }
    return null;
  }
  update(dt, g) {
    this.age += dt;
    const r = this.railAt(g);
    this.onRail = !!r;
    if (!r) {
      this.vy -= 20 * dt;
      const fr = this.onGround ? Math.exp(-3 * dt) : 1;
      this.vx *= fr; this.vz *= fr;
      this.move(g.world, this.vx * dt, this.vy * dt, this.vz * dt);
      return;
    }
    const [bx, by, bz, id, meta] = r;
    const shape = railShapeOf(id, meta);
    const [d1, d2] = RAIL_DIRS[shape];
    // 레일 방향 벡터 (곡선: 두 끝을 잇는 방향 사용)
    let ax = DX[d1] - DX[d2], az = DZ[d1] - DZ[d2];
    const straight = shape < 6;
    if (!straight) { ax = DX[d1] + DX[d2]; az = DZ[d1] + DZ[d2]; }
    // 속도를 레일 방향으로 투영
    let v = this.vx * ax + this.vz * az;
    const al = Math.hypot(ax, az); ax /= al; az /= al; v /= al;
    if (!straight) {
      // 곡선: 진행 방향에 따라 두 출구 중 하나로
      const cx = bx + 0.5, cz = bz + 0.5;
      const e1 = [DX[d1], DZ[d1]], e2 = [DX[d2], DZ[d2]];
      const vel = [this.vx, this.vz];
      const into1 = vel[0] * e1[0] + vel[1] * e1[1], into2 = vel[0] * e2[0] + vel[1] * e2[1];
      const sp = Math.hypot(this.vx, this.vz);
      const out = into1 > into2 ? e1 : e2;
      // 중심을 지나면 출구 방향으로 꺾음
      const rel = [this.x - cx, this.z - cz];
      const pastCenter = (rel[0] * out[0] + rel[1] * out[1]) > -0.05;
      if (pastCenter) { this.vx = out[0] * sp; this.vz = out[1] * sp; this.x = out[0] !== 0 ? this.x : cx; this.z = out[1] !== 0 ? this.z : cz; }
      else { const inn = out === e1 ? e2 : e1; this.vx = -inn[0] * sp; this.vz = -inn[1] * sp; if (inn[0] === 0) this.x = cx; else this.z = cz; }
    } else {
      this.vx = ax * v; this.vz = az * v;
      if (ax === 0) this.x += (bx + 0.5 - this.x) * Math.min(1, dt * 10);
      if (az === 0) this.z += (bz + 0.5 - this.z) * Math.min(1, dt * 10);
    }
    // 경사
    const up = RAIL_UP[shape];
    let slope = 0;
    if (up >= 0) {
      const ux = DX[up], uz = DZ[up];
      this.vx -= ux * 9 * dt; this.vz -= uz * 9 * dt;
      const along = (this.x - bx - 0.5) * ux + (this.z - bz - 0.5) * uz; // -0.5 ~ 0.5
      slope = along + 0.5;
    }
    // 전동 레일
    if (id === BL.powered_rail) {
      const sp = Math.hypot(this.vx, this.vz);
      if (meta & 8) {
        if (sp < 0.3) { // 멈춰있으면 옆 블록 반대쪽으로 출발
          const ex = ax !== 0, dir = ex ? [1, 0] : [0, 1];
          let s = 1;
          const solidA = BLOCKS[g.world.getBlock(bx - dir[0], by, bz - dir[1])].solid, solidB = BLOCKS[g.world.getBlock(bx + dir[0], by, bz + dir[1])].solid;
          if (solidB && !solidA) s = -1;
          this.vx = dir[0] * s * 2; this.vz = dir[1] * s * 2;
        } else { const k = Math.min(sp + 20 * dt, 12) / sp; this.vx *= k; this.vz *= k; }
      } else { const k = Math.exp(-6 * dt); this.vx *= k; this.vz *= k; }
    }
    if (id === BL.detector_rail && !(meta & 8) && g.redstone) g.world.schedule(bx, by, bz, 1, 1);
    // 마찰
    const fr = Math.exp(-(this.rider ? 0.15 : 0.3) * dt);
    this.vx *= fr; this.vz *= fr;
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 14) { this.vx *= 14 / sp; this.vz *= 14 / sp; }
    // 이동 (레일을 따라가므로 충돌은 수평만 간단히)
    const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const nb = Math.floor(nx), nzb = Math.floor(nz);
    let ny = by;
    const cur = g.world.getBlock(nb, by, nzb);
    if (isRail(cur)) ny = by;
    else if (isRail(g.world.getBlock(nb, by + 1, nzb))) ny = by + 1;
    else if (isRail(g.world.getBlock(nb, by - 1, nzb))) ny = by - 1;
    else if (cur && BLOCKS[cur].solid) { this.vx = -this.vx * 0.3; this.vz = -this.vz * 0.3; return; }
    this.x = nx; this.z = nz;
    const r2 = this.railAt(g) || [nb, ny, nzb, cur, 0];
    const sh2 = isRail(r2[3]) ? railShapeOf(r2[3], r2[4]) : 0;
    const up2 = isRail(r2[3]) ? RAIL_UP[sh2] : -1;
    let yy = r2[1] + 0.0625;
    if (up2 >= 0) { const along = (this.x - r2[0] - 0.5) * DX[up2] + (this.z - r2[2] - 0.5) * DZ[up2]; yy += along + 0.5; }
    this.y = yy; this.vy = 0; this.onGround = true;
    this.yaw = Math.atan2(-this.vx, -this.vz) || this.yaw;
    // 부딪힌 개체 밀기
    if (sp > 1) for (const e of g.ents.list) if (e.type === 'mob' && Math.abs(e.x - this.x) < 0.8 && Math.abs(e.z - this.z) < 0.8 && Math.abs(e.y - this.y) < 1) { e.vx += this.vx * 0.5; e.vz += this.vz * 0.5; e.vy = 4; }
  }
  render(g, R, cam) {
    const m = M4.create(), t = M4.create();
    M4.translate(m, this.x - cam[0], this.y - cam[1], this.z - cam[2]);
    M4.mul(m, m, M4.rotY(t, this.yaw));
    const L = this.lightAt(g.world);
    const c = [0.45, 0.46, 0.5], d = [0.3, 0.3, 0.33];
    R.ent.addBox(m, -0.45, 0.1, -0.6, 0.45, 0.2, 0.6, d, L[0], L[1]);
    R.ent.addBox(m, -0.45, 0.1, -0.6, -0.38, 0.7, 0.6, c, L[0], L[1]);
    R.ent.addBox(m, 0.38, 0.1, -0.6, 0.45, 0.7, 0.6, c, L[0], L[1]);
    R.ent.addBox(m, -0.45, 0.1, -0.6, 0.45, 0.7, -0.53, c, L[0], L[1]);
    R.ent.addBox(m, -0.45, 0.1, 0.53, 0.45, 0.7, 0.6, c, L[0], L[1]);
    for (const [wx, wz] of [[-0.46, -0.35], [0.46, -0.35], [-0.46, 0.35], [0.46, 0.35]]) R.ent.addBox(m, wx - 0.04, 0, wz - 0.1, wx + 0.04, 0.2, wz + 0.1, [0.15, 0.15, 0.15], L[0], L[1]);
  }
}

// ------------------ 몹 ------------------
class Mob extends Entity {
  constructor(sub, x, y, z) {
    const T0 = MOB_TYPES[sub];
    super('mob', T0.w, T0.h);
    this.sub = sub; this.def = T0; this.hp = T0.hp; this.x = x; this.y = y; this.z = z;
    this.walk = 0; this.wanderT = Math.random() * 3; this.target = null; this.tx = 0; this.tz = 0;
    this.hurtT = 0; this.attackT = 0; this.fuse = 0; this.panic = 0; this.burnT = 0; this.headYaw = 0;
    this.yaw = Math.random() * 6.28; this.stepHeight = 0.6;
  }
  update(dt, g) {
    this.age += dt;
    const w = g.world;
    this.checkFluids(w);
    if (this.hurtT > 0) this.hurtT -= dt;
    let mx = 0, mz = 0, want = 0;
    const D = this.def;
    // ---- AI ----
    const players = g.allPlayers();
    if (D.hostile && !g.settings.peaceful) {
      let best = null, bd = 18 * 18;
      for (const p of players) { if (p.dead || p.creative) continue; const d = (p.x - this.x) ** 2 + (p.y - this.y) ** 2 + (p.z - this.z) ** 2; if (d < bd) { bd = d; best = p; } }
      this.target = best;
    } else if (D.hostile) { this.dead = true; return; }
    if (this.target) {
      const p = this.target;
      const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
      this.yaw = Math.atan2(-dx, -dz);
      if (D.ranged) {
        if (dist > 7) want = 1; else if (dist < 4) want = -0.6;
        this.attackT -= dt;
        if (this.attackT <= 0 && dist < 16 && g.lineOfSight(this.x, this.y + 1.6, this.z, p.x, p.y + 1.5, p.z)) {
          this.attackT = 2 + Math.random();
          const ty = p.y + 1.2 - (this.y + 1.5);
          const sp = 18;
          const vx = dx / dist * sp, vz = dz / dist * sp, vy = ty / dist * sp + dist * 0.55;
          g.spawnArrow(this.x, this.y + 1.5, this.z, vx, vy, vz, 'mob');
        }
      } else if (D.creeper) {
        if (dist < 3 && Math.abs(p.y - this.y) < 2.5) { this.fuse += dt; want = 0; if (this.fuse > 0.1 && !this.hissed) { this.hissed = true; g.sfx('fuse', this.x, this.y + 1, this.z); } }
        else { this.fuse = Math.max(0, this.fuse - dt); want = 1; this.hissed = false; }
        if (this.fuse >= 1.5) { this.dead = true; g.explode(this.x, this.y + 0.8, this.z, 3); return; }
      } else {
        want = dist > 0.9 ? 1 : 0;
        this.attackT -= dt;
        if (dist < 1.4 && Math.abs(p.y - this.y) < 1.6 && this.attackT <= 0) {
          this.attackT = 1;
          g.hurtPlayer(p, D.dmg || 2, 'mob', dx / (dist || 1), dz / (dist || 1));
        }
      }
    } else {
      this.wanderT -= dt;
      if (this.panic > 0) { this.panic -= dt; want = 1.8; if (this.wanderT <= 0) { this.yaw += (Math.random() - 0.5) * 2; this.wanderT = 0.7; } }
      else if (this.wanderT <= 0) {
        this.wanderT = 2 + Math.random() * 5;
        this.walking = Math.random() < 0.55;
        this.yaw += (Math.random() - 0.5) * 3;
      }
      if (this.walking && this.panic <= 0) want = 0.6;
    }
    // 이동
    const sp = D.speed * want;
    mx = -Math.sin(this.yaw) * sp; mz = -Math.cos(this.yaw) * sp;
    const k = 1 - Math.exp(-(this.onGround ? 12 : 2) * dt);
    this.vx += (mx - this.vx) * k; this.vz += (mz - this.vz) * k;
    if (this.inWater || this.inLava) { this.vy += (1.5 - this.vy) * dt * 3; }
    else this.vy -= 28 * dt;
    if (this.onGround && this.hitH && want > 0) this.vy = 8.5;
    const prevG = this.onGround;
    const mv = this.move(w, this.vx * dt, this.vy * dt, this.vz * dt);
    if (!this.onGround && mv[1] < 0) this.fallDist -= mv[1];
    if (this.onGround && !prevG) { if (this.fallDist > 3.5) g.damageEntity(this, Math.floor(this.fallDist - 3), 0, 0, 'fall'); this.fallDist = 0; }
    this.walk += Math.hypot(mv[0], mv[2]) * 2.2;
    // 햇빛에 탐
    if (D.burns && w.dayFactor() > 0.6 && !this.inWater) {
      const L = w.getLight(Math.floor(this.x), Math.floor(this.y + 1.6), Math.floor(this.z));
      if ((L >> 4) >= 15) { this.burnT += dt; if (this.burnT > 1) { this.burnT = 0; g.damageEntity(this, 1, 0, 0, 'fire'); g.particles.smoke(this.x, this.y + 1.8, this.z, 3, [1, 0.6, 0.2]); } }
    }
    if (this.inLava) { this.burnT += dt; if (this.burnT > 0.5) { this.burnT = 0; g.damageEntity(this, 4, 0, 0, 'lava'); } }
    if (this.y < -20) this.dead = true;
    // 닭이 알을 낳음
    if (this.sub === 'chicken' && Math.random() < dt / 300) g.dropItem(this.x, this.y + 0.3, this.z, { id: I('egg'), n: 1 });
  }
  render(g, R, cam) { if (this.sheared && (this.woolT -= 1 / 60) <= 0) this.sheared = false; renderMobModel(R, this.sheared ? 'sheep_s' : this.sub, this.x - cam[0], this.y - cam[1], this.z - cam[2], this.yaw, this.walk, this.lightAt(g.world), this.hurtT > 0, this.fuse); }
}

function renderMobModel(R, sub, x, y, z, yaw, walk, L, hurt, fuse) {
  const sheared = sub === 'sheep_s'; if (sheared) sub = 'sheep';
  const base = M4.create(), t = M4.create();
  M4.translate(base, x, y, z); M4.mul(base, base, M4.rotY(t, yaw));
  if (fuse > 0) { const s = 1 + fuse * 0.15; const sm = M4.create(); sm[0] = sm[10] = s; sm[5] = 1 + fuse * 0.05; M4.mul(base, base, sm); }
  const sw = Math.sin(walk) * 0.7;
  const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : (fuse > 0 && (Math.floor(fuse * 8) % 2) ? [1, 1, 1] : c);
  const box = (m, x0, y0, z0, x1, y1, z1, c) => R.ent.addBox(m, x0, y0, z0, x1, y1, z1, tint(c), L[0], L[1]);
  const limb = (px, py, pz, ang) => { const m = new Float32Array(base); const tr = M4.create(); M4.translate(tr, px, py, pz); M4.mul(m, m, tr); M4.mul(m, m, M4.rotX(t, ang)); return m; };
  const P = 1 / 16;
  if (sub === 'pig' || sub === 'cow' || sub === 'sheep') {
    const isCow = sub === 'cow', isSheep = sub === 'sheep';
    const body = isCow ? [0.55, 0.35, 0.22] : isSheep ? (sheared ? [0.88, 0.78, 0.7] : [0.93, 0.93, 0.9]) : [0.95, 0.66, 0.66];
    const skin = isCow ? [0.35, 0.22, 0.14] : isSheep ? [0.85, 0.75, 0.65] : [0.95, 0.66, 0.66];
    const legH = isCow ? 12 * P : 6 * P;
    const bw = isCow ? 6 * P : 5 * P, bl = isCow ? 9 * P : 8 * P, bh = isCow ? 10 * P : 8 * P;
    box(base, -bw, legH, -bl, bw, legH + bh, bl, body);
    if (isCow) { box(base, -bw - 0.01, legH + 3 * P, -2 * P, 0.01 - bw + 3 * P, legH + 8 * P, 4 * P, [0.95, 0.95, 0.95]); }
    for (const [lx, lz, ph] of [[-bw + 2 * P, -bl + 2 * P, sw], [bw - 2 * P, -bl + 2 * P, -sw], [-bw + 2 * P, bl - 2 * P, -sw], [bw - 2 * P, bl - 2 * P, sw]]) {
      const m = limb(lx, legH, lz, ph); box(m, -2 * P, -legH, -2 * P, 2 * P, 0, 2 * P, isSheep ? skin : body);
    }
    const hm = limb(0, legH + bh - 2 * P, -bl, 0);
    const hs = isCow ? 4 * P : 4 * P;
    box(hm, -hs, -2 * P, -8 * P, hs, 6 * P, 0, isSheep ? skin : body);
    box(hm, -1.6 * P - 1.5 * P, 2 * P, -8.05 * P, -1.5 * P, 3.6 * P, -8 * P, [0.1, 0.1, 0.1]);
    box(hm, 1.5 * P, 2 * P, -8.05 * P, 3.1 * P, 3.6 * P, -8 * P, [0.1, 0.1, 0.1]);
    if (sub === 'pig') box(hm, -2 * P, -1 * P, -9 * P, 2 * P, 2 * P, -8 * P, [0.9, 0.55, 0.58]);
    if (isCow) { box(hm, -3 * P, -2 * P, -9 * P, 3 * P, 1 * P, -8 * P, [0.85, 0.75, 0.7]); box(hm, -5 * P, 5 * P, -6 * P, -4 * P, 8 * P, -5 * P, [0.9, 0.9, 0.85]); box(hm, 4 * P, 5 * P, -6 * P, 5 * P, 8 * P, -5 * P, [0.9, 0.9, 0.85]); }
  } else if (sub === 'chicken') {
    const legH = 5 * P;
    box(base, -3 * P, legH, -4 * P, 3 * P, legH + 6 * P, 4 * P, [0.97, 0.97, 0.95]);
    box(base, -3.5 * P, legH + 1 * P, -3 * P, -3 * P, legH + 5 * P, 3 * P, [0.9, 0.9, 0.88]);
    box(base, 3 * P, legH + 1 * P, -3 * P, 3.5 * P, legH + 5 * P, 3 * P, [0.9, 0.9, 0.88]);
    for (const [lx, ph] of [[-1.5 * P, sw], [1.5 * P, -sw]]) { const m = limb(lx, legH, 0, ph); box(m, -0.5 * P, -legH, -0.5 * P, 0.5 * P, 0, 0.5 * P, [0.95, 0.7, 0.1]); }
    const hm = limb(0, legH + 5 * P, -4 * P, 0);
    box(hm, -2 * P, 0, -3 * P, 2 * P, 6 * P, 0, [0.97, 0.97, 0.95]);
    box(hm, -2 * P, 2.5 * P, -5 * P, 2 * P, 4 * P, -3 * P, [0.95, 0.7, 0.1]);
    box(hm, -1 * P, 0.5 * P, -4 * P, 1 * P, 2.5 * P, -3 * P, [0.85, 0.1, 0.1]);
    box(hm, -2.05 * P, 4 * P, -2.5 * P, 2.05 * P, 5 * P, -1.5 * P, [0.05, 0.05, 0.05]);
  } else if (sub === 'creeper') {
    const green = [0.35, 0.72, 0.3], dark = [0.2, 0.45, 0.18];
    box(base, -4 * P, 6 * P, -2 * P, 4 * P, 18 * P, 2 * P, green);
    for (const [lx, lz, ph] of [[-2 * P, -4 * P, sw], [2 * P, -4 * P, -sw], [-2 * P, 4 * P, -sw], [2 * P, 4 * P, sw]]) { const m = limb(lx, 6 * P, lz, ph * 0.6); box(m, -2 * P, -6 * P, -2 * P, 2 * P, 0, 2 * P, dark); }
    const hm = limb(0, 18 * P, 0, 0);
    box(hm, -4 * P, 0, -4 * P, 4 * P, 8 * P, 4 * P, green);
    const bl = [0.05, 0.08, 0.05];
    box(hm, -3 * P, 4 * P, -4.05 * P, -1 * P, 6 * P, -4 * P, bl); box(hm, 1 * P, 4 * P, -4.05 * P, 3 * P, 6 * P, -4 * P, bl);
    box(hm, -1 * P, 1 * P, -4.05 * P, 1 * P, 4 * P, -4 * P, bl); box(hm, -2 * P, 0.5 * P, -4.05 * P, 2 * P, 2 * P, -4 * P, bl);
  } else {
    // 사람형 (좀비, 스켈레톤, 플레이어)
    const isSk = sub === 'skeleton', isZ = sub === 'zombie';
    const skin = isSk ? [0.85, 0.85, 0.82] : isZ ? [0.36, 0.55, 0.35] : [0.87, 0.67, 0.53];
    const shirt = isSk ? skin : isZ ? [0.2, 0.62, 0.65] : (R._skin || [0.2, 0.55, 0.85]);
    const pants = isSk ? skin : isZ ? [0.25, 0.25, 0.6] : [0.22, 0.24, 0.45];
    const th = isSk ? 1 * P : 2 * P;
    renderHumanoid(R, base, t, sw, skin, shirt, pants, th, isZ || isSk, L, hurt);
  }
}
function renderHumanoid(R, base, t, sw, skin, shirt, pants, th, armsForward, L, hurt, headPitch, hair, extraSwing) {
  const P = 1 / 16;
  const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
  const box = (m, x0, y0, z0, x1, y1, z1, c) => R.ent.addBox(m, x0, y0, z0, x1, y1, z1, tint(c), L[0], L[1]);
  const limb = (px, py, pz, ax, az) => { const m = new Float32Array(base); const tr = M4.create(); M4.translate(tr, px, py, pz); M4.mul(m, m, tr); M4.mul(m, m, M4.rotX(t, ax)); if (az) M4.mul(m, m, M4.rotZ(t, az)); return m; };
  box(base, -4 * P, 12 * P, -2 * P, 4 * P, 24 * P, 2 * P, shirt);
  for (const [lx, ph] of [[-2 * P, sw], [2 * P, -sw]]) { const m = limb(lx, 12 * P, 0, ph); box(m, -th, -12 * P, -th, th, 0, th, pants); }
  const armA = armsForward ? -1.5 : 0;
  for (const [ax, ph, side] of [[-6 * P, -sw, -1], [6 * P, sw, 1]]) {
    const extra = side === 1 && extraSwing ? -extraSwing * 1.4 : 0;
    const m = limb(ax, 22 * P, 0, armA + ph * (armsForward ? 0.2 : 1) + extra); box(m, -th, -12 * P + 2 * P, -th, th, 2 * P, th, armsForward ? skin : shirt);
    if (!armsForward) box(m, -th - 0.002, -12 * P + 1.99 * P, -th - 0.002, th + 0.002, -6 * P, th + 0.002, skin);
  }
  const hm = limb(0, 24 * P, 0, headPitch || 0);
  box(hm, -4 * P, 0, -4 * P, 4 * P, 8 * P, 4 * P, skin);
  if (hair) box(hm, -4.2 * P, 6 * P, -4.2 * P, 4.2 * P, 8.3 * P, 4.2 * P, hair);
  const eye = [0.15, 0.15, 0.25];
  box(hm, -3 * P, 3 * P, -4.05 * P, -1 * P, 4.3 * P, -4 * P, [1, 1, 1]); box(hm, -2 * P, 3 * P, -4.07 * P, -1 * P, 4.3 * P, -4.05 * P, eye);
  box(hm, 1 * P, 3 * P, -4.05 * P, 3 * P, 4.3 * P, -4 * P, [1, 1, 1]); box(hm, 1 * P, 3 * P, -4.07 * P, 2 * P, 4.3 * P, -4.05 * P, eye);
}

// ------------------ 파티클 ------------------
class Particles {
  constructor() { this.list = []; this.buf = new MeshBuf(2048); }
  add(p) { if (this.list.length < 1500) this.list.push(p); }
  blockBreak(x, y, z, id, meta) {
    const d = BLOCKS[id]; if (!d) return;
    const layer = blockTex(d, meta, 2);
    for (let i = 0; i < 24; i++) {
      this.add({ x: x + Math.random(), y: y + Math.random(), z: z + Math.random(), vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 4,
        life: 0.6 + Math.random() * 0.5, size: 0.08 + Math.random() * 0.06, layer, u: Math.random() * 0.75, v: Math.random() * 0.75, g: 18, tint: d.tint === 'leaves' || d.tint === 'grass' ? [0.75, 1, 0.6] : null });
    }
  }
  smoke(x, y, z, n, col, big) {
    const layer = T('white');
    for (let i = 0; i < n; i++) this.add({ x: x + (Math.random() - 0.5) * (big ? 3 : 0.5), y: y + (Math.random() - 0.5) * (big ? 3 : 0.5), z: z + (Math.random() - 0.5) * (big ? 3 : 0.5),
      vx: (Math.random() - 0.5) * (big ? 6 : 1), vy: Math.random() * (big ? 4 : 1.5), vz: (Math.random() - 0.5) * (big ? 6 : 1), life: 0.6 + Math.random() * (big ? 1.2 : 0.6),
      size: (big ? 0.35 : 0.1) + Math.random() * 0.15, layer, u: 0, v: 0, g: -1, tint: col || [0.8, 0.8, 0.8], emissive: col && col[0] > 0.9 && col[2] < 0.5 });
  }
  dust(x, y, z, col) { this.add({ x, y, z, vx: 0, vy: 0.5, vz: 0, life: 0.5, size: 0.06, layer: T('white'), u: 0, v: 0, g: 0, tint: col, emissive: true }); }
  update(dt, world) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy -= p.g * dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      const id = world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
      if (id && BLOCKS[id].solid && p.g > 0) { p.vx *= 0.3; p.vz *= 0.3; p.vy = 0; } else { p.x = nx; p.y = ny; p.z = nz; }
    }
  }
  build(cam, yaw, pitch, world) {
    const b = this.buf; b.reset();
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const ux = Math.sin(yaw) * Math.sin(pitch), uy = Math.cos(pitch), uz = Math.cos(yaw) * Math.sin(pitch);
    for (const p of this.list) {
      const s = p.size;
      const L = world.getLight(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      const sky = (L >> 4) * 17, blk = Math.max((L & 15) * 17, p.emissive ? 255 : 0);
      const t = p.tint ? [p.tint[0] * 170 | 0, p.tint[1] * 170 | 0, p.tint[2] * 170 | 0] : [170, 170, 170];
      const cx = p.x - cam[0], cy = p.y - cam[1], cz = p.z - cam[2];
      const u0 = p.u, v0 = p.v, u1 = p.u + 0.25, v1 = p.v + 0.25;
      const fl = 3 | (p.emissive ? 32 : 0);
      const pts = [[-1, -1, u0, v1], [1, -1, u1, v1], [1, 1, u1, v0], [-1, 1, u0, v0]];
      for (const [a, c, u, v] of pts) b.vert(cx + (rx * a + ux * c) * s, cy + uy * c * s, cz + (rz * a + uz * c) * s, u, v, p.layer, fl, sky, blk, 255, 0, t[0], t[1], t[2]);
    }
    return b;
  }
}

// ------------------ 개체 관리 ------------------
class EntityManager {
  constructor(game) { this.g = game; this.list = []; this.byId = new Map(); this.net = new Map(); this.frame = 0; }
  add(e) { this.list.push(e); this.byId.set(e.eid, e); return e; }
  update(dt) {
    const g = this.g;
    const p = g.player;
    this.frame = (this.frame + 1) | 0;
    for (const e of this.list) {
      if (e.dead) continue;
      if (!g.world.isLoadedAt(Math.floor(e.x), Math.floor(e.z))) continue;
      if (e.remote) { e.interp(dt); continue; }
      // (최적화) 40칸보다 먼 몹은 4프레임에 한 번만 (모은 시간으로) 움직임
      if (e.type === 'mob' && !(e.def && (e.def.boss || e.def.flying))) {
        const d2 = (e.x - p.x) ** 2 + (e.z - p.z) ** 2;
        if (d2 > (g._perfThrottle2 || 1600) && g.remotes.size === 0) {
          e._acc = (e._acc || 0) + dt;
          if (((this.frame + e.eid) & 3) !== 0) continue;
          const t = Math.min(0.2, e._acc); e._acc = 0; e.update(t, g); continue;
        }
        e._acc = 0;
      }
      e.update(dt, g);
    }
    // 몹끼리/플레이어와 겹치지 않게 살짝 밀기 (가까운 몹만)
    for (const e of this.list) {
      if (e.dead || e.type !== 'mob' || e.remote || e.rider) continue;
      if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > (g._perfThrottle2 || 1600)) continue;
      const push = (ox, oy, oz, ow, oh, k) => {
        const dx = e.x - ox, dz = e.z - oz, min = e.w / 2 + ow / 2;
        if (Math.abs(dx) >= min || Math.abs(dz) >= min || e.y > oy + oh || e.y + e.h < oy) return;
        const d = Math.hypot(dx, dz) || 0.01;
        const f = (min - d) * 6 * dt;
        e.vx += dx / d * f * 10 * k; e.vz += dz / d * f * 10 * k;
      };
      if (!p.dead) push(p.x, p.y, p.z, p.w, p.h, 1);
      for (const o of this.list) if (o !== e && !o.dead && o.type === 'mob') push(o.x, o.y, o.z, o.w, o.h, 0.5);
    }
    let j = 0;
    for (let i = 0; i < this.list.length; i++) { const e = this.list[i]; if (!e.dead) this.list[j++] = e; else { this.byId.delete(e.eid); if (e.onRemove) e.onRemove(g); } }
    this.list.length = j;
  }
  count(pred) { let n = 0; for (const e of this.list) if (!e.dead && pred(e)) n++; return n; }
}

// 멀티플레이: 호스트가 보내준 개체의 그림자
class NetEntity extends Entity {
  constructor(eid, type) { super(type, 0.6, 1); this.eid = eid; this.remote = true; this.tx = 0; this.ty = 0; this.tz = 0; this.walk = 0; this.has = false; }
  setState(s) {
    // s: [eid, typeCode, x, y, z, yaw, sub/block, flags, extra]
    this.tx = s[2]; this.ty = s[3]; this.tz = s[4]; this.tyaw = s[5];
    this.sub = s[6]; this.flags = s[7]; this.extra = s[8];
    if (!this.has) { this.x = this.tx; this.y = this.ty; this.z = this.tz; this.yaw = this.tyaw; this.has = true; }
    this.seen = performance.now();
  }
  interp(dt) {
    const k = Math.min(1, dt * 12);
    const ox = this.x, oz = this.z;
    this.x += (this.tx - this.x) * k; this.y += (this.ty - this.y) * k; this.z += (this.tz - this.z) * k;
    let dy = this.tyaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; this.yaw += dy * k;
    this.walk += Math.hypot(this.x - ox, this.z - oz) * 2.2;
    if (performance.now() - this.seen > 3000) this.dead = true;
  }
  render(g, R, cam) {
    const t = this.type;
    const L = this.lightAt(g.world);
    if (t === 'mob') { if (MOB_TYPES[this.sub]) { this.w = MOB_TYPES[this.sub].w; this.h = MOB_TYPES[this.sub].h; } renderMobModel(R, this.sub, this.x - cam[0], this.y - cam[1], this.z - cam[2], this.yaw, this.walk, L, !!(this.flags & 1), this.extra || 0); }
    else if (t === 'tnt' || t === 'falling') {
      const mesh = g.blockMesh(t === 'tnt' ? BL.tnt : this.sub, 0);
      const m = M4.create(); M4.translate(m, this.x - cam[0], this.y + 0.49 - cam[1], this.z - cam[2]);
      g.frame.blockEnts.push({ mesh, model: m, light: L, flash: this.flags & 1 ? 0.6 : 0 });
    } else if (t === 'arrow') { ArrowEntity.prototype.render.call(Object.assign(this, { pitch: this.extra || 0 }), g, R, cam); }
    else if (t === 'cart') Minecart.prototype.render.call(this, g, R, cam);
  }
}
function entityNetState(e) {
  const code = ETYPE_CODES.indexOf(e.type);
  const r3 = (v) => Math.round(v * 100) / 100;
  if (e.type === 'mob') return [e.eid, code, r3(e.x), r3(e.y), r3(e.z), r3(e.yaw), e.sub, e.hurtT > 0 ? 1 : 0, r3(e.fuse / 1.5)];
  if (e.type === 'tnt') return [e.eid, code, r3(e.x), r3(e.y), r3(e.z), 0, 0, (Math.floor(e.fuse / 5) % 2) ? 1 : 0, 0];
  if (e.type === 'falling') return [e.eid, code, r3(e.x), r3(e.y), r3(e.z), 0, e.block, 0, 0];
  if (e.type === 'arrow') return [e.eid, code, r3(e.x), r3(e.y), r3(e.z), r3(e.yaw), 0, 0, r3(e.pitch)];
  if (e.type === 'cart') return [e.eid, code, r3(e.x), r3(e.y), r3(e.z), r3(e.yaw), 0, 0, 0];
  return null;
}
