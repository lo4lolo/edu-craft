'use strict';
// =====================================================================
// 함께 하기(멀티)에서 지옥·엔드로 같이 가기 — v1.5
//  방장이 세계 하나를 계산하는 구조라서, 누가 차원문에 들어가면 「방 전체가 함께」 이동한다.
//   1) 누군가 지옥문(3초)·엔드 차원문에 들어감 → 참가자면 방장에게 partyReq
//   2) 방장이 4초 세기 시작(partySoon) → 모두에게 알림
//   3) 방장이 dimGo를 보내고 이동 → 참가자는 기다림(waitdim)
//   4) 방장이 도착하면 dimData(그 차원의 바뀐 블록·도착 위치)를 보냄 → 참가자도 같은 곳에 도착
//  쓰러지면 그 차원의 도착 지점(dimSpawn)에서 다시 일어남 (혼자 집으로 돌아가지 않게)
//  늦게 들어온 친구는 welcome에 dim·dimSpawn이 들어 있어 방장이 있는 차원으로 바로 들어감
// =====================================================================
const PARTY_WAIT = 4;
{
  const G = Game.prototype;
  const _tt = G.travelTo;
  G.travelTo = function (dim, x, y, z, arrive, label) {
    if (this._skipTravel) return false;
    const net = this.net;
    if (net.connected && !this._partyGo) {
      if (!net.isHost) {
        const now = performance.now();
        if (now - (this._partyReqT || 0) < 3000) return false;
        this._partyReqT = now; this.portalCD = 3;
        net.send({ t: 'partyReq', a: [dim, x, y, z, arrive || null, label || null] });
        this.ui.toast('🌀 방장에게 모두 함께 가자고 알렸어요!', 2200);
        return false;
      }
      this.partyStart(dim, x, y, z, arrive, label, this.player.name);
      return false;
    }
    return _tt.call(this, dim, x, y, z, arrive, label);
  };
  G.partyStart = function (dim, x, y, z, arrive, label, who) {
    if (this.party || this.state !== 'play') return;
    // 엔딩은 드래곤 상태를 아는 방장이 정함 (참가자는 모름)
    if (dim === 'overworld' && arrive && arrive.kind === 'home' && this.world.dim === 'end') arrive = Object.assign({}, arrive, { ending: !!(this.dragon.dead && !this.dragon.ended) });
    this.party = { a: [dim, x, y, z, arrive, label], t: PARTY_WAIT };
    this.portalCD = PARTY_WAIT + 3;
    const msg = `🌀 ${who}님이 ${dim === 'overworld' ? '평소 세계로 돌아가는' : DIM_NAMES[dim] + '(으)로 가는'} 문에 들어갔어요! ${PARTY_WAIT}초 뒤 모두 함께 이동해요`;
    this.net.sendChat(msg);
    this.net.broadcast({ t: 'partySoon', dim, s: PARTY_WAIT });
    this.ui.toast(msg, 3500);
  };
  // 방장: 세기, 엔더 드래곤 체력 알리기
  G.partyTick = function (dt) {
    const net = this.net;
    if (!net.connected || !net.isHost) { this.party = null; return; }
    if (this.party) {
      this.party.t -= dt;
      if (this.party.t <= 0) {
        const a = this.party.a; this.party = null;
        net.broadcast({ t: 'dimGo', dim: a[0], label: a[5] || null }); net.flush();
        this._partyGo = true;
        try { _tt.call(this, a[0], a[1], a[2], a[3], a[4], a[5]); } finally { this._partyGo = false; }
      }
    }
    this._bossT = (this._bossT || 0) - dt;
    if (this._bossT <= 0 && this.world.dim === 'end') {
      this._bossT = 0.5;
      const d = this.ents.list.find(e => e.sub === 'ender_dragon' && !e.dead);
      net.broadcast({ t: 'boss', f: d ? Math.max(0, d.hp / MOB_TYPES.ender_dragon.hp) : -1, left: (this.dragon.crystals || []).filter(Boolean).length });
    }
  };
  const _upd = G.update;
  G.update = function (dt) { _upd.call(this, dt); if (this.net.connected) this.partyTick(dt); };
  // 도착
  const _fa = G.finishArrive;
  G.finishArrive = function () {
    const a = this.pendingArrive, p = this.player, w = this.world;
    if (a && a.kind === 'remote') {
      if (!w.isLoadedAt(Math.floor(p.x), Math.floor(p.z))) return false;
      let guard = 0; while (guard++ < 40 && (BLOCKS[w.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].solid || BLOCKS[w.getBlock(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z))].solid)) p.y += 1;
      this.portalCD = 3; this.portalT = 0; this.pendingArrive = null; this._arrived = true;
      this.ui.chatLine(w.dim === 'overworld' ? '🌍 모두 함께 평소 세계로 왔어요!' : `🌀 모두 함께 ${DIM_NAMES[w.dim]}에 도착했어요!`, '#ffb37a');
      if (a.ending) setTimeout(() => this.showEnding(), 600);
      return true;
    }
    if (!_fa.call(this)) return false;
    this.dimSpawn = w.dim === 'overworld' ? null : [p.x, p.y, p.z];
    const net = this.net;
    if (net.connected && net.isHost) {
      for (const r of this.remotes.values()) { r.x = p.x; r.y = p.y; r.z = p.z; }
      net.broadcast({ t: 'dimData', dim: w.dim, seed: w.seed, type: w.type, time: w.time, mods: modsToObj(w.mods), be: Array.from(w.be.entries()), spawn: [p.x, p.y, p.z], ending: !!(a && a.ending) });
    }
    return true;
  };
  // 지옥·엔드에서 저장한 세계를 열면 지금 자리를 그 차원의 도착 지점으로 (늦게 온 친구가 여기로)
  const _sw = G.startWorld;
  G.startWorld = async function (opt) {
    await _sw.call(this, opt);
    if (!this.dimSpawn && this.world && this.world.dim !== 'overworld' && !opt.client) { const p = this.player; this.dimSpawn = [p.x, p.y, p.z]; }
  };
  // 쓰러지면: 함께 하기 중 다른 차원이면 그 차원의 도착 지점에서
  const _rs = G.respawn;
  G.respawn = function () {
    const multi = this.net.connected && this.world.dim !== 'overworld';
    if (!multi) return _rs.call(this);
    this._skipTravel = true;
    try { _rs.call(this); } finally { this._skipTravel = false; }
    const s = this.dimSpawn, p = this.player;
    if (s) { p.x = s[0]; p.y = s[1]; p.z = s[2]; p.vx = p.vy = p.vz = 0; p.fallDist = 0; }
  };
}
// ---------------- 통신 ----------------
{
  const N = Net.prototype;
  const _host = N.onHostData;
  N.onHostData = function (id, data) {
    if (data && data.t === 'partyReq') {
      const g = this.g, a = data.a, r = g.remotes.get(id);
      if (!Array.isArray(a) || !DIM_NAMES[a[0]] || ![a[1], a[2], a[3]].every(v => typeof v === 'number' && isFinite(v))) return;
      const arrive = a[4] && ['portal', 'end', 'home'].includes(a[4].kind) ? { kind: a[4].kind, ending: !!a[4].ending } : { kind: 'portal' };
      let [dim, x, y, z] = a;
      if (arrive.kind === 'home') { const s = g.player.spawn; x = s[0]; y = s[1]; z = s[2]; }
      g.partyStart(dim, x, y, z, arrive, typeof a[5] === 'string' ? a[5].slice(0, 40) : null, r ? r.name : '친구');
      return;
    }
    return _host.call(this, id, data);
  };
  const _client = N.onClientData;
  N.onClientData = function (data) {
    const g = this.g, m = data;
    if (m && m.t === 'batch') { for (const x of m.m) this.onClientData(x); return; }
    if (!m) return;
    if (m.t === 'partySoon') { g.portalCD = (m.s || PARTY_WAIT) + 3; g.ui.toast(`🌀 ${m.s || PARTY_WAIT}초 뒤 모두 함께 ${m.dim === 'overworld' ? '평소 세계' : DIM_NAMES[m.dim]}(으)로 이동해요!`, 3000); return; }
    if (m.t === 'boss') { g._netBoss = { f: m.f, left: m.left, t: performance.now() }; return; }
    if (m.t === 'dimGo') {
      if (!g.world || !g.world.remote) return;
      if (g.builder.running) g.builder.stop();
      for (const c of g.world.chunks.values()) g.renderer.deleteChunkMesh(c);
      g.state = 'waitdim'; g.portalT = 0;
      g.ui.closeModal(true);
      g.ui.showLoading(m.label || ((m.dim === 'overworld' ? '평소 세계' : DIM_NAMES[m.dim]) + '(으)로 모두 함께 가는 중...'));
      g.sound.play('portal');
      return;
    }
    if (m.t === 'dimData') {
      if (!g.world || !g.world.remote) return;
      for (const c of g.world.chunks.values()) g.renderer.deleteChunkMesh(c);
      const w = new World(m.seed, m.type, m.dim);
      w.remote = true; w.time = m.time; w.mods = objToMods(m.mods || {});
      for (const [k, v] of m.be || []) w.be.set(k, v);
      g.world = w; g.attachWorld(w);
      const p = g.player, s = m.spawn;
      p.x = s[0] + (Math.random() - 0.5) * 1.2; p.y = s[1]; p.z = s[2] + (Math.random() - 0.5) * 1.2;
      p.vx = p.vy = p.vz = 0; p.fallDist = 0; if (p.riding) p.riding = null;
      g.dimSpawn = m.dim === 'overworld' ? null : s.slice();
      g.pendingArrive = { kind: 'remote', ending: !!m.ending };
      g.state = 'loading'; g.loadStart = performance.now(); g._netBoss = null;
      g.ui.showLoading((m.dim === 'overworld' ? '평소 세계' : DIM_NAMES[m.dim]) + ' 준비하는 중...');
      return;
    }
    return _client.call(this, m);
  };
}
// ---------------- 친구 화면에서도 엔더 드래곤·수정·화염구가 보이게 ----------------
ETYPE_CODES.push('fireball');
{
  const _ens = entityNetState;
  const FB_KIND = ['small', 'ghast', 'dragon'];
  entityNetState = function (e) {
    if (e.type === 'fireball') return [e.eid, ETYPE_CODES.indexOf('fireball'), Math.round(e.x * 100) / 100, Math.round(e.y * 100) / 100, Math.round(e.z * 100) / 100, 0, Math.max(0, FB_KIND.indexOf(e.kind)), 0, 0];
    return _ens(e);
  };
  const _ner = NetEntity.prototype.render;
  NetEntity.prototype.render = function (g, R, cam) {
    if (this.type === 'fireball') { Fireball.prototype.render.call({ x: this.x, y: this.y, z: this.z, kind: FB_KIND[this.sub | 0] || 'small' }, g, R, cam); return; }
    return _ner.call(this, g, R, cam);
  };
  const _rmm = renderMobModel;
  renderMobModel = function (R, sub, x, y, z, yaw, walk, L, hurt, fuse) {
    if (sub === 'ender_dragon') { const t = performance.now() / 1000; renderDragon(R, { x, y, z, yaw, pitch: 0, age: t, flap: t * 5, hurtT: hurt ? 0.3 : 0, phase: '' }, [0, 0, 0], L); return; }
    if (sub === 'end_crystal') { EndCrystal.prototype.render.call({ x, y, z, age: performance.now() / 1000 }, null, R, [0, 0, 0]); return; }
    return _rmm(R, sub, x, y, z, yaw, walk, L, hurt, fuse);
  };
}
