'use strict';
// =====================================================================
// 보조 손(왼손) — v1.5
//  - 인벤토리 갑옷 칸 아래에 「보조 손」 칸. F 키로 손에 든 것과 바꾸기 (Shift+F는 회로 정보 표시)
//  - 방패를 왼손에 들고 오른쪽 버튼을 누르고 있으면 막기 → 오른손에는 칼·곡괭이를 든 채로 싸울 수 있음
//  - 막기는 바라보는 쪽(앞)에서 오는 공격만. 막는 동안은 천천히 걸음
//  - 불사조 토템도 왼손에 두면 지켜 줌 (nature.js)
//  - 1인칭: 화면 왼쪽 아래에 방패/아이템, 3인칭·친구 화면: 왼팔에 방패 (net.js로 주고받음)
// 저장: rec.player.offhand
// =====================================================================
const OFF_NO_BLOCK = new Set(['builder_remote', 'fishing_rod', 'flint_and_steel', 'ender_pearl', 'eye_of_ender', 'experience_bottle', 'bucket', 'minecart', 'bone_meal', 'shears', 'wrench', 'multimeter', 'shield']);
function isShieldId(id) { const d = id ? ITEMS[id] : null; return !!(d && d.name === 'shield'); }
// 오른손에 든 것이 오른쪽 버튼을 쓰는 물건인가 (그러면 왼손 방패로 막지 않음)
function mainUsesRightClick(p) {
  const s = p.held; if (!s) return false;
  const d = ITEMS[s.id]; if (!d) return false;
  if (d.food && (p.food < 20 || p.creative)) return true;
  return !!(d.bow || d.places !== undefined || d.fluid || d.armor || OFF_NO_BLOCK.has(d.name));
}
{
  const G = Game.prototype, P = Player.prototype;
  G.swapHands = function () {
    const p = this.player; if (!p || p.dead) return;
    const a = p.inv[p.sel] || null, b = p.offhand || null;
    if (!a && !b) { this.ui.toast('보조 손(왼손)이 비어 있어요. 방패를 들고 F를 눌러 보세요', 1800); return; }
    p.inv[p.sel] = b; p.offhand = a;
    this.sound.play('pop'); this.ui.refreshHotbar(); this.ui.showHeldName && this.ui.showHeldName();
    if (p.offhand && isShieldId(p.offhand.id) && !this._shieldTip) { this._shieldTip = true; this.ui.toast('🛡 왼손에 방패! 오른쪽 버튼을 누르고 있으면 앞에서 오는 공격을 막아요', 3500); }
  };
  // 시작·저장·쓰러짐
  const _sw = G.startWorld;
  G.startWorld = async function (opt) {
    await _sw.call(this, opt);
    const s = opt.rec && opt.rec.player && opt.rec.player.offhand;
    this.player.offhand = s && ITEMS[s.id] ? Object.assign({}, s) : null;
    this.ui.refreshHotbar();
  };
  const _ser = G.serializeWorld;
  G.serializeWorld = function () { const r = _ser.call(this); r.player.offhand = this.player.offhand || null; return r; };
  const _death = G.onPlayerDeath;
  G.onPlayerDeath = function (src) {
    const p = this.player;
    if (p.offhand && !this.worldRules.keepInventory && !p.creative) { this.dropItem(p.x, p.y + 1, p.z, p.offhand, [(Math.random() - 0.5) * 5, 3, (Math.random() - 0.5) * 5]); p.offhand = null; }
    return _death.call(this, src);
  };
  // 막기: vanillaTick이 오른손 방패만 보므로 그 뒤에 다시 정함
  const _vt = G.vanillaTick;
  G.vanillaTick = function (dt) {
    _vt.call(this, dt);
    const p = this.player, s = this.input.s;
    const want = !!(s && s.use && !p.dead && !this.ui.modal);
    const mainShield = p.held && isShieldId(p.held.id), offShield = p.offhand && isShieldId(p.offhand.id);
    p.blocking = want && (mainShield || (offShield && !mainUsesRightClick(p)));
  };
  // 막는 동안 천천히 (원작처럼 웅크린 정도)
  const _pupd = P.update;
  P.update = function (dt, input, world) {
    if (!this.blocking || this.flying || !input) return _pupd.call(this, dt, input, world);
    const f = input.moveF, st = input.moveS, sp = input.sprint;
    input.moveF = f * 0.4; input.moveS = st * 0.4; input.sprint = false;
    try { return _pupd.call(this, dt, input, world); } finally { input.moveF = f; input.moveS = st; input.sprint = sp; }
  };
}
// ---------------- UI: 보조 손 칸 ----------------
{
  const U = UI.prototype;
  const offRef = (ui) => Object.assign(ui.ref(() => ui.g.player, 'offhand'), { offhandSlot: true, tipExtra: () => '<small>보조 손(왼손) · F 키로 오른손과 바꿔요</small>' });
  const _bis = U.buildInvScreen;
  U.buildInvScreen = function (kind, title) {
    _bis.call(this, kind, title);
    const arm = document.querySelector('#inv-screen .armor-col');
    if (arm) this.mountSlot(arm, offRef(this), 'armor ph4');
  };
  const _oc = U.openCreative;
  U.openCreative = function () {
    _oc.call(this);
    const tr = document.querySelector('#inv-screen #cr-trash');
    if (tr && tr.parentNode) { const box = document.createElement('div'); box.className = 'off-box'; tr.parentNode.insertBefore(box, tr); this.mountSlot(box, offRef(this), 'armor ph4'); }
  };
  // Shift+클릭: 방패·토템은 비어 있는 보조 손으로
  const _qm = U.quickMove;
  U.quickMove = function (r) {
    const p = this.g.player, it = r.get();
    if (it && r.inv && !p.offhand && !this.slots.some(s => s.container) && ITEMS[it.id] && (ITEMS[it.id].name === 'shield' || ITEMS[it.id].name === 'phoenix_totem')) { p.offhand = it; r.set(null); return; }
    if (it && r.offhandSlot) { const left = p.give(it.id, it.n, it.d, it.e); if (left < it.n) { if (left > 0) it.n = left; else r.set(null); } return; }
    return _qm.call(this, r);
  };
  // 단축바 왼쪽의 보조 손 칸 (들고 있을 때만 보임)
  const _rh = U.refreshHotbar;
  U.refreshHotbar = function () {
    _rh.call(this);
    const p = this.g.player; if (!p) return;
    let el = this._offEl;
    if (!el) { el = this._offEl = this.slotEl(); el.classList.add('offhand'); el.title = '보조 손 (F로 바꾸기, 눌러도 바뀌어요)'; el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (this.g.state === 'play' && !this.modal) this.g.swapHands(); }); const hb = document.getElementById('hotbar'); hb.insertBefore(el, hb.firstChild); }
    const it = p.offhand || null;
    el.style.display = it ? '' : 'none';
    this.drawSlot(el, it);
  };
}
// ---------------- 그리기 ----------------
// 방패 모양 (모델 좌표, 판의 앞면이 -z)
function addShieldBoxes(eb, m, L, raise) {
  const wood = [0.62, 0.45, 0.27], dark = [0.45, 0.31, 0.18], iron = [0.78, 0.8, 0.85];
  eb.addBox(m, -0.3, -0.4, -0.04, 0.3, 0.4, 0.03, wood, L[0], L[1]);
  eb.addBox(m, -0.3, -0.4, -0.05, 0.3, -0.35, 0.03, iron, L[0], L[1]); eb.addBox(m, -0.3, 0.35, -0.05, 0.3, 0.4, 0.03, iron, L[0], L[1]);
  eb.addBox(m, -0.3, -0.4, -0.05, -0.25, 0.4, 0.03, iron, L[0], L[1]); eb.addBox(m, 0.25, -0.4, -0.05, 0.3, 0.4, 0.03, iron, L[0], L[1]);
  eb.addBox(m, -0.035, -0.35, -0.06, 0.035, 0.35, -0.04, dark, L[0], L[1]);
  eb.addBox(m, -0.09, -0.09, -0.08, 0.09, 0.09, -0.04, iron, L[0], L[1]);
}
{
  const R = Renderer.prototype;
  // 1인칭 왼손: 방패는 상자 모델, 다른 아이템은 오른손 그림을 좌우로 뒤집어서
  R.drawOffhand = function (st, A) {
    const gl = this.gl, o = st.offhand;
    gl.depthRange(0.0, 0.01);
    const bobX = o.bob ? o.bob[0] : 0, bobY = o.bob ? o.bob[1] : 0;
    if (o.shield) {
      const k = this._offRaise = (this._offRaise || 0) + ((o.blocking ? 1 : 0) - (this._offRaise || 0)) * 0.35;
      const proj = M4.create(); M4.perspective(proj, 70 * Math.PI / 180, this.fbW / this.fbH, 0.02, 10);
      const m = M4.create(), t = M4.create();
      // 평소: 왼쪽 아래에 비스듬히 / 막기: 가운데 앞으로 들어 올림
      M4.translate(m, -0.6 + k * 0.32 + bobX, -0.52 + k * 0.22 + bobY, -0.95 + k * 0.12);
      M4.mul(m, m, M4.rotY(t, 0.75 - k * 0.6)); M4.mul(m, m, M4.rotX(t, -0.08));
      const sm = M4.create(); sm[0] = sm[5] = sm[10] = 0.55; M4.mul(m, m, sm);
      const eb = this._offEB || (this._offEB = new EntityBatch()); eb.reset();
      addShieldBoxes(eb, m, o.light);
      const pr = this.progs.ent; gl.useProgram(pr.p); this.setCommon(pr, A, st);
      gl.uniformMatrix4fv(pr.u.u_viewProj, false, proj);
      gl.uniform1f(pr.u.u_fogFar, 1000); gl.uniform1f(pr.u.u_fogNear, 999);
      gl.bindVertexArray(this.entVAO); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.entVBO);
      gl.bufferData(gl.ARRAY_BUFFER, eb.f32.subarray(0, eb.n * 14), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, eb.n / 4 * 6, gl.UNSIGNED_INT, 0);
    } else if (o.mesh) {
      this._drawHandInner(st, A, { mesh: o.mesh, flat: o.flat, light: o.light, swing: 0, bob: o.bob, equip: 0, mirror: true });
    }
    gl.depthRange(0.0, 1.0);
  };
}
// 3인칭(나·친구): 왼팔에 방패, 막을 때는 몸 앞으로
Game.prototype.drawOffhandModel = function (p, AM, base, light) {
  const id = p === this.player ? (p.offhand && p.offhand.id) : p.offhandId;
  if (!id || !isShieldId(id)) return;
  const eb = this.renderer.ent, t = M4.create();
  let m;
  if (p.blocking) { m = new Float32Array(base); const tr = M4.create(); M4.translate(tr, -0.1, 1.15, -0.42); M4.mul(m, m, tr); M4.mul(m, m, M4.rotY(t, 0.25)); }
  else if (AM && AM.larm) { m = new Float32Array(AM.larm); const tr = M4.create(); M4.translate(tr, -0.2, -0.45, 0); M4.mul(m, m, tr); M4.mul(m, m, M4.rotY(t, Math.PI / 2)); }
  else return;
  const sm = M4.create(); sm[0] = sm[5] = sm[10] = 0.85; M4.mul(m, m, sm);
  addShieldBoxes(eb, m, light);
};
