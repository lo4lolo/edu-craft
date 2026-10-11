'use strict';
// =====================================================================
// 에듀 크래프트: 지옥(네더) · 엔드 · 엔더 드래곤
//  - 차원마다 따로 World를 만들고, 차원문을 지나면 바꿔 끼운다 (game.travelTo)
//    저장은 rec.mods/be = 평소 세계, rec.dims.nether / rec.dims.end = 다른 차원
//  - 지옥문: 흑요석 틀(가로 2~21, 세로 3~21 안쪽) + 부싯돌과 부시 → 3초 서 있으면 이동 (좌표 1/8)
//  - 엔드 요새: 시드로 정해진 곳(처음 자리에서 300~460칸) 땅속의 차원문 방. 엔더의 눈을 던지면 방향을 알려 줌
//  - 엔드: 엔드 돌 섬, 흑요석 기둥 위 엔드 수정, 엔더 드래곤. 물리치면 출구 차원문과 드래곤 알
//  - 구조물: 무너진 지옥문(평소 세계, 흑요석·부싯돌 보물), 지옥 요새(블레이즈), 시작 보너스 상자
//  - 함께 하기(멀티)에서는 차원 이동을 막는다 (세계 동기화가 평소 세계 기준이라서)
// =====================================================================

// ---------------- 텍스처 ----------------
function buildDimTextures() {
  const bricks = (p, base, mortar, v) => {
    p.fill(mortar);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let bx = -1; bx < 3; bx++) {
        const x0 = bx * 8 + off;
        const c = p.vary(base, v);
        for (let y = row * 4; y < row * 4 + 3; y++) for (let x = x0; x < x0 + 7; x++) if (x >= 0 && x < 16) p.set(x, y, p.vary(c, 6));
      }
    }
  };
  addTex('netherrack', p => { p.noise([118, 44, 44], 14); p.blobs(10, [88, 30, 32], 8, 0.5, 1.3); p.blobs(6, [150, 66, 60], 8, 0.4, 0.9); });
  addTex('soul_sand', p => {
    p.noise([96, 74, 58], 10); p.blobs(6, [78, 58, 44], 6, 0.6, 1.4);
    for (const [fx, fy] of [[2, 3], [9, 8], [4, 11]]) { p.set(fx, fy, [52, 38, 30]); p.set(fx + 2, fy, [52, 38, 30]); p.rect(fx, fy + 2, 3, 1, [52, 38, 30]); }
  });
  addTex('nether_bricks', p => bricks(p, [74, 30, 36], [38, 14, 20], 10));
  addTex('nether_quartz_ore', p => { p.copy('netherrack'); for (let k = 0; k < 6; k++) { const x = 2 + p.r() * 12 | 0, y = 2 + p.r() * 12 | 0; p.set(x, y, [240, 234, 226]); p.set(x + 1, y, [220, 212, 204]); p.set(x, y + 1, [250, 246, 240]); } });
  addTex('nether_gold_ore', p => { p.copy('netherrack'); for (let k = 0; k < 7; k++) { const x = 1 + p.r() * 14 | 0, y = 1 + p.r() * 14 | 0; p.set(x, y, [252, 214, 80]); p.set(x + 1, y, [230, 180, 50]); } });
  addTex('nether_portal', p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
      const v = Math.sin(d * 0.9 - a * 2) * 0.5 + 0.5;
      p.set(x, y, [110 + v * 90, 30 + v * 40, 190 + v * 60], 175 + v * 50);
    }
  });
  addTex('end_stone', p => { p.noise([228, 226, 172], 8); p.blobs(7, [208, 202, 150], 6, 0.4, 1.0); p.blobs(4, [240, 238, 196], 4, 0.3, 0.7); });
  addTex('end_stone_bricks', p => bricks(p, [232, 230, 178], [196, 190, 140], 6));
  addTex('end_frame_side', p => { p.noise([70, 112, 98], 8); p.rect(0, 0, 16, 3, [62, 98, 86]); p.rectN(0, 11, 16, 5, [226, 224, 170], 8); });
  addTex('end_frame_top', p => { p.noise([66, 106, 94], 8); p.border([52, 86, 76]); p.disc(8, 8, 4, [30, 48, 44]); p.disc(8, 8, 2.6, [22, 34, 32]); });
  addTex('end_frame_top_eye', p => { p.copy('end_frame_top'); p.disc(8, 8, 3.6, [70, 170, 110]); p.disc(8, 8, 2, [120, 230, 160]); p.rect(7, 6, 2, 4, [20, 30, 25]); });
  addTex('end_eye', p => { p.noise([80, 180, 120], 10); p.disc(8, 8, 4, [130, 235, 170]); p.rect(7, 4, 2, 8, [20, 30, 25]); });
  addTex('end_portal', p => {
    p.fill([8, 10, 22]);
    for (let k = 0; k < 22; k++) { const x = p.r() * 16 | 0, y = p.r() * 16 | 0, c = [[90, 220, 200], [160, 120, 255], [230, 240, 255], [70, 160, 255]][k % 4]; p.set(x, y, c); }
  });
  addTex('dragon_egg', p => { p.noise([24, 12, 30], 6); p.blobs(9, [70, 26, 96], 8, 0.3, 0.9); p.blobs(5, [120, 50, 150], 8, 0.2, 0.5); });
  addTex('fire', p => {
    p.clear();
    for (let x = 0; x < 16; x++) {
      const h = 6 + (Math.sin(x * 1.7) * 3 + p.r() * 6 | 0);
      for (let k = 0; k < h; k++) {
        const y = 15 - k, t = k / h;
        const c = t < 0.35 ? [255, 236, 120] : t < 0.7 ? [255, 160, 40] : [235, 80, 30];
        p.set(x, y, c);
      }
    }
  });
  addTex('quartz_block', p => { p.noise([238, 232, 224], 4); p.border([220, 212, 204]); });
  addTex('magma_block', p => {
    p.noise([110, 40, 22], 10);
    for (let k = 0; k < 9; k++) { let x = p.r() * 16 | 0, y = p.r() * 16 | 0; for (let s = 0; s < 5; s++) { p.set(x, y, [255, 150, 40]); x += (p.r() * 3 | 0) - 1; y += (p.r() * 3 | 0) - 1; } }
  });
  addTex('end_rod', p => { p.clear(); p.rect(7, 4, 2, 2, [255, 255, 250]); p.rect(7, 6, 2, 8, [246, 240, 232]); p.rect(6, 14, 4, 2, [200, 186, 170]); });
  // 아이템
  const it = (name, fn) => addTex(name, q => { q.clear(); fn(q); q.outline(); }, true);
  it('blaze_rod', p => { p.line(3, 13, 12, 3, [255, 196, 60], 2); p.line(4, 13, 12, 4, [230, 130, 30], 1); p.set(12, 3, [255, 240, 160]); });
  it('blaze_powder', p => { p.disc(8, 10, 4.5, [250, 170, 40], 20); p.disc(7, 8, 2.2, [255, 220, 90], 10); });
  it('ender_pearl', p => { p.disc(8, 8, 5, [30, 110, 96], 8); p.disc(8, 8, 3, [60, 170, 150], 8); p.set(6, 6, [190, 255, 240]); });
  it('eye_of_ender', p => { p.disc(8, 8, 5, [90, 170, 90], 8); p.disc(8, 8, 3.2, [150, 220, 120], 6); p.rect(7, 5, 2, 6, [20, 40, 30]); p.set(6, 6, [230, 255, 220]); });
  it('ghast_tear', p => { for (let y = 3; y < 14; y++) { const w = y < 8 ? (y - 3) * 0.6 : 3.2 - (y - 8) * 0.3; for (let x = 0; x < 16; x++) if (Math.abs(x + 0.5 - 8) < w) p.set(x, y, [200, 236, 245]); } p.set(7, 8, [255, 255, 255]); });
  it('gold_nugget', p => { p.disc(7, 9, 2.6, [250, 210, 70]); p.disc(10, 7, 1.8, [255, 230, 110]); p.set(6, 8, [255, 250, 200]); });
  it('quartz', p => { p.art(['......a.', '.....aba', '....abba', '...abba.', '..abba..', '.abba...', 'abba....', '.aa.....'].map(r => '....' + r), { a: [200, 196, 190], b: [246, 242, 236] }); });
  it('nether_brick', p => { p.rect(3, 6, 10, 5, [96, 36, 44]); p.rect(3, 6, 10, 1, [130, 56, 64]); });
}
// 지옥문·엔드 차원문은 은은하게 반짝임 (텍스처 레이어를 바꾸지 않고 셰이더 발광으로 충분)

// ---------------- 블록 ----------------
function defineDimBlocks() {
  const b = defBlock;
  b(102, 'netherrack', '네더랙', { tex: faces('netherrack'), hard: 0.4, tool: 'pick', lvl: 1, cat: 'nature', desc: '지옥의 붉은 돌. 화로에서 구우면 네더 벽돌 조각이 돼요.' });
  b(103, 'soul_sand', '영혼 모래', { tex: faces('soul_sand'), hard: 0.5, tool: 'shovel', sound: 'sand', cat: 'nature', desc: '위를 걸으면 느려져요.' });
  b(104, 'nether_bricks', '네더 벽돌', { tex: faces('nether_bricks'), hard: 2, tool: 'pick', lvl: 1, desc: '지옥 요새를 이루는 벽돌. 근처에 블레이즈가 나타나요.' });
  b(105, 'nether_brick_fence', '네더 벽돌 울타리', { tex: faces('nether_bricks'), shape: 'fence', opaque: false, hard: 2, tool: 'pick', lvl: 1, conductor: false });
  b(106, 'nether_quartz_ore', '네더 석영 광석', { tex: faces('nether_quartz_ore'), hard: 3, tool: 'pick', lvl: 1, cat: 'nature', drop: (m, rnd) => [[I('quartz'), 1 + (rnd() < 0.3 ? 1 : 0)]] });
  b(107, 'nether_gold_ore', '네더 금광석', { tex: faces('nether_gold_ore'), hard: 3, tool: 'pick', lvl: 1, cat: 'nature', drop: (m, rnd) => [[I('gold_nugget'), 2 + (rnd() * 5 | 0)]] });
  // 지옥문 meta: 0 동서로 펼쳐짐(남북으로 얇음), 1 남북으로 펼쳐짐
  b(108, 'nether_portal', '지옥문', { tex: faces('nether_portal'), shape: 'portal', solid: false, opaque: false, layer: 2, hard: -1, emit: 11, emissive: true, item: false, push: 'block', drop: () => [], sound: 'glass', conductor: false });
  b(109, 'end_stone', '엔드 돌', { tex: faces('end_stone'), hard: 3, tool: 'pick', lvl: 1, cat: 'nature' });
  // 엔드 차원문 틀 meta: 4 = 엔더의 눈 끼움
  b(148, 'end_portal_frame', '엔드 차원문 틀', { shape: 'endframe', opaque: false, hard: -1, push: 'block', emit: m => (m & 4) ? 3 : 0, cat: 'nature', conductor: false,
    texf: (m, f) => f === 1 ? T(m & 4 ? 'end_frame_top_eye' : 'end_frame_top') : f === 0 ? T('end_stone') : T('end_frame_side'), desc: '엔더의 눈 12개를 모두 끼우면 엔드로 가는 차원문이 열려요.' });
  b(149, 'end_portal', '엔드 차원문', { tex: faces('end_portal'), shape: 'endportal', solid: false, opaque: false, hard: -1, emit: 15, emissive: true, item: false, push: 'block', drop: () => [], conductor: false });
  b(150, 'end_stone_bricks', '엔드 돌 벽돌', { tex: faces('end_stone_bricks'), hard: 3, tool: 'pick', lvl: 1 });
  b(151, 'dragon_egg', '드래곤 알', { tex: faces('dragon_egg'), shape: 'egg', opaque: false, hard: 3, emit: 1, cat: 'nature', conductor: false, desc: '엔더 드래곤을 물리친 증표! 세상에 하나뿐이에요.' });
  b(152, 'fire', '불', { tex: faces('fire'), shape: 'cross', solid: false, opaque: false, layer: 1, hard: 0, emit: 15, emissive: true, replace: true, item: false, drop: () => [], wave: 0, push: 'break', sound: 'wool', conductor: false });
  b(153, 'quartz_block', '석영 블록', { tex: faces('quartz_block'), hard: 0.8, tool: 'pick', lvl: 1 });
  b(154, 'end_rod', '엔드 막대', { tex: faces('end_rod'), shape: 'torch', solid: false, opaque: false, layer: 1, hard: 0, emit: 14, emissive: true, icon: 'end_rod', push: 'break', cat: 'tools', sound: 'glass', desc: '하얗게 빛나는 막대 조명이에요.' });
  b(155, 'magma_block', '마그마 블록', { tex: faces('magma_block'), hard: 0.5, tool: 'pick', lvl: 1, emit: 3, emissive: true, cat: 'nature', desc: '뜨거워요! 웅크리면 밟아도 괜찮아요.' });
}
function defineDimItems() {
  const it = defItem;
  it(360, 'blaze_rod', '블레이즈 막대', { desc: '지옥 요새의 블레이즈를 물리치면 나와요. 블레이즈 가루 2개를 만들 수 있어요.' });
  it(361, 'blaze_powder', '블레이즈 가루', { desc: '엔더 진주와 합치면 엔더의 눈!' });
  it(362, 'ender_pearl', '엔더 진주', { stack: 16, cat: 'tools', desc: '엔더맨이 떨어뜨려요. 던지면 떨어진 곳으로 순간이동해요.' });
  it(363, 'eye_of_ender', '엔더의 눈', { cat: 'tools', desc: '던지면 엔드 요새 쪽으로 날아가요. 요새의 차원문 틀 12개에 끼우면 엔드로 가는 문이 열려요.' });
  it(364, 'ghast_tear', '가스트의 눈물', { desc: '가스트를 물리치면 가끔 나와요. 아주 귀한 보물!' });
  it(365, 'gold_nugget', '금 조각', { desc: '9개를 모으면 금 주괴 1개가 돼요.' });
  it(366, 'quartz', '네더 석영', { desc: '4개로 석영 블록을 만들어요.' });
  it(367, 'nether_brick', '네더 벽돌 조각', { desc: '네더랙을 화로에 구워 만들어요. 4개로 네더 벽돌.' });
}
function defineDimRecipes() {
  S(['blaze_rod'], 'blaze_powder', 2);
  S(['ender_pearl', 'blaze_powder'], 'eye_of_ender');
  R(['NNN', 'NNN', 'NNN'], { N: 'gold_nugget' }, 'gold_ingot'); S(['gold_ingot'], 'gold_nugget', 9);
  R(['BB', 'BB'], { B: 'nether_brick' }, 'nether_bricks');
  R(['BNB', 'BNB'], { B: 'nether_bricks', N: 'nether_brick' }, 'nether_brick_fence', 6);
  R(['QQ', 'QQ'], { Q: 'quartz' }, 'quartz_block');
  R(['EE', 'EE'], { E: 'end_stone' }, 'end_stone_bricks', 4);
  S(['blaze_rod', 'glass'], 'end_rod', 4);
}
function defineDimSmelting() {
  const s = (a, b) => { SMELT[I(a)] = I(b); };
  s('netherrack', 'nether_brick'); s('nether_quartz_ore', 'quartz'); s('nether_gold_ore', 'gold_ingot');
  FUEL[I('blaze_rod')] = 2400;
}

// ---------------- 보물 상자 ----------------
const LOOT = {
  bonus: [['oak_log', 10, 16], ['apple', 4, 8], ['bread', 4, 6], ['torch', 12, 16], ['coal', 6, 10], ['wood_pickaxe', 1, 1], ['wood_axe', 1, 1], ['stone_sword', 1, 1]],
  ruined: [['obsidian', 4, 7], ['flint_and_steel', 1, 1], ['gold_ingot', 2, 6], ['iron_ingot', 2, 5], ['bread', 2, 4], ['golden_apple', 0, 1]],
  fortress: [['gold_ingot', 3, 8], ['iron_ingot', 3, 6], ['diamond', 1, 3], ['obsidian', 2, 4], ['blaze_rod', 1, 2], ['flint_and_steel', 1, 1], ['golden_apple', 0, 1]],
  stronghold: [['ender_pearl', 2, 4], ['iron_ingot', 3, 6], ['bread', 3, 6], ['diamond', 1, 2], ['golden_apple', 1, 1], ['bow', 1, 1], ['arrow', 16, 32]],
};
function fillLoot(be, table, seed) {
  const rnd = mulberry32(seed | 0), L = LOOT[table]; if (!be || !L) return;
  const free = be.items.map((_, i) => i);
  for (const [name, a, b] of L) {
    let n = a + Math.floor(rnd() * (b - a + 1)); if (n <= 0) continue;
    const id = I(name), max = itemMaxStack(id);
    while (n > 0 && free.length) { const k = Math.min(n, max); const si = free.splice(rnd() * free.length | 0, 1)[0]; be.items[si] = { id, n: k }; n -= k; }
  }
}

// ---------------- 지형: 평소 세계 ----------------
// 땅 위로 드러난 작은 광석 바위 (아이들이 광석을 금방 볼 수 있게)
World.prototype.surfaceOres = function (c, ids, cols) {
  const r = mulberry32(hashInt(c.cx, 77, c.cz, this.seed));
  if (r() > 0.4) return;
  const x0 = 3 + (r() * 10 | 0), z0 = 3 + (r() * 10 | 0);
  const col = cols[x0 | z0 << 4];
  if (col.biome <= 1 || col.h < SEA + 1 || col.h > 110) return;
  const pick = () => { const v = r(); return v < 0.45 ? BL.coal_ore : v < 0.75 ? BL.iron_ore : v < 0.92 ? BL.copper_ore : v < 0.97 ? BL.gold_ore : BL.redstone_ore; };
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const d = Math.abs(dx) + Math.abs(dz); if (d > 3) continue;
    const x = x0 + dx, z = z0 + dz, hh = cols[x | z << 4].h;
    const top = hh + (d <= 1 ? 2 : d <= 2 ? 1 : 0);
    for (let y = Math.max(1, hh - 1); y <= top && y < HEIGHT - 1; y++) ids[CI(x, y, z)] = r() < 0.38 ? pick() : BL.stone;
    const a = top + 1 < HEIGHT ? ids[CI(x, top + 1, z)] : 0;
    if (a && BLOCKS[a] && (BLOCKS[a].shape === 'cross')) ids[CI(x, top + 1, z)] = 0;
  }
};
// 엔드 요새 위치 (시드로 정해짐: 처음 자리에서 300~460칸)
function strongholdPos(seed) {
  const a = hash01(7, 999, 3, seed) * Math.PI * 2, d = 300 + hash01(11, 999, 5, seed) * 160;
  const cx = Math.floor(Math.cos(a) * d / 16), cz = Math.floor(Math.sin(a) * d / 16);
  return { cx, cz, x: cx * 16 + 8, z: cz * 16 + 8, y: 21 };
}
// 처음 자리 근처의 무너진 지옥문: 후보 청크 중 가운데가 땅인 첫 곳 (바다면 다음 후보)
const RUIN_CANDS = [[3, 1], [-3, 2], [2, -3], [-3, -3], [4, 4], [-5, 0], [0, 5], [5, -4], [-2, 6], [6, 2], [-6, -4], [1, -6]];
function ruinChunk0(w) {
  if (w._ruin0 !== undefined) return w._ruin0;
  for (const [cx, cz] of RUIN_CANDS) { const col = w.column(cx * 16 + 8, cz * 16 + 8); if (col.biome > 1 && col.h >= SEA + 1 && col.h < 110) return (w._ruin0 = cx + ',' + cz); }
  return (w._ruin0 = null);
}
const END_RING = [[-1, -2], [0, -2], [1, -2], [-1, 2], [0, 2], [1, 2], [-2, -1], [-2, 0], [-2, 1], [2, -1], [2, 0], [2, 1]];
World.prototype.structures = function (c, cols) {
  if (this.type === 'flat') return;
  const ids = c.ids, meta = c.meta, bx = c.cx * 16, bz = c.cz * 16;
  const set = (x, y, z, id, m) => { if (x < 0 || x > 15 || z < 0 || z > 15 || y < 1 || y >= HEIGHT) return; ids[CI(x, y, z)] = id; meta[CI(x, y, z)] = m || 0; };
  // ---- 엔드 요새: 차원문 방 ----
  const sh = strongholdPos(this.seed);
  if (c.cx === sh.cx && c.cz === sh.cz) {
    const rnd = mulberry32(hashInt(c.cx, 404, c.cz, this.seed));
    for (let x = 1; x <= 14; x++) for (let z = 1; z <= 14; z++) for (let y = 20; y <= 28; y++) {
      const wall = x === 1 || x === 14 || z === 1 || z === 14 || y === 20 || y === 28;
      set(x, y, z, wall ? (rnd() < 0.2 ? BL.mossy_cobblestone : BL.stone_bricks) : 0);
    }
    for (const [dx, dz] of END_RING) set(8 + dx, 21, 8 + dz, BL.end_portal_frame, rnd() < 0.25 ? 4 : 0);
    for (const [x, z] of [[2, 6], [2, 10], [13, 6], [13, 10]]) for (let y = 21; y <= 23; y++) set(x, y, z, BL.bookshelf);
    set(2, 24, 4, BL.torch, 4); set(2, 24, 12, BL.torch, 4); set(13, 24, 4, BL.torch, 5); set(13, 24, 12, BL.torch, 5);
    set(12, 21, 12, BL.chest, 4); this.lootAt.set(fmtKey(bx + 12, 21, bz + 12), 'stronghold');
    // 땅 위로 올라가는 사다리 통로와 이끼 낀 표지
    const h = cols[2 | 3 << 4].h;
    if (h >= SEA) {
      for (let y = 21; y <= h; y++) {
        if (y >= 28) for (const [ox, oz] of [[1, 3], [3, 3], [2, 2], [2, 4]]) set(ox, y, oz, BL.stone_bricks);
        set(2, y, 3, BL.ladder, 4); set(1, y, 3, BL.stone_bricks);
      }
      for (const [ox, oz] of [[1, 2], [3, 2], [1, 4], [3, 4]]) for (let y = h + 1; y <= h + 3; y++) set(ox, y, oz, BL.mossy_cobblestone);
      set(2, h + 3, 2, BL.torch, 0);
    }
  }
  // ---- 무너진 지옥문 (처음 자리 근처에 하나는 꼭) ----
  const CELL = 16, ix = Math.floor((c.cx + 8) / CELL), iz = Math.floor((c.cz + 8) / CELL);
  const here = ix === 0 && iz === 0 ? ruinChunk0(this) === c.cx + ',' + c.cz :(hash01(ix, 555, iz, this.seed) < 0.55 && c.cx === ix * CELL - 6 + (hash01(ix, 556, iz, this.seed) * 12 | 0) && c.cz === iz * CELL - 6 + (hash01(ix, 557, iz, this.seed) * 12 | 0));
  if (here) {
    const col = cols[8 | 8 << 4], h = col.h;
    if (col.biome > 1 && h >= SEA + 1 && h < 110) {
      const rnd = mulberry32(hashInt(c.cx, 558, c.cz, this.seed));
      for (let x = 4; x <= 12; x++) for (let z = 5; z <= 11; z++) for (let y = h + 1; y <= h + 7; y++) set(x, y, z, 0);
      for (let x = 5; x <= 11; x++) for (let z = 6; z <= 10; z++) { const r = rnd(); for (let y = h - 1; y <= h; y++) set(x, y, z, r < 0.35 ? BL.netherrack : r < 0.45 ? BL.magma_block : BL.stone_bricks); }
      const missing = new Set([1 + (rnd() * 3 | 0), 5 + (rnd() * 4 | 0), 10 + (rnd() * 3 | 0)]);
      let k = 0;
      for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 4; dx++) {
        const edge = dx === 0 || dx === 3 || dy === 0 || dy === 4; if (!edge) continue;
        if (!missing.has(k++)) set(6 + dx, h + 1 + dy, 8, BL.obsidian);
      }
      set(11, h + 1, 9, BL.chest, 4); this.lootAt.set(fmtKey(bx + 11, h + 1, bz + 9), 'ruined');
      set(5, h + 1, 7, BL.gold_block);
    }
  }
};

// ---------------- 지형: 지옥 ----------------
const NETHER_FORTRESS_Y = 66;
function fortressesNear(seed, cx, cz) {
  const out = [], CELL = 128;
  for (let fx = Math.floor((cx * 16 - 64) / CELL); fx <= Math.floor((cx * 16 + 80) / CELL); fx++)
    for (let fz = Math.floor((cz * 16 - 64) / CELL); fz <= Math.floor((cz * 16 + 80) / CELL); fz++) {
      if (!(fx === 0 && fz === 0) && hash01(fx, 321, fz, seed) > 0.6) continue;
      out.push([fx * CELL + 40 + (hash01(fx, 322, fz, seed) * 48 | 0), fz * CELL + 40 + (hash01(fx, 323, fz, seed) * 48 | 0)]);
    }
  return out;
}
World.prototype.genNether = function (c) {
  const bx = c.cx * 16, bz = c.cz * 16, ids = c.ids, meta = c.meta;
  const GX = 5, GY = 33, GZ = 5, g = new Float32Array(GX * GY * GZ);
  for (let gx = 0; gx < GX; gx++) for (let gz = 0; gz < GZ; gz++) for (let gy = 0; gy < GY; gy++) {
    const x = bx + gx * 4, y = gy * 4, z = bz + gz * 4;
    let v = this.nC.n3(x / 52, y / 30, z / 52) + this.nH.n3(x / 20, y / 14, z / 20) * 0.45 - 0.18;
    if (y < 36) v += (36 - y) / 13;
    if (y > 96) v += (y - 96) / 9;
    g[(gx * GZ + gz) * GY + gy] = v;
  }
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const gx = x >> 2, fx = (x & 3) / 4, gz = z >> 2, fz = (z & 3) / 4;
    c.biome[x | z << 4] = 7;
    for (let y = 0; y < HEIGHT; y++) {
      let id;
      const hb = hash01(bx + x, y, bz + z, this.seed);
      if (y === 0 || y === HEIGHT - 1 || (y < 4 && hb < 0.5 - y * 0.12) || (y > HEIGHT - 5 && hb < (y - (HEIGHT - 5)) * 0.25)) id = BL.bedrock;
      else {
        const gy = Math.min(GY - 2, y >> 2), fy = (y & 3) / 4;
        const i000 = (gx * GZ + gz) * GY + gy, i100 = ((gx + 1) * GZ + gz) * GY + gy, i010 = (gx * GZ + gz + 1) * GY + gy, i110 = ((gx + 1) * GZ + gz + 1) * GY + gy;
        const v0 = lerp(lerp(g[i000], g[i100], fx), lerp(g[i010], g[i110], fx), fz);
        const v1 = lerp(lerp(g[i000 + 1], g[i100 + 1], fx), lerp(g[i010 + 1], g[i110 + 1], fx), fz);
        const v = lerp(v0, v1, fy);
        id = v > 0 ? BL.netherrack : y <= 31 ? BL.lava : 0;
      }
      ids[CI(x, y, z)] = id;
    }
  }
  const rnd = mulberry32(hashInt(c.cx, 600, c.cz, this.seed));
  const vein = (id, cnt, size, y0, y1) => {
    for (let k = 0; k < cnt; k++) {
      let x = rnd() * 16 | 0, y = y0 + (rnd() * (y1 - y0) | 0), z = rnd() * 16 | 0;
      for (let s = 0; s < size; s++) { if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < HEIGHT && ids[CI(x, y, z)] === BL.netherrack) ids[CI(x, y, z)] = id; const d = rnd() * 6 | 0; x += DX[d]; y += DY[d]; z += DZ[d]; }
    }
  };
  vein(BL.nether_quartz_ore, 16, 7, 10, 118); vein(BL.nether_gold_ore, 10, 6, 10, 118);
  // 바닥 장식: 영혼 모래, 마그마, 불
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const soul = this.nW.n2((bx + x) / 26, (bz + z) / 26) > 0.35;
    for (let y = 5; y < 120; y++) {
      const i = CI(x, y, z);
      if (ids[i] !== BL.netherrack || ids[i + 256] !== 0) continue;
      const r = hash01(bx + x, y + 900, bz + z, this.seed);
      if (soul) { ids[i] = BL.soul_sand; if (ids[i - 256] === BL.netherrack) ids[i - 256] = BL.soul_sand; }
      else if (y <= 34 && r < 0.3) ids[i] = BL.magma_block;
      else if (r < 0.006) ids[i + 256] = BL.fire;
    }
  }
  // 천장의 발광석 덩어리
  for (let k = 0; k < 3; k++) {
    let x = 2 + (rnd() * 12 | 0), z = 2 + (rnd() * 12 | 0), y = 60 + (rnd() * 55 | 0);
    for (; y < 122; y++) if (ids[CI(x, y, z)] === BL.netherrack && ids[CI(x, y - 1, z)] === 0) break;
    if (y >= 122) continue;
    for (let s = 0; s < 22; s++) {
      if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 4 && y < 122 && ids[CI(x, y, z)] === 0) ids[CI(x, y, z)] = BL.glowstone;
      const d = rnd(); if (d < 0.5) y--; else if (d < 0.625) x++; else if (d < 0.75) x--; else if (d < 0.875) z++; else z--;
    }
  }
  // 지옥 요새
  for (const [ox, oz] of fortressesNear(this.seed, c.cx, c.cz)) this.drawFortress(c, ox, oz);
  this.applyMods(c);
  c.state = 1;
};
World.prototype.drawFortress = function (c, ox, oz) {
  const ids = c.ids, meta = c.meta, bx = c.cx * 16, bz = c.cz * 16, FY = NETHER_FORTRESS_Y;
  const set = (x, y, z, id, m) => { ids[CI(x, y, z)] = id; meta[CI(x, y, z)] = m || 0; };
  const pillar = (x, z, from) => { for (let y = from; y > 1; y--) { const cur = ids[CI(x, y, z)]; if (cur && cur !== BL.lava && cur !== BL.fire) break; set(x, y, z, BL.nether_bricks); } };
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const wx = bx + x, wz = bz + z, ax = Math.abs(wx - ox), az = Math.abs(wz - oz);
    const room = ax <= 6 && az <= 6;
    const onX = az <= 2 && ax <= 48, onZ = ax <= 2 && az <= 48;
    if (!room && !onX && !onZ) continue;
    if (room) {
      for (let y = FY - 1; y <= FY + 7; y++) {
        let id = 0;
        if (y <= FY || y === FY + 7) id = BL.nether_bricks;
        else if (ax === 6 || az === 6) {
          const door = (ax <= 1 || az <= 1) && y <= FY + 3;
          const win = (y === FY + 3 || y === FY + 4) && (ax % 3 === 0 && az % 3 === 0 ? false : (ax === 6 ? az % 3 === 0 : ax % 3 === 0));
          id = door ? 0 : win ? BL.nether_brick_fence : BL.nether_bricks;
        }
        if (y === FY + 7 && ax === 3 && az === 3) id = BL.glowstone;
        set(x, y, z, id);
      }
      if (ax === 6 && az === 6) pillar(x, z, FY - 2);
      if (wx === ox && wz === oz + 3) { set(x, FY + 1, z, BL.chest, 2); this.lootAt.set(fmtKey(wx, FY + 1, wz), 'fortress'); }
      continue;
    }
    const off = onX ? az : ax, along = onX ? wx - ox : wz - oz;
    set(x, FY, z, BL.nether_bricks); set(x, FY - 1, z, BL.nether_bricks);
    for (let y = FY + 1; y <= FY + 4; y++) set(x, y, z, off === 2 && y === FY + 1 ? BL.nether_brick_fence : 0);
    if (Math.abs(along) % 12 === 0 && off <= 1) pillar(x, z, FY - 2);
    if (Math.abs(along) >= 45 && off === 2) for (let y = FY + 1; y <= FY + 3; y++) set(x, y, z, BL.nether_bricks);
    if (Math.abs(along) === 46 && off === 0) set(x, FY + 1, z, BL.glowstone);
  }
};

// ---------------- 지형: 엔드 ----------------
function endIslandTop(w, x, z) {
  const d = Math.hypot(x, z), R = 74 + w.nC.fbm2(x / 45, z / 45, 3) * 12;
  if (d >= R) return -1;
  const k = 1 - (d / R) * (d / R);
  return Math.round(56 + k * 6 + w.nH.n2(x / 18, z / 18) * 1.5);
}
const END_PILLARS = (() => { const a = []; for (let i = 0; i < 10; i++) { const ang = i / 10 * Math.PI * 2; a.push({ x: Math.round(Math.cos(ang) * 42), z: Math.round(Math.sin(ang) * 42), r: 2 + (i % 3), h: 72 + ((i * 7) % 10) * 2 }); } return a; })();
const END_ARRIVE_X = 60;
World.prototype.genEnd = function (c) {
  const bx = c.cx * 16, bz = c.cz * 16, ids = c.ids;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    c.biome[x | z << 4] = 7;
    const wx = bx + x, wz = bz + z, top = endIslandTop(this, wx, wz);
    if (top < 0) continue;
    const d = Math.hypot(wx, wz), R = 74 + this.nC.fbm2(wx / 45, wz / 45, 3) * 12, k = Math.max(0, 1 - (d / R) * (d / R));
    const bottom = Math.round(56 - Math.sqrt(k) * 34 + this.nD.n2(wx / 12, wz / 12) * 3);
    for (let y = Math.max(1, bottom); y <= top; y++) ids[CI(x, y, z)] = BL.end_stone;
  }
  // 흑요석 기둥 (꼭대기 기반암 위에 엔드 수정)
  for (const P of END_PILLARS) {
    if (P.x + P.r < bx || P.x - P.r > bx + 15 || P.z + P.r < bz || P.z - P.r > bz + 15) continue;
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const dx = bx + x - P.x, dz = bz + z - P.z; if (dx * dx + dz * dz > P.r * P.r + 0.5) continue;
      for (let y = 40; y <= P.h; y++) ids[CI(x, y, z)] = BL.obsidian;
      if (dx === 0 && dz === 0) ids[CI(x, P.h + 1, z)] = BL.bedrock;
    }
  }
  // 가운데 출구 차원문 받침 (드래곤을 물리치면 차원문이 생김)
  const ft = endIslandTop(this, 0, 0);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const wx = bx + x, wz = bz + z, d = Math.hypot(wx, wz); if (d > 3.3) continue;
    ids[CI(x, ft, z)] = BL.bedrock;
    ids[CI(x, ft + 1, z)] = d > 2.5 ? BL.bedrock : 0;
    if (wx === 0 && wz === 0) for (let y = ft + 1; y <= ft + 4; y++) ids[CI(x, y, z)] = BL.bedrock;
    for (let y = ft + 2; y <= ft + 6; y++) if (!(wx === 0 && wz === 0 && y <= ft + 4)) ids[CI(x, y, z)] = 0;
  }
  // 도착 발판 (흑요석)
  const at = endIslandTop(this, END_ARRIVE_X, 0);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const wx = bx + x, wz = bz + z;
    if (Math.abs(wx - END_ARRIVE_X) > 2 || Math.abs(wz) > 2) continue;
    ids[CI(x, at, z)] = BL.obsidian;
    for (let y = at + 1; y <= at + 3; y++) ids[CI(x, y, z)] = 0;
  }
  this.applyMods(c);
  c.state = 1;
};

// ---------------- 개체: 화염구 · 던진 진주 · 엔더의 눈 ----------------
class Fireball extends Entity {
  constructor(x, y, z, vx, vy, vz, kind) { super('fireball', 0.3, 0.3); this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz; this.kind = kind; this.stepHeight = 0; }
  update(dt, g) {
    this.age += dt; if (this.age > 10) { this.dead = true; return; }
    const steps = 3, p = g.player;
    for (let s = 0; s < steps; s++) {
      const nx = this.x + this.vx * dt / steps, ny = this.y + this.vy * dt / steps, nz = this.z + this.vz * dt / steps;
      const id = g.world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
      if (id && BLOCKS[id].solid) { this.impact(g, this.x, this.y, this.z); return; }
      this.x = nx; this.y = ny; this.z = nz;
      if (!p.dead && Math.abs(p.x - nx) < 0.65 && ny > p.y - 0.2 && ny < p.y + 1.9 && Math.abs(p.z - nz) < 0.65) { this.impact(g, nx, ny, nz, p); return; }
    }
    if (Math.random() < 0.5) g.particles.smoke(this.x, this.y, this.z, 1, this.kind === 'dragon' ? [0.8, 0.3, 1] : [1, 0.55, 0.15]);
  }
  impact(g, x, y, z, hitP) {
    this.dead = true;
    if (this.kind === 'small') {
      if (hitP) g.hurtPlayer(hitP, 4, 'fire');
      g.particles.smoke(x, y, z, 8, [1, 0.6, 0.2]); g.sound.play('fizz', x, y, z);
      const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
      if (g.worldRules.tntGrief && !g.world.getBlock(fx, fy, fz) && BLOCKS[g.world.getBlock(fx, fy - 1, fz)].solid) { g.world.setBlock(fx, fy, fz, BL.fire, 0); g.world.schedule(fx, fy, fz, 120 + Math.random() * 160, 3); }
    } else g.explode(x, y, z, this.kind === 'dragon' ? 1.6 : 1.3, this.kind === 'dragon');
  }
  render(g, R, cam) {
    const m = M4.create(); M4.translate(m, this.x - cam[0], this.y - cam[1], this.z - cam[2]);
    const s = this.kind === 'ghast' ? 0.45 : this.kind === 'dragon' ? 0.5 : 0.18;
    R.ent.addBox(m, -s, -s, -s, s, s, s, this.kind === 'dragon' ? [0.75, 0.3, 1] : [1, 0.62, 0.18], 1, 1);
  }
}
class ThrownPearl extends Entity {
  constructor(x, y, z, vx, vy, vz) { super('thrown', 0.25, 0.25); this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz; this.stepHeight = 0; }
  update(dt, g) {
    this.age += dt; if (this.age > 12) { this.dead = true; return; }
    this.vy -= 20 * dt;
    for (let s = 0; s < 3; s++) {
      const nx = this.x + this.vx * dt / 3, ny = this.y + this.vy * dt / 3, nz = this.z + this.vz * dt / 3;
      const id = g.world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
      if ((id && BLOCKS[id].solid) || ny < -30) {
        this.dead = true;
        const p = g.player; if (p.dead || ny < -30) return;
        p.x = this.x; p.y = Math.floor(this.y) + (this.vy < 0 ? 0.01 : 0); p.z = this.z; p.vx = p.vy = p.vz = 0; p.fallDist = 0;
        let guard = 0; while (guard++ < 6 && (BLOCKS[g.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].solid || BLOCKS[g.world.getBlock(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z))].solid)) p.y += 1;
        p.hurt(2, 'fall'); g.sound.play('teleport', p.x, p.y, p.z); g.particles.smoke(p.x, p.y + 1, p.z, 14, [0.6, 0.3, 0.9]);
        return;
      }
      this.x = nx; this.y = ny; this.z = nz;
    }
  }
  render(g, R, cam) { const m = M4.create(); M4.translate(m, this.x - cam[0], this.y - cam[1], this.z - cam[2]); R.ent.addBox(m, -0.12, -0.12, -0.12, 0.12, 0.12, 0.12, [0.2, 0.55, 0.5], 1, 0.6); }
}
class EyeOfEnder extends Entity {
  constructor(x, y, z, tx, tz) { super('eye', 0.25, 0.25); this.x = x; this.y = y; this.z = z; this.tx = tx; this.tz = tz; this.stepHeight = 0; }
  update(dt, g) {
    this.age += dt;
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz) || 1;
    if (this.age < 2.4) {
      if (d > 10) { this.x += dx / d * 9 * dt; this.z += dz / d * 9 * dt; this.y += (this.age < 1.2 ? 3.5 : 0.4) * dt; }
      else this.y -= 4 * dt;
      if (Math.random() < 0.6) g.particles.dust(this.x, this.y, this.z, [0.65, 0.35, 1]);
    } else { this.dead = true; g.dropItem(this.x, this.y, this.z, { id: I('eye_of_ender'), n: 1 }); }
  }
  render(g, R, cam) { const m = M4.create(); M4.translate(m, this.x - cam[0], this.y - cam[1], this.z - cam[2]); M4.mul(m, m, M4.rotY(M4.create(), this.age * 5)); R.ent.addBox(m, -0.14, -0.14, -0.14, 0.14, 0.14, 0.14, [0.45, 0.85, 0.5], 1, 1); }
}

// ---------------- 몹 ----------------
Object.assign(MOB_TYPES, {
  zombie_piglin: { k: '좀비 피글린', hp: 20, w: 0.6, h: 1.95, speed: 2.4, hostile: false, neutral: true, dmg: 5, fireImmune: true, drops: [['rotten_flesh', 0, 1], ['gold_nugget', 1, 3]] },
  enderman: { k: '엔더맨', hp: 40, w: 0.6, h: 2.9, speed: 3.2, hostile: false, neutral: true, ender: true, dmg: 4, drops: [['ender_pearl', 1, 1]] },
  blaze: { k: '블레이즈', hp: 20, w: 0.6, h: 1.8, speed: 2.2, hostile: true, flying: true, fireImmune: true, hover: 2.5, keep: 7, range: 18, shot: 'small', cool: 3, burst: 3, drops: [['blaze_rod', 1, 1]] },
  ghast: { k: '가스트', hp: 10, w: 3.6, h: 3.6, speed: 1.8, hostile: true, flying: true, fireImmune: true, hover: 7, keep: 18, range: 40, shot: 'ghast', cool: 4, burst: 1, drops: [['ghast_tear', 0, 1], ['gunpowder', 0, 2]] },
  end_crystal: { k: '엔드 수정', hp: 1, w: 1.4, h: 1.8, speed: 0, hostile: false, boss: true, drops: [] },
  ender_dragon: { k: '엔더 드래곤', hp: 160, w: 5, h: 3, speed: 15, hostile: true, boss: true, fireImmune: true, drops: [] },
});
// 날아다니는 몹 (블레이즈·가스트)
function mobFly(dt, g) {
  const D = this.def, w = g.world;
  this.age += dt; if (this.hurtT > 0) this.hurtT -= dt; this.walk += dt * 3;
  if (g.settings.peaceful) { this.dead = true; return; }
  let best = null, bd = D.range * D.range;
  for (const p of g.allPlayers()) { if (p.dead || p.creative) continue; const d = (p.x - this.x) ** 2 + (p.y - this.y) ** 2 + (p.z - this.z) ** 2; if (d < bd) { bd = d; best = p; } }
  let tx, ty, tz;
  if (best) {
    const dx = best.x - this.x, dz = best.z - this.z, dist = Math.hypot(dx, dz) || 1;
    this.yaw = Math.atan2(-dx, -dz);
    tx = best.x - dx / dist * D.keep; tz = best.z - dz / dist * D.keep; ty = best.y + D.hover;
    this.attackT = (this.attackT || 1.5) - dt;
    if (this.attackT <= 0 && g.lineOfSight(this.x, this.y + this.h * 0.6, this.z, best.x, best.y + 1.5, best.z)) {
      this.shots = (this.shots || 0) + 1;
      const sx = this.x, sy = this.y + this.h * 0.6, sz = this.z, ex = best.x - sx, ey = best.y + 1.2 - sy, ez = best.z - sz, el = Math.hypot(ex, ey, ez) || 1;
      const sp = D.shot === 'small' ? 14 : 11, spread = D.shot === 'small' ? 0.08 : 0;
      g.ents.add(new Fireball(sx + ex / el * (this.w / 2 + 0.4), sy, sz + ez / el * (this.w / 2 + 0.4), (ex / el + (Math.random() - 0.5) * spread) * sp, ey / el * sp, (ez / el + (Math.random() - 0.5) * spread) * sp, D.shot));
      g.sfx(D.shot === 'small' ? 'blaze' : 'ghast', sx, sy, sz);
      if (this.shots >= D.burst) { this.shots = 0; this.attackT = D.cool + Math.random() * 1.5; } else this.attackT = 0.35;
      this.flash = 0.3;
    }
  } else {
    this.wanderT = (this.wanderT || 0) - dt;
    if (this.wanderT <= 0 || !this.wx) { this.wanderT = 3 + Math.random() * 4; this.wx = this.x + (Math.random() - 0.5) * 16; this.wz = this.z + (Math.random() - 0.5) * 16; this.wy = this.y + (Math.random() - 0.5) * 4; }
    tx = this.wx; ty = this.wy; tz = this.wz;
  }
  if (this.flash > 0) this.flash -= dt;
  const ax = tx - this.x, ay = ty - this.y, az = tz - this.z, l = Math.hypot(ax, ay, az) || 1;
  const sp = l < 1 ? 0 : D.speed, k = Math.min(1, dt * 2);
  this.vx += (ax / l * sp - this.vx) * k; this.vy += (ay / l * sp - this.vy) * k; this.vz += (az / l * sp - this.vz) * k;
  this.move(w, this.vx * dt, this.vy * dt, this.vz * dt);
  if (this.y < -20) this.dead = true;
}
// 엔더맨 순간이동
function enderTeleport(e, g, near) {
  const w = g.world;
  for (let k = 0; k < 16; k++) {
    const x = Math.floor((near ? near.x : e.x) + (Math.random() - 0.5) * (near ? 8 : 24)), z = Math.floor((near ? near.z : e.z) + (Math.random() - 0.5) * (near ? 8 : 24));
    if (!w.isLoadedAt(x, z)) continue;
    for (let y = Math.floor(e.y) + 8; y > Math.floor(e.y) - 10 && y > 1; y--) {
      const b = w.getBlock(x, y - 1, z);
      if (b && BLOCKS[b].solid && !IS_FLUID[b] && !w.getBlock(x, y, z) && !w.getBlock(x, y + 1, z) && !w.getBlock(x, y + 2, z)) {
        g.particles.smoke(e.x, e.y + 1.4, e.z, 10, [0.6, 0.3, 0.9]);
        e.x = x + 0.5; e.y = y; e.z = z + 0.5; e.vx = e.vy = e.vz = 0;
        g.sfx('teleport', e.x, e.y + 1, e.z);
        return true;
      }
    }
  }
  return false;
}
{
  const _upd = Mob.prototype.update;
  Mob.prototype.update = function (dt, g) {
    const D0 = MOB_TYPES[this.sub];
    if (D0.flying) return mobFly.call(this, dt, g);
    if (D0.neutral) {
      if (this.angry > 0) { this.angry -= dt; this.def = D0.angryDef || (D0.angryDef = Object.assign({}, D0, { hostile: true })); }
      else this.def = D0;
    }
    if (D0.fireImmune) this.burnT = 0;
    _upd.call(this, dt, g);
    if (D0.ender && !this.dead) {
      this.tpT = (this.tpT || 2) - dt;
      if (this.inWater && this.tpT <= 0) { this.tpT = 1; g.damageEntity(this, 1, 0, 0, 'water'); enderTeleport(this, g); }
      else if (this.angry > 0 && this.target && this.tpT <= 0 && Math.hypot(this.target.x - this.x, this.target.z - this.z) > 10) { this.tpT = 3; enderTeleport(this, g, this.target); }
    }
  };
}

// ---------------- 엔드 수정 · 엔더 드래곤 ----------------
class EndCrystal extends Mob {
  constructor(idx, x, y, z) { super('end_crystal', x, y, z); this.idx = idx; this.stepHeight = 0; }
  update(dt) { this.age += dt; if (this.hurtT > 0) this.hurtT -= dt; this.vx = this.vy = this.vz = 0; }
  onDeath(g) {
    if (g.dragon && g.dragon.crystals) g.dragon.crystals[this.idx] = false;
    const d = g.ents.list.find(e => e.sub === 'ender_dragon' && !e.dead);
    if (d && d.beam === this) { d.hp -= 10; d.hurtT = 0.45; g.ui.chatLine('💥 드래곤을 치료하던 수정이 터졌어요! 드래곤도 다쳤어요!', '#ffb3c8'); }
    g.explode(this.x, this.y + 0.8, this.z, 2, true);
    const left = (g.dragon.crystals || []).filter(Boolean).length;
    g.ui.toast(left ? `💎 엔드 수정을 부쉈어요! 남은 수정 ${left}개` : '💎 수정을 모두 부쉈어요! 이제 드래곤은 회복할 수 없어요!', 2600);
  }
  render(g, R, cam) {
    const m = M4.create(), t = M4.create(), bob = Math.sin(this.age * 2) * 0.25;
    M4.translate(m, this.x - cam[0], this.y + 0.9 + bob - cam[1], this.z - cam[2]);
    M4.mul(m, m, M4.rotY(t, this.age * 1.6)); M4.mul(m, m, M4.rotX(t, 0.6));
    R.ent.addBox(m, -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, [0.8, 0.7, 0.98], 1, 0.8);
    const m2 = new Float32Array(m); M4.mul(m2, m2, M4.rotY(t, -this.age * 3));
    R.ent.addBox(m2, -0.28, -0.28, -0.28, 0.28, 0.28, 0.28, [1, 0.35, 0.85], 1, 1);
  }
}
class EnderDragon extends Mob {
  constructor(x, y, z, hp) { super('ender_dragon', x, y, z); if (hp) this.hp = hp; this.phase = 'circle'; this.phaseT = 6; this.ang = Math.atan2(z, x); this.flap = 0; this.stepHeight = 0; this.healT = 0; this.hitCd = 0; this.pitch = 0; this.perched = 0; }
  update(dt, g) {
    this.age += dt; if (this.hurtT > 0) this.hurtT -= dt;
    const p = g.player, top = endIslandTop(g.world, 0, 0);
    this.flap += dt * (this.phase === 'perch' && this.perched > 0 ? 1.5 : 5);
    // 가장 가까운 수정이 치료해 줌
    this.beam = null; this.healT -= dt;
    let nd = 48 * 48;
    for (const e of g.ents.list) if (e.sub === 'end_crystal' && !e.dead) { const d2 = (e.x - this.x) ** 2 + (e.y - this.y) ** 2 + (e.z - this.z) ** 2; if (d2 < nd) { nd = d2; this.beam = e; } }
    if (this.beam && this.healT <= 0) { this.healT = 0.5; this.hp = Math.min(MOB_TYPES.ender_dragon.hp, this.hp + 1); }
    const tgt = !p.dead && !p.creative ? p : null;
    let tx, ty, tz, sp = 13;
    this.phaseT -= dt;
    const pd = tgt ? Math.hypot(tgt.x - this.x, tgt.y + 1 - this.y - 1.5, tgt.z - this.z) : 99;
    switch (this.phase) {
      case 'circle':
        this.ang += dt * 0.32;
        tx = Math.cos(this.ang) * 36; tz = Math.sin(this.ang) * 36; ty = top + 18 + Math.sin(this.ang * 2) * 5;
        if (this.phaseT <= 0) {
          if (!tgt) { this.phaseT = 4; break; }
          const r = Math.random();
          this.phase = r < 0.4 ? 'strafe' : r < 0.78 ? 'charge' : 'perch';
          this.phaseT = this.phase === 'perch' ? 16 : 8; this.shot = false; this.perched = 0;
          g.sfx('dragon_roar', this.x, this.y, this.z, { vol: 1.5 });
        }
        break;
      case 'strafe':
        if (!tgt) { this.phase = 'circle'; break; }
        tx = tgt.x; ty = tgt.y + 12; tz = tgt.z; sp = 15;
        if (!this.shot && pd < 30) {
          this.shot = true;
          const ex = tgt.x - this.x, ey = tgt.y + 1 - (this.y + 1.5), ez = tgt.z - this.z, el = Math.hypot(ex, ey, ez) || 1;
          g.ents.add(new Fireball(this.x + ex / el * 4, this.y + 1.5 + ey / el * 4, this.z + ez / el * 4, ex / el * 13, ey / el * 13, ez / el * 13, 'dragon'));
          this.phase = 'circle'; this.phaseT = 6 + Math.random() * 4;
        }
        if (this.phaseT <= 0) this.phase = 'circle';
        break;
      case 'charge':
        if (!tgt) { this.phase = 'circle'; break; }
        tx = tgt.x; ty = tgt.y + 1; tz = tgt.z; sp = 19;
        if (pd < 3.5 || this.phaseT <= 0) { this.phase = 'circle'; this.phaseT = 7 + Math.random() * 5; }
        break;
      case 'perch': {
        tx = 0.5; ty = top + 5; tz = 0.5; sp = 10;
        const dd = Math.hypot(this.x - tx, this.y - ty, this.z - tz);
        if (dd < 1.6) {
          this.perched += dt; this.x = tx; this.y = ty; this.z = tz; this.vx = this.vy = this.vz = 0;
          this.breathT = (this.breathT || 0) - dt;
          if (this.breathT <= 0) {
            this.breathT = 1.2;
            for (let i = 0; i < 12; i++) g.particles.dust(this.x + (Math.random() - 0.5) * 8, top + 2 + Math.random(), this.z + (Math.random() - 0.5) * 8, [0.75, 0.3, 1]);
            if (tgt && Math.hypot(tgt.x - this.x, tgt.z - this.z) < 9 && tgt.y < this.y + 2) g.hurtPlayer(tgt, 2, 'dragon');
          }
          if (this.perched > 7) { this.phase = 'circle'; this.phaseT = 8; this.y += 1; }
        }
        if (this.phaseT <= 0) { this.phase = 'circle'; this.phaseT = 8; }
        break;
      }
    }
    if (tx !== undefined && !(this.phase === 'perch' && this.perched > 0)) {
      const dx = tx - this.x, dy = ty - this.y, dz = tz - this.z, d = Math.hypot(dx, dy, dz) || 1;
      const want = d < 0.8 ? 0 : sp, k = Math.min(1, dt * 1.6);
      this.vx += (dx / d * want - this.vx) * k; this.vy += (dy / d * want - this.vy) * k; this.vz += (dz / d * want - this.vz) * k;
      this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
      if (Math.hypot(this.vx, this.vz) > 0.6) { const ty2 = Math.atan2(-this.vx, -this.vz); let dyaw = ty2 - this.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2; this.yaw += dyaw * Math.min(1, dt * 4); }
      this.pitch = clamp(-this.vy / 22, -0.5, 0.5);
    }
    // 몸통 박치기
    this.hitCd -= dt;
    if (tgt && this.hitCd <= 0 && Math.abs(tgt.x - this.x) < 2.8 && Math.abs(tgt.z - this.z) < 2.8 && tgt.y + 1.6 > this.y && tgt.y < this.y + 3) {
      const l = Math.hypot(tgt.x - this.x, tgt.z - this.z) || 1;
      g.hurtPlayer(tgt, 5, 'dragon', (tgt.x - this.x) / l * 1.5, (tgt.z - this.z) / l * 1.5); tgt.vy = 9; this.hitCd = 1.2;
    }
    if (this.y < top - 20) this.y = top + 20;
    if (g.dragon) g.dragon.hp = this.hp;
  }
  onDeath(g) { g.dragonDefeated(this); }
  render(g, R, cam) {
    renderDragon(R, this, cam, this.lightAt(g.world));
    if (this.beam && !this.beam.dead) {
      const b = this.beam, sx = b.x, sy = b.y + 1, sz = b.z, ex = this.x, ey = this.y + 1.5, ez = this.z;
      for (let i = 1; i < 10; i++) {
        const t = i / 10, m = M4.create(); M4.translate(m, sx + (ex - sx) * t - cam[0], sy + (ey - sy) * t - cam[1], sz + (ez - sz) * t - cam[2]);
        R.ent.addBox(m, -0.1, -0.1, -0.1, 0.1, 0.1, 0.1, [1, 0.5, 0.9], 1, 1);
      }
    }
  }
}
function renderDragon(R, e, cam, L) {
  const base = M4.create(), t = M4.create();
  M4.translate(base, e.x - cam[0], e.y - cam[1], e.z - cam[2]);
  M4.mul(base, base, M4.rotY(t, e.yaw)); M4.mul(base, base, M4.rotX(t, e.pitch || 0));
  const hurt = e.hurtT > 0;
  const C = (c) => hurt ? [Math.min(1, c[0] + 0.5), c[1] * 0.4, c[2] * 0.4] : c;
  const body = C([0.1, 0.08, 0.13]), dark = C([0.05, 0.04, 0.07]), wing = C([0.2, 0.13, 0.25]), bone = C([0.3, 0.28, 0.32]);
  const box = (m, a, b, c2, d, e2, f, col, lit) => R.ent.addBox(m, a, b, c2, d, e2, f, col, lit ? 1 : L[0], lit ? 1 : L[1]);
  const at = (x, y, z, rx, ry, rz) => { const m = new Float32Array(base), tr = M4.create(); M4.translate(tr, x, y, z); M4.mul(m, m, tr); if (ry) M4.mul(m, m, M4.rotY(t, ry)); if (rx) M4.mul(m, m, M4.rotX(t, rx)); if (rz) M4.mul(m, m, M4.rotZ(t, rz)); return m; };
  box(base, -0.9, 0.7, -1.6, 0.9, 2.1, 1.6, body);
  for (let k = 0; k < 3; k++) box(base, -0.1, 2.1, -1 + k * 0.9, 0.1, 2.45, -0.6 + k * 0.9, bone);
  // 목과 머리
  const wob = Math.sin(e.age * 2) * 0.08;
  for (let k = 0; k < 3; k++) box(at(0, 1.5 + k * 0.18, -1.6 - k * 0.65, 0, wob * k, 0), -0.3, -0.3, -0.35, 0.3, 0.3, 0.35, body);
  const hm = at(0, 2.0, -3.7, 0, wob * 3, 0);
  box(hm, -0.5, -0.35, -0.5, 0.5, 0.35, 0.5, body);
  box(hm, -0.35, -0.3, -1.2, 0.35, 0.1, -0.5, dark);
  box(hm, -0.35, -0.42 - (e.phase === 'perch' ? 0.15 : 0), -1.1, 0.35, -0.3, -0.5, dark);
  box(hm, -0.42, 0.05, -0.51, -0.18, 0.18, -0.49, [0.85, 0.35, 1], true); box(hm, 0.18, 0.05, -0.51, 0.42, 0.18, -0.49, [0.85, 0.35, 1], true);
  box(hm, -0.4, 0.35, 0.1, -0.25, 0.6, 0.35, bone); box(hm, 0.25, 0.35, 0.1, 0.4, 0.6, 0.35, bone);
  // 꼬리
  for (let k = 0; k < 8; k++) { const sw = Math.sin(e.age * 2.2 - k * 0.6) * 0.12 * k; const s = 0.32 - k * 0.025; box(at(sw, 1.4 - k * 0.04, 1.9 + k * 0.6, 0, 0, 0), -s, -s, -0.3, s, s, 0.3, k % 2 ? dark : body); }
  // 다리
  for (const [lx, lz] of [[-0.7, -1.1], [0.7, -1.1], [-0.7, 1.1], [0.7, 1.1]]) box(base, lx - 0.18, 0, lz - 0.2, lx + 0.18, 0.75, lz + 0.2, dark);
  // 날개
  const fl = Math.sin(e.flap) * 0.55;
  const lw = at(-0.9, 1.95, -0.3, 0, 0, fl), rw = at(0.9, 1.95, -0.3, 0, 0, -fl);
  box(lw, -4.4, -0.05, -1.1, 0, 0.05, 1.5, wing); box(lw, -4.4, -0.08, -1.2, 0, 0.08, -0.95, bone);
  box(rw, 0, -0.05, -1.1, 4.4, 0.05, 1.5, wing); box(rw, 0, -0.08, -1.2, 4.4, 0.08, -0.95, bone);
}
// 새 몹 모양
{
  const _rmm = renderMobModel;
  const P = 1 / 16;
  renderMobModel = function (R, sub, x, y, z, yaw, walk, L, hurt, fuse) {
    const mk = () => { const b = M4.create(), t = M4.create(); M4.translate(b, x, y, z); M4.mul(b, b, M4.rotY(t, yaw)); return [b, t]; };
    const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
    if (sub === 'enderman') {
      const [base, t] = mk(); const sw = Math.sin(walk) * 0.5;
      const box = (m, a, b, c, d, e, f, col, lit) => R.ent.addBox(m, a, b, c, d, e, f, tint(col), lit ? 1 : L[0], lit ? 1 : L[1]);
      const limb = (px, py, pz, ang) => { const m = new Float32Array(base), tr = M4.create(); M4.translate(tr, px, py, pz); M4.mul(m, m, tr); M4.mul(m, m, M4.rotX(t, ang)); return m; };
      const blk = [0.07, 0.06, 0.09];
      for (const [lx, ph] of [[-1.6 * P, sw], [1.6 * P, -sw]]) box(limb(lx, 30 * P, 0, ph), -1 * P, -30 * P, -1 * P, 1 * P, 0, 1 * P, blk);
      box(base, -4 * P, 30 * P, -2 * P, 4 * P, 41 * P, 2 * P, blk);
      for (const [ax, ph] of [[-5 * P, -sw], [5 * P, sw]]) box(limb(ax, 40 * P, 0, ph), -1 * P, -29 * P, -1 * P, 1 * P, 0, 1 * P, blk);
      box(base, -4 * P, 41 * P, -4 * P, 4 * P, 49 * P, 4 * P, blk);
      box(base, -3.2 * P, 44 * P, -4.05 * P, -0.8 * P, 45 * P, -4 * P, [0.85, 0.35, 1], true); box(base, 0.8 * P, 44 * P, -4.05 * P, 3.2 * P, 45 * P, -4 * P, [0.85, 0.35, 1], true);
      return;
    }
    if (sub === 'zombie_piglin') {
      const [base, t] = mk(); const sw = Math.sin(walk) * 0.7;
      renderHumanoid(R, base, t, sw, [0.93, 0.62, 0.6], [0.55, 0.38, 0.2], [0.42, 0.3, 0.2], 2 * P, true, L, hurt);
      const box = (a, b, c, d, e, f, col) => R.ent.addBox(base, a, b, c, d, e, f, tint(col), L[0], L[1]);
      box(-2 * P, 25 * P, -5.5 * P, 2 * P, 28 * P, -4 * P, [0.95, 0.68, 0.66]);
      box(-1.2 * P, 26 * P, -5.6 * P, -0.4 * P, 27 * P, -5.5 * P, [0.4, 0.2, 0.2]); box(0.4 * P, 26 * P, -5.6 * P, 1.2 * P, 27 * P, -5.5 * P, [0.4, 0.2, 0.2]);
      box(-5 * P, 28 * P, -1 * P, -4 * P, 31 * P, 1 * P, [0.93, 0.62, 0.6]); box(4 * P, 28 * P, -1 * P, 5 * P, 31 * P, 1 * P, [0.93, 0.62, 0.6]);
      box(-3 * P, 29 * P, -4.05 * P, 0 * P, 31 * P, -4 * P, [0.5, 0.7, 0.45]);
      return;
    }
    if (sub === 'blaze') {
      const [base, t] = mk();
      const box = (m, a, b, c, d, e, f, col) => R.ent.addBox(m, a, b, c, d, e, f, tint(col), 1, 0.9);
      const bob = Math.sin(walk * 0.7) * 0.08;
      box(base, -0.25, 1.15 + bob, -0.25, 0.25, 1.65 + bob, 0.25, [1, 0.82, 0.25]);
      box(base, -0.16, 1.4 + bob, -0.26, -0.04, 1.47 + bob, -0.25, [0.25, 0.1, 0]); box(base, 0.04, 1.4 + bob, -0.26, 0.16, 1.47 + bob, -0.25, [0.25, 0.1, 0]);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
        const a = walk * (0.6 + r * 0.25) * (r % 2 ? -1 : 1) + i * Math.PI / 2 + r * 0.4, rad = 0.45 - r * 0.06, yy = 0.85 - r * 0.33 + bob;
        const m = M4.create(); M4.translate(m, x + Math.cos(a) * rad, y + yy, z + Math.sin(a) * rad);
        box(m, -0.06, -0.25, -0.06, 0.06, 0.25, 0.06, [1, 0.6, 0.12]);
      }
      return;
    }
    if (sub === 'ghast') {
      const [base, t] = mk();
      const box = (m, a, b, c, d, e, f, col) => R.ent.addBox(m, a, b, c, d, e, f, tint(col), Math.max(L[0], 0.6), Math.max(L[1], 0.5));
      box(base, -1.8, 0.9, -1.8, 1.8, 3.6, 1.8, [0.95, 0.94, 0.94]);
      box(base, -1.2, 2.4, -1.81, -0.5, 2.7, -1.8, [0.2, 0.2, 0.25]); box(base, 0.5, 2.4, -1.81, 1.2, 2.7, -1.8, [0.2, 0.2, 0.25]);
      box(base, -0.6, 1.5, -1.81, 0.6, 1.9, -1.8, [0.3, 0.25, 0.28]);
      for (let i = 0; i < 9; i++) {
        const tx = -1.2 + (i % 3) * 1.2, tz = -1.2 + Math.floor(i / 3) * 1.2, len = 0.7 + ((i * 7) % 5) * 0.12;
        const m = new Float32Array(base), tr = M4.create(); M4.translate(tr, tx, 0.9, tz); M4.mul(m, m, tr); M4.mul(m, m, M4.rotX(t, Math.sin(walk + i) * 0.25));
        box(m, -0.1, -len, -0.1, 0.1, 0, 0.1, [0.9, 0.88, 0.88]);
      }
      return;
    }
    return _rmm(R, sub, x, y, z, yaw, walk, L, hurt, fuse);
  };
}

// ---------------- 소리 ----------------
{
  const SFX = {
    portal(o, t) { this.tone(o, t, 1.6, 'sine', 140, 420, 0.25, 0.3); this.tone(o, t, 1.6, 'sine', 210, 90, 0.18, 0.3); this.noiseHit(o, t, 1.4, 'bandpass', 700, 2, 0.15); },
    teleport(o, t) { this.tone(o, t, 0.35, 'sine', 900, 200, 0.25); this.noiseHit(o, t, 0.3, 'highpass', 3000, 1, 0.12); },
    blaze(o, t) { this.noiseHit(o, t, 0.35, 'bandpass', 900, 1, 0.35); this.tone(o, t, 0.25, 'sawtooth', 220, 120, 0.08); },
    ghast(o, t) { this.tone(o, t, 0.9, 'sine', 700, 1300, 0.22, 0.05); this.tone(o, t + 0.1, 0.8, 'triangle', 520, 980, 0.12); },
    dragon_roar(o, t) { this.tone(o, t, 1.6, 'sawtooth', 90, 55, 0.35, 0.1); this.noiseHit(o, t, 1.4, 'lowpass', 500, 0.7, 0.5, 0.6); this.tone(o, t, 1.2, 'square', 140, 70, 0.08, 0.1); },
    victory(o, t) { [0, 4, 7, 12, 16, 19, 24].forEach((k, i) => this.tone(o, t + i * 0.12, 0.6, 'triangle', 392 * Math.pow(2, k / 12), 0, 0.22)); },
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

// ---------------- 렌더러: 차원별 하늘과 빛 ----------------
{
  const _atm = Renderer.prototype.computeAtmosphere;
  Renderer.prototype.computeAtmosphere = function (world, rain) {
    const A = _atm.call(this, world, world.dim === 'overworld' ? rain : 0);
    if (world.dim === 'nether') {
      A.skyTop = [0.3, 0.06, 0.05]; A.skyHor = [0.46, 0.12, 0.08]; A.sunGlow = [0, 0, 0]; A.sunPos = [0, 0, 0];
      A.sunCol = [0, 0, 0]; A.ambCol = [0, 0, 0]; A.lightDir = [0, -1, 0]; A.day = 1; A.dimAmb = [0.24, 0.13, 0.11];
      A.waterFog = [0.4, 0.1, 0.05];
    } else if (world.dim === 'end') {
      A.skyTop = [0.04, 0.02, 0.07]; A.skyHor = [0.13, 0.09, 0.18]; A.sunGlow = [0, 0, 0]; A.sunPos = [0, 0, 0];
      A.sunCol = [0, 0, 0]; A.ambCol = [0.42, 0.36, 0.52]; A.lightDir = [0, -1, 0]; A.day = 0; A.dimAmb = [0.06, 0.05, 0.08];
    } else A.dimAmb = null;
    return A;
  };
}

// ---------------- 게임: 차원 이동 ----------------
const DIM_NAMES = { overworld: '평소 세계', nether: '지옥', end: '엔드' };
Game.prototype.travelTo = function (dim, x, y, z, arrive, label) {
  if (this.net.connected) { this.ui.toast('🤝 함께 하기 중에는 다른 차원으로 갈 수 없어요', 3000); this.portalCD = 3; return false; }
  const old = this.world, p = this.player;
  if (this.builder.running) this.builder.stop();
  this.builder.visible = false; this.builder.updateStatus();
  this.dimStore[old.dim] = { mods: old.mods, be: old.be };
  for (const c of old.chunks.values()) this.renderer.deleteChunkMesh(c);
  const w = new World(old.seed, old.type, dim);
  w.time = old.time; w.tick = old.tick;
  const st = this.dimStore[dim]; this.dimStore[dim] = null;
  if (st) { w.mods = objToMods(st.mods); w.be = st.be instanceof Map ? st.be : new Map(st.be || []); }
  this.world = w;
  this.attachWorld(w);
  if (p.riding) { p.riding = null; }
  p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.fallDist = 0;
  this.pendingArrive = arrive; this.portalT = 0;
  this.breakProg = 0; this.breakTarget = null; this.target = null;
  this.state = 'loading'; this.loadStart = performance.now();
  this.ui.closeModal(true);
  this.ui.showLoading(label || (DIM_NAMES[dim] + '(으)로 가는 중...'));
  this.sound.play('portal');
  return true;
};
// 로딩이 끝나면 도착 위치를 정함. false면 아직 준비 안 됨
Game.prototype.finishArrive = function () {
  const a = this.pendingArrive, p = this.player, w = this.world;
  const cx = Math.floor(p.x), cz = Math.floor(p.z);
  if (!w.isLoadedAt(cx, cz)) return false;
  if (a.kind === 'portal') {
    let pos = this.findPortalNear(cx, cz, w.dim === 'nether' ? 16 : 28);
    if (!pos) pos = this.buildPortalAt(cx, cz);
    p.x = pos.x + 0.5; p.y = pos.y; p.z = pos.z + 0.5;
    this.ui.chatLine(w.dim === 'nether' ? '🔥 지옥에 도착했어요! 용암을 조심하고, 돌아갈 지옥문 위치를 기억해 두세요.' : '🌍 평소 세계로 돌아왔어요!', '#ffb37a');
    if (w.dim === 'nether' && !this.dragon.netherTip) { this.dragon.netherTip = true; this.ui.chatLine('💡 네더 벽돌로 지은 「지옥 요새」에 블레이즈가 살아요. 블레이즈 막대 + 엔더맨의 엔더 진주 = 엔더의 눈!', '#ffe27a'); }
  } else if (a.kind === 'end') {
    const top = endIslandTop(w, END_ARRIVE_X, 0);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { w.setBlock(END_ARRIVE_X + dx, top, dz, BL.obsidian, 0); for (let y = top + 1; y <= top + 3; y++) if (w.getBlock(END_ARRIVE_X + dx, y, dz)) w.setBlock(END_ARRIVE_X + dx, y, dz, 0, 0); }
    p.x = END_ARRIVE_X + 0.5; p.y = top + 1; p.z = 0.5; p.yaw = Math.PI / 2;
  } else {
    const s = p.spawn; p.x = s[0]; p.y = s[1]; p.z = s[2];
  }
  this.portalCD = 3; this.portalT = 0;
  this.pendingArrive = null; this._arrived = true;
  if (a.ending) setTimeout(() => this.showEnding(), 600);
  setTimeout(() => { if (this.state === 'play') this.saveWorld(true); }, 1500);
  return true;
};
Game.prototype.findPortalNear = function (cx, cz, r) {
  const w = this.world; let best = null, bd = Infinity;
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, z = cz + dz; if (!w.isLoadedAt(x, z)) continue;
    const c = w.getChunk(x >> 4, z >> 4), base = (x & 15) | ((z & 15) << 4);
    for (let y = 1; y < HEIGHT - 1; y++) if (c.ids[base | y << 8] === BL.nether_portal) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [x, y, z]; } break; }
  }
  if (!best) return null;
  let [x, y, z] = best;
  while (w.getBlock(x, y - 1, z) === BL.nether_portal) y--;
  const ax = w.getMeta(x, y, z) & 1;
  const sides = ax === 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
  const free = (sx, sz) => !BLOCKS[w.getBlock(sx, y, sz)].solid && !BLOCKS[w.getBlock(sx, y + 1, sz)].solid;
  for (const [ox, oz] of sides) if (free(x + ox, z + oz)) return { x: x + ox, y, z: z + oz };
  const [ox, oz] = sides[0];
  w.setBlock(x + ox, y, z + oz, 0, 0); w.setBlock(x + ox, y + 1, z + oz, 0, 0);
  if (!BLOCKS[w.getBlock(x + ox, y - 1, z + oz)].solid) w.setBlock(x + ox, y - 1, z + oz, BL.obsidian, 0);
  return { x: x + ox, y, z: z + oz };
};
// 도착한 곳에 지옥문이 없으면 새로 만든다 (가로 4 × 세로 5 흑요석 틀)
Game.prototype.buildPortalAt = function (cx, cz) {
  const w = this.world;
  let y0 = -1;
  if (w.dim === 'nether') {
    for (let k = 0; k < 60 && y0 < 0; k++) for (const y of [64 + k, 64 - k]) {
      if (y < 33 || y > 115) continue;
      const fb = w.getBlock(cx, y - 1, cz);
      if (fb && BLOCKS[fb].solid && !IS_FLUID[fb] && !w.getBlock(cx, y, cz) && !w.getBlock(cx, y + 1, cz) && !w.getBlock(cx, y + 2, cz)) { y0 = y - 1; break; }
    }
    if (y0 < 0) y0 = 64;
  } else {
    y0 = Math.max(SEA, w.surfaceY(cx, cz) - 1);
    if (y0 > 115) y0 = 80;
  }
  const x0 = cx - 1, z0 = cz;
  for (let dx = -1; dx <= 4; dx++) for (let dz = -1; dz <= 1; dz++) {
    const x = x0 + dx, z = z0 + dz;
    if (w.getBlock(x, y0, z) !== BL.bedrock) w.setBlock(x, y0, z, BL.obsidian, 0);
    for (let dy = 1; dy <= 5; dy++) if (w.getBlock(x, y0 + dy, z) !== BL.bedrock) w.setBlock(x, y0 + dy, z, 0, 0);
  }
  for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) {
    const edge = dx === 0 || dx === 3 || dy === 0 || dy === 4;
    if (edge) w.setBlock(x0 + dx, y0 + dy, z0, BL.obsidian, 0);
  }
  this._portalBuilding = true;
  for (let dx = 1; dx <= 2; dx++) for (let dy = 1; dy <= 3; dy++) w.setBlock(x0 + dx, y0 + dy, z0, BL.nether_portal, 0);
  this._portalBuilding = false;
  return { x: x0 + 1, y: y0 + 1, z: z0 + 1 };
};
// 흑요석 틀 안쪽을 지옥문으로 채움
Game.prototype.lightPortal = function (x, y, z) {
  const w = this.world;
  for (const ax of [0, 1]) {
    const cells = [], seen = new Set([x + ',' + y + ',' + z]), q = [[x, y, z]];
    let ok = true;
    const nb = ax === 0 ? [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]] : [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
    const s0 = w.getBlock(x, y, z); if (s0 && s0 !== BL.fire) return false;
    while (q.length && ok) {
      const c = q.shift(); cells.push(c);
      if (cells.length > 21 * 21) { ok = false; break; }
      for (const [dx, dy, dz] of nb) {
        const nx = c[0] + dx, ny = c[1] + dy, nz = c[2] + dz, k = nx + ',' + ny + ',' + nz;
        if (seen.has(k)) continue; seen.add(k);
        const id = w.getBlock(nx, ny, nz);
        if (id === BL.obsidian) continue;
        if (id === 0 || id === BL.fire) q.push([nx, ny, nz]); else { ok = false; break; }
      }
    }
    if (!ok) continue;
    let minA = Infinity, maxA = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of cells) { const a = ax === 0 ? c[0] : c[2]; minA = Math.min(minA, a); maxA = Math.max(maxA, a); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); }
    const wd = maxA - minA + 1, ht = maxY - minY + 1;
    if (wd < 2 || ht < 3 || wd > 21 || ht > 21 || cells.length !== wd * ht) continue;
    this._portalBuilding = true;
    for (const c of cells) this.setBlockNet(c[0], c[1], c[2], BL.nether_portal, ax);
    this._portalBuilding = false;
    return true;
  }
  return false;
};
// 틀이 부서지면 지옥문도 사라짐
Game.prototype.checkPortalAt = function (x, y, z) {
  const w = this.world;
  if (w.getBlock(x, y, z) !== BL.nether_portal) return;
  const ax = w.getMeta(x, y, z) & 1;
  const nb = ax === 0 ? [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]] : [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
  const cells = [], seen = new Set([x + ',' + y + ',' + z]), q = [[x, y, z]];
  let broken = false;
  while (q.length && cells.length < 500) {
    const c = q.shift(); cells.push(c);
    for (const [dx, dy, dz] of nb) {
      const nx = c[0] + dx, ny = c[1] + dy, nz = c[2] + dz, k = nx + ',' + ny + ',' + nz;
      if (seen.has(k)) continue; seen.add(k);
      const id = w.getBlock(nx, ny, nz);
      if (id === BL.nether_portal) q.push([nx, ny, nz]); else if (id !== BL.obsidian) broken = true;
    }
  }
  if (!broken) return;
  this._portalBuilding = true;
  for (const c of cells) w.setBlock(c[0], c[1], c[2], 0, 0);
  this._portalBuilding = false;
  this.sound.play('fizz', x + 0.5, y + 0.5, z + 0.5);
};
Game.prototype.checkEndPortal = function (x, y, z) {
  const w = this.world;
  for (const [rx, rz] of END_RING) {
    const cx = x - rx, cz = z - rz;
    if (END_RING.every(([dx, dz]) => w.getBlock(cx + dx, y, cz + dz) === BL.end_portal_frame && (w.getMeta(cx + dx, y, cz + dz) & 4))) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.setBlockNet(cx + dx, y, cz + dz, BL.end_portal, 0);
      this.sfx('portal', cx + 0.5, y + 0.5, cz + 0.5); this.sound.play('levelup');
      this.ui.chatLine('🌌 엔드 차원문이 열렸어요! 들어가면 엔더 드래곤이 기다려요. 활·화살·블록·음식을 꼭 챙기세요!', '#d9b8ff');
      return true;
    }
  }
  return false;
};
// 엔드에 들어오면 드래곤과 수정을 불러냄
Game.prototype.onDimReady = function () {
  const w = this.world, D = this.dragon;
  if (w.dim !== 'end' || D.dead) return;
  if (this.ents.list.some(e => e.sub === 'ender_dragon' && !e.dead)) return;
  if (!D.crystals) D.crystals = END_PILLARS.map(() => true);
  END_PILLARS.forEach((P, i) => { if (D.crystals[i]) this.ents.add(new EndCrystal(i, P.x + 0.5, P.h + 2, P.z + 0.5)); });
  const top = endIslandTop(w, 0, 0);
  this.ents.add(new EnderDragon(0, top + 20, -36, D.hp || 0));
  this.sound.play('dragon_roar');
  this.ui.chatLine('🐉 엔더 드래곤이 나타났어요! 흑요석 기둥 위의 빛나는 수정이 드래곤을 치료해요. 활로 수정부터 부숴 보세요!', '#d9b8ff');
};
Game.prototype.dragonDefeated = function (d) {
  const w = this.world, D = this.dragon;
  D.dead = true; D.hp = 0;
  const top = endIslandTop(w, 0, 0);
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { const r = Math.hypot(dx, dz); if (r <= 2.5 && (dx || dz)) w.setBlock(dx, top + 1, dz, BL.end_portal, 0); }
  w.setBlock(0, top + 5, 0, BL.dragon_egg, 0);
  for (let i = 0; i < 6; i++) this.particles.smoke(d.x, d.y + 1.5, d.z, 20, [0.85, 0.4, 1], true);
  this.sound.play('victory'); this.sound.play('explode', d.x, d.y, d.z);
  for (const e of this.ents.list) if (e.sub === 'end_crystal') e.dead = true;
  this.ui.chatLine('🏆 엔더 드래곤을 물리쳤어요!! 가운데에 출구 차원문과 드래곤 알이 생겼어요. 차원문에 뛰어들면 집으로 돌아가요.', '#ffe27a');
  this.ui.toast('🏆 엔더 드래곤을 물리쳤어요!', 4000);
  this.saveWorld(true);
};
Game.prototype.showEnding = function () {
  const ui = this.ui;
  if (ui.modal) ui.closeModal(true);
  ui.beginModal('ending');
  const s = ui.screen('menu-ending', `<div class="panel narrow ending">
      <div class="end-stars">✦ ✧ ✦</div>
      <h2>🏆 엔더 드래곤을 물리쳤어요!</h2>
      <p>나무 한 그루에서 시작해 도구를 만들고, 지옥을 건너 엔드까지 다녀왔어요.<br>빌더봇과 함께 지은 세계는 이제 여러분의 것이에요.</p>
      <p class="muted">드래곤 알은 엔드 섬 가운데 기둥 위에 있어요. 다시 가서 가져올 수도 있어요!</p>
      <div class="col"><button class="btn primary" id="end-ok">계속 탐험하기</button></div></div>`);
  $('#end-ok', s).onclick = () => ui.closeModal();
  ui.show('menu-ending');
  this.dragon.ended = true;
};
// 매 프레임: 차원문, 보스 체력바
Game.prototype.dimTick = function (dt) {
  const p = this.player, w = this.world;
  const hud = this._dimHud || (this._dimHud = makeDimHud());
  if (p.dead) { hud.fx.style.opacity = 0; return; }
  let inN = false, inE = false;
  const x0 = Math.floor(p.x - 0.3), x1 = Math.floor(p.x + 0.3), z0 = Math.floor(p.z - 0.3), z1 = Math.floor(p.z + 0.3);
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = Math.floor(p.y + 0.05); y <= Math.floor(p.y + 1.7); y++) {
    const id = w.getBlock(x, y, z);
    if (id === BL.nether_portal) inN = true; else if (id === BL.end_portal) inE = true;
  }
  if (this.portalCD > 0 && !inN && !inE) this.portalCD -= dt;
  if (inE && this.portalCD <= 0) {
    this.portalCD = 3;
    if (w.dim === 'end') { const s = p.spawn; this.travelTo('overworld', s[0], s[1], s[2], { kind: 'home', ending: this.dragon.dead && !this.dragon.ended }, '집으로 돌아가는 중...'); }
    else this.travelTo('end', END_ARRIVE_X + 0.5, 70, 0.5, { kind: 'end' }, '엔드로 가는 중...');
    return;
  }
  if (inN && this.portalCD <= 0) {
    this.portalT += dt;
    if (this.portalT > 0.2 && !this._portalHum) { this._portalHum = true; this.sound.play('portal'); }
    if (this.portalT >= (p.creative ? 1 : 3)) {
      this.portalT = 0; this._portalHum = false;
      if (w.dim === 'nether') this.travelTo('overworld', Math.floor(p.x) * 8 + 0.5, 80, Math.floor(p.z) * 8 + 0.5, { kind: 'portal' }, '평소 세계로 돌아가는 중...');
      else if (w.dim === 'overworld') this.travelTo('nether', Math.floor(p.x / 8) + 0.5, 64, Math.floor(p.z / 8) + 0.5, { kind: 'portal' }, '🔥 지옥으로 가는 중...');
      return;
    }
  } else { this.portalT = Math.max(0, this.portalT - dt * 2); if (this.portalT === 0) this._portalHum = false; }
  hud.fx.style.opacity = Math.min(0.85, this.portalT / 3 * 0.9).toFixed(2);
  // 엔더 드래곤 체력바
  let boss = null;
  if (w.dim === 'end') for (const e of this.ents.list) if (e.sub === 'ender_dragon' && !e.dead) { boss = e; break; }
  if (boss) {
    const f = Math.max(0, boss.hp / MOB_TYPES.ender_dragon.hp), left = (this.dragon.crystals || []).filter(Boolean).length;
    const key = (f * 200 | 0) + ':' + left;
    if (hud.bossKey !== key) { hud.bossKey = key; hud.boss.classList.add('show'); hud.bossFill.style.width = (f * 100).toFixed(1) + '%'; hud.bossTxt.textContent = `엔더 드래곤 · 수정 ${left}개 남음`; }
  } else if (hud.bossKey) { hud.bossKey = null; hud.boss.classList.remove('show'); }
};
function makeDimHud() {
  const hud = document.getElementById('hud');
  const fx = document.createElement('div'); fx.id = 'portal-fx'; hud.appendChild(fx);
  const boss = document.createElement('div'); boss.id = 'bossbar'; boss.innerHTML = '<b></b><div class="bb"><i></i></div>'; hud.appendChild(boss);
  return { fx, boss, bossTxt: boss.firstChild, bossFill: boss.querySelector('i'), bossKey: null };
}
// 시작 보너스 상자 (서바이벌 새 세계)
Game.prototype.placeBonusChest = function () {
  const w = this.world, p = this.player;
  for (const [ox, oz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2]]) {
    const x = Math.floor(p.x) + ox, z = Math.floor(p.z) + oz, y = w.surfaceY(x, z);
    const below = w.getBlock(x, y - 1, z);
    if (!below || !BLOCKS[below].solid || IS_FLUID[below] || w.getBlock(x, y, z)) continue;
    const k = fmtKey(x, y, z);
    w.lootAt.set(k, 'bonus');
    w.setBlock(x, y, z, BL.chest, ox > 0 ? 4 : ox < 0 ? 5 : oz > 0 ? 2 : 3);
    this.ui.chatLine('🎁 바로 옆에 보너스 상자가 있어요! 열어 보세요 (오른쪽 클릭)', '#bfffc8');
    return;
  }
};

// ---------------- 게임: 기존 동작에 끼워 넣기 ----------------
{
  const G = Game.prototype;
  const _update = G.update;
  G.update = function (dt) { _update.call(this, dt); this.dimTick(dt); };
  const _cc = G.createContainer;
  G.createContainer = function (x, y, z, id) {
    _cc.call(this, x, y, z, id);
    const w = this.world, k = fmtKey(x, y, z), t = w.lootAt.get(k);
    if (t && id === BL.chest && !w.remote) { w.lootAt.delete(k); fillLoot(w.be.get(k), t, hashInt(x, y, z, w.seed)); }
  };
  const _obc = G.onBlockChange;
  G.onBlockChange = function (x, y, z, oid, om, id, meta, flags) {
    const w = this.world;
    if (oid === BL.chest && id !== BL.chest && w.lootAt.size) { const k = fmtKey(x, y, z); if (w.lootAt.has(k) && !w.be.get(k)) this.createContainer(x, y, z, BL.chest); }
    _obc.call(this, x, y, z, oid, om, id, meta, flags);
    if (w.remote || this._portalBuilding) return;
    if ((oid === BL.obsidian || oid === BL.nether_portal) && id !== oid) for (let d = 0; d < 6; d++) this.checkPortalAt(x + DX[d], y + DY[d], z + DZ[d]);
  };
  const _sup = G.supportOk;
  G.supportOk = function (x, y, z, id, meta) {
    if (id === BL.fire) { const s = this.world.getBlock(x, y - 1, z); return !this.world.isLoadedAt(x, z) || !!(s && BLOCKS[s].solid); }
    return _sup.call(this, x, y, z, id, meta);
  };
  const _ub = G.useBlock;
  G.useBlock = function (x, y, z, local, pid) {
    const w = this.world;
    if (w.getBlock(x, y, z) === BL.bed && w.dim !== 'overworld') { if (local) this.ui.toast('😵 이곳에서는 잠을 잘 수 없어요!'); return true; }
    return _ub.call(this, x, y, z, local, pid);
  };
  const _pu = G.playerUse;
  G.playerUse = function (hit, s, fresh) {
    const p = this.player, w = this.world, held = p.held, hd = held ? ITEMS[held.id] : null;
    if (fresh && hd) {
      const td = hit ? BLOCKS[hit.id] : null, usable = !!(hit && td && td.use && !p.sneaking);
      const dir = p.lookDir(), ex = p.x + dir[0] * 0.5, ey = p.eyeY() - 0.1, ez = p.z + dir[2] * 0.5;
      if (hd.name === 'eye_of_ender') {
        if (hit && hit.id === BL.end_portal_frame) {
          if (!(hit.meta & 4)) { this.setBlockNet(hit.x, hit.y, hit.z, BL.end_portal_frame, hit.meta | 4); p.consumeHeld(1); this.sound.play('pop', hit.x, hit.y, hit.z); this.swing = 1; if (!this.checkEndPortal(hit.x, hit.y, hit.z)) this.ui.toast('👁 엔더의 눈을 끼웠어요'); }
          return;
        }
        if (!usable) {
          if (w.dim !== 'overworld') { this.ui.toast('👁 엔더의 눈이 길을 잃었어요… 평소 세계에서 던져야 해요'); return; }
          if (w.type === 'flat') { this.ui.toast('평지 세계에는 엔드 요새가 없어요'); return; }
          const sh = strongholdPos(w.seed), dx = sh.x - p.x, dz = sh.z - p.z, dist = Math.hypot(dx, dz);
          if (!w.remote) this.ents.add(new EyeOfEnder(ex, ey, ez, sh.x + 0.5, sh.z + 0.5));
          p.consumeHeld(1); this.swing = 1; this.sound.play('teleport', p.x, p.y + 1, p.z);
          const names = ['동', '남동', '남', '남서', '서', '북서', '북', '북동'];
          const dn = names[((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
          this.ui.chatLine(dist < 12 ? '👁 엔더의 눈이 땅 아래를 가리켜요! 바로 아래에 요새가 있어요.' : `👁 엔더의 눈이 ${dn}쪽으로 날아갔어요! (약 ${Math.round(dist)}칸)`, '#c9f5d0');
          return;
        }
      }
      if (hd.name === 'ender_pearl' && !usable) {
        if (!w.remote) this.ents.add(new ThrownPearl(ex, ey, ez, dir[0] * 24, dir[1] * 24 + 2, dir[2] * 24));
        p.consumeHeld(1); this.swing = 1; this.sound.play('bow', p.x, p.y + 1, p.z);
        return;
      }
      if (hd.name === 'flint_and_steel' && hit && hit.id !== BL.tnt && !usable) {
        const tx = hit.x + DX[hit.face], ty = hit.y + DY[hit.face], tz = hit.z + DZ[hit.face];
        this.swing = 1; p.damageHeld(1);
        if (this.lightPortal(tx, ty, tz)) {
          this.sfx('portal', tx + 0.5, ty + 0.5, tz + 0.5);
          if (!this.dragon.portalTip) { this.dragon.portalTip = true; this.ui.chatLine('🔥 지옥문이 열렸어요! 보라색 문 안에 3초 동안 서 있으면 지옥으로 가요.', '#ffb37a'); }
          return;
        }
        if (!w.getBlock(tx, ty, tz) && BLOCKS[w.getBlock(tx, ty - 1, tz)].solid) {
          this.setBlockNet(tx, ty, tz, BL.fire, 0);
          if (!w.remote && w.getBlock(tx, ty - 1, tz) !== BL.netherrack) w.schedule(tx, ty, tz, 160 + Math.random() * 200, 3);
          this.sound.play('fizz', tx + 0.5, ty + 0.5, tz + 0.5);
        }
        return;
      }
      if (hd.fluid === BL.water && w.dim === 'nether' && hit) {
        if (!p.creative) p.inv[p.sel] = { id: I('bucket'), n: 1 };
        const t = [hit.x + DX[hit.face], hit.y + DY[hit.face], hit.z + DZ[hit.face]];
        this.particles.smoke(t[0] + 0.5, t[1] + 0.5, t[2] + 0.5, 14, [0.95, 0.95, 0.95]); this.sound.play('fizz', t[0], t[1], t[2]);
        this.ui.toast('💨 지옥은 너무 뜨거워서 물이 바로 증발했어요!'); this.ui.refreshHotbar();
        return;
      }
    }
    return _pu.call(this, hit, s, fresh);
  };
  const _respawn = G.respawn;
  G.respawn = function () {
    _respawn.call(this);
    if (this.world.dim !== 'overworld') { const s = this.player.spawn; this.travelTo('overworld', s[0], s[1], s[2], { kind: 'home' }, '다시 태어나는 중...'); }
  };
  const _spawn = G.spawnMobs;
  G.spawnMobs = function () {
    const w = this.world;
    if (w.dim === 'nether') return this.spawnNether();
    if (w.dim === 'end') return this.spawnEnd();
    _spawn.call(this);
    // 밤에 가끔 엔더맨 (엔더 진주를 구할 수 있게)
    if (!this.settings.peaceful && w.dayFactor() < 0.3 && Math.random() < 0.12 && this.ents.count(e => e.sub === 'enderman') < 3) {
      const p = this.player, a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 18;
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (w.isLoadedAt(x, z)) { const y = w.surfaceY(x, z), b = w.getBlock(x, y - 1, z); if (b && BLOCKS[b].solid && !IS_FLUID[b] && !w.getBlock(x, y, z) && !w.getBlock(x, y + 1, z) && !w.getBlock(x, y + 2, z)) this.ents.add(new Mob('enderman', x + 0.5, y, z + 0.5)); }
    }
  };
  G.spawnNether = function () {
    const w = this.world, peace = this.settings.peaceful;
    const cnt = (sub) => this.ents.count(e => e.sub === sub);
    for (const pl of this.allPlayers()) for (let a = 0; a < 8; a++) {
      const ang = Math.random() * Math.PI * 2, dist = 14 + Math.random() * 30;
      const x = Math.floor(pl.x + Math.cos(ang) * dist), z = Math.floor(pl.z + Math.sin(ang) * dist);
      if (!w.isLoadedAt(x, z)) continue;
      let y = clamp(Math.floor(pl.y) + (Math.random() * 30 | 0) - 15, 6, 118);
      for (let k = 0; k < 24 && y > 4; k++, y--) { const b = w.getBlock(x, y - 1, z); if (b && BLOCKS[b].solid && !w.getBlock(x, y, z) && !w.getBlock(x, y + 1, z)) break; }
      const below = w.getBlock(x, y - 1, z);
      if (!below || !BLOCKS[below].solid || IS_FLUID[below] || w.getBlock(x, y, z) || w.getBlock(x, y + 1, z)) continue;
      if (below === BL.nether_bricks) { if (!peace && cnt('blaze') < 6) { this.ents.add(new Mob('blaze', x + 0.5, y + 0.5, z + 0.5)); return; } continue; }
      if (!peace && Math.random() < 0.1 && cnt('ghast') < 2) {
        let open = true; for (let dy = 3; dy <= 8 && open; dy += 2) for (const [ox, oz] of [[0, 0], [2, 2], [-2, -2], [2, -2], [-2, 2]]) if (w.getBlock(x + ox, y + dy, z + oz)) { open = false; break; }
        if (open) { this.ents.add(new Mob('ghast', x + 0.5, y + 4, z + 0.5)); return; }
      }
      if (cnt('zombie_piglin') < 10) { const n = 1 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) this.ents.add(new Mob('zombie_piglin', x + 0.5 + (Math.random() - 0.5), y, z + 0.5 + (Math.random() - 0.5))); }
      return;
    }
  };
  G.spawnEnd = function () {
    const w = this.world;
    if (this.ents.count(e => e.sub === 'enderman') >= 8) return;
    const p = this.player;
    for (let a = 0; a < 6; a++) {
      const ang = Math.random() * Math.PI * 2, d = 12 + Math.random() * 30;
      const x = Math.floor(p.x + Math.cos(ang) * d), z = Math.floor(p.z + Math.sin(ang) * d);
      if (!w.isLoadedAt(x, z)) continue;
      const y = w.surfaceY(x, z);
      if (w.getBlock(x, y - 1, z) !== BL.end_stone || w.getBlock(x, y, z) || w.getBlock(x, y + 1, z) || w.getBlock(x, y + 2, z)) continue;
      this.ents.add(new Mob('enderman', x + 0.5, y, z + 0.5)); return;
    }
  };
  const _dmg = G.damageEntity;
  G.damageEntity = function (e, dmg, kx, kz, src) {
    const D0 = e && e.type === 'mob' ? MOB_TYPES[e.sub] : null;
    if (D0 && D0.fireImmune && (src === 'fire' || src === 'lava')) return;
    const byPlayer = src === 'player' || src === 'arrow' || (src && src.startsWith && src.startsWith('client'));
    if (D0 && D0.neutral && byPlayer && !e.remote) {
      e.angry = 25;
      if (e.sub === 'zombie_piglin') for (const o of this.ents.list) if (o.sub === 'zombie_piglin' && !o.dead && (o.x - e.x) ** 2 + (o.z - e.z) ** 2 < 400) o.angry = 25;
    }
    _dmg.call(this, e, dmg, kx, kz, src);
    if (D0 && D0.neutral && e.angry > 0) e.panic = 0;
    if (D0 && D0.ender && !e.dead && byPlayer && Math.random() < 0.4) enderTeleport(e, this, null);
  };
  const _cmd = G.command;
  G.command = function (line) {
    const a = line.trim().slice(1).split(/\s+/), cmd = (a[0] || '').toLowerCase(), say = (t, c) => this.ui.chatLine(t, c || '#aee');
    if (cmd === 'dimension' || cmd === '차원') {
      const d = { nether: 'nether', '지옥': 'nether', end: 'end', '엔드': 'end', overworld: 'overworld', '평소': 'overworld' }[(a[1] || '').toLowerCase()];
      if (!d) { say('사용법: /dimension nether | end | overworld', '#f88'); return; }
      if (d === this.world.dim) { say('이미 ' + DIM_NAMES[d] + '에 있어요'); return; }
      const p = this.player;
      if (d === 'end') this.travelTo('end', END_ARRIVE_X + 0.5, 70, 0.5, { kind: 'end' });
      else if (d === 'nether') this.travelTo('nether', Math.floor(p.x / 8) + 0.5, 64, Math.floor(p.z / 8) + 0.5, { kind: 'portal' });
      else this.travelTo('overworld', p.spawn[0], p.spawn[1], p.spawn[2], { kind: 'home' });
      return;
    }
    if (cmd === 'locate' || cmd === '요새') { const sh = strongholdPos(this.world.seed); say(`🏰 엔드 요새(차원문 방): X ${sh.x} · Y ${sh.y} · Z ${sh.z}`); return; }
    if (cmd === 'help' || cmd === '도움말') { _cmd.call(this, line); say('에듀 크래프트: /dimension nether|end|overworld (차원 이동), /locate (엔드 요새 위치), /summon blaze|ghast|enderman|zombie_piglin'); return; }
    return _cmd.call(this, line);
  };
}
// 지옥에서는 미니맵이 내 높이 근처의 바닥을 그림 (천장 대신)
{
  const _redraw = Minimap.prototype.redraw;
  Minimap.prototype.redraw = function () {
    const g = this.g, w = g.world, p = g.player;
    if (!w || w.dim !== 'nether') return _redraw.call(this);
    const R = this.big ? 64 : 32, N = 64, sc = (R * 2) / N, d = this.img.data, py = Math.floor(p.y) + 1;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = Math.floor(p.x) + Math.floor((i - N / 2) * sc), z = Math.floor(p.z) + Math.floor((j - N / 2) * sc), o = (j * N + i) * 4;
      let c = [40, 14, 16];
      if (w.isLoadedAt(x, z)) { for (let y = py; y > py - 24 && y > 0; y--) { const id = w.getBlock(x, y, z); if (id && (BLOCKS[id].solid || IS_FLUID[id])) { c = minimapColor(id); if (y < py - 6) c = c.map(v => v * 0.7); break; } } }
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
  };
}
