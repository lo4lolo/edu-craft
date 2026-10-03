'use strict';
// =====================================================================
// 에듀 크래프트: 점프맵 (v1.3)
//  블록: 출발 발판 · 도착 발판(기록) · 체크포인트 · 점프 발판 · 대시 발판 · 부서지는 발판 · 되돌림 블록 · 깜빡이 블록 A/B
//  - 출발 발판을 밟으면 ⏱ 시작, 도착 발판에서 기록 (세계마다 코스별 1~5등 저장)
//  - 체크포인트 · 되돌림 블록 · 너무 많이 떨어지면 마지막 체크포인트로 (쓰러지지 않음)
//  - 부서지는 발판·깜빡이 블록은 방장(혼자 하기)이 계산 → 함께 하기 친구에게도 똑같이 보임
//  - 빌더봇 블록 「점프맵 만들기」: 발판 수·난이도만 정하면 코스를 지어 줌
// =====================================================================
const PK = { start: 201, finish: 202, check: 203, jump: 204, speed: 205, crumble: 206, reset: 207, blinkA: 208, blinkAoff: 209, blinkB: 210, blinkBoff: 211 };
function buildParkourTextures() {
  const pad = (name, bg, fg, art) => addTex(name, p => { p.noise(bg, 6); p.border(fg); if (art) art(p, fg); });
  pad('pk_start', [90, 210, 110], [40, 140, 60], (p, c) => { p.rect(5, 3, 1, 10, [255, 255, 255]); p.rect(6, 3, 5, 4, [255, 80, 80]); });
  pad('pk_finish', [250, 220, 90], [190, 150, 30], (p) => { for (let y = 2; y < 14; y += 2) for (let x = 2; x < 14; x += 2) if (((x + y) >> 1) % 2) p.rect(x, y, 2, 2, [40, 40, 40]); else p.rect(x, y, 2, 2, [255, 255, 255]); });
  pad('pk_check', [110, 170, 250], [50, 100, 200], (p) => { p.disc(8, 8, 4, [255, 255, 255]); p.disc(8, 8, 2.4, [80, 140, 240]); });
  pad('pk_jump', [120, 220, 100], [60, 160, 50], (p) => { for (let i = 0; i < 4; i++) p.rect(8 - i, 4 + i, i * 2 + 1, 1, [255, 255, 255]); p.rect(7, 8, 3, 5, [255, 255, 255]); });
  pad('pk_speed', [90, 190, 250], [30, 120, 210], (p) => { for (const ox of [2, 8]) for (let i = 0; i < 4; i++) { p.set(ox + i, 4 + i, [255, 255, 255]); p.set(ox + i, 11 - i, [255, 255, 255]); } });
  addTex('pk_crumble', p => { p.noise([214, 196, 150], 10); for (let k = 0; k < 6; k++) { let x = p.r() * 16 | 0, y = p.r() * 16 | 0; for (let s = 0; s < 6; s++) { p.set(x, y, [120, 100, 70]); x += (p.r() * 3 | 0) - 1; y += 1; } } p.border([170, 150, 110]); });
  addTex('pk_reset', p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5), a = Math.atan2(y - 7.5, x - 7.5); const v = Math.sin(d * 1.2 + a * 3) * 0.5 + 0.5; p.set(x, y, [120 + v * 80, 40 + v * 30, 170 + v * 60]); } });
  const blink = (name, c, ghost) => addTex(name, p => { p.fill(c); if (ghost) { p.clear(); p.border(c, 130); p.rect(2, 2, 12, 12, c, 40); } else { p.border([c[0] * 0.7, c[1] * 0.7, c[2] * 0.7]); p.rect(3, 3, 3, 3, [255, 255, 255], 200); } });
  blink('pk_blink_a', [90, 230, 230]); blink('pk_blink_a_off', [90, 230, 230], true);
  blink('pk_blink_b', [250, 140, 210]); blink('pk_blink_b_off', [250, 140, 210], true);
}
function defineParkourBlocks() {
  const b = defBlock;
  const pad = (id, name, k, tex, desc, extra) => b(id, name, k, Object.assign({ tex: faces(tex), shape: 'plate', solid: true, opaque: false, hard: 0.5, sound: 'stone', cat: 'parkour', conductor: false, emissive: true, emit: 4, desc }, extra || {}));
  pad(PK.start, 'parkour_start', '출발 발판', 'pk_start', '밟으면 ⏱ 시간 재기를 시작해요. 다시 밟으면 처음부터!');
  pad(PK.finish, 'parkour_finish', '도착 발판', 'pk_finish', '출발 발판부터 여기까지 걸린 시간을 기록해요. 세계마다 1~5등까지 남아요.');
  pad(PK.check, 'parkour_checkpoint', '체크포인트', 'pk_check', '밟으면 여기서 다시 시작해요. 떨어지거나 되돌림 블록에 닿으면 마지막 체크포인트로!');
  pad(PK.jump, 'jump_pad', '점프 발판', 'pk_jump', '밟으면 높이 뛰어올라요 (블록 4칸쯤).');
  pad(PK.speed, 'speed_pad', '대시 발판', 'pk_speed', '밟으면 바라보는 쪽으로 쌩 달려 나가요.');
  b(PK.crumble, 'crumble_block', '부서지는 발판', { tex: faces('pk_crumble'), hard: 0.4, sound: 'sand', cat: 'parkour', desc: '밟고 잠깐 뒤에 사라졌다가, 3초 뒤에 돌아와요. 빨리 건너요!' });
  b(PK.reset, 'reset_block', '되돌림 블록', { tex: faces('pk_reset'), hard: 0.5, sound: 'glass', cat: 'parkour', emit: 6, emissive: true, desc: '닿으면 마지막 체크포인트(없으면 출발 발판)로 돌아가요. 용암 대신 써요 — 다치지 않아요.' });
  const blink = (id, offId, name, k, tex) => {
    b(id, name, k, { tex: faces(tex), opaque: false, layer: 1, hard: 0.3, sound: 'glass', cat: 'parkour', conductor: false, desc: '2초마다 나타났다 사라져요. A와 B가 번갈아 나타나요.' });
    b(offId, name + '_off', k + ' (사라짐)', { tex: faces(tex + '_off'), opaque: false, solid: false, layer: 2, hard: 0.3, sound: 'glass', item: false, drop: () => [[id, 1]], conductor: false });
  };
  blink(PK.blinkA, PK.blinkAoff, 'blink_block_a', '깜빡이 블록 A', 'pk_blink_a');
  blink(PK.blinkB, PK.blinkBoff, 'blink_block_b', '깜빡이 블록 B', 'pk_blink_b');
}
function defineParkourRecipes() {
  S(['stone_pressure_plate', 'wool_lime'], 'parkour_start');
  S(['stone_pressure_plate', 'gold_ingot'], 'parkour_finish');
  S(['stone_pressure_plate', 'torch'], 'parkour_checkpoint');
  R(['SSS', 'PPP'], { S: 'slime_ball', P: '#planks' }, 'jump_pad', 2);
  R(['RRR', 'SSS'], { R: 'redstone', S: 'stone' }, 'speed_pad', 3);
  S(['sand', 'gravel'], 'crumble_block', 2);
  S(['wool_purple', 'redstone'], 'reset_block', 2);
  R(['GRG'], { G: 'glass', R: 'redstone' }, 'blink_block_a', 3);
  R(['GLG'], { G: 'glass', L: 'lapis_lazuli' }, 'blink_block_b', 3);
}
// 크리에이티브 인벤토리에 「점프맵」 탭
{
  const _oc = UI.prototype.openCreative;
  UI.prototype.openCreative = function () {
    _oc.call(this);
    const tabs = document.getElementById('cr-tabs'); if (!tabs || tabs.querySelector('[data-k="parkour"]')) return;
    const bt = document.createElement('button'); bt.textContent = '🏃 점프맵'; bt.dataset.k = 'parkour';
    const pal = document.getElementById('cr-pal');
    bt.onclick = () => {
      this.creativeCat = 'parkour';
      [...tabs.children].forEach(x => x.classList.toggle('on', x === bt));
      document.getElementById('cr-inv').style.display = 'none'; pal.style.display = '';
      this.slots = this.slots.filter(r => r.kind !== 'palette'); pal.innerHTML = '';
      const ids = [PK.start, PK.check, PK.finish, PK.jump, PK.speed, PK.crumble, PK.reset, PK.blinkA, PK.blinkB, BL.slime_block, BL.honey_block, BL.cloud_block, BL.scaffolding, BL.ladder, BL.ice, BL.rainbow_block, BL.elevator];
      for (const id of ids) if (ITEMS[id]) this.mountSlot(pal, { get: () => ({ id, n: 1 }), set: () => { }, kind: 'palette' });
    };
    tabs.insertBefore(bt, tabs.children[1] || null);
  };
}

// ---------------- 게임: 점프맵 동작 ----------------
{
  const G = Game.prototype;
  G.pkHud = function () {
    if (this._pkHud) return this._pkHud;
    const d = document.createElement('div'); d.id = 'pk-hud'; d.innerHTML = '<b></b><small></small><button type="button" title="그만하기">✕</button>';
    document.getElementById('hud').appendChild(d);
    d.querySelector('button').onclick = () => { this.pkRun = null; this.ui.toast('점프맵 시간 재기를 멈췄어요', 1200); };
    return (this._pkHud = { el: d, t: d.querySelector('b'), s: d.querySelector('small'), key: '' });
  };
  G.pkTeleport = function (why) {
    const p = this.player, r = this.pkRun, cp = (r && r.cp) || this.pkLastCp;
    if (!cp) return false;
    p.x = cp[0]; p.y = cp[1]; p.z = cp[2]; p.vx = p.vy = p.vz = 0; p.fallDist = 0; this.pkBoostT = 0;
    if (r) r.falls++;
    this.sound.play('teleport', p.x, p.y + 1, p.z);
    this.particles.smoke(p.x, p.y + 1, p.z, 10, [0.7, 0.5, 1]);
    if (why) this.ui.toast(why, 1200);
    return true;
  };
  G.parkourTick = function (dt) {
    const p = this.player, w = this.world;
    if (p.dead || p.riding) return;
    const fx = Math.floor(p.x), fz = Math.floor(p.z), fy = Math.floor(p.y + 0.02);
    const here = w.getBlock(fx, fy, fz), below = w.getBlock(fx, Math.floor(p.y - 0.06), fz);
    const pad = (here >= PK.start && here <= PK.speed) ? here : 0;
    const padKey = pad ? pad + '@' + fx + ',' + fy + ',' + fz : '';
    const enter = pad && padKey !== this._pkPad;   // 다른 발판(같은 종류라도 다른 자리)에 올라섬
    this._pkPad = padKey;
    const now = performance.now();
    const center = [fx + 0.5, fy + 0.1, fz + 0.5];
    if (pad === PK.start && (enter || !this.pkRun)) {
      const r = this.pkRun;
      if (!r || enter || now - r.t0 > 1500) {
        this.pkRun = { t0: now, cp: center, start: center, falls: 0, cps: 0 };
        this.pkLastCp = center;
        if (enter) { this.sound.play('click_on', p.x, p.y, p.z); this.ui.toast('🏁 출발! 도착 발판까지 달려요', 1400); }
      } else r.t0 = now;   // 출발 발판 위에 서 있는 동안은 0초
    } else if (enter && pad === PK.check) {
      const r = this.pkRun, same = r && r.cp && r.cp[0] === center[0] && r.cp[1] === center[1] && r.cp[2] === center[2];
      this.pkLastCp = center;
      if (r && !same) { r.cp = center; r.cps++; this.sound.play('xp_lv', p.x, p.y, p.z); this.ui.toast(`🚩 체크포인트! (${((now - r.t0) / 1000).toFixed(1)}초)`, 1200); }
      else if (!r) this.sound.play('click_on', p.x, p.y, p.z);
      for (let k = 0; k < 6; k++) this.particles.dust(center[0] + (Math.random() - 0.5), center[1] + 0.5 + Math.random(), center[2] + (Math.random() - 0.5), [0.4, 0.7, 1]);
    } else if (enter && pad === PK.finish && this.pkRun) {
      const r = this.pkRun, t = (now - r.t0) / 1000; this.pkRun = null;
      this.pkFinish(fx + ',' + fy + ',' + fz, t, r);
    }
    if (pad === PK.jump && p.vy <= 0.5) {
      if (p.vy < 14) { p.vy = 15.5; p.fallDist = 0; this.sound.play('elevator', p.x, p.y, p.z); this.particles.dust(p.x, p.y + 0.2, p.z, [0.5, 1, 0.5]); }
    }
    if (enter && pad === PK.speed) { const d = p.lookDir(), l = Math.hypot(d[0], d[2]) || 1; this.pkBoost = [d[0] / l, d[2] / l]; this.pkBoostT = 1.2; this.sound.play('bow', p.x, p.y, p.z); }
    if (this.pkBoostT > 0) {
      this.pkBoostT -= dt;
      const k = Math.min(1, this.pkBoostT) * 9;
      p.move(w, this.pkBoost[0] * k * dt, 0, this.pkBoost[1] * k * dt);
      if (Math.random() < dt * 20) this.particles.dust(p.x, p.y + 0.1, p.z, [0.5, 0.8, 1]);
    }
    // 되돌림 블록: 발밑이나 몸이 닿으면
    let touchReset = below === PK.reset;
    if (!touchReset) for (let dy = 0; dy <= 1 && !touchReset; dy++) for (const [ox, oz] of [[0.32, 0], [-0.32, 0], [0, 0.32], [0, -0.32]]) if (w.getBlock(Math.floor(p.x + ox), Math.floor(p.y + 0.3 + dy), Math.floor(p.z + oz)) === PK.reset) { touchReset = true; break; }
    if (touchReset && now - (this._pkResetT || 0) > 600) {
      this._pkResetT = now;
      if (!this.pkTeleport('↩ 되돌림 블록! 체크포인트로 돌아가요')) { const s = p.spawn; p.x = s[0]; p.y = s[1]; p.z = s[2]; p.vx = p.vy = p.vz = 0; }
    }
    // 코스에서 많이 떨어지면 체크포인트로
    if (this.pkRun && this.pkRun.cp && p.y < this.pkRun.cp[1] - 14) this.pkTeleport('😅 떨어졌어요! 체크포인트에서 다시');
    // 시계
    const hud = this.pkHud(), r = this.pkRun;
    if (r) {
      const t = ((now - r.t0) / 1000).toFixed(1), key = t + '|' + r.cps + '|' + r.falls;
      if (hud.key !== key) { hud.key = key; hud.el.classList.add('show'); hud.t.textContent = '⏱ ' + t + '초'; hud.s.textContent = `🚩 ${r.cps} · 😅 ${r.falls}`; }
    } else if (hud.key) { hud.key = ''; hud.el.classList.remove('show'); }
  };
  G.pkFinish = function (key, t, r) {
    const p = this.player;
    const rec = this.pkRecords || (this.pkRecords = {});
    const list = rec[key] || (rec[key] = []);
    const best = list.length ? list[0].t : Infinity;
    const entry = { n: p.name, t: Math.round(t * 100) / 100, f: r.falls, d: Date.now() };
    list.push(entry); list.sort((a, b) => a.t - b.t); list.length = Math.min(list.length, 5);
    const rank = list.indexOf(entry) + 1;
    this.sound.play('victory');
    for (let k = 0; k < 5; k++) this.particles.smoke(p.x, p.y + 1.5, p.z, 8, [[1, 0.8, 0.3], [0.5, 1, 0.6], [0.5, 0.8, 1], [1, 0.5, 0.8], [1, 1, 1]][k], true);
    const msg = `🏆 완주! ${t.toFixed(2)}초${r.falls ? ` (떨어짐 ${r.falls}번)` : ' · 한 번도 안 떨어졌어요!'}${t < best ? ' · 🎉 이 코스 새 기록!' : ''}`;
    this.ui.toast(msg, 4500);
    this.ui.chatLine(msg + ` — 순위: ${list.map((x, i) => `${i + 1}. ${x.n} ${x.t.toFixed(2)}초`).join('  ')}`, '#ffe27a');
    if (this.net.connected) this.net.sendChat(`🏁 ${p.name}님이 점프맵을 ${t.toFixed(2)}초에 완주했어요!${rank === 1 ? ' (1등!)' : ''}`);
    this.spawnXP(p.x, p.y + 1, p.z, 5 + Math.min(20, Math.round(30 / Math.max(5, t) * 5)));
    this.advGrant('parkour');
    if (!r.falls) this.advGrant('parkour_clean');
  };
  // 방장(혼자 하기): 부서지는 발판, 깜빡이 블록
  G.pkWorldTick = function () {
    const w = this.world; if (w.remote) return;
    const now = performance.now();
    const cr = this.pkCrumble || (this.pkCrumble = new Map());
    const feet = [this.player].concat([...this.remotes.values()]);
    for (const q of feet) {
      if (!q || q.dead) continue;
      for (const [ox, oz] of [[0, 0], [0.29, 0.29], [-0.29, 0.29], [0.29, -0.29], [-0.29, -0.29]]) {
        const x = Math.floor(q.x + ox), y = Math.floor(q.y - 0.06), z = Math.floor(q.z + oz);
        if (w.getBlock(x, y, z) === PK.crumble) { const k = x + ',' + y + ',' + z; if (!cr.has(k)) { cr.set(k, { x, y, z, t: now, gone: false }); this.sfx('dig', x + 0.5, y + 1, z + 0.5, { mat: 'sand' }); } }
      }
    }
    for (const [k, c] of cr) {
      if (!c.gone && now - c.t > 550) { if (w.getBlock(c.x, c.y, c.z) === PK.crumble) { w.setBlock(c.x, c.y, c.z, 0, 0, 1); this.particles.blockBreak(c.x, c.y, c.z, PK.crumble, 0); } c.gone = true; }
      else if (c.gone && now - c.t > 3500) {
        if (!w.getBlock(c.x, c.y, c.z)) w.setBlock(c.x, c.y, c.z, PK.crumble, 0, 1);
        cr.delete(k);
      }
    }
    // 깜빡이: 2초마다 A ↔ B
    if (w.tick % 40 === 0 && this.pkBlinks && this.pkBlinks.size) {
      const even = (w.tick / 40) % 2 === 0;
      for (const k of this.pkBlinks) {
        const [x, y, z] = parseKey(k), id = w.getBlock(x, y, z);
        let want = -1;
        if (id === PK.blinkA || id === PK.blinkAoff) want = even ? PK.blinkA : PK.blinkAoff;
        else if (id === PK.blinkB || id === PK.blinkBoff) want = even ? PK.blinkBoff : PK.blinkB;
        else { this.pkBlinks.delete(k); continue; }
        if (want !== id) w.setBlock(x, y, z, want, 0, 1);
      }
      this.sfx('click_off', this.player.x, this.player.y + 2, this.player.z, { vol: 0.25 });
    }
  };
  const _update = G.update;
  G.update = function (dt) {
    _update.call(this, dt);
    if (this.state !== 'play') return;
    this.parkourTick(dt);
    this.pkWorldTick();
  };
  const isBlink = (id) => id >= PK.blinkA && id <= PK.blinkBoff;
  const _ocl = G.onChunkLoaded;
  G.onChunkLoaded = function (c) {
    _ocl.call(this, c);
    const ids = c.ids; let set = null;
    for (let i = 0; i < ids.length; i++) if (ids[i] >= PK.blinkA && ids[i] <= PK.blinkBoff) { set = set || (this.pkBlinks || (this.pkBlinks = new Set())); set.add(fmtKey(c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15))); }
  };
  const _obc = G.onBlockChange;
  G.onBlockChange = function (x, y, z, oid, om, id, meta, flags) {
    if (isBlink(id) && !isBlink(oid)) (this.pkBlinks || (this.pkBlinks = new Set())).add(fmtKey(x, y, z));
    return _obc.call(this, x, y, z, oid, om, id, meta, flags);
  };
  const _aw = G.attachWorld;
  G.attachWorld = function (w) { this.pkBlinks = new Set(); this.pkCrumble = new Map(); this.pkRun = null; return _aw.call(this, w); };
  // 점프맵 중에 쓰러지면 체크포인트에서
  const _respawn = G.respawn;
  G.respawn = function () {
    const r = this.pkRun;
    _respawn.call(this);
    if (r && r.cp && this.world.dim === 'overworld') { const p = this.player; p.x = r.cp[0]; p.y = r.cp[1]; p.z = r.cp[2]; this.pkRun = r; r.falls++; }
  };
  // 기록 저장
  const _sw = G.startWorld;
  G.startWorld = async function (opt) { this.pkRecords = opt.rec && opt.rec.parkour ? JSON.parse(JSON.stringify(opt.rec.parkour)) : {}; this.pkLastCp = null; return _sw.call(this, opt); };
  const _ser = G.serializeWorld;
  G.serializeWorld = function () { const r = _ser.call(this); r.parkour = this.pkRecords || {}; return r; };
  const _cmd = G.command;
  G.command = function (line) {
    const a = line.trim().slice(1).split(/\s+/), cmd = (a[0] || '').toLowerCase(), say = (t, c) => this.ui.chatLine(t, c || '#aee');
    if (cmd === 'parkour' || cmd === '점프맵') {
      const rec = this.pkRecords || {}, keys = Object.keys(rec);
      if (a[1] === 'reset' || a[1] === '지우기') { if (this.world.remote) return; this.pkRecords = {}; say('점프맵 기록을 모두 지웠어요'); return; }
      if (!keys.length) { say('아직 점프맵 기록이 없어요. 출발 발판 → 도착 발판!'); return; }
      for (const k of keys) say(`🏁 코스(${k}): ` + rec[k].map((x, i) => `${i + 1}. ${x.n} ${x.t.toFixed(2)}초`).join('  '), '#ffe27a');
      return;
    }
    if (cmd === 'help' || cmd === '도움말') { _cmd.call(this, line); say('점프맵: /parkour (기록 보기), /parkour reset (기록 지우기)'); return; }
    return _cmd.call(this, line);
  };
}
ADV.push(['parkour', 'parkour_finish', '점프왕', '점프맵을 완주했어요', null], ['parkour_clean', 'jump_pad', '한 번도 안 떨어졌어!', '떨어지지 않고 점프맵을 완주했어요', null]);

// ---------------- 빌더봇: 점프맵 만들기 ----------------
// 도형 칸 안(붙여넣기 다음)에 끼워 넣어 팔레트 순서 유지
{
  const ent = Object.entries(CODE_DEFS); for (const [k] of ent) delete CODE_DEFS[k];
  for (const [k, v] of ent) { CODE_DEFS[k] = v; if (k === 'paste') CODE_DEFS.parkour = { cat: 'shape', text: '점프맵 만들기 · 발판 #n 개 난이도 #d', a: { n: '15', d: '2' } }; }
}
CODE_KEYS.parkour = [['jump_pad', 'parkour_start', 'parkour_checkpoint'], '점프 발판(또는 출발·체크포인트)'];
SAMPLE_PROGRAMS['🏃 점프맵 코스 (자동)'] = [{ t: 'up', a: { n: '5' } }, { t: 'setblk', a: { b: 'quartz_block' } }, { t: 'parkour', a: { n: '20', d: '2' } }];
SAMPLE_PROGRAMS['🏃 직접 만드는 점프맵'] = [
  { t: 'up', a: { n: '4' } }, { t: 'setblk', a: { b: 'concrete_lime' } }, { t: 'placeDir', a: { d: 'd' } }, { t: 'setblk', a: { b: 'parkour_start' } }, { t: 'place', a: {} },
  { t: 'for', a: { v: 'i', a: '1', b: '12' }, c: [
    { t: 'fwd', a: { n: '2 + i % 2' } }, { t: 'rand', a: { v: 'x', a: '-1', b: '1' } }, { t: 'right', a: { n: 'x' } },
    { t: 'setcolor', a: { k: 'concrete', n: 'i' } }, { t: 'placeDir', a: { d: 'd' } },
    { t: 'if', a: { c: 'expr', e: 'i % 4 == 0' }, c: [{ t: 'setblk', a: { b: 'parkour_checkpoint' } }, { t: 'place', a: {} }] },
  ] },
  { t: 'fwd', a: { n: '2' } }, { t: 'setblk', a: { b: 'gold_block' } }, { t: 'placeDir', a: { d: 'd' } }, { t: 'setblk', a: { b: 'parkour_finish' } }, { t: 'place', a: {} },
  { t: 'say', a: { s: '점프맵 완성! 출발 발판에 올라가 보세요 ⏱' } },
];
{
  const _exec = Builder.prototype.exec;
  Builder.prototype.exec = function* (n) {
    if (n.t !== 'parkour') { yield* _exec.call(this, n); return; }
    const a = n.a || {};
    const N = Math.max(2, Math.min(60, this.inum(a.n))), D = Math.max(1, Math.min(4, this.inum(a.d)));
    const base = this.block || BL.stone, bm = this.blockMeta || 0;
    const rnd = Math.random;
    let r = 0, u = 0, f = 0;
    const plat = (pr, pu, pf, top) => { this.put(...this.L(pr, pu - 1, pf), base, bm); if (top) this.put(...this.L(pr, pu, pf), top, 0); else this.put(...this.L(pr, pu, pf), 0, 0); this.put(...this.L(pr, pu + 1, pf), 0, 0); this.put(...this.L(pr, pu + 2, pf), 0, 0); };
    plat(0, 0, 0, PK.start); plat(0, 0, -1, 0); plat(-1, 0, 0, 0); plat(1, 0, 0, 0); yield;
    for (let i = 1; i <= N; i++) {
      let gap = 2 + (rnd() * Math.min(3, D) | 0);
      let du = rnd() < 0.3 ? 1 : rnd() < 0.35 ? -1 : 0;
      if (gap >= 4 && du > 0) du = 0;
      if (D >= 3 && gap === 2 && rnd() < 0.3) du = 1;
      const dr = rnd() < 0.4 ? (rnd() < 0.5 ? -1 : 1) : 0;
      // 점프 발판 다음은 높이 올라감
      if (i % 7 === 0 && i < N) {
        f += 2; r += dr; plat(r, u, f, PK.jump); yield;
        f += 2; u += 3; plat(r, u, f, 0); yield;
        continue;
      }
      f += gap; r += dr; u += du;
      let top = 0;
      if (i === N) top = PK.finish;
      else if (i % 5 === 0) top = PK.check;
      else if (D >= 2 && rnd() < 0.08 * D) top = PK.speed;
      if (D >= 3 && !top && rnd() < 0.3) { this.put(...this.L(r, u - 1, f), PK.crumble, 0); yield; continue; }
      if (D >= 3 && !top && rnd() < 0.2) { this.put(...this.L(r, u - 1, f), i % 2 ? PK.blinkA : PK.blinkB, 0); yield; continue; }
      plat(r, u, f, top);
      if (D >= 4 && !top && rnd() < 0.25) this.put(...this.L(r + (rnd() < 0.5 ? 1 : -1), u, f), PK.reset, 0);
      yield;
    }
    if (!this.dry) this.g.ui.chatLine(`🤖 점프맵 완성! 발판 ${N}개 · 난이도 ${D} — 초록 출발 발판에 올라가 보세요 ⏱`, '#9ff');
  };
}
