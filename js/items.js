'use strict';
// =====================================================================
// 아이템, 조합법, 화로, 아이콘
// =====================================================================
const ITEMS = [];
const IT = Object.create(null); // 이름 → id
const MATS = [
  { n: 'wood', k: '나무', tier: 1, speed: 2, dur: 60, dmg: 4 }, { n: 'stone', k: '돌', tier: 2, speed: 4, dur: 132, dmg: 5 },
  { n: 'iron', k: '철', tier: 3, speed: 6, dur: 251, dmg: 6 }, { n: 'gold', k: '금', tier: 1, speed: 12, dur: 33, dmg: 4 },
  { n: 'diamond', k: '다이아몬드', tier: 4, speed: 8, dur: 1562, dmg: 7 },
];
const TOOL_KINDS = [['pickaxe', '곡괭이', 'pick'], ['axe', '도끼', 'axe'], ['shovel', '삽', 'shovel'], ['sword', '검', 'sword'], ['hoe', '괭이', 'hoe']];

function defItem(id, name, k, props) {
  const d = Object.assign({ id, name, k, stack: 64, tex: name, cat: 'items' }, props || {});
  ITEMS[id] = d; IT[name] = id; return d;
}
function I(name) {
  // 아이템을 먼저 (밀 작물 블록과 밀 아이템처럼 이름이 같을 때 아이템)
  if (IT[name] !== undefined) return IT[name];
  if (BL[name] !== undefined) return BL[name];
  throw new Error('아이템 없음: ' + name);
}
function itemMaxStack(id) { const d = ITEMS[id]; return d ? d.stack : 64; }
function itemName(id) { const d = ITEMS[id]; return d ? d.k : '?'; }

function defineItems() {
  // 블록 아이템
  for (const b of BLOCKS) {
    if (!b || !b.item || b.id === 0) continue;
    ITEMS[b.id] = { id: b.id, name: b.name, k: b.k, stack: b.stack || 64, block: true, places: b.id, icon: b.icon, cat: b.cat, desc: b.desc };
    IT[b.name] = b.id;
  }
  const it = defItem;
  it(256, 'stick', '막대기'); it(257, 'coal', '석탄'); it(258, 'charcoal', '숯');
  it(259, 'iron_ingot', '철 주괴'); it(260, 'gold_ingot', '금 주괴'); it(261, 'diamond', '다이아몬드');
  it(262, 'redstone', '레드스톤 가루', { places: BL.redstone_wire, cat: 'redstone', desc: '땅에 뿌리면 전선이 됩니다. 신호는 한 칸마다 1씩 약해져 15칸까지 갑니다.' });
  it(263, 'apple', '사과', { food: 4, sat: 2.4, cat: 'food' }); it(264, 'bread', '빵', { food: 5, sat: 6, cat: 'food' });
  it(265, 'wheat', '밀'); it(266, 'seeds', '씨앗', { places: BL.wheat, cat: 'nature' });
  it(267, 'porkchop', '생 돼지고기', { food: 3, sat: 1.8, cat: 'food' }); it(268, 'cooked_porkchop', '익힌 돼지고기', { food: 8, sat: 12.8, cat: 'food' });
  it(269, 'beef', '생 소고기', { food: 3, sat: 1.8, cat: 'food' }); it(270, 'steak', '스테이크', { food: 8, sat: 12.8, cat: 'food' });
  it(271, 'chicken', '생 닭고기', { food: 2, sat: 1.2, cat: 'food' }); it(272, 'cooked_chicken', '익힌 닭고기', { food: 6, sat: 7.2, cat: 'food' });
  it(273, 'rotten_flesh', '썩은 살점', { food: 4, sat: 0.8, cat: 'food' });
  it(274, 'gunpowder', '화약'); it(275, 'bone', '뼈'); it(276, 'string', '실'); it(277, 'feather', '깃털');
  it(278, 'arrow', '화살', { cat: 'tools' }); it(279, 'bow', '활', { stack: 1, dur: 385, cat: 'tools', bow: true });
  it(280, 'bucket', '양동이', { stack: 16, cat: 'tools' }); it(281, 'water_bucket', '물 양동이', { stack: 1, cat: 'tools', fluid: BL.water });
  it(282, 'lava_bucket', '용암 양동이', { stack: 1, cat: 'tools', fluid: BL.lava });
  it(283, 'flint_and_steel', '부싯돌과 부시', { stack: 1, dur: 65, cat: 'tools', desc: 'TNT에 사용하면 불을 붙입니다.' });
  it(284, 'slime_ball', '슬라임 볼'); it(285, 'minecart', '광산 수레', { stack: 1, cat: 'redstone', desc: '레일 위에 놓고 우클릭으로 탑니다.' });
  it(286, 'snowball', '눈덩이', { stack: 16 }); it(287, 'brick', '벽돌'); it(288, 'clay_ball', '점토 덩이');
  it(289, 'sugar', '설탕'); it(290, 'paper', '종이'); it(291, 'book', '책'); it(292, 'egg', '달걀', { stack: 16 });
  ITEMS[BL.oak_door].icon = 'door_oak_item'; ITEMS[BL.iron_door].icon = 'door_iron_item';
  for (let mi = 0; mi < MATS.length; mi++) for (let ki = 0; ki < TOOL_KINDS.length; ki++) {
    const m = MATS[mi], k = TOOL_KINDS[ki];
    it(300 + mi * 5 + ki, m.n + '_' + k[0], m.k + ' ' + k[1], {
      stack: 1, dur: m.dur, cat: 'tools',
      tool: { kind: k[2], tier: m.tier, speed: m.speed }, dmg: k[2] === 'sword' ? m.dmg : k[2] === 'axe' ? m.dmg - 1 : Math.max(2, m.dmg - 3),
    });
  }
  it(330, 'builder_remote', '빌더봇 리모컨', { stack: 1, cat: 'tools', desc: '우클릭하면 블록 코딩 창을 엽니다. 빌더봇이 코드대로 건물을 지어요!' });
  it(331, 'wrench', '렌치', { stack: 1, cat: 'redstone', desc: '회로 블록을 우클릭하면 방향을 돌립니다.' });
  it(332, 'multimeter', '멀티미터', { stack: 1, cat: 'redstone', desc: '들고 있으면 바라보는 블록의 전력 세기를 보여줍니다.' });
  defineSurvivalItems();
  if (typeof defineDimItems === 'function') defineDimItems();
  if (typeof defineVanillaItems === 'function') defineVanillaItems();
  for (const d of ITEMS) if (d && d.tex && !d.block && TEX.byName[d.tex] === undefined) d.tex = 'stick';
}

// ---------------- 조합법 ----------------
const GROUPS = {};
const RECIPES = [];
function R(pattern, key, result, count) { RECIPES.push({ shaped: true, pattern, key, result, count: count || 1 }); }
function S(list, result, count) { RECIPES.push({ shaped: false, list, result, count: count || 1 }); }
function defineRecipes() {
  GROUPS.planks = [BL.oak_planks, BL.birch_planks, BL.spruce_planks];
  GROUPS.log = [BL.oak_log, BL.birch_log, BL.spruce_log];
  GROUPS.coal = [I('coal'), I('charcoal')];
  GROUPS.leaves = [BL.oak_leaves, BL.birch_leaves, BL.spruce_leaves];
  GROUPS.stone = [BL.stone, BL.cobblestone];
  GROUPS.wool = DYES.map(d => BL['wool_' + d[0]]);
  S(['oak_log'], 'oak_planks', 4); S(['birch_log'], 'birch_planks', 4); S(['spruce_log'], 'spruce_planks', 4);
  R(['P', 'P'], { P: '#planks' }, 'stick', 4);
  R(['PP', 'PP'], { P: '#planks' }, 'crafting_table');
  R(['PPP', 'P P', 'PPP'], { P: '#planks' }, 'chest');
  R(['CCC', 'C C', 'CCC'], { C: 'cobblestone' }, 'furnace');
  R(['C', 'S'], { C: '#coal', S: 'stick' }, 'torch', 4);
  R(['S S', 'SSS', 'S S'], { S: 'stick' }, 'ladder', 3);
  R(['PSP', 'PSP'], { P: '#planks', S: 'stick' }, 'oak_fence', 3);
  R(['PP', 'PP', 'PP'], { P: '#planks' }, 'oak_door', 3);
  R(['II', 'II', 'II'], { I: 'iron_ingot' }, 'iron_door', 3);
  R(['PPP', 'PPP'], { P: '#planks' }, 'oak_trapdoor', 2);
  R(['II', 'II'], { I: 'iron_ingot' }, 'iron_trapdoor');
  R(['PPP'], { P: '#planks' }, 'oak_slab', 6);
  R(['SSS'], { S: 'smooth_stone' }, 'stone_slab', 6);
  R(['SSS'], { S: 'sandstone' }, 'sandstone_slab', 6);
  R(['P  ', 'PP ', 'PPP'], { P: '#planks' }, 'oak_stairs', 4);
  R(['P  ', 'PP ', 'PPP'], { P: 'cobblestone' }, 'cobblestone_stairs', 4);
  R(['P  ', 'PP ', 'PPP'], { P: 'stone_bricks' }, 'stone_brick_stairs', 4);
  R(['P  ', 'PP ', 'PPP'], { P: 'bricks' }, 'brick_stairs', 4);
  R(['PPP', 'BBB', 'PPP'], { P: '#planks', B: 'book' }, 'bookshelf');
  R(['SS', 'SS'], { S: 'stone' }, 'stone_bricks', 4);
  R(['SS', 'SS'], { S: 'sand' }, 'sandstone');
  R(['BB', 'BB'], { B: 'brick' }, 'bricks');
  R(['CC', 'CC'], { C: 'clay_ball' }, 'clay');
  R(['SS', 'SS'], { S: 'snowball' }, 'snow_block');
  R(['SSS'], { S: 'sugar_cane' }, 'paper', 3);
  S(['sugar_cane'], 'sugar'); S(['paper', 'paper', 'paper'], 'book');
  R(['WWW'], { W: 'wheat' }, 'bread');
  R(['I I', ' I '], { I: 'iron_ingot' }, 'bucket');
  S(['iron_ingot', 'gravel'], 'flint_and_steel');
  R([' SX', 'S X', ' SX'], { S: 'stick', X: 'string' }, 'bow');
  R(['G', 'S', 'F'], { G: 'gravel', S: 'stick', F: 'feather' }, 'arrow', 4);
  R(['I I', 'III'], { I: 'iron_ingot' }, 'minecart');
  const tools = [['#planks', 0], ['cobblestone', 1], ['iron_ingot', 2], ['gold_ingot', 3], ['diamond', 4]];
  for (const [mat, mi] of tools) {
    const n = MATS[mi].n;
    R(['MMM', ' S ', ' S '], { M: mat, S: 'stick' }, n + '_pickaxe');
    R(['MM', 'MS', ' S'], { M: mat, S: 'stick' }, n + '_axe');
    R(['M', 'S', 'S'], { M: mat, S: 'stick' }, n + '_shovel');
    R(['M', 'M', 'S'], { M: mat, S: 'stick' }, n + '_sword');
    R(['MM', ' S', ' S'], { M: mat, S: 'stick' }, n + '_hoe');
  }
  for (const [ing, blk] of [['iron_ingot', 'iron_block'], ['gold_ingot', 'gold_block'], ['diamond', 'diamond_block'], ['coal', 'coal_block'], ['redstone', 'redstone_block'], ['slime_ball', 'slime_block']]) {
    R(['XXX', 'XXX', 'XXX'], { X: ing }, blk); S([blk], ing, 9);
  }
  // 전기 회로
  R(['R', 'S'], { R: 'redstone', S: 'stick' }, 'redstone_torch');
  R(['S', 'C'], { S: 'stick', C: 'cobblestone' }, 'lever');
  S(['stone'], 'stone_button'); S(['#planks'], 'oak_button');
  R(['SS'], { S: 'stone' }, 'stone_pressure_plate'); R(['PP'], { P: '#planks' }, 'oak_pressure_plate');
  R(['TRT', 'SSS'], { T: 'redstone_torch', R: 'redstone', S: 'stone' }, 'repeater');
  R([' T ', 'TIT', 'SSS'], { T: 'redstone_torch', I: 'iron_ingot', S: 'stone' }, 'comparator');
  R([' R ', 'RTR', ' R '], { R: 'redstone', T: 'torch' }, 'redstone_lamp');
  R(['PPP', 'CIC', 'CRC'], { P: '#planks', C: 'cobblestone', I: 'iron_ingot', R: 'redstone' }, 'piston');
  R(['S', 'P'], { S: 'slime_ball', P: 'piston' }, 'sticky_piston');
  S(['seeds', 'seeds', '#leaves'], 'slime_ball');
  R(['PPP', 'PRP', 'PPP'], { P: '#planks', R: 'redstone' }, 'note_block');
  R(['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' }, 'tnt');
  R(['CCC', 'RRI', 'CCC'], { C: 'cobblestone', R: 'redstone', I: 'iron_ingot' }, 'observer');
  R(['GGG', 'III', 'SSS'], { G: 'glass', I: 'iron_ingot', S: 'oak_slab' }, 'daylight_sensor');
  R(['CCC', 'CBC', 'CRC'], { C: 'cobblestone', B: 'bow', R: 'redstone' }, 'dispenser');
  R(['CCC', 'C C', 'CRC'], { C: 'cobblestone', R: 'redstone' }, 'dropper');
  R(['I I', 'ISI', 'I I'], { I: 'iron_ingot', S: 'stick' }, 'rail', 16);
  R(['G G', 'GSG', 'GRG'], { G: 'gold_ingot', S: 'stick', R: 'redstone' }, 'powered_rail', 6);
  R(['I I', 'IPI', 'IRI'], { I: 'iron_ingot', P: 'stone_pressure_plate', R: 'redstone' }, 'detector_rail', 6);
  S(['stone', 'redstone_torch'], 'gate_not'); S(['stone', 'redstone_torch', 'redstone_torch'], 'gate_and');
  S(['stone', 'redstone', 'redstone'], 'gate_or'); S(['stone', 'redstone_torch', 'redstone'], 'gate_xor');
  S(['glass', 'redstone', 'stone'], 'number_display'); S(['redstone_lamp', 'glass'], 'color_lamp');
  S(['stone', 'redstone_torch', 'repeater'], 'clock_block'); S(['observer', 'glass'], 'player_sensor');
  R([' I ', 'IRI', ' I '], { I: 'iron_ingot', R: 'redstone' }, 'fan');
  R(['III', 'IPI', 'III'], { I: 'iron_ingot', P: 'piston' }, 'elevator');
  R([' R ', 'RWR', ' R '], { R: 'redstone', W: 'wool_white' }, 'target');
  S(['note_block', 'iron_ingot'], 'speaker');
  R(['WWW', 'PPP'], { W: '#wool', P: '#planks' }, 'bed');
  R(['I I', 'ICI', ' I '], { I: 'iron_ingot', C: 'chest' }, 'hopper');
  R(['RRR', 'III'], { R: 'redstone', I: 'iron_ingot' }, 'conveyor', 6);
  S(['iron_ingot', 'stick', 'redstone'], 'wrench');
  S(['iron_ingot', 'redstone', 'glass'], 'multimeter');
  S(['redstone', 'iron_ingot', 'stick', 'glass'], 'builder_remote');
  defineSurvivalRecipes();
  if (typeof defineDimRecipes === 'function') defineDimRecipes();
  if (typeof defineVanillaRecipes === 'function') defineVanillaRecipes();
  // 이름 → id 변환
  const res = (k) => k.startsWith('#') ? GROUPS[k.slice(1)] : [I(k)];
  for (const r of RECIPES) {
    r.resultId = I(r.result);
    if (r.shaped) { r.keyIds = {}; for (const c in r.key) r.keyIds[c] = res(r.key[c]); r.h = r.pattern.length; r.w = Math.max(...r.pattern.map(p => p.length)); }
    else r.listIds = r.list.map(res);
  }
}
// grid: 길이 w*w 배열 (아이템 {id,n} 또는 null)
function matchRecipe(grid, gw) {
  let x0 = gw, y0 = gw, x1 = -1, y1 = -1, cnt = 0;
  for (let y = 0; y < gw; y++) for (let x = 0; x < gw; x++) if (grid[y * gw + x]) { cnt++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (!cnt) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (const r of RECIPES) {
    if (r.shaped) {
      if (r.w !== w || r.h !== h) continue;
      for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < h && ok; y++) for (let x = 0; x < w; x++) {
          const px = mirror ? w - 1 - x : x;
          const ch = (r.pattern[y][px] || ' ');
          const cell = grid[(y0 + y) * gw + x0 + x];
          if (ch === ' ') { if (cell) { ok = false; break; } }
          else if (!cell || !r.keyIds[ch].includes(cell.id)) { ok = false; break; }
        }
        if (ok) return r;
      }
    } else {
      if (r.listIds.length !== cnt) continue;
      const used = new Array(r.listIds.length).fill(false);
      let ok = true;
      for (const cell of grid) {
        if (!cell) continue;
        let f = false;
        for (let i = 0; i < r.listIds.length; i++) if (!used[i] && r.listIds[i].includes(cell.id)) { used[i] = true; f = true; break; }
        if (!f) { ok = false; break; }
      }
      if (ok) return r;
    }
  }
  return null;
}
// 레시피에 필요한 재료 목록 (그룹은 첫 번째로 표시) → [[ids[], count]]
function recipeNeeds(r) {
  const m = new Map();
  const add = (ids) => { const k = ids.join(','); const e = m.get(k); if (e) e[1]++; else m.set(k, [ids, 1]); };
  if (r.shaped) { for (const row of r.pattern) for (const ch of row) if (ch !== ' ') add(r.keyIds[ch]); }
  else for (const ids of r.listIds) add(ids);
  return Array.from(m.values());
}

const SMELT = {}; const FUEL = {};
function defineSmelting() {
  const s = (a, b) => { SMELT[I(a)] = I(b); };
  s('sand', 'glass'); s('cobblestone', 'stone'); s('stone', 'smooth_stone'); s('iron_ore', 'iron_ingot'); s('gold_ore', 'gold_ingot');
  s('porkchop', 'cooked_porkchop'); s('beef', 'steak'); s('chicken', 'cooked_chicken'); s('clay_ball', 'brick'); s('clay', 'bricks');
  s('oak_log', 'charcoal'); s('birch_log', 'charcoal'); s('spruce_log', 'charcoal');
  s('diamond_ore', 'diamond'); s('coal_ore', 'coal'); s('redstone_ore', 'redstone');
  const f = (a, t) => { FUEL[I(a)] = t; };
  f('coal', 1600); f('charcoal', 1600); f('coal_block', 16000); f('lava_bucket', 20000); f('stick', 100); f('sapling', 100);
  for (const p of ['oak_planks', 'birch_planks', 'spruce_planks', 'oak_log', 'birch_log', 'spruce_log', 'crafting_table', 'chest', 'bookshelf', 'oak_fence', 'oak_slab', 'oak_stairs', 'ladder']) f(p, 300);
  for (const t of ['wood_pickaxe', 'wood_axe', 'wood_shovel', 'wood_sword', 'wood_hoe']) f(t, 200);
  defineSurvivalSmelting();
  if (typeof defineDimSmelting === 'function') defineDimSmelting();
  if (typeof defineVanillaSmelting === 'function') defineVanillaSmelting();
}

// ---------------- 아이콘 시트 ----------------
const ICON = { size: 32, cols: 24, url: null, idx: [] };
function texCanvas(layer, dark) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  const d = new Uint8ClampedArray(TEX.list[layer]);
  if (dark !== undefined && dark !== 1) for (let i = 0; i < d.length; i += 4) { d[i] *= dark; d[i + 1] *= dark; d[i + 2] *= dark; }
  g.putImageData(new ImageData(d, 16, 16), 0, 0);
  return c;
}
function buildIcons() {
  const ids = []; for (let i = 0; i < ITEMS.length; i++) if (ITEMS[i]) ids.push(i);
  const S = ICON.size, cols = ICON.cols, rows = Math.ceil(ids.length / cols);
  const cv = document.createElement('canvas'); cv.width = cols * S; cv.height = rows * S;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const ISO_SHAPES = new Set(['cube', 'slab', 'stairs', 'chest', 'cactus', 'farmland', 'piston', 'daylight', 'fence', 'bed', 'conveyor', 'hopper']);
  ids.forEach((id, n) => {
    const ox = (n % cols) * S, oy = Math.floor(n / cols) * S;
    ICON.idx[id] = n;
    const d = ITEMS[id];
    const b = d.block ? BLOCKS[id] : null;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (b && !d.icon && ISO_SHAPES.has(b.shape)) {
      let meta = 0;
      if (b.facingH) meta = 3; else if (b.facing6) meta = 3;
      if (id === BL.piston || id === BL.sticky_piston) meta = 1;
      const top = blockTex(b, meta, 1), left = blockTex(b, meta, 3), right = blockTex(b, meta, 5);
      const tint = b.tint === 'leaves' ? [0.9, 1, 0.85] : b.tint === 'colorlamp' ? [1, 0.85, 0.5] : null;
      const tc = texCanvas(top, 1), lc = texCanvas(left, 0.62), rc = texCanvas(right, 0.8);
      const h = b.shape === 'slab' ? 0.5 : b.shape === 'daylight' || b.shape === 'conveyor' ? 0.4 : b.shape === 'bed' ? 0.56 : 1;
      const k = S / 32;
      // 위
      g.setTransform(14 / 16 * k, -7 / 16 * k, 14 / 16 * k, 7 / 16 * k, ox + 2 * k, oy + (8 + 16 * (1 - h)) * k); g.drawImage(tc, 0, 0);
      // 왼쪽(남)
      g.setTransform(14 / 16 * k, 7 / 16 * k, 0, 16 / 16 * k * h, ox + 2 * k, oy + (8 + 16 * (1 - h)) * k); g.drawImage(lc, 0, 16 * (1 - h), 16, 16 * h, 0, 0, 16, 16);
      // 오른쪽(동)
      g.setTransform(14 / 16 * k, -7 / 16 * k, 0, 16 / 16 * k * h, ox + 16 * k, oy + (15 + 16 * (1 - h)) * k); g.drawImage(rc, 0, 16 * (1 - h), 16, 16 * h, 0, 0, 16, 16);
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (tint) {
        // 틴트는 임시 캔버스에서 (destination-in 은 캔버스 전체에 영향을 주므로)
        const tmp = document.createElement('canvas'); tmp.width = tmp.height = S;
        const tg = tmp.getContext('2d');
        tg.drawImage(cv, ox, oy, S, S, 0, 0, S, S);
        tg.globalCompositeOperation = 'multiply'; tg.fillStyle = `rgb(${tint[0] * 255},${tint[1] * 255},${tint[2] * 255})`; tg.fillRect(0, 0, S, S);
        tg.globalCompositeOperation = 'destination-in'; tg.drawImage(cv, ox, oy, S, S, 0, 0, S, S);
        g.clearRect(ox, oy, S, S); g.drawImage(tmp, ox, oy);
      }
    } else {
      let layer;
      if (d.icon) layer = T(d.icon);
      else if (b) layer = blockTex(b, 0, 2);
      else layer = T(d.tex);
      const tc = texCanvas(layer, 1);
      g.drawImage(tc, 0, 0, 16, 16, ox + 2, oy + 2, S - 4, S - 4);
    }
  });
  // 색 틴트가 필요한 평면 아이콘 (잔디)
  ICON.url = cv.toDataURL();
  ICON.w = cv.width; ICON.h = cv.height;
  ICON.canvas = cv;
}
function iconStyle(id, px) {
  const n = ICON.idx[id]; if (n === undefined) return '';
  const s = px / ICON.size;
  const x = (n % ICON.cols) * ICON.size * s, y = Math.floor(n / ICON.cols) * ICON.size * s;
  return `background-image:url(${ICON.url});background-size:${ICON.w * s}px ${ICON.h * s}px;background-position:-${x}px -${y}px;`;
}
// DOM 요소에 아이콘 지정 (스프라이트 시트는 :root 의 --icon-sheet 로 한 번만 등록)
function applyIcon(el, id) {
  const n = id ? ICON.idx[id] : undefined;
  if (n === undefined) { el.classList.remove('ic'); return; }
  el.classList.add('ic');
  const cols = ICON.cols, rows = Math.max(2, Math.ceil(ICON.h / ICON.size));
  el.style.backgroundPosition = `${(n % cols) / (cols - 1) * 100}% ${Math.floor(n / cols) / (rows - 1) * 100}%`;
}
function installIconSheet() {
  const rows = Math.ceil(ICON.h / ICON.size);
  const st = document.createElement('style');
  st.textContent = `.ic{background-image:url(${ICON.url});background-size:${ICON.cols * 100}% ${Math.max(2, rows) * 100}%;background-repeat:no-repeat;image-rendering:pixelated;}`;
  document.head.appendChild(st);
}
