'use strict';
// =====================================================================
// 에듀 크래프트: 생물군계 · 동물 (v1.3)
//  - 새 생물군계(새로 만든 세계만, world.gen >= 2): 정글 9 · 사바나 10 · 늪 11 · 벚꽃 숲 12 · 메사(악지) 13
//    옛 세계(gen 1)는 지형이 바뀌면 지은 건물이 어긋나므로 그대로 둠
//  - 실제 동물: 말 · 낙타 · 기린 · 판다 · 앵무새 · 벌 · 거북 · 북극곰 · 펭귄 · 개구리
//  - 상상의 동물: 유니콘 · 불사조 · 구름 양 · 아기 용
//  - 동물 아이템: 안장(타기), 꿀병·밀랍(꿀 블록·양초·벌통), 거북 껍데기(거북 투구: 물속 숨),
//    구름 블록·구름 부츠(떨어져도 안 다침), 무지개 갈기(무지개 블록), 불사조 깃털(불사조 토템: 한 번 되살아남),
//    대나무(비계·막대기), 개구리·판다의 슬라임 볼(점프 발판 재료)
// =====================================================================

// ---------------- 텍스처 ----------------
function buildNatureTextures() {
  const it = (name, fn) => addTex(name, q => { q.clear(); fn(q); q.outline(); }, true);
  const planks = (name, c) => addTex(name, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.vary(c, 6));
    for (let b = 0; b < 4; b++) {
      for (let x = 0; x < 16; x++) p.set(x, b * 4 + 3, [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72]);
      const seam = (p.r() * 16) | 0; for (let y = b * 4; y < b * 4 + 3; y++) p.set(seam, y, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8]);
    }
  });
  const logSide = (name, c, spots) => addTex(name, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const st = (x % 4 === 0 || x % 5 === 2) ? 0.78 : 1; p.set(x, y, p.vary([c[0] * st, c[1] * st, c[2] * st], 8)); }
    if (spots) for (let k = 0; k < 6; k++) p.rect(p.r() * 14 | 0, p.r() * 16 | 0, 2, 1, spots);
  });
  const logTop = (name, c, bark) => addTex(name, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); p.set(x, y, p.vary((d | 0) % 2 ? [c[0] * 0.86, c[1] * 0.86, c[2] * 0.86] : c, 5)); }
    p.border(bark);
  });
  const leaves = (name, c, holes, flowers) => addTex(name, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (p.r() < (holes || 0.07)) continue;
      const k = p.r() < 0.3 ? 0.75 : 1; p.set(x, y, p.vary([c[0] * k, c[1] * k, c[2] * k], 14));
    }
    if (flowers) for (let n = 0; n < 7; n++) { const x = p.r() * 15 | 0, y = p.r() * 15 | 0; p.set(x, y, flowers); p.set(x + 1, y, flowers); p.set(x, y + 1, [255, 255, 255]); }
  });
  logSide('jungle_log', [112, 86, 48], [70, 110, 50]); logTop('jungle_log_top', [170, 124, 80], [112, 86, 48]); leaves('jungle_leaves', [70, 170, 70], 0.04); planks('jungle_planks', [168, 118, 82]);
  logSide('acacia_log', [104, 98, 90]); logTop('acacia_log_top', [190, 100, 60], [104, 98, 90]); leaves('acacia_leaves', [120, 160, 70], 0.12); planks('acacia_planks', [190, 104, 60]);
  logSide('cherry_log', [60, 38, 44]); logTop('cherry_log_top', [220, 170, 160], [60, 38, 44]); leaves('cherry_leaves', [244, 170, 200], 0.06, [255, 210, 230]); planks('cherry_planks', [236, 190, 180]);
  addTex('bamboo', p => { p.clear(); for (let y = 0; y < 16; y++) { const c = y % 6 === 0 ? [90, 140, 40] : [120, 180, 60]; p.rect(6, y, 4, 1, c); p.set(6, y, [80, 130, 40]); } p.rect(10, 3, 3, 1, [100, 170, 60]); p.rect(3, 9, 3, 1, [100, 170, 60]); });
  addTex('lily_pad', p => { p.clear(); p.disc(8, 8, 7, [70, 150, 60], 10); for (let i = 0; i < 7; i++) p.set(8 + i, 8, [0, 0, 0], 0); p.set(8, 8, [60, 120, 50]); });
  addTex('mud', p => { p.noise([84, 66, 60], 10); p.blobs(6, [70, 54, 50], 6, 0.6, 1.4); });
  addTex('red_sand', p => { p.noise([206, 112, 54], 10); p.blobs(5, [184, 96, 44], 6, 0.4, 0.8); });
  const TC = [[160, 92, 66], [196, 110, 50], [210, 160, 80], [220, 200, 180], [140, 70, 60]];
  TC.forEach((c, i) => addTex('terracotta_' + i, p => { p.noise(c, 6); for (let k = 0; k < 4; k++) p.rect(p.r() * 14 | 0, p.r() * 15 | 0, 3, 1, [c[0] * 0.9, c[1] * 0.9, c[2] * 0.9]); }));
  addTex('bee_nest_side', p => { p.noise([214, 168, 70], 8); for (let y = 2; y < 16; y += 4) p.rect(0, y, 16, 1, [180, 130, 50]); });
  addTex('bee_nest_top', p => { p.noise([200, 150, 60], 8); for (let i = 0; i < 4; i++) p.disc(4 + (i % 2) * 8, 4 + (i >> 1) * 8, 2.5, [170, 120, 40]); });
  const front = (name, honey) => addTex(name, p => { p.copy('bee_nest_side'); for (const [x, y] of [[4, 6], [10, 6], [7, 10]]) { p.rect(x, y, 3, 2, honey ? [250, 190, 40] : [60, 40, 20]); } });
  front('bee_nest_front', false); front('bee_nest_front_honey', true);
  addTex('beehive_side', p => { p.copy('oak_planks'); p.rect(0, 0, 16, 2, [214, 168, 70]); p.rect(0, 14, 16, 2, [214, 168, 70]); });
  addTex('honey_block', p => { p.noise([250, 180, 40], 10, 210); p.border([220, 140, 20], 230); p.rect(3, 3, 3, 2, [255, 230, 140], 230); });
  addTex('candle', p => { p.clear(); p.rect(6, 6, 4, 10, [240, 220, 160]); p.rect(7, 4, 2, 2, [255, 200, 80]); p.set(7, 3, [255, 250, 200]); });
  addTex('cloud_block', p => { p.noise([248, 250, 255], 4, 235); p.blobs(6, [226, 236, 252], 4, 1.5, 3, null); p.blobs(4, [255, 255, 255], 2, 1.5, 2.5); });
  addTex('rainbow_block', p => { const R = [[255, 90, 90], [255, 170, 60], [255, 230, 80], [110, 220, 110], [90, 170, 255], [170, 110, 255]]; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.vary(R[((x + y) >> 2) % 6], 6)); });
  addTex('scaffolding', p => { p.clear(); const c = [210, 180, 90], d = [170, 140, 60]; p.rect(0, 0, 16, 2, c); p.rect(0, 14, 16, 2, c); p.rect(0, 0, 2, 16, d); p.rect(14, 0, 2, 16, d); for (let i = 2; i < 14; i++) { p.set(i, i, d); p.set(i + 1, i, d); } });
  // 아이템
  it('saddle', p => { p.rect(3, 5, 10, 5, [140, 80, 40]); p.rect(4, 4, 8, 1, [170, 100, 50]); p.rect(2, 9, 2, 4, [110, 60, 30]); p.rect(12, 9, 2, 4, [110, 60, 30]); p.rect(6, 6, 4, 2, [200, 200, 210]); });
  it('glass_bottle', p => { p.rect(7, 2, 2, 3, [210, 230, 240]); p.disc(8, 10, 4.2, [200, 225, 240]); p.disc(8, 10, 3, [0, 0, 0]); p.disc(8, 10, 3, [235, 245, 252]); });
  it('honey_bottle', p => { p.rect(7, 2, 2, 3, [210, 230, 240]); p.disc(8, 10, 4.2, [230, 160, 30]); p.set(6, 8, [255, 230, 140]); });
  it('honeycomb', p => { for (const [x, y] of [[5, 5], [10, 5], [7, 9], [12, 9], [4, 9], [9, 13]]) p.disc(x, y, 2.4, [240, 180, 40]); p.set(5, 5, [255, 230, 140]); });
  it('turtle_scute', p => { p.disc(8, 9, 5, [70, 160, 70]); p.disc(8, 9, 2.5, [110, 190, 90]); p.rect(3, 9, 10, 1, [50, 120, 50]); });
  it('rainbow_mane', p => { const R = [[255, 90, 90], [255, 170, 60], [255, 230, 80], [110, 220, 110], [90, 170, 255], [170, 110, 255]]; for (let i = 0; i < 6; i++) p.line(3 + i, 2, 6 + i, 14, R[i], 1); });
  it('phoenix_feather', p => { p.line(4, 14, 12, 2, [255, 210, 80], 2); for (let i = 0; i < 9; i++) { p.set(5 + i, 11 - i, [255, 120 + i * 10, 40]); p.set(7 + i, 12 - i, [230, 70, 40]); } });
  it('phoenix_totem', p => { p.rect(5, 3, 6, 10, [250, 190, 60]); p.rect(3, 6, 2, 4, [250, 140, 50]); p.rect(11, 6, 2, 4, [250, 140, 50]); p.rect(6, 5, 1, 1, [40, 30, 20]); p.rect(9, 5, 1, 1, [40, 30, 20]); p.rect(6, 8, 4, 1, [230, 80, 40]); p.rect(7, 13, 2, 2, [230, 80, 40]); });
}

// ---------------- 블록 (177~200) ----------------
function defineNatureBlocks() {
  const b = defBlock;
  const log = (id, name, k, side, top) => b(id, name, k, { tex: faces(side), texTop: T(top), texSide: T(side), hard: 2, tool: 'axe', sound: 'wood', cat: 'nature', axis: true });
  const leaf = (id, name, k, t, tinted) => b(id, name, k, { tex: faces(t), opaque: false, opacity: 1, layer: 1, hard: 0.2, sound: 'grass', tint: tinted ? 'leaves' : null, wave: 1, cat: 'nature', conductor: false,
    drop: (m, rnd) => rnd() < 0.08 ? [[BL.sapling, 1]] : rnd() < 0.04 ? [[I('stick'), 1]] : [] });
  log(177, 'jungle_log', '정글나무 원목', 'jungle_log', 'jungle_log_top'); leaf(178, 'jungle_leaves', '정글나무 잎', 'jungle_leaves', true);
  b(179, 'jungle_planks', '정글나무 판자', { tex: faces('jungle_planks'), hard: 2, tool: 'axe', sound: 'wood' });
  log(180, 'acacia_log', '아카시아 원목', 'acacia_log', 'acacia_log_top'); leaf(181, 'acacia_leaves', '아카시아 잎', 'acacia_leaves', true);
  b(182, 'acacia_planks', '아카시아 판자', { tex: faces('acacia_planks'), hard: 2, tool: 'axe', sound: 'wood' });
  log(183, 'cherry_log', '벚나무 원목', 'cherry_log', 'cherry_log_top'); leaf(184, 'cherry_leaves', '벚나무 잎', 'cherry_leaves', false);
  b(185, 'cherry_planks', '벚나무 판자', { tex: faces('cherry_planks'), hard: 2, tool: 'axe', sound: 'wood' });
  b(186, 'bamboo', '대나무', { tex: faces('bamboo'), shape: 'cross', solid: false, opaque: false, layer: 1, hard: 0.3, tool: 'axe', sound: 'wood', icon: 'bamboo', push: 'break', cat: 'nature', desc: '정글에서 자라요. 판다의 먹이! 비계와 막대기를 만들 수 있어요.' });
  b(187, 'lily_pad', '수련잎', { tex: faces('lily_pad'), shape: 'plate', solid: true, opaque: false, layer: 1, hard: 0, sound: 'grass', icon: 'lily_pad', push: 'break', cat: 'nature', desc: '늪의 물 위에 떠 있어요. 밟고 건널 수 있어요.' });
  b(188, 'mud', '진흙', { tex: faces('mud'), hard: 0.5, tool: 'shovel', sound: 'gravel', cat: 'nature' });
  b(189, 'red_sand', '붉은 모래', { tex: faces('red_sand'), hard: 0.5, tool: 'shovel', sound: 'sand', gravity: true, cat: 'nature' });
  const TK = ['테라코타', '주황 테라코타', '노란 테라코타', '흰 테라코타', '갈색 테라코타'];
  for (let i = 0; i < 5; i++) b(190 + i, 'terracotta_' + i, TK[i], { tex: faces('terracotta_' + i), hard: 1.25, tool: 'pick', lvl: 1, cat: 'nature' });
  // 벌집·벌통 meta: facing(2~5) | 꿀 단계<<3 (0~5)
  const hive = (id, name, k, side) => b(id, name, k, { hard: 0.6, tool: 'axe', sound: 'wood', facingH: true, use: 'hive', cat: 'nature',
    texf: (m, f) => f === (m & 7) ? T((m >> 3) >= 5 ? 'bee_nest_front_honey' : 'bee_nest_front') : f < 2 ? T('bee_nest_top') : T(side),
    desc: '벌들이 꿀을 모아요. 꿀이 꽉 차면(앞면이 노랗게) 빈 병으로 꿀병, 가위로 밀랍을 얻어요.' });
  hive(195, 'bee_nest', '벌집', 'bee_nest_side'); hive(196, 'beehive', '벌통', 'beehive_side');
  b(197, 'honey_block', '꿀 블록', { tex: faces('honey_block'), opaque: false, layer: 2, hard: 0, sound: 'wool', conductor: false, cat: 'build', desc: '끈적끈적! 위에서는 느리고 높이 못 뛰어요. 떨어져도 다치지 않아요.' });
  b(198, 'candle', '양초', { tex: faces('candle'), shape: 'torch', solid: false, opaque: false, layer: 1, hard: 0, emit: 12, emissive: true, icon: 'candle', push: 'break', cat: 'tools', sound: 'wool' });
  b(199, 'cloud_block', '구름 블록', { tex: faces('cloud_block'), opaque: false, layer: 2, hard: 0.2, sound: 'wool', conductor: false, cat: 'build', desc: '구름 양에게서 얻어요. 폭신해서 떨어져도 다치지 않아요!' });
  b(200, 'rainbow_block', '무지개 블록', { tex: faces('rainbow_block'), hard: 0.8, emit: 10, emissive: true, sound: 'glass', cat: 'color', desc: '유니콘의 무지개 갈기로 만든 반짝이는 블록.' });
  b(212, 'scaffolding', '대나무 비계', { tex: faces('scaffolding'), opaque: false, solid: false, layer: 1, hard: 0, sound: 'wood', climb: true, conductor: false, cat: 'build', desc: '안에 들어가면 사다리처럼 오르내려요. 점프맵 탑 쌓기에 좋아요.' });
}
function defineNatureItems() {
  const it = defItem;
  it(386, 'saddle', '안장', { stack: 1, cat: 'tools', desc: '길들인 말·낙타·기린·유니콘에게 우클릭으로 얹고, 다시 우클릭하면 타요. (Shift로 내리기)' });
  it(387, 'glass_bottle', '빈 병', { cat: 'tools', desc: '꿀이 가득 찬 벌집에 쓰면 꿀병이 돼요.' });
  it(388, 'honey_bottle', '꿀병', { food: 6, sat: 1.2, heal: 2, stack: 16, cat: 'food', returns: 'glass_bottle', desc: '달콤해요! 체력도 조금 회복. 다 먹으면 병이 남아요.' });
  it(389, 'honeycomb', '밀랍', { desc: '벌통·양초를 만들어요.' });
  it(390, 'turtle_scute', '거북 껍데기 조각', { desc: '거북이 가끔 떨어뜨려요. 5개로 거북 투구!' });
  it(391, 'rainbow_mane', '무지개 갈기', { desc: '길들인 유니콘을 가위로 빗어 주면 얻어요. 무지개 블록 재료.' });
  it(392, 'phoenix_feather', '불사조 깃털', { desc: '메사·사막 하늘의 불사조가 가끔 떨어뜨려요. 불사조 토템 재료.' });
  it(393, 'phoenix_totem', '불사조 토템', { stack: 1, cat: 'tools', desc: '가방에 있으면 쓰러질 때 딱 한 번 다시 일어나요!' });
  // 갑옷: 거북 투구(물속에서 숨 참기), 구름 부츠(떨어져도 안 다침)
  it(394, 'turtle_helmet', '거북 투구', { stack: 1, cat: 'tools', dur: 275, armor: { slot: 0, def: 2, mat: 0 }, tex: 'turtle_scute', desc: '방어 +2 · 쓰고 있으면 물속에서 숨이 줄지 않아요.' });
  it(395, 'cloud_boots', '구름 부츠', { stack: 1, cat: 'tools', dur: 200, armor: { slot: 3, def: 1, mat: 0 }, tex: 'cloud_block', desc: '방어 +1 · 신고 있으면 높은 곳에서 떨어져도 다치지 않아요.' });
}
function defineNatureRecipes() {
  S(['jungle_log'], 'jungle_planks', 4); S(['acacia_log'], 'acacia_planks', 4); S(['cherry_log'], 'cherry_planks', 4);
  for (const n of ['jungle_planks', 'acacia_planks', 'cherry_planks']) GROUPS.planks.push(BL[n]);
  for (const n of ['jungle_log', 'acacia_log', 'cherry_log']) GROUPS.log.push(BL[n]);
  for (const n of ['jungle_leaves', 'acacia_leaves', 'cherry_leaves']) GROUPS.leaves.push(BL[n]);
  R(['LLL', 'LIL'], { L: 'leather', I: 'iron_ingot' }, 'saddle');
  R(['G G', ' G '], { G: 'glass' }, 'glass_bottle', 3);
  R(['HH', 'HH'], { H: 'honey_bottle' }, 'honey_block'); S(['honey_block', 'glass_bottle', 'glass_bottle', 'glass_bottle', 'glass_bottle'], 'honey_bottle', 4);
  R(['PPP', 'HHH', 'PPP'], { P: '#planks', H: 'honeycomb' }, 'beehive');
  S(['honeycomb', 'string'], 'candle', 2);
  R(['SSS', 'S S'], { S: 'turtle_scute' }, 'turtle_helmet');
  ITEMS[I('turtle_helmet')].armor.mat = ARMOR_MATS.push({ n: 'turtle', k: '거북', col: [0.35, 0.68, 0.32] }) - 1;
  ITEMS[I('cloud_boots')].armor.mat = ARMOR_MATS.push({ n: 'cloud', k: '구름', col: [0.96, 0.97, 1] }) - 1;
  R(['C C', 'C C'], { C: 'cloud_block' }, 'cloud_boots');
  S(['rainbow_mane', '#wool'], 'rainbow_block', 4);
  R([' F ', 'FGF', ' F '], { F: 'phoenix_feather', G: 'gold_ingot' }, 'phoenix_totem');
  R(['BSB', 'B B', 'B B'], { B: 'bamboo', S: 'string' }, 'scaffolding', 6);
  S(['bamboo', 'bamboo'], 'stick');
  R(['MM', 'MM'], { M: 'mud' }, 'bricks', 1);
  R(['SS', 'SS'], { S: 'red_sand' }, 'sandstone');
}
function defineNatureSmelting() {
  LOG_IDS = new Uint8Array(256); for (const d of BLOCKS) if (d && d.axis && /_log$/.test(d.name)) LOG_IDS[d.id] = 1;
  SMELT[BL.red_sand] = BL.glass; SMELT[BL.mud] = BL.terracotta_0; SMELT[BL.clay] = BL.terracotta_0;
  FUEL[BL.bamboo] = 50; FUEL[BL.scaffolding] = 50;
  for (const n of ['jungle_planks', 'acacia_planks', 'cherry_planks', 'jungle_log', 'acacia_log', 'cherry_log']) FUEL[BL[n]] = 300;
  for (const n of ['jungle_log', 'acacia_log', 'cherry_log']) SMELT[BL[n]] = I('charcoal');
}

// ---------------- 생물군계 ----------------
BIOMES[9] = { name: '정글', grass: [0.62, 1.15, 0.5] };
BIOMES[10] = { name: '사바나', grass: [1.2, 1.05, 0.55] };
BIOMES[11] = { name: '늪', grass: [0.75, 0.82, 0.55] };
BIOMES[12] = { name: '벚꽃 숲', grass: [0.9, 1.1, 0.8] };
BIOMES[13] = { name: '메사', grass: [1.15, 0.95, 0.6] };
{
  const _col = World.prototype.column;
  World.prototype.column = function (x, z) {
    const c = _col.call(this, x, z);
    if ((this.gen || 1) < 2 || this.type === 'flat' || this.dim !== 'overworld') return c;
    const bi = c.biome;
    if (bi === 0 || bi === 1 || bi === 5 || bi === 6 || bi === 3) return c;
    const temp = this.nT.fbm2(x / 800, z / 800, 2), hum = this.nW.fbm2(x / 600 + 300, z / 600, 2);
    if (temp > 0.4 && hum < -0.16) {
      // 메사: 계단처럼 깎인 고원
      const k = Math.min(1, (temp - 0.4) * 6) * Math.min(1, (-0.16 - hum) * 6);
      const up = Math.floor(k * 14 / 4) * 4;
      return { h: Math.min(110, c.h + up), biome: 13 };
    }
    if (bi === 2) return c;
    if (temp > 0.22 && hum > 0.14) return { h: c.h, biome: 9 };
    if (temp > 0.16 && hum > -0.06) return { h: c.h, biome: 10 };
    if (hum > 0.3 && c.h <= SEA + 5 && temp > -0.25) {
      // 늪: 낮고 평평, 군데군데 물웅덩이
      const n = this.nD.n2(x / 9, z / 9);
      return { h: n < -0.15 ? SEA - 1 : SEA + (n > 0.35 ? 1 : 0), biome: 11 };
    }
    const nc = this.nCherry || (this.nCherry = new Noise(this.seed + 12));
    if ((bi === 4 || bi === 8 || bi === 7) && nc.fbm2(x / 260, z / 260, 2) > 0.32 && c.h > SEA + 3) return { h: c.h, biome: 12 };
    return c;
  };
}
// 생물군계별 나무
World.prototype.placeTree2 = function (c, tx, ty, tz, kind, hseed) {
  const rnd = mulberry32(hseed), ids = c.ids, meta = c.meta;
  const isLeaf = (id) => BLOCKS[id] && BLOCKS[id].wave === 1;
  const put = (x, y, z, id, force) => {
    if (x < 0 || x > 15 || z < 0 || z > 15 || y < 1 || y >= HEIGHT) return;
    const i = CI(x, y, z), cur = ids[i];
    if (cur === 0 || cur === BL.tallgrass || (force && isLeaf(cur))) { ids[i] = id; meta[i] = 0; }
  };
  const blob = (cx, cy, cz, r, ry, leaf) => {
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const d = (dx * dx + dz * dz) / (r * r + 0.5) + (dy * dy) / (ry * ry + 0.5);
      if (d <= 1 && !(d > 0.75 && rnd() < 0.4)) put(cx + dx, cy + dy, cz + dz, leaf);
    }
  };
  const dirtUnder = () => { if (tx >= 0 && tx < 16 && tz >= 0 && tz < 16 && ty > 0) { const i = CI(tx, ty - 1, tz); if (ids[i] === BL.grass) ids[i] = BL.dirt; } };
  if (kind === 'jungle') {
    const th = 9 + (rnd() * 8 | 0);
    blob(tx, ty + th, tz, 3, 2, BL.jungle_leaves);
    if (th > 12) blob(tx + (rnd() < 0.5 ? 2 : -2), ty + th - 5, tz + (rnd() < 0.5 ? 2 : -2), 2, 1, BL.jungle_leaves);
    for (let y = 0; y < th; y++) put(tx, ty + y, tz, BL.jungle_log, true);
    // 코코아 대신 옆가지 잎
    for (let k = 0; k < 3; k++) put(tx + (k - 1), ty + 3 + k * 2, tz + 1, BL.jungle_leaves);
  } else if (kind === 'bush') {
    put(tx, ty, tz, BL.jungle_log, true); blob(tx, ty + 1, tz, 2, 1, BL.jungle_leaves);
  } else if (kind === 'acacia') {
    const th = 4 + (rnd() * 2 | 0), dx = rnd() < 0.5 ? 1 : -1, dz = rnd() < 0.5 ? 1 : -1;
    let x = tx, z = tz;
    for (let y = 0; y < th; y++) { if (y === th - 2) { x += dx; z += dz; } put(x, ty + y, z, BL.acacia_log, true); }
    const top = ty + th;
    for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) if (Math.abs(ox) + Math.abs(oz) < 4) put(x + ox, top, z + oz, BL.acacia_leaves);
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) put(x + ox, top + 1, z + oz, BL.acacia_leaves);
  } else if (kind === 'cherry') {
    const th = 5 + (rnd() * 2 | 0);
    for (let y = 0; y < th; y++) put(tx, ty + y, tz, BL.cherry_log, true);
    blob(tx, ty + th, tz, 3, 2, BL.cherry_leaves);
    for (const [ox, oz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (rnd() < 0.5) put(tx + ox, ty + th - 3, tz + oz, BL.cherry_leaves);
  } else if (kind === 'swamp') {
    const th = 4 + (rnd() * 2 | 0);
    for (let y = 0; y < th; y++) put(tx, ty + y, tz, BL.oak_log, true);
    for (let y = ty + th - 2; y <= ty + th; y++) { const r = y === ty + th ? 2 : 3; for (let ox = -r; ox <= r; ox++) for (let oz = -r; oz <= r; oz++) if (Math.abs(ox) + Math.abs(oz) <= r + 1) put(tx + ox, y, tz + oz, BL.oak_leaves); }
  }
  dirtUnder();
};
{
  const _st = World.prototype.structures;
  World.prototype.structures = function (c, cols) {
    if ((this.gen || 1) >= 2 && this.dim === 'overworld' && this.type !== 'flat') natureDecorate(this, c, cols);
    _st.call(this, c, cols);
  };
}
function natureDecorate(w, c, cols) {
  const bx = c.cx * 16, bz = c.cz * 16, ids = c.ids, meta = c.meta;
  let any = false;
  for (let i = 0; i < 256; i += 17) if (cols[i].biome >= 9) { any = true; break; }
  if (!any) { for (let i = 0; i < 256; i++) if (cols[i].biome >= 9) { any = true; break; } }
  if (!any) return;
  // 겉흙: 메사 줄무늬, 늪 진흙
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const col = cols[x | z << 4], h = col.h;
    if (col.biome === 13) {
      for (let y = Math.max(2, h - 16); y <= h; y++) {
        const i = CI(x, y, z), id = ids[i];
        if (id === BL.stone || id === BL.dirt || id === BL.grass || id === BL.sand || id === BL.sandstone || id === BL.gravel) {
          ids[i] = y === h ? BL.red_sand : BL['terracotta_' + [0, 1, 0, 2, 3, 0, 4, 1, 0][((y * 7 + 3) >> 2) % 9]];
        }
      }
      const above = CI(x, h + 1, z); if (ids[above] === BL.tallgrass || ids[above] === BL.dandelion || ids[above] === BL.poppy) ids[above] = hash01(bx + x, 21, bz + z, w.seed) < 0.3 ? BL.dead_bush : 0;
    } else if (col.biome === 11) {
      const i = CI(x, h, z);
      if (ids[i] === BL.grass && hash01(bx + x, 22, bz + z, w.seed) < 0.3) ids[i] = BL.mud;
      if (ids[i] === BL.dirt && h < SEA) ids[i] = BL.mud;
      // 물 위 수련잎
      if (ids[CI(x, SEA, z)] === BL.water && ids[CI(x, SEA + 1, z)] === 0 && hash01(bx + x, 23, bz + z, w.seed) < 0.12) ids[CI(x, SEA + 1, z)] = BL.lily_pad;
    }
  }
  // 나무·대나무·수박
  for (let tz = -3; tz < 19; tz++) for (let tx = -3; tx < 19; tx++) {
    const wx = bx + tx, wz = bz + tz;
    const hv = hash01(wx, 31, wz, w.seed);
    if (hv > 0.12) continue;
    const inside = tx >= 0 && tx < 16 && tz >= 0 && tz < 16;
    const col = inside ? cols[tx | tz << 4] : w.column(wx, wz);
    if (col.biome < 9 || col.h < SEA) continue;
    if (inside) { const top = ids[CI(tx, col.h, tz)]; if (top !== BL.grass && top !== BL.dirt && top !== BL.mud) continue; }
    const hs = hashInt(wx, 32, wz, w.seed), bi = col.biome;
    if (bi === 9) {
      if (hv < 0.035) w.placeTree2(c, tx, col.h + 1, tz, 'jungle', hs);
      else if (hv < 0.07) w.placeTree2(c, tx, col.h + 1, tz, 'bush', hs);
      else if (inside && hv < 0.1) { const n = 2 + (hs % 6); for (let k = 1; k <= n && col.h + k < HEIGHT; k++) if (!ids[CI(tx, col.h + k, tz)]) ids[CI(tx, col.h + k, tz)] = BL.bamboo; }
      else if (inside && hv < 0.104 && !ids[CI(tx, col.h + 1, tz)]) ids[CI(tx, col.h + 1, tz)] = BL.melon;
    } else if (bi === 10 && hv < 0.008) w.placeTree2(c, tx, col.h + 1, tz, 'acacia', hs);
    else if (bi === 12 && hv < 0.03) w.placeTree2(c, tx, col.h + 1, tz, 'cherry', hs);
    else if (bi === 11 && hv < 0.015) w.placeTree2(c, tx, col.h + 1, tz, 'swamp', hs);
    // 벌집: 벚꽃 숲·평원 나무 옆
    if (inside && (bi === 12) && hv > 0.115) {
      for (let y = col.h + 3; y < col.h + 8 && y < HEIGHT - 1; y++) if (ids[CI(tx, y, tz)] === 0 && BLOCKS[ids[CI(tx, y + 1, tz)]] && BLOCKS[ids[CI(tx, y + 1, tz)]].wave === 1) { ids[CI(tx, y, tz)] = BL.bee_nest; meta[CI(tx, y, tz)] = 3 | (2 << 3); break; }
    }
  }
  // 벚꽃 숲 꽃 더
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const col = cols[x | z << 4]; if (col.biome !== 12 && col.biome !== 10) continue;
    const i = CI(x, col.h + 1, z), r = hash01(bx + x, 24, bz + z, w.seed);
    if (ids[CI(x, col.h, z)] === BL.grass && (ids[i] === 0 || ids[i] === BL.tallgrass)) {
      if (col.biome === 12 && r < 0.12) ids[i] = r < 0.06 ? BL.poppy : r < 0.09 ? BL.dandelion : BL.blue_orchid;
      if (col.biome === 10 && r < 0.25 && !ids[i]) ids[i] = BL.tallgrass;
    }
  }
}
// 근처에 원목이 있는지 (새 나무 원목 포함) — 나뭇잎이 엉뚱하게 사라지지 않게
World.prototype.logNear = function (x, y, z, r) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > r + 1) continue;
    if (!this.isLoadedAt(x + dx, z + dz)) return true;
    const id = this.getBlock(x + dx, y + dy, z + dz);
    if (id && LOG_IDS[id]) return true;
  }
  return false;
};
let LOG_IDS = null;
// 대나무 자라기, 벌집 꿀 차기
{
  const _rt = World.prototype.randomTickBlock;
  World.prototype.randomTickBlock = function (x, y, z, id, meta, light) {
    if (id === BL.bamboo && !this.getBlock(x, y + 1, z)) { let h = 1; while (this.getBlock(x, y - h, z) === BL.bamboo) h++; if (h < 12 && Math.random() < 0.2) this.setBlock(x, y + 1, z, BL.bamboo, 0); return; }
    if ((id === BL.bee_nest || id === BL.beehive) && (meta >> 3) < 5 && Math.random() < 0.15 && this.dayFactor() > 0.4) { this.setBlock(x, y, z, id, (meta & 7) | (((meta >> 3) + 1) << 3)); return; }
    return _rt.call(this, x, y, z, id, meta, light);
  };
}

// ---------------- 동물 ----------------
Object.assign(MOB_TYPES, {
  horse: { k: '말', hp: 22, w: 1.3, h: 1.6, speed: 2, rideSpeed: 9, jumpV: 11, seat: 1.15, hostile: false, mount: true, food: { apple: 0.35, wheat: 0.2, sugar: 0.25, carrot: 0.3, golden_carrot: 1, golden_apple: 1 }, drops: [['leather', 0, 2]] },
  camel: { k: '낙타', hp: 30, w: 1.5, h: 2.2, speed: 1.4, rideSpeed: 6.5, jumpV: 9.5, seat: 1.75, hostile: false, mount: true, food: { cactus: 0.4, wheat: 0.15, golden_carrot: 1 }, drops: [['leather', 0, 1]] },
  giraffe: { k: '기린', hp: 26, w: 1.2, h: 3.4, speed: 1.6, rideSpeed: 7, jumpV: 9, seat: 2.3, hostile: false, mount: true, food: { apple: 0.3, acacia_leaves: 0.5, golden_carrot: 1 }, drops: [['leather', 0, 1]] },
  unicorn: { k: '유니콘', hp: 30, w: 1.3, h: 1.7, speed: 2.4, rideSpeed: 12, jumpV: 14, seat: 1.2, hostile: false, mount: true, magic: true, food: { golden_carrot: 0.5, golden_apple: 1 }, drops: [] },
  panda: { k: '판다', hp: 20, w: 1.3, h: 1.25, speed: 0.9, hostile: false, food: { bamboo: 1 }, drops: [['bamboo', 0, 2]] },
  polar_bear: { k: '북극곰', hp: 30, w: 1.4, h: 1.4, speed: 2.2, hostile: false, neutral: true, dmg: 5, drops: [['cod', 0, 2], ['salmon', 0, 1]] },
  penguin: { k: '펭귄', hp: 8, w: 0.5, h: 0.9, speed: 1.2, hostile: false, food: { cod: 1, salmon: 1 }, drops: [['feather', 0, 1]] },
  turtle: { k: '거북', hp: 30, w: 1.1, h: 0.45, speed: 0.6, hostile: false, swim: true, drops: [['seeds', 0, 1]] },
  frog: { k: '개구리', hp: 8, w: 0.5, h: 0.5, speed: 1.3, hostile: false, hop: true, drops: [['slime_ball', 0, 1]] },
  cloud_sheep: { k: '구름 양', hp: 10, w: 1, h: 1.4, speed: 1.3, hostile: false, floaty: true, noFall: true, drops: [['cloud_block', 1, 1]] },
  parrot: { k: '앵무새', hp: 6, w: 0.5, h: 0.9, speed: 3, hostile: false, fly: true, flyH: 6, noFall: true, food: { seeds: 0.4 }, drops: [['feather', 1, 2]] },
  bee: { k: '벌', hp: 6, w: 0.6, h: 0.6, speed: 2.4, hostile: false, neutral: true, dmg: 1, fly: true, flyH: 2.5, noFall: true, drops: [] },
  phoenix: { k: '불사조', hp: 40, w: 1.2, h: 1.2, speed: 6, hostile: false, fly: true, flyH: 18, noFall: true, fireImmune: true, shy: true, drops: [['phoenix_feather', 1, 2]] },
  baby_dragon: { k: '아기 용', hp: 30, w: 0.9, h: 0.9, speed: 4, hostile: false, fly: true, flyH: 5, noFall: true, fireImmune: true, food: { golden_apple: 0.5, steak: 0.15, cooked_porkchop: 0.15 }, drops: [] },
});
const NATURE_PETS = new Set(['horse', 'camel', 'giraffe', 'unicorn', 'baby_dragon', 'parrot', 'wolf']);
// 하늘을 나는 동물 (적이 아님): 땅 위 flyH 높이에서 맴돌기, 길들이면 주인 따라오기
function flyUpdate(e, dt, g) {
  const D = e.def, w = g.world;
  e.age += dt; e.checkFluids(w); if (e.hurtT > 0) e.hurtT -= dt;
  const owner = e.tamed ? (g.allPlayers().find(p => p.name === e.owner) || g.player) : null;
  let tx = e.tgx, ty = e.tgy, tz = e.tgz, sp = D.speed;
  if (owner && !e.sit && !owner.dead) {
    const d = Math.hypot(owner.x - e.x, owner.z - e.z);
    if (d > 24) { e.x = owner.x; e.y = owner.y + 3; e.z = owner.z; }
    // 아기 용: 근처 적에게 불꽃
    if (e.sub === 'baby_dragon') {
      if (e.prey && (e.prey.dead || Math.hypot(e.prey.x - e.x, e.prey.z - e.z) > 16)) e.prey = null;
      if (!e.prey && (e.age * 3 | 0) % 3 === 0) e.prey = nearestHostile(g, owner.x, owner.y, owner.z, 12);
      if (e.prey) {
        tx = e.prey.x; ty = e.prey.y + 3; tz = e.prey.z; e.fireT = (e.fireT || 0) - dt;
        if (e.fireT <= 0 && Math.hypot(e.prey.x - e.x, e.prey.z - e.z) < 7) {
          e.fireT = 1.2; g.damageEntity(e.prey, 5, (e.prey.x - e.x) / 5, (e.prey.z - e.z) / 5, 'pet');
          for (let k = 0; k < 8; k++) { const t = k / 8; g.particles.smoke(e.x + (e.prey.x - e.x) * t, e.y + 0.4 + (e.prey.y + 1 - e.y) * t, e.z + (e.prey.z - e.z) * t, 2, [1, 0.6, 0.2]); }
          g.sfx('blaze', e.x, e.y, e.z);
        }
      }
    }
    if (!e.prey || e.sub !== 'baby_dragon') { tx = owner.x + Math.sin(e.age * 0.8) * 2.5; ty = owner.y + 2.6 + Math.sin(e.age * 1.7) * 0.4; tz = owner.z + Math.cos(e.age * 0.8) * 2.5; sp = d > 6 ? D.speed * 1.6 : D.speed * 0.7; }
  } else if (e.sit) { tx = e.x; tz = e.z; ty = e.y; sp = 0; }
  else if (e.sub === 'bee' && e.angry > 0) {
    e.angry -= dt; const p = g.player; tx = p.x; ty = p.y + 1.2; tz = p.z; sp = D.speed * 1.4;
    if (Math.hypot(p.x - e.x, p.y + 1 - e.y, p.z - e.z) < 1.3 && !p.dead) { g.hurtPlayer(p, 1, 'mob', (p.x - e.x), (p.z - e.z)); e.angry = 0; }
  }
  else {
    e.wanderT = (e.wanderT || 0) - dt;
    // 불사조: 사람을 피해 높이 날아감
    let flee = false;
    if (D.shy) { const p = g.player; if (Math.hypot(p.x - e.x, p.z - e.z) < 10) { flee = true; tx = e.x + (e.x - p.x) * 2; tz = e.z + (e.z - p.z) * 2; ty = e.y + 4; sp = D.speed * 1.3; } }
    if (!flee && (e.wanderT <= 0 || tx === undefined || Math.hypot(tx - e.x, tz - e.z) < 1.5)) {
      e.wanderT = 3 + Math.random() * 5;
      const hx = e.home ? e.home[0] : e.x, hz = e.home ? e.home[1] : e.z, R = e.sub === 'bee' ? 7 : 16;
      e.tgx = hx + (Math.random() - 0.5) * R * 2; e.tgz = hz + (Math.random() - 0.5) * R * 2;
      const gy = w.isLoadedAt(Math.floor(e.tgx), Math.floor(e.tgz)) ? w.heightAt(Math.floor(e.tgx), Math.floor(e.tgz)) : e.y;
      e.tgy = gy + D.flyH * (0.6 + Math.random() * 0.8);
      tx = e.tgx; ty = e.tgy; tz = e.tgz;
    }
  }
  if (tx !== undefined && sp > 0) {
    const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z, d = Math.hypot(dx, dy, dz) || 1;
    const k = 1 - Math.exp(-3 * dt);
    e.vx += (dx / d * sp - e.vx) * k; e.vy += (dy / d * sp * 0.8 - e.vy) * k; e.vz += (dz / d * sp - e.vz) * k;
    if (Math.hypot(dx, dz) > 0.3) e.yaw = Math.atan2(-dx, -dz);
  } else { e.vx *= 0.9; e.vz *= 0.9; e.vy = e.onGround ? 0 : e.vy - 10 * dt; }
  const mv = e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
  if (e.hitH) e.vy += 4 * dt * 10;
  e.walk += dt * 6;
  if (e.y < -20) e.dead = true;
  // 불사조: 불티 + 가끔 깃털을 떨어뜨림
  if (e.sub === 'phoenix') { if (Math.random() < dt * 8) g.particles.smoke(e.x, e.y + 0.4, e.z, 1, [1, 0.55, 0.15]); if (Math.random() < dt / 90) g.dropItem(e.x, e.y, e.z, { id: I('phoenix_feather'), n: 1 }); }
  return true;
}
// 탈것: 플레이어가 조종
function mountRide(p, dt, input, world) {
  const m = p.riding, g = p.game, D = m.def;
  if (m.dead) { g.dismount(p); return; }
  m.checkFluids(world);
  m.yaw = p.yaw;
  let want = Math.max(-0.4, Math.min(1, input.moveF || 0));
  const strafe = input.moveS || 0;
  const sp = D.rideSpeed * (p.sprinting || input.sprint ? 1.25 : 1);
  const s = Math.sin(m.yaw), c = Math.cos(m.yaw);
  const tx = (-s * want + c * strafe * 0.6) * sp, tz = (-c * want - s * strafe * 0.6) * sp;
  const k = 1 - Math.exp(-(m.onGround ? 8 : 2) * dt);
  m.vx += (tx - m.vx) * k; m.vz += (tz - m.vz) * k;
  if (m.inWater && D.mount && m.sub !== 'unicorn') m.vy += (1.5 - m.vy) * dt * 3; else m.vy -= 28 * dt;
  if (input.jump && m.onGround) { m.vy = D.jumpV; g.sound.play('step', m.x, m.y, m.z, { mat: 'wood' }); }
  // 유니콘: 공중에서 한 번 더 뛰기
  if (m.sub === 'unicorn') { if (m.onGround) m.airJump = true; else if (input.jump && m.airJump && m.vy < 2) { m.airJump = false; m.vy = D.jumpV * 0.8; g.particles.dust(m.x, m.y + 0.5, m.z, [1, 0.6, 1]); } }
  m.stepHeight = 1.05;
  const prevG = m.onGround, mv = m.move(world, m.vx * dt, m.vy * dt, m.vz * dt);
  if (m.onGround && m.hitH && Math.abs(want) > 0.1 && !input.jump) m.vy = 7;
  if (!m.onGround && mv[1] < 0) m.fallDist -= mv[1]; if (m.onGround && !prevG) m.fallDist = 0;
  m.walk += Math.hypot(mv[0], mv[2]) * 1.6;
  p.x = m.x; p.y = m.y + D.seat; p.z = m.z; p.vx = p.vy = p.vz = 0; p.onGround = false; p.fallDist = 0;
  if (input.sneakPress) g.dismount(p);
  p.survival(dt, world);
}
{
  const _ur = Player.prototype.updateRiding;
  Player.prototype.updateRiding = function (dt, input, world) {
    if (this.riding && this.riding.type === 'mob') return mountRide(this, dt, input, world);
    return _ur.call(this, dt, input, world);
  };
  const _upd = Mob.prototype.update;
  Mob.prototype.update = function (dt, g) {
    const D = this.def;
    if (this.rider) { this.age += dt; if (this.hurtT > 0) this.hurtT -= dt; return; }   // 타고 있으면 플레이어가 움직임
    if (D.fly) { flyUpdate(this, dt, g); return; }
    if (this.tamed && D.mount && this.sit) { this.age += dt; this.checkFluids(g.world); mobMove(this, dt, g, 0); return; }
    _upd.call(this, dt, g);
    if (this.dead) return;
    if (D.floaty && this.vy < -2) this.vy = -2;                     // 구름 양: 둥실둥실 천천히 떨어짐
    if (D.hop && this.onGround && Math.hypot(this.vx, this.vz) > 0.3 && Math.random() < dt * 3) this.vy = 6;   // 개구리 폴짝
    if (D.swim && this.inWater) { this.vy = Math.max(this.vy, -0.5); }
    if (this.sub === 'turtle' && Math.random() < dt / 300) g.dropItem(this.x, this.y + 0.3, this.z, { id: I('turtle_scute'), n: 1 });
    if (this.sub === 'panda' && Math.random() < dt / 240) { g.dropItem(this.x, this.y + 0.8, this.z, { id: I('slime_ball'), n: 1 }); g.particles.smoke(this.x, this.y + 1, this.z, 5, [0.7, 1, 0.6]); }
    if (this.sheared && D.floaty) { this.woolT = (this.woolT || 60) - dt; if (this.woolT <= 0) this.sheared = false; }
  };
}

// ---------------- 동물 모양 ----------------
function quadModel(R, x, y, z, yaw, walk, L, hurt, o) {
  const P = 1 / 16, [base, t] = mobBase(x, y, z, yaw), sw = Math.sin(walk) * (o.swing || 0.6);
  const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
  const box = (m, a, b2, c2, d, e2, f, col, lit) => R.ent.addBox(m, a * P, b2 * P, c2 * P, d * P, e2 * P, f * P, tint(col), lit ? 1 : L[0], lit ? 1 : L[1]);
  const at = (px, py, pz, ax, az) => { const m = new Float32Array(base), tr = M4.create(); M4.translate(tr, px * P, py * P, pz * P); M4.mul(m, m, tr); if (ax) M4.mul(m, m, M4.rotX(t, ax)); if (az) M4.mul(m, m, M4.rotZ(t, az)); return m; };
  const { bw, bl, bh, lh, lw } = o;
  box(base, -bw, lh, -bl, bw, lh + bh, bl, o.body);
  for (const [lx, lz, ph] of [[-bw + lw, -bl + lw, sw], [bw - lw, -bl + lw, -sw], [-bw + lw, bl - lw, -sw], [bw - lw, bl - lw, sw]]) box(at(lx, lh, lz, ph), -lw, -lh, -lw, lw, 0, lw, o.leg || o.body);
  const H = { box, at, base, t, P, sw };
  if (o.extra) o.extra(H);
  return H;
}
function renderNatureMob(R, sub, x, y, z, yaw, walk, L, hurt, e) {
  const tamed = e && e.tamed, saddled = e && e.saddled, sheared = e && e.sheared;
  const saddle = (H, bw, top, zc) => { if (saddled) { H.box(H.base, -bw - 0.2, top - 0.5, zc - 3, bw + 0.2, top + 1, zc + 3, [0.45, 0.25, 0.12]); H.box(H.base, -bw - 0.3, top - 4, zc - 0.5, -bw - 0.1, top, zc + 0.5, [0.3, 0.3, 0.32]); H.box(H.base, bw + 0.1, top - 4, zc - 0.5, bw + 0.3, top, zc + 0.5, [0.3, 0.3, 0.32]); } };
  // 목(앞으로 ang 만큼 기울어짐) 끝에 머리
  const neckHead = (H, ny, nz, len, ang, hw, hl, col, extra) => {
    const nk = H.at(0, ny, nz, -ang); H.box(nk, -2, 0, -2.5, 2, len, 2.5, col);
    const hm = new Float32Array(nk), tr = M4.create(); M4.translate(tr, 0, len / 16, 0); M4.mul(hm, hm, tr); M4.mul(hm, hm, M4.rotX(M4.create(), ang));
    H.box(hm, -hw, -1, -hl, hw, 4, 2, col); if (extra) extra(hm); return hm;
  };
  switch (sub) {
    case 'horse': case 'unicorn': {
      const uni = sub === 'unicorn', col = uni ? [0.96, 0.95, 0.98] : (e && e.eid % 3 === 0 ? [0.35, 0.22, 0.14] : e && e.eid % 3 === 1 ? [0.8, 0.8, 0.78] : [0.55, 0.34, 0.18]);
      const mane = uni ? null : [0.18, 0.12, 0.08];
      quadModel(R, x, y, z, yaw, walk, L, hurt, { bw: 5, bl: 10, bh: 9, lh: 12, lw: 1.8, body: col, extra: (H) => {
        const hm = neckHead(H, 19, -9, 9, 0.5, 2.6, 9, col, (m) => {
          H.box(m, -2, 4, -1, -1, 6, 1, col); H.box(m, 1, 4, -1, 2, 6, 1, col);
          H.box(m, -2.7, 1.5, -6, -2.6, 2.6, -5, [0.1, 0.1, 0.12]); H.box(m, 2.6, 1.5, -6, 2.7, 2.6, -5, [0.1, 0.1, 0.12]);
          if (uni) { H.box(m, -0.6, 4, -6, 0.6, 11, -4.8, [1, 0.85, 0.4], true); }
        });
        const RB = [[1, 0.4, 0.45], [1, 0.7, 0.3], [1, 0.95, 0.4], [0.5, 0.9, 0.5], [0.45, 0.7, 1], [0.7, 0.5, 1]];
        for (let k = 0; k < 6; k++) { const mc = uni ? RB[k] : mane; H.box(H.at(0, 19, -9, -0.5), -0.8, k * 1.6, 2.4, 0.8, k * 1.6 + 1.7, 3.6, mc, uni); }
        const tail = H.at(0, 19, 10, 0.5 + Math.sin(walk) * 0.15); for (let k = 0; k < 4; k++) H.box(tail, -1, -k * 3 - 3, -1, 1, -k * 3, 1, uni ? RB[k + 1] : mane, uni);
        saddle(H, 5, 21, 0);
      } });
      return true;
    }
    case 'camel': {
      const col = [0.85, 0.7, 0.45];
      quadModel(R, x, y, z, yaw, walk, L, hurt, { bw: 5, bl: 11, bh: 10, lh: 18, lw: 1.8, body: col, extra: (H) => {
        H.box(H.base, -4, 28, -6, 4, 33, 0, col); H.box(H.base, -4, 28, 2, 4, 32, 8, col);
        neckHead(H, 24, -10, 10, 0.9, 2.5, 8, col, (m) => { H.box(m, -2.6, 1.5, -5, -2.5, 2.5, -4, [0.1, 0.1, 0.1]); H.box(m, 2.5, 1.5, -5, 2.6, 2.5, -4, [0.1, 0.1, 0.1]); });
        saddle(H, 5, 33, -3);
      } });
      return true;
    }
    case 'giraffe': {
      const col = [0.96, 0.8, 0.35], spot = [0.6, 0.38, 0.18];
      quadModel(R, x, y, z, yaw, walk, L, hurt, { bw: 4.5, bl: 9, bh: 9, lh: 20, lw: 1.5, body: col, extra: (H) => {
        for (const [sx, sy, sz] of [[-4.6, 23, -5], [-4.6, 25, 3], [4.55, 24, -1], [4.55, 22, 5], [-2, 29.05, -3], [1, 29.05, 4]]) H.box(H.base, sx, sy, sz, sx + 0.1 + (Math.abs(sx) < 4 ? 3 : 0), sy + 2.5, sz + 2.5, spot);
        const nk = H.at(0, 27, -8, -0.25); H.box(nk, -1.8, 0, -2, 1.8, 22, 2, col); H.box(nk, -1.85, 6, -1, -1.75, 9, 1, spot); H.box(nk, 1.75, 13, -1, 1.85, 16, 1, spot);
        const hm = H.at(0, 27 + 21.3, -8 - 5.4, 0); H.box(hm, -2.2, -1, -7, 2.2, 3.5, 1.5, col);
        H.box(hm, -1.5, 3.5, -1, -0.8, 6, -0.3, spot); H.box(hm, 0.8, 3.5, -1, 1.5, 6, -0.3, spot);
        H.box(hm, -2.3, 1, -4, -2.2, 2, -3, [0.1, 0.1, 0.1]); H.box(hm, 2.2, 1, -4, 2.3, 2, -3, [0.1, 0.1, 0.1]);
        saddle(H, 4.5, 29, 1);
      } });
      return true;
    }
    case 'panda': {
      const wh = [0.95, 0.95, 0.93], bk = [0.12, 0.12, 0.14];
      quadModel(R, x, y, z, yaw, walk, L, hurt, { bw: 6, bl: 9, bh: 9, lh: 7, lw: 2.3, body: wh, leg: bk, swing: 0.4, extra: (H) => {
        H.box(H.base, -6.05, 9, -4, 6.05, 15, 1, bk);
        const hm = H.at(0, 12, -9, 0); H.box(hm, -4.5, 0, -7, 4.5, 7.5, 0, wh);
        H.box(hm, -3.5, 3, -7.05, -1.2, 5.5, -7, bk); H.box(hm, 1.2, 3, -7.05, 3.5, 5.5, -7, bk);
        H.box(hm, -2.5, 4, -7.1, -1.8, 4.7, -7.05, [1, 1, 1]); H.box(hm, 1.8, 4, -7.1, 2.5, 4.7, -7.05, [1, 1, 1]);
        H.box(hm, -1, 1, -8, 1, 2.5, -7, bk); H.box(hm, -4.5, 7.5, -3, -2.5, 9.5, -1, bk); H.box(hm, 2.5, 7.5, -3, 4.5, 9.5, -1, bk);
      } });
      return true;
    }
    case 'polar_bear': {
      const wh = [0.95, 0.95, 0.92];
      quadModel(R, x, y, z, yaw, walk, L, hurt, { bw: 6, bl: 11, bh: 10, lh: 10, lw: 2.5, body: wh, extra: (H) => {
        const hm = H.at(0, 14, -11, 0); H.box(hm, -3.5, 0, -6, 3.5, 6, 0, wh); H.box(hm, -2, 0, -9, 2, 3, -6, [0.9, 0.88, 0.85]);
        H.box(hm, -1, 2, -9.1, 1, 3, -9, [0.1, 0.1, 0.1]); H.box(hm, -2.6, 4, -6.05, -1.4, 5, -6, [0.1, 0.1, 0.1]); H.box(hm, 1.4, 4, -6.05, 2.6, 5, -6, [0.1, 0.1, 0.1]);
        H.box(hm, -3.5, 6, -2, -2, 7.5, -1, wh); H.box(hm, 2, 6, -2, 3.5, 7.5, -1, wh);
      } });
      return true;
    }
    case 'cloud_sheep': {
      const puff = sheared ? [0.82, 0.86, 0.95] : [0.97, 0.98, 1];
      quadModel(R, x, y + Math.sin(walk * 0.3) * 0.05, z, yaw, walk, L, hurt, { bw: 5, bl: 8, bh: 8, lh: 6, lw: 1.6, body: puff, leg: [0.7, 0.75, 0.85], extra: (H) => {
        if (!sheared) for (const [px, py, pz, r] of [[-4, 13, -5, 3], [4, 14, 0, 3.5], [-3, 15, 5, 3], [2, 15, -4, 2.5], [0, 16, 2, 3]]) H.box(H.base, px - r, py - r * 0.6, pz - r, px + r, py + r * 0.6, pz + r, [1, 1, 1], true);
        const hm = H.at(0, 11, -8, 0); H.box(hm, -3, -1, -6, 3, 5, 0, [0.72, 0.78, 0.92]);
        H.box(hm, -2.2, 2, -6.05, -1, 3, -6, [0.15, 0.2, 0.4]); H.box(hm, 1, 2, -6.05, 2.2, 3, -6, [0.15, 0.2, 0.4]);
      } });
      return true;
    }
    case 'turtle': {
      const [base] = mobBase(x, y, z, yaw), P = 1 / 16, tint = (c) => hurt ? [1, c[1] * 0.5, c[2] * 0.5] : c, sw = Math.sin(walk) * 3;
      const box = (a, b2, c2, d, e2, f, col) => R.ent.addBox(base, a * P, b2 * P, c2 * P, d * P, e2 * P, f * P, tint(col), L[0], L[1]);
      box(-8, 1, -8, 8, 6, 9, [0.3, 0.55, 0.3]); box(-6, 6, -6, 6, 8, 7, [0.35, 0.62, 0.32]);
      box(-2.5, 1, -13, 2.5, 5, -8, [0.55, 0.75, 0.45]); box(-2.6, 3, -12, -2.5, 4, -11, [0.1, 0.1, 0.1]); box(2.5, 3, -12, 2.6, 4, -11, [0.1, 0.1, 0.1]);
      for (const [lx, lz, s] of [[-9, -5, 1], [9, -5, -1], [-8, 6, -1], [8, 6, 1]]) box(lx - 2, 0, lz - 2 + sw * s * 0.3, lx + 2, 2, lz + 2 + sw * s * 0.3, [0.55, 0.75, 0.45]);
      return true;
    }
    case 'penguin': case 'frog': {
      const [base, t] = mobBase(x, y, z, yaw), P = 1 / 16, sw = Math.sin(walk);
      const tint = (c) => hurt ? [1, c[1] * 0.5, c[2] * 0.5] : c;
      const m = new Float32Array(base); M4.mul(m, m, M4.rotZ(M4.create(), sub === 'penguin' ? sw * 0.12 : 0));
      const box = (a, b2, c2, d, e2, f, col) => R.ent.addBox(m, a * P, b2 * P, c2 * P, d * P, e2 * P, f * P, tint(col), L[0], L[1]);
      if (sub === 'penguin') {
        box(-4, 2, -3, 4, 12, 3, [0.12, 0.12, 0.16]); box(-3, 3, -3.1, 3, 11, -3, [0.97, 0.97, 0.95]);
        box(-3.5, 12, -3, 3.5, 17, 3, [0.12, 0.12, 0.16]); box(-2.5, 14, -3.1, -1, 15, -3, [1, 1, 1]); box(1, 14, -3.1, 2.5, 15, -3, [1, 1, 1]);
        box(-1, 12.5, -5, 1, 13.5, -3, [1, 0.6, 0.15]); box(-5, 5, -1.5, -4, 11, 1.5, [0.12, 0.12, 0.16]); box(4, 5, -1.5, 5, 11, 1.5, [0.12, 0.12, 0.16]);
        box(-3, 0, -3.5, -0.5, 2, 0, [1, 0.6, 0.15]); box(0.5, 0, -3.5, 3, 2, 0, [1, 0.6, 0.15]);
      } else {
        const g = [0.45, 0.68, 0.3];
        box(-3.5, 1, -4, 3.5, 5, 4, g); box(-3, 5, -4, -1, 7, -2, g); box(1, 5, -4, 3, 7, -2, g);
        box(-2.5, 5.5, -4.1, -1.5, 6.5, -4, [0.1, 0.1, 0.1]); box(1.5, 5.5, -4.1, 2.5, 6.5, -4, [0.1, 0.1, 0.1]); box(-3, 2, -4.1, 3, 2.6, -4, [0.85, 0.5, 0.5]);
        box(-5, 0, 0, -2, 1.5, 5, g); box(2, 0, 0, 5, 1.5, 5, g); box(-4, 0, -4, -2, 1, -2, g); box(2, 0, -4, 4, 1, -2, g);
      }
      return true;
    }
    case 'parrot': case 'bee': case 'phoenix': case 'baby_dragon': {
      const [base, t] = mobBase(x, y, z, yaw), P = 1 / 16, flap = Math.sin(walk * (sub === 'bee' ? 6 : 2.2));
      const tint = (c) => hurt ? [1, c[1] * 0.5, c[2] * 0.5] : c;
      const box = (m, a, b2, c2, d, e2, f, col, lit) => R.ent.addBox(m, a * P, b2 * P, c2 * P, d * P, e2 * P, f * P, tint(col), lit ? 1 : L[0], lit ? 1 : L[1]);
      const wing = (side, len, w0, col, lit) => { const m = new Float32Array(base), tr = M4.create(); M4.translate(tr, side * w0 * P, 0, 0); M4.mul(m, m, tr); M4.mul(m, m, M4.rotZ(M4.create(), side * flap * 0.7)); box(m, side > 0 ? 0 : -len, -0.4, -3, side > 0 ? len : 0, 0.4, 4, col, lit); };
      if (sub === 'parrot') {
        const C = [[0.9, 0.15, 0.15], [0.2, 0.5, 0.95], [0.3, 0.8, 0.3], [0.95, 0.8, 0.2]][(e ? e.eid : 0) % 4];
        box(base, -2, -2, -3, 2, 3, 3, C); box(base, -1.8, 3, -3.5, 1.8, 7, 0.5, C); box(base, -0.8, 4, -5, 0.8, 5.5, -3.5, [0.95, 0.75, 0.2]);
        box(base, -1.9, 5, -2.5, -1.8, 6, -1.5, [0.05, 0.05, 0.05]); box(base, 1.8, 5, -2.5, 1.9, 6, -1.5, [0.05, 0.05, 0.05]);
        box(base, -1, -4, 3, 1, -1, 8, C); wing(-1, 5, 2, C.map(v => v * 0.8)); wing(1, 5, 2, C.map(v => v * 0.8));
      } else if (sub === 'bee') {
        const Y = [1, 0.82, 0.2], K = [0.12, 0.1, 0.08];
        box(base, -3, -3, -4, 3, 3, 4, Y); box(base, -3.05, -3.05, -1, 3.05, 3.05, 0.5, K); box(base, -3.05, -3.05, 2, 3.05, 3.05, 3.5, K);
        box(base, -2, 0, -4.1, -1, 1.5, -4, K); box(base, 1, 0, -4.1, 2, 1.5, -4, K); box(base, -0.3, -1, 4, 0.3, 0, 5.5, K);
        const wm = new Float32Array(base), tr = M4.create(); M4.translate(tr, 0, 3 * P, 0); M4.mul(wm, wm, tr);
        box(wm, -5, 0, -1, -1, 0.3 + flap * 0.3, 2, [0.85, 0.92, 1], true); box(wm, 1, 0, -1, 5, 0.3 + flap * 0.3, 2, [0.85, 0.92, 1], true);
      } else if (sub === 'phoenix') {
        const O = [1, 0.5, 0.12], RD = [0.95, 0.2, 0.1], YL = [1, 0.85, 0.3];
        box(base, -3, -3, -6, 3, 3, 6, O, true); box(base, -2.5, 2, -10, 2.5, 7, -5, RD, true); box(base, -1, 3, -12, 1, 5, -10, YL, true);
        box(base, -0.5, 7, -8, 0.5, 11, -6, YL, true);
        for (let k = 0; k < 3; k++) box(base, -1.5 + k, -1 - k, 6, -0.5 + k, 0 - k, 16 + k * 2, [RD, O, YL][k], true);
        wing(-1, 16, 3, O, true); wing(1, 16, 3, O, true);
      } else {
        const C = tamed ? [0.55, 0.35, 0.85] : [0.4, 0.7, 0.55], B = [0.95, 0.9, 0.6];
        box(base, -3, -3, -5, 3, 3, 5, C); box(base, -2.5, -2.8, -4, 2.5, -1.8, 4, B);
        box(base, -2.5, 1, -10, 2.5, 5.5, -4, C); box(base, -1.6, 1, -12.5, 1.6, 3.5, -10, C);
        box(base, -2.6, 3.5, -8.5, -1.6, 4.5, -7.5, [1, 0.85, 0.2], true); box(base, 1.6, 3.5, -8.5, 2.6, 4.5, -7.5, [1, 0.85, 0.2], true);
        box(base, -2, 5.5, -6, -1, 8, -5, B); box(base, 1, 5.5, -6, 2, 8, -5, B);
        box(base, -1, -1, 5, 1, 1, 13, C); box(base, -2, -0.2, 11, 2, 0.2, 14, B);
        wing(-1, 10, 3, C.map(v => v * 0.8)); wing(1, 10, 3, C.map(v => v * 0.8));
        for (const lx of [-2, 2]) box(base, lx - 1, -6, -2, lx + 1, -3, 1, C);
      }
      return true;
    }
  }
  return false;
}
{
  const _rmm = renderMobModel;
  renderMobModel = function (R, sub, x, y, z, yaw, walk, L, hurt, fuse) {
    if (renderNatureMob(R, sub, x, y, z, yaw, walk, L, hurt, null)) return;
    return _rmm(R, sub, x, y, z, yaw, walk, L, hurt, fuse);
  };
  const _render = Mob.prototype.render;
  Mob.prototype.render = function (g, R, cam) {
    if (renderNatureMob(R, this.sub, this.x - cam[0], this.y - cam[1], this.z - cam[2], this.yaw, this.walk, this.lightAt(g.world), this.hurtT > 0, this)) return;
    _render.call(this, g, R, cam);
  };
}

// ---------------- 게임: 상호작용 · 생성 · 아이템 효과 ----------------
{
  const G = Game.prototype;
  const tameTry = (g, ent, hd, p) => {
    const D = ent.def, chance = D.food && D.food[hd.name];
    if (chance === undefined) return false;
    p.consumeHeld(1); g.swing = 1; g.sound.play('eat', ent.x, ent.y + 1, ent.z);
    if (ent.tamed) { ent.hp = Math.min(D.hp, ent.hp + 4); g.particles.dust(ent.x, ent.y + ent.h, ent.z, [1, 0.5, 0.6]); return true; }
    if (Math.random() < chance) {
      ent.tamed = true; ent.owner = p.name; ent.sit = false; ent.panic = 0;
      for (let k = 0; k < 6; k++) g.particles.dust(ent.x + (Math.random() - 0.5), ent.y + ent.h + Math.random() * 0.5, ent.z + (Math.random() - 0.5), [1, 0.4, 0.55]);
      const msg = D.mount ? `💗 ${D.k}을(를) 길들였어요! 안장을 얹으면 탈 수 있어요` : ent.sub === 'baby_dragon' ? '🐉 아기 용이 친구가 됐어요! 몬스터에게 불꽃을 뿜어 줘요. 우클릭: 앉기/따라오기' : `💗 ${D.k}이(가) 친구가 됐어요!`;
      g.ui.toast(msg, 3500);
      if (ent.sub === 'baby_dragon') g.advGrant('dragon_pet');
    } else { g.particles.smoke(ent.x, ent.y + ent.h, ent.z, 5, [0.5, 0.5, 0.5]); g.ui.toast(`${D.k}이(가) 아직 경계해요… 한 번 더!`, 1300); }
    return true;
  };
  const _pu = G.playerUse;
  G.playerUse = function (hit, s, fresh) {
    const p = this.player, held = p.held, hd = held ? ITEMS[held.id] : null, ent = this.targetEnt;
    if (fresh && ent && ent.type === 'mob' && !ent.dead && MOB_TYPES[ent.sub]) {
      const D = MOB_TYPES[ent.sub], sub = ent.sub;
      if (ent.remote && (D.mount || D.food || sub === 'cloud_sheep')) { this.ui.toast('동물 길들이기·타기는 방장 세계에서만 돼요'); return; }
      if (sub === 'cloud_sheep' && hd && hd.name === 'shears') {
        if (!ent.sheared) { ent.sheared = true; ent.woolT = 90; this.dropItem(ent.x, ent.y + 1, ent.z, { id: BL.cloud_block, n: 1 + (Math.random() * 2 | 0) }); this.sound.play('break', ent.x, ent.y + 1, ent.z, { mat: 'wool' }); p.damageHeld(1); this.swing = 1; }
        return;
      }
      if (sub === 'unicorn' && ent.tamed && hd && hd.name === 'shears') {
        if ((ent.maneT || 0) > performance.now()) { this.ui.toast('🦄 갈기가 다시 자라는 중이에요 (조금 뒤에)'); return; }
        ent.maneT = performance.now() + 180000; this.dropItem(ent.x, ent.y + 1.5, ent.z, { id: I('rainbow_mane'), n: 1 + (Math.random() * 2 | 0) });
        for (let k = 0; k < 10; k++) this.particles.dust(ent.x + (Math.random() - 0.5), ent.y + 1.5 + Math.random(), ent.z + (Math.random() - 0.5), [Math.random(), Math.random(), 1]);
        this.sound.play('enchant', ent.x, ent.y + 1, ent.z); p.damageHeld(1); this.swing = 1; this.advGrant('rainbow'); return;
      }
      if (hd && D.food && D.food[hd.name] !== undefined && !(ent.tamed && D.mount && hd.name === 'saddle')) {
        if (sub === 'panda') { p.consumeHeld(1); this.sound.play('eat', ent.x, ent.y + 1, ent.z); ent.panic = 0; if (Math.random() < 0.3) { this.dropItem(ent.x, ent.y + 1, ent.z, { id: I('slime_ball'), n: 1 }); this.ui.toast('🐼 에취! 판다가 재채기를 했어요'); } else this.particles.dust(ent.x, ent.y + 1.5, ent.z, [0.6, 1, 0.6]); return; }
        if (sub === 'penguin') { p.consumeHeld(1); this.sound.play('eat', ent.x, ent.y + 1, ent.z); this.dropItem(ent.x, ent.y + 1, ent.z, { id: I('feather'), n: 1 }); this.ui.toast('🐧 펭귄이 고맙다고 깃털을 줬어요'); return; }
        if (tameTry(this, ent, hd, p)) return;
      }
      if (D.mount && ent.tamed) {
        if (!ent.saddled && hd && hd.name === 'saddle') { ent.saddled = true; p.consumeHeld(1); this.sound.play('place', ent.x, ent.y + 1, ent.z, { mat: 'wool' }); this.ui.toast('안장을 얹었어요! 우클릭하면 타요', 2000); return; }
        if (ent.saddled) { if (ent.rider) return; p.riding = ent; ent.rider = p; p.flying = false; this.ui.toast(`${D.k}을(를) 탔어요! W 앞으로 · Space 점프${ent.sub === 'unicorn' ? '(공중에서 한 번 더!)' : ''} · Shift 내리기`, 3000); this.advGrant('ride'); return; }
        this.ui.toast('안장이 있어야 탈 수 있어요 (가죽 3 + 철 주괴 1)'); return;
      }
      if (D.mount && !ent.tamed) { this.ui.toast(`${D.k}에게 먹이를 줘서 길들여요 (${Object.keys(D.food).slice(0, 3).map(n => itemName(I(n))).join('·')} 등)`, 2500); return; }
      if ((sub === 'baby_dragon' || sub === 'parrot') && ent.tamed && ent.owner === p.name) { ent.sit = !ent.sit; this.ui.toast(ent.sit ? '앉아!' : '따라와!', 900); return; }
    }
    // 빈 병·가위로 벌집
    if (fresh && hit && (hit.id === BL.bee_nest || hit.id === BL.beehive) && hd && (hd.name === 'glass_bottle' || hd.name === 'shears')) {
      const lv = hit.meta >> 3;
      if (lv < 5) { this.ui.toast(`🐝 꿀이 아직 덜 찼어요 (${lv}/5)`, 1500); return; }
      this.setBlockNet(hit.x, hit.y, hit.z, hit.id, hit.meta & 7);
      if (hd.name === 'glass_bottle') { p.consumeHeld(1); const left = p.give(I('honey_bottle'), 1); if (left) this.dropItem(p.x, p.y + 1, p.z, { id: I('honey_bottle'), n: 1 }); }
      else { this.dropItem(hit.x + 0.5, hit.y + 1, hit.z + 0.5, { id: I('honeycomb'), n: 3 }); p.damageHeld(1); }
      this.sound.play('splash', hit.x, hit.y, hit.z); this.swing = 1; this.advGrant('honey');
      // 벌이 잠깐 화냄
      for (const b of this.ents.list) if (b.sub === 'bee' && !b.dead && (b.x - hit.x) ** 2 + (b.z - hit.z) ** 2 < 100 && Math.random() < 0.3) { b.angry = 6; }
      this.ui.refreshHotbar(); return;
    }
    return _pu.call(this, hit, s, fresh);
  };
  // 벌집 우클릭: 꿀 상태
  const _ub = G.useBlock;
  G.useBlock = function (x, y, z, local, pid) {
    const id = this.world.getBlock(x, y, z);
    if (id === BL.bee_nest || id === BL.beehive) { if (local) this.ui.toast(`🐝 꿀 ${this.world.getMeta(x, y, z) >> 3}/5 · 꽉 차면 빈 병이나 가위를 써요`, 1800); return true; }
    return _ub.call(this, x, y, z, local, pid);
  };
  // 다 먹으면 병 남기기 (returns)
  const _int = G.interact;
  G.interact = function (dt, s) {
    const p = this.player, hd = p.held ? ITEMS[p.held.id] : null;
    const fin = hd && hd.returns && s.use && (p.food < 20 || p.creative || hd.heal) && this.eatT + dt >= 1.6;
    const r = _int.call(this, dt, s);
    if (fin && !p.creative) { if (!p.inv[p.sel]) p.inv[p.sel] = { id: I(hd.returns), n: 1 }; else p.give(I(hd.returns), 1); this.ui.refreshHotbar(); }
    return r;
  };
  // 탄 동물이 죽거나 사라지면 내리기, 안장 떨어뜨리기
  const _dmg = G.damageEntity;
  G.damageEntity = function (e, dmg, kx, kz, src) {
    if (e && e.rider === this.player && (src === 'player' || src === 'arrow')) return;   // 내가 탄 동물은 안 때림
    if (e && e.tamed && (src === 'pet')) return;
    const was = e && e.dead;
    _dmg.call(this, e, dmg, kx, kz, src);
    if (e && !was && e.dead) {
      if (e.rider) this.dismount(e.rider);
      if (e.saddled) this.dropItem(e.x, e.y + 0.5, e.z, { id: I('saddle'), n: 1 });
    }
  };
  // 동물 생성: 생물군계마다
  const SPAWN = {
    7: [['horse', 2, 3, 0.5], ['bee', 1, 2, 0.25], ['unicorn', 1, 1, 0.03]], 10: [['horse', 2, 3, 0.4], ['giraffe', 1, 2, 0.5]], 2: [['camel', 1, 2, 0.5], ['phoenix', 1, 1, 0.05]],
    9: [['panda', 1, 2, 0.5], ['parrot', 2, 3, 0.6]], 3: [['penguin', 3, 4, 0.6], ['polar_bear', 1, 1, 0.3]], 1: [['turtle', 2, 3, 0.6]],
    5: [['cloud_sheep', 2, 3, 0.6], ['baby_dragon', 1, 1, 0.08]], 6: [['cloud_sheep', 2, 3, 0.6], ['baby_dragon', 1, 1, 0.1]],
    12: [['unicorn', 1, 1, 0.25], ['bee', 2, 3, 0.5], ['baby_dragon', 1, 1, 0.06]], 13: [['phoenix', 1, 1, 0.3]], 11: [['frog', 2, 4, 0.7], ['turtle', 1, 2, 0.2]],
    4: [['bee', 1, 2, 0.2], ['horse', 1, 2, 0.15]], 8: [['bee', 1, 2, 0.3]],
  };
  const _sp = G.spawnMobs;
  G.spawnMobs = function () {
    _sp.call(this);
    const w = this.world; if (w.dim !== 'overworld' || !this.worldRules.mobs || w.dayFactor() < 0.5 || Math.random() > 0.35) return;
    const near = this.ents.count(e => e.type === 'mob' && e.def && (SPAWN_SUBS.has(e.sub)) && !e.tamed);
    if (near >= 12) return;
    const p = this.player, a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 24;
    const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
    if (!w.isLoadedAt(x, z)) return;
    const list = SPAWN[w.biomeAt(x, z)]; if (!list) return;
    const pick = list[Math.random() * list.length | 0], [sub, n0, n1, prob] = pick;
    if (Math.random() > prob || this.ents.count(e => e.sub === sub && !e.tamed) >= (sub === 'unicorn' || sub === 'phoenix' || sub === 'baby_dragon' ? 1 : 4)) return;
    const y = w.surfaceY(x, z), b = w.getBlock(x, y - 1, z), D = MOB_TYPES[sub];
    if (!b || IS_FLUID[b] && sub !== 'turtle' && sub !== 'frog' || (BLOCKS[b].wave === 1 && !D.fly)) return;
    for (let k = 0; k <= Math.ceil(D.h); k++) if (w.getBlock(x, y + k, z)) return;
    const n = n0 + (Math.random() * (n1 - n0 + 1) | 0);
    for (let i = 0; i < n; i++) {
      const e = this.ents.add(new Mob(sub, x + 0.5 + (Math.random() - 0.5) * 2, y + (D.fly ? D.flyH * 0.6 : 0), z + 0.5 + (Math.random() - 0.5) * 2));
      e.home = [x, z];
    }
  };
  // 거북 투구: 물속 숨 / 구름 부츠·구름·꿀·건초: 낙하 피해 없음 / 불사조 토템
  const P = Player.prototype;
  const _hurt = P.hurt;
  P.hurt = function (amount, src, kx, kz) {
    if (src === 'fall') {
      const b = this.armor && this.armor[3], g = this.game;
      if (b && ITEMS[b.id] && ITEMS[b.id].name === 'cloud_boots') return false;
      if (g && g.world) { const id = g.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.05), Math.floor(this.z)); if (id === BL.cloud_block || id === BL.honey_block) return false; if (id === BL.hay_block) amount *= 0.2; }
    }
    if (!this.creative && !this.dead && this.invul <= 0 && amount >= this.health && this.count(I('phoenix_totem')) > 0) {
      const r = _hurt.call(this, Math.max(0, this.health - 1), src, kx, kz);
      this.take(I('phoenix_totem'), 1);
      this.health = 12; this.invul = 2; this.fallDist = 0;
      const g = this.game;
      if (g) {
        for (let k = 0; k < 4; k++) g.particles.smoke(this.x, this.y + 1, this.z, 12, [1, 0.6 - k * 0.1, 0.15], true);
        g.sound.play('levelup'); g.sound.play('victory');
        g.ui.toast('🔥 불사조 토템이 나를 지켜 줬어요! (토템 하나를 썼어요)', 3500); g.advGrant('totem_saved');
        g.ui.refreshHotbar(); g.ui.refreshStats();
      }
      return r;
    }
    return _hurt.call(this, amount, src, kx, kz);
  };
  const _surv = P.survival;
  P.survival = function (dt, world) {
    const h = this.armor && this.armor[0];
    if (h && ITEMS[h.id] && ITEMS[h.id].name === 'turtle_helmet') this.air = 300;
    return _surv.call(this, dt, world);
  };
  // 꿀 블록: 느리고 낮게 뜀
  const _pupd = P.update;
  P.update = function (dt, input, world) {
    _pupd.call(this, dt, input, world);
    if (this.riding || this.flying) return;
    const id = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.05), Math.floor(this.z));
    if (id === BL.honey_block) { this.vx *= 0.82; this.vz *= 0.82; if (this.vy > 4.5) this.vy = 4.5; }
  };
  // 저장·불러오기: 지형 판(gen), 길들인 동물(안장 포함)
  const _sw = G.startWorld;
  G.startWorld = async function (opt) {
    this.worldGen = opt.rec ? (opt.rec.gen || 1) : opt.client ? (opt.client.gen || 1) : 2;
    return _sw.call(this, opt);
  };
  const _aw = G.attachWorld;
  G.attachWorld = function (w) { w.gen = this.worldGen || 1; return _aw.call(this, w); };
  const _ser = G.serializeWorld;
  G.serializeWorld = function () { const r = _ser.call(this); r.gen = this.worldGen || 1; return r; };
  G.collectPets = function () {
    const out = [];
    if (this.ents) for (const e of this.ents.list) if (!e.dead && e.tamed && !e.remote && NATURE_PETS.has(e.sub)) out.push({ sub: e.sub, x: +e.x.toFixed(2), y: +e.y.toFixed(2), z: +e.z.toFixed(2), sit: !!e.sit, owner: e.owner, hp: e.hp, saddled: !!e.saddled });
    return out;
  };
  const _ride = G.dismount;
  G.dismount = function (p) {
    const c = p.riding;
    if (c && c.type === 'mob') { c.rider = null; p.riding = null; p.x = c.x + 1.2; p.y = c.y + 0.6; p.vy = 3; return; }
    return _ride.call(this, p);
  };
}
const SPAWN_SUBS = new Set(['horse', 'camel', 'giraffe', 'unicorn', 'panda', 'polar_bear', 'penguin', 'turtle', 'frog', 'cloud_sheep', 'parrot', 'bee', 'phoenix', 'baby_dragon']);
// 길들인 동물 다시 불러오기 (vanilla.js 는 늑대만 알았음): sub·saddled 반영
{
  const _vt = Game.prototype.vanillaTick;
  Game.prototype.vanillaTick = function (dt) {
    const w = this.world, pend = this.petStore && this.petStore[w.dim];
    if (pend && pend.length && !w.remote) {
      for (let i = pend.length - 1; i >= 0; i--) {
        const s = pend[i]; if (!w.isLoadedAt(Math.floor(s.x), Math.floor(s.z))) continue;
        const e = this.ents.add(new Mob(MOB_TYPES[s.sub] ? s.sub : 'wolf', s.x, s.y + 0.1, s.z));
        e.tamed = true; e.owner = s.owner || this.player.name; e.sit = !!s.sit; e.hp = s.hp || e.hp; e.saddled = !!s.saddled;
        pend.splice(i, 1);
      }
    }
    return _vt.call(this, dt);
  };
}
// 도전 과제 더하기
ADV.push(
  ['ride', 'saddle', '이랴!', '말·낙타·기린·유니콘을 탔어요', null],
  ['honey', 'honey_bottle', '달콤한 꿀', '벌집에서 꿀이나 밀랍을 모았어요', null],
  ['rainbow', 'rainbow_mane', '무지개 손질', '유니콘의 무지개 갈기를 얻었어요', null],
  ['dragon_pet', 'golden_apple', '용의 친구', '아기 용을 길들였어요', null],
  ['phoenix', 'phoenix_feather', '불사조의 선물', '불사조 깃털을 얻었어요', ['phoenix_feather']],
  ['scute', 'turtle_scute', '바닷가 친구', '거북 껍데기 조각을 얻었어요', ['turtle_scute']],
  ['cloud', 'cloud_block', '구름 위로', '구름 블록을 얻었어요', ['cloud_block']],
);
