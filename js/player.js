'use strict';
// =====================================================================
// 플레이어: 이동 물리, 충돌, 생존 수치, 광선 투사
// =====================================================================

// 월드에서 AABB 와 겹치는 충돌 상자 모으기
function collectBoxes(world, x0, y0, z0, x1, y1, z1, out) {
  out.length = 0;
  const bx0 = Math.floor(x0), by0 = Math.floor(y0) - 1, bz0 = Math.floor(z0);
  const bx1 = Math.floor(x1), by1 = Math.floor(y1), bz1 = Math.floor(z1);
  for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) {
    if (!world.isLoadedAt(x, z)) { out.push([x, -64, z, x + 1, 512, z + 1]); continue; }
    for (let y = by0; y <= by1; y++) {
      const id = world.getBlock(x, y, z); if (!id) continue;
      const d = BLOCKS[id]; if (!d.solid) continue;
      const bs = blockBoxes(id, world.getMeta(x, y, z), false, world, x, y, z);
      if (!bs) continue;
      for (const b of bs) out.push([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]);
    }
  }
  return out;
}

// 이동 가능한 AABB 개체 (플레이어, 몹, 아이템 공용)
class Body {
  constructor(w, h) {
    this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0;
    this.w = w; this.h = h; this.onGround = false; this.hitH = false; this.hitV = false;
    this.inWater = false; this.inLava = false; this.fallDist = 0; this._boxes = [];
    this.stepHeight = 0.6;
  }
  aabb() { const r = this.w / 2; return [this.x - r, this.y, this.z - r, this.x + r, this.y + this.h, this.z + r]; }
  // 축별 이동 + 충돌. 반환: 실제 이동량
  move(world, dx, dy, dz, sneakGuard) {
    const r = this.w / 2;
    let a = [this.x - r, this.y, this.z - r, this.x + r, this.y + this.h, this.z + r];
    const boxes = collectBoxes(world, Math.min(a[0], a[0] + dx) - 1, Math.min(a[1], a[1] + dy) - 1, Math.min(a[2], a[2] + dz) - 1,
      Math.max(a[3], a[3] + dx) + 1, Math.max(a[4], a[4] + dy) + 1, Math.max(a[5], a[5] + dz) + 1, this._boxes);
    // 웅크리기 가장자리 보호
    if (sneakGuard && this.onGround) {
      const supported = (ox, oz) => {
        for (const b of boxes) if (b[3] > a[0] + ox + 0.001 && b[0] < a[3] + ox - 0.001 && b[5] > a[2] + oz + 0.001 && b[2] < a[5] + oz - 0.001 && b[4] <= a[1] + 0.001 && b[4] > a[1] - 0.6) return true;
        return false;
      };
      const step = 0.05;
      while (dx !== 0 && !supported(dx, 0)) { if (Math.abs(dx) < step) dx = 0; else dx -= Math.sign(dx) * step; }
      while (dz !== 0 && !supported(0, dz)) { if (Math.abs(dz) < step) dz = 0; else dz -= Math.sign(dz) * step; }
      while (dx !== 0 && dz !== 0 && !supported(dx, dz)) { if (Math.abs(dz) < step) dz = 0; else dz -= Math.sign(dz) * step; }
    }
    const odx = dx, ody = dy, odz = dz;
    const clipY = (a, dy) => { for (const b of boxes) { if (b[3] <= a[0] || b[0] >= a[3] || b[5] <= a[2] || b[2] >= a[5]) continue; if (dy > 0 && b[1] >= a[4] - 1e-7) dy = Math.min(dy, b[1] - a[4]); else if (dy < 0 && b[4] <= a[1] + 1e-7) dy = Math.max(dy, b[4] - a[1]); } return dy; };
    const clipX = (a, dx) => { for (const b of boxes) { if (b[4] <= a[1] || b[1] >= a[4] || b[5] <= a[2] || b[2] >= a[5]) continue; if (dx > 0 && b[0] >= a[3] - 1e-7) dx = Math.min(dx, b[0] - a[3]); else if (dx < 0 && b[3] <= a[0] + 1e-7) dx = Math.max(dx, b[3] - a[0]); } return dx; };
    const clipZ = (a, dz) => { for (const b of boxes) { if (b[4] <= a[1] || b[1] >= a[4] || b[3] <= a[0] || b[0] >= a[3]) continue; if (dz > 0 && b[2] >= a[5] - 1e-7) dz = Math.min(dz, b[2] - a[5]); else if (dz < 0 && b[5] <= a[2] + 1e-7) dz = Math.max(dz, b[5] - a[2]); } return dz; };
    const shift = (a, x, y, z) => [a[0] + x, a[1] + y, a[2] + z, a[3] + x, a[4] + y, a[5] + z];
    const a0 = a;
    dy = clipY(a, dy); a = shift(a, 0, dy, 0);
    dx = clipX(a, dx); a = shift(a, dx, 0, 0);
    dz = clipZ(a, dz); a = shift(a, 0, 0, dz);
    // 계단 오르기
    const wasGround = this.onGround || (ody < 0 && dy !== ody);
    if (this.stepHeight > 0 && wasGround && (dx !== odx || dz !== odz)) {
      let b = a0;
      let sy = clipY(b, this.stepHeight); b = shift(b, 0, sy, 0);
      let sx = clipX(b, odx); b = shift(b, sx, 0, 0);
      let sz = clipZ(b, odz); b = shift(b, 0, 0, sz);
      let sd = clipY(b, -sy); b = shift(b, 0, sd, 0);
      if (sx * sx + sz * sz > dx * dx + dz * dz + 1e-6) { a = b; dx = sx; dz = sz; dy = sy + sd; }
    }
    this.hitH = dx !== odx || dz !== odz;
    this.hitV = dy !== ody;
    this.onGround = ody < 0 && dy !== ody;
    if (dx !== odx) this.vx = 0;
    if (dz !== odz) this.vz = 0;
    if (dy !== ody) this.vy = 0;
    this.x = (a[0] + a[3]) / 2; this.y = a[1]; this.z = (a[2] + a[5]) / 2;
    return [dx, dy, dz];
  }
  checkFluids(world) {
    const r = this.w / 2 - 0.001;
    this.inWater = false; this.inLava = false; this.inClimb = false; this.inCobweb = false;
    const x0 = Math.floor(this.x - r), x1 = Math.floor(this.x + r), z0 = Math.floor(this.z - r), z1 = Math.floor(this.z + r);
    const y0 = Math.floor(this.y + 0.01), y1 = Math.floor(this.y + this.h * 0.8);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
      const id = world.getBlock(x, y, z);
      if (id === BL.water) this.inWater = true; else if (id === BL.lava) this.inLava = true;
    }
    const cid = world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.2), Math.floor(this.z));
    if (BLOCKS[cid] && BLOCKS[cid].climb) this.inClimb = true;
  }
}

class Player extends Body {
  constructor(game) {
    super(0.6, 1.8);
    this.game = game;
    this.yaw = 0; this.pitch = 0; this.eye = 1.62;
    this.sneaking = false; this.sprinting = false; this.flying = false;
    this.health = 20; this.food = 20; this.sat = 5; this.exhaust = 0; this.air = 300;
    this.hurtTime = 0; this.invul = 0; this.dead = false; this.regenT = 0; this.starveT = 0; this.drownT = 0; this.lavaT = 0;
    this.inv = new Array(36).fill(null); this.sel = 0;
    this.armor = [null, null, null, null]; // 머리, 몸, 다리, 발
    this.creative = false;
    this.spawn = [0, 80, 0];
    this.walkDist = 0; this.bobPhase = 0; this.lastJumpTick = -100; this.stepSound = 0;
    this.riding = null;
    this.name = '플레이어';
    this.skin = [0.2, 0.55, 0.85];
  }
  get held() { return this.inv[this.sel]; }
  eyeY() { return this.y + (this.sneaking && !this.flying ? 1.27 : this.eye); }
  lookDir() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }
  update(dt, input, world) {
    if (this.dead) return;
    if (this.riding) { this.updateRiding(dt, input, world); return; }
    this.checkFluids(world);
    const creative = this.creative;
    if (!creative && this.flying) this.flying = false;
    this.sneaking = !!input.sneak && !this.flying;
    const fwd = input.moveF, str = input.moveS;
    const moving = Math.abs(fwd) > 0.05 || Math.abs(str) > 0.05;
    if (input.sprint && fwd > 0.5 && (creative || this.food > 6) && !this.sneaking) this.sprinting = true;
    if (!moving || fwd <= 0.1 || this.sneaking || this.hitH && !this.flying) this.sprinting = false;
    let speed = this.flying ? (this.sprinting ? 22 : 11) : this.sneaking ? 1.3 : this.sprinting ? 5.6 : 4.317;
    if (this.inWater && !this.flying) speed *= 0.5;
    if (this.inLava) speed *= 0.35;
    const under = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.05), Math.floor(this.z));
    if (under === BL.soul_sand && this.onGround && !this.flying) speed *= 0.55;
    // 입력 → 원하는 수평 속도
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    let tx = (-s * fwd + c * str), tz = (-c * fwd - s * str);
    const tl = Math.hypot(tx, tz); if (tl > 1) { tx /= tl; tz /= tl; }
    tx *= speed; tz *= speed;
    const below = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.05), Math.floor(this.z));
    const slip = below && BLOCKS[below].slippery;
    const accel = this.flying ? 6 : this.onGround ? (slip ? 1.5 : 18) : (this.inWater ? 5 : 2.8);
    const k = 1 - Math.exp(-accel * dt);
    this.vx += (tx - this.vx) * k; this.vz += (tz - this.vz) * k;
    // 수직
    if (this.flying) {
      const up = (input.jump ? 1 : 0) - (input.sneak ? 1 : 0);
      this.vy += (up * (this.sprinting ? 14 : 8) - this.vy) * (1 - Math.exp(-10 * dt));
      if (this.onGround && up < 0) this.flying = false;
    } else if (this.inWater || this.inLava) {
      this.vy -= (this.inLava ? 6 : 9) * dt;
      this.vy *= Math.exp(-(this.inLava ? 4 : 2.5) * dt);
      if (input.jump) this.vy = Math.min(this.vy + 22 * dt, 4);
      if (this.sneaking) this.vy -= 8 * dt;
      this.fallDist = 0;
    } else if (this.inClimb) {
      this.vy -= 32 * dt;
      if (this.vy < -2.5) this.vy = -2.5;
      if (input.jump || (this.hitH && moving)) this.vy = 3.2;
      else if (this.sneaking) this.vy = Math.max(this.vy, 0);
      this.fallDist = 0;
    } else {
      this.vy -= 32 * dt;
      if (this.vy < -78) this.vy = -78;
      if (input.jump && this.onGround && world.tick - this.lastJumpTick > 3) {
        this.vy = 9.0; this.lastJumpTick = world.tick;
        if (this.sprinting) { this.vx += -s * 2; this.vz += -c * 2; }
        this.exhaust += this.sprinting ? 0.2 : 0.05;
      }
    }
    // 자동 점프 (모바일)
    if (input.autoJump && this.onGround && this.hitH && moving && !this.flying && !this.sneaking) {
      const fx = Math.floor(this.x + Math.sign(this.vx || tx) * 0.6), fz = Math.floor(this.z + Math.sign(this.vz || tz) * 0.6);
      const by = Math.floor(this.y + 0.5);
      const a = world.getBlock(fx, by, fz), b = world.getBlock(fx, by + 1, fz), c2 = world.getBlock(fx, by + 2, fz);
      if (a && BLOCKS[a].solid && !(b && BLOCKS[b].solid) && !(c2 && BLOCKS[c2].solid)) this.vy = 9.0;
    }
    const prevY = this.y, wasGround = this.onGround, vyBefore = this.vy;
    this.stepHeight = this.flying ? 0 : 0.6;
    const mv = this.move(world, this.vx * dt, this.vy * dt, this.vz * dt, this.sneaking && !this.flying);
    // 낙하 거리 / 착지
    if (!this.onGround && mv[1] < 0 && !this.flying && !this.inWater) this.fallDist -= mv[1];
    if (this.onGround && !wasGround) {
      const land = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z));
      if (land === BL.slime_block && !this.sneaking && vyBefore < -3) { this.vy = -vyBefore * 0.8; this.onGround = false; this.fallDist = 0; }
      else {
        if (this.fallDist > 3.2 && !creative) this.hurt(Math.floor(this.fallDist - 3), 'fall');
        if (this.fallDist > 1.5 && this.game) this.game.stepSound(this, true);
      }
      this.fallDist = 0;
    }
    if (this.onGround || this.inWater || this.flying) this.fallDist = this.onGround ? 0 : this.fallDist;
    // 걸음
    const hs = Math.hypot(mv[0], mv[2]);
    if (this.onGround && !this.flying) {
      this.walkDist += hs; this.bobPhase += hs * 1.6;
      this.stepSound += hs;
      if (this.stepSound > 1.8 && this.game) { this.stepSound = 0; this.game.stepSound(this, false); }
      this.exhaust += hs * (this.sprinting ? 0.1 : 0.01);
    }
    this.survival(dt, world);
  }
  updateRiding(dt, input, world) {
    const cart = this.riding;
    this.x = cart.x; this.y = cart.y + 0.35; this.z = cart.z; this.vx = this.vy = this.vz = 0;
    this.onGround = false; this.fallDist = 0;
    if (input.moveF > 0.3) cart.pushDir(this.lookDir(), dt);
    if (input.sneakPress) { this.game.dismount(this); }
    this.survival(dt, world);
  }
  survival(dt, world) {
    if (this.hurtTime > 0) this.hurtTime -= dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.creative) { this.air = 300; return; }
    // 숨
    const ex = Math.floor(this.x), ey = Math.floor(this.eyeY()), ez = Math.floor(this.z);
    const eyeId = world.getBlock(ex, ey, ez);
    this.eyeInWater = eyeId === BL.water;
    if (this.eyeInWater) {
      this.air -= dt * 20;
      if (this.air <= 0) { this.air = 0; this.drownT += dt; if (this.drownT > 1) { this.drownT = 0; this.hurt(2, 'drown'); } }
    } else this.air = Math.min(300, this.air + dt * 60);
    if (this.inLava) { this.lavaT += dt; if (this.lavaT > 0.5) { this.lavaT = 0; this.hurt(4, 'lava'); } }
    // 선인장
    const r = this.w / 2 + 0.05;
    for (const [ox, oz] of [[-r, 0], [r, 0], [0, -r], [0, r]]) {
      const id = world.getBlock(Math.floor(this.x + ox), Math.floor(this.y + 0.5), Math.floor(this.z + oz));
      if (id === BL.cactus) { this.hurt(1, 'cactus'); break; }
    }
    // 불·마그마 블록
    const feet = world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z));
    const floor = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z));
    if (feet === BL.fire) this.hurt(1, 'fire');
    else if (floor === BL.magma_block && this.onGround && !this.sneaking) this.hurt(1, 'fire');
    // 배고픔
    if (this.exhaust >= 4) { this.exhaust -= 4; if (this.sat > 0) this.sat = Math.max(0, this.sat - 1); else this.food = Math.max(0, this.food - 1); }
    this.exhaust += dt * 0.004 * (this.game && this.game.settings.hunger === false ? 0 : 1);
    if (this.food >= 18 && this.health < 20) { this.regenT += dt; if (this.regenT > 3) { this.regenT = 0; this.health = Math.min(20, this.health + 1); this.exhaust += 1.5; } }
    else if (this.food <= 0) { this.starveT += dt; if (this.starveT > 4) { this.starveT = 0; if (this.health > 1) this.hurt(1, 'starve'); } }
  }
  hurt(amount, src, kx, kz) {
    if (this.creative || this.dead || amount <= 0) return false;
    if (this.invul > 0) return false;
    if (this.game && this.game.settings.peaceful && (src === 'mob' || src === 'arrow')) return false;
    if (this.armorReduce) amount = this.armorReduce(amount, src);
    this.health -= amount; this.invul = 0.5; this.hurtTime = 0.4;
    if (kx !== undefined) { this.vx += kx * 6; this.vz += kz * 6; this.vy = Math.max(this.vy, 5); }
    if (this.game) { this.game.sfx('hurt', this.x, this.y + 1, this.z); this.game.onPlayerHurt(amount, src); }
    if (this.health <= 0) { this.health = 0; this.dead = true; if (this.game) this.game.onPlayerDeath(src); }
    return true;
  }
  heal(n) { this.health = Math.min(20, this.health + n); }
  eat(food, sat) { this.food = Math.min(20, this.food + food); this.sat = Math.min(this.food, this.sat + sat); }
  // ---------- 인벤토리 ----------
  give(id, n, dur) {
    const max = itemMaxStack(id);
    if (max > 1) {
      for (let pass = 0; pass < 2 && n > 0; pass++) {
        const order = [...Array(9).keys(), ...Array.from({ length: 27 }, (_, i) => i + 9)];
        for (const i of order) {
          const s = this.inv[i];
          if (pass === 0 && s && s.id === id && s.n < max) { const t = Math.min(n, max - s.n); s.n += t; n -= t; }
          else if (pass === 1 && !s) { const t = Math.min(n, max); this.inv[i] = { id, n: t }; n -= t; }
          if (n <= 0) break;
        }
      }
    } else {
      for (let i = 0; i < 36 && n > 0; i++) {
        const idx = i < 9 ? i : i;
        if (!this.inv[idx]) { this.inv[idx] = { id, n: 1 }; if (dur !== undefined) this.inv[idx].d = dur; n--; }
      }
    }
    if (this.game) this.game.ui && this.game.ui.refreshHotbar();
    return n; // 남은 개수
  }
  count(id) { let c = 0; for (const s of this.inv) if (s && s.id === id) c += s.n; return c; }
  take(id, n) {
    for (let i = 0; i < 36 && n > 0; i++) { const s = this.inv[i]; if (s && s.id === id) { const t = Math.min(n, s.n); s.n -= t; n -= t; if (!s.n) this.inv[i] = null; } }
    return n === 0;
  }
  consumeHeld(n) {
    if (this.creative) return;
    const s = this.inv[this.sel]; if (!s) return;
    s.n -= n || 1; if (s.n <= 0) this.inv[this.sel] = null;
    if (this.game) this.game.ui.refreshHotbar();
  }
  damageHeld(n) {
    if (this.creative) return;
    const s = this.inv[this.sel]; if (!s) return;
    const d = ITEMS[s.id]; if (!d || !d.dur) return;
    s.d = (s.d || 0) + (n || 1);
    if (s.d >= d.dur) { this.inv[this.sel] = null; if (this.game) this.game.sfx('break_tool', this.x, this.y + 1, this.z); }
    if (this.game) this.game.ui.refreshHotbar();
  }
}

// ---------- 광선 투사 (DDA) ----------
function rayAABB(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity, face = -1;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    const lo = b[a], hi = b[a + 3];
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo || o[a] > hi) return null; continue; }
    let t1 = (lo - o[a]) / d[a], t2 = (hi - o[a]) / d[a];
    let f1 = a === 0 ? 4 : a === 1 ? 0 : 2, f2 = f1 + 1;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; const f = f1; f1 = f2; f2 = f; }
    if (t1 > tmin) { tmin = t1; face = f1; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return { t: Math.max(tmin, 0), face };
}
function raycast(world, ox, oy, oz, dx, dy, dz, maxDist, opts) {
  opts = opts || {};
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
  let tmx = dx > 0 ? (x + 1 - ox) * tdx : (ox - x) * tdx;
  let tmy = dy > 0 ? (y + 1 - oy) * tdy : (oy - y) * tdy;
  let tmz = dz > 0 ? (z + 1 - oz) * tdz : (oz - z) * tdz;
  let face = -1, t = 0;
  for (let i = 0; i < 200 && t <= maxDist; i++) {
    const id = world.getBlock(x, y, z);
    if (id) {
      const d = BLOCKS[id];
      if (d.fluid) {
        if (opts.fluids && (opts.sourceOnly ? world.getMeta(x, y, z) === 0 : true)) return { x, y, z, face: face < 0 ? 1 : face, id, meta: world.getMeta(x, y, z), t };
      } else {
        const meta = world.getMeta(x, y, z);
        const bs = blockBoxes(id, meta, true, world, x, y, z);
        if (bs) {
          let best = null;
          for (const b of bs) {
            const r = rayAABB(ox, oy, oz, dx, dy, dz, [x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]);
            if (r && r.t <= maxDist && (!best || r.t < best.t)) best = r;
          }
          if (best) return { x, y, z, face: best.face >= 0 ? best.face : face, id, meta, t: best.t, hit: [ox + dx * best.t, oy + dy * best.t, oz + dz * best.t] };
        }
      }
    }
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; face = sx > 0 ? 4 : 5; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; face = sy > 0 ? 0 : 1; }
    else { z += sz; t = tmz; tmz += tdz; face = sz > 0 ? 2 : 3; }
    if (y < -1 || y > HEIGHT) break;
  }
  return null;
}
