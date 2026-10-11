'use strict';
// =====================================================================
// 에듀 크래프트: 저사양 기기 최적화 (v1.4)
//  - 먼 몹은 단순한 모양(몸통+머리 2칸)으로 그림 (LOD). 화질이 낮을수록 더 가까이부터
//  - 화질별 한도: 파티클 수, 몹 수, 몹을 그리는 거리
//  - 「💻 저사양 모드」 한 번에 켜기 (설정), 자동 화질 낮추기 단계 더 (나뭇잎·구름 끄기, 시야 3, 해상도 45%)
//  - 청크 만들기 시간: 화면이 느리면 프레임당 일을 줄여 끊김을 막음
//  - 처음 켤 때 약한 그래픽이면 화려한 나뭇잎도 끔 (정글 같은 숲에서 삼각형 약 30% 줄어듦)
// =====================================================================
const PERF = {
  // 화질(0~3)별: [몹 LOD 거리, 몹 그리는 거리, 파티클 한도, 동물 한도, 적 한도]
  tier(q) { return [[14, 40, 250, 6, 10], [22, 56, 600, 9, 14], [30, 72, 1200, 12, 18], [40, 96, 1500, 14, 20]][Math.max(0, Math.min(3, q | 0))]; },
};
// 먼 몹 LOD 색 (대충의 몸 색)
const LOD_COL = {
  pig: [0.95, 0.66, 0.66], cow: [0.45, 0.3, 0.2], sheep: [0.93, 0.93, 0.9], chicken: [0.97, 0.97, 0.95], zombie: [0.3, 0.55, 0.45], skeleton: [0.85, 0.85, 0.82], creeper: [0.35, 0.72, 0.3],
  spider: [0.2, 0.17, 0.16], wolf: [0.86, 0.85, 0.84], iron_golem: [0.86, 0.84, 0.8], horse: [0.55, 0.34, 0.18], camel: [0.85, 0.7, 0.45], giraffe: [0.96, 0.8, 0.35], unicorn: [0.96, 0.95, 0.98],
  panda: [0.95, 0.95, 0.93], polar_bear: [0.95, 0.95, 0.92], penguin: [0.12, 0.12, 0.16], turtle: [0.3, 0.55, 0.3], frog: [0.45, 0.68, 0.3], cloud_sheep: [0.97, 0.98, 1],
  parrot: [0.9, 0.2, 0.2], bee: [1, 0.82, 0.2], phoenix: [1, 0.5, 0.12], baby_dragon: [0.4, 0.7, 0.55], enderman: [0.07, 0.06, 0.09], zombie_piglin: [0.93, 0.62, 0.6], blaze: [1, 0.8, 0.25], ghast: [0.95, 0.94, 0.94],
  villager: [0.55, 0.4, 0.25], librarian: [0.92, 0.92, 0.9], smith: [0.25, 0.25, 0.28], cleric: [0.55, 0.25, 0.6],
};
{
  const LM = new Float32Array(16), LT = new Float32Array(16);
  const _render = Mob.prototype.render;
  Mob.prototype.render = function (g, R, cam) {
    const D = this.def; if (!D || D.boss) return _render.call(this, g, R, cam);
    const dx = this.x - cam[0], dz = this.z - cam[2], d2 = dx * dx + dz * dz, T = g._perfTier || PERF.tier(2);
    if (d2 > T[1] * T[1]) return;                       // 너무 먼 몹은 안 그림
    if (d2 < T[0] * T[0]) return _render.call(this, g, R, cam);
    // 단순 모양: 몸통 + 머리
    const L = this.lightAt(g.world), c = LOD_COL[this.sub] || [0.7, 0.7, 0.7], w = this.w / 2, h = this.h;
    M4.identity(LM); LM[12] = dx; LM[13] = this.y - cam[1]; LM[14] = dz;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw); LM[0] = cy; LM[2] = -sy; LM[8] = sy; LM[10] = cy;
    const flying = D.fly || D.flying;
    R.ent.addBox(LM, -w, flying ? 0 : h * 0.25, -w, w, h * 0.78, w, c, L[0], L[1]);
    const hs = Math.min(w, h * 0.25) * 0.9;
    R.ent.addBox(LM, -hs, h * 0.6, -w - hs * 1.2, hs, h * 0.6 + hs * 2, -w + hs * 0.4, c.map(v => v * 0.85), L[0], L[1]);
  };
}
{
  const G = Game.prototype;
  // 화질에 따라 한도 갱신 (설정을 바꿀 때마다)
  const _apply = G.applySettings;
  G.applySettings = function () {
    _apply.call(this);
    this._perfTier = PERF.tier(this.settings.quality);
    this._perfThrottle2 = [400, 784, 1600, 2304][Math.max(0, Math.min(3, this.settings.quality | 0))];   // 이 거리(제곱)보다 먼 몹은 4프레임에 한 번
    if (this.particles) this.particles.cap = this._perfTier[2];
  };
  const _aw = G.attachWorld;
  G.attachWorld = function (w) { const r = _aw.call(this, w); if (this.particles && this._perfTier) this.particles.cap = this._perfTier[2]; return r; };
  // 동물·적 수 한도
  const _sp = G.spawnMobs;
  G.spawnMobs = function () {
    const T = this._perfTier || PERF.tier(2);
    let animals = 0, hostile = 0;
    for (const e of this.ents.list) if (!e.dead && e.type === 'mob' && e.def && !e.tamed && !e.def.boss && !e.def.persist) { if (e.def.hostile) hostile++; else animals++; }
    if (animals >= T[3] && hostile >= T[4]) return;
    const before = this.ents.list.length;
    _sp.call(this);
    // 한도를 넘게 생겼으면 방금 생긴 것부터 지움
    let a2 = animals, h2 = hostile;
    for (let i = before; i < this.ents.list.length; i++) {
      const e = this.ents.list[i]; if (e.type !== 'mob' || !e.def) continue;
      if (e.def.hostile) { if (++h2 > T[4]) e.dead = true; } else if (!e.def.persist) { if (++a2 > T[3]) e.dead = true; }
    }
  };
  // 청크 일 시간: 느린 기기에서는 프레임당 일을 줄여 끊김 없이
  const _mc = G.manageChunks;
  G.manageChunks = function (budgetMs) {
    const fps = this.fps || 60;
    if (this.state === 'play' && fps < 28) budgetMs = Math.min(budgetMs, 4);
    else if (this.state === 'play' && fps < 40) budgetMs = Math.min(budgetMs, 6);
    return _mc.call(this, budgetMs);
  };
  // 저사양 모드 (한 번에)
  G.applyLowSpec = function () {
    const s = this.settings;
    Object.assign(s, { quality: 0, renderDist: 4, renderScale: 0.6, clouds: false, fancyLeaves: false, viewBob: false, autoQuality: true });
    this.applySettings();
    if (this.world) for (const c of this.world.chunks.values()) c.dirty = true;
    this.ui.toast('💻 저사양 모드: 그림자·구름·화려한 나뭇잎 끄기, 시야 4, 해상도 60%', 3500);
  };
  // 처음 켤 때 약한 그래픽 → 화려한 나뭇잎도 끔
  const _gl = G.guessLowEnd;
  G.guessLowEnd = function () {
    _gl.call(this);
    if (this.settings.quality <= 1) this.settings.fancyLeaves = false;
    if (this.settings.quality === 0) this.settings.clouds = false;
  };
  // 자동 화질 낮추기: 마지막 단계들 더
  const _at = G.autoTune;
  G.autoTune = function (t) {
    const s = this.settings, q0 = s.quality, rd0 = s.renderDist, rs0 = s.renderScale;
    _at.call(this, t);
    const changed = s.quality !== q0 || s.renderDist !== rd0 || s.renderScale !== rs0;
    // 화질이 보통 이하로 내려가면 화려한 나뭇잎도 끔
    if (changed && s.fancyLeaves && s.quality <= 1) { s.fancyLeaves = false; this.applySettings(); if (this.world) for (const c of this.world.chunks.values()) c.dirty = true; }
  };
}
// 원래 자동 낮추기 단계가 끝난 뒤의 추가 단계: 매 3초 fps 를 직접 보고
{
  const G = Game.prototype;
  const _fs = G.frameStep;
  G.frameStep = function (t) {
    _fs.call(this, t);
    if (this.state !== 'play' || this.settings.autoQuality === false || this.ui.modal || document.hidden) return;
    const now = performance.now();
    if (now - (this.playStart || 0) < 10000) return;
    if (!this._lowT) this._lowT = now;
    if (now - this._lowT < 4000) return;
    this._lowT = now;
    const s = this.settings, slow = (this.fps || 60) < 24;
    if (!slow) return;
    const steps = [
      [() => s.fancyLeaves !== false, () => { s.fancyLeaves = false; if (this.world) for (const c of this.world.chunks.values()) c.dirty = true; }],
      [() => s.clouds !== false, () => s.clouds = false],
      [() => s.quality > 0, () => s.quality = 0],
      [() => s.renderDist > 4, () => s.renderDist = 4],
      [() => s.renderScale > 0.6, () => s.renderScale = 0.6],
      [() => s.renderDist > 3, () => s.renderDist = 3],
      [() => s.renderScale > 0.45, () => s.renderScale = 0.45],
    ];
    const st = steps.find(x => x[0]()); if (!st) return;
    st[1](); this.applySettings();
    this.ui.toast('🐢 아직 느려서 한 단계 더 가볍게 했어요 (설정 → 💻 저사양 모드)', 3000);
  };
}
// 파티클 한도
{
  const _add = Particles.prototype.add;
  Particles.prototype.add = function (p) { if (this.list.length >= (this.cap || 1500)) return; this.list.push(p); };
}
// 설정 화면에 「💻 저사양 모드」 단추
{
  const _ss = UI.prototype.showSettings;
  UI.prototype.showSettings = function (back) {
    _ss.call(this, back);
    const s = document.getElementById('menu-settings'); if (!s || s.querySelector('#s-low')) return;
    const box = document.createElement('div'); box.className = 'low-box';
    box.innerHTML = `<button class="btn blue" id="s-low">💻 저사양 모드 (오래된 노트북·태블릿)</button><small class="muted">한 번에 가장 가볍게 맞춰요. ${this.g.gpuName ? '그래픽: ' + esc(String(this.g.gpuName).replace(/^ANGLE \(|\)$/g, '').slice(0, 60)) + ' · ' : ''}지금 ${this.g.fps || 0} fps</small>`;
    const h2 = s.querySelector('h2'); h2.insertAdjacentElement('afterend', box);
    box.querySelector('#s-low').onclick = () => { this.g.applyLowSpec(); this.showSettings(back); };
  };
}
