'use strict';
// =====================================================================
// 에듀 크래프트: 원작 마인크래프트 요소 더하기 (v1.1)
//  - 경험치(구슬·레벨) · 마법 부여대(효율·날카로움·보호·내구성·바다의 행운)
//  - 마을(집·우물·밭·길) · 주민 4직업 거래 · 철 골렘
//  - 거미 · 늑대(뼈로 길들이기, 앉기/따라오기, 저장됨)
//  - 당근·감자·호박·잭오랜턴·수박·버섯·건초 / 낚싯대 · 방패 · 나침반 · 시계 · 경험치 병
//  - 도전 과제 (L 키, 일시정지 메뉴)
// 기존 동작은 prototype 을 감싸서 바꾼다 (dims.js 와 같은 방식)
// =====================================================================

// ---------------- 텍스처 ----------------
function buildVanillaTextures() {
  const it = (name, fn) => addTex(name, q => { q.clear(); fn(q); q.outline(); }, true);
  addTex('enchant_top', p => {
    p.noise([160, 36, 48], 10); p.border([40, 24, 52]);
    for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) { p.set(x, y, [90, 230, 230]); }
    p.rect(5, 5, 6, 6, [230, 220, 190]); p.rect(5, 5, 6, 1, [120, 70, 40]); p.rect(7, 5, 2, 6, [180, 160, 130]);
  });
  addTex('enchant_side', p => { p.noise([36, 22, 52], 8); p.rect(0, 0, 16, 4, [150, 34, 46]); p.rect(0, 4, 16, 1, [90, 20, 30]); for (let x = 2; x < 16; x += 4) p.set(x, 2, [240, 200, 80]); });
  const crop = (name, col, tip, tipCol, stage) => addTex(name + '_' + stage, p => {
    p.clear(); const h = 3 + stage * 3;
    for (const x of [2, 5, 8, 11, 13]) {
      for (let y = 15; y > 15 - h; y--) p.set(x + ((y + x) % 3 === 0 ? 1 : 0), y, p.vary(col, 14));
      if (stage === 3) { p.rect(x, 15 - h, 2, 2, tipCol); if (tip) p.set(x, 16 - h + 2, tipCol); }
    }
  });
  for (let s = 0; s < 4; s++) { crop('carrots', [70, 170, 50], true, [240, 130, 30], s); crop('potatoes', [80, 165, 60], false, [210, 170, 90], s); }
  addTex('pumpkin_side', p => { p.noise([226, 128, 30], 8); for (let x = 1; x < 16; x += 4) p.rect(x, 0, 1, 16, [190, 100, 20]); });
  addTex('pumpkin_top', p => { p.noise([214, 120, 28], 8); p.disc(8, 8, 2.2, [110, 90, 40]); p.rect(7, 7, 2, 2, [80, 120, 40]); });
  const face = (name, lit) => addTex(name, p => {
    p.copy('pumpkin_side');
    const c = lit ? [255, 226, 90] : [70, 30, 10];
    p.rect(3, 4, 3, 3, c); p.rect(10, 4, 3, 3, c); p.rect(3, 10, 10, 2, c); p.rect(5, 12, 2, 1, c); p.rect(9, 12, 2, 1, c); p.rect(7, 9, 2, 1, c);
  });
  face('pumpkin_face', false); face('jack_face', true);
  addTex('melon_side', p => { p.noise([110, 170, 40], 8); for (let x = 1; x < 16; x += 4) p.rectN(x, 0, 2, 16, [70, 130, 30], 8); });
  addTex('melon_top', p => { p.noise([120, 176, 46], 8); p.disc(8, 8, 2, [90, 140, 34]); });
  addTex('brown_mushroom', p => { p.clear(); p.rect(7, 10, 2, 6, [220, 210, 190]); p.disc(8, 9, 4.5, [160, 115, 85], 10); p.rect(3, 10, 10, 2, [0, 0, 0], 0); p.rect(7, 10, 2, 6, [220, 210, 190]); });
  addTex('red_mushroom', p => { p.clear(); p.rect(7, 10, 2, 6, [230, 225, 210]); p.disc(8, 8.5, 4.5, [210, 40, 40], 8); p.rect(3, 10, 10, 2, [0, 0, 0], 0); p.rect(7, 10, 2, 6, [230, 225, 210]); p.set(6, 6, [250, 250, 250]); p.set(10, 7, [250, 250, 250]); p.set(8, 5, [250, 250, 250]); });
  addTex('hay_side', p => { p.noise([214, 176, 60], 12); for (let y = 0; y < 16; y++) if (y % 4 === 1) p.rect(0, y, 16, 1, [170, 130, 40]); p.rect(0, 3, 16, 1, [140, 70, 40]); p.rect(0, 12, 16, 1, [140, 70, 40]); });
  addTex('hay_top', p => { p.noise([200, 164, 56], 14); p.blobs(8, [170, 136, 44], 8, 0.5, 1.2); });
  // 아이템
  it('carrot', p => { p.line(4, 12, 11, 5, [240, 130, 30], 2); p.line(5, 12, 11, 6, [210, 100, 20], 1); p.rect(11, 2, 2, 3, [70, 170, 50]); p.set(13, 4, [70, 170, 50]); });
  it('potato', p => { p.disc(8, 9, 4.6, [206, 166, 90], 10); p.set(6, 7, [150, 110, 60]); p.set(10, 10, [150, 110, 60]); });
  it('baked_potato', p => { p.disc(8, 9, 4.6, [226, 176, 80], 10); p.rect(6, 7, 4, 2, [250, 230, 140]); });
  it('melon_slice', p => { for (let y = 4; y < 14; y++) for (let x = 3; x < 14; x++) { const d = Math.hypot(x - 8, y - 4); if (d < 9 && y > 4) p.set(x, y, d > 7.6 ? [80, 150, 40] : d > 6.8 ? [230, 230, 180] : [235, 70, 70]); } p.set(6, 8, [30, 20, 20]); p.set(9, 9, [30, 20, 20]); });
  it('pumpkin_pie', p => { p.rect(2, 8, 12, 5, [200, 140, 60]); p.rect(3, 7, 10, 2, [230, 150, 60]); p.rect(2, 12, 12, 1, [160, 100, 40]); });
  it('bowl', p => { for (let x = 2; x < 14; x++) { const h = 3 - Math.abs(x - 7.5) / 3; p.rect(x, 9, 1, Math.max(1, h | 0) + 2, [140, 100, 60]); } p.rect(3, 9, 10, 1, [90, 60, 35]); });
  it('mushroom_stew', p => { for (let x = 2; x < 14; x++) { const h = 3 - Math.abs(x - 7.5) / 3; p.rect(x, 9, 1, Math.max(1, h | 0) + 2, [140, 100, 60]); } p.rect(3, 8, 10, 2, [190, 140, 100]); p.set(5, 8, [210, 60, 50]); p.set(9, 8, [150, 110, 80]); });
  const fish = (name, body, belly) => it(name, p => { p.disc(7, 8, 3.6, body, 8); p.rect(4, 9, 6, 1, belly); p.line(11, 8, 14, 5, body, 1); p.line(11, 8, 14, 11, body, 1); p.set(5, 7, [20, 20, 20]); });
  fish('cod', [190, 160, 120], [230, 210, 180]); fish('cooked_cod', [200, 140, 80], [230, 190, 140]);
  fish('salmon', [200, 90, 80], [230, 160, 140]); fish('cooked_salmon', [190, 110, 70], [220, 150, 110]);
  it('fishing_rod', p => { p.line(2, 14, 13, 2, [120, 80, 40], 1); p.line(13, 2, 13, 12, [220, 220, 220], 1); p.set(13, 13, [150, 150, 160]); p.set(12, 13, [150, 150, 160]); });
  it('shield', p => { p.rect(3, 2, 10, 9, [150, 110, 70]); p.rect(4, 11, 8, 2, [150, 110, 70]); p.rect(6, 13, 4, 1, [150, 110, 70]); p.rect(7, 2, 2, 12, [170, 170, 180]); p.rect(3, 6, 10, 1, [170, 170, 180]); });
  it('compass', p => { p.disc(8, 8, 6, [150, 150, 160]); p.disc(8, 8, 4.6, [235, 235, 220]); p.line(8, 8, 8, 4, [220, 40, 40], 1); p.line(8, 8, 8, 12, [90, 90, 100], 1); });
  it('clock', p => { p.disc(8, 8, 6, [220, 180, 60]); p.disc(8, 8, 4.6, [120, 170, 240]); p.rect(3, 9, 11, 4, [30, 30, 60]); p.disc(6, 6, 1.4, [255, 240, 120]); });
  it('spider_eye', p => { p.disc(8, 9, 4, [160, 30, 50], 10); p.disc(7, 8, 1.5, [230, 80, 100]); });
  it('golden_carrot', p => { p.line(4, 12, 11, 5, [250, 210, 60], 2); p.line(5, 12, 11, 6, [230, 170, 40], 1); p.rect(11, 2, 2, 3, [250, 230, 120]); });
  it('experience_bottle', p => { p.rect(6, 2, 4, 2, [160, 120, 80]); p.rect(7, 4, 2, 2, [190, 230, 240]); p.disc(8, 10, 4.4, [150, 230, 120]); p.set(6, 8, [240, 255, 220]); });
}

// ---------------- 블록 (168~176) ----------------
function defineVanillaBlocks() {
  const b = defBlock;
  b(168, 'enchanting_table', '마법 부여대', { tex: faces({ top: 'enchant_top', side: 'enchant_side', bottom: 'obsidian' }), hard: 5, tool: 'pick', lvl: 1, cat: 'tools', use: 'enchant', emit: 7, push: 'block',
    desc: '청금석과 경험치 레벨을 써서 도구·갑옷에 마법을 걸어요. (우클릭)' });
  const crop = (id, name, k, tex, item) => b(id, name, k, { shape: 'crop', solid: false, opaque: false, layer: 1, hard: 0, sound: 'grass', push: 'break', item: false, wave: 2,
    texf: (m) => T(tex + '_' + Math.min(3, (m & 7) >> 1)),
    drop: (m, rnd) => (m & 7) >= 7 ? [[I(item), 2 + (rnd() * 3 | 0)]] : [[I(item), 1]] });
  crop(169, 'carrots', '당근 작물', 'carrots', 'carrot');
  crop(170, 'potatoes', '감자 작물', 'potatoes', 'potato');
  b(171, 'pumpkin', '호박', { tex: faces({ top: 'pumpkin_top', side: 'pumpkin_side' }), hard: 1, tool: 'axe', sound: 'wood', cat: 'nature', desc: '풀밭에서 가끔 자라요. 횃불과 합치면 잭오랜턴!' });
  b(172, 'jack_o_lantern', '잭오랜턴', { hard: 1, tool: 'axe', sound: 'wood', emit: 15, facingH: true, cat: 'build',
    texf: (m, f) => f === (m & 7) ? T('jack_face') : f < 2 ? T('pumpkin_top') : T('pumpkin_side') });
  b(173, 'melon', '수박', { tex: faces({ top: 'melon_top', side: 'melon_side' }), hard: 1, tool: 'axe', sound: 'wood', cat: 'nature', drop: (m, rnd) => [[I('melon_slice'), 3 + (rnd() * 5 | 0)]] });
  const plant = (id, name, k, t, extra) => b(id, name, k, Object.assign({ tex: faces(t), shape: 'cross', solid: false, opaque: false, layer: 1, hard: 0, sound: 'grass', icon: t, push: 'break', wave: 0, cat: 'nature' }, extra || {}));
  plant(174, 'brown_mushroom', '갈색 버섯', 'brown_mushroom', { emit: 1, desc: '어두운 동굴에서 자라요. 버섯 스튜 재료.' });
  plant(175, 'red_mushroom', '빨간 버섯', 'red_mushroom', { desc: '어두운 동굴에서 자라요. 버섯 스튜 재료.' });
  b(176, 'hay_block', '건초 더미', { tex: faces('hay_side'), texTop: T('hay_top'), texSide: T('hay_side'), axis: true, hard: 0.5, sound: 'grass', cat: 'build' });
}
function defineVanillaItems() {
  const it = defItem;
  it(368, 'carrot', '당근', { food: 3, sat: 3.6, cat: 'food', places: BL.carrots, desc: '먹거나, 경작지에 심을 수 있어요.' });
  it(369, 'potato', '감자', { food: 1, sat: 0.6, cat: 'food', places: BL.potatoes, desc: '경작지에 심거나 화로에 구워 먹어요.' });
  it(370, 'baked_potato', '구운 감자', { food: 5, sat: 6, cat: 'food' });
  it(371, 'melon_slice', '수박 조각', { food: 2, sat: 1.2, cat: 'food' });
  it(372, 'pumpkin_pie', '호박 파이', { food: 8, sat: 4.8, cat: 'food' });
  it(373, 'bowl', '그릇');
  it(374, 'mushroom_stew', '버섯 스튜', { food: 6, sat: 7.2, cat: 'food', stack: 1, desc: '먹으면 그릇이 남아요.' });
  it(375, 'cod', '생대구', { food: 2, sat: 0.4, cat: 'food' });
  it(376, 'cooked_cod', '익힌 대구', { food: 5, sat: 6, cat: 'food' });
  it(377, 'salmon', '생연어', { food: 2, sat: 0.4, cat: 'food' });
  it(378, 'cooked_salmon', '익힌 연어', { food: 6, sat: 9.6, cat: 'food' });
  it(379, 'fishing_rod', '낚싯대', { stack: 1, dur: 64, cat: 'tools', desc: '물을 향해 우클릭으로 던지고, 찌가 쏙 들어가면 다시 우클릭!' });
  it(380, 'shield', '방패', { stack: 1, dur: 336, cat: 'tools', desc: '오른쪽 버튼을 누르고 있으면 몬스터 공격과 화살을 막아요.' });
  it(381, 'compass', '나침반', { cat: 'tools', desc: '들고 있으면 처음 태어난 곳(침대) 방향을 가리켜요.' });
  it(382, 'clock', '시계', { cat: 'tools', desc: '들고 있으면 지금 시각과 낮·밤을 알려 줘요.' });
  it(383, 'spider_eye', '거미 눈', { food: 2, sat: 3.2, cat: 'food' });
  it(384, 'golden_carrot', '황금 당근', { food: 6, sat: 14.4, cat: 'food' });
  it(385, 'experience_bottle', '경험치 병', { cat: 'tools', desc: '우클릭으로 던지면 경험치 구슬이 튀어나와요.' });
}
function defineVanillaRecipes() {
  R([' B ', 'DOD', 'OOO'], { B: 'book', D: 'diamond', O: 'obsidian' }, 'enchanting_table');
  R(['P P', ' P '], { P: '#planks' }, 'bowl', 4);
  S(['bowl', 'brown_mushroom', 'red_mushroom'], 'mushroom_stew');
  S(['pumpkin', 'sugar', 'egg'], 'pumpkin_pie');
  R(['P', 'T'], { P: 'pumpkin', T: 'torch' }, 'jack_o_lantern');
  R(['MMM', 'MMM', 'MMM'], { M: 'melon_slice' }, 'melon');
  R(['WWW', 'WWW', 'WWW'], { W: 'wheat' }, 'hay_block'); S(['hay_block'], 'wheat', 9);
  R(['  S', ' SX', 'S X'], { S: 'stick', X: 'string' }, 'fishing_rod');
  R(['PIP', 'PPP', ' P '], { P: '#planks', I: 'iron_ingot' }, 'shield');
  R([' I ', 'IRI', ' G '], { I: 'iron_ingot', R: 'redstone', G: 'glass' }, 'compass');
  R([' G ', 'GRG', ' G '], { G: 'gold_ingot', R: 'redstone' }, 'clock');
  R(['NNN', 'NCN', 'NNN'], { N: 'gold_nugget', C: 'carrot' }, 'golden_carrot');
}
function defineVanillaSmelting() {
  const s = (a, b) => { SMELT[I(a)] = I(b); };
  s('potato', 'baked_potato'); s('cod', 'cooked_cod'); s('salmon', 'cooked_salmon');
  FUEL[I('bowl')] = 100; FUEL[I('hay_block')] = 400; FUEL[I('fishing_rod')] = 300;
}
LOOT.village = [['bread', 2, 5], ['carrot', 2, 6], ['potato', 2, 6], ['emerald', 1, 3], ['iron_ingot', 1, 3], ['apple', 1, 3], ['wheat', 3, 8], ['bowl', 0, 2]];
LOOT.fortress.push(['experience_bottle', 1, 3]); LOOT.stronghold.push(['experience_bottle', 2, 4]);

// =====================================================================
// 마법 부여
// =====================================================================
const ENCH = {
  eff: { k: '효율', max: 5, ok: d => d.tool && ['pick', 'axe', 'shovel', 'hoe'].includes(d.tool.kind) },
  sharp: { k: '날카로움', max: 5, ok: d => d.tool && (d.tool.kind === 'sword' || d.tool.kind === 'axe') },
  prot: { k: '보호', max: 4, ok: d => !!d.armor },
  luck: { k: '바다의 행운', max: 3, ok: d => d.name === 'fishing_rod' },
  unb: { k: '내구성', max: 3, ok: d => !!d.dur },
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
function enchantable(id) { const d = ITEMS[id]; return !!d && Object.values(ENCH).some(e => e.ok(d)); }
function enchLv(it, k) { return it && it.e ? (it.e[k] | 0) : 0; }
function enchText(e) { return Object.keys(e || {}).filter(k => ENCH[k]).map(k => ENCH[k].k + ' ' + ROMAN[e[k]]).join(', '); }
// 선택지 i(0~2)에 걸릴 마법 (seed 로 미리 정해 두어 보고 고를 수 있게)
function rollEnchant(id, tier, seed) {
  const d = ITEMS[id], rnd = mulberry32(seed * 31 + tier * 7 + id);
  const keys = Object.keys(ENCH).filter(k => ENCH[k].ok(d)); if (!keys.length) return null;
  const main = keys.filter(k => k !== 'unb').length ? keys.filter(k => k !== 'unb') : keys;
  const out = {};
  const k0 = main[rnd() * main.length | 0];
  out[k0] = Math.min(ENCH[k0].max, [1, 2, 4][tier] + (rnd() < 0.4 ? 1 : 0));
  if (tier >= 1 && rnd() < 0.5 + tier * 0.2) { const k1 = keys[rnd() * keys.length | 0]; if (!out[k1]) out[k1] = Math.min(ENCH[k1].max, 1 + (rnd() * (tier + 1) | 0)); }
  return out;
}
const ENCH_COST = [{ need: 2, lv: 1, lapis: 1 }, { need: 8, lv: 2, lapis: 2 }, { need: 15, lv: 3, lapis: 3 }];

// =====================================================================
// 경험치
// =====================================================================
function xpNeed(lv) { return lv < 16 ? 2 * lv + 7 : lv < 31 ? 5 * lv - 38 : 9 * lv - 158; }
Player.prototype.addXP = function (n) {
  this.xpLv = this.xpLv || 0; this.xpPt = (this.xpPt || 0) + n;
  let up = false;
  while (this.xpPt >= xpNeed(this.xpLv)) { this.xpPt -= xpNeed(this.xpLv); this.xpLv++; up = true; }
  const g = this.game; if (!g) return;
  if (up) {
    g.sound.play(this.xpLv % 5 === 0 ? 'levelup' : 'xp_lv');
    if (this.xpLv % 5 === 0) g.ui.toast(`✨ 레벨 ${this.xpLv}!`, 1800);
    if (this.xpLv >= 5) g.advGrant('level5');
  } else g.sound.play('xp');
};
Player.prototype.spendLevels = function (n) { this.xpLv = Math.max(0, (this.xpLv || 0) - n); this.xpPt = Math.min(this.xpPt || 0, xpNeed(this.xpLv) - 1); };
class XPOrb extends Entity {
  constructor(x, y, z, v) { super('xp', 0.25, 0.25); this.x = x; this.y = y; this.z = z; this.v = v; this.vx = (Math.random() - 0.5) * 3; this.vy = 3 + Math.random() * 2; this.vz = (Math.random() - 0.5) * 3; this.stepHeight = 0; }
  update(dt, g) {
    this.age += dt; if (this.age > 300) { this.dead = true; return; }
    const p = g.player;
    const dx = p.x - this.x, dy = p.y + 0.8 - this.y, dz = p.z - this.z, d2 = dx * dx + dy * dy + dz * dz;
    if (!p.dead && this.age > 0.6 && d2 < 49) {
      if (d2 < 1.2) { this.dead = true; if (!p.creative) p.addXP(this.v); return; }
      const d = Math.sqrt(d2), k = (1 - d / 7) * 18 * dt;
      this.vx += dx / d * k; this.vy += dy / d * k; this.vz += dz / d * k;
    } else this.vy -= 12 * dt;
    const fr = Math.exp(-2 * dt); this.vx *= fr; this.vz *= fr;
    this.move(g.world, this.vx * dt, this.vy * dt, this.vz * dt);
  }
  render(g, R, cam) {
    const s = 0.06 + Math.min(0.08, this.v * 0.01), pulse = 0.75 + Math.sin(this.age * 8) * 0.25;
    const m = M4.create(); M4.translate(m, this.x - cam[0], this.y + 0.12 + Math.sin(this.age * 3) * 0.04 - cam[1], this.z - cam[2]);
    M4.mul(m, m, M4.rotY(M4.create(), this.age * 2));
    R.ent.addBox(m, -s, -s, -s, s, s, s, [0.55 * pulse + 0.3, 1, 0.25], 1, 1);
  }
}
Game.prototype.spawnXP = function (x, y, z, total) {
  total = Math.round(total); if (total <= 0 || !this.world || this.world.remote) { if (total > 0 && this.world && this.world.remote && !this.player.creative) this.player.addXP(total); return; }
  let n = Math.min(8, Math.ceil(total / 4));
  while (total > 0 && n > 0) { const v = n === 1 ? total : Math.max(1, Math.round(total / n)); this.ents.add(new XPOrb(x, y, z, v)); total -= v; n--; }
};

// =====================================================================
// 마을
// =====================================================================
const VILLAGE_REGION = 192;   // 블록. 지역마다 마을이 하나 있을 수 있음
function villagePlan(w, rx, rz) {
  const cache = w._villages || (w._villages = new Map());
  const key = rx + ',' + rz;
  if (cache.has(key)) return cache.get(key);
  let plan = null;
  if (w.dim === 'overworld' && w.type !== 'flat') {
    const h0 = hashInt(rx, 71, rz, w.seed);
    if ((h0 & 255) < 190) {
      const x = rx * VILLAGE_REGION + 40 + ((h0 >> 8) & 127) * (VILLAGE_REGION - 80) / 127 | 0;
      const z = rz * VILLAGE_REGION + 40 + ((h0 >> 15) & 127) * (VILLAGE_REGION - 80) / 127 | 0;
      const c0 = w.column(x, z);
      if ((c0.biome === 7 || c0.biome === 2 || c0.biome === 8) && c0.h > SEA + 1 && c0.h < 100) {
        let lo = c0.h, hi = c0.h;
        for (const [ox, oz] of [[12, 0], [-12, 0], [0, 12], [0, -12], [9, 9], [-9, 9], [9, -9], [-9, -9]]) { const h = w.column(x + ox, z + oz).h; lo = Math.min(lo, h); hi = Math.max(hi, h); }
        if (hi - lo <= 6 && lo > SEA) plan = makeVillage(w, x, c0.h, z, c0.biome === 2, h0);
      }
    }
  }
  cache.set(key, plan);
  return plan;
}
function makeVillage(w, x, y, z, desert, h) {
  const rnd = mulberry32(h);
  const v = { x, y, z, desert, houses: [], farms: [], lamps: [] };
  const slots = [];
  // 길 네 방향(동·서·남·북), 길에서 떨어진 쪽 (side)
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const dist of dx ? [7, 15] : [11, 19]) {
    const side = rnd() < 0.5 ? 1 : -1;
    const hx = x + dx * dist + (dx ? 0 : side * 5), hz = z + dz * dist + (dz ? 0 : side * 5);
    // 문은 길 쪽을 봄
    const f = dx ? (side > 0 ? 2 : 3) : (side > 0 ? 4 : 5);
    slots.push({ x: hx, z: hz, f });
  }
  for (let i = slots.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const nH = 4 + (rnd() * 2 | 0);
  slots.slice(0, nH).forEach((s, i) => v.houses.push(Object.assign(s, { chest: i === 0, kind: i % 3 })));
  slots.slice(nH, nH + 2).forEach(s => v.farms.push({ x: s.x, z: s.z, crop: [BL.wheat, BL.carrots, BL.potatoes][rnd() * 3 | 0] }));
  v.lamps.push([x + 3, z + 3], [x - 4, z - 4]);
  v.r = 26;
  return v;
}
function villagesNear(w, x, z) {
  const out = [], rx = Math.floor(x / VILLAGE_REGION), rz = Math.floor(z / VILLAGE_REGION);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const v = villagePlan(w, rx + a, rz + b); if (v) out.push(v); }
  return out;
}
// 청크 안에 들어오는 마을 부분만 그림
function stampVillage(w, c, v, cols) {
  const bx = c.cx * 16, bz = c.cz * 16;
  if (v.x + v.r < bx || v.x - v.r > bx + 15 || v.z + v.r < bz || v.z - v.r > bz + 15) return;
  const ids = c.ids, meta = c.meta, Y = v.y;
  const inC = (x, z) => x >= bx && x < bx + 16 && z >= bz && z < bz + 16;
  const put = (x, y, z, id, m) => { if (!inC(x, z) || y < 1 || y >= HEIGHT) return; const i = CI(x - bx, y, z - bz); ids[i] = id; meta[i] = m | 0; };
  const get = (x, y, z) => inC(x, z) ? ids[CI(x - bx, y, z - bz)] : 0;
  const ground = (x, z) => inC(x, z) ? cols[(x - bx) | ((z - bz) << 4)].h : Y;
  const wall = v.desert ? BL.sandstone : BL.oak_planks, base = v.desert ? BL.sandstone : BL.cobblestone, post = v.desert ? BL.sandstone : BL.oak_log;
  const path = v.desert ? BL.sandstone : BL.gravel;
  // 기초: 발판 아래를 채우고 위를 비움
  const pad = (x0, z0, x1, z1, top, fill, clearH) => {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!inC(x, z)) continue;
      const gh = ground(x, z);
      for (let y = Math.min(gh, top - 1) - 2; y < top; y++) if (y > 0) put(x, y, z, y === top - 1 ? fill : (get(x, y, z) && !IS_FLUID[get(x, y, z)] ? get(x, y, z) : base), 0);
      for (let y = top; y <= top + clearH; y++) put(x, y, z, 0, 0);
    }
  };
  // 길
  const road = (x0, z0, x1, z1) => {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!inC(x, z)) continue;
      let gh = ground(x, z);
      if (Math.abs(gh - Y) > 4) continue;
      if (gh < SEA) { put(x, SEA, z, BL.oak_planks, 0); continue; }
      put(x, gh, z, path, 0);
      for (let y = gh + 1; y <= gh + 4; y++) if (get(x, y, z) && !IS_FLUID[get(x, y, z)]) put(x, y, z, 0, 0);
    }
  };
  road(v.x - 22, v.z - 1, v.x + 22, v.z + 1); road(v.x - 1, v.z - 26, v.x + 1, v.z + 26);
  // 우물
  pad(v.x - 2, v.z - 2, v.x + 1, v.z + 1, Y + 1, base, 5);
  for (let dx = -2; dx <= 1; dx++) for (let dz = -2; dz <= 1; dz++) {
    const edge = dx === -2 || dx === 1 || dz === -2 || dz === 1;
    if (edge) { put(v.x + dx, Y + 1, v.z + dz, base, 0); if ((dx === -2 || dx === 1) && (dz === -2 || dz === 1)) { put(v.x + dx, Y + 2, v.z + dz, BL.oak_fence, 0); put(v.x + dx, Y + 3, v.z + dz, BL.oak_fence, 0); } }
    else { put(v.x + dx, Y, v.z + dz, BL.water, 0); put(v.x + dx, Y - 1, v.z + dz, base, 0); }
    put(v.x + dx, Y + 4, v.z + dz, v.desert ? BL.sandstone_slab : BL.oak_slab, 0);
  }
  // 가로등
  for (const [lx, lz] of v.lamps) { const gh = ground(lx, lz); if (Math.abs(gh - Y) > 3) continue; put(lx, gh + 1, lz, BL.oak_fence, 0); put(lx, gh + 2, lz, BL.oak_fence, 0); put(lx, gh + 3, lz, BL.jack_o_lantern, 2); }
  // 집
  for (const H of v.houses) {
    const x0 = H.x - 2, z0 = H.z - 2, x1 = H.x + 2, z1 = H.z + 2;
    pad(x0, z0, x1, z1, Y + 1, base, 6);
    const door = [H.x + DX[H.f] * 2, H.z + DZ[H.f] * 2];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const ex = x === x0 || x === x1, ez = z === z0 || z === z1;
      for (let u = 1; u <= 3; u++) {
        let id = 0;
        if (ex && ez) id = post;
        else if (ex || ez) id = (u === 2 && ((ex && z === H.z) || (ez && x === H.x))) ? BL.glass : wall;
        put(x, Y + 1 + u, z, id, 0);
      }
      put(x, Y + 5, z, v.desert ? BL.sandstone : (H.kind === 1 ? BL.spruce_planks : BL.oak_planks), 0);
      if (!v.desert && (ex || ez)) put(x, Y + 6, z, BL.oak_slab, 0);
      put(x, Y + 1, z, ex || ez ? base : (v.desert ? BL.sandstone : BL.oak_planks), 0);
    }
    // 문 (아래·위), 문 앞 계단 발판
    put(door[0], Y + 2, door[1], BL.oak_door, OPP[H.f]); put(door[0], Y + 3, door[1], BL.oak_door, OPP[H.f] | 16);
    put(door[0] + DX[H.f], Y + 1, door[1] + DZ[H.f], base, 0);
    for (let k = 2; k <= 3; k++) put(door[0] + DX[H.f], Y + k, door[1] + DZ[H.f], 0, 0);
    // 안쪽: 횃불·제작대·침대·상자
    const back = OPP[H.f], side = CW[H.f];
    put(H.x + DX[back] + DX[side], Y + 2, H.z + DZ[back] + DZ[side], H.kind === 2 ? BL.furnace : BL.crafting_table, H.f);
    put(H.x + DX[back] - DX[side], Y + 2, H.z + DZ[back] - DZ[side], BL.bed, H.f);
    put(H.x, Y + 4, H.z, BL.glowstone, 0);
    if (H.chest) {
      const cx = H.x + DX[side], cz = H.z + DZ[side];
      if (inC(cx, cz)) { put(cx, Y + 2, cz, BL.chest, H.f); w.lootAt.set(fmtKey(cx, Y + 2, cz), 'village'); }
    }
  }
  // 밭 (7×5, 가운데 물길)
  for (const F of v.farms) {
    const x0 = F.x - 3, z0 = F.z - 2, x1 = F.x + 3, z1 = F.z + 2;
    pad(x0, z0, x1, z1, Y + 1, BL.dirt, 3);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (edge) { put(x, Y + 1, z, post, (x === x0 || x === x1) ? 2 : 1); continue; }
      if (z === F.z) { put(x, Y + 1, z, BL.water, 0); continue; }
      put(x, Y + 1, z, BL.farmland, 1); put(x, Y + 2, z, F.crop, 7);
    }
  }
}
{
  const _st = World.prototype.structures;
  World.prototype.structures = function (c, cols) {
    if (_st) _st.call(this, c, cols);
    if (this.dim !== 'overworld' || this.type === 'flat') return;
    for (const v of villagesNear(this, c.cx * 16 + 8, c.cz * 16 + 8)) stampVillage(this, c, v, cols);
    // 호박·수박·버섯
    const rnd = mulberry32(hashInt(c.cx, 133, c.cz, this.seed)), ids = c.ids;
    for (let k = 0; k < 3; k++) {
      const x = rnd() * 16 | 0, z = rnd() * 16 | 0, col = cols[x | z << 4], h = col.h;
      if (h + 2 >= HEIGHT) continue;
      if (ids[CI(x, h, z)] === BL.grass && (ids[CI(x, h + 1, z)] === 0 || ids[CI(x, h + 1, z)] === BL.tallgrass)) {
        const r = rnd();
        if (r < 0.05) ids[CI(x, h + 1, z)] = BL.pumpkin;
        else if (r < 0.07 && (col.biome === 4 || col.biome === 7)) ids[CI(x, h + 1, z)] = BL.melon;
      }
      // 동굴 바닥 버섯
      const y = 12 + (rnd() * (Math.max(13, h - 6) - 12) | 0);
      if (y + 1 < HEIGHT && ids[CI(x, y, z)] === 0 && (ids[CI(x, y - 1, z)] === BL.stone || ids[CI(x, y - 1, z)] === BL.deepslate) && rnd() < 0.6) ids[CI(x, y, z)] = rnd() < 0.5 ? BL.brown_mushroom : BL.red_mushroom;
    }
  };
}

// =====================================================================
// 몹: 거미 · 늑대 · 주민 · 철 골렘
// =====================================================================
const PROFS = { villager: '농부', librarian: '사서', smith: '대장장이', cleric: '성직자' };
Object.assign(MOB_TYPES, {
  spider: { k: '거미', hp: 16, w: 1.3, h: 0.9, speed: 2.9, hostile: true, dmg: 2, drops: [['string', 0, 2], ['spider_eye', 0, 1]] },
  wolf: { k: '늑대', hp: 8, w: 0.6, h: 0.85, speed: 2.6, hostile: false, neutral: true, dmg: 3, drops: [] },
  iron_golem: { k: '철 골렘', hp: 100, w: 1.3, h: 2.7, speed: 1.4, hostile: false, persist: true, noFall: true, drops: [['iron_ingot', 3, 5], ['poppy', 0, 2]] },
});
for (const k in PROFS) MOB_TYPES[k] = { k: '주민(' + PROFS[k] + ')', hp: 20, w: 0.6, h: 1.95, speed: 1.3, hostile: false, persist: true, villager: true, drops: [] };
const TRADES = {
  villager: [[['wheat', 18], ['emerald', 1]], [['carrot', 15], ['emerald', 1]], [['potato', 15], ['emerald', 1]], [['emerald', 1], ['bread', 6]], [['emerald', 1], ['pumpkin_pie', 4]], [['emerald', 2], ['golden_carrot', 3]], [['emerald', 1], ['seeds', 12]]],
  librarian: [[['paper', 24], ['emerald', 1]], [['book', 4], ['emerald', 1]], [['emerald', 1], ['bookshelf', 1]], [['emerald', 3], ['compass', 1]], [['emerald', 4], ['clock', 1]], [['emerald', 2], ['glass', 8]], [['emerald', 4], ['experience_bottle', 3]]],
  smith: [[['coal', 15], ['emerald', 1]], [['iron_ingot', 4], ['emerald', 1]], [['emerald', 3], ['iron_pickaxe', 1]], [['emerald', 3], ['iron_sword', 1]], [['emerald', 6], ['iron_chestplate', 1]], [['emerald', 2], ['shield', 1]], [['emerald', 12], ['diamond', 1]]],
  cleric: [[['rotten_flesh', 20], ['emerald', 1]], [['bone', 12], ['emerald', 1]], [['emerald', 1], ['redstone', 4]], [['emerald', 1], ['lapis_lazuli', 4]], [['emerald', 2], ['glowstone', 1]], [['emerald', 5], ['ender_pearl', 1]], [['emerald', 3], ['experience_bottle', 2]]],
};
// 공통 이동 (Mob.update 의 이동 부분과 같음)
function mobMove(e, dt, g, want) {
  const D = e.def, sp = D.speed * want;
  const mx = -Math.sin(e.yaw) * sp, mz = -Math.cos(e.yaw) * sp;
  const k = 1 - Math.exp(-(e.onGround ? 12 : 2) * dt);
  e.vx += (mx - e.vx) * k; e.vz += (mz - e.vz) * k;
  if (e.inWater || e.inLava) e.vy += (1.5 - e.vy) * dt * 3; else e.vy -= 28 * dt;
  if (e.onGround && e.hitH && want > 0) e.vy = 8.5;
  const prevG = e.onGround, mv = e.move(g.world, e.vx * dt, e.vy * dt, e.vz * dt);
  if (!e.onGround && mv[1] < 0) e.fallDist -= mv[1];
  if (e.onGround && !prevG) { if (e.fallDist > 3.5 && !D.noFall) g.damageEntity(e, Math.floor(e.fallDist - 3), 0, 0, 'fall'); e.fallDist = 0; }
  e.walk += Math.hypot(mv[0], mv[2]) * 2.2;
  if (e.y < -20) e.dead = true;
}
function faceTo(e, x, z) { e.yaw = Math.atan2(-(x - e.x), -(z - e.z)); }
function nearestHostile(g, x, y, z, r) {
  let best = null, bd = r * r;
  for (const o of g.ents.list) {
    if (o.dead || o.type !== 'mob' || !o.def || !(o.def.hostile || o.angryAtPlayer) || o.def.boss || o.sub === 'creeper' && false) continue;
    if (!o.def.hostile) continue;
    const d = (o.x - x) ** 2 + (o.y - y) ** 2 + (o.z - z) ** 2; if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function biteTarget(e, t, g, dt, dmg, reach) {
  faceTo(e, t.x, t.z);
  const dist = Math.hypot(t.x - e.x, t.z - e.z);
  e.attackT = (e.attackT || 0) - dt;
  if (dist < reach && Math.abs(t.y - e.y) < 2 && e.attackT <= 0) {
    e.attackT = 0.9;
    const kx = (t.x - e.x) / (dist || 1), kz = (t.z - e.z) / (dist || 1);
    if (t === g.player || g.remotes && [...g.remotes.values()].includes(t)) g.hurtPlayer(t, dmg, 'mob', kx, kz);
    else { g.damageEntity(t, dmg, kx, kz, 'pet'); if (e.sub === 'iron_golem') t.vy = 9; }
    e.swingT = 0.4;
  }
  return dist;
}
// 늑대 (길들인 늑대: 주인 따라가기·앉기·몬스터 공격)
function wolfUpdate(e, dt, g) {
  const owner = e.tamed ? g.allPlayers().find(p => p.name === e.owner) || g.player : null;
  if (!e.tamed) return false;
  e.age += dt; e.checkFluids(g.world); if (e.hurtT > 0) e.hurtT -= dt;
  if (e.swingT > 0) e.swingT -= dt;
  let want = 0;
  // 주인을 때린 몹이나 근처 적대 몹
  if (!e.sit && owner && !owner.dead) {
    if (e.prey && (e.prey.dead || Math.hypot(e.prey.x - e.x, e.prey.z - e.z) > 18)) e.prey = null;
    if (!e.prey) e.prey = nearestHostile(g, owner.x, owner.y, owner.z, 10);
    if (e.prey && e.prey.sub !== 'creeper') { const d = biteTarget(e, e.prey, g, dt, 4, 1.5); want = d > 1.2 ? 1.25 : 0; }
    else {
      const d = Math.hypot(owner.x - e.x, owner.z - e.z);
      if (d > 18 || Math.abs(owner.y - e.y) > 10) { e.x = owner.x + (Math.random() - 0.5) * 2; e.y = owner.y + 0.5; e.z = owner.z + (Math.random() - 0.5) * 2; e.vx = e.vy = e.vz = 0; }
      else if (d > 3.5) { faceTo(e, owner.x, owner.z); want = d > 7 ? 1.4 : 1; }
      else { e.wanderT = (e.wanderT || 0) - dt; if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 3; e.yaw += (Math.random() - 0.5) * 2; } }
    }
  }
  mobMove(e, dt, g, want);
  // 천천히 회복
  e.regen = (e.regen || 0) + dt; if (e.regen > 4) { e.regen = 0; e.hp = Math.min(20, e.hp + 1); }
  return true;
}
function golemUpdate(e, dt, g) {
  e.age += dt; e.checkFluids(g.world); if (e.hurtT > 0) e.hurtT -= dt;
  if (e.swingT > 0) e.swingT -= dt;
  let want = 0;
  if (e.angry > 0) e.angry -= dt;
  let t = null;
  if (e.angry > 0 && e.angryAt && !e.angryAt.dead) t = e.angryAt;
  if (!t) { if (e.prey && (e.prey.dead || Math.hypot(e.prey.x - e.x, e.prey.z - e.z) > 20)) e.prey = null; if (!e.prey && (e.age * 4 | 0) % 4 === 0) e.prey = nearestHostile(g, e.x, e.y, e.z, 14); t = e.prey; }
  if (t) { const d = biteTarget(e, t, g, dt, t === g.player || !t.def ? 5 : 12, 2.2); want = d > 1.8 ? 1.2 : 0; }
  else {
    const home = e.home;
    e.wanderT = (e.wanderT || 0) - dt;
    if (home && Math.hypot(home[0] - e.x, home[1] - e.z) > 14) { faceTo(e, home[0], home[1]); want = 0.7; }
    else { if (e.wanderT <= 0) { e.wanderT = 3 + Math.random() * 5; e.walking = Math.random() < 0.4; e.yaw += (Math.random() - 0.5) * 3; } if (e.walking) want = 0.5; }
  }
  mobMove(e, dt, g, want);
  return true;
}
{
  const _upd = Mob.prototype.update;
  Mob.prototype.update = function (dt, g) {
    if (this.sub === 'wolf' && wolfUpdate(this, dt, g)) return;
    if (this.sub === 'iron_golem') { golemUpdate(this, dt, g); return; }
    if (this.def.villager && this.tradeT > 0) { this.tradeT -= dt; this.checkFluids(g.world); faceTo(this, g.player.x, g.player.z); mobMove(this, dt, g, 0); return; }
    _upd.call(this, dt, g);
    if (this.dead) return;
    // 거미: 벽 타기
    if (this.sub === 'spider' && this.target && this.hitH) this.vy = Math.max(this.vy, 4);
    // 주민: 마을 밖으로 멀리 가지 않음
    if (this.def.villager && this.home && this.panic <= 0 && Math.hypot(this.home[0] - this.x, this.home[1] - this.z) > 16) { faceTo(this, this.home[0], this.home[1]); this.walking = true; }
  };
  const _render = Mob.prototype.render;
  Mob.prototype.render = function (g, R, cam) {
    if (this.sub === 'wolf') { renderWolf(R, this.x - cam[0], this.y - cam[1], this.z - cam[2], this.yaw, this.walk, this.lightAt(g.world), this.hurtT > 0, this.tamed, this.sit, this.angry > 0); return; }
    if (this.sub === 'iron_golem') { renderGolem(R, this.x - cam[0], this.y - cam[1], this.z - cam[2], this.yaw, this.walk, this.lightAt(g.world), this.hurtT > 0, this.swingT || 0); return; }
    _render.call(this, g, R, cam);
  };
}
function mobBase(x, y, z, yaw) { const b = M4.create(), t = M4.create(); M4.translate(b, x, y, z); M4.mul(b, b, M4.rotY(t, yaw)); return [b, t]; }
function renderWolf(R, x, y, z, yaw, walk, L, hurt, tamed, sit, angry) {
  const P = 1 / 16, [base, t] = mobBase(x, y, z, yaw), sw = Math.sin(walk) * 0.7;
  const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
  const box = (m, a, b, c, d, e, f, col) => R.ent.addBox(m, a, b, c, d, e, f, tint(col), L[0], L[1]);
  const at = (px, py, pz, ax) => { const m = new Float32Array(base), tr = M4.create(); M4.translate(tr, px, py, pz); M4.mul(m, m, tr); if (ax) M4.mul(m, m, M4.rotX(t, ax)); return m; };
  const fur = [0.86, 0.85, 0.84], dk = [0.7, 0.68, 0.66];
  const body = sit ? at(0, 6 * P, 0, -0.5) : base;
  box(body, -3 * P, 6 * P, -1 * P, 3 * P, 12 * P, 8 * P, fur);
  box(base, -3.5 * P, 7 * P, -5 * P, 3.5 * P, 13.5 * P, 0, fur);
  if (tamed) box(base, -3.6 * P, 9 * P, -5.2 * P, 3.6 * P, 10.5 * P, -3.5 * P, [0.85, 0.15, 0.15]);
  for (const [lx, lz, ph, back] of [[-1.8 * P, -3 * P, sw, 0], [1.8 * P, -3 * P, -sw, 0], [-1.8 * P, 6 * P, -sw, 1], [1.8 * P, 6 * P, sw, 1]]) {
    if (sit && back) { box(base, lx - P, 0, lz - 5 * P, lx + P, 2 * P, lz - P, dk); continue; }
    box(at(lx, 7 * P, lz, sit ? 0 : ph), -1 * P, -7 * P, -1 * P, 1 * P, 0, 1 * P, dk);
  }
  const hm = at(0, 11 * P, -5 * P, 0);
  box(hm, -3 * P, -2.5 * P, -5 * P, 3 * P, 3.5 * P, 0, fur);
  box(hm, -1.5 * P, -2.5 * P, -8 * P, 1.5 * P, 0.5 * P, -5 * P, dk);
  box(hm, -1 * P, -0.5 * P, -8.1 * P, 1 * P, 0.5 * P, -8 * P, [0.1, 0.1, 0.1]);
  box(hm, -3 * P, 3.5 * P, -2 * P, -1 * P, 5.5 * P, -1 * P, dk); box(hm, 1 * P, 3.5 * P, -2 * P, 3 * P, 5.5 * P, -1 * P, dk);
  const eye = angry ? [0.9, 0.1, 0.1] : [0.1, 0.1, 0.1];
  box(hm, -2.6 * P, 1 * P, -5.05 * P, -1.2 * P, 2 * P, -5 * P, eye); box(hm, 1.2 * P, 1 * P, -5.05 * P, 2.6 * P, 2 * P, -5 * P, eye);
  const tail = at(0, (sit ? 3 : 11) * P, 8 * P, sit ? 1.2 : (tamed ? -0.6 + Math.sin(walk * 0.5) * 0.2 : 0.4));
  box(tail, -1 * P, -8 * P, -1 * P, 1 * P, 0, 1 * P, fur);
}
function renderGolem(R, x, y, z, yaw, walk, L, hurt, swing) {
  const P = 1 / 16, [base, t] = mobBase(x, y, z, yaw), sw = Math.sin(walk * 0.6) * 0.5;
  const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
  const box = (m, a, b, c, d, e, f, col) => R.ent.addBox(m, a, b, c, d, e, f, tint(col), L[0], L[1]);
  const at = (px, py, pz, ax) => { const m = new Float32Array(base), tr = M4.create(); M4.translate(tr, px, py, pz); M4.mul(m, m, tr); if (ax) M4.mul(m, m, M4.rotX(t, ax)); return m; };
  const iron = [0.86, 0.84, 0.8], dk = [0.7, 0.68, 0.64], vine = [0.35, 0.6, 0.3];
  for (const [lx, ph] of [[-3.5 * P, sw], [3.5 * P, -sw]]) box(at(lx, 16 * P, 0, ph), -3 * P, -16 * P, -2.5 * P, 3 * P, 0, 2.5 * P, dk);
  box(base, -9 * P, 16 * P, -6 * P, 9 * P, 34 * P, 5 * P, iron);
  box(base, -9.05 * P, 22 * P, -6.05 * P, -4 * P, 30 * P, 5.05 * P, vine);
  const arm = swing > 0 ? -2.2 * swing : 0;
  for (const [ax, ph] of [[-11 * P, -sw + arm], [11 * P, sw + arm]]) box(at(ax, 33 * P, 0, ph), -2 * P, -30 * P, -3 * P, 2 * P, 0, 3 * P, iron);
  const hm = at(0, 34 * P, -2 * P, 0);
  box(hm, -4 * P, 0, -5 * P, 4 * P, 10 * P, 3 * P, iron);
  box(hm, -1 * P, 1 * P, -7 * P, 1 * P, 5 * P, -5 * P, dk);
  box(hm, -3 * P, 6 * P, -5.05 * P, -1.5 * P, 7 * P, -5 * P, [0.6, 0.2, 0.2]); box(hm, 1.5 * P, 6 * P, -5.05 * P, 3 * P, 7 * P, -5 * P, [0.6, 0.2, 0.2]);
}
{
  const _rmm = renderMobModel;
  renderMobModel = function (R, sub, x, y, z, yaw, walk, L, hurt, fuse) {
    const P = 1 / 16;
    if (sub === 'spider') {
      const [base, t] = mobBase(x, y, z, yaw), sw = Math.sin(walk * 1.5) * 0.35;
      const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
      const box = (m, a, b, c, d, e, f, col, lit) => R.ent.addBox(m, a, b, c, d, e, f, tint(col), lit ? 1 : L[0], lit ? 1 : L[1]);
      const blk = [0.2, 0.17, 0.16];
      box(base, -5 * P, 5 * P, 1 * P, 5 * P, 13 * P, 12 * P, blk);
      box(base, -3 * P, 6 * P, -3 * P, 3 * P, 11 * P, 1 * P, [0.28, 0.24, 0.22]);
      box(base, -4 * P, 5 * P, -11 * P, 4 * P, 13 * P, -3 * P, blk);
      box(base, -3 * P, 9 * P, -11.05 * P, -1 * P, 11 * P, -11 * P, [0.95, 0.15, 0.15], true); box(base, 1 * P, 9 * P, -11.05 * P, 3 * P, 11 * P, -11 * P, [0.95, 0.15, 0.15], true);
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
        const m = new Float32Array(base), tr = M4.create(); M4.translate(tr, s * 3 * P, 9 * P, (-1.5 + i) * 2 * P); M4.mul(m, m, tr);
        M4.mul(m, m, M4.rotY(t, s * (0.6 - i * 0.35) + (i % 2 ? sw : -sw))); M4.mul(m, m, M4.rotZ(t, s * -0.6));
        box(m, s > 0 ? 0 : -15 * P, -1 * P, -1 * P, s > 0 ? 15 * P : 0, 1 * P, 1 * P, blk);
      }
      return;
    }
    if (sub === 'wolf') return renderWolf(R, x, y, z, yaw, walk, L, hurt, false, false, false);
    if (sub === 'iron_golem') return renderGolem(R, x, y, z, yaw, walk, L, hurt, 0);
    if (PROFS[sub]) {
      const [base, t] = mobBase(x, y, z, yaw), sw = Math.sin(walk) * 0.6;
      const robe = { villager: [0.55, 0.4, 0.25], librarian: [0.92, 0.92, 0.9], smith: [0.25, 0.25, 0.28], cleric: [0.55, 0.25, 0.6] }[sub];
      const skin = [0.78, 0.58, 0.45];
      const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
      const box = (m, a, b, c, d, e, f, col) => R.ent.addBox(m, a, b, c, d, e, f, tint(col), L[0], L[1]);
      const at = (px, py, pz, ax) => { const m = new Float32Array(base), tr = M4.create(); M4.translate(tr, px, py, pz); M4.mul(m, m, tr); if (ax) M4.mul(m, m, M4.rotX(t, ax)); return m; };
      for (const [lx, ph] of [[-2 * P, sw], [2 * P, -sw]]) box(at(lx, 12 * P, 0, ph), -2 * P, -12 * P, -2 * P, 2 * P, 0, 2 * P, robe.map(v => v * 0.8));
      box(base, -4 * P, 6 * P, -3 * P, 4 * P, 24 * P, 3 * P, robe);
      // 팔짱
      box(base, -4 * P, 16 * P, -6 * P, 4 * P, 20 * P, -3 * P, robe.map(v => v * 0.9)); box(base, -2 * P, 16.5 * P, -6.1 * P, 2 * P, 19.5 * P, -6 * P, skin);
      box(base, -4 * P, 24 * P, -4 * P, 4 * P, 34 * P, 4 * P, skin);
      box(base, -1 * P, 26 * P, -6 * P, 1 * P, 30 * P, -4 * P, [0.7, 0.5, 0.4]);
      box(base, -3 * P, 30 * P, -4.05 * P, -1 * P, 31 * P, -4 * P, [0.15, 0.4, 0.2]); box(base, 1 * P, 30 * P, -4.05 * P, 3 * P, 31 * P, -4 * P, [0.15, 0.4, 0.2]);
      box(base, -4.2 * P, 32 * P, -4.2 * P, 4.2 * P, 34.3 * P, 4.2 * P, sub === 'villager' ? [0.85, 0.75, 0.35] : robe.map(v => v * 0.7));
      return;
    }
    return _rmm(R, sub, x, y, z, yaw, walk, L, hurt, fuse);
  };
}

// =====================================================================
// 낚시
// =====================================================================
class FishingBobber extends Entity {
  constructor(x, y, z, vx, vy, vz) { super('bobber', 0.2, 0.2); this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz; this.stepHeight = 0; this.wait = 0; this.bite = 0; }
  update(dt, g) {
    this.age += dt;
    const p = g.player, held = p.held;
    if (p.dead || !held || ITEMS[held.id].name !== 'fishing_rod' || Math.hypot(p.x - this.x, p.z - this.z) > 32 || this.age > 120) { this.dead = true; return; }
    this.checkFluids(g.world);
    if (this.inWater) {
      this.vx *= Math.exp(-4 * dt); this.vz *= Math.exp(-4 * dt);
      const top = Math.floor(this.y) + 0.85;
      this.vy += ((top - this.y) * 12 - this.vy * 3) * dt;
      if (this.bite > 0) { this.bite -= dt; this.vy -= 6 * dt; if (this.bite <= 0) this.wait = 3 + Math.random() * 8; }
      else {
        if (!this.wait) this.wait = 4 + Math.random() * 10 - enchLv(held, 'luck') * 1.5;
        this.wait -= dt;
        if (this.wait <= 1.2 && this.wait > 0 && Math.random() < dt * 6) g.particles.add({ x: this.x + (Math.random() - 0.5) * 2 * this.wait, y: this.y + 0.1, z: this.z + (Math.random() - 0.5) * 2 * this.wait, vx: 0, vy: 0.5, vz: 0, life: 0.4, size: 0.05, layer: T('white'), u: 0, v: 0, g: 0, tint: [0.8, 0.9, 1] });
        if (this.wait <= 0) { this.bite = 1.1; g.sound.play('splash', this.x, this.y, this.z); g.particles.smoke(this.x, this.y + 0.2, this.z, 8, [0.85, 0.92, 1]); }
      }
    } else this.vy -= 20 * dt;
    this.move(g.world, this.vx * dt, this.vy * dt, this.vz * dt);
  }
  render(g, R, cam) {
    const m = M4.create(); M4.translate(m, this.x - cam[0], this.y - cam[1], this.z - cam[2]);
    const L = this.lightAt(g.world);
    R.ent.addBox(m, -0.06, 0, -0.06, 0.06, 0.06, 0.06, [0.9, 0.15, 0.15], L[0], L[1]);
    R.ent.addBox(m, -0.06, 0.06, -0.06, 0.06, 0.12, 0.06, [0.95, 0.95, 0.95], L[0], L[1]);
    // 낚싯줄 (작은 점들)
    const p = g.player, d = p.lookDir(), hx = p.x + d[0] * 0.6 - d[2] * 0.35, hy = p.eyeY() - 0.2 + d[1] * 0.6, hz = p.z + d[2] * 0.6 + d[0] * 0.35;
    const n = 14;
    for (let i = 1; i < n; i++) {
      const k = i / n, sag = Math.sin(k * Math.PI) * 0.6;
      const mm = M4.create(); M4.translate(mm, hx + (this.x - hx) * k - cam[0], hy + (this.y + 0.1 - hy) * k - sag - cam[1], hz + (this.z - hz) * k - cam[2]);
      R.ent.addBox(mm, -0.012, -0.012, -0.012, 0.012, 0.012, 0.012, [0.95, 0.95, 0.95], L[0], L[1]);
    }
  }
}
function fishLoot(luck) {
  const r = Math.random();
  if (r < 0.08 + luck * 0.04) { const T2 = [['emerald', 1], ['bow', 1], ['experience_bottle', 2], ['lapis_lazuli', 4], ['golden_apple', 1], ['book', 1]]; return T2[Math.random() * T2.length | 0]; }
  if (r < 0.16) { const J = [['bone', 1], ['string', 2], ['bowl', 1], ['stick', 2], ['rotten_flesh', 1]]; return J[Math.random() * J.length | 0]; }
  return Math.random() < 0.65 ? ['cod', 1] : ['salmon', 1];
}

// =====================================================================
// 도전 과제
// =====================================================================
const ADV = [
  ['wood', 'oak_log', '나무 베기', '원목을 처음 얻었어요', ['#log']],
  ['bench', 'crafting_table', '작업 시작', '제작대를 만들었어요', ['crafting_table']],
  ['pick', 'wood_pickaxe', '광부의 첫걸음', '곡괭이를 만들었어요', ['#pickaxe']],
  ['stone', 'cobblestone', '석기 시대', '조약돌을 얻었어요', ['cobblestone', 'cobbled_deepslate']],
  ['furnace', 'furnace', '뜨거운 화로', '화로를 만들었어요', ['furnace']],
  ['iron', 'iron_ingot', '철을 얻다', '철 주괴를 얻었어요', ['iron_ingot']],
  ['armor', 'iron_chestplate', '튼튼한 옷', '갑옷을 얻었어요', ['#armor']],
  ['diamond', 'diamond', '다이아몬드!', '다이아몬드를 찾았어요', ['diamond']],
  ['redstone', 'redstone', '전기의 시작', '레드스톤 가루를 얻었어요', ['redstone']],
  ['food', 'bread', '냠냠', '음식을 먹었어요', null],
  ['farm', 'wheat', '농부', '밀·당근·감자를 얻었어요', ['wheat', 'carrot', 'potato']],
  ['bed', 'bed', '잘 자요', '침대를 만들었어요', ['bed']],
  ['hunter', 'stone_sword', '몬스터 사냥꾼', '적대적 몹을 물리쳤어요', null],
  ['fish', 'cod', '낚시꾼', '물고기나 보물을 낚았어요', null],
  ['tame', 'bone', '최고의 친구', '늑대를 길들였어요', null],
  ['village', 'emerald', '마을 발견', '마을을 찾았어요', null],
  ['trade', 'emerald', '거래 성사', '주민과 거래했어요', null],
  ['level5', 'experience_bottle', '경험 많은', '레벨 5에 올랐어요', null],
  ['enchant', 'enchanting_table', '마법사', '마법을 부여했어요', null],
  ['bot', 'builder_remote', '빌더봇 첫 작품', '빌더봇이 건물을 완성했어요', null],
  ['coder', 'book', '코딩 도전자', '코딩 도전 과제를 3개 깼어요', null],
  ['obsidian', 'obsidian', '단단한 돌', '흑요석을 얻었어요', ['obsidian']],
  ['nether', 'netherrack', '지옥으로', '지옥에 들어갔어요', null],
  ['blaze', 'blaze_rod', '불꽃 사냥', '블레이즈 막대를 얻었어요', ['blaze_rod']],
  ['eye', 'eye_of_ender', '엔더의 눈', '엔더의 눈을 만들었어요', ['eye_of_ender']],
  ['end', 'end_stone', '끝의 세계', '엔드에 들어갔어요', null],
  ['dragon', 'dragon_egg', '드래곤 사냥꾼', '엔더 드래곤을 물리쳤어요', null],
];
let _advIds = null;
function advItemIds(list) {
  const out = new Set();
  for (const n of list) {
    if (n === '#log') GROUPS.log.forEach(i => out.add(i));
    else if (n === '#pickaxe') ITEMS.forEach(d => d && d.tool && d.tool.kind === 'pick' && out.add(d.id));
    else if (n === '#armor') ITEMS.forEach(d => d && d.armor && out.add(d.id));
    else out.add(I(n));
  }
  return out;
}
Game.prototype.advGrant = function (id) {
  if (!this.adv || this.adv.has(id) || !this.player || this.player.creative) return;
  const a = ADV.find(x => x[0] === id); if (!a) return;
  this.adv.add(id);
  this.ui.toast(`🏆 도전 과제 달성! 「${a[2]}」 (${this.adv.size}/${ADV.length})`, 3200);
  this.ui.chatLine(`🏆 도전 과제 「${a[2]}」 — ${a[3]}`, '#ffe27a');
  this.sound.play('levelup');
  this.spawnXP(this.player.x, this.player.y + 1, this.player.z, 3 + this.adv.size % 4);
};
UI.prototype.showAdvancements = function (back) {
  const g = this.g;
  this.modal = 'settings'; document.body.classList.add('modal'); g.input.releaseLock();
  const have = g.adv || new Set();
  const cards = ADV.map(a => `<div class="adv-card ${have.has(a[0]) ? 'done' : ''}"><i class="ic adv-ic" data-id="${I(a[1])}"></i><div><b>${esc(a[2])}</b><small>${esc(a[3])}</small></div></div>`).join('');
  const s = this.screen('menu-adv', `<div class="panel">
      <h2>🏆 도전 과제 <span class="muted" style="font-size:16px">${have.size} / ${ADV.length}</span></h2>
      <p class="muted">서바이벌에서 모험하며 하나씩 깨 보세요. 깰 때마다 경험치를 받아요. (L 키)</p>
      <div class="adv-grid">${cards}</div>
      <div class="row"><span style="flex:1"></span><button class="btn primary" id="adv-back">돌아가기</button></div></div>`);
  $$('.adv-ic', s).forEach(el => applyIcon(el, +el.dataset.id));
  $('#adv-back', s).onclick = () => { if (back) back(); else this.closeModal(); };
  this.show('menu-adv');
};

// =====================================================================
// 화면: 마법 부여대 · 거래
// =====================================================================
UI.prototype.openEnchant = function () {
  const g = this.g, p = g.player;
  this.beginModal('enchant');
  this.craftGrid = [null, null];   // 닫을 때 가방으로 돌려줌
  if (!p.enchSeed) p.enchSeed = 1 + (Math.random() * 1e6 | 0);
  const s = this.screen('inv-screen', `<div class="inv-panel" id="ip-main"><button class="inv-close" id="ip-x">✕</button><h4>마법 부여대 <span class="muted" id="en-lv"></span></h4>
    <div class="inv-flex ench-box"><div class="col" style="align-items:center;gap:6px" id="en-slots"></div><div class="ench-opts" id="en-opts"></div></div>
    <div id="en-inv" style="margin-top:10px"></div></div>`);
  const sl = $('#en-slots', s);
  this.mountSlot(sl, Object.assign(this.ref(() => this.craftGrid, 0), { container: true, accept: it => enchantable(it.id) && !it.e }));
  this.mountSlot(sl, Object.assign(this.ref(() => this.craftGrid, 1), { container: true, accept: it => it.id === I('lapis_lazuli') }), 'lapis');
  const tip = document.createElement('small'); tip.className = 'muted'; tip.textContent = '위: 도구·갑옷 · 아래: 청금석'; sl.appendChild(tip);
  this.buildPlayerInv($('#en-inv', s));
  $('#ip-x', s).onclick = () => this.closeModal();
  this.renderEnchOptions();
  this.show('inv-screen');
};
UI.prototype.renderEnchOptions = function () {
  const g = this.g, p = g.player, box = $('#en-opts'); if (!box) return;
  const lv = p.xpLv || 0, item = this.craftGrid && this.craftGrid[0], lap = this.craftGrid && this.craftGrid[1];
  $('#en-lv').textContent = p.creative ? '(크리에이티브)' : `· 내 레벨 ${lv}`;
  box.innerHTML = '';
  if (!item) { box.innerHTML = '<p class="muted" style="max-width:240px">마법을 걸 도구·무기·갑옷·낚싯대를 왼쪽 위 칸에, 청금석을 아래 칸에 넣어요.<br>경험치는 광석을 캐거나 몹을 물리치면 모여요.</p>'; return; }
  ENCH_COST.forEach((c, i) => {
    const ench = rollEnchant(item.id, i, p.enchSeed);
    const ok = p.creative || (lv >= c.need && lap && lap.n >= c.lapis);
    const b = document.createElement('button'); b.className = 'btn ench-opt' + (ok ? '' : ' off');
    b.innerHTML = `<b>${['✦', '✦✦', '✦✦✦'][i]} ${esc(enchText(ench).split(', ')[0])}${Object.keys(ench).length > 1 ? ' …?' : ''}</b><small>레벨 ${c.need} 이상 · 레벨 ${c.lv}개와 청금석 ${c.lapis}개를 써요</small>`;
    b.onclick = () => {
      if (!ok) { this.toast(lv < c.need ? `레벨이 ${c.need} 이상이어야 해요 (지금 ${lv})` : `청금석이 ${c.lapis}개 필요해요`); return; }
      item.e = ench;
      if (!p.creative) { p.spendLevels(c.lv); lap.n -= c.lapis; if (lap.n <= 0) this.craftGrid[1] = null; }
      p.enchSeed = 1 + (Math.random() * 1e6 | 0);
      g.sound.play('enchant'); g.particles.dust(p.x, p.y + 1.5, p.z, [0.6, 0.4, 1]);
      this.toast(`✨ ${itemName(item.id)}: ${enchText(ench)}`, 2600);
      g.advGrant('enchant');
      this.refreshSlots(); this.renderEnchOptions();
    };
    box.appendChild(b);
  });
};
UI.prototype.openTrade = function (mob) {
  const g = this.g, p = g.player, prof = mob.sub;
  if (this.modal) return;
  this.beginModal('trade');
  mob.tradeT = 1e9; this._tradeMob = mob;
  g.sound.play('villager', mob.x, mob.y + 1.5, mob.z);
  const s = this.screen('inv-screen', `<div class="inv-panel" id="ip-main" style="max-width:520px"><button class="inv-close" id="ip-x">✕</button>
    <h4>🧑‍🌾 ${esc(MOB_TYPES[prof].k)}와(과) 거래 <span class="muted" id="tr-em"></span></h4><div id="tr-list" class="trade-list"></div>
    <p class="muted" style="font-size:13px;margin:8px 0 0">에메랄드는 산의 에메랄드 광석이나 거래로 모아요. 누를 때마다 한 번씩 거래해요.</p></div>`);
  const draw = () => {
    const list = $('#tr-list', s); list.innerHTML = '';
    $('#tr-em', s).textContent = `· 내 에메랄드 ${p.count(I('emerald'))}개`;
    for (const [[cn, cc], [rn, rc]] of TRADES[prof] || []) {
      const cid = I(cn), rid = I(rn), ok = p.creative || p.count(cid) >= cc;
      const row = document.createElement('button'); row.className = 'trade-row' + (ok ? '' : ' off');
      row.innerHTML = `<i class="ic"></i><span>${esc(itemName(cid))} ×${cc}</span><em>➜</em><i class="ic"></i><span>${esc(itemName(rid))} ×${rc}</span>`;
      applyIcon(row.children[0], cid); applyIcon(row.children[3], rid);
      row.onclick = () => {
        if (!ok) { this.toast(`${itemName(cid)}이(가) ${cc}개 필요해요 (가진 것 ${p.count(cid)}개)`); return; }
        if (!p.creative) p.take(cid, cc);
        const left = p.give(rid, rc); if (left) g.dropItem(p.x, p.y + 1, p.z, { id: rid, n: left });
        g.sound.play('pop'); g.sound.play('villager', mob.x, mob.y + 1.5, mob.z);
        if (!p.creative) p.addXP(1 + (Math.random() * 3 | 0));
        g.advGrant('trade');
        this.refreshHotbar(); draw();
      };
      list.appendChild(row);
    }
  };
  draw();
  $('#ip-x', s).onclick = () => this.closeModal();
  this.show('inv-screen');
};
{
  const _cm = UI.prototype.closeModal;
  UI.prototype.closeModal = function (noLock) {
    if (this.modal === 'trade' && this._tradeMob) { this._tradeMob.tradeT = 1.5; this._tradeMob = null; }
    return _cm.call(this, noLock);
  };
  UI.prototype.returnItem = function (it) {
    const p = this.g.player, left = p.give(it.id, it.n, it.d, it.e);
    if (left > 0) this.g.dropItem(p.x, p.eyeY() - 0.3, p.z, { id: it.id, n: left, d: it.d, e: it.e });
  };
  const _asc = UI.prototype.afterSlotChange;
  UI.prototype.afterSlotChange = function (r) { _asc.call(this, r); if (this.modal === 'enchant') this.renderEnchOptions(); };
  // 마법 걸린 아이템 설명 · 반짝임
  const _tip = UI.prototype.showTip;
  UI.prototype.showTip = function (r) {
    _tip.call(this, r);
    const it = r.tipItem ? r.tipItem() : r.get();
    if (it && it.e && this.tip.style.display === 'block') { this.tip.insertAdjacentHTML('beforeend', `<small class="ench-txt">✨ ${esc(enchText(it.e))}</small>`); this.placeTip(); }
  };
  const _ds = UI.prototype.drawSlot;
  UI.prototype.drawSlot = function (el, it) { _ds.call(this, el, it); el.classList.toggle('ench', !!(it && it.e)); };
}

// =====================================================================
// 플레이어 · 게임 동작 끼워 넣기
// =====================================================================
{
  const P = Player.prototype;
  // 줍기: 마법 유지
  const _give = P.give;
  P.give = function (id, n, dur, ench) {
    if (!ench || itemMaxStack(id) > 1) return _give.call(this, id, n, dur);
    for (let i = 0; i < 36 && n > 0; i++) if (!this.inv[i]) { this.inv[i] = { id, n: 1, e: ench }; if (dur !== undefined) this.inv[i].d = dur; n--; }
    if (this.game && this.game.ui) this.game.ui.refreshHotbar();
    return n;
  };
  ItemEntity.prototype.pickupCheck = function (dt, g) {
    const p = g.player;
    if (this.pickup > 0 || p.dead) return;
    const dx = p.x - this.x, dy = (p.y + 0.8) - this.y, dz = p.z - this.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= 2.2 * 2.2) return;
    if (d2 < 1.1) {
      const left = p.give(this.item.id, this.item.n, this.item.d, this.item.e);
      if (left < this.item.n) g.sfx('pop', this.x, this.y, this.z);
      if (left <= 0) this.dead = true; else this.item.n = left;
    } else { const k = 10 * dt / Math.sqrt(d2); this.x += dx * k; this.y += dy * k; this.z += dz * k; }
  };
  // 내구성
  const _dh = P.damageHeld;
  P.damageHeld = function (n) { const s = this.inv[this.sel], u = enchLv(s, 'unb'); if (u && Math.random() < u / (u + 1)) return; _dh.call(this, n); };
  // 보호
  const _ar = P.armorReduce;
  P.armorReduce = function (amount, src) {
    let a = _ar.call(this, amount, src);
    if (ARMOR_BYPASS.has(src) && src !== 'fall') return a;
    let prot = 0; for (const it of this.armor || []) prot += enchLv(it, 'prot');
    return a * (1 - Math.min(0.6, prot * 0.05));
  };
  // 방패
  const _hurt = P.hurt;
  P.hurt = function (amount, src, kx, kz) {
    if (this.blocking && !this.creative && (src === 'mob' || src === 'arrow' || src === 'explosion' || src === 'fireball' || src === 'dragon')) {
      if (this.invul > 0) return false;
      const g = this.game; this.invul = 0.5;
      if (g) { g.sound.play('shield', this.x, this.y + 1, this.z); }
      const sh = this.held; if (sh) { sh.d = (sh.d || 0) + 1; if (sh.d >= ITEMS[sh.id].dur) { this.inv[this.sel] = null; this.blocking = false; if (g) g.sfx('break_tool', this.x, this.y + 1, this.z); } if (g) g.ui.refreshHotbar(); }
      if (kx !== undefined) { this.vx += kx * 2; this.vz += kz * 2; }
      if (src !== 'explosion' && src !== 'dragon') return false;
      amount *= 0.35;
    }
    return _hurt.call(this, amount, src, kx, kz);
  };
  const _eat = P.eat;
  P.eat = function (f, s) { _eat.call(this, f, s); if (this.game) this.game.advGrant('food'); };
}
{
  const G = Game.prototype;
  // 시작/저장: 경험치·도전 과제·길들인 늑대
  const _sw = G.startWorld;
  G.startWorld = async function (opt) {
    const rec = opt.rec;
    this.ents = null; this._entsDim = null;
    this.petStore = (rec && rec.pets) ? JSON.parse(JSON.stringify(rec.pets)) : {};
    this.adv = new Set(rec && rec.adv || []);
    this._villSpawned = new Set(); this._vTick = 0;
    await _sw.call(this, opt);
    const p = this.player;
    p.xpLv = rec && rec.player && rec.player.xpLv || 0; p.xpPt = rec && rec.player && rec.player.xpPt || 0; p.enchSeed = rec && rec.player && rec.player.enchSeed || 0;
  };
  const _ser = G.serializeWorld;
  G.serializeWorld = function () {
    const r = _ser.call(this), p = this.player;
    r.player.xpLv = p.xpLv || 0; r.player.xpPt = p.xpPt || 0; r.player.enchSeed = p.enchSeed || 0;
    r.adv = [...(this.adv || [])];
    const pets = JSON.parse(JSON.stringify(this.petStore || {}));
    pets[this.world.dim] = (pets[this.world.dim] || []).concat(this.collectPets());
    r.pets = pets;
    return r;
  };
  G.collectPets = function () {
    const out = [];
    if (this.ents) for (const e of this.ents.list) if (!e.dead && e.sub === 'wolf' && e.tamed && !e.remote) out.push({ x: +e.x.toFixed(2), y: +e.y.toFixed(2), z: +e.z.toFixed(2), sit: !!e.sit, owner: e.owner, hp: e.hp });
    return out;
  };
  const _aw = G.attachWorld;
  G.attachWorld = function (w) {
    if (this.ents && this._entsDim && this.petStore) {
      const list = this.collectPets(); if (list.length) this.petStore[this._entsDim] = (this.petStore[this._entsDim] || []).concat(list);
    }
    _aw.call(this, w);
    this._entsDim = w.dim; this._villSpawned = new Set();
  };
  G.vanillaTick = function (dt) {
    const p = this.player, w = this.world;
    // 길들인 늑대 다시 불러오기
    const pend = this.petStore && this.petStore[w.dim];
    if (pend && pend.length && !w.remote) {
      for (let i = pend.length - 1; i >= 0; i--) {
        const s = pend[i]; if (!w.isLoadedAt(Math.floor(s.x), Math.floor(s.z))) continue;
        const e = this.ents.add(new Mob('wolf', s.x, s.y + 0.1, s.z)); e.tamed = true; e.owner = s.owner || p.name; e.sit = !!s.sit; e.hp = s.hp || 20;
        pend.splice(i, 1);
      }
    }
    // 방패 들기
    p.blocking = !!(this.input.s && this.input.s.use && p.held && ITEMS[p.held.id].name === 'shield' && !p.dead);
    // 경험치 막대
    const xb = this._xpEl || (this._xpEl = { bar: document.getElementById('xpbar'), fill: document.getElementById('xpfill'), lv: document.getElementById('xplv') });
    const key = p.creative ? 'c' : (p.xpLv || 0) + ':' + ((p.xpPt || 0) * 100 / xpNeed(p.xpLv || 0) | 0);
    if (key !== this._xpKey && xb.bar) {
      this._xpKey = key; xb.bar.style.display = p.creative ? 'none' : '';
      if (!p.creative) { xb.fill.style.width = Math.min(100, (p.xpPt || 0) * 100 / xpNeed(p.xpLv || 0)) + '%'; xb.lv.textContent = p.xpLv ? p.xpLv : ''; }
    }
    // 나침반·시계
    this.updateGadget();
    // 1초마다: 도전 과제, 마을
    this._vTick -= dt;
    if (this._vTick > 0) return;
    this._vTick = 1;
    if (!p.creative && this.found) {
      if (!_advIds) _advIds = new Map(ADV.filter(a => a[4]).map(a => [a[0], advItemIds(a[4])]));
      for (const [id, set] of _advIds) if (!this.adv.has(id)) for (const f of set) if (this.found.has(f)) { this.advGrant(id); break; }
      if (w.dim === 'nether') this.advGrant('nether');
      if (w.dim === 'end') this.advGrant('end');
      if (this.dragon && this.dragon.dead) this.advGrant('dragon');
    }
    if (w.dim === 'overworld' && w.type !== 'flat') {
      for (const v of villagesNear(w, p.x, p.z)) {
        if (Math.hypot(v.x - p.x, v.z - p.z) < 30) this.advGrant('village');
        const k = v.x + ',' + v.z;
        if (w.remote || this._villSpawned.has(k) || !w.isLoadedAt(v.x, v.z) || !w.isLoadedAt(v.x + 16, v.z + 16) || !w.isLoadedAt(v.x - 16, v.z - 16)) continue;
        this._villSpawned.add(k);
        if (this.ents.count(e => e.def && e.def.villager && Math.hypot(e.x - v.x, e.z - v.z) < 40) > 0) continue;
        const profs = Object.keys(PROFS);
        for (let i = 0; i < 4; i++) {
          const H = v.houses[i % v.houses.length], hx = H.x + DX[H.f] * 3.5, hz = H.z + DZ[H.f] * 3.5;
          const e = this.ents.add(new Mob(profs[i % 4], hx + 0.5, w.surfaceY(Math.floor(hx), Math.floor(hz)), hz + 0.5)); e.home = [v.x, v.z];
        }
        const gm = this.ents.add(new Mob('iron_golem', v.x + 3.5, w.surfaceY(v.x + 3, v.z + 3), v.z + 3.5)); gm.home = [v.x, v.z];
      }
    }
  };
  G.updateGadget = function () {
    const el = this._gadEl || (this._gadEl = document.getElementById('gadget')); if (!el) return;
    const p = this.player, w = this.world, h = p.held, n = h && ITEMS[h.id] ? ITEMS[h.id].name : '';
    let html = '';
    if (n === 'compass') {
      let ang;
      if (w.dim !== 'overworld') ang = (performance.now() / 120) % 360;
      else { const dx = p.spawn[0] - p.x, dz = p.spawn[2] - p.z, f = p.lookDir(); ang = (Math.atan2(dx * -f[2] + dz * f[0], dx * f[0] + dz * f[2]) * 180 / Math.PI); ang = ((-ang) % 360 + 360) % 360; const dist = Math.round(Math.hypot(dx, dz)); html = `<span class="gd-arrow" style="transform:rotate(${ang.toFixed(0)}deg)">⬆</span><small>집까지 ${dist}칸</small>`; }
      if (!html) html = `<span class="gd-arrow" style="transform:rotate(${ang.toFixed(0)}deg)">⬆</span><small>방향을 잃었어요</small>`;
    } else if (n === 'clock') {
      if (w.dim !== 'overworld') html = `<span class="gd-arrow">❓</span><small>시계가 빙글빙글…</small>`;
      else { const hr = Math.floor((w.time / 1000 + 6) % 24), mi = Math.floor((w.time % 1000) * 0.06), day = w.dayFactor() > 0.4; html = `<span class="gd-arrow">${day ? '☀️' : '🌙'}</span><small>${hr < 12 ? '오전' : '오후'} ${(hr % 12) || 12}시 ${String(mi).padStart(2, '0')}분</small>`; }
    }
    if (html !== this._gadHtml) { this._gadHtml = html; el.innerHTML = html; el.classList.toggle('show', !!html); }
  };
  const _update = G.update;
  G.update = function (dt) { _update.call(this, dt); if (this.state === 'play') this.vanillaTick(dt); };
  // 효율 마법
  const _bt = G.breakTime;
  G.breakTime = function (id, held) {
    let t = _bt.call(this, id, held);
    const e = enchLv(held, 'eff'), tool = held && ITEMS[held.id] && ITEMS[held.id].tool;
    if (e && tool && tool.kind === BLOCKS[id].tool) t /= 1 + e * 0.45 + e * e * 0.06;
    return Math.max(0.05, t);
  };
  // 날카로움 · 몹 처치 경험치 · 사냥꾼 과제 · 늑대·골렘 화남
  const _dmg = G.damageEntity;
  G.damageEntity = function (e, dmg, kx, kz, src) {
    const p = this.player;
    if (src === 'player') dmg += enchLv(p.held, 'sharp') * 1.25;
    const was = e.dead;
    if (e.type === 'mob' && !e.remote && (src === 'player' || src === 'arrow') && (e.sub === 'iron_golem' || (e.sub === 'wolf' && !e.tamed))) { e.angry = 20; e.angryAt = p; if (e.sub === 'wolf') for (const o of this.ents.list) if (o.sub === 'wolf' && !o.tamed && !o.dead && (o.x - e.x) ** 2 + (o.z - e.z) ** 2 < 200) o.angry = 20; }
    if (e.type === 'mob' && e.tamed && (src === 'player' || src === 'arrow')) dmg = Math.min(dmg, 1);
    _dmg.call(this, e, dmg, kx, kz, src);
    if (!was && e.dead && e.type === 'mob' && !e.remote) {
      const D = e.def || {};
      const xp = e.sub === 'ender_dragon' ? 120 : D.boss ? 0 : D.hostile || D.neutral ? 5 : D.villager || e.sub === 'iron_golem' ? 0 : 1 + (Math.random() * 3 | 0);
      if (src === 'player' || src === 'arrow' || src === 'pet' || e.sub === 'ender_dragon') { this.spawnXP(e.x, e.y + 0.5, e.z, xp); if (D.hostile) this.advGrant('hunter'); }
      else if (src && src.startsWith && src.startsWith('client:') && xp > 0) this.net.sendTo(src.slice(7), { t: 'xp', n: xp });
    }
  };
  // 광석 캐면 경험치
  const ORE_XP = { coal_ore: [0, 2], diamond_ore: [3, 7], emerald_ore: [3, 7], lapis_ore: [2, 5], redstone_ore: [1, 5], nether_quartz_ore: [2, 5], nether_gold_ore: [0, 1], copper_ore: [0, 1], iron_ore: [0, 1], gold_ore: [1, 2] };
  const _pb = G.playerBreak;
  G.playerBreak = function (hit) {
    const w = this.world, id = w.getBlock(hit.x, hit.y, hit.z), p = this.player;
    const held = p.held, tool = held && ITEMS[held.id] && ITEMS[held.id].tool;
    _pb.call(this, hit);
    const d = BLOCKS[id];
    if (!p.creative && d && ORE_XP[d.name] && w.getBlock(hit.x, hit.y, hit.z) !== id && (!d.lvl || (tool && tool.kind === 'pick' && tool.tier >= d.lvl))) {
      const [a, b] = ORE_XP[d.name]; this.spawnXP(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, a + Math.random() * (b - a + 1) | 0);
    }
  };
  // 화로에서 구운 만큼 경험치 (화로를 열 때 받음)
  const _tf = G.tickFurnaces;
  G.tickFurnaces = function () {
    const w = this.world, before = [];
    for (const k of this.furnaces) { const be = w.be.get(k); before.push([be, be && be.items[2] ? be.items[2].n : 0, be && be.items[2] ? be.items[2].id : 0]); }
    _tf.call(this);
    for (const [be, n0] of before) if (be && be.items[2] && be.items[2].n > n0) { const id = be.items[2].id, ores = [I('iron_ingot'), I('gold_ingot'), I('copper_ingot'), I('diamond'), I('emerald')]; be.xp = (be.xp || 0) + (be.items[2].n - n0) * (ores.includes(id) ? 0.7 : 0.25); }
  };
  const _oc = UI.prototype.openContainer;
  UI.prototype.openContainer = function (x, y, z) {
    const g = this.g, be = g.world.be.get(fmtKey(x, y, z));
    if (be && be.t === 'furnace' && be.xp >= 1 && !g.world.remote) { g.spawnXP(x + 0.5, y + 1.2, z + 0.5, Math.floor(be.xp)); be.xp -= Math.floor(be.xp); }
    return _oc.call(this, x, y, z);
  };
  // 죽으면 경험치 일부를 떨어뜨림
  const _death = G.onPlayerDeath;
  G.onPlayerDeath = function (src) {
    const p = this.player;
    if (!p.creative && !this.worldRules.keepInventory && p.xpLv) { this.spawnXP(p.x, p.y + 1, p.z, Math.min(100, p.xpLv * 7)); p.xpLv = 0; p.xpPt = 0; }
    _death.call(this, src);
  };
  // 블록 사용: 마법 부여대
  const _ub = G.useBlock;
  G.useBlock = function (x, y, z, local, pid) {
    if (this.world.getBlock(x, y, z) === BL.enchanting_table) { if (local) this.ui.openEnchant(); return true; }
    return _ub.call(this, x, y, z, local, pid);
  };
  // 받침: 당근·감자는 경작지, 버섯은 아무 단단한 블록
  const _sup = G.supportOk;
  G.supportOk = function (x, y, z, id, meta) {
    if (id === BL.carrots || id === BL.potatoes) { const s = this.world.getBlock(x, y - 1, z); return !this.world.isLoadedAt(x, z) || s === BL.farmland; }
    if (id === BL.brown_mushroom || id === BL.red_mushroom) { const s = this.world.getBlock(x, y - 1, z); return !this.world.isLoadedAt(x, z) || IS_OPAQUE[s] === 1; }
    return _sup.call(this, x, y, z, id, meta);
  };
  // 상호작용: 심기(먹기보다 먼저), 버섯 스튜 그릇, 경험치 병, 낚시, 몹(주민·늑대)
  const _int = G.interact;
  G.interact = function (dt, s) {
    const p = this.player, ev = this.input.ev, held = p.held, hd = held ? ITEMS[held.id] : null;
    if (!p.dead && ev.use && hd && (hd.name === 'carrot' || hd.name === 'potato') && !p.sneaking) {
      const d = p.lookDir(), hit = raycast(this.world, p.x, p.eyeY(), p.z, d[0], d[1], d[2], 5);
      if (hit && hit.id === BL.farmland && hit.face === 1 && !this.world.getBlock(hit.x, hit.y + 1, hit.z)) {
        this.setBlockNet(hit.x, hit.y + 1, hit.z, hd.places, 0); p.consumeHeld(1); this.swing = 1;
        this.sound.play('place', hit.x + 0.5, hit.y + 1, hit.z + 0.5, { mat: 'grass' });
        ev.use = false; this.useCooldown = 0.22; this.eatT = 0;
        return _int.call(this, dt, Object.assign({}, s, { use: false }));
      }
    }
    const stew = hd && hd.name === 'mushroom_stew' && s.use && (p.food < 20 || p.creative) && this.eatT + dt >= 1.6;
    const r = _int.call(this, dt, s);
    if (stew && !p.inv[p.sel] && !p.creative) { p.inv[p.sel] = { id: I('bowl'), n: 1 }; this.ui.refreshHotbar(); }
    return r;
  };
  const _pu = G.playerUse;
  G.playerUse = function (hit, s, fresh) {
    const p = this.player, w = this.world, held = p.held, hd = held ? ITEMS[held.id] : null, ent = this.targetEnt;
    if (fresh) {
      // 몹에게 쓰기
      if (ent && ent.type === 'mob' && !ent.dead) {
        const sub = ent.sub;
        if (PROFS[sub]) { this.ui.openTrade(ent); return; }
        if (sub === 'wolf') {
          if (ent.remote) { this.ui.toast('늑대 길들이기는 방장 세계에서만 돼요'); return; }
          if (!ent.tamed && hd && hd.name === 'bone') {
            p.consumeHeld(1); this.swing = 1;
            if (Math.random() < 0.34) { ent.tamed = true; ent.owner = p.name; ent.sit = false; ent.angry = 0; ent.hp = 20; this.particles.smoke(ent.x, ent.y + 1, ent.z, 8, [1, 0.5, 0.6]); this.sound.play('bark', ent.x, ent.y + 1, ent.z); this.ui.toast('🐺 늑대를 길들였어요! 우클릭하면 앉아요/따라와요'); this.advGrant('tame'); }
            else { this.particles.smoke(ent.x, ent.y + 1, ent.z, 6, [0.5, 0.5, 0.5]); this.ui.toast('🦴 아직 경계해요… 뼈를 한 번 더 줘 보세요', 1500); }
            return;
          }
          if (ent.tamed && hd && hd.food && ent.hp < 20 && /beef|steak|pork|chicken|flesh/.test(hd.name)) { ent.hp = Math.min(20, ent.hp + hd.food * 2); p.consumeHeld(1); this.sound.play('eat', ent.x, ent.y + 1, ent.z); return; }
          if (ent.tamed && ent.owner === p.name) { ent.sit = !ent.sit; ent.vx = ent.vz = 0; this.ui.toast(ent.sit ? '🐺 앉아!' : '🐺 따라와!', 1000); return; }
        }
      }
      if (hd && hd.name === 'fishing_rod') {
        const b = this._bobber;
        if (b && !b.dead) {
          b.dead = true; this.swing = 1;
          if (b.bite > 0) {
            const luck = enchLv(held, 'luck'), [n, c] = fishLoot(luck);
            const e = this.dropItem(b.x, b.y + 0.3, b.z, { id: I(n), n: c }, [(p.x - b.x) * 1.1, 6 + Math.hypot(p.x - b.x, p.z - b.z) * 0.25, (p.z - b.z) * 1.1]);
            if (e) e.pickup = 0;
            this.spawnXP(p.x, p.y + 1, p.z, 1 + (Math.random() * 5 | 0));
            this.sound.play('splash', b.x, b.y, b.z); this.advGrant('fish');
            p.damageHeld(1);
          }
          return;
        }
        if (!w.remote) {
          const d = p.lookDir();
          this._bobber = this.ents.add(new FishingBobber(p.x + d[0] * 0.6, p.eyeY() - 0.1, p.z + d[2] * 0.6, d[0] * 14, d[1] * 14 + 3, d[2] * 14));
          this.sound.play('bow', p.x, p.y + 1, p.z); this.swing = 1;
        } else this.ui.toast('낚시는 혼자 하기나 방장 세계에서 할 수 있어요');
        return;
      }
      if (hd && hd.name === 'experience_bottle') {
        const d = p.lookDir(), tx = p.x + d[0] * 3, ty = p.eyeY() + d[1] * 3, tz = p.z + d[2] * 3;
        this.particles.smoke(tx, ty, tz, 10, [0.6, 1, 0.5]); this.sound.play('glass', tx, ty, tz);
        this.spawnXP(tx, ty, tz, 3 + (Math.random() * 9 | 0)); p.consumeHeld(1); this.swing = 1; return;
      }
      if (hd && hd.name === 'shield') return;
    }
    return _pu.call(this, hit, s, fresh);
  };
  // 몹 생성: 거미(밤), 늑대(숲·눈)
  const _sp = G.spawnMobs;
  G.spawnMobs = function () {
    _sp.call(this);
    const w = this.world; if (w.dim !== 'overworld') return;
    const p = this.player, rnd = Math.random();
    const spot = (minD, maxD) => {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (!w.isLoadedAt(x, z)) return null;
      const y = w.surfaceY(x, z), b = w.getBlock(x, y - 1, z);
      if (!b || !BLOCKS[b].solid || IS_FLUID[b] || w.getBlock(x, y, z) || w.getBlock(x, y + 1, z) || /_leaves$/.test(BLOCKS[b].name)) return null;
      return [x, y, z, b];
    };
    if (!this.settings.peaceful && this.worldRules.mobs && w.dayFactor() < 0.3 && rnd < 0.3 && this.ents.count(e => e.sub === 'spider') < 4) {
      const s = spot(20, 40); if (s) this.ents.add(new Mob('spider', s[0] + 0.5, s[1], s[2] + 0.5));
    } else if (this.worldRules.mobs && w.dayFactor() > 0.6 && rnd > 0.93 && this.ents.count(e => e.sub === 'wolf' && !e.tamed) < 4) {
      const s = spot(24, 44); if (!s) return;
      const bi = w.biomeAt(s[0], s[2]); if (bi !== 4 && bi !== 3 && bi !== 5 && bi !== 8) return;
      if (w.getLight(s[0], s[1], s[2]) >> 4 < 9) return;
      const n = 2 + (Math.random() * 2 | 0);
      for (let i = 0; i < n; i++) this.ents.add(new Mob('wolf', s[0] + 0.5 + (Math.random() - 0.5) * 2, s[1], s[2] + 0.5 + (Math.random() - 0.5) * 2));
    }
  };
  // 명령어
  const _cmd = G.command;
  G.command = function (line) {
    const a = line.trim().slice(1).split(/\s+/), cmd = (a[0] || '').toLowerCase(), say = (t, c) => this.ui.chatLine(t, c || '#aee');
    if (cmd === 'xp' || cmd === '경험치') { const n = parseInt(a[1]) || 10; this.player.addXP(n); say(`경험치 +${n} (레벨 ${this.player.xpLv})`); return; }
    if ((cmd === 'locate' || cmd === '요새') && (a[1] === 'village' || a[1] === '마을')) {
      const p = this.player, w = this.world; let best = null;
      for (let r = 0; r <= 4 && !best; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue; const v = villagePlan(w, Math.floor(p.x / VILLAGE_REGION) + i, Math.floor(p.z / VILLAGE_REGION) + j); if (v && (!best || Math.hypot(v.x - p.x, v.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z))) best = v; }
      say(best ? `🏘 가장 가까운 마을: X ${best.x} · Z ${best.z} (약 ${Math.round(Math.hypot(best.x - p.x, best.z - p.z))}칸)` : '근처에 마을이 없어요', '#bfffc8'); return;
    }
    if (cmd === 'help' || cmd === '도움말') { _cmd.call(this, line); say('원작 요소: /xp 숫자 (경험치), /locate village (마을 위치), /summon spider|wolf|villager|librarian|smith|cleric|iron_golem'); return; }
    return _cmd.call(this, line);
  };
}
// 작물 자라기 · 뼛가루 · 우클릭 수확
{
  const _rt = World.prototype.randomTickBlock;
  World.prototype.randomTickBlock = function (x, y, z, id, meta, light) {
    if (id === BL.carrots || id === BL.potatoes) {
      const L = Math.max(this.getLight(x, y, z) >> 4, this.getLight(x, y, z) & 15);
      if ((meta & 7) < 7 && L >= 9 && Math.random() < 0.3) this.setBlock(x, y, z, id, (meta & 7) + 1);
      return;
    }
    return _rt.call(this, x, y, z, id, meta, light);
  };
  const _bm = Survival.boneMeal;
  Survival.boneMeal = function (g, x, y, z) {
    const w = g.world, id = w.getBlock(x, y, z);
    if (id === BL.carrots || id === BL.potatoes) { const m = w.getMeta(x, y, z) & 7; if (m >= 7) return false; w.setBlock(x, y, z, id, Math.min(7, m + 2 + (Math.random() * 3 | 0))); return true; }
    return _bm.call(this, g, x, y, z);
  };
  const _use = Survival.use;
  Survival.use = function (g, hit, hd, held) {
    const p = g.player;
    if (hit && (hit.id === BL.carrots || hit.id === BL.potatoes) && (hit.meta & 7) === 7 && !p.sneaking && !(hd && hd.name === 'bone_meal')) {
      for (const [iid, n] of g.blockDrops(hit.id, 7, null)) g.dropItem(hit.x + 0.5, hit.y + 0.3, hit.z + 0.5, { id: iid, n: Math.max(1, n - 1) });
      g.setBlockNet(hit.x, hit.y, hit.z, hit.id, 0);
      g.sound.play('break', hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, { mat: 'grass' }); g.swing = 1;
      return true;
    }
    return _use.call(this, g, hit, hd, held);
  };
}
// 소리
{
  const SFX = {
    xp(o, t) { this.tone(o, t, 0.12, 'sine', 1400 + Math.random() * 500, 0, 0.12); },
    xp_lv(o, t) { this.tone(o, t, 0.25, 'triangle', 880, 0, 0.2); this.tone(o, t + 0.07, 0.3, 'triangle', 1318, 0, 0.18); },
    enchant(o, t) { [0, 3, 7, 10, 14].forEach((k, i) => this.tone(o, t + i * 0.05, 0.5, 'sine', 660 * Math.pow(2, k / 12), 0, 0.12)); },
    shield(o, t) { this.noiseHit(o, t, 0.15, 'lowpass', 700, 1, 0.5); this.tone(o, t, 0.12, 'square', 160, 90, 0.12); },
    bark(o, t) { this.tone(o, t, 0.1, 'sawtooth', 520, 300, 0.2); this.tone(o, t + 0.16, 0.1, 'sawtooth', 560, 320, 0.2); },
    villager(o, t) { this.tone(o, t, 0.18, 'sawtooth', 260, 300, 0.12); this.tone(o, t + 0.17, 0.22, 'sawtooth', 300, 230, 0.12); },
    glass(o, t) { this.noiseHit(o, t, 0.25, 'highpass', 3500, 1, 0.3); this.tone(o, t, 0.2, 'sine', 2600, 1800, 0.06); },
  };
  const _play = Sound.prototype.play;
  Sound.prototype.play = function (name, x, y, z, opt) {
    const f = SFX[name];
    if (!f) return _play.call(this, name, x, y, z, opt);
    if (!this.ensure()) return;
    const o = this.out(x, y, z, opt && opt.vol !== undefined ? opt.vol : 1); if (!o) return;
    f.call(this, o, this.ctx.currentTime);
  };
}
