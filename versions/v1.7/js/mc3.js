'use strict';
// =====================================================================
// 에듀 크래프트: 원작 요소 3판 (v1.5) — 바다 · 동굴 · 하늘
//  - 지형 3판(새로 만든 세계만, world.gen >= 3): 바다에 다시마·해초·산호초(따뜻한 바다), 땅속에 협곡,
//    무성한 동굴(이끼·발광 열매 덩굴·진달래·흘림잎·물웅덩이), 자수정 정동. 옛 세계(gen 1·2)는 지형이 그대로
//  - 물·동굴 몹: 오징어(먹물) · 대구·연어·열대어(양동이로 잡기) · 돌고래(옆에서 헤엄 빨라짐) · 드라운드(삼지창)
//    · 박쥐 · 우파루파 · 슬라임(때리면 작게 나뉨) · 마녀(물약 던지기·마시기)
//  - 아이템: 겉날개(드래곤을 물리치면 엔드 상자) · 폭죽(겉날개 가속·불꽃놀이) · 삼지창(던지면 돌아옴)
//    · 망원경(확대) · 물고기·우파루파 양동이 · 먹물 주머니(검은 양털) · 자수정 조각 · 발광 열매
//  - 블록 235~250, 아이템 440~451. 지형 코드는 씨앗·청크 좌표만 씀(Math.random·게임 상태 없음 → 워커·참가자도 같은 지형)
//  - 맨 위 코드는 document·window 를 건드리지 않음 (워커에서 불러도 됨)
// =====================================================================
const MC3_WL = new Uint8Array(256);      // 물에 잠긴 블록 (다시마·해초·산호): 둘레의 물 면을 안 그림, 몸이 닿으면 물속
const MC3 = { g: null, untilt: [] };
const MC3_CORAL = [['관', [86, 128, 236]], ['뇌', [240, 132, 178]], ['거품', [178, 86, 214]], ['불', [232, 74, 64]], ['뿔', [242, 214, 72]]];

// ---------------- 텍스처 ----------------
function buildMc3Textures() {
  const it = (name, fn) => addTex(name, q => { q.clear(); fn(q); q.outline(); }, true);
  const dk = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // 다시마 (몸통·끝)
  const kelp = (name, top) => addTex(name, p => {
    p.clear();
    for (let y = top ? 3 : 0; y < 16; y++) {
      const x = 7 + Math.round(Math.sin(y * 0.7) * 1.2);
      p.rect(x, y, 2, 1, p.vary([72, 140, 58], 8));
      if (y % 4 === 1) { p.rect(x + 2, y, 3, 1, [96, 168, 72]); p.set(x + 4, y - 1, [96, 168, 72]); }
      if (y % 4 === 3) { p.rect(x - 3, y, 3, 1, [96, 168, 72]); p.set(x - 3, y - 1, [96, 168, 72]); }
    }
    if (top) { p.rect(7, 1, 2, 2, [120, 190, 92]); p.set(8, 0, [140, 200, 100]); }
  });
  kelp('kelp', false); kelp('kelp_top', true);
  // 해초
  const blades = (name, tall, cut) => addTex(name, p => {
    p.clear();
    for (const [x0, h, dx] of [[3, 11, 1], [6, 15, -1], [9, 13, 1], [12, 9, -1], [5, 7, 0], [11, 14, 0]]) {
      const hh = tall ? 16 : h - (cut || 0);
      for (let y = 0; y < hh; y++) p.set(x0 + Math.round(Math.sin(y * 0.45) * dx), 15 - y, p.vary(y > hh - 3 ? [110, 190, 80] : [70, 150, 60], 10));
    }
  });
  blades('seagrass', false); blades('seagrass_tb', true); blades('seagrass_tt', false, 2);
  // 산호 (블록·가지·부채)
  MC3_CORAL.forEach(([, c], i) => {
    addTex('coral_block_' + i, p => { p.noise(c, 10); for (let k = 0; k < 16; k++) { const x = p.r() * 15 | 0, y = p.r() * 15 | 0; p.set(x, y, dk(c, 0.72)); p.set(x + 1, y + 1, [Math.min(255, c[0] + 40), Math.min(255, c[1] + 40), Math.min(255, c[2] + 40)]); } });
    addTex('coral_' + i, p => {
      p.clear();
      p.line(8, 15, 8, 6, c, 2); p.line(8, 10, 4, 5, c, 1); p.line(8, 9, 12, 4, c, 1); p.line(4, 5, 3, 2, c, 1); p.line(12, 4, 13, 1, c, 1); p.line(8, 6, 7, 2, c, 1);
      for (const [x, y] of [[3, 2], [13, 1], [7, 2], [5, 8], [11, 7]]) p.set(x, y, [Math.min(255, c[0] + 50), Math.min(255, c[1] + 50), Math.min(255, c[2] + 50)]);
    });
    addTex('coral_fan_' + i, p => {
      p.clear();
      for (let y = 3; y < 15; y++) for (let x = 0; x < 16; x++) { const dx = x + 0.5 - 8, dy = y + 0.5 - 15; const d = Math.hypot(dx, dy); if (d < 11 && d > 2 && Math.abs(Math.atan2(dx, -dy)) < 1.15) p.set(x, y, (x + y) % 3 ? c : dk(c, 0.75)); }
      p.rect(7, 13, 2, 3, dk(c, 0.7));
    });
  });
  // 이끼·덩굴·진달래
  addTex('moss_block', p => { p.noise([92, 150, 58], 12); p.blobs(7, [118, 176, 72], 10, 0.6, 1.5); p.blobs(4, [74, 124, 48], 8, 0.4, 1); });
  const vine = (name, lit) => addTex(name, p => {
    p.clear();
    for (let y = 0; y < 16; y++) { const x = 7 + Math.round(Math.sin(y * 0.6) * 1.5); p.rect(x, y, 2, 1, p.vary([84, 136, 52], 8)); if (y % 3 === 0) p.rect(x + (y % 2 ? 2 : -2), y, 2, 1, [104, 160, 64]); }
    if (lit) for (const [x, y] of [[4, 4], [11, 9], [5, 12]]) { p.disc(x + 0.5, y + 0.5, 1.8, [255, 196, 70]); p.set(x, y, [255, 240, 170]); }
  });
  vine('cave_vines', false); vine('cave_vines_lit', true);
  const leaves = (name, flowers) => addTex(name, p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (p.r() < 0.05) continue; const k = p.r() < 0.3 ? 0.78 : 1; p.set(x, y, p.vary([96 * k, 158 * k, 62 * k], 12)); }
    if (flowers) for (let n = 0; n < 6; n++) { const x = p.r() * 14 | 0, y = p.r() * 14 | 0; p.set(x, y, [236, 120, 200]); p.set(x + 1, y, [236, 120, 200]); p.set(x, y + 1, [250, 190, 236]); }
  });
  leaves('azalea_leaves', false); leaves('azalea_leaves_f', true);
  addTex('azalea_top', p => { p.copy('azalea_leaves'); p.border([80, 130, 50]); for (let n = 0; n < 4; n++) p.set(p.r() * 14 + 1 | 0, p.r() * 14 + 1 | 0, [236, 120, 200]); });
  addTex('azalea_side', p => {
    p.clear();
    for (let y = 0; y < 9; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.vary([96, 158, 62], 12));
    for (let x = 0; x < 16; x++) p.set(x, 8, [76, 126, 48]);
    p.line(8, 15, 8, 9, [120, 90, 60], 2); p.line(8, 12, 4, 9, [120, 90, 60], 1); p.line(9, 12, 13, 9, [120, 90, 60], 1);
    p.set(3, 3, [236, 120, 200]); p.set(11, 5, [236, 120, 200]);
  });
  // 흘림잎
  addTex('dripleaf_top', p => { p.noise([110, 178, 64], 8); for (let i = 0; i < 16; i++) { p.set(i, 8, [86, 146, 50]); p.set(8, i, [86, 146, 50]); } p.border([84, 140, 48]); });
  addTex('dripleaf_stem', p => { p.clear(); p.rect(7, 0, 2, 16, [86, 146, 50]); p.rect(7, 0, 1, 16, [104, 166, 60]); });
  // 자수정
  addTex('amethyst_block', p => { p.noise([164, 112, 222], 10); for (let i = 0; i < 16; i += 5) { p.line(i, 0, i + 6, 15, [204, 164, 250], 1); p.line(i + 2, 0, i - 4, 15, [128, 82, 186], 1); } });
  addTex('budding_amethyst', p => { p.copy('amethyst_block'); for (const [x, y] of [[3, 3], [10, 4], [5, 10], [12, 11]]) { p.rect(x, y, 2, 2, [110, 62, 170]); p.set(x, y, [240, 210, 255]); } });
  for (let s = 0; s < 4; s++) addTex('amethyst_bud_' + s, p => {
    p.clear();
    // 송이 크기는 메시에서 키우므로 그림은 칸을 꽉 채움 (빛나도 하얗게 날아가지 않게 진한 보라)
    const list = s === 0 ? [[5, 16, 6]] : s === 1 ? [[5, 16, 5], [1, 10, 3], [12, 11, 3]] : [[6, 16, 4], [1, 12, 4], [11, 13, 4], [4, 8, 3], [10, 7, 2]];
    for (const [x, h, w] of list) for (let y = 0; y < h; y++) {
      const ww = Math.max(1, Math.round(w * Math.min(1, (h - y) / 4))), ox = x + ((w - ww) >> 1);
      p.rect(ox, 15 - y, ww, 1, y > h - 4 ? [212, 168, 250] : p.vary([138, 82, 198], 12));
      if (ww > 2) p.set(ox, 15 - y, [108, 60, 168]);
    }
  });
  addTex('calcite', p => { p.noise([230, 230, 224], 6); p.blobs(5, [212, 214, 206], 4, 0.5, 1.2); });
  addTex('smooth_basalt', p => { p.noise([76, 76, 84], 5); p.blobs(4, [66, 66, 74], 4, 0.6, 1.4); });
  addTex('tinted_glass', p => { p.fill([58, 44, 72]); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, [58, 44, 72], 175); p.border([96, 74, 116], 235); p.line(3, 3, 7, 7, [140, 120, 160], 1); });
  // 아이템
  it('ink_sac', p => { p.disc(8, 9.5, 5, [34, 34, 52]); p.disc(6.5, 7.5, 1.8, [80, 80, 110]); p.rect(7, 3, 2, 2, [44, 44, 62]); });
  const fishB = (name, col, col2) => addTex(name, p => { p.copy('water_bucket'); p.rect(5, 6, 5, 3, col); p.rect(10, 5, 2, 5, col2 || col); p.set(6, 6, [20, 20, 20]); }, true);
  fishB('cod_bucket', [196, 166, 120], [170, 140, 100]); fishB('salmon_bucket', [200, 90, 74], [160, 70, 60]); fishB('tropical_fish_bucket', [250, 140, 40], [255, 255, 255]);
  addTex('axolotl_bucket', p => { p.copy('water_bucket'); p.rect(5, 6, 6, 3, [250, 170, 196]); p.rect(4, 5, 1, 2, [230, 100, 150]); p.rect(11, 7, 2, 1, [250, 170, 196]); p.set(6, 6, [20, 20, 20]); }, true);
  it('tropical_fish', p => { p.disc(7, 8, 4.5, [250, 140, 40]); p.rect(6, 4, 2, 8, [255, 255, 255]); p.rect(11, 6, 3, 5, [255, 255, 255]); p.set(4, 7, [20, 20, 20]); });
  it('amethyst_shard', p => { for (let k = 0; k < 9; k++) { p.rect(5 + k * 0.6 | 0, 12 - k, 4 - Math.abs(k - 4) * 0.4 | 0, 1, k > 6 ? [236, 206, 255] : [176, 120, 232]); } p.line(6, 12, 10, 4, [130, 80, 190], 1); });
  it('spyglass', p => { p.line(3, 13, 11, 5, [196, 150, 70], 2); p.line(3, 12, 10, 5, [236, 196, 110], 1); p.rect(11, 3, 3, 3, [176, 120, 232]); p.set(12, 4, [236, 206, 255]); p.rect(6, 9, 2, 2, [140, 100, 50]); });
  it('elytra', p => {
    for (let y = 2; y < 15; y++) { const w = Math.round(2 + (y < 8 ? y * 0.6 : (15 - y) * 0.7)); p.rect(7 - w, y, w, 1, p.vary([150, 150, 186], 6)); p.rect(9, y, w, 1, p.vary([150, 150, 186], 6)); }
    p.line(7, 2, 3, 12, [110, 110, 146], 1); p.line(9, 2, 13, 12, [110, 110, 146], 1); p.rect(7, 2, 2, 3, [96, 96, 130]);
  });
  it('firework_rocket', p => { p.rect(6, 4, 4, 8, [220, 60, 60]); p.rect(6, 6, 4, 1, [250, 230, 230]); p.rect(6, 9, 4, 1, [250, 230, 230]); p.rect(7, 2, 2, 2, [240, 240, 240]); p.line(8, 12, 8, 15, [150, 110, 60], 1); });
  it('trident', p => { p.line(3, 14, 11, 6, [70, 190, 180], 2); p.line(10, 3, 13, 6, [140, 230, 220], 1); p.line(10, 3, 9, 1, [140, 230, 220], 1); p.line(13, 6, 15, 5, [140, 230, 220], 1); p.line(11, 5, 13, 2, [180, 245, 240], 1); });
  it('glow_berries', p => { p.line(8, 2, 8, 6, [90, 140, 50], 1); for (const [x, y] of [[6, 8], [10, 9], [8, 12]]) { p.disc(x, y, 2.6, [255, 190, 64]); p.set(x - 1 | 0, y - 1 | 0, [255, 240, 180]); } });
}

// ---------------- 블록 (235~250) ----------------
function defineMc3Blocks() {
  const b = defBlock;
  // 물에 잠긴 식물: 고체 아님, 물이 밀고 들어오지 않음(push 'block'), 빛은 물처럼 조금 줄어듦
  const wet = (id, name, k, o) => { const d = b(id, name, k, Object.assign({ solid: false, opaque: false, opacity: 2, layer: 1, hard: 0, sound: 'grass', cat: 'nature', push: 'block', conductor: false, mc3water: true, mc3sup: 0, mc3box: plantBox }, o)); MC3_WL[id] = 1; return d; };
  const plantBox = (m, sel) => sel ? [[0.15, 0, 0.15, 0.85, 0.8, 0.85]] : null;
  const kd = wet(235, 'kelp', '다시마', { shape: 'mc3kelp', tex: faces('kelp'), icon: 'kelp_top', wave: 2, desc: '바닷속에서 길게 자라요. 물속에만 심을 수 있어요.' });
  kd.mc3tex = [T('kelp'), T('kelp_top')];
  wet(236, 'seagrass', '해초', { shape: 'cross', wave: 2, icon: 'seagrass', texf: (m) => T(m === 1 ? 'seagrass_tb' : m === 2 ? 'seagrass_tt' : 'seagrass'), drop: (m, rnd) => rnd() < 0.5 ? [[BL.seagrass, 1]] : [], desc: '바다 밑에 하늘하늘. 물속에만 심을 수 있어요.' });
  // 산호 meta: 0~4 색, +8 부채
  wet(238, 'coral', '산호', { shape: 'cross', icon: 'coral_0', texf: (m) => T(((m & 8) ? 'coral_fan_' : 'coral_') + Math.min(4, m & 7)), desc: '따뜻한 바다의 산호초에서 자라요. 놓을 때마다 색이 달라요! (물속에만)' });
  b(237, 'coral_block', '산호 블록', { texf: (m) => T('coral_block_' + Math.min(4, m & 7)), hard: 1.5, tool: 'pick', cat: 'nature', desc: '알록달록 산호 블록. 놓을 때마다 색이 달라져요.' });
  b(239, 'moss_block', '이끼 블록', { tex: faces('moss_block'), hard: 0.1, tool: 'hoe', sound: 'grass', cat: 'nature', desc: '무성한 동굴의 폭신한 이끼. 위에 풀·꽃을 심을 수 있어요.' });
  b(240, 'moss_carpet', '이끼 카펫', { tex: faces('moss_block'), shape: 'mc3carpet', opaque: false, hard: 0.1, sound: 'grass', cat: 'build', conductor: false, mc3sup: 0, mc3box: () => [[0, 0, 0, 1, 1 / 16, 1]] });
  // 발광 열매 덩굴 meta bit0: 열매 (빛남)
  b(241, 'cave_vines', '동굴 덩굴', { shape: 'cross', solid: false, opaque: false, layer: 1, hard: 0, sound: 'grass', climb: true, push: 'break', cat: 'nature', icon: 'cave_vines_lit', use: 'mc3vine', mc3sup: 1, mc3box: plantBox,
    texf: (m) => T(m & 1 ? 'cave_vines_lit' : 'cave_vines'), emit: (m) => m & 1 ? 14 : 0, emissiveF: (m) => !!(m & 1),
    drop: (m) => m & 1 ? [[I('glow_berries'), 1]] : [], desc: '동굴 천장에 매달린 덩굴. 빛나는 열매를 오른쪽 클릭으로 따요. 사다리처럼 오를 수 있어요.' });
  b(242, 'azalea', '진달래', { opaque: false, layer: 1, hard: 0.1, sound: 'grass', cat: 'nature', conductor: false, texf: (m, f) => T(f === 1 || f === 0 ? 'azalea_top' : 'azalea_side'), desc: '무성한 동굴 근처에 자라는 동글동글 덤불.' });
  // 진달래 잎 meta bit0: 놓은 것, bit1: 꽃
  b(243, 'azalea_leaves', '진달래 잎', { opaque: false, opacity: 1, layer: 1, hard: 0.2, sound: 'grass', wave: 1, cat: 'nature', conductor: false, texf: (m) => T(m & 2 ? 'azalea_leaves_f' : 'azalea_leaves'),
    drop: (m, rnd) => rnd() < 0.1 ? [[BL.azalea, 1]] : [] });
  b(244, 'amethyst_block', '자수정 블록', { tex: faces('amethyst_block'), hard: 1.5, tool: 'pick', sound: 'glass', cat: 'build' });
  b(245, 'budding_amethyst', '싹트는 자수정', { tex: faces('budding_amethyst'), hard: 1.5, tool: 'pick', sound: 'glass', cat: 'nature', drop: () => [], desc: '정동 안에 있어요. 곁에 자수정 송이가 천천히 자라요. 캐면 사라지니 그대로 두세요!' });
  // 자수정 송이 meta: bit0~2 붙은 방향, bit3~4 크기(0 작은 싹 ~ 3 송이)
  const bd = b(246, 'amethyst_cluster', '자수정 송이', { shape: 'mc3bud', solid: false, opaque: false, layer: 1, hard: 0.6, tool: 'pick', sound: 'glass', cat: 'nature', icon: 'amethyst_bud_3', mc3sup: 'meta', conductor: false,
    texf: (m) => T('amethyst_bud_' + ((m >> 3) & 3)), emit: (m) => [2, 3, 4, 5][(m >> 3) & 3], emissiveF: () => true,
    mc3box: (m, sel) => sel ? [[0.2, 0.2, 0.2, 0.8, 0.8, 0.8]] : null,
    drop: (m, rnd) => { const s = (m >> 3) & 3; return s === 3 ? [[I('amethyst_shard'), 2 + (rnd() * 3 | 0)]] : s === 2 ? [[I('amethyst_shard'), 1]] : []; },
    desc: '반짝이는 자수정. 다 자란 송이를 캐면 자수정 조각이 나와요.' });
  bd.mc3tex = [0, 1, 2, 3].map(s => T('amethyst_bud_' + s));
  b(247, 'calcite', '방해석', { tex: faces('calcite'), hard: 0.75, tool: 'pick', lvl: 1, cat: 'nature' });
  b(248, 'smooth_basalt', '매끄러운 현무암', { tex: faces('smooth_basalt'), hard: 1.25, tool: 'pick', lvl: 1, cat: 'nature' });
  b(249, 'tinted_glass', '색유리(빛 막음)', { tex: faces('tinted_glass'), opaque: false, opacity: 15, layer: 1, hard: 0.3, sound: 'glass', conductor: false, cat: 'build', desc: '밖은 보이지만 빛은 막아요. 자수정 조각 4 + 유리.' });
  // 흘림잎 meta bit0: 잎(위), bit1: 기울어짐(잠깐 밟을 수 없음)
  const dl = b(250, 'big_dripleaf', '큰 흘림잎', { shape: 'mc3drip', solid: true, opaque: false, layer: 1, hard: 0.1, sound: 'grass', cat: 'nature', icon: 'dripleaf_top', conductor: false, mc3sup: 0,
    texf: (m) => T(m & 1 ? 'dripleaf_top' : 'dripleaf_stem'),
    mc3box: (m, sel) => (m & 1) ? ((m & 2) && !sel ? null : [[0, 14 / 16, 0, 1, 15 / 16, 1]]) : (sel ? [[0.3, 0, 0.3, 0.7, 1, 0.7]] : null),
    desc: '무성한 동굴의 큰 잎. 올라서면 잠시 뒤 기울어져요!' });
  dl.mc3tex = [T('dripleaf_stem'), T('dripleaf_top')];
}
function defineMc3Items() {
  const it = defItem;
  it(440, 'ink_sac', '먹물 주머니', { desc: '오징어가 떨어뜨려요. 흰 양털과 섞으면 검은 양털!' });
  it(441, 'cod_bucket', '대구 양동이', { stack: 1, cat: 'tools', mc3fish: 'cod', desc: '물과 함께 대구를 놓아 줘요.' });
  it(442, 'salmon_bucket', '연어 양동이', { stack: 1, cat: 'tools', mc3fish: 'salmon', desc: '물과 함께 연어를 놓아 줘요.' });
  it(443, 'tropical_fish_bucket', '열대어 양동이', { stack: 1, cat: 'tools', mc3fish: 'tropical_fish', desc: '물과 함께 열대어를 놓아 줘요. 수족관을 만들어 봐요!' });
  it(444, 'axolotl_bucket', '우파루파 양동이', { stack: 1, cat: 'tools', mc3fish: 'axolotl', desc: '물과 함께 우파루파를 놓아 줘요. 드라운드를 혼내 줘요!' });
  it(445, 'tropical_fish', '열대어', { food: 1, sat: 0.2, cat: 'food' });
  it(446, 'amethyst_shard', '자수정 조각', { desc: '정동의 자수정 송이에서 나와요. 망원경·색유리 재료.' });
  it(447, 'spyglass', '망원경', { stack: 1, cat: 'tools', desc: '오른쪽 버튼을 누르고 있으면 멀리 확대해서 봐요.' });
  it(448, 'elytra', '겉날개', { stack: 1, cat: 'tools', dur: 600, armor: { slot: 1, def: 0, mat: 0 }, desc: '몸(갑옷 칸)에 입고 공중에서 Space를 한 번 더! 활공하며 날아요. 폭죽을 쓰면 슝~ 빨라져요.' });
  it(449, 'firework_rocket', '폭죽', { cat: 'tools', desc: '땅에 대고 오른쪽 클릭하면 펑! 겉날개로 날 때 쓰면 앞으로 쭉 나가요.' });
  it(450, 'trident', '삼지창', { stack: 1, cat: 'tools', dur: 250, dmg: 8, desc: '오른쪽 버튼을 꾹 눌렀다 떼면 던져요. 던진 삼지창은 다시 돌아와요!' });
  it(451, 'glow_berries', '발광 열매', { food: 2, sat: 0.4, cat: 'food', places: BL.cave_vines, desc: '빛나는 달콤한 열매. 동굴 천장에 심으면 덩굴이 자라요.' });
}
function defineMc3Recipes() {
  S(['ink_sac', 'wool_white'], 'wool_black');
  R(['A', 'C', 'C'], { A: 'amethyst_shard', C: 'copper_ingot' }, 'spyglass');
  S(['paper', 'gunpowder'], 'firework_rocket', 3);
  R(['SS', 'SS'], { S: 'amethyst_shard' }, 'amethyst_block');
  R([' S ', 'SGS', ' S '], { S: 'amethyst_shard', G: 'glass' }, 'tinted_glass', 2);
  R(['MM'], { M: 'moss_block' }, 'moss_carpet', 3);
  S(['moss_block', 'cobblestone'], 'mossy_cobblestone');
  ITEMS[I('elytra')].armor.mat = ARMOR_MATS.push({ n: 'elytra', k: '겉날개', col: [0.62, 0.62, 0.78] }) - 1;
}
function defineMc3Smelting() {
  FUEL[BL.azalea] = 100; FUEL[BL.big_dripleaf] = 50;
}

// ---------------- 지형 3판 ----------------
// 이끼로 바꿀 수 있는 돌·흙
const MC3_MOSSABLE = new Uint8Array(256);
function mc3Tables() {
  if (MC3_MOSSABLE[BL.stone]) return;
  for (const n of ['stone', 'dirt', 'gravel', 'deepslate', 'cobbled_deepslate', 'andesite', 'granite', 'diorite', 'tuff']) if (BL[n] !== undefined) MC3_MOSSABLE[BL[n]] = 1;
}
// 정동: 청크 25개 중 하나쯤, 청크 안쪽에 완전히 들어가게
function mc3GeodeAt(seed, cx, cz) {
  const h = hashInt(cx, 913, cz, seed);
  if ((h & 1023) > 42) return null;
  const r = mulberry32(h);
  return { x: cx * 16 + 6 + (r() * 4 | 0), y: 12 + (r() * 28 | 0), z: cz * 16 + 6 + (r() * 4 | 0), R: 5 + r() * 0.9, seed: h };
}
function mc3LushV(w, x, z) { const n = w._mc3Lush || (w._mc3Lush = new Noise(w.seed + 61)); return n.fbm2(x / 170, z / 170, 2); }
// 협곡: 128칸 칸마다 30% 확률로 하나 (경로를 세계에 기억)
const MC3_RAV = 128;
function mc3Ravine(w, gx, gz) {
  const cache = w._mc3Rav || (w._mc3Rav = new Map()), key = gx * 65536 + gz;
  let v = cache.get(key);
  if (v !== undefined) return v;
  const r = mulberry32(hashInt(gx, 701, gz, w.seed));
  v = null;
  if (r() < 0.3) {
    let x = gx * MC3_RAV + r() * MC3_RAV, z = gz * MC3_RAV + r() * MC3_RAV, ang = r() * 6.283;
    const len = 44 + (r() * 46 | 0), y0 = 24 + r() * 20, wid = 1.7 + r() * 1.4, hh = 10 + r() * 8, dang = (r() - 0.5) * 0.05;
    const pts = []; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < len; i++) {
      const s = Math.sin(i / len * Math.PI), rw = wid * (0.45 + 0.8 * s) + 0.4;
      pts.push(x, z, rw, hh * (0.45 + 0.55 * s), y0 + Math.sin(i * 0.11) * 3);
      x0 = Math.min(x0, x - rw); x1 = Math.max(x1, x + rw); z0 = Math.min(z0, z - rw); z1 = Math.max(z1, z + rw);
      x += Math.cos(ang); z += Math.sin(ang); ang += dang + (r() - 0.5) * 0.08;
    }
    v = { pts, x0, x1, z0, z1 };
  }
  if (cache.size > 400) cache.clear();
  cache.set(key, v);
  return v;
}
function mc3Ravines(w, c, cols) {
  const bx = c.cx * 16, bz = c.cz * 16, ids = c.ids;
  const ga = Math.floor((bx - 100) / MC3_RAV), gb = Math.floor((bx + 116) / MC3_RAV), ha = Math.floor((bz - 100) / MC3_RAV), hb = Math.floor((bz + 116) / MC3_RAV);
  for (let gx = ga; gx <= gb; gx++) for (let gz = ha; gz <= hb; gz++) {
    const rv = mc3Ravine(w, gx, gz);
    if (!rv || rv.x1 < bx || rv.x0 > bx + 16 || rv.z1 < bz || rv.z0 > bz + 16) continue;
    const P = rv.pts;
    for (let k = 0; k < P.length; k += 5) {
      const px = P[k], pz = P[k + 1], rw = P[k + 2], rh = P[k + 3], py = P[k + 4];
      if (px + rw < bx || px - rw > bx + 16 || pz + rw < bz || pz - rw > bz + 16) continue;
      const xa = Math.max(0, Math.floor(px - rw - bx)), xb = Math.min(15, Math.ceil(px + rw - bx)), za = Math.max(0, Math.floor(pz - rw - bz)), zb = Math.min(15, Math.ceil(pz + rw - bz));
      for (let lx = xa; lx <= xb; lx++) for (let lz = za; lz <= zb; lz++) {
        const dx = (bx + lx + 0.5 - px) / rw, dz = (bz + lz + 0.5 - pz) / rw, hd = dx * dx + dz * dz;
        if (hd > 1) continue;
        const col = cols[lx | lz << 4], top = Math.min(col.h - 5, Math.floor(py + rh * Math.sqrt(1 - hd)));
        const bot = Math.max(5, Math.ceil(py - rh * 0.6 * Math.sqrt(1 - hd)));
        for (let y = bot; y <= top; y++) {
          const i = CI(lx, y, lz), id = ids[i];
          if (id === 0 || id === BL.bedrock || id === BL.water || id === BL.ice || id === BL.lava) continue;
          if (ids[i + 256] === BL.water) continue;
          ids[i] = y <= 10 ? BL.lava : 0; c.meta[i] = 0;
        }
      }
    }
  }
}
function mc3Geode(w, c, cols) {
  const G = mc3GeodeAt(w.seed, c.cx, c.cz); if (!G) return;
  const bx = c.cx * 16, bz = c.cz * 16, ids = c.ids, meta = c.meta, cx = G.x - bx, cz = G.z - bz;
  if (G.y + 8 >= cols[cx | cz << 4].h) return;
  const R = G.R, n = Math.ceil(R + 1), rnd = mulberry32(G.seed ^ 0x5bd1e995);
  const bud = [];
  for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) for (let dz = -n; dz <= n; dz++) {
    const x = cx + dx, y = G.y + dy, z = cz + dz;
    if (x < 0 || x > 15 || z < 0 || z > 15 || y < 2) continue;
    const d = Math.sqrt(dx * dx + dy * dy * 1.1 + dz * dz) + (hash01(bx + x, y, bz + z, G.seed) - 0.5) * 0.7;
    if (d > R + 0.4) continue;
    const i = CI(x, y, z); if (ids[i] === BL.bedrock) continue;
    meta[i] = 0;
    if (d > R - 0.8) ids[i] = BL.smooth_basalt;
    else if (d > R - 1.7) ids[i] = BL.calcite;
    else if (d > R - 2.7) { if (rnd() < 0.12) { ids[i] = BL.budding_amethyst; bud.push(x, y, z); } else ids[i] = BL.amethyst_block; }
    else ids[i] = 0;
  }
  // 싹트는 자수정 곁 빈칸에 송이
  for (let k = 0; k < bud.length; k += 3) for (let d = 0; d < 6; d++) {
    const x = bud[k] + DX[d], y = bud[k + 1] + DY[d], z = bud[k + 2] + DZ[d];
    if (x < 0 || x > 15 || z < 0 || z > 15) continue;
    const i = CI(x, y, z); if (ids[i] !== 0 || rnd() > 0.55) continue;
    const r = rnd(); ids[i] = BL.amethyst_cluster; meta[i] = OPP[d] | ((r < 0.4 ? 3 : r < 0.6 ? 2 : r < 0.8 ? 1 : 0) << 3);
  }
}
function mc3Lush(w, c, cols) {
  const bx = c.cx * 16, bz = c.cz * 16;
  if (mc3LushV(w, bx + 8, bz + 8) < 0.2) return;
  const ids = c.ids, meta = c.meta, seed = w.seed, M = MC3_MOSSABLE;
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const v = mc3LushV(w, bx + x, bz + z); if (v < 0.3) continue;
    const col = cols[x | z << 4], top = Math.min(col.h - 6, 72);
    // 땅 위에 진달래 (아래에 무성한 동굴이 있다는 표시)
    if (v > 0.38 && col.h > SEA && col.h + 1 < HEIGHT && ids[CI(x, col.h, z)] === BL.grass && !ids[CI(x, col.h + 1, z)] && hash01(bx + x, 79, bz + z, seed) < 0.012) ids[CI(x, col.h + 1, z)] = BL.azalea;
    for (let y = 4; y <= top; y++) {
      const i = CI(x, y, z); if (ids[i] !== 0) continue;
      const below = ids[i - 256], above = ids[i + 256];
      if (M[below]) {
        const r = hash01(bx + x, y, bz + z, seed + 77);
        // 물웅덩이 (우파루파 집)
        if (r > 0.93 && x > 0 && x < 15 && z > 0 && z < 15 && ids[i - 512] && ids[i - 255] && ids[i - 257] && ids[i - 240] && ids[i - 272]) { ids[i - 256] = BL.water; meta[i - 256] = 0; ids[i - 512] = BL.clay; continue; }
        ids[i - 256] = r < 0.85 ? BL.moss_block : BL.clay;
        if (r < 0.07) ids[i] = BL.moss_carpet;
        else if (r < 0.1) ids[i] = BL.azalea;
        else if (r < 0.13 && !ids[i + 256] && !ids[i + 512]) {
          const hs = 1 + ((r * 1000) | 0) % 3; let k = 0;
          for (; k < hs && !ids[i + (k + 1) * 256] && y + k + 1 < top; k++) ids[i + k * 256] = BL.big_dripleaf;
          ids[i + k * 256] = BL.big_dripleaf; meta[i + k * 256] = 1;
        }
        else if (r < 0.24) ids[i] = BL.tallgrass;
      }
      if (M[above]) {
        const r2 = hash01(bx + x, y, bz + z, seed + 78);
        if (r2 < 0.55) ids[i + 256] = BL.moss_block;
        if (r2 < 0.11 && ids[i] === 0) {
          const len = 1 + (((r2 * 9973) | 0) % 4);
          for (let k = 0; k < len && y - k > 3; k++) { const j = i - k * 256; if (ids[j] !== 0) break; ids[j] = BL.cave_vines; meta[j] = hash01(bx + x, y - k, bz + z, seed + 79) < 0.4 ? 1 : 0; }
        }
      }
    }
  }
}
function mc3Ocean(w, c, cols) {
  let any = false;
  for (let i = 0; i < 256; i += 17) if (cols[i].h < SEA - 2) { any = true; break; }
  if (!any) for (let i = 0; i < 256; i++) if (cols[i].h < SEA - 2) { any = true; break; }
  if (!any) return;
  const bx = c.cx * 16, bz = c.cz * 16, ids = c.ids, meta = c.meta, seed = w.seed;
  const temp = w.nT.fbm2((bx + 8) / 800, (bz + 8) / 800, 2), warm = temp > 0.2;
  const nr = w._mc3Reef || (w._mc3Reef = new Noise(seed + 62));
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const h = cols[x | z << 4].h; if (h >= SEA - 2) continue;
    const fi = CI(x, h, z), fid = ids[fi];
    if (!fid || !BLOCKS[fid].solid || ids[fi + 256] !== BL.water) continue;
    let wt = h + 1; while (wt < HEIGHT - 1 && ids[CI(x, wt + 1, z)] === BL.water) wt++;   // 맨 위 물 칸
    const depth = wt - h, r = hash01(bx + x, 91, bz + z, seed);
    if (warm && depth >= 3 && depth <= 18 && nr.n2((bx + x) / 13, (bz + z) / 13) > -0.1) {
      // 산호초
      const cc = Math.floor((nr.n2((bx + x) / 5 + 40, (bz + z) / 5) + 1) * 2.5) % 5;
      ids[fi] = BL.coral_block; meta[fi] = cc;
      let t = h;
      if (r < 0.2 && depth >= 5) { const hh = 1 + ((r * 1000) | 0) % 3; for (let k = 1; k <= hh && h + k < wt - 1; k++) { ids[fi + k * 256] = BL.coral_block; meta[fi + k * 256] = (cc + k) % 5; t = h + k; } }
      if (t + 1 < wt) {
        const j = CI(x, t + 1, z), r2 = hash01(bx + x, 92, bz + z, seed);
        if (r2 < 0.42) { ids[j] = BL.coral; meta[j] = ((cc + (r2 * 10 | 0)) % 5) | (r2 < 0.18 ? 8 : 0); }
        else if (r2 < 0.6) { ids[j] = BL.seagrass; meta[j] = 0; }
      }
      continue;
    }
    if (depth >= 2 && r < 0.22) {
      const j = fi + 256;
      if (depth >= 3 && r < 0.07) { ids[j] = BL.seagrass; meta[j] = 1; ids[j + 256] = BL.seagrass; meta[j + 256] = 2; }
      else { ids[j] = BL.seagrass; meta[j] = 0; }
      continue;
    }
    if (!warm && depth >= 4 && r > 0.93) {
      const len = 1 + ((hashInt(bx + x, 93, bz + z, seed) >>> 3) % (depth - 2));
      for (let k = 1; k <= len && h + k < wt; k++) { ids[fi + k * 256] = BL.kelp; meta[fi + k * 256] = 0; }
    }
  }
}
{
  const _st = World.prototype.structures;
  World.prototype.structures = function (c, cols) {
    if ((this.gen || 1) >= 3 && this.dim === 'overworld' && this.type !== 'flat') {
      mc3Tables();
      mc3Ravines(this, c, cols); mc3Geode(this, c, cols); mc3Lush(this, c, cols); mc3Ocean(this, c, cols);
    }
    return _st.call(this, c, cols);
  };
}

// ---------------- 물에 잠긴 블록: 메시 · 충돌 · 물속 판정 ----------------
if (typeof Mesher !== 'undefined') {
  const MP = Mesher.prototype, _fl = MP.fluid, _cu = MP.custom, SAVE = new Uint8Array(6);
  // 물 옆의 다시마·해초는 물로 보고 경계 면을 안 그림 (물속에 구멍이 보이지 않게)
  MP.fluid = function (x, y, z, pi, id, meta, d) {
    if (id === BL.water) {
      let sw = 0;
      for (let f = 0; f < 6; f++) { const ni = pi + NOFF[f]; if (MC3_WL[P_ID[ni]]) { sw |= 1 << f; SAVE[f] = P_ID[ni]; P_ID[ni] = id; } }
      if (sw) { _fl.call(this, x, y, z, pi, id, meta, d); for (let f = 0; f < 6; f++) if (sw & (1 << f)) P_ID[pi + NOFF[f]] = SAVE[f]; return; }
    }
    return _fl.call(this, x, y, z, pi, id, meta, d);
  };
  MP.custom = function (x, y, z, pi, id, meta, d) {
    const s = d.shape;
    if (s === 'mc3kelp') return mc3Cross(this, x, y, z, pi, d.mc3tex[P_ID[pi + PXZ] === id ? 0 : 1], 2 << 3, 1);
    if (s === 'mc3carpet') return this.box(this.bufs[d.layer], x, y, z, pi, [0, 0, 0, 1, 1 / 16, 1], d.tex);
    if (s === 'mc3bud') return mc3Bud(this, x, y, z, pi, meta, d);
    if (s === 'mc3drip') {
      if (meta & 1) {
        const L = d.mc3tex[1];
        this.box(this.bufs[1], x, y, z, pi, (meta & 2) ? [0, 11 / 16, 0, 1, 12 / 16, 1] : [0, 14 / 16, 0, 1, 15 / 16, 1], [L, L, L, L, L, L], { cull: false });
        return mc3Cross(this, x, y, z, pi, d.mc3tex[0], 0, (meta & 2) ? 11 / 16 : 14 / 16);
      }
      return mc3Cross(this, x, y, z, pi, d.mc3tex[0], 0, 1);
    }
    return _cu.call(this, x, y, z, pi, id, meta, d);
  };
}
const MC3_UV = [[0, 1], [1, 1], [1, 0], [0, 0]];
function mc3Cross(M, x, y, z, pi, layer, flags, h) {
  const buf = M.bufs[1], L = P_LIGHT[pi], a = 0.15, b = 0.85, uvs = h < 1 ? [[0, 1], [1, 1], [1, 1 - h], [0, 1 - h]] : MC3_UV;
  M.quad(buf, x, y, z, [[a, 0, a], [b, 0, b], [b, h, b], [a, h, a]], uvs, layer, flags | 129, L, true, null);
  M.quad(buf, x, y, z, [[a, 0, b], [b, 0, a], [b, h, a], [a, h, b]], uvs, layer, flags | 129, L, true, null);
}
// 자수정 송이: 붙은 면에서 바깥쪽으로 X자
function mc3Bud(M, x, y, z, pi, meta, d) {
  const up = OPP[meta & 7], sz = (meta >> 3) & 3, h = [0.32, 0.46, 0.62, 0.86][sz], wd = [0.24, 0.3, 0.36, 0.42][sz], a = 0.5 - wd, b = 0.5 + wd;
  const mp = (p) => { const u = p[0], k = p[1], v = p[2]; switch (up) { case 1: return [u, k, v]; case 0: return [u, 1 - k, v]; case 2: return [u, v, 1 - k]; case 3: return [u, v, k]; case 4: return [1 - k, u, v]; default: return [k, u, v]; } };
  const layer = d.mc3tex[sz], L = P_LIGHT[pi];
  M.quad(M.bufs[1], x, y, z, [[a, 0, a], [b, 0, b], [b, h, b], [a, h, a]].map(mp), MC3_UV, layer, 129 | 32, L, false, null);
  M.quad(M.bufs[1], x, y, z, [[a, 0, b], [b, 0, a], [b, h, a], [a, h, b]].map(mp), MC3_UV, layer, 129 | 32, L, false, null);
}
// 충돌·선택 상자
{
  const _bb = blockBoxes;
  blockBoxes = function (id, meta, forSelect, world, x, y, z) {
    if (id >= 235 && id <= 255) { const d = BLOCKS[id]; if (d && d.mc3box) return d.mc3box(meta, forSelect); }
    return _bb(id, meta, forSelect, world, x, y, z);
  };
}
if (typeof Body !== 'undefined') {
  const _cf = Body.prototype.checkFluids;
  Body.prototype.checkFluids = function (world) {
    _cf.call(this, world);
    if (this.inWater) return;
    const r = this.w / 2 - 0.001, x0 = Math.floor(this.x - r), x1 = Math.floor(this.x + r), z0 = Math.floor(this.z - r), z1 = Math.floor(this.z + r);
    const y0 = Math.floor(this.y + 0.01), y1 = Math.floor(this.y + this.h * 0.8);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) if (MC3_WL[world.getBlock(x, y, z)]) { this.inWater = true; return; }
  };
}
function mc3IsWater(w, x, y, z) { const id = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return id === BL.water || MC3_WL[id] === 1; }

// ---------------- 효과 (mc2.js 의 giveEffect 가 있으면 그것을, 없으면 간단한 대신) ----------------
function mc3Effect(g, p, name, sec) {
  const MAP = { slow: 'slowness', grace: 'dolphins_grace' };
  if (typeof g.giveEffect === 'function' && name !== 'grace') { try { if (g.giveEffect(p, MAP[name] || name, sec, 1) !== false) return; } catch (e) { } }
  if (p !== g.player) return;
  const fx = p._mc3fx || (p._mc3fx = {});
  fx[name] = Math.max(fx[name] || 0, performance.now() / 1000 + sec);
}
function mc3Has(p, name) { return !!(p._mc3fx && p._mc3fx[name] > performance.now() / 1000); }

// ---------------- 몹 ----------------
Object.assign(MOB_TYPES, {
  squid: { k: '오징어', hp: 10, w: 0.8, h: 0.8, speed: 1.5, hostile: false, persist: true, mc3amb: 'water', drops: [['ink_sac', 1, 3]] },
  cod: { k: '대구', hp: 3, w: 0.5, h: 0.35, speed: 2.2, hostile: false, persist: true, mc3amb: 'water', drops: [['cod', 1, 1], ['bone_meal', 0, 1]] },
  salmon: { k: '연어', hp: 3, w: 0.6, h: 0.4, speed: 2.6, hostile: false, persist: true, mc3amb: 'water', drops: [['salmon', 1, 1], ['bone_meal', 0, 1]] },
  tropical_fish: { k: '열대어', hp: 3, w: 0.45, h: 0.4, speed: 2.2, hostile: false, persist: true, mc3amb: 'water', drops: [['tropical_fish', 1, 1]] },
  dolphin: { k: '돌고래', hp: 10, w: 0.9, h: 0.6, speed: 5, hostile: false, persist: true, mc3amb: 'water', drops: [['cod', 0, 1]] },
  axolotl: { k: '우파루파', hp: 14, w: 0.7, h: 0.42, speed: 2, hostile: false, persist: true, mc3amb: 'axolotl', amphib: true, drops: [] },
  bat: { k: '박쥐', hp: 6, w: 0.5, h: 0.9, speed: 3, hostile: false, persist: true, mc3amb: 'bat', drops: [] },
  drowned: { k: '드라운드', hp: 20, w: 0.6, h: 1.95, speed: 2.2, hostile: true, dmg: 3, burns: true, drops: [['rotten_flesh', 0, 2], ['copper_ingot', 0, 1]] },
  slime: { k: '큰 슬라임', hp: 16, w: 1.6, h: 1.6, speed: 2.6, hostile: true, dmg: 3, drops: [] },
  slime_m: { k: '슬라임', hp: 6, w: 0.8, h: 0.8, speed: 2.4, hostile: true, dmg: 2, drops: [] },
  slime_s: { k: '꼬마 슬라임', hp: 2, w: 0.45, h: 0.45, speed: 2.2, hostile: true, dmg: 0, drops: [['slime_ball', 0, 2]] },
  witch: { k: '마녀', hp: 26, w: 0.6, h: 1.95, speed: 2, hostile: true, dmg: 2, drops: [['glass_bottle', 0, 2], ['redstone', 0, 2], ['gunpowder', 0, 2], ['sugar', 0, 2], ['stick', 0, 2]] },
});
const MC3_MOBS = new Set(['squid', 'cod', 'salmon', 'tropical_fish', 'dolphin', 'axolotl', 'bat', 'drowned', 'slime', 'slime_m', 'slime_s', 'witch']);
const MC3_BUCKET = { cod: 'cod_bucket', salmon: 'salmon_bucket', tropical_fish: 'tropical_fish_bucket', axolotl: 'axolotl_bucket' };
function mc3Near(g, e, r) {
  let best = null, bd = r * r;
  for (const p of g.allPlayers()) { if (p.dead || p.creative) continue; const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2 + (p.z - e.z) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}
function mc3Steer(e, tx, ty, tz, sp, dt, kk) {
  const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z, l = Math.hypot(dx, dy, dz) || 1, k = 1 - Math.exp(-(kk || 2.5) * dt);
  e.vx += (dx / l * sp - e.vx) * k; e.vy += (dy / l * sp - e.vy) * k; e.vz += (dz / l * sp - e.vz) * k;
  return l;
}
function mc3Face(e, dt) {
  const hs = Math.hypot(e.vx, e.vz);
  if (hs > 0.15) { let d = Math.atan2(-e.vx, -e.vz) - e.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; e.yaw += d * Math.min(1, dt * 6); }
  e.pitchA = (e.pitchA || 0) + (Math.atan2(e.vy, hs + 0.01) * 0.8 - (e.pitchA || 0)) * Math.min(1, dt * 4);
}
// 헤엄치는 동물 (오징어·물고기·돌고래·우파루파)
function mc3Swim(e, dt, g) {
  const D = e.def, w = g.world, sub = e.sub;
  e.age += dt; if (e.hurtT > 0) e.hurtT -= dt;
  e.checkFluids(w);
  if (e.inWater) {
    e.dry = 0;
    let sp = D.speed, tx = e.tgx, ty = e.tgy, tz = e.tgz;
    if (e.panic > 0) { e.panic -= dt; sp *= 1.8; }
    e.wanderT = (e.wanderT || 0) - dt;
    let busy = false;
    // 돌고래: 헤엄치는 사람 곁으로 와서 은총
    if (sub === 'dolphin') {
      const p = g.player;
      if (!p.dead && p.inWater && Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z) < 12) {
        busy = true; const a = e.age * 0.9 + e.eid; tx = p.x + Math.sin(a) * 2.2; ty = p.y + 0.4; tz = p.z + Math.cos(a) * 2.2; sp = Math.max(sp, Math.hypot(p.vx, p.vz) + 2);
        e.graceT = (e.graceT || 0) - dt;
        if (e.graceT <= 0) { e.graceT = 1; mc3Effect(g, p, 'grace', 6); if (!e.told) { e.told = true; g.ui.toast('🐬 돌고래가 같이 헤엄쳐 줘요! 헤엄이 빨라졌어요', 2500); } g.advGrant('mc3_dolphin'); }
      }
      // 숨 쉬러 물 위로 펄쩍
      if (!busy && Math.random() < dt * 0.25 && !mc3IsWater(w, e.x, e.y + 1.2, e.z)) e.vy = 7;
    }
    // 우파루파: 근처 드라운드를 혼내 줌
    if (sub === 'axolotl') {
      if (e.prey && (e.prey.dead || Math.hypot(e.prey.x - e.x, e.prey.z - e.z) > 12)) e.prey = null;
      if (!e.prey && (e.age * 2 | 0) % 3 === 0) for (const o of g.ents.list) if (!o.dead && o.sub === 'drowned' && Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) < 8) { e.prey = o; break; }
      if (e.prey) {
        busy = true; tx = e.prey.x; ty = e.prey.y + 0.5; tz = e.prey.z; sp = D.speed * 1.5;
        e.attackT = (e.attackT || 0) - dt;
        if (e.attackT <= 0 && Math.hypot(tx - e.x, ty - e.y, tz - e.z) < 1.6) { e.attackT = 1; g.damageEntity(e.prey, 2, (tx - e.x) / 2, (tz - e.z) / 2, 'pet'); }
      }
    }
    if (!busy && (e.wanderT <= 0 || tx === undefined || Math.hypot(tx - e.x, ty - e.y, tz - e.z) < 0.8)) {
      e.wanderT = 1.5 + Math.random() * 3; tx = undefined;
      const p = g.player, flee = e.panic > 0;
      for (let k = 0; k < 6; k++) {
        const a = flee ? Math.atan2(e.z - p.z, e.x - p.x) + (Math.random() - 0.5) : Math.random() * 6.283, r = 2 + Math.random() * 6;
        const qx = e.x + Math.cos(a) * r, qz = e.z + Math.sin(a) * r, qy = e.y + (Math.random() - 0.5) * 3;
        if (mc3IsWater(w, qx, qy, qz) && mc3IsWater(w, qx, qy + D.h, qz)) { tx = qx; ty = qy; tz = qz; break; }
      }
      if (tx === undefined) { tx = e.x; ty = e.y - 1; tz = e.z; }
      e.tgx = tx; e.tgy = ty; e.tgz = tz;
    }
    mc3Steer(e, tx, ty, tz, sp, dt, sub === 'squid' ? 1.2 : 3);
    // 물 밖으로 머리를 내밀지 않게
    if (e.vy > 0 && !mc3IsWater(w, e.x, e.y + D.h + 0.3, e.z) && sub !== 'dolphin') e.vy *= 0.5;
  } else {
    // 물 밖: 펄떡 (우파루파는 걸어 다님)
    e.vy -= 25 * dt;
    if (D.amphib) {
      e.wanderT = (e.wanderT || 0) - dt;
      if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 3; e.yaw += (Math.random() - 0.5) * 3; }
      const s = D.speed * 0.4, k = 1 - Math.exp(-(e.onGround ? 10 : 2) * dt);
      e.vx += (-Math.sin(e.yaw) * s - e.vx) * k; e.vz += (-Math.cos(e.yaw) * s - e.vz) * k;
      if (e.onGround && e.hitH) e.vy = 6;
    } else {
      e.vx *= Math.exp(-3 * dt); e.vz *= Math.exp(-3 * dt);
      if (e.onGround && Math.random() < dt * 2.5) { e.vy = 4.5; e.vx = (Math.random() - 0.5) * 3; e.vz = (Math.random() - 0.5) * 3; }
    }
    e.dry = (e.dry || 0) + dt;
    if (e.dry > (D.amphib ? 120 : 20)) { e.dry -= 2; g.damageEntity(e, 1, 0, 0, 'drown'); }
  }
  e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
  if (e.inWater || !D.amphib) mc3Face(e, dt); else e.pitchA = 0;
  e.walk += dt * (3 + Math.hypot(e.vx, e.vz) * 2);
  if (e.y < -20) e.dead = true;
}
// 박쥐: 동굴에서 파닥파닥
function mc3Bat(e, dt, g) {
  const w = g.world;
  e.age += dt; if (e.hurtT > 0) e.hurtT -= dt;
  e.wanderT = (e.wanderT || 0) - dt;
  if (e.wanderT <= 0 || e.tgx === undefined || Math.hypot(e.tgx - e.x, e.tgy - e.y, e.tgz - e.z) < 0.7) {
    e.wanderT = 0.8 + Math.random() * 1.5;
    for (let k = 0; k < 6; k++) {
      const qx = e.x + (Math.random() - 0.5) * 8, qy = e.y + (Math.random() - 0.5) * 4, qz = e.z + (Math.random() - 0.5) * 8;
      if (!w.getBlock(Math.floor(qx), Math.floor(qy), Math.floor(qz)) && !w.getBlock(Math.floor(qx), Math.floor(qy + 0.8), Math.floor(qz))) { e.tgx = qx; e.tgy = qy; e.tgz = qz; break; }
    }
    if (e.tgx === undefined) { e.tgx = e.x; e.tgy = e.y - 1; e.tgz = e.z; }
  }
  mc3Steer(e, e.tgx, e.tgy, e.tgz, e.def.speed, dt, 4);
  e.vy += Math.sin(e.age * 9) * dt * 3;
  e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
  if (e.hitH || e.hitV) e.wanderT = 0;
  mc3Face(e, dt); e.walk += dt * 18;
  if (e.y < -20) e.dead = true;
}
// 드라운드: 물속에서는 헤엄쳐 쫓아오고, 땅 위에서는 좀비처럼 (기본 AI)
function mc3Drowned(e, dt, g) {
  const D = e.def, w = g.world;
  if (e.trident === undefined) e.trident = Math.random() < 0.2;
  if (g.settings.peaceful) { e.dead = true; return true; }
  e.checkFluids(w);
  if (!e.inWater) return false;
  e.age += dt; if (e.hurtT > 0) e.hurtT -= dt;
  const t = mc3Near(g, e, 20);
  e.attackT = (e.attackT || 0) - dt; e.throwT = (e.throwT === undefined ? 2 : e.throwT) - dt;
  if (t) {
    const dx = t.x - e.x, dz = t.z - e.z, dist = Math.hypot(dx, t.y - e.y, dz);
    e.yaw = Math.atan2(-dx, -dz);
    if (e.trident && dist > 4 && dist < 16 && e.throwT <= 0 && g.lineOfSight(e.x, e.y + 1.5, e.z, t.x, t.y + 1.4, t.z)) {
      e.throwT = 3.5 + Math.random() * 2;
      const sy = e.y + 1.6, ey = t.y + 1.2 - sy, l = Math.hypot(dx, ey, dz) || 1, sp = 16;
      g.ents.add(new Mc3Proj('mtrident', e.x, sy, e.z, dx / l * sp, ey / l * sp + 1.5, dz / l * sp, 'mob'));
      g.sfx('bow', e.x, sy, e.z);
    } else mc3Steer(e, t.x, t.y + 0.2, t.z, D.speed, dt, 2.5);
    if (dist < 1.5 && e.attackT <= 0) { e.attackT = 1; g.hurtPlayer(t, D.dmg, 'mob', dx / (dist || 1), dz / (dist || 1)); }
  } else {
    e.wanderT = (e.wanderT || 0) - dt;
    if (e.wanderT <= 0) { e.wanderT = 3 + Math.random() * 3; e.yaw += (Math.random() - 0.5) * 3; }
    mc3Steer(e, e.x - Math.sin(e.yaw) * 3, e.y - 0.3, e.z - Math.cos(e.yaw) * 3, D.speed * 0.4, dt, 2);
  }
  e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
  if (e.hitH) e.vy = 3;
  e.walk += Math.hypot(e.vx, e.vz) * dt * 2.2;
  if (e.y < -20) e.dead = true;
  return true;
}
// 슬라임: 통통 튀며 다가옴
function mc3Slime(e, dt, g) {
  const D = e.def, w = g.world;
  if (g.settings.peaceful) { e.dead = true; return; }
  e.age += dt; if (e.hurtT > 0) e.hurtT -= dt;
  e.checkFluids(w);
  const t = mc3Near(g, e, 16);
  e.hopT = (e.hopT === undefined ? Math.random() : e.hopT) - dt;
  if (e.onGround) {
    e.vx *= Math.exp(-10 * dt); e.vz *= Math.exp(-10 * dt);
    if (e.hopT <= 0) {
      e.hopT = t ? 0.7 + Math.random() * 0.6 : 2 + Math.random() * 3;
      if (t) e.yaw = Math.atan2(-(t.x - e.x), -(t.z - e.z)); else e.yaw += (Math.random() - 0.5) * 2.5;
      const sp = D.speed * (t ? 1 : 0.5);
      e.vy = 5.5 + e.w * 1.5; e.vx = -Math.sin(e.yaw) * sp; e.vz = -Math.cos(e.yaw) * sp;
    }
  }
  if (e.inWater) e.vy += (1.5 - e.vy) * dt * 3; else e.vy -= 26 * dt;
  const was = e.onGround;
  e.move(w, e.vx * dt, e.vy * dt, e.vz * dt);
  if (e.onGround && !was) e.squish = 1;
  e.squish = Math.max(0, (e.squish || 0) - dt * 4);
  e.attackT = (e.attackT || 0) - dt;
  if (t && D.dmg > 0 && e.attackT <= 0) {
    const dist = Math.hypot(t.x - e.x, t.z - e.z);
    if (dist < e.w / 2 + 0.6 && t.y < e.y + e.h && t.y + 1.8 > e.y) { e.attackT = 1; g.hurtPlayer(t, D.dmg, 'mob', (t.x - e.x) / (dist || 1), (t.z - e.z) / (dist || 1)); }
  }
  e.walk = e.squish;
  if (e.y < -20) e.dead = true;
}
// 마녀: 떨어져서 물약을 던지고, 다치면 물약을 마심
function mc3Witch(e, dt, g) {
  const D = e.def, w = g.world;
  if (g.settings.peaceful) { e.dead = true; return; }
  e.age += dt; if (e.hurtT > 0) e.hurtT -= dt;
  e.checkFluids(w);
  const t = mc3Near(g, e, 16);
  let want = 0;
  e.healCd = (e.healCd || 0) - dt; e.attackT = (e.attackT === undefined ? 1.5 : e.attackT) - dt;
  if (e.drinkT > 0) {
    e.drinkT -= dt;
    if (e.drinkT <= 0) { e.hp = Math.min(D.hp, e.hp + 10); for (let k = 0; k < 6; k++) g.particles.dust(e.x + (Math.random() - 0.5), e.y + 1 + Math.random(), e.z + (Math.random() - 0.5), [1, 0.4, 0.7]); g.sfx('burp', e.x, e.y + 1.5, e.z); }
  } else if (e.hp < D.hp * 0.5 && e.healCd <= 0) { e.drinkT = 1.6; e.healCd = 14; }
  else if (t) {
    const dx = t.x - e.x, dz = t.z - e.z, dist = Math.hypot(dx, dz);
    e.yaw = Math.atan2(-dx, -dz);
    want = dist > 9 ? 1 : dist < 4 ? -0.6 : 0;
    if (e.attackT <= 0 && dist < 12 && g.lineOfSight(e.x, e.y + 1.6, e.z, t.x, t.y + 1.5, t.z)) {
      e.attackT = 3 + Math.random() * 1.5;
      const sy = e.y + 1.6, ey = t.y + 1 - sy, sp = 11, l = Math.hypot(dx, dz) || 1, tt = l / sp;
      g.ents.add(new Mc3Proj('potion', e.x, sy, e.z, dx / l * sp, ey / tt + 10 * tt, dz / l * sp, 'mob'));
      e.swingT = 0.4;
    }
  } else {
    e.wanderT = (e.wanderT || 0) - dt;
    if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 5; e.walking = Math.random() < 0.5; e.yaw += (Math.random() - 0.5) * 3; }
    if (e.walking) want = 0.5;
  }
  if (e.swingT > 0) e.swingT -= dt;
  mobMove(e, dt, g, want);
}
{
  const AI = { squid: mc3Swim, cod: mc3Swim, salmon: mc3Swim, tropical_fish: mc3Swim, dolphin: mc3Swim, axolotl: mc3Swim, bat: mc3Bat, slime: mc3Slime, slime_m: mc3Slime, slime_s: mc3Slime, witch: mc3Witch };
  const _upd = Mob.prototype.update;
  Mob.prototype.update = function (dt, g) {
    const f = AI[this.sub];
    if (f) { f(this, dt, g); return; }
    if (this.sub === 'drowned' && mc3Drowned(this, dt, g)) return;
    return _upd.call(this, dt, g);
  };
}

// ---------------- 던지는 것 (삼지창 · 드라운드 삼지창 · 마녀 물약 · 폭죽) ----------------
const MC3_FW = [[[1, 0.35, 0.35], [1, 0.85, 0.4]], [[0.4, 0.7, 1], [0.9, 0.95, 1]], [[0.5, 1, 0.5], [1, 1, 0.5]], [[1, 0.5, 0.9], [0.7, 0.5, 1]], [[1, 0.65, 0.2], [1, 0.3, 0.3]]];
const Mc3Proj = typeof Entity === 'undefined' ? null : class extends Entity {
  constructor(kind, x, y, z, vx, vy, vz, owner) {
    super('mc3proj', 0.25, 0.25);
    this.kind = kind; this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz; this.owner = owner; this.stepHeight = 0;
    this.item = null; this.back = false; this.stuckT = 0;
    this.col = kind === 'firework' ? MC3_FW[(Math.random() * MC3_FW.length) | 0] : null;
  }
  update(dt, g) {
    this.age += dt;
    const w = g.world;
    if (this.kind === 'firework') {
      this.vy = Math.min(22, this.vy + 30 * dt); this.vx *= 0.98; this.vz *= 0.98;
      this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
      if (Math.random() < 0.8) g.particles.add({ x: this.x, y: this.y - 0.2, z: this.z, vx: (Math.random() - 0.5), vy: -2, vz: (Math.random() - 0.5), life: 0.4, size: 0.07, layer: T('white'), u: 0, v: 0, g: 2, tint: [1, 0.85, 0.5], emissive: true });
      if (this.age > 1.25 || w.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z))) { this.dead = true; mc3Burst(g, this.x, this.y, this.z, this.col); }
      return;
    }
    if (this.kind === 'trident' && this.back) {
      // 돌아오기
      const p = g.player, l = mc3Steer(this, p.x, p.y + 1.2, p.z, 26, dt, 8);
      this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
      this.yaw = Math.atan2(-this.vx, -this.vz); this.pitch = Math.atan2(this.vy, Math.hypot(this.vx, this.vz));
      if (l < 1.3 || this.age > 15 || p.dead) this.giveBack(g);
      return;
    }
    if (this.stuck) { this.stuckT += dt; if (this.kind === 'trident' && this.stuckT > 0.4) { this.back = true; this.stuck = false; } else if (this.kind !== 'trident' && this.stuckT > 0.1) this.dead = true; return; }
    if (this.age > 20) { if (this.kind === 'trident') this.giveBack(g); else this.dead = true; return; }
    this.checkFluids(w);
    this.vy -= (this.inWater ? 6 : 20) * dt;
    if (this.inWater && this.kind !== 'trident') { this.vx *= 0.95; this.vz *= 0.95; }
    for (let s = 0; s < 4; s++) {
      const nx = this.x + this.vx * dt / 4, ny = this.y + this.vy * dt / 4, nz = this.z + this.vz * dt / 4;
      const id = w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
      if (id && BLOCKS[id].solid) { this.hitBlock(g, nx, ny, nz); return; }
      this.x = nx; this.y = ny; this.z = nz;
      const hit = this.owner === 'player' ? g.hitTestEntities(nx, ny, nz, 0.35, 'player') : mc3HitPlayer(g, nx, ny, nz, 0.35);
      if (hit) { this.hitEnt(g, hit); return; }
    }
    this.yaw = Math.atan2(-this.vx, -this.vz); this.pitch = Math.atan2(this.vy, Math.hypot(this.vx, this.vz));
    if (this.kind === 'potion' && Math.random() < 0.5) g.particles.dust(this.x, this.y, this.z, [0.8, 0.4, 1]);
  }
  hitBlock(g, x, y, z) {
    if (this.kind === 'potion') { this.splash(g, x, y, z); return; }
    this.stuck = true; this.stuckT = 0; g.sfx('arrow_hit', x, y, z);
  }
  hitEnt(g, e) {
    const sp = Math.hypot(this.vx, this.vz) || 1;
    if (this.kind === 'potion') { this.splash(g, this.x, this.y, this.z); return; }
    if (this.kind === 'trident') { g.damageEntity(e, 8, this.vx / sp, this.vz / sp, 'arrow'); g.sfx('arrow_hit', this.x, this.y, this.z); this.back = true; this.vx *= -0.2; this.vz *= -0.2; return; }
    g.hurtPlayer(e, 3, 'mob', this.vx / sp, this.vz / sp); this.dead = true;
  }
  splash(g, x, y, z) {
    this.dead = true;
    g.sfx('splash', x, y, z);
    for (let k = 0; k < 18; k++) g.particles.add({ x, y: y + 0.3, z, vx: (Math.random() - 0.5) * 5, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 5, life: 0.7, size: 0.08, layer: T('white'), u: 0, v: 0, g: 6, tint: [0.75, 0.35, 0.95], emissive: true });
    for (const p of g.allPlayers()) {
      if (p.dead || Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z) > 2.6) continue;
      g.hurtPlayer(p, 2, 'mob');
      mc3Effect(g, p, 'slow', 6);
      if (p === g.player) g.ui.toast('🧪 마녀의 물약! 잠깐 느려졌어요', 1500);
    }
  }
  giveBack(g) {
    this.dead = true;
    const p = g.player; if (!this.item || p.creative) return;
    const s = this.slot;
    if (s !== undefined && !p.inv[s]) p.inv[s] = this.item;
    else if (p.give(this.item.id, 1, this.item.d)) g.dropItem(p.x, p.y + 1, p.z, this.item);
    g.sfx('pop', p.x, p.y + 1, p.z); g.ui.refreshHotbar();
  }
  render(g, R, cam) {
    const m = M4.create(), t = M4.create(), L = this.lightAt(g.world);
    M4.translate(m, this.x - cam[0], this.y - cam[1], this.z - cam[2]);
    M4.mul(m, m, M4.rotY(t, this.yaw || 0)); M4.mul(m, m, M4.rotX(t, this.pitch || 0));
    const B = (a, b, c, d, e, f, col, lit) => R.ent.addBox(m, a, b, c, d, e, f, col, lit ? 1 : L[0], lit ? 1 : L[1]);
    if (this.kind === 'potion') { B(-0.1, -0.12, -0.1, 0.1, 0.08, 0.1, [0.7, 0.35, 0.9], true); B(-0.04, 0.08, -0.04, 0.04, 0.16, 0.04, [0.85, 0.85, 0.9]); return; }
    if (this.kind === 'firework') { B(-0.07, -0.25, -0.07, 0.07, 0.15, 0.07, [0.9, 0.25, 0.25]); B(-0.05, 0.15, -0.05, 0.05, 0.22, 0.05, [0.95, 0.95, 0.95]); return; }
    const c = [0.3, 0.75, 0.72], c2 = [0.55, 0.92, 0.88];
    B(-0.03, -0.03, -0.4, 0.03, 0.03, 0.55, c);
    B(-0.15, -0.03, -0.45, 0.15, 0.03, -0.39, c2);
    for (const ox of [-0.15, 0, 0.15]) B(ox - 0.025, -0.025, -0.68, ox + 0.025, 0.025, -0.45, c2);
  }
};
function mc3HitPlayer(g, x, y, z, r) {
  for (const p of g.allPlayers()) if (!p.dead && Math.abs(x - p.x) < 0.3 + r && Math.abs(z - p.z) < 0.3 + r && y > p.y - r && y < p.y + 1.8 + r) return p;
  return null;
}
// 불꽃 터짐
function mc3Burst(g, x, y, z, col) {
  col = col || MC3_FW[0];
  const star = Math.random() < 0.4;
  for (let i = 0; i < 70; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - u * u), sp = star ? 7 : 4 + Math.random() * 4;
    g.particles.add({ x, y, z, vx: Math.cos(a) * s * sp, vy: u * sp, vz: Math.sin(a) * s * sp, life: 0.9 + Math.random() * 0.7, size: 0.09 + Math.random() * 0.05, layer: T('white'), u: 0, v: 0, g: 3, tint: col[i & 1], emissive: true });
  }
  g.sound.play('explode', x, y, z, { vol: 0.35 }); g.sound.play('pop', x, y, z);
}

// ---------------- 몹 모양 ----------------
function mc3RenderMob(R, sub, x, y, z, yaw, walk, L, hurt, e) {
  const P = 1 / 16, base = M4.create(), tm = M4.create();
  M4.translate(base, x, y, z); M4.mul(base, base, M4.rotY(tm, yaw));
  const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
  const box = (m, a, b, c, d, f, h, col, lit) => R.ent.addBox(m, a * P, b * P, c * P, d * P, f * P, h * P, tint(col), lit ? 1 : L[0], lit ? 1 : L[1]);
  const sub2 = (m, px, py, pz, rx, ry, rz) => { const o = new Float32Array(m), tr = M4.create(); M4.translate(tr, px * P, py * P, pz * P); M4.mul(o, o, tr); if (rx) M4.mul(o, o, M4.rotX(M4.create(), rx)); if (ry) M4.mul(o, o, M4.rotY(M4.create(), ry)); if (rz) M4.mul(o, o, M4.rotZ(M4.create(), rz)); return o; };
  const eid = e ? e.eid : 0, pitch = e && e.pitchA ? e.pitchA : 0, sw = Math.sin(walk);
  const eyes = (m, xx, yy, zz, s) => { box(m, -xx - s, yy, zz - s, -xx + s, yy + s * 2, zz + s, [0.05, 0.05, 0.08]); box(m, xx - s, yy, zz - s, xx + s, yy + s * 2, zz + s, [0.05, 0.05, 0.08]); };
  switch (sub) {
    case 'squid': {
      const m = sub2(base, 0, 9, 0, pitch * 0.6 - 0.3);
      const c = [0.24, 0.34, 0.56];
      box(m, -6, -1, -6, 6, 11, 6, c); box(m, -6.05, 3, -6.05, 6.05, 4, 6.05, [0.3, 0.42, 0.66]);
      box(m, -4, 4, -6.1, -2, 6, -6, [0.95, 0.95, 0.95]); box(m, 2, 4, -6.1, 4, 6, -6, [0.95, 0.95, 0.95]); box(m, -3.4, 4, -6.15, -2.4, 5.4, -6.1, [0.05, 0.05, 0.1]); box(m, 2.4, 4, -6.15, 3.4, 5.4, -6.1, [0.05, 0.05, 0.1]);
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, tt = sub2(m, Math.cos(a) * 4.5, -1, Math.sin(a) * 4.5, Math.sin(walk * 0.8 + k) * 0.35 + Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); box(tt, -1, -9, -1, 1, 0, 1, [0.2, 0.28, 0.48]); }
      return true;
    }
    case 'cod': case 'salmon': case 'tropical_fish': {
      const m = sub2(base, 0, sub === 'salmon' ? 2.5 : 2.5, 0, pitch);
      let A, B, wd, hh, ln;
      if (sub === 'cod') { A = [0.72, 0.62, 0.46]; B = [0.88, 0.82, 0.7]; wd = 1; hh = 4; ln = 5; }
      else if (sub === 'salmon') { A = [0.66, 0.3, 0.26]; B = [0.85, 0.6, 0.5]; wd = 1.5; hh = 5; ln = 7; }
      else { const C = [[[1, 0.55, 0.15], [1, 1, 1]], [[0.25, 0.5, 1], [1, 0.9, 0.2]], [[1, 0.35, 0.65], [0.35, 0.9, 1]], [[0.3, 0.85, 0.4], [1, 0.95, 0.6]]][eid % 4]; A = C[0]; B = C[1]; wd = 1; hh = 5; ln = 3.5; }
      box(m, -wd, -hh / 2, -ln, wd, hh / 2, ln, A); box(m, -wd + 0.2, -hh / 2 - 0.05, -ln + 1, wd - 0.2, -hh / 2 + 1, ln - 1, B);
      if (sub === 'tropical_fish') box(m, -wd - 0.05, -hh / 2, -0.6, wd + 0.05, hh / 2, 0.8, B);
      box(m, -0.25, hh / 2, -ln * 0.4, 0.25, hh / 2 + 1.5, ln * 0.4, B);
      eyes(m, wd, 0, -ln + 1.2, 0.5);
      const tl = sub2(m, 0, 0, ln, 0, sw * 0.5); box(tl, -0.3, -hh / 2 - 0.5, 0, 0.3, hh / 2 + 0.5, 3, sub === 'tropical_fish' ? B : A);
      return true;
    }
    case 'dolphin': {
      const m = sub2(base, 0, 3, 0, pitch);
      const c = [0.56, 0.66, 0.8], bl = [0.86, 0.89, 0.94];
      box(m, -3.5, -3, -8, 3.5, 3, 7, c); box(m, -3, -3.05, -7, 3, -1.5, 5, bl);
      box(m, -1.6, -2, -12, 1.6, 0.5, -8, c); box(m, -1.4, -2.05, -12, 1.4, -1.5, -8.5, bl);
      box(m, -0.5, 3, -2, 0.5, 6.5, 2, c); eyes(m, 3.5, 0, -6, 0.5);
      for (const s of [-1, 1]) box(sub2(m, s * 3.5, -2, -3, 0, 0, s * 0.6), s > 0 ? 0 : -4, -0.4, -1.5, s > 0 ? 4 : 0, 0.4, 1.5, c);
      const tl = sub2(m, 0, 0, 7, sw * 0.4); box(tl, -1.5, -1.5, 0, 1.5, 1.5, 5, c); box(tl, -4.5, -0.4, 4, 4.5, 0.4, 7, c);
      return true;
    }
    case 'axolotl': {
      const C = eid % 37 === 0 ? [0.4, 0.45, 0.95] : [[1, 0.72, 0.82], [0.62, 0.46, 0.36], [1, 0.84, 0.42], [0.62, 0.86, 1]][eid % 4], G2 = C.map(v => v * 0.75);
      const m = sub2(base, 0, 0, 0, pitch * 0.5);
      box(m, -2.5, 1, -4.5, 2.5, 4.5, 4.5, C); box(m, -3, 1, -9.5, 3, 5.5, -4.5, C); eyes(m, 3, 3.2, -8, 0.5);
      box(m, -1, 1.6, -9.55, 1, 2.2, -9.5, G2);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) box(m, s > 0 ? 3 : -4.5, 3 + k * 0.9, -7.5 + k * 0.8, s > 0 ? 4.5 : -3, 3.6 + k * 0.9, -6.5 + k * 0.8, G2);
      box(m, -3.2, 5.5, -7.5, 3.2, 6.6, -6.5, G2);
      const tl = sub2(m, 0, 2.8, 4.5, 0, sw * 0.5); box(tl, -0.5, -1.5, 0, 0.5, 1.5, 6, C);
      for (const [lx, lz, ph] of [[-3, -3, sw], [3, -3, -sw], [-3, 3, -sw], [3, 3, sw]]) box(sub2(m, lx, 1.5, lz, ph * 0.5), -0.8, -1.5, -0.8, 0.8, 0, 0.8, G2);
      return true;
    }
    case 'bat': {
      const m = sub2(base, 0, 5, 0), c = [0.36, 0.26, 0.2], wc = [0.24, 0.18, 0.15], fl = Math.sin(walk) * 0.9;
      box(m, -1.5, -3, -1.5, 1.5, 3, 1.5, c); box(m, -2, 3, -2, 2, 7, 2, c); eyes(m, 1, 4.8, -2.05, 0.4);
      box(m, -2, 7, -0.5, -1, 9, 0.5, c); box(m, 1, 7, -0.5, 2, 9, 0.5, c);
      for (const s of [-1, 1]) { const wm = sub2(m, s * 1.5, 2, 0, 0, 0, s * fl); box(wm, s > 0 ? 0 : -7, -3, -0.2, s > 0 ? 7 : 0, 3, 0.2, wc); }
      return true;
    }
    case 'drowned': case 'witch': {
      const isW = sub === 'witch';
      const skin = isW ? [0.74, 0.62, 0.5] : [0.45, 0.68, 0.62], shirt = isW ? [0.36, 0.22, 0.46] : [0.34, 0.55, 0.5], pants = isW ? [0.26, 0.16, 0.34] : [0.3, 0.38, 0.52];
      renderHumanoid(R, base, tm, sw * 0.7, skin, shirt, pants, 2 * P, !isW, L, hurt, 0, isW ? null : [0.28, 0.42, 0.36], e && e.swingT > 0 ? e.swingT * 2.5 : 0);
      if (isW) {
        const hc = [0.2, 0.13, 0.26];
        box(base, -5, 31.5, -5, 5, 32.5, 5, hc); box(base, -3.6, 32.5, -3.6, 3.6, 35, 3.6, hc); box(base, -3.65, 32.5, -3.65, 3.65, 33.3, 3.65, [0.35, 0.6, 0.32]);
        box(base, -2.2, 35, -1.6, 2.2, 37.5, 2.8, hc); box(base, -1, 37.5, 0, 1, 39.5, 2.5, hc);
        box(base, -0.9, 26, -5.6, 0.9, 29, -4, skin.map(v => v * 0.92)); box(base, 0.5, 26.3, -5.7, 1.2, 27, -5.5, [0.4, 0.6, 0.3]);
        if (e && e.drinkT > 0) box(base, -1, 23, -6.5, 1, 26, -4.5, [1, 0.45, 0.7], true);
      } else if (e && e.trident) {
        box(base, 5.5, 14, -20, 6.5, 15, -2, [0.3, 0.75, 0.72]); box(base, 4, 14, -21, 8, 15, -20, [0.55, 0.92, 0.88]);
        for (const ox of [4, 6, 8]) box(base, ox - 0.4, 14, -24, ox + 0.4, 15, -21, [0.55, 0.92, 0.88]);
      }
      return true;
    }
    case 'slime': case 'slime_m': case 'slime_s': {
      const D = MOB_TYPES[sub], s = D.w * 8, sq = e ? (e.squish || 0) : 0, k = 1 - sq * 0.25;
      const sm = M4.create(); sm[0] = sm[10] = 1 / k; sm[5] = k; const m = new Float32Array(base); M4.mul(m, m, sm);
      const gc = [0.46, 0.86, 0.42], gd = [0.3, 0.62, 0.28];
      box(m, -s, 0, -s, s, s * 2, s, gc);
      box(m, -s * 0.6, s * 1.15, -s - 0.05, -s * 0.2, s * 1.55, -s, gd); box(m, s * 0.2, s * 1.15, -s - 0.05, s * 0.6, s * 1.55, -s, gd);
      box(m, -s * 0.15, s * 0.7, -s - 0.05, s * 0.15, s * 0.85, -s, gd);
      return true;
    }
  }
  return false;
}
{
  const _render = Mob.prototype.render;
  Mob.prototype.render = function (g, R, cam) {
    if (MC3_MOBS.has(this.sub)) { mc3RenderMob(R, this.sub, this.x - cam[0], this.y - cam[1], this.z - cam[2], this.yaw, this.walk, this.lightAt(g.world), this.hurtT > 0, this); return; }
    return _render.call(this, g, R, cam);
  };
  const _rmm = renderMobModel;
  renderMobModel = function (R, sub, x, y, z, yaw, walk, L, hurt, fuse) {
    if (MC3_MOBS.has(sub) && mc3RenderMob(R, sub, x, y, z, yaw, walk, L, hurt, null)) return;
    return _rmm(R, sub, x, y, z, yaw, walk, L, hurt, fuse);
  };
  if (typeof NetEntity !== 'undefined') {
    const _nr = NetEntity.prototype.render;
    NetEntity.prototype.render = function (g, R, cam) {
      if (this.type === 'mob' && MC3_MOBS.has(this.sub)) { const D = MOB_TYPES[this.sub]; this.w = D.w; this.h = D.h; mc3RenderMob(R, this.sub, this.x - cam[0], this.y - cam[1], this.z - cam[2], this.yaw, this.walk, this.lightAt(g.world), !!(this.flags & 1), this); return; }
      return _nr.call(this, g, R, cam);
    };
  }
}
// 겉날개를 입으면 등에 날개
if (typeof renderArmorModel === 'function') {
  const _ram = renderArmorModel;
  renderArmorModel = function (eb, M, ids, L, hurt) {
    if (ids && ids[1] && ITEMS[ids[1]] && ITEMS[ids[1]].name === 'elytra' && M && M.body) {
      const P = 1 / 16, c = hurt ? [1, 0.5, 0.5] : [0.62, 0.62, 0.78], d = [0.46, 0.46, 0.62];
      for (const s of [-1, 1]) {
        eb.addBox(M.body, (s > 0 ? 0.4 : -6) * P, 8 * P, 2.2 * P, (s > 0 ? 6 : -0.4) * P, 23.5 * P, 3.4 * P, c, L[0], L[1]);
        eb.addBox(M.body, (s > 0 ? 4.5 : -6.2) * P, 9 * P, 2.1 * P, (s > 0 ? 6.2 : -4.5) * P, 22 * P, 3.5 * P, d, L[0], L[1]);
      }
      ids = ids.slice(); ids[1] = null;
    }
    return _ram(eb, M, ids, L, hurt);
  };
}

// ---------------- 플레이어: 겉날개 활공 · 물에 잠긴 블록 숨 · 효과 ----------------
function mc3HasElytra(p) { const a = p.armor && p.armor[1], d = a && ITEMS[a.id]; return !!(d && d.name === 'elytra' && (a.d || 0) < d.dur - 1); }
// 원작 겉날개 식(틱 단위)을 그대로: 내려다보면 빨라지고, 올려다보면 속도를 높이로 바꿈
function mc3Glide(p, dt, input, world) {
  p.checkFluids(world);
  p.sneaking = false; p.sprinting = false;
  p._glideAcc = (p._glideAcc || 0) + dt;
  const l = p.lookDir(), pitch = p.pitch, hl = Math.hypot(l[0], l[2]), cp = Math.cos(pitch), sq = cp * cp;
  let vx = p.vx / 20, vy = p.vy / 20, vz = p.vz / 20;
  while (p._glideAcc >= 0.05) {
    p._glideAcc -= 0.05;
    const hv = Math.hypot(vx, vz);
    vy += -0.08 + sq * 0.06;
    if (vy < 0 && hl > 0) { const lift = vy * -0.1 * sq; vy += lift; vx += l[0] / hl * lift; vz += l[2] / hl * lift; }
    if (pitch > 0 && hl > 0) { const lift = hv * Math.sin(pitch) * 0.04; vy += lift * 3.2; vx -= l[0] / hl * lift; vz -= l[2] / hl * lift; }
    if (hl > 0) { vx += (l[0] / hl * hv - vx) * 0.1; vz += (l[2] / hl * hv - vz) * 0.1; }
    if (p._mc3Boost > 0) { vx += l[0] * 0.1 + (l[0] * 1.5 - vx) * 0.5; vy += l[1] * 0.1 + (l[1] * 1.5 - vy) * 0.5; vz += l[2] * 0.1 + (l[2] * 1.5 - vz) * 0.5; }
    vx *= 0.99; vy *= 0.98; vz *= 0.99;
  }
  if (p._mc3Boost > 0) { p._mc3Boost -= dt; const g = p.game; if (g && Math.random() < 0.6) g.particles.add({ x: p.x, y: p.y + 0.4, z: p.z, vx: 0, vy: 0, vz: 0, life: 0.5, size: 0.08, layer: T('white'), u: 0, v: 0, g: 0, tint: [1, 0.8, 0.5], emissive: true }); }
  p.vx = vx * 20; p.vy = vy * 20; p.vz = vz * 20;
  const before = Math.hypot(p.vx, p.vz);
  p.stepHeight = 0;
  const mv = p.move(world, p.vx * dt, p.vy * dt, p.vz * dt);
  if (p.hitH) { const loss = before - Math.hypot(p.vx, p.vz); if (loss > 15) p.hurt(Math.min(3, Math.floor((loss - 15) / 8) + 1), 'fly'); }
  p.fallDist = 0;
  const g = p.game;
  if (g && g.stats) g.stats.mc3Glide = (g.stats.mc3Glide || 0) + Math.hypot(mv[0], mv[2]);
  // 1초마다 내구도 1
  p._glideWear = (p._glideWear || 0) + dt;
  if (p._glideWear >= 1 && !p.creative) { p._glideWear = 0; const a = p.armor[1]; a.d = (a.d || 0) + 1; if (g && a.d >= ITEMS[a.id].dur - 1) g.ui.toast('🪽 겉날개가 너덜너덜해요! 모루 대신 새 겉날개가 필요해요', 2500); }
  if (p.onGround || p.inWater || !mc3HasElytra(p)) p.gliding = false;
  p.survival(dt, world);
}
if (typeof Player !== 'undefined') {
  const P = Player.prototype;
  const _upd = P.update;
  P.update = function (dt, input, world) {
    const edge = !!input.jump && !this._mc3Jump; this._mc3Jump = !!input.jump;
    if (!this.dead && !this.riding) {
      if (this.gliding && (this.onGround || this.inWater || this.flying || !mc3HasElytra(this))) this.gliding = false;
      if (!this.gliding && edge && !this.onGround && !this.flying && !this.inWater && !this.inClimb && this.vy < 2 && mc3HasElytra(this)) {
        this.gliding = true; this._glideAcc = 0;
        const g = this.game; if (g && !g._mc3GlideTold) { g._mc3GlideTold = true; g.ui.toast('🪽 활공! 아래를 보면 빨라지고, 위를 보면 올라가요. 폭죽을 쓰면 슝~', 3500); }
      }
      if (this.gliding) { mc3Glide(this, dt, input, world); return; }
    } else this.gliding = false;
    _upd.call(this, dt, input, world);
    if (this.riding || this.dead) return;
    // 돌고래의 은총: 물속에서 빨리 / 마녀 물약: 느림
    if (mc3Has(this, 'grace') && this.inWater && !this.flying) this.move(world, this.vx * dt * 0.9, 0, this.vz * dt * 0.9);
    if (mc3Has(this, 'slow') && this.onGround) { this.vx *= 0.85; this.vz *= 0.85; }
  };
  const _sv = P.survival;
  P.survival = function (dt, world) {
    const r = _sv.call(this, dt, world);
    if (!this.creative && !this.eyeInWater && world) {
      const id = world.getBlock(Math.floor(this.x), Math.floor(this.eyeY()), Math.floor(this.z)), h = this.armor && this.armor[0];
      if (MC3_WL[id] && !(h && ITEMS[h.id] && ITEMS[h.id].name === 'turtle_helmet')) {
        this.eyeInWater = true; this.air -= dt * 80;
        if (this.air <= 0) { this.air = 0; this.drownT += dt; if (this.drownT > 1) { this.drownT = 0; this.hurt(2, 'drown'); } }
      }
    }
    return r;
  };
}
// 망원경 확대 · 활공 시야 · 물에 잠긴 블록 안에서 물속 화면
if (typeof Renderer !== 'undefined') {
  const _rr = Renderer.prototype.render;
  Renderer.prototype.render = function (st) {
    const g = MC3.g;
    if (g && g.player && st) {
      const p = g.player;
      if (g._mc3Zoom) st.fov *= 0.22;
      else if (p.gliding) st.fov *= 1 + Math.min(0.15, Math.hypot(p.vx, p.vy, p.vz) / 200);
      if (!st.underwater && st.world && st.cam && MC3_WL[st.world.getBlock(Math.floor(st.cam[0]), Math.floor(st.cam[1] + 0.05), Math.floor(st.cam[2]))]) st.underwater = true;
    }
    return _rr.call(this, st);
  };
}
function mc3SpyOverlay(on) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('mc3-spy');
  if (!el) {
    if (!on) return;
    el = document.createElement('div'); el.id = 'mc3-spy';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;display:none;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) 30vmin,rgba(12,8,24,.94) 31vmin)';
    document.body.appendChild(el);
  }
  el.style.display = on ? 'block' : 'none';
}

// ---------------- 게임: 생성 · 사용 · 놓기 · 몹 ----------------
if (typeof LOOT !== 'undefined') LOOT.mc3_end = [['elytra', 1, 1], ['firework_rocket', 12, 16], ['diamond', 2, 3], ['golden_apple', 1, 2], ['experience_bottle', 3, 5]];
function mc3EndChest(g) {
  const w = g.world; if (!w || w.dim !== 'end' || w.remote || !g.dragon || !g.dragon.dead || g.dragon.mc3Chest) return false;
  for (const [x, z] of [[0, 4], [4, 0], [0, -4], [-4, 0], [3, 3], [-3, 3]]) {
    if (!w.isLoadedAt(x, z)) return false;
    const y = w.surfaceY(x, z), below = w.getBlock(x, y - 1, z);
    if (!below || !BLOCKS[below].solid || IS_FLUID[below] || w.getBlock(x, y, z) || y < 5) continue;
    w.lootAt.set(fmtKey(x, y, z), 'mc3_end');
    w.setBlock(x, y, z, BL.chest, 2);
    g.dragon.mc3Chest = 1;
    g.ui.chatLine('🪽 출구 차원문 옆에 보물 상자가 생겼어요! 하늘을 나는 겉날개가 들어 있어요.', '#d9b8ff');
    return true;
  }
  return false;
}
function mc3Spawn(g) {
  const w = g.world, T0 = g._perfTier || [30, 72, 1200, 12, 18], cap = Math.max(4, Math.round(T0[3] * 0.7)), peace = g.settings.peaceful;
  let water = 0, bats = 0, axo = 0, drowned = 0, slimes = 0, witches = 0, hostile = 0;
  for (const e of g.ents.list) {
    if (e.dead || e.type !== 'mob' || !e.def) continue;
    const s = e.sub, a = e.def.mc3amb;
    if (a === 'water') water++; else if (a === 'bat') bats++; else if (a === 'axolotl') axo++;
    if (e.def.hostile) hostile++;
    if (s === 'drowned') drowned++; else if (s === 'witch') witches++; else if (s === 'slime' || s === 'slime_m' || s === 'slime_s') slimes++;
  }
  const day = w.dayFactor(), add = (sub, x, y, z) => g.ents.add(new Mob(sub, x, y, z));
  for (const pl of g.allPlayers()) for (let a = 0; a < 4; a++) {
    const ang = Math.random() * Math.PI * 2, dist = 16 + Math.random() * 28;
    const x = Math.floor(pl.x + Math.cos(ang) * dist), z = Math.floor(pl.z + Math.sin(ang) * dist);
    if (!w.isLoadedAt(x, z)) continue;
    const r = Math.random();
    if (r < 0.5) {
      // 물: 물고기·오징어·돌고래·드라운드
      const fy = w.surfaceY(x, z); let top = fy;
      while (top < HEIGHT - 1 && mc3IsWater(w, x, top, z)) top++;
      const depth = top - fy; if (depth < 2) continue;
      if (!peace && (day < 0.35 || depth >= 10) && Math.random() < 0.15 && drowned < 4 && hostile < T0[4]) { add('drowned', x + 0.5, fy, z + 0.5); return; }
      if (water >= cap) continue;
      const bi = w.biomeAt(x, z), temp = w.nT.fbm2(x / 800, z / 800, 2), q = Math.random();
      let sub, n;
      if (bi === 0 && depth >= 6 && q < 0.08 && g.ents.count(e => e.sub === 'dolphin') < 3) { sub = 'dolphin'; n = 2; }
      else if (depth >= 5 && q < 0.35) { sub = 'squid'; n = 2 + (Math.random() * 2 | 0); }
      else { sub = temp > 0.2 && bi === 0 ? 'tropical_fish' : temp < -0.1 || bi === 3 ? 'salmon' : 'cod'; n = 3 + (Math.random() * 3 | 0); }
      for (let i = 0; i < n && water < cap + 2; i++) {
        const sx = x + 0.5 + (Math.random() - 0.5) * 3, sz = z + 0.5 + (Math.random() - 0.5) * 3, sy = fy + 0.5 + Math.random() * Math.max(0, depth - 2);
        if (mc3IsWater(w, sx, sy, sz) && mc3IsWater(w, sx, sy + MOB_TYPES[sub].h, sz)) { add(sub, sx, sy, sz); water++; }
      }
      return;
    } else if (r < 0.82) {
      // 땅속: 박쥐 · 우파루파 · 슬라임
      const sy = w.surfaceY(x, z), lim = Math.min(sy - 6, 62); if (lim < 8) continue;
      let y = 6 + (Math.random() * (lim - 6) | 0);
      for (let k = 0; k < 10 && y > 4; k++, y--) { const b = w.getBlock(x, y - 1, z); if (b && b !== BL.water && !w.getBlock(x, y, z)) break; }
      const L = w.getLight(x, y, z); if ((L >> 4) > 3) continue;
      const here = w.getBlock(x, y, z), below = w.getBlock(x, y - 1, z);
      if (here === BL.water && axo < 4 && (below === BL.clay || below === BL.moss_block || w.getBlock(x, y - 2, z) === BL.clay)) { add('axolotl', x + 0.5, y, z + 0.5); if (Math.random() < 0.5) add('axolotl', x + 0.5, y, z + 0.5); return; }
      if (here || !below || !BLOCKS[below].solid || IS_FLUID[below] || w.getBlock(x, y + 1, z)) continue;
      if (!peace && y < 40 && (L & 15) <= 7 && slimes < 4 && hostile < T0[4] && (hashInt(x >> 4, 0, z >> 4, w.seed + 987) % 10) === 0 && Math.random() < 0.4) { add(['slime', 'slime_m', 'slime_s'][Math.random() * 3 | 0], x + 0.5, y, z + 0.5); return; }
      if (bats < 3 && Math.random() < 0.5) { add('bat', x + 0.5, y + 0.3, z + 0.5); return; }
    } else {
      // 밤: 늪의 슬라임·마녀, 가끔 어디서나 마녀
      if (peace || day > 0.35 || hostile >= T0[4]) continue;
      const y = w.surfaceY(x, z), below = w.getBlock(x, y - 1, z);
      if (!below || !BLOCKS[below].solid || IS_FLUID[below] || BLOCKS[below].wave === 1 || w.getBlock(x, y, z) || w.getBlock(x, y + 1, z)) continue;
      if ((w.getLight(x, y, z) & 15) > 7) continue;
      const swamp = w.biomeAt(x, z) === 11;
      if (witches < (swamp ? 2 : 1) && Math.random() < (swamp ? 0.3 : 0.04)) { add('witch', x + 0.5, y, z + 0.5); return; }
      if (swamp && slimes < 4 && Math.random() < 0.5) { add(['slime', 'slime_m'][Math.random() * 2 | 0], x + 0.5, y, z + 0.5); return; }
    }
  }
}
if (typeof Game !== 'undefined') {
  const G = Game.prototype;
  // 지형 판: 새로 만든 세계만 3 (옛 세계·참가자는 저장·방장 값 그대로)
  const _sw = G.startWorld;
  G.startWorld = async function (opt) {
    this._mc3Gen = (opt && !opt.rec && !opt.client) ? 3 : 0;
    return _sw.call(this, opt);
  };
  const _aw = G.attachWorld;
  G.attachWorld = function (w) {
    if (this._mc3Gen) this.worldGen = Math.max(this.worldGen || 1, this._mc3Gen);
    MC3.g = this;
    return _aw.call(this, w);
  };
  // 매 프레임
  const _up = G.update;
  G.update = function (dt) {
    MC3.g = this;
    if (this._mc3Zoom && this.input) { this.input.lookDX *= 0.3; this.input.lookDY *= 0.3; }
    _up.call(this, dt);
    if (this.state !== 'play' || !this.player) { mc3SpyOverlay(false); return; }
    const p = this.player, w = this.world;
    mc3SpyOverlay(!!this._mc3Zoom);
    if (typeof LOD_COL !== 'undefined' && !LOD_COL.squid) Object.assign(LOD_COL, { squid: [0.24, 0.34, 0.56], cod: [0.72, 0.62, 0.46], salmon: [0.66, 0.3, 0.26], tropical_fish: [1, 0.55, 0.15], dolphin: [0.56, 0.66, 0.8], axolotl: [1, 0.72, 0.82], bat: [0.36, 0.26, 0.2], drowned: [0.34, 0.55, 0.5], slime: [0.46, 0.86, 0.42], slime_m: [0.46, 0.86, 0.42], slime_s: [0.46, 0.86, 0.42], witch: [0.36, 0.22, 0.46] });
    if (w.remote) return;
    // 흘림잎: 올라서면 기울어짐
    const fx = Math.floor(p.x), fy = Math.floor(p.y - 0.1), fz = Math.floor(p.z);
    if (p.onGround && w.getBlock(fx, fy, fz) === BL.big_dripleaf && (w.getMeta(fx, fy, fz) & 3) === 1) {
      p._mc3Drip = (p._mc3Drip || 0) + dt;
      if (p._mc3Drip > 0.8) { p._mc3Drip = 0; w.setBlock(fx, fy, fz, BL.big_dripleaf, 3); MC3.untilt.push([fx, fy, fz, performance.now() + 2500]); this.sound.play('step', fx, fy, fz, { mat: 'grass' }); }
    } else p._mc3Drip = 0;
    if (MC3.untilt.length) { const now = performance.now(); for (let i = MC3.untilt.length - 1; i >= 0; i--) { const u = MC3.untilt[i]; if (now < u[3]) continue; if (w.getBlock(u[0], u[1], u[2]) === BL.big_dripleaf) w.setBlock(u[0], u[1], u[2], BL.big_dripleaf, 1); MC3.untilt.splice(i, 1); } }
    // 예전에 드래곤을 물리친 세계도 엔드에 가면 보물 상자
    this._mc3EndT = (this._mc3EndT || 0) - dt;
    if (this._mc3EndT <= 0) { this._mc3EndT = 2; if (w.dim === 'end') mc3EndChest(this); }
  };
  const _dd = G.dragonDefeated;
  G.dragonDefeated = function (d) { const r = _dd.call(this, d); mc3EndChest(this); return r; };
  // 삼지창 던지기, 망원경
  const _int = G.interact;
  G.interact = function (dt, s) {
    const p = this.player, held = p.held, hd = held ? ITEMS[held.id] : null;
    const tri = hd && hd.name === 'trident' && !p.dead;
    if (tri && s.use) this._mc3Tri = (this._mc3Tri || 0) + dt;
    else if (tri && this._mc3Tri > 0.3) {
      const pow = Math.min(1, this._mc3Tri), d = p.lookDir(), sp = 18 + 18 * pow;
      const e = this.ents.add(new Mc3Proj('trident', p.x + d[0] * 0.6, p.eyeY() - 0.1 + d[1] * 0.6, p.z + d[2] * 0.6, d[0] * sp, d[1] * sp, d[2] * sp, 'player'));
      if (!p.creative) { held.d = (held.d || 0) + 1; if (held.d < hd.dur) { e.item = held; e.slot = p.sel; } p.inv[p.sel] = null; this.ui.refreshHotbar(); }
      this.sound.play('bow', p.x, p.y + 1.5, p.z); this.swing = 1; this._mc3Tri = 0;
    } else this._mc3Tri = 0;
    this._mc3Zoom = !!(hd && hd.name === 'spyglass' && s.use && !p.dead);
    return _int.call(this, dt, s);
  };
  const _pu = G.playerUse;
  G.playerUse = function (hit, s, fresh) {
    const p = this.player, w = this.world, held = p.held, hd = held ? ITEMS[held.id] : null, ent = this.targetEnt;
    if (fresh && hd) {
      // 양동이로 물고기·우파루파 담기
      if (ent && !ent.dead && ent.type === 'mob' && MC3_BUCKET[ent.sub] && (hd.name === 'bucket' || hd.name === 'water_bucket')) {
        if (ent.remote) { this.ui.toast('물고기 담기는 방장 세계에서만 돼요', 1500); return; }
        ent.dead = true;
        const nb = I(MC3_BUCKET[ent.sub]);
        if (p.creative) p.give(nb, 1);
        else if (held.n > 1) { held.n--; if (p.give(nb, 1)) this.dropItem(p.x, p.y + 1, p.z, { id: nb, n: 1 }); }
        else p.inv[p.sel] = { id: nb, n: 1 };
        this.sound.play('splash', ent.x, ent.y, ent.z); this.swing = 1; this.ui.refreshHotbar();
        this.advGrant('mc3_bucket'); return;
      }
      // 물고기 양동이: 물과 함께 놓아 주기
      if (hd.mc3fish) {
        if (!hit) return;
        let x = hit.x + DX[hit.face], y = hit.y + DY[hit.face], z = hit.z + DZ[hit.face];
        if (BLOCKS[hit.id].replace) { x = hit.x; y = hit.y; z = hit.z; }
        const cur = w.getBlock(x, y, z);
        if (cur && !BLOCKS[cur].replace) return;
        if (cur !== BL.water || w.getMeta(x, y, z)) this.setBlockNet(x, y, z, BL.water, 0);
        if (!w.remote) { const m = this.ents.add(new Mob(hd.mc3fish, x + 0.5, y + 0.1, z + 0.5)); m.fromBucket = true; }
        else this.ui.toast('물만 부었어요 (물고기 놓아 주기는 방장 세계에서만)', 1800);
        if (!p.creative) p.inv[p.sel] = { id: I('bucket'), n: 1 };
        this.sound.play('splash', x, y, z); this.swing = 1; this.ui.refreshHotbar(); return;
      }
      // 폭죽: 활공 중이면 가속, 아니면 땅에서 쏘아 올림
      if (hd.name === 'firework_rocket') {
        if (p.gliding) { p._mc3Boost = 1.2; this.sound.play('fizz', p.x, p.y, p.z); }
        else if (hit) { this.ents.add(new Mc3Proj('firework', hit.x + 0.5 + DX[hit.face] * 0.6, hit.y + 0.5 + DY[hit.face] * 0.6, hit.z + 0.5 + DZ[hit.face] * 0.6, 0, 6, 0, 'player')); this.sound.play('fizz', hit.x, hit.y, hit.z); this.advGrant('mc3_firework'); }
        else return;
        p.consumeHeld(1); this.swing = 1; return;
      }
    }
    return _pu.call(this, hit, s, fresh);
  };
  // 발광 열매 따기
  const _ub = G.useBlock;
  G.useBlock = function (x, y, z, local, pid) {
    const w = this.world;
    if (w.getBlock(x, y, z) === BL.cave_vines) {
      const m = w.getMeta(x, y, z); if (!(m & 1)) return false;
      this.setBlockNet(x, y, z, BL.cave_vines, m & ~1);
      this.dropItem(x + 0.5, y + 0.3, z + 0.5, { id: I('glow_berries'), n: 1 + (Math.random() < 0.3 ? 1 : 0) });
      if (local) this.sound.play('pop', x, y, z);
      return true;
    }
    return _ub.call(this, x, y, z, local, pid);
  };
  // 놓기: 물에 잠기는 식물은 물속에만, 산호 색 고르기, 자수정 송이 방향, 흘림잎 이어 붙이기
  const _pb = G.placeBlock;
  G.placeBlock = function (hit, bid, held) {
    const d = BLOCKS[bid], w = this.world;
    if (!d || bid < 235 || bid > 255) return _pb.call(this, hit, bid, held);
    let x = hit.x + DX[hit.face], y = hit.y + DY[hit.face], z = hit.z + DZ[hit.face];
    if (BLOCKS[hit.id].replace && hit.id !== bid) { x = hit.x; y = hit.y; z = hit.z; }
    if (d.mc3water && w.getBlock(x, y, z) !== BL.water) { this.ui.toast('🌊 물속에만 심을 수 있어요', 1200); return; }
    this._mc3Face = hit.face;
    try { _pb.call(this, hit, bid, held); } finally { this._mc3Face = undefined; }
    if (w.getBlock(x, y, z) !== bid) return;
    const h = hashInt(x, y, z, 7);
    if (bid === BL.coral_block) this.setBlockNet(x, y, z, bid, h % 5);
    else if (bid === BL.coral) this.setBlockNet(x, y, z, bid, (h % 5) | (h & 8));
    else if (bid === BL.amethyst_cluster) this.setBlockNet(x, y, z, bid, OPP[hit.face] | (3 << 3));
    else if (bid === BL.big_dripleaf) { if (w.getBlock(x, y - 1, z) === bid) this.setBlockNet(x, y - 1, z, bid, 0); this.setBlockNet(x, y, z, bid, 1); }
  };
  const _sd = G.supportDir;
  G.supportDir = function (id, meta) {
    const d = BLOCKS[id];
    if (d && d.mc3sup !== undefined) return d.mc3sup === 'meta' ? meta & 7 : d.mc3sup;
    return _sd.call(this, id, meta);
  };
  const _so = G.supportOk;
  G.supportOk = function (x, y, z, id, meta) {
    const d = BLOCKS[id];
    if (d && d.mc3sup !== undefined) {
      let sd = d.mc3sup === 'meta' ? meta & 7 : d.mc3sup;
      if (this._mc3Face !== undefined && d.shape === 'mc3bud') sd = OPP[this._mc3Face];
      const w = this.world, sx = x + DX[sd], sy = y + DY[sd], sz = z + DZ[sd];
      if (!w.isLoadedAt(sx, sz)) return true;
      const s = w.getBlock(sx, sy, sz), sdf = BLOCKS[s];
      if (s === id && (id === BL.kelp || id === BL.cave_vines || id === BL.big_dripleaf)) return true;
      return !!(s && sdf && sdf.solid && !sdf.fluid && sdf.shape !== 'mc3drip');
    }
    // 이끼 블록 위에도 풀·꽃
    if (d && d.shape === 'cross' && this.world.getBlock(x, y - 1, z) === BL.moss_block) return true;
    return _so.call(this, x, y, z, id, meta);
  };
  // 물에 잠긴 식물이 사라지면 그 자리는 물
  const _obc = G.onBlockChange;
  G.onBlockChange = function (x, y, z, oid, om, id, meta, flags) {
    _obc.call(this, x, y, z, oid, om, id, meta, flags);
    if (id === 0 && MC3_WL[oid] && this.world && !this.world.remote) this.world.setBlock(x, y, z, BL.water, 0);
  };
  // 몹 생성 (방장만): 물고기·박쥐는 원래 동물 수에 안 셈
  const _sp = G.spawnMobs;
  G.spawnMobs = function () {
    const hid = [];
    for (const e of this.ents.list) if (!e.dead && e.type === 'mob' && e.def && e.def.mc3amb) { hid.push(e); e.type = 'mc3hid'; }
    try { _sp.call(this); } finally { for (const e of hid) e.type = 'mob'; }
    if (this.world.dim === 'overworld' && this.worldRules.mobs) mc3Spawn(this);
  };
  const _ds = G.despawnMobs;
  G.despawnMobs = function () {
    _ds.call(this);
    const pls = this.allPlayers();
    for (const e of this.ents.list) {
      if (e.dead || e.type !== 'mob' || !e.def || !e.def.mc3amb || e.fromBucket) continue;
      let md = Infinity; for (const p of pls) md = Math.min(md, (p.x - e.x) ** 2 + (p.z - e.z) ** 2 + (p.y - e.y) ** 2);
      if (md > 72 * 72) e.dead = true;
    }
  };
  const _dmg = G.damageEntity;
  G.damageEntity = function (e, dmg, kx, kz, src) {
    const was = e && e.dead, hp0 = e && e.hp;
    _dmg.call(this, e, dmg, kx, kz, src);
    if (!e || e.remote || e.type !== 'mob') return;
    if (e.sub === 'squid' && e.hp < hp0) this.particles.smoke(e.x, e.y + 0.4, e.z, 14, [0.06, 0.06, 0.1], true);
    if (was || !e.dead) return;
    const next = { slime: 'slime_m', slime_m: 'slime_s' }[e.sub];
    if (next) { const n = 2 + (Math.random() * 2 | 0); for (let i = 0; i < n; i++) { const m = this.ents.add(new Mob(next, e.x + (Math.random() - 0.5) * e.w, e.y + 0.3, e.z + (Math.random() - 0.5) * e.w)); m.vy = 4; m.hurtT = 0.5; } }
    if (e.sub === 'drowned' && e.trident && Math.random() < 0.35) this.dropItem(e.x, e.y + 0.5, e.z, { id: I('trident'), n: 1, d: 40 + (Math.random() * 120 | 0) });
    const by = src === 'player' || src === 'arrow' || src === 'pet' || (src && src.startsWith && src.startsWith('client'));
    if (by && /^slime/.test(e.sub)) this.advGrant('mc3_slime');
    if (by && e.sub === 'witch') this.advGrant('mc3_witch');
  };
  // 명령어
  const _cmd = G.command;
  G.command = function (line) {
    const a = line.trim().slice(1).split(/\s+/), cmd = (a[0] || '').toLowerCase(), say = (t, c) => this.ui.chatLine(t, c || '#aee'), what = (a[1] || '').toLowerCase();
    if (cmd === 'locate' && /^(geode|정동|lush|동굴)$/.test(what)) {
      if ((this.worldGen || 1) < 3 || this.world.dim !== 'overworld') { say('이 세계는 옛 지형이라 정동·무성한 동굴이 없어요. 새로 만든 세계에서 찾아봐요!', '#f88'); return; }
      const p = this.player, pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4, geode = what === 'geode' || what === '정동';
      let best = null, bd = Infinity;
      for (let r = 0; r <= 40 && !best; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const pos = geode ? mc3GeodeAt(this.world.seed, cx, cz) : (mc3LushV(this.world, cx * 16 + 8, cz * 16 + 8) > 0.42 ? { x: cx * 16 + 8, y: 30, z: cz * 16 + 8 } : null);
        if (!pos) continue;
        const d = Math.hypot(pos.x - p.x, pos.z - p.z); if (d < bd) { bd = d; best = pos; }
      }
      if (!best) { say('가까운 곳에는 없어요. 멀리 가 봐요!', '#f88'); return; }
      say(geode ? `💜 가까운 자수정 정동: X ${best.x} · Y ${best.y} · Z ${best.z} (${Math.round(bd)}칸)` : `🌿 가까운 무성한 동굴: X ${best.x} · Z ${best.z} 땅속 (Y 10~50, ${Math.round(bd)}칸)`);
      return;
    }
    if (cmd === 'help' || cmd === '도움말') { _cmd.call(this, line); say('바다·동굴·하늘: /locate geode|lush, /summon squid|cod|salmon|tropical_fish|dolphin|drowned|axolotl|bat|slime|witch, /give elytra · firework_rocket · trident · spyglass'); return; }
    return _cmd.call(this, line);
  };
}
// 무작위 틱: 자수정 자라기, 발광 열매, 다시마 자라기, 흘림잎 되돌리기
{
  const _rt = World.prototype.randomTickBlock;
  World.prototype.randomTickBlock = function (x, y, z, id, meta, light) {
    if (id < 235 || id > 250) return _rt.call(this, x, y, z, id, meta, light);
    if (id === BL.budding_amethyst) {
      if (Math.random() > 0.2) return;
      const d = Math.random() * 6 | 0, nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d], nid = this.getBlock(nx, ny, nz);
      if (nid === 0) this.setBlock(nx, ny, nz, BL.amethyst_cluster, OPP[d]);
      else if (nid === BL.amethyst_cluster) { const m = this.getMeta(nx, ny, nz), s = (m >> 3) & 3; if ((m & 7) === OPP[d] && s < 3) this.setBlock(nx, ny, nz, nid, (m & 7) | ((s + 1) << 3)); }
    } else if (id === BL.cave_vines) {
      if (!(meta & 1) && Math.random() < 0.1) this.setBlock(x, y, z, id, meta | 1);
      else if (!this.getBlock(x, y - 1, z) && Math.random() < 0.03) { let n = 1; while (n < 8 && this.getBlock(x, y + n, z) === id) n++; if (n < 6) this.setBlock(x, y - 1, z, id, 0); }
    } else if (id === BL.kelp) {
      if (Math.random() < 0.05 && this.getBlock(x, y + 1, z) === BL.water && this.getBlock(x, y + 2, z) === BL.water) { let n = 1; while (n < 16 && this.getBlock(x, y - n, z) === id) n++; if (n < 12) this.setBlock(x, y + 1, z, id, 0); }
    } else if (id === BL.big_dripleaf && (meta & 2)) this.setBlock(x, y, z, id, meta & ~2);
  };
}

// ---------------- 도전 과제 (새 장: 바다·동굴·하늘) ----------------
if (typeof ACH_LIST !== 'undefined') {
  const li = CHAPTERS.findIndex(c => c[0] === 'legend');
  CHAPTERS.splice(li < 0 ? CHAPTERS.length : li, 0, ['sea', '🌊 바다·동굴 · 바다와 동굴, 그리고 하늘', '바닷속과 깊은 동굴을 탐험하고 하늘을 날아요']);
  const L = [
    ['mc3_kelp', 'sea', 'basic', 'kelp', '바닷속 숲', '다시마를 얻어요', '새로 만든 세계의 바다 밑에 길쭉하게 자라요.', { items: ['kelp'] }],
    ['mc3_ink', 'sea', 'basic', 'ink_sac', '먹물 발사!', '먹물 주머니를 얻어요', '오징어를 잡으면 나와요. 흰 양털과 섞으면 검은 양털.', { items: ['ink_sac'] }],
    ['mc3_bucket', 'sea', 'basic', 'cod_bucket', '물고기 배달부', '양동이에 물고기를 담아요', '물고기에게 빈 양동이나 물 양동이를 대고 오른쪽 클릭.', {}],
    ['mc3_firework', 'sea', 'basic', 'firework_rocket', '펑! 불꽃놀이', '폭죽을 쏘아 올려요', '종이 + 화약 → 폭죽 3개. 땅에 대고 오른쪽 클릭!', {}],
    ['mc3_spyglass', 'sea', 'basic', 'spyglass', '멀리멀리', '망원경을 만들어요', '자수정 조각 1 + 구리 주괴 2를 세로로.', { items: ['spyglass'] }],
    ['mc3_lush', 'sea', 'basic', 'glow_berries', '반짝반짝 동굴', '발광 열매를 얻어요', '무성한 동굴 천장의 덩굴에서 따요. /locate lush', { items: ['glow_berries'] }],
    ['mc3_slime', 'sea', 'basic', 'slime_ball', '말랑말랑', '슬라임을 물리쳐요', '늪의 밤이나 깊은 땅속에 나와요. 때리면 작게 나뉘어요!', {}],
    ['mc3_coral', 'sea', 'hard', 'coral_block', '산호초 탐험가', '산호 블록을 얻어요', '따뜻한 바다 밑을 찾아봐요. 곡괭이로 캐요.', { items: ['coral_block'] }],
    ['mc3_dolphin', 'sea', 'hard', 'cod', '돌고래와 헤엄', '돌고래 곁에서 빨리 헤엄쳐요', '넓은 바다에서 돌고래 옆으로 헤엄쳐 가요.', {}],
    ['mc3_geode', 'sea', 'hard', 'amethyst_shard', '보라색 보물', '자수정 조각을 얻어요', '땅속 둥근 정동 안의 다 자란 송이를 캐요. /locate geode', { items: ['amethyst_shard'] }],
    ['mc3_axolotl', 'sea', 'hard', 'axolotl_bucket', '우파루파 친구', '우파루파를 양동이에 담아요', '무성한 동굴의 물웅덩이에 살아요.', { items: ['axolotl_bucket'] }],
    ['mc3_witch', 'sea', 'hero', 'glass_bottle', '마녀를 이겼다', '마녀를 물리쳐요', '마녀는 물약을 던지고 마셔요. 활로 멀리서!', {}],
    ['mc3_trident', 'sea', 'hero', 'trident', '바다의 창', '삼지창을 얻어요', '삼지창을 든 드라운드를 물리쳐요. 던지면 돌아와요!', { items: ['trident'] }],
    ['mc3_elytra', 'sea', 'hero', 'elytra', '하늘의 날개', '겉날개를 얻어요', '엔더 드래곤을 물리치면 출구 차원문 옆 상자에 있어요.', { items: ['elytra'] }],
    ['mc3_glide', 'sea', 'legend', 'elytra', '하늘을 나는 아이', '겉날개로 1000칸을 날아요', '높은 곳에서 뛰어내리고 공중에서 Space! 폭죽으로 쭉쭉.', { stat: ['mc3Glide', 1000], need: ['mc3_elytra'], hide: true }],
  ];
  for (const a of L) { ACH_LIST.push(a); ACH[a[0]] = { id: a[0], ch: a[1], tier: a[2], icon: a[3], name: a[4], desc: a[5], tip: a[6], o: a[7] }; if (typeof ADV !== 'undefined') ADV.push([a[0], a[3], a[4], a[5], null]); }
  if (typeof achProgress === 'function') {
    const _ap = achProgress;
    achProgress = function (g, a) {
      const s = a.o.stat;
      if (s && s[0] === 'mc3Glide') { const v = Math.floor((g.stats && g.stats.mc3Glide) || 0); return { v: Math.min(v, s[1]), n: s[1], done: v >= s[1], txt: `${Math.min(v, s[1]).toLocaleString()} / ${s[1].toLocaleString()}칸` }; }
      return _ap(g, a);
    };
  }
}
