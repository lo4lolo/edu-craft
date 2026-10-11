'use strict';
// =====================================================================
// 에듀 크래프트: 원작 요소 2판 (v1.7, mc2)
//  - 상태 효과(EFFECTS) · 물약 · 양조기 · 투척 물약 · 우유 / API: game.giveEffect(대상, 효과, 초, 레벨) · game.clearEffects(대상)
//  - 날씨 2: 추운 곳은 눈(눈 덮개·얼음), 천둥 번개(/weather thunder, 방장만 계산)
//  - 꾸미기·쓸모 블록: 유리판 · 색유리 16색(meta) · 울타리 문 · 조약돌 담장 · 랜턴 · 모닥불 · 케이크 · 표지판 · 가마솥 · 모루 · 주크박스(음반 3) · 종 · 꽃 화분
//  - 배(물 위 타기) · 도전 과제 11장 · 명령어 /effect
//  - 블록 156~160, 213~223 / 아이템 396~436. 모양은 Mesher.prototype.custom 을 감싸서(작업자에서도 같은 결과: P_ID/P_META만 씀)
//  - 맨 위 코드는 document·window 를 건드리지 않음 (메시 작업자에서도 읽힘)
// =====================================================================

// ---------------- 상태 효과 ----------------
const EFFECTS = {
  speed: { k: '신속', ic: '💨', col: '#7fd6ff', lv2: true },
  slowness: { k: '느림', ic: '🐌', col: '#9aa0c0', bad: true },
  haste: { k: '성급함', ic: '⛏', col: '#ffd35a' },
  jump: { k: '도약', ic: '🐰', col: '#8fef7f', lv2: true },
  regen: { k: '재생', ic: '💗', col: '#ff9ccc', base: 45, lv2: true },
  heal: { k: '치유', ic: '❤️', col: '#ff6b78', instant: true, lv2: true },
  night_vision: { k: '야간 투시', ic: '👁', col: '#7d92ff' },
  fire_res: { k: '화염 저항', ic: '🔥', col: '#ffa04a' },
  water_breath: { k: '수중 호흡', ic: '🫧', col: '#5cc8ec' },
  strength: { k: '힘', ic: '💪', col: '#ef6a5c', lv2: true },
  slow_fall: { k: '느린 낙하', ic: '🪶', col: '#efe9c4' },
  invis: { k: '투명화', ic: '👻', col: '#c9cbe0' },
  resistance: { k: '저항', ic: '🛡', col: '#a9b4d4' },
  levitation: { k: '공중 부양', ic: '🎈', col: '#e6cfff' },
  poison: { k: '독', ic: '🤢', col: '#8cc152', bad: true, base: 20 },
};
const MC2_EFF_ALIAS = {
  swift: 'speed', swiftness: 'speed', slow: 'slowness', jump_boost: 'jump', leap: 'jump', regeneration: 'regen', heal: 'heal', healing: 'heal', instant_health: 'heal', health: 'heal',
  night: 'night_vision', nightvision: 'night_vision', fire: 'fire_res', fire_resistance: 'fire_res', water: 'water_breath', water_breathing: 'water_breath', breath: 'water_breath',
  power: 'strength', slow_falling: 'slow_fall', feather: 'slow_fall', invisibility: 'invis', invisible: 'invis', resist: 'resistance', levitate: 'levitation', float: 'levitation',
  '빠르게': 'speed', '빠름': 'speed', '점프': 'jump', '회복': 'regen', '체력': 'heal', '불': 'fire_res', '물': 'water_breath', '느리게': 'slowness', '투명': 'invis', '야간': 'night_vision',
};
// 물약으로 만들 수 있는 효과 (아이템 398~407 · 투척 물약 d 값의 아래 4비트)
const MC2_POTS = ['speed', 'jump', 'regen', 'heal', 'night_vision', 'fire_res', 'water_breath', 'strength', 'slow_fall', 'invis'];
const MC2_POT_RGB = { speed: [124, 200, 255], jump: [130, 236, 120], regen: [244, 128, 196], heal: [250, 86, 96], night_vision: [80, 98, 230], fire_res: [252, 150, 60], water_breath: [60, 172, 222], strength: [204, 58, 54], slow_fall: [246, 240, 206], invis: [196, 200, 220] };
// 양조 재료 → 효과 (어색한 물약에 넣음)
const MC2_ING = { sugar: 'speed', slime_ball: 'jump', ghast_tear: 'regen', glistering_melon: 'heal', golden_carrot: 'night_vision', magma_cream: 'fire_res', cod: 'water_breath', salmon: 'water_breath', blaze_powder: 'strength', feather: 'slow_fall' };
const MC2_ING_EXTRA = ['nether_wart', 'gunpowder', 'fermented_spider_eye', 'redstone', 'glowstone'];
const MC2_BREW_TIME = 200;     // 틱 (10초)
const MC2_DISCS = [['햇살 왈츠', [255, 205, 70]], ['별빛 자장가', [120, 160, 255]], ['모험 행진곡', [250, 110, 110]]];
const MC2_POT_PLANTS = ['dandelion', 'poppy', 'blue_orchid', 'sapling', 'brown_mushroom', 'red_mushroom', 'cactus', 'dead_bush', 'bamboo'];
const MC2FX = { nv: 0, flash: 0 };   // 렌더러에 넘기는 화면 효과 (야간 투시 · 번개 번쩍)
const MC2_ROMAN = ['', '', ' II', ' III', ' IV', ' V'];

function mc2EffKey(id) {
  if (id === undefined || id === null) return null;
  const raw = String(id).trim(), s = raw.toLowerCase();
  if (EFFECTS[s]) return s;
  if (MC2_EFF_ALIAS[s]) return MC2_EFF_ALIAS[s];
  const ns = raw.replace(/\s/g, '').replace(/(의물약|물약|효과)$/, '');
  for (const k in EFFECTS) if (EFFECTS[k].k.replace(/\s/g, '') === ns) return k;
  return null;
}
function mc2Fmt(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
function mc2PotPlant(m) { const n = MC2_POT_PLANTS[(m | 0) - 1]; return n && BL[n] !== undefined ? BL[n] : 0; }
// 물약 정보: {e 효과, lv, sec, bits(1 길게 · 2 강하게), splash}
function mc2PotInfo(it) {
  const d = it && ITEMS[it.id]; if (!d) return null;
  let e, bits;
  if (d.splash) { e = MC2_POTS[(it.d | 0) & 15]; bits = ((it.d | 0) >> 4) & 3; }
  else if (d.potion) { e = d.potion; bits = (it.d | 0) & 3; }
  else return null;
  if (!e) return null;
  const E = EFFECTS[e];
  let sec = E.base || 180, lv = 1;
  if (bits & 1) sec = Math.round(sec * 8 / 3);
  if (bits & 2) { lv = 2; sec = Math.round(sec / 2); }
  return { e, lv, sec, bits, splash: !!d.splash, E };
}
function mc2PotLabel(info) { return info.E.k + MC2_ROMAN[info.lv] + (info.E.instant ? '' : ' · ' + mc2Fmt(info.sec)) + (info.bits & 1 ? ' (오래가는)' : ''); }
function mc2IsBottle(it) { const d = it && ITEMS[it.id]; return !!(d && (d.drink === 'water' || d.drink === 'none' || d.potion || d.splash)); }
function mc2IsIng(it) { const d = it && ITEMS[it.id]; return !!(d && (MC2_ING[d.name] || MC2_ING_EXTRA.includes(d.name))); }
// 양조: 재료 + 병 → 새 병 (없으면 null)
function mc2BrewResult(ingId, it) {
  if (!it || !ITEMS[ingId]) return null;
  const n = ITEMS[ingId].name, d = ITEMS[it.id]; if (!d) return null;
  const bits = it.d | 0;
  if (d.drink === 'water') return n === 'nether_wart' ? { id: I('awkward_potion'), n: 1 } : null;
  if (d.drink === 'none') { const e = MC2_ING[n]; return e ? { id: I('potion_' + e), n: 1 } : null; }
  if (d.potion) {
    const E = EFFECTS[d.potion];
    if (n === 'gunpowder') return { id: I('splash_potion'), n: 1, d: MC2_POTS.indexOf(d.potion) | (bits << 4) };
    if (n === 'fermented_spider_eye' && d.potion === 'night_vision') { const r = { id: I('potion_invis'), n: 1 }; if (bits & 1) r.d = 1; return r; }
    if (n === 'redstone' && !(bits & 1) && !E.instant) return { id: it.id, n: 1, d: 1 };
    if (n === 'glowstone' && !(bits & 2) && E.lv2) return { id: it.id, n: 1, d: 2 };
  }
  return null;
}

// ---------------- 텍스처 ----------------
function buildMc2Textures() {
  const it = (name, fn) => addTex(name, q => { q.clear(); fn(q); q.outline(); }, true);
  const dk = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // 색유리 16색 (블록은 반투명, 아이콘은 진하게)
  for (let i = 0; i < 16; i++) {
    const c = DYES[i][2];
    addTex('stained_glass_' + i, p => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, c, 110);
      p.border(dk(c, 0.78), 235);
      for (const [x, y] of [[3, 3], [4, 3], [3, 4], [10, 11], [11, 10], [12, 9]]) p.set(x, y, [255, 255, 255], 190);
    });
    addTex('stained_glass_icon_' + i, p => {
      p.clear(); p.rect(2, 2, 12, 12, c, 205); p.rect(1, 1, 14, 1, dk(c, 0.75)); p.rect(1, 14, 14, 1, dk(c, 0.75)); p.rect(1, 1, 1, 14, dk(c, 0.75)); p.rect(14, 1, 1, 14, dk(c, 0.75));
      p.set(4, 4, [255, 255, 255]); p.set(5, 4, [255, 255, 255]); p.set(4, 5, [255, 255, 255]);
    }, true);
  }
  // 랜턴 · 사슬
  addTex('lantern', p => { p.fill([58, 58, 74]); p.rect(2, 2, 12, 12, [255, 206, 102]); p.rect(4, 4, 8, 8, [255, 238, 168]); p.rect(7, 2, 2, 12, [70, 68, 84]); p.set(5, 5, [255, 252, 220]); });
  addTex('lantern_top', p => { p.noise([72, 72, 86], 6); p.border([48, 48, 60]); });
  addTex('chain', p => { p.clear(); for (let y = 0; y < 16; y++) { if (y % 4 < 2) { p.set(7, y, [96, 96, 112]); p.set(8, y, [96, 96, 112]); } else { p.set(6, y, [80, 80, 96]); p.set(9, y, [80, 80, 96]); } } });
  // 모닥불
  addTex('campfire_log', p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.vary((y % 5 === 0) ? [92, 66, 42] : [124, 90, 56], 8)); for (let k = 0; k < 5; k++) p.rect(p.r() * 14 | 0, p.r() * 16 | 0, 2, 1, [70, 50, 32]); });
  addTex('campfire_fire', p => {
    p.clear();
    for (let x = 1; x < 15; x++) {
      const h = 6 + ((Math.sin(x * 1.7) + 1) * 3.5 | 0) + (p.r() * 2 | 0);
      for (let y = 15; y > 15 - h; y--) { const t = (15 - y) / h; p.set(x, y, t < 0.4 ? [255, 236, 120] : t < 0.75 ? [255, 168, 60] : [250, 96, 50]); }
    }
  });
  addTex('campfire_ember', p => { p.noise([220, 90, 40], 30); p.blobs(5, [255, 200, 80], 10, 0.6, 1.4); });
  // 케이크
  addTex('cake_top', p => {
    p.noise([252, 244, 240], 4);
    const SP = [[255, 120, 140], [120, 200, 255], [255, 220, 90], [140, 230, 140]];
    for (let k = 0; k < 12; k++) p.set(1 + p.r() * 14 | 0, 1 + p.r() * 14 | 0, SP[k % 4]);
    p.rect(7, 7, 2, 2, [230, 50, 70]); p.set(7, 7, [255, 140, 150]);
  });
  addTex('cake_side', p => { p.fill([252, 244, 240]); for (let y = 10; y < 16; y++) p.rect(0, y, 16, 1, p.vary([226, 168, 110], 6)); p.rect(0, 12, 16, 1, [236, 96, 120]); for (let x = 0; x < 16; x += 3) p.set(x, 10, [252, 244, 240]); });
  addTex('cake_inner', p => { p.fill([252, 244, 240]); for (let y = 10; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.vary([232, 182, 124], 10)); p.rect(0, 12, 16, 1, [236, 96, 120]); });
  addTex('cake_bottom', p => p.noise([226, 168, 110], 6));
  // 표지판
  addTex('sign_board', p => { p.noise([222, 186, 128], 6); for (let y = 3; y < 16; y += 4) p.rect(0, y, 16, 1, [196, 158, 100]); p.border([160, 120, 70]); });
  addTex('sign_post', p => { p.noise([150, 108, 64], 8); });
  // 가마솥 · 모루 · 주크박스 · 종 · 화분 · 양조기
  addTex('cauldron_side', p => { p.noise([76, 78, 90], 7); p.rect(0, 0, 16, 2, [104, 106, 120]); p.rect(0, 15, 16, 1, [54, 56, 66]); });
  addTex('cauldron_top', p => { p.noise([104, 106, 120], 5); });
  addTex('cauldron_inner', p => { p.noise([52, 54, 64], 6); });
  addTex('anvil', p => { p.noise([86, 88, 100], 7); p.border([62, 64, 74]); });
  addTex('anvil_top', p => { p.noise([96, 98, 112], 6); p.rect(2, 3, 12, 10, [118, 120, 136]); p.border([62, 64, 74]); });
  addTex('jukebox_side', p => { p.noise([150, 98, 70], 8); p.border([104, 66, 44]); p.rect(2, 2, 12, 1, [176, 122, 88]); });
  addTex('jukebox_top', p => { p.noise([150, 98, 70], 8); p.border([104, 66, 44]); p.disc(8, 8, 5, [60, 46, 40]); p.disc(8, 8, 1.6, [200, 160, 120]); });
  addTex('bell_gold', p => { p.noise([252, 206, 78], 8); p.rect(0, 2, 16, 1, [255, 236, 150]); p.rect(0, 13, 16, 1, [214, 160, 50]); });
  addTex('flower_pot', p => { p.noise([200, 112, 82], 6); p.rect(0, 0, 16, 2, [222, 136, 104]); });
  addTex('brewing_base', p => { p.noise([128, 128, 138], 7); p.border([96, 96, 106]); });
  addTex('brewing_rod', p => { p.noise([246, 190, 70], 14); });
  addTex('brew_bottle', p => { p.fill([210, 232, 246]); p.rect(2, 6, 12, 10, [236, 128, 206]); p.rect(3, 7, 2, 4, [255, 200, 240]); });
  // 네더 사마귀 (4단계)
  for (let s = 0; s < 4; s++) addTex('nether_wart_' + s, p => {
    p.clear();
    for (const x of [3, 7, 11]) {
      const h = 3 + s * 2 + (x === 7 ? 1 : 0);
      for (let y = 15; y > 15 - h; y--) p.set(x, y, [150, 30, 40]);
      const r = 0.8 + s * 0.55; p.disc(x + 0.5, 15.5 - h, r, [196, 44, 56]); if (s >= 2) p.set(x, 15 - h, [240, 110, 110]);
    }
  });
  // 블록 아이콘
  it('icon_glass_pane', p => { p.rect(2, 1, 12, 14, [190, 226, 246]); p.rect(2, 1, 12, 1, [240, 250, 255]); p.rect(7, 1, 2, 14, [240, 250, 255]); p.rect(2, 7, 12, 2, [240, 250, 255]); p.set(4, 3, [255, 255, 255]); });
  it('icon_fence_gate', p => { const c = [196, 150, 96], d = [150, 108, 64]; p.rect(1, 3, 2, 11, d); p.rect(13, 3, 2, 11, d); p.rect(3, 5, 10, 2, c); p.rect(3, 10, 10, 2, c); p.rect(7, 7, 2, 3, c); });
  it('icon_wall', p => { p.rect(1, 4, 5, 10, [140, 140, 146]); p.rect(10, 4, 5, 10, [140, 140, 146]); p.rect(6, 6, 4, 7, [120, 120, 126]); p.set(2, 6, [170, 170, 176]); p.set(12, 9, [100, 100, 106]); });
  it('icon_lantern', p => { p.rect(5, 6, 6, 8, [58, 58, 74]); p.rect(6, 7, 4, 6, [255, 214, 110]); p.rect(6, 4, 4, 2, [72, 72, 86]); p.rect(7, 2, 2, 2, [96, 96, 112]); p.set(7, 9, [255, 250, 210]); });
  it('icon_campfire', p => { p.rect(1, 12, 14, 3, [124, 90, 56]); p.rect(3, 10, 10, 2, [100, 72, 46]); p.rect(5, 4, 6, 6, [255, 168, 60]); p.rect(6, 2, 4, 3, [255, 220, 110]); p.rect(7, 6, 2, 3, [255, 245, 190]); });
  it('icon_cake', p => { p.rect(2, 7, 12, 7, [232, 182, 124]); p.rect(2, 6, 12, 3, [252, 244, 240]); p.rect(2, 11, 12, 1, [236, 96, 120]); p.rect(7, 4, 2, 2, [230, 50, 70]); p.set(4, 7, [120, 200, 255]); p.set(11, 7, [255, 220, 90]); });
  it('icon_sign', p => { p.rect(1, 3, 14, 8, [222, 186, 128]); p.rect(2, 5, 12, 1, [150, 110, 70]); p.rect(2, 7, 9, 1, [150, 110, 70]); p.rect(7, 11, 2, 4, [150, 108, 64]); });
  it('icon_cauldron', p => { p.rect(2, 4, 12, 9, [76, 78, 90]); p.rect(1, 3, 14, 2, [104, 106, 120]); p.rect(4, 5, 8, 2, [70, 150, 230]); p.rect(2, 13, 3, 2, [60, 62, 72]); p.rect(11, 13, 3, 2, [60, 62, 72]); });
  it('icon_anvil', p => { p.rect(1, 3, 14, 4, [104, 106, 120]); p.rect(5, 7, 6, 4, [86, 88, 100]); p.rect(3, 11, 10, 3, [96, 98, 112]); p.rect(2, 3, 12, 1, [140, 142, 156]); });
  it('icon_bell', p => { p.rect(1, 1, 14, 2, [120, 84, 54]); p.rect(7, 3, 2, 2, [120, 120, 130]); p.rect(5, 5, 6, 6, [252, 206, 78]); p.rect(4, 10, 8, 3, [252, 206, 78]); p.rect(3, 12, 10, 1, [214, 160, 50]); p.set(6, 6, [255, 240, 170]); });
  it('icon_flower_pot', p => { p.rect(4, 9, 8, 6, [200, 112, 82]); p.rect(3, 8, 10, 2, [222, 136, 104]); p.rect(7, 4, 2, 4, [80, 170, 70]); p.disc(8, 4, 2.2, [255, 120, 150]); p.set(8, 4, [255, 230, 90]); });
  it('icon_brewing_stand', p => { p.rect(7, 2, 2, 10, [246, 190, 70]); p.rect(2, 12, 12, 2, [128, 128, 138]); p.rect(2, 8, 3, 4, [236, 128, 206]); p.rect(11, 8, 3, 4, [120, 200, 255]); p.rect(3, 6, 1, 2, [210, 232, 246]); p.rect(12, 6, 1, 2, [210, 232, 246]); p.rect(4, 7, 3, 1, [150, 150, 160]); p.rect(9, 7, 3, 1, [150, 150, 160]); });
  it('icon_snow_layer', p => { p.rect(1, 11, 14, 3, [244, 250, 255]); p.rect(1, 14, 14, 1, [200, 214, 232]); p.set(4, 11, [255, 255, 255]); });
  // 물약 · 재료
  const bottle = (p, liq, splash) => {
    if (splash) { p.rect(7, 2, 2, 2, [150, 110, 80]); p.rect(6, 4, 4, 2, [214, 234, 246]); p.disc(8, 10.5, 5, [214, 234, 246]); if (liq) p.disc(8, 11, 4, liq); p.rect(3, 6, 2, 1, [214, 234, 246]); p.rect(2, 7, 1, 3, [214, 234, 246]); }
    else { p.rect(7, 1, 2, 2, [150, 110, 80]); p.rect(7, 3, 2, 3, [214, 234, 246]); p.disc(8, 10.5, 4.6, [214, 234, 246]); if (liq) p.disc(8, 11, 3.6, liq); }
    p.set(6, 8, [255, 255, 255]); p.set(6, 9, [255, 255, 255]);
  };
  it('water_bottle', p => bottle(p, [70, 140, 240]));
  it('awkward_potion', p => bottle(p, [96, 120, 230]));
  for (const e of MC2_POTS) it('potion_' + e, p => bottle(p, MC2_POT_RGB[e]));
  it('splash_potion', p => bottle(p, [210, 120, 230], true));
  it('nether_wart', p => { for (const [x, y] of [[5, 7], [10, 6], [7, 11], [11, 11], [4, 12]]) p.disc(x, y, 2.4, [190, 40, 52]); p.set(5, 6, [240, 120, 120]); p.set(10, 5, [240, 120, 120]); });
  it('magma_cream', p => { p.disc(8, 9, 5, [236, 120, 40], 10); for (const [x, y] of [[6, 7], [10, 9], [7, 11], [9, 6]]) p.set(x, y, [255, 230, 90]); });
  it('glistering_melon', p => { for (let y = 4; y < 14; y++) for (let x = 3; x < 14; x++) { const d = Math.hypot(x - 8, y - 4); if (d < 9 && y > 4) p.set(x, y, d > 7.6 ? [250, 200, 60] : d > 6.8 ? [255, 240, 160] : [240, 90, 90]); } p.set(6, 8, [255, 250, 200]); p.set(9, 10, [255, 250, 200]); p.set(11, 7, [255, 250, 200]); });
  it('fermented_spider_eye', p => { p.disc(8, 10, 4, [160, 40, 70], 10); p.disc(7, 9, 1.5, [230, 100, 120]); p.disc(9, 4, 2.6, [160, 115, 85]); p.rect(9, 5, 1, 3, [220, 210, 190]); });
  it('milk_bucket', p => { for (let y = 5; y < 14; y++) { const w = 5 - (y - 5) * 0.25; p.rect(Math.round(8 - w), y, Math.round(w * 2), 1, [190, 194, 204]); } p.rect(3, 5, 10, 2, [252, 252, 255]); p.rect(3, 4, 10, 1, [150, 154, 164]); });
  MC2_DISCS.forEach(([, col], i) => it('music_disc_' + (i + 1), p => { p.disc(8, 8, 7, [40, 40, 52]); p.disc(8, 8, 5.4, [58, 58, 72]); p.disc(8, 8, 2.6, col); p.set(8, 8, [20, 20, 26]); p.set(4, 5, [120, 120, 140]); p.set(11, 11, [120, 120, 140]); }));
  it('boat', p => { p.rect(1, 8, 14, 1, [196, 146, 90]); p.rect(2, 9, 12, 3, [160, 112, 64]); p.rect(4, 12, 8, 1, [130, 90, 52]); p.rect(5, 7, 1, 1, [120, 84, 50]); p.rect(10, 7, 1, 1, [120, 84, 50]); p.line(11, 2, 13, 11, [150, 108, 64], 1); });
}

// ---------------- 블록 (156~160, 213~223) ----------------
function defineMc2Blocks() {
  const b = defBlock;
  b(156, 'glass_pane', '유리판', { tex: faces('glass'), shape: 'pane', opaque: false, layer: 1, hard: 0.3, sound: 'glass', drop: () => [], conductor: false, icon: 'icon_glass_pane', desc: '얇은 유리 창문이에요. 옆 블록과 저절로 이어져요.' });
  b(157, 'stained_glass', '색유리', { shape: 'cube', opaque: false, layer: 2, hard: 0.3, sound: 'glass', drop: () => [], conductor: false, item: false, cat: 'color', texf: m => T('stained_glass_' + (m & 15)) });
  // 울타리 문 meta: facing(2~5) | 8 열림 | 32 전기
  b(158, 'oak_fence_gate', '울타리 문', { tex: faces('oak_planks'), shape: 'gate', opaque: false, hard: 2, tool: 'axe', sound: 'wood', conductor: false, facingH: true, use: 'gate', rs: 'door', icon: 'icon_fence_gate', desc: '우클릭으로 열고 닫는 울타리 문. 전기로도 열려요.' });
  b(159, 'cobblestone_wall', '조약돌 담장', { tex: faces('cobblestone'), shape: 'wall', opaque: false, hard: 2, tool: 'pick', lvl: 1, conductor: false, icon: 'icon_wall', desc: '옆 담장·블록과 이어지는 낮은 벽. 몬스터가 못 넘어요.' });
  // 랜턴 meta: 1 매달림
  b(160, 'lantern', '랜턴', { tex: faces('lantern'), shape: 'lantern', opaque: false, layer: 1, hard: 1, tool: 'pick', sound: 'metal', emit: 15, push: 'break', conductor: false, icon: 'icon_lantern', cat: 'tools', desc: '밝게 빛나는 등불. 블록 아래쪽에 놓으면 매달려요.' });
  // 모닥불 meta: facing | 8 꺼짐
  b(213, 'campfire', '모닥불', { tex: faces('campfire_log'), shape: 'campfire', opaque: false, layer: 1, hard: 2, tool: 'axe', sound: 'wood', facingH: true, use: 'campfire', emit: m => (m & 8) ? 0 : 15, conductor: false, icon: 'icon_campfire', cat: 'tools', desc: '날고기를 올려 두면 천천히 익어요. 연기가 모락모락! 삽으로 끄고 부싯돌로 켜요.' });
  // 케이크 meta: 먹은 조각 0~6
  b(214, 'cake', '케이크', { shape: 'cake', opaque: false, hard: 0.5, sound: 'wool', stack: 1, use: 'cake', drop: () => [], conductor: false, icon: 'icon_cake', cat: 'food', push: 'break',
    texf: (m, f) => f === 1 ? T('cake_top') : f === 0 ? T('cake_bottom') : (f === 4 && (m & 7)) ? T('cake_inner') : T('cake_side'), desc: '놓고 우클릭하면 한 조각씩 먹어요 (7조각).' });
  // 표지판 meta: facing(글씨 쪽) | 8 벽에 붙음
  b(215, 'oak_sign', '표지판', { tex: faces('sign_board'), shape: 'sign', solid: false, opaque: false, layer: 1, hard: 1, tool: 'axe', sound: 'wood', use: 'sign', stack: 16, push: 'break', conductor: false, icon: 'icon_sign', cat: 'tools', desc: '글을 써 두면 가까이 온 친구에게 보여요. 우클릭으로 고쳐 써요.' });
  // 가마솥 meta: 물 0~3
  b(216, 'cauldron', '가마솥', { tex: faces('cauldron_side'), shape: 'cauldron', opaque: false, hard: 2, tool: 'pick', lvl: 1, sound: 'metal', use: 'cauldron', conductor: false, icon: 'icon_cauldron', cat: 'tools', desc: '물을 담아 둬요. 빈 병으로 물병을 떠요. 비가 오면 조금씩 차요.' });
  b(217, 'anvil', '모루', { tex: faces('anvil'), shape: 'anvil', opaque: false, hard: 5, tool: 'pick', lvl: 1, sound: 'metal', use: 'anvil', facingH: true, conductor: false, icon: 'icon_anvil', cat: 'tools', push: 'block', desc: '닳은 도구·갑옷을 같은 도구나 재료로 고쳐요. 마법도 합쳐져요.' });
  b(218, 'jukebox', '주크박스', { tex: faces({ top: 'jukebox_top', side: 'jukebox_side' }), hard: 2, tool: 'axe', sound: 'wood', use: 'jukebox', cat: 'tools', desc: '음반을 넣으면 음악이 나와요. 다시 우클릭하면 음반이 나와요.' });
  b(219, 'bell', '종', { tex: faces('bell_gold'), shape: 'bell', opaque: false, hard: 2, tool: 'pick', sound: 'metal', use: 'bell', facingH: true, conductor: false, icon: 'icon_bell', cat: 'tools', desc: '우클릭하면 댕~ 울려요. 마을 주민들이 모여요.' });
  // 꽃 화분 meta: 심은 식물 (0 빈 화분)
  b(220, 'flower_pot', '꽃 화분', { tex: faces('flower_pot'), shape: 'pot', opaque: false, hard: 0, sound: 'stone', use: 'pot', push: 'break', conductor: false, icon: 'icon_flower_pot', desc: '꽃·묘목·버섯·선인장을 들고 우클릭해 심어요.',
    drop: (m) => { const r = [[220, 1]], pid = mc2PotPlant(m); if (pid) r.push([pid, 1]); return r; } });
  // 양조기 meta: 병 있는 칸 비트(1·2·4)
  b(221, 'brewing_stand', '양조기', { tex: faces('brewing_base'), shape: 'brewing', opaque: false, hard: 0.5, tool: 'pick', sound: 'metal', use: 'brewing', container: true, emit: 1, conductor: false, icon: 'icon_brewing_stand', cat: 'tools', push: 'block', desc: '물병·재료·블레이즈 가루로 물약을 만들어요.' });
  // 네더 사마귀 meta: 자람 0~3
  b(222, 'nether_wart', '네더 사마귀', { shape: 'crop', solid: false, opaque: false, layer: 1, hard: 0, sound: 'grass', push: 'break', item: false, wave: 0, cat: 'nature',
    texf: (m) => T('nether_wart_' + Math.min(3, m & 3)), drop: (m, rnd) => (m & 3) >= 3 ? [[I('nether_wart'), 2 + (rnd() * 3 | 0)]] : [[I('nether_wart'), 1]] });
  b(223, 'snow_layer', '눈 덮개', { tex: faces('snow'), shape: 'snowlayer', solid: false, opaque: false, hard: 0.1, tool: 'shovel', sound: 'wool', replace: true, push: 'break', conductor: false, icon: 'icon_snow_layer', cat: 'nature', drop: () => [[I('snowball'), 1]], desc: '추운 곳에 눈이 오면 땅에 쌓여요.' });
}
function defineMc2Items() {
  const it = defItem;
  it(396, 'water_bottle', '물병', { stack: 1, cat: 'food', drink: 'water', desc: '빈 병으로 물이나 가마솥을 우클릭해 떠요. 양조기에 넣어 물약을 만들어요.' });
  it(397, 'awkward_potion', '어색한 물약', { stack: 1, cat: 'food', drink: 'none', desc: '물병 + 네더 사마귀. 여기에 재료를 하나 더 넣으면 진짜 물약이 돼요!' });
  const D = { speed: '더 빨리 달려요', jump: '더 높이 뛰어요', regen: '체력이 조금씩 차요', heal: '체력이 바로 차요', night_vision: '어두운 곳도 환하게 보여요', fire_res: '불·용암에 다치지 않아요', water_breath: '물속에서 숨이 줄지 않아요', strength: '공격이 세져요', slow_fall: '깃털처럼 천천히 떨어져요', invis: '몬스터가 나를 잘 못 봐요' };
  MC2_POTS.forEach((e, i) => it(398 + i, 'potion_' + e, EFFECTS[e].k + '의 물약', { stack: 1, cat: 'food', drink: 'potion', potion: e, desc: '마시면 ' + D[e] + '. (레드스톤: 오래가게 · 발광석: 더 세게 · 화약: 던지는 물약)' }));
  it(408, 'splash_potion', '투척 물약', { stack: 1, cat: 'food', splash: true, desc: '오른쪽 클릭으로 던지면 깨지면서 둘레 4칸에 효과가 퍼져요.' });
  it(409, 'nether_wart', '네더 사마귀', { places: BL.nether_wart, cat: 'nature', desc: '지옥 요새의 영혼 모래 밭에서 자라요. 영혼 모래에 심을 수 있어요. 물약의 시작!' });
  it(410, 'magma_cream', '마그마 크림', { desc: '슬라임 볼 + 블레이즈 가루. 화염 저항 물약 재료.' });
  it(411, 'glistering_melon', '반짝이는 수박', { desc: '수박 조각을 금 조각으로 감싸요. 치유 물약 재료.' });
  it(412, 'fermented_spider_eye', '발효된 거미 눈', { desc: '야간 투시 물약에 넣으면 투명화 물약이 돼요.' });
  it(413, 'milk_bucket', '우유 양동이', { stack: 1, cat: 'food', drink: 'milk', desc: '마시면 모든 효과가 사라져요. 빈 양동이로 소를 우클릭!' });
  MC2_DISCS.forEach(([k], i) => it(414 + i, 'music_disc_' + (i + 1), '음반 - ' + k, { stack: 1, cat: 'tools', disc: i, desc: '주크박스에 넣으면 「' + k + '」가 흘러나와요.' }));
  it(417, 'boat', '배', { stack: 1, cat: 'tools', desc: '물 위에 놓고 우클릭으로 타요. W 앞으로 · 마우스로 방향 · Shift 내리기 · 때리면 다시 아이템이 돼요.' });
  DYES.forEach(([n, k], i) => it(421 + i, 'stained_glass_' + n, k + ' 색유리', { places: BL.stained_glass, placeMeta: i, tex: 'stained_glass_icon_' + i, cat: 'color', desc: '유리 8개 둘레에 양털 1개를 넣어 색을 입혀요.' }));
  // 손에 든 모양을 3D 로
  if (typeof ITEM_MESH3D !== 'undefined') for (const s of ['pane', 'gate', 'wall', 'lantern', 'campfire', 'cake', 'sign', 'cauldron', 'anvil', 'bell', 'pot', 'brewing']) ITEM_MESH3D.add(s);
}
function defineMc2Recipes() {
  R(['GGG', 'GGG'], { G: 'glass' }, 'glass_pane', 16);
  DYES.forEach(([n]) => R(['GGG', 'GWG', 'GGG'], { G: 'glass', W: 'wool_' + n }, 'stained_glass_' + n, 8));
  R(['SPS', 'SPS'], { S: 'stick', P: '#planks' }, 'oak_fence_gate');
  R(['CCC', 'CCC'], { C: 'cobblestone' }, 'cobblestone_wall', 6);
  R([' I ', 'ITI', ' I '], { I: 'iron_ingot', T: 'torch' }, 'lantern', 2);
  R([' S ', 'SCS', 'LLL'], { S: 'stick', C: '#coal', L: '#log' }, 'campfire');
  R(['MMM', 'SES', 'WWW'], { M: 'milk_bucket', S: 'sugar', E: 'egg', W: 'wheat' }, 'cake');
  R(['PPP', 'PPP', ' S '], { P: '#planks', S: 'stick' }, 'oak_sign', 3);
  R(['I I', 'I I', 'III'], { I: 'iron_ingot' }, 'cauldron');
  R(['BBB', ' I ', 'III'], { B: 'iron_block', I: 'iron_ingot' }, 'anvil');
  R(['PPP', 'PDP', 'PPP'], { P: '#planks', D: 'diamond' }, 'jukebox');
  R(['SSS', ' G ', 'GGG'], { S: 'stick', G: 'gold_ingot' }, 'bell');
  R(['B B', ' B '], { B: 'brick' }, 'flower_pot');
  R([' B ', 'CCC'], { B: 'blaze_rod', C: 'cobblestone' }, 'brewing_stand');
  R(['P P', 'PPP'], { P: '#planks' }, 'boat');
  R(['SSS'], { S: 'snow_block' }, 'snow_layer', 6);
  S(['slime_ball', 'blaze_powder'], 'magma_cream');
  R(['NNN', 'NMN', 'NNN'], { N: 'gold_nugget', M: 'melon_slice' }, 'glistering_melon');
  S(['spider_eye', 'sugar', 'brown_mushroom'], 'fermented_spider_eye');
  S(['note_block', 'wool_yellow', 'coal'], 'music_disc_1'); S(['note_block', 'wool_light_blue', 'coal'], 'music_disc_2'); S(['note_block', 'wool_red', 'coal'], 'music_disc_3');
}
function defineMc2Smelting() {
  FUEL[I('boat')] = 400; FUEL[I('oak_sign')] = 200; FUEL[I('oak_fence_gate')] = 300; FUEL[I('jukebox')] = 300;
}
// 보물 · 거래에 더하기 (보물 상자는 처음 열 때 채워짐 → 지형은 그대로)
if (typeof LOOT !== 'undefined') {
  LOOT.fortress.push(['nether_wart', 3, 7], ['music_disc_3', 0, 1]);
  LOOT.stronghold.push(['music_disc_2', 0, 1], ['glistering_melon', 0, 2]);
  if (LOOT.village) LOOT.village.push(['music_disc_1', 0, 1], ['milk_bucket', 0, 1]);
}
if (typeof TRADES !== 'undefined' && TRADES.cleric) TRADES.cleric.push([['emerald', 1], ['nether_wart', 4]], [['emerald', 2], ['glass_bottle', 6]], [['emerald', 3], ['blaze_powder', 2]]);

// ---------------- 이어짐 규칙 (메시·충돌 공용, 블록 번호만 봄) ----------------
function mc2Conn(kind, nid) {
  if (!nid) return false;
  const d = BLOCKS[nid]; if (!d) return false;
  if (IS_OPAQUE[nid]) return true;
  const s = d.shape;
  if (kind === 'pane') return s === 'pane' || nid === BL.glass || nid === BL.stained_glass || s === 'wall';
  if (kind === 'wall') return s === 'wall' || s === 'gate' || s === 'pane';
  return s === 'fence' || s === 'gate';
}
const MC2_P = 1 / 16;
const mc2B = (a) => a.map(v => v * MC2_P);
// 수평 회전한 상자 (기본 모델은 북쪽을 봄)
function mc2RotBox(b, f) {
  if (f === 2 || f < 2) return b;
  const xf = xfH(f), a = xf([b[0], b[1], b[2]]), c = xf([b[3], b[4], b[5]]);
  return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])];
}
function mc2Arms(kind, get) {
  return { n: mc2Conn(kind, get(0, -1)), s: mc2Conn(kind, get(0, 1)), w: mc2Conn(kind, get(-1, 0)), e: mc2Conn(kind, get(1, 0)) };
}
// 충돌·선택 상자 (블록 단위 0~1)
const MC2_BOX = {
  pane(id, m, sel, world, x, y, z) {
    const c = world ? mc2Arms('pane', (dx, dz) => world.getBlock(x + dx, y, z + dz)) : { n: true, s: true, w: false, e: false };
    if (!c.n && !c.s && !c.w && !c.e) c.n = c.s = c.w = c.e = true;
    const r = [mc2B([7, 0, 7, 9, 16, 9])];
    if (c.n) r.push(mc2B([7, 0, 0, 9, 16, 7])); if (c.s) r.push(mc2B([7, 0, 9, 9, 16, 16]));
    if (c.w) r.push(mc2B([0, 0, 7, 7, 16, 9])); if (c.e) r.push(mc2B([9, 0, 7, 16, 16, 9]));
    return r;
  },
  wall(id, m, sel, world, x, y, z) {
    const c = world ? mc2Arms('wall', (dx, dz) => world.getBlock(x + dx, y, z + dz)) : { n: false, s: false, w: false, e: false };
    const H = sel ? 16 : 24, h = sel ? 14 : 24;
    const r = [mc2B([4, 0, 4, 12, H, 12])];
    if (c.n) r.push(mc2B([5, 0, 0, 11, h, 4])); if (c.s) r.push(mc2B([5, 0, 12, 11, h, 16]));
    if (c.w) r.push(mc2B([0, 0, 5, 4, h, 11])); if (c.e) r.push(mc2B([12, 0, 5, 16, h, 11]));
    return r;
  },
  gate(id, m, sel) {
    if (!sel && (m & 8)) return [];
    const f = m & 7, H = sel ? 16 : 24;
    return [mc2B(f === 4 || f === 5 ? [6, 0, 0, 10, H, 16] : [0, 0, 6, 16, H, 10])];
  },
  lantern(id, m) { return [mc2B(m & 1 ? [5, 1, 5, 11, 16, 11] : [5, 0, 5, 11, 10, 11])]; },
  campfire() { return [mc2B([0, 0, 0, 16, 7, 16])]; },
  cake(id, m) { return [mc2B([1 + (m & 7) * 2, 0, 1, 15, 8, 15])]; },
  sign(id, m) { const f = (m & 7) < 2 ? 2 : m & 7; return [mc2RotBox(mc2B(m & 8 ? [1, 4, 13, 15, 12, 16] : [3, 0, 6, 13, 16, 10]), f)]; },
  cauldron() { return FULL_BOX; },
  anvil(id, m) { return [mc2RotBox(mc2B([0, 0, 2, 16, 16, 14]), m & 7)]; },
  bell(id, m) { return [mc2RotBox(mc2B([1, 0, 4, 15, 15, 12]), m & 7)]; },
  pot() { return [mc2B([5, 0, 5, 11, 6, 11])]; },
  brewing(id, m, sel) { return sel ? [mc2B([2, 0, 2, 14, 14, 14])] : [mc2B([2, 0, 2, 14, 2, 14]), mc2B([7, 2, 7, 9, 14, 9])]; },
  snowlayer() { return [mc2B([0, 0, 0, 16, 2, 16])]; },
};
if (typeof blockBoxes === 'function') {
  const _bb = blockBoxes;
  blockBoxes = function (id, meta, forSelect, world, x, y, z) {
    const d = BLOCKS[id], f = d && MC2_BOX[d.shape];
    if (f) { if (!forSelect && !d.solid) return null; return f(id, meta | 0, !!forSelect, world, x, y, z); }
    return _bb(id, meta, forSelect, world, x, y, z);
  };
}
if (typeof fenceConnects === 'function') {
  const _fc = fenceConnects;
  fenceConnects = function (world, x, y, z) {
    if (_fc(world, x, y, z)) return true;
    if (!world) return false;
    const d = BLOCKS[world.getBlock(x, y, z)];
    return !!(d && d.shape === 'gate');
  };
}

// ---------------- 메시 (모양) ----------------
// 작은 상자에 텍스처 한 장이 꽉 차게 (uvOver)
function mc2Fit(bx) {
  const o = {};
  for (let f = 0; f < 6; f++) {
    let u0 = 9, u1 = -9, v0 = 9, v1 = -9;
    for (const c of FACES[f].pts) {
      const uv = faceUV(f, c[0] ? bx[3] : bx[0], c[1] ? bx[4] : bx[1], c[2] ? bx[5] : bx[2]);
      u0 = Math.min(u0, uv[0]); u1 = Math.max(u1, uv[0]); v0 = Math.min(v0, uv[1]); v1 = Math.max(v1, uv[1]);
    }
    const ku = 1 / ((u1 - u0) || 1), kv = 1 / ((v1 - v0) || 1);
    o[f] = [-u0 * ku, -v0 * kv, -u0 * ku + ku, -v0 * kv + kv];
  }
  return o;
}
const MC2_MESH = {
  pane(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[d.layer], tex = d.tex;
    const c = mc2Arms('pane', (dx, dz) => P_ID[pi + dx + dz * PX]);
    if (!c.n && !c.s && !c.w && !c.e) c.n = c.s = c.w = c.e = true;
    m.box(buf, x, y, z, pi, mc2B([7, 0, 7, 9, 16, 9]), tex);
    if (c.n) m.box(buf, x, y, z, pi, mc2B([7, 0, 0, 9, 16, 7]), tex, { mask: 0b110111 });
    if (c.s) m.box(buf, x, y, z, pi, mc2B([7, 0, 9, 9, 16, 16]), tex, { mask: 0b111011 });
    if (c.w) m.box(buf, x, y, z, pi, mc2B([0, 0, 7, 7, 16, 9]), tex, { mask: 0b011111 });
    if (c.e) m.box(buf, x, y, z, pi, mc2B([9, 0, 7, 16, 16, 9]), tex, { mask: 0b101111 });
  },
  wall(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[d.layer], tex = d.tex;
    const c = mc2Arms('wall', (dx, dz) => P_ID[pi + dx + dz * PX]);
    const above = BLOCKS[P_ID[pi + PXZ]];
    const sNS = c.n && c.s && !c.w && !c.e, sWE = c.w && c.e && !c.n && !c.s;
    if ((sNS || sWE) && !(above && (above.shape === 'wall' || above.shape === 'lantern' || IS_OPAQUE[P_ID[pi + PXZ]]))) {
      m.box(buf, x, y, z, pi, mc2B(sNS ? [5, 0, 0, 11, 14, 16] : [0, 0, 5, 16, 14, 11]), tex);
      return;
    }
    m.box(buf, x, y, z, pi, mc2B([4, 0, 4, 12, 16, 12]), tex);
    if (c.n) m.box(buf, x, y, z, pi, mc2B([5, 0, 0, 11, 14, 4]), tex);
    if (c.s) m.box(buf, x, y, z, pi, mc2B([5, 0, 12, 11, 14, 16]), tex);
    if (c.w) m.box(buf, x, y, z, pi, mc2B([0, 0, 5, 4, 14, 11]), tex);
    if (c.e) m.box(buf, x, y, z, pi, mc2B([12, 0, 5, 16, 14, 11]), tex);
  },
  gate(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[d.layer], tex = d.tex, xf = xfH(meta & 7) || (p => p);
    const B = (a) => m.box(buf, x, y, z, pi, mc2B(a), tex, { xf });
    B([0, 5, 7, 2, 16, 9]); B([14, 5, 7, 16, 16, 9]);
    if (!(meta & 8)) { B([2, 6, 7, 14, 9, 9]); B([2, 12, 7, 14, 15, 9]); B([6, 9, 7, 10, 12, 9]); }
    else { B([0, 6, 9, 2, 9, 15]); B([0, 12, 9, 2, 15, 15]); B([0, 9, 13, 2, 12, 15]); B([14, 6, 9, 16, 9, 15]); B([14, 12, 9, 16, 15, 15]); B([14, 9, 13, 16, 12, 15]); }
  },
  lantern(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[1], hang = meta & 1, o = hang ? 1 : 0;
    const body = mc2B([5, o, 5, 11, o + 7, 11]);
    m.box(buf, x, y, z, pi, body, T('lantern'), { flags: 32, uvOver: mc2Fit(body), cull: false });
    const cap = mc2B([6, o + 7, 6, 10, o + 9, 10]);
    m.box(buf, x, y, z, pi, cap, T('lantern_top'), { uvOver: mc2Fit(cap), cull: false });
    if (hang) m.box(buf, x, y, z, pi, mc2B([7.5, o + 9, 7.5, 8.5, 16, 8.5]), T('chain'), { mask: 0b111100, cull: false });
    else m.box(buf, x, y, z, pi, mc2B([7, 9, 7.5, 9, 10.5, 8.5]), T('lantern_top'), { cull: false });
  },
  campfire(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[1], xf = xfH(meta & 7) || (p => p), lit = !(meta & 8);
    const logX = (wd, f) => f >= 4 ? T('oak_log_top') : T('campfire_log');
    const logZ = (wd, f) => (f === 2 || f === 3) ? T('oak_log_top') : T('campfire_log');
    for (const a of [[0, 0, 1, 16, 4, 5], [0, 0, 11, 16, 4, 15]]) m.box(buf, x, y, z, pi, mc2B(a), logX, { xf });
    for (const a of [[1, 3, 0, 5, 7, 16], [11, 3, 0, 15, 7, 16]]) m.box(buf, x, y, z, pi, mc2B(a), logZ, { xf });
    if (!lit) return;
    m.box(buf, x, y, z, pi, mc2B([5, 0, 5, 11, 1, 11]), T('campfire_ember'), { flags: 32, mask: 2 });
    const L = P_LIGHT[pi], lay = T('campfire_fire'), uvs = [[0, 1], [1, 1], [1, 0], [0, 0]], a = 0.12, b = 0.88, y0 = 0.05, y1 = 0.95;
    m.quad(buf, x, y, z, [[a, y0, a], [b, y0, b], [b, y1, b], [a, y1, a]], uvs, lay, 32 | 1, L, false);
    m.quad(buf, x, y, z, [[a, y0, b], [b, y0, a], [b, y1, a], [a, y1, b]], uvs, lay, 32 | 1, L, false);
    m.quad(buf, x, y, z, [[b, y0, b], [a, y0, a], [a, y1, a], [b, y1, b]], uvs, lay, 32 | 1, L, false);
    m.quad(buf, x, y, z, [[b, y0, a], [a, y0, b], [a, y1, b], [b, y1, a]], uvs, lay, 32 | 1, L, false);
  },
  cake(m, x, y, z, pi, id, meta, d) {
    m.box(m.bufs[0], x, y, z, pi, mc2B([1 + (meta & 7) * 2, 0, 1, 15, 8, 15]), (wd) => blockTex(d, meta, wd));
  },
  sign(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[1], f = (meta & 7) < 2 ? 2 : meta & 7, xf = xfH(f) || (p => p);
    if (meta & 8) { m.box(buf, x, y, z, pi, mc2B([1, 4, 14, 15, 12, 16]), T('sign_board'), { xf }); return; }
    m.box(buf, x, y, z, pi, mc2B([1, 8, 7, 15, 16, 9]), T('sign_board'), { xf });
    m.box(buf, x, y, z, pi, mc2B([7, 0, 7, 9, 8, 9]), T('sign_post'), { xf });
  },
  cauldron(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[0], side = T('cauldron_side'), top = T('cauldron_top'), inn = T('cauldron_inner');
    const wall = (inF) => (wd, f) => f === inF ? inn : f === 1 ? top : side;
    for (const a of [[0, 0, 0, 4, 3, 4], [12, 0, 0, 16, 3, 4], [0, 0, 12, 4, 3, 16], [12, 0, 12, 16, 3, 16]]) m.box(buf, x, y, z, pi, mc2B(a), side);
    m.box(buf, x, y, z, pi, mc2B([0, 3, 0, 16, 4, 16]), wall(1));
    m.box(buf, x, y, z, pi, mc2B([0, 4, 0, 16, 16, 2]), wall(3));
    m.box(buf, x, y, z, pi, mc2B([0, 4, 14, 16, 16, 16]), wall(2));
    m.box(buf, x, y, z, pi, mc2B([0, 4, 2, 2, 16, 14]), wall(5));
    m.box(buf, x, y, z, pi, mc2B([14, 4, 2, 16, 16, 14]), wall(4));
    const lv = meta & 3;
    if (lv) m.box(m.bufs[2], x, y, z, pi, mc2B([2, 4, 2, 14, 5 + lv * 3.4, 14]), T('water'), { mask: 2 });
  },
  anvil(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[0], xf = xfH(meta & 7) || (p => p);
    const tx = (wd, f) => f === 1 ? T('anvil_top') : T('anvil');
    for (const a of [[2, 0, 2, 14, 4, 14], [4, 4, 3, 12, 5, 13], [6, 5, 4, 10, 10, 12], [0, 10, 3, 16, 16, 13]]) m.box(buf, x, y, z, pi, mc2B(a), tx, { xf });
  },
  bell(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[0], xf = xfH(meta & 7) || (p => p);
    for (const a of [[1, 0, 6, 3, 15, 10], [13, 0, 6, 15, 15, 10]]) m.box(buf, x, y, z, pi, mc2B(a), T('spruce_planks'), { xf });
    m.box(buf, x, y, z, pi, mc2B([3, 12, 7, 13, 14, 9]), T('smooth_stone'), { xf });
    m.box(buf, x, y, z, pi, mc2B([7, 11, 7, 9, 12, 9]), T('bell_gold'), { xf });
    m.box(buf, x, y, z, pi, mc2B([5, 5, 5, 11, 11, 11]), T('bell_gold'), { xf });
    m.box(buf, x, y, z, pi, mc2B([4, 4, 4, 12, 5, 12]), T('bell_gold'), { xf });
  },
  pot(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[1], tp = T('flower_pot');
    m.box(buf, x, y, z, pi, mc2B([5, 0, 5, 11, 6, 11]), tp, { mask: 0b111101 });
    for (const a of [[5, 0, 5, 11, 6, 6], [5, 0, 10, 11, 6, 11], [5, 0, 6, 6, 6, 10], [10, 0, 6, 11, 6, 10]]) m.box(buf, x, y, z, pi, mc2B(a), tp, { mask: 2 });
    m.box(buf, x, y, z, pi, mc2B([6, 0, 6, 10, 5, 10]), T('dirt'), { mask: 2 });
    const pid = mc2PotPlant(meta); if (!pid) return;
    const pd = BLOCKS[pid];
    if (pd.shape === 'cactus') { const bx = mc2B([6.5, 5, 6.5, 9.5, 14, 9.5]); m.box(buf, x, y, z, pi, bx, (wd, f) => blockTex(pd, 0, f), { uvOver: mc2Fit(bx), cull: false }); return; }
    const lay = blockTex(pd, 0, 1), L = P_LIGHT[pi], uvs = [[0, 1], [1, 1], [1, 0], [0, 0]], a = 4 / 16, b = 12 / 16, y0 = 5 / 16, y1 = 13 / 16;
    const fl = 128 | 1 | (isEmissive(pd, 0) ? 32 : 0);
    m.quad(buf, x, y, z, [[a, y0, a], [b, y0, b], [b, y1, b], [a, y1, a]], uvs, lay, fl, L, true);
    m.quad(buf, x, y, z, [[a, y0, b], [b, y0, a], [b, y1, a], [a, y1, b]], uvs, lay, fl, L, true);
  },
  brewing(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[1];
    m.box(buf, x, y, z, pi, mc2B([2, 0, 2, 14, 2, 14]), T('brewing_base'));
    m.box(buf, x, y, z, pi, mc2B([7, 2, 7, 9, 14, 9]), T('brewing_rod'), { flags: 32 });
    const arm = T('smooth_stone');
    m.box(buf, x, y, z, pi, mc2B([9, 11, 7.5, 13, 12, 8.5]), arm); m.box(buf, x, y, z, pi, mc2B([3, 11, 7.5, 7, 12, 8.5]), arm); m.box(buf, x, y, z, pi, mc2B([7.5, 11, 9, 8.5, 12, 13]), arm);
    const spots = [[12, 8], [4, 8], [8, 12]];
    for (let i = 0; i < 3; i++) {
      if (!(meta & (1 << i))) continue;
      const [cx, cz] = spots[i], bx = mc2B([cx - 1.5, 2, cz - 1.5, cx + 1.5, 8, cz + 1.5]);
      m.box(buf, x, y, z, pi, bx, T('brew_bottle'), { uvOver: mc2Fit(bx), cull: false });
      m.box(buf, x, y, z, pi, mc2B([cx - 0.5, 8, cz - 0.5, cx + 0.5, 10, cz + 0.5]), T('glass'), { cull: false });
    }
  },
  snowlayer(m, x, y, z, pi, id, meta, d) { m.box(m.bufs[0], x, y, z, pi, mc2B([0, 0, 0, 16, 2, 16]), d.tex); },
  // 울타리: 울타리 문과도 이어지게 (원래 모양 그대로 + 문)
  fence(m, x, y, z, pi, id, meta, d) {
    const buf = m.bufs[d.layer], texs = d.texf ? (wd => blockTex(d, meta, wd)) : d.tex, px = MC2_P;
    m.box(buf, x, y, z, pi, [6 * px, 0, 6 * px, 10 * px, 1, 10 * px], texs);
    const g = (dx, dz) => { const n = P_ID[pi + dx + dz * PX], nd = BLOCKS[n]; return (nd && (nd.shape === 'fence' || nd.shape === 'gate')) || IS_OPAQUE[n]; };
    for (const yy of [6, 12]) {
      const y0 = yy * px, y1 = (yy + 3) * px;
      if (g(0, -1)) m.box(buf, x, y, z, pi, [7 * px, y0, 0, 9 * px, y1, 6 * px], texs);
      if (g(0, 1)) m.box(buf, x, y, z, pi, [7 * px, y0, 10 * px, 9 * px, y1, 1], texs);
      if (g(-1, 0)) m.box(buf, x, y, z, pi, [0, y0, 7 * px, 6 * px, y1, 9 * px], texs);
      if (g(1, 0)) m.box(buf, x, y, z, pi, [10 * px, y0, 7 * px, 1, y1, 9 * px], texs);
    }
  },
};
if (typeof Mesher !== 'undefined') {
  const _cu = Mesher.prototype.custom;
  Mesher.prototype.custom = function (x, y, z, pi, id, meta, d) {
    const f = MC2_MESH[d.shape];
    if (f) return f(this, x, y, z, pi, id, meta, d);
    return _cu.call(this, x, y, z, pi, id, meta, d);
  };
}

// =====================================================================
// 개체: 배 · 던진 물약 · 화면 장식(모닥불 위 음식·번개)
// =====================================================================
const Mc2Boat = typeof Minecart === 'undefined' ? null : class extends Minecart {
  constructor(x, y, z, yaw) { super(x, y, z); this.w = 1.25; this.h = 0.55; this.yaw = yaw || 0; this.hp = 4; this.stepHeight = 0; this.paddle = 0; }
  // 멀티 참가자가 탔을 때 (방장 쪽): 바라보는 쪽으로 밀기
  pushDir(look, dt) { this.yaw = Math.atan2(-look[0], -look[2]); this.thrust(1, dt * 1.5); }
  thrust(f, dt) { const sp = this.floating ? 9 : 1.5; this.vx += -Math.sin(this.yaw) * f * sp * dt; this.vz += -Math.cos(this.yaw) * f * sp * dt; }
  update(dt, g) {
    this.age += dt;
    const w = g.world, fx = Math.floor(this.x), fz = Math.floor(this.z), by = Math.floor(this.y + 0.3);
    let surf = null;
    for (let yy = by + 1; yy >= by - 1; yy--) if (w.getBlock(fx, yy, fz) === BL.water && w.getBlock(fx, yy + 1, fz) !== BL.water) { surf = yy + 0.88; break; }
    this.floating = surf !== null && this.y < surf + 0.35;
    if (this.floating) {
      this.vy += ((surf - 0.12 - this.y) * 30 - this.vy * 7) * dt;
      const k = Math.exp(-(this.rider ? 0.9 : 1.6) * dt); this.vx *= k; this.vz *= k;
    } else if (w.getBlock(fx, by, fz) === BL.water) { this.vy = Math.min(this.vy + 30 * dt, 3); }
    else { this.vy -= 20 * dt; if (this.onGround) { const k = Math.exp(-7 * dt); this.vx *= k; this.vz *= k; } }
    const sp = Math.hypot(this.vx, this.vz), max = this.floating ? 8 : 2;
    if (sp > max) { this.vx *= max / sp; this.vz *= max / sp; }
    this.move(w, this.vx * dt, this.vy * dt, this.vz * dt);
    this.paddle += sp * dt * 1.6;
    if (this.y < -20) this.dead = true;
  }
  render(g, R, cam) { mc2RenderBoat(this, g, R, cam, this.paddle || this.walk || 0); }
};
function mc2RenderBoat(e, g, R, cam, pad) {
  const m = M4.create(), t = M4.create();
  M4.translate(m, e.x - cam[0], e.y - cam[1], e.z - cam[2]);
  M4.mul(m, m, M4.rotY(t, e.yaw));
  const L = e.lightAt(g.world), W = [0.74, 0.54, 0.34], D = [0.56, 0.38, 0.22], B = (a, b, c, d, e2, f, col) => R.ent.addBox(m, a, b, c, d, e2, f, col, L[0], L[1]);
  B(-0.55, 0.0, -0.8, 0.55, 0.1, 0.8, D);
  B(-0.62, 0.05, -0.8, -0.52, 0.48, 0.8, W); B(0.52, 0.05, -0.8, 0.62, 0.48, 0.8, W);
  B(-0.52, 0.05, -0.9, 0.52, 0.44, -0.8, W); B(-0.52, 0.05, 0.8, 0.52, 0.44, 0.9, W);
  B(-0.52, 0.28, -0.1, 0.52, 0.34, 0.12, D);
  for (const s of [-1, 1]) {
    const pm = new Float32Array(m), tr = M4.create(); M4.translate(tr, s * 0.6, 0.4, 0); M4.mul(pm, pm, tr);
    M4.mul(pm, pm, M4.rotX(M4.create(), Math.sin(pad + (s > 0 ? 0 : Math.PI)) * 0.5));
    R.ent.addBox(pm, s > 0 ? 0 : -0.7, -0.03, -0.04, s > 0 ? 0.7 : 0, 0.03, 0.04, D, L[0], L[1]);
    R.ent.addBox(pm, s > 0 ? 0.6 : -0.85, -0.04, -0.1, s > 0 ? 0.85 : -0.6, 0.04, 0.1, W, L[0], L[1]);
  }
}
const Mc2Thrown = typeof Entity === 'undefined' ? null : class extends Entity {
  constructor(x, y, z, vx, vy, vz, item, mine) { super('mc2pot', 0.25, 0.25); this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz; this.item = item; this.mine = mine; this.stepHeight = 0; this.spin = 0; }
  update(dt, g) {
    this.age += dt; this.vy -= 20 * dt; this.spin += dt * 10;
    const ox = this.vx, oz = this.vz, oy = this.vy;
    this.move(g.world, this.vx * dt, this.vy * dt, this.vz * dt);
    let hit = this.vx !== ox || this.vz !== oz || this.vy !== oy || this.age > 8;
    if (!hit && this.age > 0.15) for (const e of g.ents.list) if (e.type === 'mob' && !e.dead && Math.abs(e.x - this.x) < e.w / 2 + 0.2 && Math.abs(e.z - this.z) < e.w / 2 + 0.2 && this.y > e.y && this.y < e.y + e.h) { hit = true; break; }
    if (hit) { this.dead = true; if (this.mine) g.mc2Splash(this.x, this.y + 0.1, this.z, this.item); }
  }
  render(g, R, cam) {
    const mesh = g.itemMesh(this.item.id), m = M4.create();
    M4.translate(m, this.x - cam[0], this.y - cam[1], this.z - cam[2]); M4.mul(m, m, M4.rotY(M4.create(), this.spin));
    const sm = M4.create(); sm[0] = sm[5] = sm[10] = 0.4; M4.mul(m, m, sm);
    g.frame.blockEnts.push({ mesh, model: m, light: this.lightAt(g.world) });
  }
};
// 늘 플레이어 곁에 있는 그림 전용 개체 (네트워크로 안 보냄)
const Mc2Overlay = typeof Entity === 'undefined' ? null : class extends Entity {
  constructor() { super('mc2fx', 0.1, 0.1); }
  update() { }
  render(g, R, cam) { g.mc2RenderOverlay(R, cam); }
};

// =====================================================================
// 노래 (주크박스): 8분음표 하나가 글자 하나. 숫자=도레미 음(' 한 옥타브 위, , 아래), - 늘이기, . 쉼
// =====================================================================
const MC2_MAJ = [0, 2, 4, 5, 7, 9, 11];
const MC2_SONGS = [
  { step: 0.2, beat: 6, inst: 'harp', bass: 'bass', base: 6, chords: [1, 5, 4, 1, 1, 4, 5, 1],
    mel: "3 - 5 - 1' - 7 - 5 - 3 - 4 - 6 - 2' - 1' - - - . . 3 - 5 - 1' - 2' - 1' - 6 - 5 - 4 - 2 - 1 - - - . ." },
  { step: 0.3, beat: 8, inst: 'bell', bass: 'harp', base: 6, chords: [1, 4, 1, 1, 1, 4, 5, 1],
    mel: "5 - 3 - 5 - 3 - 4 - 6 - 5 - - - 3 - 1 - 3 - 2 - 1 - - - - - . . 5 - 6 - 5 - 3 - 4 - 2 - 4 - 6 - 5 - 3 - 2 - 7, - 1 - - - - - - -" },
  { step: 0.17, beat: 8, inst: 'bit', bass: 'bass', base: 6, drums: true, chords: [1, 4, 1, 5, 4, 4, 5, 1],
    mel: "1 - 3 5 1' - 5 - 6 - 5 3 4 - 2 - 3 - 5 1' 2' - 1' 7 6 - 7 - 5 - - - 1' - 7 6 5 - 3 - 4 - 3 2 3 - 5 - 6 5 4 3 2 - 7, - 1 - - - 1 . . ." },
];
function mc2SongEvents(si) {
  const S = MC2_SONGS[si]; if (S._ev) return S._ev;
  const ev = [], toks = S.mel.split(/\s+/).filter(Boolean), deg = (d, oct) => S.base + MC2_MAJ[(d - 1) % 7] + 12 * (oct + Math.floor((d - 1) / 7));
  const bars = Math.ceil(toks.length / S.beat);
  for (let rep = 0; rep < 2; rep++) {
    const off = rep * toks.length * S.step;
    toks.forEach((t, i) => {
      const mm = /^([1-7])('*)(,*)$/.exec(t);
      if (mm) ev.push([off + i * S.step, deg(+mm[1], mm[2].length - mm[3].length), S.inst, 1]);
    });
    for (let b = 0; b < bars; b++) {
      const root = S.chords[b % S.chords.length], t0 = off + b * S.beat * S.step;
      if (S.beat === 6) { ev.push([t0, deg(root, -1), S.bass, 0.8]); ev.push([t0 + 2 * S.step, deg(root + 2, -1), S.bass, 0.5]); ev.push([t0 + 4 * S.step, deg(root + 4, -1), S.bass, 0.5]); }
      else { ev.push([t0, deg(root, -1), S.bass, 0.8]); ev.push([t0 + 4 * S.step, deg(root + 4, -1), S.bass, 0.6]); }
      if (S.drums) for (let k = 0; k < 4; k++) ev.push([t0 + k * 2 * S.step, 0, k % 2 ? 'snare' : 'basedrum', 0.6]);
    }
  }
  ev.sort((a, b) => a[0] - b[0]);
  S._ev = ev; S.len = 2 * toks.length * S.step;
  return ev;
}

// =====================================================================
// 소리
// =====================================================================
if (typeof Sound !== 'undefined') {
  const SFX = {
    mc2note(o, t, op) { this.note(o, t, op.note || 0, op.inst || 'harp'); },
    mc2bell(o, t) { [1, 2.4, 3.0, 4.2].forEach((k, i) => this.tone(o, t, 2.2 - i * 0.3, 'sine', 523 * k, 0, 0.3 / (i + 1))); this.noiseHit(o, t, 0.05, 'highpass', 4000, 1, 0.2); },
    mc2thunder(o, t) { this.noiseHit(o, t, 0.25, 'highpass', 1800, 0.7, 0.6); this.noiseHit(o, t, 3.2, 'lowpass', 260, 0.6, 1.1, 0.35); this.noiseHit(o, t + 0.3, 2.4, 'lowpass', 140, 0.7, 0.8, 0.3); this.tone(o, t, 1.6, 'sine', 55, 32, 0.5); },
    mc2drink(o, t) { this.tone(o, t, 0.12, 'sine', 300 + Math.random() * 80, 180, 0.22); },
    mc2brew(o, t) { for (let i = 0; i < 6; i++) this.tone(o, t + i * 0.07, 0.08, 'sine', 500 + Math.random() * 700, 900, 0.1); },
    mc2anvil(o, t) { this.tone(o, t, 0.5, 'square', 880, 860, 0.12); this.tone(o, t, 0.7, 'sine', 1760, 0, 0.15); this.noiseHit(o, t, 0.12, 'bandpass', 3500, 2, 0.5); },
    mc2shatter(o, t) { for (let i = 0; i < 6; i++) this.tone(o, t + i * 0.015, 0.18, 'sine', 2200 + Math.random() * 2500, 0, 0.12); this.noiseHit(o, t, 0.4, 'lowpass', 1600, 0.5, 0.4); },
  };
  const _play = Sound.prototype.play;
  Sound.prototype.play = function (name, x, y, z, opt) {
    const f = SFX[name];
    if (!f) return _play.call(this, name, x, y, z, opt);
    if (!this.ensure()) return;
    const o = this.out(x, y, z, opt && opt.vol !== undefined ? opt.vol : 1); if (!o) return;
    f.call(this, o, this.ctx.currentTime, opt || {});
  };
}

// =====================================================================
// 렌더러: 야간 투시 · 번개 번쩍
// =====================================================================
if (typeof Renderer !== 'undefined') {
  const _atm = Renderer.prototype.computeAtmosphere;
  Renderer.prototype.computeAtmosphere = function (world, rain) {
    const A = _atm.call(this, world, rain);
    const nv = MC2FX.nv, fl = MC2FX.flash;
    if (nv > 0) {
      const da = A.dimAmb || [0, 0, 0];
      A.dimAmb = [da[0] + 0.5 * nv, da[1] + 0.5 * nv, da[2] + 0.55 * nv];
      A.ambCol = A.ambCol.map((v, i) => v + ([0.45, 0.45, 0.5][i] - v) * nv * 0.6 + 0.08 * nv);
    }
    if (fl > 0 && world.dim === 'overworld') {
      const da = A.dimAmb || [0, 0, 0];
      A.dimAmb = [da[0] + 0.7 * fl, da[1] + 0.72 * fl, da[2] + 0.85 * fl];
      A.skyTop = A.skyTop.map((v, i) => v + ([0.85, 0.88, 1][i] - v) * fl * 0.7);
      A.skyHor = A.skyHor.map((v, i) => v + ([0.9, 0.92, 1][i] - v) * fl * 0.7);
    }
    return A;
  };
}

// =====================================================================
// 게임: 효과 API · 사용 · 양조 · 날씨 · 저장 (prototype 감싸기)
// =====================================================================
const MC2_DECOR = new Set(['glass_pane', 'stained_glass', 'oak_fence_gate', 'cobblestone_wall', 'lantern', 'campfire', 'cake', 'oak_sign', 'cauldron', 'anvil', 'jukebox', 'bell', 'flower_pot', 'brewing_stand']);
function mc2Cold(w, x, z, y) { const b = w.biomeAt(x, z); return b === 3 || b === 6 || (b === 5 && y > 100); }
function mc2Css() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('mc2-css')) return;
  const st = document.createElement('style'); st.id = 'mc2-css';
  st.textContent = `
#mc2-fx{position:absolute;left:50%;transform:translateX(-50%);top:calc(8px + env(safe-area-inset-top));display:flex;flex-wrap:wrap;justify-content:center;gap:6px;max-width:60vw;pointer-events:none;z-index:3}
body.boss #mc2-fx{top:56px}
#mc2-fx .fx{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.85);border:2px solid var(--c);border-radius:14px;padding:2px 9px 2px 3px;font-size:13px;font-weight:700;color:#4a3a6a;box-shadow:0 2px 8px rgba(80,50,120,.18)}
#mc2-fx .fx i{font-style:normal;font-size:14px;width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:var(--c)}
#mc2-fx .fx small{font-weight:600;opacity:.75}
#mc2-fx .fx.end{animation:mc2blink .45s infinite alternate}
@keyframes mc2blink{to{opacity:.35}}
#mc2-signs{position:absolute;inset:0;pointer-events:none}
#mc2-signs .sg{position:absolute;transform:translate(-50%,-100%);background:rgba(252,243,224,.94);border:2px solid #b8925a;color:#4a3220;padding:3px 10px;border-radius:9px;font-size:14px;font-weight:700;white-space:pre;text-align:center;line-height:1.3;box-shadow:0 2px 8px rgba(80,50,20,.25)}
.slot .mc2-dot{position:absolute;right:1px;top:1px;min-width:10px;height:10px;border-radius:6px;border:1.5px solid #fff;font:700 8px/9px sans-serif;color:#fff;text-align:center;font-style:normal;pointer-events:none;box-shadow:0 0 2px rgba(0,0,0,.4)}
.mc2-panel{max-width:520px}
.mc2-brew{display:grid;grid-template-columns:auto auto auto;gap:10px 18px;align-items:center;justify-items:center;padding:6px 4px}
.mc2-brew .lbl{font-size:12px;color:#6a5a8a;text-align:center}
.mc2-bar{width:14px;height:44px;background:#e1e7f5;border-radius:7px;position:relative;overflow:hidden}
.mc2-bar>div{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(#ffd35a,#ff7a5c)}
.mc2-bar.prog>div{background:linear-gradient(#b48cff,#ff8fd8);top:0;bottom:auto}
.mc2-bottles{display:flex;gap:10px}
.mc2-an{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mc2-an .plus{font-size:22px;color:#8a7aa8}
.mc2-an-res{display:flex;flex-direction:column;gap:6px;min-width:220px}
.mc2-an-res .slot{pointer-events:none}
.mc2-sign-panel textarea{width:100%;box-sizing:border-box;font:700 20px/1.4 inherit;text-align:center;padding:10px;border-radius:12px;border:2px solid #d8c09a;background:#fcf3e0;color:#4a3220;resize:none;margin:8px 0}
`;
  document.head.appendChild(st);
}

if (typeof Game !== 'undefined') {
  const G = Game.prototype;

  // ---------- 효과 API (블록 코딩도 씀) ----------
  // target: 플레이어(game.player 또는 생략) · 몹 · 친구(remotes 의 값) / id: 'speed'·'신속' 등 / sec 초 / level 1~5
  G.giveEffect = function (target, id, sec, level) {
    const key = mc2EffKey(id); if (!key) return false;
    sec = clamp(+sec || 30, 1, 3600); const lv = clamp((level | 0) || 1, 1, 5);
    if (!target || target === 'me' || target === this.player) return this.mc2Apply(this.player, key, sec, lv);
    if (target.type === 'mob') {
      if (target.remote) { this.net.send({ t: 'mc2fxm', eid: target.eid, e: key, s: sec, l: lv }); return true; }
      return this.mc2Apply(target, key, sec, lv);
    }
    for (const [rid, r] of this.remotes) if (r === target) { this.net.sendTo(rid, { t: 'mc2eff', e: key, s: sec, l: lv }); return true; }
    return false;
  };
  G.clearEffects = function (target) {
    if (!target || target === 'me' || target === this.player) { if (this.player) this.player.mc2fx = {}; this._mc2HudK = null; return true; }
    if (target.type === 'mob') { target.mc2fx = null; return true; }
    for (const [rid, r] of this.remotes) if (r === target) { this.net.sendTo(rid, { t: 'mc2eff', clear: 1 }); return true; }
    return false;
  };
  G.hasEffect = function (target, id) { const t = target || this.player, k = mc2EffKey(id), f = t && t.mc2fx && t.mc2fx[k]; return f ? f.l : 0; };
  G.mc2Apply = function (t, key, sec, lv) {
    const E = EFFECTS[key]; if (!E || !t) return false;
    if (t === this.player) this.mc2Seen(key);
    if (E.instant) {
      const amt = 4 * lv;
      if (t === this.player) { if (!t.dead) { t.heal(amt); this.ui.refreshStats(); } }
      else if (t.type === 'mob' && t.def) t.hp = Math.min(t.def.hp, t.hp + amt);
      if (this.particles) for (let k = 0; k < 6; k++) this.particles.dust(t.x + (Math.random() - 0.5), t.y + 0.5 + Math.random() * 1.2, t.z + (Math.random() - 0.5), [1, 0.4, 0.5]);
      return true;
    }
    const fx = t.mc2fx || (t.mc2fx = {}), cur = fx[key];
    if (!cur || lv > cur.l || (lv === cur.l && sec > cur.t)) fx[key] = { t: sec, l: lv };
    if (t === this.player) this._mc2HudK = null;
    return true;
  };
  G.mc2Seen = function (key) {
    const st = this.stats; if (!st || this.player.creative) return;
    const a = st.mc2eff || (st.mc2eff = []); if (!a.includes(key)) a.push(key);
  };
  const lvOf = (p, k) => { const f = p && p.mc2fx && p.mc2fx[k]; return f ? f.l : 0; };

  // ---------- 플레이어 움직임: 신속·느림·도약·느린 낙하·공중 부양 ----------
  const P = Player.prototype;
  const _pupd = P.update;
  P.update = function (dt, input, world) {
    const fx = this.mc2fx;
    if (!fx || this.riding || this.dead) return _pupd.call(this, dt, input, world);
    const slow = lvOf(this, 'slowness');
    const inp = slow ? Object.assign({}, input, { moveF: input.moveF / (1 + 0.4 * slow), moveS: input.moveS / (1 + 0.4 * slow) }) : input;
    const x0 = this.x, z0 = this.z;
    _pupd.call(this, dt, inp, world);
    if (this.dead || this.riding) return;
    const sp = lvOf(this, 'speed');
    if (sp && !this.flying) {
      const k = 0.2 * sp, dx = (this.x - x0) * k, dz = (this.z - z0) * k;
      if (dx * dx + dz * dz > 1e-8) { const og = this.onGround; this.move(world, dx, 0, dz, this.sneaking); this.onGround = og; }
    }
    const jp = lvOf(this, 'jump');
    if (jp && this.vy === 9 && this.lastJumpTick === world.tick && this._mc2jt !== world.tick) { this._mc2jt = world.tick; this.vy = Math.sqrt(2 * 32 * (1.3 + jp * 0.85)); }
    if (lvOf(this, 'slow_fall') && !this.flying) { if (this.vy < -3) this.vy = -3; this.fallDist = 0; }
    const lev = lvOf(this, 'levitation');
    if (lev && !this.flying) { this.vy = Math.max(this.vy, 1.1 + lev * 0.6); this.fallDist = 0; }
  };
  const _hurt = P.hurt;
  P.hurt = function (amount, src, kx, kz) {
    if (this.mc2fx && !this.creative) {
      if (lvOf(this, 'fire_res') && (src === 'fire' || src === 'lava' || src === 'fireball')) return false;
      if (src === 'fall') { if (lvOf(this, 'slow_fall')) return false; amount -= lvOf(this, 'jump'); if (amount <= 0) return false; }
      const r = lvOf(this, 'resistance'); if (r && src !== 'void') amount *= Math.max(0.2, 1 - 0.2 * r);
    }
    return _hurt.call(this, amount, src, kx, kz);
  };
  const _surv = P.survival;
  P.survival = function (dt, world) {
    const r = _surv.call(this, dt, world);
    if (this.creative) return r;
    if (lvOf(this, 'water_breath')) this.air = 300;
    // 켜진 모닥불 위: 뜨거워요
    const fl = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.05), Math.floor(this.z));
    if (fl === BL.campfire && !(world.getMeta(Math.floor(this.x), Math.floor(this.y - 0.05), Math.floor(this.z)) & 8) && this.onGround && !this.sneaking) this.hurt(1, 'fire');
    return r;
  };
  // 배 타기
  const _ur = P.updateRiding;
  P.updateRiding = function (dt, input, world) {
    const b = this.riding;
    if (Mc2Boat && b instanceof Mc2Boat) {
      const g = this.game;
      if (b.dead) { g.dismount(this); return; }
      b.yaw = this.yaw;
      const f = Math.max(-0.5, Math.min(1, input.moveF || 0));
      if (Math.abs(f) > 0.05) b.thrust(f, dt);
      const ox = this.x, oz = this.z;
      this.x = b.x; this.y = b.y + 0.12; this.z = b.z; this.vx = this.vy = this.vz = 0; this.onGround = false; this.fallDist = 0;
      if (g.stats && !this.creative) { const d = Math.hypot(this.x - ox, this.z - oz); if (d < 2) g.stats.mc2boat = (g.stats.mc2boat || 0) + d; }
      if (input.sneakPress) g.dismount(this);
      this.survival(dt, world);
      return;
    }
    return _ur.call(this, dt, input, world);
  };

  // ---------- 몹: 효과 · 투명화 ----------
  if (typeof Mob !== 'undefined') {
    const _mu = Mob.prototype.update;
    Mob.prototype.update = function (dt, g) {
      const p = g.player;
      if (this.def && this.def.hostile && lvOf(p, 'invis') && !g.allPlayers.mc2) {
        const ap = g.allPlayers, me = this;
        g.allPlayers = function () { return ap.call(this).filter(q => q !== p || (q.x - me.x) ** 2 + (q.z - me.z) ** 2 < 4); };
        g.allPlayers.mc2 = true;
        try { _mu.call(this, dt, g); } finally { delete g.allPlayers; }
      } else _mu.call(this, dt, g);
      const fx = this.mc2fx; if (!fx || this.dead) return;
      for (const k in fx) { fx[k].t -= dt; if (fx[k].t <= 0) delete fx[k]; }
      if (fx.regen) { this._rg = (this._rg || 0) + dt; if (this._rg > 2.5 / fx.regen.l) { this._rg = 0; this.hp = Math.min(this.def.hp, this.hp + 1); } }
      if (fx.poison) { this._ps = (this._ps || 0) + dt; if (this._ps > 1.25 / fx.poison.l) { this._ps = 0; if (this.hp > 1) this.hp -= 1; } }
      if (fx.levitation) this.vy = Math.max(this.vy, 1.1 + fx.levitation.l * 0.6);
      if (fx.slow_fall && this.vy < -3) { this.vy = -3; this.fallDist = 0; }
    };
    const _mr = Mob.prototype.render;
    Mob.prototype.render = function (g, R, cam) { if (this.mc2fx && this.mc2fx.invis) return; return _mr.call(this, g, R, cam); };
  }

  // ---------- 공격·부수기: 힘 · 성급함 · 배 · 몹 화염 저항 ----------
  const _dmg = G.damageEntity;
  G.damageEntity = function (e, dmg, kx, kz, src) {
    if (src === 'player') { const s = lvOf(this.player, 'strength'); if (s) dmg += 3 * s; }
    if (Mc2Boat && e instanceof Mc2Boat && !e.remote) {
      e.hp -= this.player.creative && src === 'player' ? 99 : dmg; e.vx += kx * 1.5; e.vz += kz * 1.5;
      this.sound.play('break', e.x, e.y + 0.3, e.z, { mat: 'wood' });
      if (e.hp <= 0 && !e.dead) { e.dead = true; if (e.rider && e.rider === this.player) this.dismount(e.rider); else if (e.rider) { e.rider = null; e.riderId = null; } this.dropItem(e.x, e.y + 0.5, e.z, { id: I('boat'), n: 1 }); }
      return;
    }
    if (e && e.mc2fx && e.mc2fx.fire_res && (src === 'fire' || src === 'lava')) return;
    return _dmg.call(this, e, dmg, kx, kz, src);
  };
  const _bt = G.breakTime;
  G.breakTime = function (id, held) { const t = _bt.call(this, id, held), h = lvOf(this.player, 'haste'); return h ? Math.max(0.05, t / (1 + 0.3 * h)) : t; };
  const _death = G.onPlayerDeath;
  G.onPlayerDeath = function (src) { if (this.player) this.player.mc2fx = {}; this._mc2HudK = null; return _death.call(this, src); };

  // ---------- 저장·불러오기 ----------
  const _sw = G.startWorld;
  G.startWorld = async function (opt) {
    const rec = opt.rec, m = rec && rec.mc2;
    this.mc2Gen = rec ? ((m && m.gen) | 0) : opt.client ? (this._mc2NetGen | 0) : 1;
    this.mc2Thunder = !!(m && m.th && rec.rain);
    this.mc2BoatStore = m && m.boats ? JSON.parse(JSON.stringify(m.boats)) : {};
    this._mc2Dim = null; this.mc2Juke = new Map(); this._mc2Bolts = []; this._mc2HudK = null; this.mc2DrinkT = 0; MC2FX.nv = 0; MC2FX.flash = 0;
    const r = await _sw.call(this, opt);
    const p = this.player;
    if (p) {
      p.mc2fx = {};
      if (m && Array.isArray(m.fx)) for (const [k, t, l] of m.fx) if (EFFECTS[k] && t > 0) p.mc2fx[k] = { t: +t, l: (l | 0) || 1 };
    }
    mc2Css();
    return r;
  };
  G.mc2CollectBoats = function () {
    const out = [];
    if (this.ents && Mc2Boat) for (const e of this.ents.list) if (!e.dead && e instanceof Mc2Boat) out.push([+e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +e.yaw.toFixed(2)]);
    return out;
  };
  const _ser = G.serializeWorld;
  G.serializeWorld = function () {
    const r = _ser.call(this), p = this.player;
    const boats = JSON.parse(JSON.stringify(this.mc2BoatStore || {}));
    if (this.world && !this.world.remote) boats[this.world.dim] = (boats[this.world.dim] || []).concat(this.mc2CollectBoats());
    const fx = []; if (p && p.mc2fx) for (const k in p.mc2fx) fx.push([k, Math.round(p.mc2fx[k].t), p.mc2fx[k].l]);
    r.mc2 = { gen: this.mc2Gen | 0, th: this.mc2Thunder ? 1 : 0, fx, boats };
    return r;
  };
  const _aw = G.attachWorld;
  G.attachWorld = function (w) {
    if (this.ents && this._mc2Dim && this.mc2BoatStore && !(this.world && this.world.remote)) { const l = this.mc2CollectBoats(); if (l.length) this.mc2BoatStore[this._mc2Dim] = (this.mc2BoatStore[this._mc2Dim] || []).concat(l); }
    w.mc2gen = this.mc2Gen | 0;
    const r = _aw.call(this, w);
    this._mc2Dim = w.dim; this.mc2Brews = new Set(); this.mc2Camps = new Set(); this._mc2Near = null; this._mc2NearT = 0;
    for (const [k, v] of w.be) if (v && v.t === 'brew') this.mc2Brews.add(k);
    if (Mc2Overlay) this._mc2Ov = this.ents.add(new Mc2Overlay());
    if (this.mc2Juke) this.mc2Juke.clear();
    return r;
  };
  const _ocl = G.onChunkLoaded;
  G.onChunkLoaded = function (c) {
    _ocl.call(this, c);
    const ids = c.ids, cf = BL.campfire;
    for (let i = 0; i < ids.length; i++) if (ids[i] === cf) this.mc2Camps.add(fmtKey(c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15)));
  };
  // 블록 엔티티 바꾸고 알리기 (방장: 모두에게, 참가자: 방장에게)
  G.mc2SetBe = function (k, v) {
    const w = this.world;
    if (v) w.be.set(k, v); else w.be.delete(k);
    if (w.remote) { if (v) this.net.send({ t: 'be', k, v }); }
    else if (this.net.isHost) this.net.broadcast({ t: 'be', k, v });
  };
  const _obc = G.onBlockChange;
  G.onBlockChange = function (x, y, z, oid, om, id, meta, flags) {
    const w = this.world, k = fmtKey(x, y, z);
    if (id === BL.campfire) this.mc2Camps.add(k); else if (oid === BL.campfire) this.mc2Camps.delete(k);
    _obc.call(this, x, y, z, oid, om, id, meta, flags);
    if (w.remote || oid === id) return;
    if (oid === BL.campfire || oid === BL.oak_sign || oid === BL.jukebox) {
      const be = w.be.get(k);
      if (be) {
        if (be.t === 'camp') for (const it of be.items) if (it) this.dropItem(x + 0.5, y + 0.5, z + 0.5, { id: it.id, n: it.n });
        if (be.t === 'juke' && be.disc) this.dropItem(x + 0.5, y + 1, z + 0.5, { id: be.disc, n: 1 });
        if (be.t === 'camp' || be.t === 'sign' || be.t === 'juke') { w.be.delete(k); if (this.net.isHost) this.net.broadcast({ t: 'be', k, v: null }); }
      }
    }
  };
  const _cc = G.createContainer;
  G.createContainer = function (x, y, z, id) {
    if (id === BL.brewing_stand) { const k = fmtKey(x, y, z); this.world.be.set(k, { t: 'brew', items: [null, null, null, null, null], fuel: 0, prog: 0 }); this.mc2Brews.add(k); return; }
    return _cc.call(this, x, y, z, id);
  };

  // ---------- 받침 ----------
  const _sd = G.supportDir;
  G.supportDir = function (id, meta) {
    const d = BLOCKS[id];
    if (d) switch (d.shape) {
      case 'sign': return meta & 8 ? OPP[meta & 7] : 0;
      case 'lantern': return meta & 1 ? 1 : 0;
      case 'pot': case 'cake': case 'snowlayer': return 0;
    }
    return _sd.call(this, id, meta);
  };
  const _so = G.supportOk;
  G.supportOk = function (x, y, z, id, meta) {
    const w = this.world;
    if (id === BL.nether_wart) { const s = w.getBlock(x, y - 1, z); return !w.isLoadedAt(x, z) || s === BL.soul_sand; }
    if (id === BL.snow_layer) { const s = w.getBlock(x, y - 1, z); return !w.isLoadedAt(x, z) || IS_OPAQUE[s] === 1 || !!(BLOCKS[s] && BLOCKS[s].wave === 1); }
    const d = BLOCKS[id];
    if (d && (d.shape === 'lantern' || d.shape === 'pot' || d.shape === 'sign' || d.shape === 'cake')) {
      const sd = this.supportDir(id, meta);
      if (sd >= 0) { const sb = BLOCKS[w.getBlock(x + DX[sd], y + DY[sd], z + DZ[sd])]; if (sb && (sb.shape === 'wall' || sb.shape === 'pane' || sb.shape === 'gate')) return true; }
    }
    return _so.call(this, x, y, z, id, meta);
  };

  // ---------- 놓기: 표지판·랜턴·색유리 (meta 를 직접 정함) ----------
  const _pb = G.placeBlock;
  G.placeBlock = function (hit, bid, held) {
    const hd = held && ITEMS[held.id];
    const special = bid === BL.oak_sign || bid === BL.lantern || (hd && hd.placeMeta !== undefined);
    if (!special) { _pb.call(this, hit, bid, held); this.mc2Decor(bid); return; }
    const p = this.player, w = this.world, td = BLOCKS[hit.id];
    let x = hit.x + DX[hit.face], y = hit.y + DY[hit.face], z = hit.z + DZ[hit.face], face = hit.face;
    if (td.replace && hit.id !== bid) { x = hit.x; y = hit.y; z = hit.z; face = 1; }
    if (y < 0 || y >= HEIGHT) return;
    const cur = w.getBlock(x, y, z); if (cur && !BLOCKS[cur].replace) return;
    let meta = 0;
    if (bid === BL.oak_sign) { if (face === 0) return; meta = face === 1 ? OPP[this.lookDirH()] : (face | 8); }
    else if (bid === BL.lantern) meta = face === 0 ? 1 : 0;
    else meta = hd.placeMeta;
    if (!this.supportOk(x, y, z, bid, meta)) return;
    if (BLOCKS[bid].solid) {
      const pb = p.aabb();
      for (const b of blockBoxes(bid, meta, false, w, x, y, z) || []) {
        const bb = [x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]];
        if (bb[0] < pb[3] - 0.001 && bb[3] > pb[0] + 0.001 && bb[1] < pb[4] - 0.001 && bb[4] > pb[1] + 0.001 && bb[2] < pb[5] - 0.001 && bb[5] > pb[2] + 0.001) return;
      }
    }
    this.setBlockNet(x, y, z, bid, meta);
    this.afterPlace(x, y, z, bid);
    p.consumeHeld(1);
    this.mc2Decor(bid);
    if (bid === BL.oak_sign && this.input.ev.use) setTimeout(() => this.ui.openSign(x, y, z), 30);
  };
  G.mc2Decor = function (bid) {
    const d = BLOCKS[bid]; if (!d || !MC2_DECOR.has(d.name) || !this.stats) return;
    const a = this.stats.mc2decor || (this.stats.mc2decor = []); if (!a.includes(bid)) a.push(bid);
    this.advGrant('decor');
  };
  const _pick = G.pickBlock;
  G.pickBlock = function (id, meta) {
    if (id === BL.stained_glass) id = I('stained_glass_' + DYES[meta & 15][0]);
    else if (id === BL.nether_wart) id = I('nether_wart');
    else if (id === BL.snow_layer) id = BL.snow_layer;
    const p = this.player;
    if (!BLOCKS[id] || BLOCKS[id].item === false || id >= 256) {
      if (!ITEMS[id]) return;
      for (let i = 0; i < 9; i++) if (p.inv[i] && p.inv[i].id === id) { this.selectSlot(i); return; }
      if (p.creative) { let s = p.sel; for (let i = 0; i < 9; i++) if (!p.inv[i]) { s = i; break; } p.inv[s] = { id, n: 1 }; this.selectSlot(s); this.ui.refreshHotbar(); }
      return;
    }
    return _pick.call(this, id, meta);
  };

  // ---------- 블록 우클릭 ----------
  const USE = {
    gate(g, x, y, z, m) { const open = !(m & 8); g.setBlockNet(x, y, z, BL.oak_fence_gate, open ? m | 8 : m & ~8); g.sound.play(open ? 'door_open' : 'door_close', x + 0.5, y + 0.5, z + 0.5); return true; },
    cake(g, x, y, z, m) {
      const p = g.player;
      if (!p.creative && p.food >= 20) { g.ui.toast('🍰 배가 불러요! 배고플 때 먹어요', 1500); return true; }
      p.eat(2, 0.4); g.sound.play('eat', x + 0.5, y + 0.5, z + 0.5); g.particles.blockBreak(x, y, z, BL.cake, m);
      g.setBlockNet(x, y, z, (m & 7) >= 6 ? 0 : BL.cake, (m & 7) >= 6 ? 0 : (m & 7) + 1);
      g.advGrant('cake'); g.ui.refreshStats(); return true;
    },
    sign(g, x, y, z) { g.ui.openSign(x, y, z); return true; },
    anvil(g) { g.ui.openAnvil(); return true; },
    brewing(g, x, y, z) { g.ui.openBrewing(x, y, z); return true; },
    bell(g, x, y, z) {
      if (g.world.remote) { g.sound.play('mc2bell', x + 0.5, y + 0.5, z + 0.5); g.net.send({ t: 'mc2snd', n: 'mc2bell', p: [x + 0.5, y + 0.5, z + 0.5] }); }
      else g.sfx('mc2bell', x + 0.5, y + 0.5, z + 0.5);
      g.particles.dust(x + 0.5, y + 1, z + 0.5, [1, 0.9, 0.4]); g.swing = 1;
      // 주민이 종 쪽으로 모임
      if (!g.world.remote) for (const e of g.ents.list) if (e.def && e.def.villager && (e.x - x) ** 2 + (e.z - z) ** 2 < 900) { e.yaw = Math.atan2(-(x - e.x), -(z - e.z)); e.walking = true; e.wanderT = 3; }
      return true;
    },
    jukebox(g, x, y, z) {
      const k = fmtKey(x, y, z), be = g.world.be.get(k), p = g.player, held = p.held, hd = held && ITEMS[held.id];
      if (be && be.disc) {
        const disc = be.disc; g.mc2SetBe(k, { t: 'juke', disc: 0 });
        if (g.world.remote) { const left = p.give(disc, 1); if (left) g.dropItem(x + 0.5, y + 1.1, z + 0.5, { id: disc, n: 1 }); }
        else g.dropItem(x + 0.5, y + 1.1, z + 0.5, { id: disc, n: 1 }, [0, 3, 0]);
        g.ui.toast('💿 음반을 꺼냈어요', 1200); return true;
      }
      if (hd && hd.disc !== undefined) {
        g.mc2SetBe(k, { t: 'juke', disc: held.id }); p.consumeHeld(1); if (p.creative) { }
        g.ui.toast(`🎵 지금 나오는 노래: 「${MC2_DISCS[hd.disc][0]}」`, 2500); g.advGrant('jukebox'); return true;
      }
      g.ui.toast('💿 음반을 들고 우클릭하면 음악이 나와요', 1800); return true;
    },
    pot(g, x, y, z, m) {
      const p = g.player, held = p.held;
      if (m) { const pid = mc2PotPlant(m); g.setBlockNet(x, y, z, BL.flower_pot, 0); if (pid && !p.creative) { const left = p.give(pid, 1); if (left) g.dropItem(x + 0.5, y + 0.6, z + 0.5, { id: pid, n: 1 }); } return true; }
      const idx = held ? MC2_POT_PLANTS.findIndex(n => BL[n] === held.id) : -1;
      if (idx < 0) { g.ui.toast('🌼 꽃·묘목·버섯·선인장·대나무를 들고 우클릭해요', 1800); return true; }
      g.setBlockNet(x, y, z, BL.flower_pot, idx + 1); p.consumeHeld(1); g.sound.play('place', x + 0.5, y + 0.5, z + 0.5, { mat: 'grass' }); return true;
    },
    campfire(g, x, y, z, m) {
      const p = g.player, held = p.held, hd = held && ITEMS[held.id], k = fmtKey(x, y, z);
      if (hd && hd.tool && hd.tool.kind === 'shovel' && !(m & 8)) { g.setBlockNet(x, y, z, BL.campfire, m | 8); g.sound.play('fizz', x + 0.5, y + 0.5, z + 0.5); p.damageHeld(1); return true; }
      if (hd && hd.name === 'flint_and_steel' && (m & 8)) { g.setBlockNet(x, y, z, BL.campfire, m & ~8); g.sound.play('fizz', x + 0.5, y + 0.5, z + 0.5); p.damageHeld(1); return true; }
      const res = held ? SMELT[held.id] : undefined;
      if (held && res !== undefined && ITEMS[res] && ITEMS[res].food && ITEMS[held.id].food) {
        if (m & 8) { g.ui.toast('🔥 불이 꺼져 있어요. 부싯돌과 부시로 켜요', 1600); return true; }
        const be = g.world.be.get(k) || { t: 'camp', items: [null, null, null, null], cook: [0, 0, 0, 0] };
        const i = be.items.findIndex(s => !s);
        if (i < 0) { g.ui.toast('모닥불 위가 꽉 찼어요 (4개까지)', 1400); return true; }
        be.items[i] = { id: held.id, n: 1 }; be.cook[i] = 0; p.consumeHeld(1);
        g.mc2SetBe(k, Object.assign({}, be)); g.sound.play('place', x + 0.5, y + 0.5, z + 0.5, { mat: 'wood' });
        return true;
      }
      g.ui.toast(m & 8 ? '🔥 꺼진 모닥불 · 부싯돌과 부시로 다시 켜요' : '🍖 날고기·생선·감자를 들고 우클릭하면 구워져요', 1800);
      return true;
    },
    cauldron(g, x, y, z, m) { g.ui.toast(`🫕 가마솥 물 ${m & 3}/3 · 물 양동이로 채우고 빈 병으로 떠요`, 1800); return true; },
  };
  const _ub = G.useBlock;
  G.useBlock = function (x, y, z, local, pid) {
    const w = this.world, id = w.getBlock(x, y, z), d = BLOCKS[id];
    if (d && USE[d.use]) { if (!local) return false; if (this.ui.modal) return true; return USE[d.use](this, x, y, z, w.getMeta(x, y, z)); }
    return _ub.call(this, x, y, z, local, pid);
  };

  // ---------- 아이템 우클릭: 우유 짜기 · 물 뜨기 · 가마솥 · 던지기 · 배 ----------
  G.mc2Use = function (hit) {
    const p = this.player, w = this.world, held = p.held, hd = held ? ITEMS[held.id] : null, n = hd ? hd.name : '', ent = this.targetEnt;
    const swap = (name) => { if (p.creative) return; const nid = I(name); if (held.n > 1) { held.n--; const left = p.give(nid, 1); if (left) this.dropItem(p.x, p.y + 1, p.z, { id: nid, n: 1 }); } else p.inv[p.sel] = { id: nid, n: 1 }; this.ui.refreshHotbar(); };
    if (ent && ent.type === 'mob' && !ent.dead && ent.sub === 'cow' && n === 'bucket') { swap('milk_bucket'); this.sound.play('splash', ent.x, ent.y + 1, ent.z); this.swing = 1; this.ui.toast('🥛 우유를 짰어요!', 1200); return true; }
    if (hd && hd.splash) {
      const d = p.lookDir();
      this.ents.add(new Mc2Thrown(p.x + d[0] * 0.5, p.eyeY() - 0.1, p.z + d[2] * 0.5, d[0] * 15, d[1] * 15 + 3, d[2] * 15, { id: held.id, n: 1, d: held.d | 0 }, true));
      p.consumeHeld(1); this.swing = 1; this.sound.play('bow', p.x, p.y + 1.5, p.z); this.advGrant('splash'); return true;
    }
    if (hit && hit.id === BL.cauldron && !p.sneaking) {
      const lv = hit.meta & 3, set = (v) => this.setBlockNet(hit.x, hit.y, hit.z, BL.cauldron, v), snd = () => { this.sound.play('splash', hit.x + 0.5, hit.y + 0.8, hit.z + 0.5); this.swing = 1; };
      if (n === 'water_bucket') { set(3); if (!p.creative) p.inv[p.sel] = { id: I('bucket'), n: 1 }; snd(); this.ui.refreshHotbar(); return true; }
      if (n === 'bucket' && lv === 3) { set(0); swap('water_bucket'); snd(); return true; }
      if (n === 'glass_bottle' && lv > 0) { set(lv - 1); swap('water_bottle'); snd(); return true; }
      if (n === 'water_bottle' && lv < 3) { set(lv + 1); swap('glass_bottle'); snd(); return true; }
      return false;
    }
    if (n === 'glass_bottle' && !(hit && (hit.id === BL.bee_nest || hit.id === BL.beehive))) {
      const d = p.lookDir(), fh = raycast(w, p.x, p.eyeY(), p.z, d[0], d[1], d[2], 5, { fluids: true });
      if (fh && fh.id === BL.water) { swap('water_bottle'); this.sound.play('splash', fh.x + 0.5, fh.y + 0.8, fh.z + 0.5); this.swing = 1; return true; }
      return false;
    }
    if (n === 'boat') {
      const d = p.lookDir(), fh = raycast(w, p.x, p.eyeY(), p.z, d[0], d[1], d[2], 5, { fluids: true });
      if (!fh) return true;
      let pos;
      if (fh.id === BL.water) pos = [fh.x + 0.5, fh.y + 0.8, fh.z + 0.5];
      else if (fh.face === 1 && !(BLOCKS[fh.id].use && !p.sneaking)) pos = [fh.x + 0.5, fh.y + 1.02, fh.z + 0.5];
      else return false;
      if (w.remote) this.net.send({ t: 'mc2boat', p: pos, yaw: p.yaw });
      else this.ents.add(new Mc2Boat(pos[0], pos[1], pos[2], p.yaw));
      p.consumeHeld(1); this.swing = 1; this.sound.play('place', pos[0], pos[1], pos[2], { mat: 'wood' });
      return true;
    }
    return false;
  };
  const _pu = G.playerUse;
  G.playerUse = function (hit, s, fresh) {
    if (fresh && this.mc2Use(hit)) return;
    return _pu.call(this, hit, s, fresh);
  };
  const _ride = G.ride;
  G.ride = function (cart) { const r = _ride.call(this, cart); if ((Mc2Boat && cart instanceof Mc2Boat) || (cart.remote && cart.sub === 'boat')) { this.advGrant('boat'); this.ui.toast('⛵ 배를 탔어요! W 앞으로 · 마우스로 방향 · Shift 내리기', 2500); } return r; };

  // ---------- 마시기 (물약·물병·우유) ----------
  const _int = G.interact;
  G.interact = function (dt, s) {
    const p = this.player, held = p.held, hd = held ? ITEMS[held.id] : null, ev = this.input.ev;
    if (hd && hd.drink && !p.dead) {
      if (ev.use) {
        const d = p.lookDir(), hit = raycast(this.world, p.x, p.eyeY(), p.z, d[0], d[1], d[2], p.creative ? 6 : 5);
        this._mc2NoDrink = !!(hit && !p.sneaking && BLOCKS[hit.id].use);
      }
      if (!s.use) { this._mc2NoDrink = false; this.mc2DrinkT = 0; }
      else if (!this._mc2NoDrink) {
        this.mc2DrinkT = (this.mc2DrinkT || 0) + dt; this.swing = 0.3;
        if (((this.mc2DrinkT * 4) | 0) !== (((this.mc2DrinkT - dt) * 4) | 0)) this.sound.play('mc2drink', p.x, p.y + 1.5, p.z);
        if (this.mc2DrinkT >= 1.4) { this.mc2DrinkT = 0; this.mc2Drink(held, hd); }
        const u = ev.use; ev.use = false;
        const r = _int.call(this, dt, Object.assign({}, s, { use: false }));
        ev.use = u;
        return r;
      }
    } else this.mc2DrinkT = 0;
    return _int.call(this, dt, s);
  };
  G.mc2Drink = function (held, hd) {
    const p = this.player;
    let ret = 'glass_bottle';
    if (hd.drink === 'water') this.ui.toast('💧 시원한 물! (물약 재료로 쓰면 더 좋아요)', 1600);
    else if (hd.drink === 'none') this.ui.toast('😐 음… 아무 일도 없어요. 양조기에서 재료를 더 넣어 보세요!', 2200);
    else if (hd.drink === 'milk') { this.clearEffects(); ret = 'bucket'; this.ui.toast('🥛 꿀꺽! 모든 효과가 사라졌어요', 1800); this.advGrant('milk'); }
    else {
      const info = mc2PotInfo(held);
      if (info) { this.mc2Apply(p, info.e, info.sec, info.lv); this.ui.toast(`${info.E.ic} ${mc2PotLabel(info)}!`, 2000); this.advGrant('drink'); }
    }
    this.sound.play('burp', p.x, p.y + 1.5, p.z);
    if (!p.creative) { p.inv[p.sel] = { id: I(ret), n: 1 }; this.ui.refreshHotbar(); }
  };
  // 깨진 물약: 둘레 4칸
  G.mc2Splash = function (x, y, z, item, fromId) {
    const info = mc2PotInfo(item); if (!info) return;
    const c = MC2_POT_RGB[info.e].map(v => v / 255);
    this.mc2SplashFx(x, y, z, info.e);
    const R2 = 4.5 * 4.5, p = this.player, sc = (d2) => Math.max(0.25, 1 - Math.sqrt(d2) / 4.5);
    const d2p = (p.x - x) ** 2 + (p.y + 1 - y) ** 2 + (p.z - z) ** 2;
    if (fromId === undefined && d2p < R2 && !p.dead) this.mc2Apply(p, info.e, Math.round(info.sec * sc(d2p)), info.lv);
    if (this.world.remote) { if (fromId === undefined) this.net.send({ t: 'mc2splash', p: [x, y, z], it: item }); return; }
    if (fromId !== undefined && d2p < R2 && !p.dead) this.mc2Apply(p, info.e, Math.round(info.sec * sc(d2p)), info.lv);
    for (const e of this.ents.list) if (e.type === 'mob' && !e.dead && !e.remote) { const d2 = (e.x - x) ** 2 + (e.y + 0.5 - y) ** 2 + (e.z - z) ** 2; if (d2 < R2) this.mc2Apply(e, info.e, Math.round(info.sec * sc(d2)), info.lv); }
    for (const [rid, r] of this.remotes) { if (rid === fromId) continue; const d2 = (r.x - x) ** 2 + (r.y + 1 - y) ** 2 + (r.z - z) ** 2; if (d2 < R2) this.net.sendTo(rid, { t: 'mc2eff', e: info.e, s: Math.round(info.sec * sc(d2)), l: info.lv }); }
    if (this.net.isHost) for (const rid of this.net.peers.keys()) if (rid !== fromId) this.net.sendTo(rid, { t: 'mc2spfx', p: [x, y, z], e: info.e });
    void c;
  };
  G.mc2SplashFx = function (x, y, z, e) {
    const c = (MC2_POT_RGB[e] || [200, 200, 255]).map(v => v / 255);
    this.particles.smoke(x, y, z, 26, c, true);
    for (let k = 0; k < 12; k++) this.particles.dust(x + (Math.random() - 0.5) * 3, y + Math.random(), z + (Math.random() - 0.5) * 3, c);
    this.sound.play('mc2shatter', x, y, z);
  };

  // ---------- 날씨: 천둥 번개 · 눈 ----------
  G.mc2SetThunder = function (on) {
    on = !!on; if (this.mc2Thunder === on) return;
    this.mc2Thunder = on;
    if (this.net.isHost) this.net.broadcast({ t: 'mc2wx', th: on ? 1 : 0 });
  };
  const _sr = G.setRain;
  G.setRain = function (v) {
    _sr.call(this, v);
    if (!v) this.mc2SetThunder(false);
    else if (!this._mc2NoAuto && Math.random() < 0.3) this.mc2SetThunder(true);
  };
  G.mc2Strike = function (x, y, z) {
    this.mc2BoltFx(x, y, z);
    if (this.net.isHost) this.net.broadcast({ t: 'mc2bolt', p: [x, y, z] });
    const w = this.world;
    for (const e of this.ents.list) if (e.type === 'mob' && !e.dead && !e.remote && (e.x - x) ** 2 + (e.z - z) ** 2 < 9 && Math.abs(e.y - y) < 4) this.damageEntity(e, 5, 0, 0, 'lightning');
    for (const pl of this.allPlayers()) if (!pl.dead && (pl.x - x) ** 2 + (pl.z - z) ** 2 < 9 && Math.abs(pl.y - y) < 4) this.hurtPlayer(pl, 3, 'lightning', (pl.x - x) * 0.5, (pl.z - z) * 0.5);
    if (!w.getBlock(x, y, z) && BLOCKS[w.getBlock(x, y - 1, z)] && BLOCKS[w.getBlock(x, y - 1, z)].solid && !IS_FLUID[w.getBlock(x, y - 1, z)] && this.worldRules.tntGrief !== false) {
      w.setBlock(x, y, z, BL.fire, 0); w.schedule(x, y, z, 100 + Math.random() * 120, 3);
    }
  };
  G.mc2BoltFx = function (x, y, z) {
    const p = this.player, d = Math.hypot(p.x - x, p.z - z);
    let seed = (x * 73856093 ^ z * 19349663 ^ (this.world.tick | 0)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pts = []; let bx = x + 0.5, bz = z + 0.5;
    for (let yy = y + 70; yy > y; yy -= 3) { pts.push([bx, yy, bz]); bx += (rnd() - 0.5) * 2.4; bz += (rnd() - 0.5) * 2.4; }
    pts.push([x + 0.5, y, z + 0.5]);
    const br = [], bi = 4 + (rnd() * 8 | 0);
    if (pts[bi]) { let [ax, ay, az] = pts[bi]; for (let k = 0; k < 5; k++) { br.push([ax, ay, az]); ax += (rnd() - 0.5) * 3; ay -= 2.5; az += (rnd() - 0.5) * 3; } }
    this._mc2Bolts.push({ pts, br, t: 0 });
    MC2FX.flash = Math.max(MC2FX.flash, d < 80 ? 1 : 0.5);
    const vol = clamp(1.2 - d / 120, 0.25, 1.1);
    setTimeout(() => { if (this.state === 'play') this.sound.play('mc2thunder', undefined, undefined, undefined, { vol }); }, Math.min(2500, d * 18));
    for (let k = 0; k < 10; k++) this.particles.smoke(x + 0.5, y + 0.5, z + 0.5, 2, [1, 1, 0.9], true);
    if (d < 24) this.advGrant('thunder');
  };
  // 비 그리기: 추운 곳은 하늘하늘 눈, 천둥 칠 때는 굵고 비스듬한 비
  G.buildRain = function (cam) {
    const b = this.rainBuf || (this.rainBuf = new MeshBuf(4096)); b.reset();
    const w = this.world, t = performance.now() / 1000, layer = T('white');
    const cx = Math.floor(cam[0]), cz = Math.floor(cam[2]), R = 12, storm = this.mc2Thunder ? 1 : 0;
    const cnt = Math.floor(this.rain * (3 + storm * 2));
    const V = (x, y, z, u, v, c) => b.vert(x, y, z, u, v, layer, 3, 255, 0, 255, 0, c[0], c[1], c[2]);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > R * R) continue;
      const x = cx + dx, z = cz + dz, bb = w.biomeAt(x, z);
      if (bb === 2 || bb === 13) continue;
      const top = w.heightAt(x, z), snow = mc2Cold(w, x, z, top);
      for (let k = 0; k < cnt; k++) {
        const h = hashInt(x, k, z, 5), speed = snow ? 2.2 : 14 + storm * 5, off = ((h & 1023) / 1023) * 24;
        const y = cam[1] + 12 - ((t * speed + off) % 24);
        if (y < top) continue;
        let px = x + ((h >> 10) & 255) / 255, pz = z + ((h >> 18) & 255) / 255;
        if (snow) { px += Math.sin(t * 1.3 + (h & 63)) * 0.35; pz += Math.cos(t * 1.1 + ((h >> 6) & 63)) * 0.35; }
        const len = snow ? 0.1 : 0.6 + storm * 0.25, wd = snow ? 0.09 : 0.02, sl = snow ? 0 : storm * 0.18;
        const rx = px - cam[0], ry = y - cam[1], rz = pz - cam[2];
        const col = snow ? [255, 255, 255] : storm ? [96, 110, 150] : [110, 130, 170];
        V(rx - wd, ry, rz, 0, 1, col); V(rx + wd, ry, rz, 1, 1, col); V(rx + wd + sl, ry + len, rz, 1, 0, col); V(rx - wd + sl, ry + len, rz, 0, 0, col);
        V(rx, ry, rz - wd, 0, 1, col); V(rx, ry, rz + wd, 1, 1, col); V(rx + sl, ry + len, rz + wd, 1, 0, col); V(rx + sl, ry + len, rz - wd, 0, 0, col);
      }
    }
    return b;
  };

  // ---------- 방장 틱 (20번/초): 양조 · 모닥불 요리 · 번개 · 눈 쌓이기 ----------
  const _wt = G.worldTick;
  G.worldTick = function () {
    _wt.call(this);
    const w = this.world; if (w.remote) return;
    w.mc2rain = w.dim === 'overworld' ? this.rain : 0;
    if (this.mc2Brews && this.mc2Brews.size) this.mc2TickBrew();
    if (w.tick % 5 === 0) this.mc2TickCamps();
    if (w.dim !== 'overworld') return;
    if (this.mc2Thunder && this.rainTarget === 0) this.mc2SetThunder(false);
    if (this.mc2Thunder && this.rain > 0.5 && Math.random() < 1 / 220) {
      const pls = this.allPlayers().filter(q => !q.dead), pl = pls[Math.random() * pls.length | 0];
      if (pl) {
        const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 36, x = Math.floor(pl.x + Math.cos(a) * d), z = Math.floor(pl.z + Math.sin(a) * d);
        const bb = w.biomeAt(x, z);
        if (w.isLoadedAt(x, z) && bb !== 2 && bb !== 13) this.mc2Strike(x, w.heightAt(x, z), z);
      }
    }
    if (this.rain > 0.5 && w.tick % 20 === 0) for (const pl of this.allPlayers()) for (let k = 0; k < 3; k++) {
      const x = Math.floor(pl.x + (Math.random() - 0.5) * 40), z = Math.floor(pl.z + (Math.random() - 0.5) * 40);
      if (!w.isLoadedAt(x, z)) continue;
      const h = w.heightAt(x, z); if (h <= 1 || h >= HEIGHT - 1 || !mc2Cold(w, x, z, h)) continue;
      const top = w.getBlock(x, h - 1, z);
      if (top === BL.water && w.getMeta(x, h - 1, z) === 0) { if (Math.random() < 0.3) w.setBlock(x, h - 1, z, BL.ice, 0); continue; }
      if (!w.getBlock(x, h, z) && (IS_OPAQUE[top] || (BLOCKS[top] && BLOCKS[top].wave === 1)) && (w.getLight(x, h, z) & 15) < 10) w.setBlock(x, h, z, BL.snow_layer, 0);
    }
  };
  G.mc2TickBrew = function () {
    const w = this.world, blaze = I('blaze_powder');
    for (const k of this.mc2Brews) {
      const be = w.be.get(k);
      if (!be || be.t !== 'brew') { this.mc2Brews.delete(k); continue; }
      const [x, y, z] = parseKey(k);
      if (!w.isLoadedAt(x, z)) continue;
      const it = be.items, ing = it[3];
      const can = !!ing && [0, 1, 2].some(i => mc2BrewResult(ing.id, it[i]));
      let changed = false;
      if ((be.fuel | 0) <= 0 && can && it[4] && it[4].id === blaze) { be.fuel = 20; it[4].n--; if (it[4].n <= 0) it[4] = null; changed = true; }
      if (can && be.fuel > 0) {
        if (be.ingId !== ing.id) { be.ingId = ing.id; be.prog = 0; }
        be.prog = (be.prog | 0) + 1;
        if (be.prog >= MC2_BREW_TIME) {
          be.prog = 0;
          for (let i = 0; i < 3; i++) { const r = mc2BrewResult(ing.id, it[i]); if (r) it[i] = r; }
          ing.n--; if (ing.n <= 0) it[3] = null;
          be.fuel--; changed = true;
          this.sfx('mc2brew', x + 0.5, y + 0.6, z + 0.5);
        }
      } else if (be.prog) { be.prog = 0; changed = true; }
      const bits = (mc2IsBottle(it[0]) ? 1 : 0) | (mc2IsBottle(it[1]) ? 2 : 0) | (mc2IsBottle(it[2]) ? 4 : 0);
      if (w.getBlock(x, y, z) === BL.brewing_stand && (w.getMeta(x, y, z) & 7) !== bits) w.setBlock(x, y, z, BL.brewing_stand, bits, 2);
      if (changed) { if (this.net.isHost) this.net.broadcast({ t: 'be', k, v: be }); }
      else if (this.net.isHost && w.tick % 10 === 0 && be.prog > 0) this.net.broadcast({ t: 'be', k, v: be });
    }
  };
  G.mc2TickCamps = function () {
    const w = this.world;
    for (const k of this.mc2Camps) {
      const be = w.be.get(k); if (!be || be.t !== 'camp') continue;
      const [x, y, z] = parseKey(k);
      if (w.getBlock(x, y, z) !== BL.campfire) continue;
      if (w.getMeta(x, y, z) & 8) continue;
      let changed = false;
      for (let i = 0; i < 4; i++) {
        const s = be.items[i]; if (!s) continue;
        be.cook[i] = (be.cook[i] | 0) + 5;
        if (be.cook[i] >= 300) {
          const res = SMELT[s.id]; be.items[i] = null; be.cook[i] = 0; changed = true;
          if (res !== undefined) this.dropItem(x + 0.5, y + 0.6, z + 0.5, { id: res, n: 1 }, [(Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2]);
          this.sfx('pop', x + 0.5, y + 0.6, z + 0.5);
          for (const pl of this.allPlayers()) if ((pl.x - x) ** 2 + (pl.z - z) ** 2 < 100) { if (pl === this.player) this.advGrant('campfire'); }
        }
      }
      if (changed && this.net.isHost) this.net.broadcast({ t: 'be', k, v: be });
    }
  };

  // ---------- 매 프레임 (모두): 효과 · HUD · 음악 · 연기 · 번개 · 배 불러오기 ----------
  const _upd = G.update;
  G.update = function (dt) {
    _upd.call(this, dt);
    if (this.state === 'play' && this.player) this.mc2Tick(dt);
  };
  G.mc2Tick = function (dt) {
    const p = this.player, w = this.world, fx = p.mc2fx || (p.mc2fx = {});
    // 효과 시간
    MC2FX.nv = 0;
    for (const k in fx) { fx[k].t -= dt; if (fx[k].t <= 0) { delete fx[k]; this._mc2HudK = null; } }
    if (fx.regen) { p._mc2rg = (p._mc2rg || 0) + dt; if (p._mc2rg >= 2.5 / fx.regen.l) { p._mc2rg = 0; if (!p.dead && p.health < 20) p.heal(1); } }
    if (fx.poison && !p.creative) { p._mc2ps = (p._mc2ps || 0) + dt; if (p._mc2ps >= 1.25 / fx.poison.l) { p._mc2ps = 0; if (!p.dead && p.health > 1) { p.health -= 1; this.hurtFx = 0.5; } } }
    if (fx.night_vision) MC2FX.nv = Math.min(1, fx.night_vision.t / 3);
    MC2FX.flash = Math.max(0, MC2FX.flash - dt * 2.2);
    if (Object.keys(fx).length && Math.random() < dt * 3 && this.view !== 0) { const ks = Object.keys(fx), c = EFFECTS[ks[Math.random() * ks.length | 0]].col; this.particles.dust(p.x + (Math.random() - 0.5) * 0.8, p.y + 0.3 + Math.random() * 1.4, p.z + (Math.random() - 0.5) * 0.8, [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255]); }
    this.mc2Hud();
    // 번개
    for (let i = this._mc2Bolts.length - 1; i >= 0; i--) { const bo = this._mc2Bolts[i]; bo.t += dt; if (bo.t > 0.5) this._mc2Bolts.splice(i, 1); }
    // 그림 개체를 플레이어 곁에
    if (this._mc2Ov) { this._mc2Ov.x = p.x; this._mc2Ov.y = p.y; this._mc2Ov.z = p.z; if (this._mc2Ov.dead) this._mc2Ov = null; }
    else if (this.ents && Mc2Overlay) this._mc2Ov = this.ents.add(new Mc2Overlay());
    // 0.5초마다 가까운 블록 엔티티 목록
    this._mc2NearT -= dt;
    if (this._mc2NearT <= 0) {
      this._mc2NearT = 0.5;
      const N = this._mc2Near = { signs: [], camps: [], jukes: [], brews: [] };
      for (const [k, v] of w.be) {
        if (!v || (v.t !== 'sign' && v.t !== 'camp' && v.t !== 'juke' && v.t !== 'brew')) continue;
        const [x, y, z] = parseKey(k), d2 = (x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2;
        if (v.t === 'sign' && d2 < 14 * 14 && v.text) N.signs.push([x, y, z, v.text, w.getMeta(x, y, z)]);
        else if (v.t === 'camp' && d2 < 32 * 32) N.camps.push([x, y, z, v]);
        else if (v.t === 'juke' && d2 < 40 * 40) N.jukes.push([k, x, y, z, v.disc]);
        else if (v.t === 'brew' && d2 < 24 * 24 && v.prog > 0) N.brews.push([x, y, z]);
      }
      // 주크박스: 새로 들어온 음반은 처음부터, 빠진 것은 멈춤
      const seen = new Set();
      for (const [k, x, y, z, disc] of N.jukes) {
        if (!disc || !ITEMS[disc] || ITEMS[disc].disc === undefined) continue;
        seen.add(k);
        const cur = this.mc2Juke.get(k);
        if (!cur || cur.disc !== disc) this.mc2Juke.set(k, { disc, si: ITEMS[disc].disc, t: 0, i: 0, x, y, z });
      }
      for (const k of [...this.mc2Juke.keys()]) if (!seen.has(k)) this.mc2Juke.delete(k);
      // 배 다시 불러오기 (방장·혼자)
      const pend = this.mc2BoatStore && this.mc2BoatStore[w.dim];
      if (pend && pend.length && !w.remote && Mc2Boat) for (let i = pend.length - 1; i >= 0; i--) { const s = pend[i]; if (!w.isLoadedAt(Math.floor(s[0]), Math.floor(s[2]))) continue; this.ents.add(new Mc2Boat(s[0], s[1] + 0.05, s[2], s[3])); pend.splice(i, 1); }
      // 음반 수집
      if (this.found && this.stats) { let n = 0; for (let i = 0; i < 3; i++) if (this.found.has(414 + i)) n++; this.stats.mc2discs = n; }
    }
    // 음악
    for (const J of this.mc2Juke.values()) {
      const ev = mc2SongEvents(J.si), S = MC2_SONGS[J.si];
      if (J.t > S.len + 1) continue;
      J.t += dt;
      while (J.i < ev.length && ev[J.i][0] <= J.t) {
        const e = ev[J.i++];
        this.sound.play('mc2note', J.x + 0.5, J.y + 0.5, J.z + 0.5, { note: e[1], inst: e[2], vol: e[3] });
        if (e[2] === S.inst && Math.random() < 0.6) this.particles.add({ x: J.x + 0.5 + (Math.random() - 0.5) * 0.6, y: J.y + 1.1, z: J.z + 0.5 + (Math.random() - 0.5) * 0.6, vx: 0, vy: 0.9, vz: 0, life: 1, size: 0.09, layer: T('white'), u: 0, v: 0, g: 0, tint: [Math.random(), 0.8, 1 - Math.random() * 0.5], emissive: true });
      }
    }
    // 모닥불 연기 · 양조 거품
    this._mc2Smoke = (this._mc2Smoke || 0) - dt;
    if (this._mc2Smoke <= 0) {
      this._mc2Smoke = 0.14;
      for (const k of this.mc2Camps) {
        const [x, y, z] = parseKey(k);
        if ((x - p.x) ** 2 + (z - p.z) ** 2 > 40 * 40) continue;
        if (w.getBlock(x, y, z) !== BL.campfire) { this.mc2Camps.delete(k); continue; }
        if (w.getMeta(x, y, z) & 8) continue;
        this.particles.add({ x: x + 0.3 + Math.random() * 0.4, y: y + 0.6, z: z + 0.3 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.2, vy: 1.3 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.2, life: 2.6, size: 0.05 + Math.random() * 0.05, layer: T('white'), u: 0, v: 0, g: -0.15, tint: [0.6, 0.6, 0.64] });
        if (Math.random() < 0.3) this.particles.add({ x: x + 0.5, y: y + 0.3, z: z + 0.5, vx: (Math.random() - 0.5), vy: 1.6, vz: (Math.random() - 0.5), life: 0.5, size: 0.04, layer: T('white'), u: 0, v: 0, g: 0, tint: [1, 0.6, 0.2], emissive: true });
      }
      if (this._mc2Near) for (const [x, y, z] of this._mc2Near.brews) this.particles.dust(x + 0.3 + Math.random() * 0.4, y + 0.5, z + 0.3 + Math.random() * 0.4, [0.9, 0.6, 1]);
    }
  };
  // 효과 HUD
  G.mc2Hud = function () {
    if (typeof document === 'undefined') return;
    const now = performance.now();
    if (this._mc2HudT && now - this._mc2HudT < 250 && this._mc2HudK !== null) return;
    this._mc2HudT = now;
    let el = this._mc2HudEl;
    if (!el || !el.isConnected) { mc2Css(); el = this._mc2HudEl = document.createElement('div'); el.id = 'mc2-fx'; const hud = document.getElementById('hud'); if (!hud) return; hud.appendChild(el); }
    const fx = this.player.mc2fx || {}, ks = Object.keys(fx);
    const key = ks.map(k => k + fx[k].l + ':' + Math.ceil(fx[k].t)).join('|');
    if (key === this._mc2HudK) return;
    this._mc2HudK = key;
    el.innerHTML = ks.map(k => { const E = EFFECTS[k], f = fx[k]; return `<div class="fx${f.t < 10 ? ' end' : ''}" style="--c:${E.col}"><i>${E.ic}</i>${esc(E.k)}${MC2_ROMAN[f.l] !== undefined ? MC2_ROMAN[f.l] : ' ' + f.l}<small>${mc2Fmt(f.t)}</small></div>`; }).join('');
    const bb = document.getElementById('bossbar'); document.body.classList.toggle('boss', !!(bb && bb.classList.contains('show')));
  };
  // 화면 장식: 모닥불 위 음식 · 번개
  G.mc2RenderOverlay = function (R, cam) {
    const N = this._mc2Near;
    if (N) for (const [x, y, z, be] of N.camps) {
      for (let i = 0; i < 4; i++) {
        const s = be.items && be.items[i]; if (!s || !ITEMS[s.id]) continue;
        const mesh = this.itemMesh(s.id), m = M4.create();
        const ox = i % 2 ? 0.72 : 0.28, oz = i < 2 ? 0.28 : 0.72;
        M4.translate(m, x + ox - cam[0], y + 0.47 - cam[1], z + oz - cam[2]);
        M4.mul(m, m, M4.rotY(M4.create(), i * 1.57));
        M4.mul(m, m, M4.rotX(M4.create(), -Math.PI / 2));
        const sm = M4.create(); sm[0] = sm[5] = sm[10] = 0.32; M4.mul(m, m, sm);
        this.frame.blockEnts.push({ mesh, model: m, light: [1, 1] });
      }
    }
    for (const bo of this._mc2Bolts) {
      const on = bo.t < 0.12 || (bo.t > 0.2 && bo.t < 0.3) || (bo.t > 0.38 && bo.t < 0.44);
      if (!on) continue;
      const draw = (pts, th) => {
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i], b = pts[i + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.6);
          for (let k = 0; k < n; k++) {
            const tt = k / n, m = M4.create();
            M4.translate(m, a[0] + (b[0] - a[0]) * tt - cam[0], a[1] + (b[1] - a[1]) * tt - cam[1], a[2] + (b[2] - a[2]) * tt - cam[2]);
            R.ent.addBox(m, -th, -0.35, -th, th, 0.35, th, [0.92, 0.95, 1.0], 1, 1);
          }
        }
      };
      draw(bo.pts, 0.12); if (bo.br.length) draw(bo.br, 0.07);
    }
  };

  // ---------- 명령어 ----------
  const _cmd = G.command;
  G.command = function (line) {
    const a = line.trim().slice(1).split(/\s+/), cmd = (a[0] || '').toLowerCase(), say = (t, c) => this.ui.chatLine(t, c || '#aee');
    if (cmd === 'effect' || cmd === '효과') {
      const s = (a[1] || '').toLowerCase();
      if (!s || s === 'list' || s === '목록') { say('효과: ' + Object.keys(EFFECTS).map(k => `${k}(${EFFECTS[k].k})`).join(', ')); say('사용법: /effect 이름 [초] [레벨] · /effect clear'); return; }
      if (s === 'clear' || s === '지우기') { this.clearEffects(); say('모든 효과를 지웠어요'); return; }
      const key = mc2EffKey(a[1]); if (!key) { say('그런 효과가 없어요: ' + a[1] + ' (/effect list)', '#f88'); return; }
      const sec = parseInt(a[2]) || 30, lv = parseInt(a[3]) || 1;
      this.giveEffect(this.player, key, sec, lv);
      say(`${EFFECTS[key].ic} ${EFFECTS[key].k}${MC2_ROMAN[clamp(lv, 1, 5)]} ${EFFECTS[key].instant ? '' : mc2Fmt(clamp(sec, 1, 3600))}`); return;
    }
    if (cmd === 'weather') {
      const v = (a[1] || '').toLowerCase();
      if (this.world.remote) return _cmd.call(this, line);
      if (v === 'thunder' || v === '천둥' || v === '번개') { this._mc2NoAuto = true; this.setRain(1); this._mc2NoAuto = false; this.mc2SetThunder(true); say('⛈ 천둥 번개!'); return; }
      this._mc2NoAuto = true; const r = _cmd.call(this, line); this._mc2NoAuto = false;
      if (v === 'rain' || v === '비') this.mc2SetThunder(false);
      return r;
    }
    if (cmd === 'help' || cmd === '도움말') { const r = _cmd.call(this, line); say('원작 2판: /effect 이름|clear [초] [레벨] (효과 목록: /effect list), /weather thunder (천둥 번개)'); return r; }
    return _cmd.call(this, line);
  };
}

// ---------------- 월드: 네더 사마귀 자람 · 가마솥 빗물 · 눈 녹기 · 요새 사마귀 밭 ----------------
if (typeof World !== 'undefined') {
  const _rt = World.prototype.randomTickBlock;
  World.prototype.randomTickBlock = function (x, y, z, id, meta, light) {
    if (id === BL.nether_wart) { if ((meta & 3) < 3 && Math.random() < 0.15) this.setBlock(x, y, z, id, (meta & 3) + 1); return; }
    if (id === BL.cauldron) { if ((meta & 3) < 3 && this.mc2rain > 0.5 && Math.random() < 0.08 && (this.getLight(x, y + 1, z) >> 4) >= 15) this.setBlock(x, y, z, id, (meta & 3) + 1); return; }
    if (id === BL.snow_layer) { if ((this.getLight(x, y, z) & 15) >= 12 || !mc2Cold(this, x, z, y)) this.setBlock(x, y, z, 0, 0); return; }
    return _rt.call(this, x, y, z, id, meta, light);
  };
  const _df = World.prototype.drawFortress;
  if (_df) World.prototype.drawFortress = function (c, ox, oz) {
    _df.call(this, c, ox, oz);
    if ((this.mc2gen | 0) < 1) return;   // 이번 판 이전에 만든 세계는 그대로
    const ids = c.ids, meta = c.meta, bx = c.cx * 16, bz = c.cz * 16, FY = NETHER_FORTRESS_Y;
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const rx = bx + x - ox, rz = bz + z - oz;
      if (rz < -4 || rz > -2 || !((rx >= -4 && rx <= -2) || (rx >= 2 && rx <= 4))) continue;
      ids[CI(x, FY, z)] = BL.soul_sand; meta[CI(x, FY, z)] = 0;
      ids[CI(x, FY + 1, z)] = BL.nether_wart; meta[CI(x, FY + 1, z)] = 3;
    }
  };
}

// =====================================================================
// 화면: 양조기 · 모루 · 표지판 · 물약 설명 · 표지판 글씨
// =====================================================================
if (typeof UI !== 'undefined') {
  const U = UI.prototype;
  U.openBrewing = function (x, y, z) {
    const g = this.g, w = g.world, k = fmtKey(x, y, z);
    if (this.modal) return;
    let be = w.be.get(k);
    if (!be || be.t !== 'brew') { if (w.remote) g.net.send({ t: 'beReq', k }); g.createContainer(x, y, z, BL.brewing_stand); be = w.be.get(k); }
    mc2Css();
    this.beginModal('container');
    this.container = k; this.furnace = false; this.furnaceEls = null;
    const s = this.screen('inv-screen', `<div class="inv-panel mc2-panel" id="ip-main"><button class="inv-close" id="ip-x">✕</button><h4>🧪 양조기</h4>
      <div class="mc2-brew"><div class="lbl">연료<br>(블레이즈 가루)</div><div id="br-ing"></div><div class="lbl">재료</div>
      <div id="br-fuel" style="display:flex;gap:6px;align-items:center"></div><div class="mc2-bar prog" id="br-prog"><div></div></div><div></div>
      <div></div><div class="mc2-bottles" id="br-bot"></div><div class="lbl">물병·물약<br>3칸</div></div>
      <p class="muted" style="font-size:13px;margin:4px 0 0;max-width:460px">① 빈 병으로 물을 떠 물병을 만들어요 ② 물병 + <b>네더 사마귀</b> = 어색한 물약 ③ 어색한 물약 + 설탕(신속)·슬라임 볼(도약)·가스트 눈물(재생)·반짝이는 수박(치유)·황금 당근(야간 투시)·마그마 크림(화염 저항)·생대구(수중 호흡)·블레이즈 가루(힘)·깃털(느린 낙하) ④ 레드스톤 = 오래가게, 발광석 = 더 세게, 화약 = 던지는 물약</p>
      <div id="br-inv" style="margin-top:10px"></div></div>`);
    const items = () => { const b = w.be.get(k); return b && b.items ? b.items : [null, null, null, null, null]; };
    const fuelBox = $('#br-fuel', s);
    this.mountSlot(fuelBox, Object.assign(this.ref(items, 4), { container: true, dynamic: true, accept: it => it.id === I('blaze_powder') }));
    const fb = document.createElement('div'); fb.className = 'mc2-bar'; fb.innerHTML = '<div></div>'; fuelBox.appendChild(fb);
    this.mountSlot($('#br-ing', s), Object.assign(this.ref(items, 3), { container: true, dynamic: true, accept: it => mc2IsIng(it) }));
    for (let i = 0; i < 3; i++) this.mountSlot($('#br-bot', s), Object.assign(this.ref(items, i), { container: true, dynamic: true, accept: it => mc2IsBottle(it) }));
    this.mc2BrewEls = { fuel: fb.firstChild, prog: $('#br-prog', s).firstChild };
    this.buildPlayerInv($('#br-inv', s));
    $('#ip-x', s).onclick = () => this.closeModal();
    this.show('inv-screen');
    this.mc2BrewBars();
  };
  U.mc2BrewBars = function () {
    const E = this.mc2BrewEls; if (!E || this.modal !== 'container') return;
    const be = this.g.world.be.get(this.container); if (!be || be.t !== 'brew') return;
    E.fuel.style.height = Math.min(100, (be.fuel | 0) * 5) + '%';
    E.prog.style.height = ((be.prog | 0) / MC2_BREW_TIME * 100) + '%';
  };
  const _rs = U.refreshSlots;
  U.refreshSlots = function (only) { _rs.call(this, only); if (this.mc2BrewEls) this.mc2BrewBars(); };
  const _cm = U.closeModal;
  U.closeModal = function (noLock) { this.mc2BrewEls = null; return _cm.call(this, noLock); };

  // 모루
  U.openAnvil = function () {
    const g = this.g;
    if (this.modal) return;
    mc2Css();
    this.beginModal('anvil');
    this.craftGrid = [null, null];
    const s = this.screen('inv-screen', `<div class="inv-panel mc2-panel" id="ip-main"><button class="inv-close" id="ip-x">✕</button><h4>🔨 모루 <span class="muted" id="an-lv"></span></h4>
      <div class="mc2-an"><div id="an-a"></div><span class="plus">＋</span><div id="an-b"></div><span class="plus">➜</span><div class="mc2-an-res" id="an-res"></div></div>
      <p class="muted" style="font-size:13px;margin:6px 0 0">왼쪽: 고칠 도구·무기·갑옷 · 오른쪽: 똑같은 물건(합치기, 마법도 합쳐져요) 또는 재료(판자·조약돌·철·금·다이아·가죽…)</p>
      <div id="an-inv" style="margin-top:10px"></div></div>`);
    this.mountSlot($('#an-a', s), Object.assign(this.ref(() => this.craftGrid, 0), { container: true, accept: it => !!(ITEMS[it.id] && ITEMS[it.id].dur) }));
    this.mountSlot($('#an-b', s), Object.assign(this.ref(() => this.craftGrid, 1), { container: true }));
    this.buildPlayerInv($('#an-inv', s));
    $('#ip-x', s).onclick = () => this.closeModal();
    this.mc2RenderAnvil();
    this.show('inv-screen');
  };
  U.mc2RenderAnvil = function () {
    const box = $('#an-res'); if (!box) return;
    const g = this.g, p = g.player, [a, b] = this.craftGrid || [];
    $('#an-lv').textContent = p.creative ? '(크리에이티브)' : `· 내 레벨 ${p.xpLv || 0}`;
    const r = mc2AnvilCalc(a, b);
    box.innerHTML = '';
    if (!r) { box.innerHTML = '<p class="muted">고칠 물건을 왼쪽 칸에 넣어요.</p>'; return; }
    if (r.err) { box.innerHTML = `<p class="muted">${esc(r.err)}</p>`; return; }
    const sl = this.slotEl(); box.appendChild(sl); this.drawSlot(sl, r.out);
    const ok = p.creative || (p.xpLv || 0) >= r.cost;
    const btn = document.createElement('button'); btn.className = 'btn primary' + (ok ? '' : ' off');
    const D = ITEMS[r.out.id].dur;
    btn.innerHTML = `🔨 ${b && b.id === a.id ? '합치기' : '고치기'} <small>(내구도 ${D - (r.out.d | 0)}/${D} · 레벨 ${r.cost})</small>`;
    btn.onclick = () => {
      if (!ok) { this.toast(`경험치 레벨이 ${r.cost} 필요해요 (지금 ${p.xpLv || 0})`); return; }
      if (!p.creative) p.spendLevels(r.cost);
      this.craftGrid[0] = r.out;
      const bb = this.craftGrid[1]; bb.n -= r.useB; if (bb.n <= 0) this.craftGrid[1] = null;
      g.sound.play('mc2anvil'); g.particles.dust(p.x, p.y + 1.4, p.z, [1, 0.8, 0.4]);
      this.toast(`🔨 ${itemName(r.out.id)}을(를) 고쳤어요!`, 1600); g.advGrant('anvil');
      this.refreshSlots(); this.mc2RenderAnvil();
    };
    box.appendChild(btn);
  };
  const _asc = U.afterSlotChange;
  U.afterSlotChange = function (r) { _asc.call(this, r); if (this.modal === 'anvil') this.mc2RenderAnvil(); };

  // 표지판 쓰기
  U.openSign = function (x, y, z) {
    const g = this.g, w = g.world, k = fmtKey(x, y, z);
    if (this.modal || w.getBlock(x, y, z) !== BL.oak_sign) return;
    mc2Css();
    const be = w.be.get(k);
    this.beginModal('sign');
    const s = this.screen('mc2-sign', `<div class="panel narrow mc2-sign-panel"><h2>🪧 표지판</h2><p class="muted">표지판에 쓸 글을 적어요 (3줄, 한 줄에 20자). 가까이 오면 모두에게 보여요.</p>
      <textarea id="sg-t" maxlength="64" rows="3" placeholder="예) 우리 집 🏠"></textarea>
      <div class="row"><button class="btn" id="sg-x">닫기</button><span style="flex:1"></span><button class="btn primary" id="sg-ok">✔ 저장 (Enter)</button></div></div>`);
    const ta = $('#sg-t', s); ta.value = be && be.text || '';
    const save = () => {
      const text = ta.value.split('\n').slice(0, 3).map(l => l.slice(0, 20)).join('\n').trim();
      if (w.getBlock(x, y, z) === BL.oak_sign) { g.mc2SetBe(k, { t: 'sign', text }); g._mc2NearT = 0; if (text) g.advGrant('sign'); }
      this.closeModal();
    };
    ta.addEventListener('keydown', e => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } else if (e.key === 'Escape') { e.preventDefault(); this.closeModal(); } e.stopPropagation(); });
    $('#sg-ok', s).onclick = save; $('#sg-x', s).onclick = () => this.closeModal();
    this.show('mc2-sign');
    setTimeout(() => ta.focus(), 40);
  };

  // 물약 설명 · 투척 물약 색 점
  const _tip = U.showTip;
  U.showTip = function (r) {
    _tip.call(this, r);
    const it = r.tipItem ? r.tipItem() : r.get(), info = mc2PotInfo(it);
    if (info && this.tip.style.display === 'block') { this.tip.insertAdjacentHTML('beforeend', `<small style="color:${info.E.col};font-weight:700">${info.E.ic} ${esc(mc2PotLabel(info))}</small>`); this.placeTip(); }
  };
  const _ds = U.drawSlot;
  U.drawSlot = function (el, it) {
    _ds.call(this, el, it);
    const info = it ? mc2PotInfo(it) : null, show = !!(info && (info.splash || info.bits));
    let dot = el._mc2dot;
    if (!show) { if (dot) dot.style.display = 'none'; return; }
    if (!dot) { mc2Css(); dot = el._mc2dot = document.createElement('em'); dot.className = 'mc2-dot'; el.appendChild(dot); }
    dot.style.display = ''; dot.style.background = info.E.col; dot.textContent = info.bits & 2 ? '2' : info.bits & 1 ? '+' : '';
  };
  const _hn = U.showHeldName;
  U.showHeldName = function () {
    _hn.call(this);
    const it = this.g.player && this.g.player.held, info = mc2PotInfo(it);
    if (info) { const el = $('#held-name'); if (el) el.textContent = itemName(it.id) + ' · ' + mc2PotLabel(info); }
  };
  // 표지판 글씨 (이름표처럼 화면에 띄움)
  const _nt = U.updateNameTags;
  U.updateNameTags = function (cam) {
    _nt.call(this, cam);
    const g = this.g, N = g._mc2Near, R = g.renderer;
    let box = this._mc2Signs;
    if (!box || !box.isConnected) { const hud = document.getElementById('hud'); if (!hud) return; mc2Css(); box = this._mc2Signs = document.createElement('div'); box.id = 'mc2-signs'; hud.appendChild(box); }
    const list = N ? N.signs : [];
    while (box.children.length < list.length) { const d = document.createElement('div'); d.className = 'sg'; box.appendChild(d); }
    while (box.children.length > list.length) box.lastChild.remove();
    list.forEach(([x, y, z, text, m], i) => {
      const el = box.children[i], f = (m & 7) < 2 ? 2 : m & 7, wall = m & 8;
      const px = x + 0.5 + (wall ? -DX[f] * 0.3 : 0), pz = z + 0.5 + (wall ? -DZ[f] * 0.3 : 0), py = y + (wall ? 0.95 : 1.15);
      const pr = R.project([px - cam[0], py - cam[1], pz - cam[2]]);
      if (!pr || pr[2] > 14) { el.style.display = 'none'; return; }
      el.style.display = ''; el.style.left = pr[0] + 'px'; el.style.top = pr[1] + 'px';
      el.style.opacity = pr[2] > 10 ? Math.max(0.2, (14 - pr[2]) / 4) : 1;
      if (el._t !== text) { el._t = text; el.textContent = text; }
    });
  };
}
// 모루 계산
function mc2RepairMat(A) {
  const n = A.name;
  if (/^wood_/.test(n) || n === 'shield') return GROUPS.planks;
  if (/^stone_/.test(n)) return [BL.cobblestone, BL.cobbled_deepslate].filter(v => v !== undefined);
  if (/^iron_|shears|flint_and_steel/.test(n)) return [I('iron_ingot')];
  if (/^gold_|^golden_/.test(n)) return [I('gold_ingot')];
  if (/^diamond_/.test(n)) return [I('diamond')];
  if (/^leather_/.test(n)) return [I('leather')];
  if (n === 'turtle_helmet') return [I('turtle_scute')];
  if (n === 'cloud_boots') return [BL.cloud_block];
  if (n === 'bow' || n === 'fishing_rod') return [I('string')];
  return null;
}
function mc2MergeEnch(a, b) {
  if (!a && !b) return null;
  const o = Object.assign({}, a || {});
  for (const k in b || {}) { const la = o[k] | 0, lb = b[k] | 0, max = typeof ENCH !== 'undefined' && ENCH[k] ? ENCH[k].max : 5; o[k] = la === lb ? Math.min(max, la + 1) : Math.max(la, lb); }
  return Object.keys(o).length ? o : null;
}
function mc2AnvilCalc(a, b) {
  if (!a) return null;
  const A = ITEMS[a.id]; if (!A || !A.dur) return { err: '고칠 수 있는 건 도구·무기·갑옷이에요' };
  if (!b) return { err: '오른쪽 칸에 같은 물건이나 재료를 넣어요' };
  const dur = A.dur, da = a.d | 0;
  if (b.id === a.id) {
    const rem = (dur - da) + (dur - (b.d | 0)) + Math.floor(dur * 0.12), out = { id: a.id, n: 1 }, nd = Math.max(0, dur - rem);
    if (nd) out.d = nd;
    const e = mc2MergeEnch(a.e, b.e); if (e) out.e = e;
    return { out, useB: 1, cost: Math.min(5, 1 + (e ? Object.keys(e).length : 0)) };
  }
  const mat = mc2RepairMat(A);
  if (mat && mat.includes(b.id)) {
    if (!da) return { err: '이미 새것처럼 튼튼해요!' };
    const per = Math.ceil(dur / 4), need = Math.min(b.n, Math.ceil(da / per)), out = Object.assign({}, a);
    out.d = Math.max(0, da - need * per); if (!out.d) delete out.d;
    return { out, useB: need, cost: 1 };
  }
  return { err: `${A.k}에는 이 재료를 쓸 수 없어요` };
}

// =====================================================================
// 멀티: 배 · 개체 상태 · 메시지 (방장 기준)
// =====================================================================
if (typeof entityNetState === 'function') {
  const _ens = entityNetState;
  entityNetState = function (e) {
    if (Mc2Boat && e instanceof Mc2Boat) { const r3 = (v) => Math.round(v * 100) / 100; return [e.eid, ETYPE_CODES.indexOf('cart'), r3(e.x), r3(e.y), r3(e.z), r3(e.yaw), 'boat', 0, 0]; }
    return _ens(e);
  };
}
if (typeof NetEntity !== 'undefined') {
  const _ner = NetEntity.prototype.render;
  NetEntity.prototype.render = function (g, R, cam) {
    if (this.type === 'cart' && this.sub === 'boat') { this.w = 1.25; this.h = 0.55; mc2RenderBoat(this, g, R, cam, this.walk || 0); return; }
    return _ner.call(this, g, R, cam);
  };
}
if (typeof Net !== 'undefined') {
  const N = Net.prototype;
  const _hd = N.onHostData;
  N.onHostData = function (id, data) {
    const g = this.g, m = data;
    if (m && g.world) switch (m.t) {
      case 'mc2splash': if (Array.isArray(m.p) && m.it) g.mc2Splash(+m.p[0], +m.p[1], +m.p[2], { id: m.it.id | 0, n: 1, d: m.it.d | 0 }, id); return;
      case 'mc2boat': if (Mc2Boat && Array.isArray(m.p)) g.ents.add(new Mc2Boat(+m.p[0], +m.p[1], +m.p[2], +m.yaw || 0)); return;
      case 'mc2snd': if (Array.isArray(m.p) && /^mc2/.test(m.n)) { g.sound.play(m.n, m.p[0], m.p[1], m.p[2]); this.broadcast({ t: 'snd', n: m.n, p: m.p }, id); } return;
      case 'mc2fxm': { const e = g.ents.byId.get(m.eid); if (e && e.type === 'mob') g.giveEffect(e, m.e, m.s, m.l); return; }
    }
    const r = _hd.call(this, id, data);
    if (m && m.t === 'hello' && g.remotes.has(id)) this.sendTo(id, { t: 'mc2wx', th: g.mc2Thunder ? 1 : 0, gen: g.mc2Gen | 0 });
    return r;
  };
  const _cd = N.onClientData;
  N.onClientData = function (data) {
    const g = this.g, m = data;
    if (m && m.t === 'welcome') g._mc2NetGen = 0;
    if (m) switch (m.t) {
      case 'mc2wx': g.mc2Thunder = !!m.th; if (m.gen !== undefined) { g._mc2NetGen = m.gen | 0; if (g.world && g.world.remote) { g.mc2Gen = m.gen | 0; g.world.mc2gen = m.gen | 0; } } return;
      case 'mc2bolt': if (g.world && g.state === 'play' && Array.isArray(m.p)) g.mc2BoltFx(m.p[0], m.p[1], m.p[2]); return;
      case 'mc2eff': if (g.player) { if (m.clear) g.clearEffects(); else g.giveEffect(g.player, m.e, m.s, m.l); } return;
      case 'mc2spfx': if (g.world && g.particles && Array.isArray(m.p)) g.mc2SplashFx(m.p[0], m.p[1], m.p[2], m.e); return;
    }
    return _cd.call(this, data);
  };
}

// =====================================================================
// 도전 과제 (11장 + 다른 장에 몇 개)
// =====================================================================
if (typeof ACH_LIST !== 'undefined') {
  const li = CHAPTERS.findIndex(c => c[0] === 'legend');
  CHAPTERS.splice(li < 0 ? CHAPTERS.length : li, 0, ['brew', '🧪 11장 · 물약과 꾸미기', '양조기로 물약을 만들고, 집을 예쁘게 꾸미고, 음악을 틀어요']);
  const NEW = [
    ['brew_stand', 'brew', 'basic', 'brewing_stand', '꼬마 연금술사', '양조기를 만들어요', '블레이즈 막대 1 + 조약돌 3. 블레이즈는 지옥 요새에 살아요.', { items: ['brewing_stand'] }],
    ['wart', 'brew', 'basic', 'nether_wart', '지옥 농부', '네더 사마귀를 얻어요', '지옥 요새의 영혼 모래 밭이나 보물 상자, 성직자 주민에게서!', { items: ['nether_wart'] }],
    ['awkward', 'brew', 'basic', 'awkward_potion', '첫 물약', '어색한 물약을 만들어요', '빈 병으로 물을 떠서 양조기에 넣고, 위 칸에 네더 사마귀!', { items: ['awkward_potion'], need: ['brew_stand'] }],
    ['drink', 'brew', 'basic', 'potion_speed', '꿀꺽!', '효과가 있는 물약을 마셔요', '물약을 들고 오른쪽 버튼을 꾹 눌러요.', {}],
    ['milk', 'brew', 'basic', 'milk_bucket', '우유 한 잔', '우유를 마셔 효과를 모두 지워요', '빈 양동이로 소를 우클릭!', {}],
    ['splash', 'brew', 'hard', 'splash_potion', '던져라 물약!', '투척 물약을 던져요', '물약 + 화약을 양조기에 넣어요.', { need: ['awkward'] }],
    ['effects6', 'brew', 'hero', 'potion_regen', '효과 수집가', '서로 다른 효과 6가지를 받아요', '신속·도약·재생·야간 투시·힘·느린 낙하…', { stat: ['mc2effKinds', 6], need: ['drink'] }],
    ['effects10', 'brew', 'legend', 'potion_invis', '전설의 연금술사', '물약 효과 10가지를 모두 받아요', '투명화는 야간 투시 물약 + 발효된 거미 눈!', { stat: ['mc2effKinds', 10], need: ['effects6'], hide: true }],
    ['decor', 'brew', 'basic', 'lantern', '꾸미기 시작', '꾸미기 블록을 놓아요', '유리판·랜턴·꽃 화분·울타리 문…', { any: true }],
    ['decor8', 'brew', 'hard', 'flower_pot', '꾸미기 장인', '서로 다른 꾸미기 블록 8종을 놓아요', '색유리·담장·모닥불·종·케이크도 꾸미기 블록이에요.', { stat: ['mc2decorKinds', 8], need: ['decor'], any: true }],
    ['sign', 'brew', 'basic', 'oak_sign', '표지판 작가', '표지판에 글을 써요', '판자 6 + 막대기 1. 놓으면 바로 글을 쓸 수 있어요.', { any: true }],
    ['jukebox', 'brew', 'hard', 'jukebox', '꼬마 DJ', '주크박스로 음반을 틀어요', '음반은 소리 블록 + 양털 + 석탄으로 만들어요.', { any: true }],
    ['discs', 'brew', 'hero', 'music_disc_3', '음반 수집가', '음반 3장을 모두 모아요', '노랑·하늘색·빨강 양털로 서로 다른 음반!', { stat: ['mc2discKinds', 3], need: ['jukebox'] }],
    ['cake', 'farm', 'basic', 'cake', '생일 축하해!', '케이크를 먹어요', '우유 3 + 설탕 2 + 달걀 + 밀 3.', {}],
    ['campfire', 'farm', 'basic', 'campfire', '캠핑 요리사', '모닥불로 음식을 익혀요', '날고기를 들고 모닥불을 우클릭!', {}],
    ['boat', 'explore', 'basic', 'boat', '노 저어라', '배를 타요', '판자 5개로 배를 만들어 물 위에 놓아요.', {}],
    ['boat300', 'explore', 'hard', 'boat', '바다 탐험가', '배로 300칸을 가요', 'W 를 누른 채 마우스로 방향을 잡아요.', { stat: ['mc2boatDist', 300], need: ['boat'] }],
    ['thunder', 'explore', 'hard', 'lantern', '번개 목격자', '천둥 번개가 칠 때 번개를 가까이서 봐요', '비 오는 날 가끔 천둥이 쳐요. 높은 곳은 조심!', {}],
    ['anvil', 'fight', 'hard', 'anvil', '대장장이의 손길', '모루로 도구나 갑옷을 고쳐요', '철 블록 3 + 철 주괴 4로 모루를 만들어요.', {}],
  ];
  for (const a of NEW) { ACH_LIST.push(a); ACH[a[0]] = { id: a[0], ch: a[1], tier: a[2], icon: a[3], name: a[4], desc: a[5], tip: a[6], o: a[7] }; if (typeof ADV !== 'undefined') ADV.push([a[0], a[3], a[4], a[5], null]); }
  const MC2_STAT = {
    mc2effKinds: g => ((g.stats && g.stats.mc2eff) || []).length,
    mc2decorKinds: g => ((g.stats && g.stats.mc2decor) || []).length,
    mc2discKinds: g => (g.stats && g.stats.mc2discs) | 0,
    mc2boatDist: g => Math.floor((g.stats && g.stats.mc2boat) || 0),
  };
  if (typeof achProgress === 'function') {
    const _ap = achProgress;
    achProgress = function (g, a) {
      const s = a && a.o && a.o.stat, f = s && MC2_STAT[s[0]];
      if (f) { const v = f(g); return { v: Math.min(v, s[1]), n: s[1], done: v >= s[1], txt: `${Math.min(v, s[1]).toLocaleString()} / ${s[1].toLocaleString()}` }; }
      return _ap(g, a);
    };
  }
}
