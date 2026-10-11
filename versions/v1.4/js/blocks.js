'use strict';
// =====================================================================
// 블록 정의
//  - id 0~255 : 블록 (아이템으로도 쓰임)
//  - meta(0~255) 사용법은 각 블록 주석 참고
// =====================================================================
const BLOCKS = new Array(256).fill(null);
const BL = Object.create(null);   // 이름 → id

const BLOCK_DEFAULTS = {
  shape: 'cube', solid: true, opaque: true, layer: 0, emit: 0, hard: 1, tool: null, lvl: 0,
  sound: 'stone', cat: 'build', replace: false, tint: null, rs: null, push: 'normal', item: true,
  icon: null, gravity: false, wave: 0, fluid: false, climb: false, stack: 64, emissive: false,
};

function defBlock(id, name, k, props) {
  const d = Object.assign({ id, name, k }, BLOCK_DEFAULTS, props || {});
  if (d.opacity === undefined) d.opacity = d.opaque ? 15 : 0;
  if (d.conductor === undefined) d.conductor = d.opaque && d.shape === 'cube';
  if (d.drop === undefined) d.drop = id;
  BLOCKS[id] = d; BL[name] = id;
  return d;
}

// 텍스처 이름 → [아래, 위, 북, 남, 서, 동] 레이어 배열
function faces(spec) {
  if (typeof spec === 'string') { const t = T(spec); return [t, t, t, t, t, t]; }
  const s = spec.side ? T(spec.side) : 0;
  const top = T(spec.top || spec.side), bot = T(spec.bottom || spec.top || spec.side);
  return [bot, top, spec.north ? T(spec.north) : s, spec.south ? T(spec.south) : s, spec.west ? T(spec.west) : s, spec.east ? T(spec.east) : s];
}
const FACE_ROT_CACHE = {};
// 앞면(front)이 facing 방향을 향하도록 [아래,위,북,남,서,동] 배열을 구성
function orientFaces(facing, front, back, side, top, bottom) {
  const f = [bottom, top, side, side, side, side];
  if (facing === 0 || facing === 1) { f[0] = side; f[1] = side; f[2] = side; f[3] = side; f[4] = side; f[5] = side; f[facing] = front; f[OPP[facing]] = back; }
  else { f[facing] = front; f[OPP[facing]] = back; }
  return f;
}

function defineBlocks() {
  const b = defBlock;
  b(0, 'air', '공기', { shape: 'none', solid: false, opaque: false, replace: true, item: false });
  b(1, 'stone', '돌', { tex: faces('stone'), hard: 1.5, tool: 'pick', lvl: 1, drop: 4, cat: 'nature' });
  b(2, 'grass', '잔디 블록', { tex: faces({ top: 'grass_top', bottom: 'dirt', side: 'grass_side' }), hard: 0.6, tool: 'shovel', drop: 3, sound: 'grass', tint: 'grasstop', cat: 'nature' });
  b(3, 'dirt', '흙', { tex: faces('dirt'), hard: 0.5, tool: 'shovel', sound: 'gravel', cat: 'nature' });
  b(4, 'cobblestone', '조약돌', { tex: faces('cobblestone'), hard: 2, tool: 'pick', lvl: 1 });
  b(5, 'oak_planks', '참나무 판자', { tex: faces('oak_planks'), hard: 2, tool: 'axe', sound: 'wood' });
  b(6, 'bedrock', '기반암', { tex: faces('bedrock'), hard: -1, push: 'block', cat: 'nature' });
  b(7, 'sand', '모래', { tex: faces('sand'), hard: 0.5, tool: 'shovel', sound: 'sand', gravity: true, cat: 'nature' });
  b(8, 'gravel', '자갈', { tex: faces('gravel'), hard: 0.6, tool: 'shovel', sound: 'gravel', gravity: true, cat: 'nature' });
  // 통나무 meta: 0 세로, 1 x축, 2 z축
  const log = (id, name, k, side, top) => b(id, name, k, {
    tex: faces(side), texTop: T(top), texSide: T(side), hard: 2, tool: 'axe', sound: 'wood', cat: 'nature', axis: true,
  });
  log(9, 'oak_log', '참나무 원목', 'oak_log', 'oak_log_top');
  // 나뭇잎 meta bit0: 플레이어가 설치(자연 소멸 안 함)
  const leaf = (id, name, k, t, sap) => b(id, name, k, {
    tex: faces(t), opaque: false, opacity: 1, layer: 1, hard: 0.2, sound: 'grass', tint: 'leaves', wave: 1, cat: 'nature', conductor: false,
    drop: (m, rnd) => { const r = []; if (rnd() < 0.06) r.push([BL.sapling, 1]); if (name === 'oak_leaves' && rnd() < 0.05) r.push([263, 1]); return r; },
  });
  leaf(10, 'oak_leaves', '참나무 잎', 'oak_leaves');
  b(11, 'glass', '유리', { tex: faces('glass'), opaque: false, layer: 1, hard: 0.3, sound: 'glass', drop: () => [], conductor: false });
  // 물/용암 meta: 0 원천, 1~7 흐름 단계, 8 이상은 떨어지는 물
  b(12, 'water', '물', { tex: faces('water'), shape: 'fluid', solid: false, opaque: false, opacity: 2, layer: 2, replace: true, fluid: true, item: false, hard: 100, wave: 3, push: 'break' });
  b(13, 'lava', '용암', { tex: faces('lava'), shape: 'fluid', solid: false, opaque: false, opacity: 15, layer: 0, replace: true, fluid: true, item: false, emit: 15, emissive: true, hard: 100, push: 'break' });
  b(14, 'coal_ore', '석탄 광석', { tex: faces('coal_ore'), hard: 3, tool: 'pick', lvl: 1, drop: () => [[257, 1]], cat: 'nature' });
  b(15, 'iron_ore', '철 광석', { tex: faces('iron_ore'), hard: 3, tool: 'pick', lvl: 2, cat: 'nature' });
  b(16, 'gold_ore', '금 광석', { tex: faces('gold_ore'), hard: 3, tool: 'pick', lvl: 3, cat: 'nature' });
  b(17, 'diamond_ore', '다이아몬드 광석', { tex: faces('diamond_ore'), hard: 3, tool: 'pick', lvl: 3, drop: () => [[261, 1]], cat: 'nature' });
  b(18, 'redstone_ore', '레드스톤 광석', { tex: faces('redstone_ore'), hard: 3, tool: 'pick', lvl: 3, drop: (m, rnd) => [[262, 4 + (rnd() * 2 | 0)]], cat: 'nature' });
  log(19, 'birch_log', '자작나무 원목', 'birch_log', 'birch_log_top');
  leaf(20, 'birch_leaves', '자작나무 잎', 'birch_leaves');
  log(21, 'spruce_log', '가문비나무 원목', 'spruce_log', 'spruce_log_top');
  leaf(22, 'spruce_leaves', '가문비나무 잎', 'spruce_leaves');
  b(23, 'birch_planks', '자작나무 판자', { tex: faces('birch_planks'), hard: 2, tool: 'axe', sound: 'wood' });
  b(24, 'spruce_planks', '가문비나무 판자', { tex: faces('spruce_planks'), hard: 2, tool: 'axe', sound: 'wood' });
  b(25, 'sandstone', '사암', { tex: faces({ top: 'sandstone_top', side: 'sandstone' }), hard: 0.8, tool: 'pick', lvl: 1 });
  b(26, 'snow_block', '눈 블록', { tex: faces('snow'), hard: 0.2, tool: 'shovel', sound: 'wool', cat: 'nature' });
  b(27, 'grass_snow', '눈 덮인 잔디', { tex: faces({ top: 'snow', bottom: 'dirt', side: 'grass_snow_side' }), hard: 0.6, tool: 'shovel', drop: 3, sound: 'grass', cat: 'nature' });
  b(28, 'ice', '얼음', { tex: faces('ice'), opaque: false, opacity: 2, layer: 2, hard: 0.5, tool: 'pick', sound: 'glass', drop: () => [], conductor: false, slippery: true, cat: 'nature' });
  b(29, 'cactus', '선인장', { tex: faces({ top: 'cactus_top', side: 'cactus_side' }), shape: 'cactus', opaque: false, layer: 1, hard: 0.4, sound: 'wool', cat: 'nature', damage: 1, conductor: false });
  b(30, 'clay', '점토', { tex: faces('clay'), hard: 0.6, tool: 'shovel', sound: 'gravel', drop: () => [[288, 4]], cat: 'nature' });
  b(31, 'bricks', '벽돌', { tex: faces('bricks'), hard: 2, tool: 'pick', lvl: 1 });
  b(32, 'stone_bricks', '석재 벽돌', { tex: faces('stone_bricks'), hard: 1.5, tool: 'pick', lvl: 1 });
  b(33, 'mossy_cobblestone', '이끼 낀 조약돌', { tex: faces('mossy_cobblestone'), hard: 2, tool: 'pick', lvl: 1 });
  b(34, 'obsidian', '흑요석', { tex: faces('obsidian'), hard: 30, tool: 'pick', lvl: 4, push: 'block' });
  b(35, 'bookshelf', '책장', { tex: faces({ top: 'oak_planks', side: 'bookshelf' }), hard: 1.5, tool: 'axe', sound: 'wood', drop: () => [[291, 3]] });
  b(36, 'crafting_table', '제작대', { tex: faces({ top: 'crafting_table_top', bottom: 'oak_planks', side: 'crafting_table_side' }), hard: 2.5, tool: 'axe', sound: 'wood', cat: 'tools', use: 'craft' });
  // 화로 meta: facing(2~5) | 8=불 켜짐
  b(37, 'furnace', '화로', { hard: 3.5, tool: 'pick', lvl: 1, cat: 'tools', use: 'furnace', push: 'block', container: true, facingH: true, emit: m => (m & 8) ? 13 : 0,
    texf: (m, f) => f === (m & 7) ? T((m & 8) ? 'furnace_front_lit' : 'furnace_front') : f < 2 ? T('furnace_top') : T('furnace_side') });
  b(38, 'chest', '상자', { shape: 'chest', opaque: false, hard: 2.5, tool: 'axe', sound: 'wood', cat: 'tools', use: 'chest', push: 'block', container: true, facingH: true,
    texf: (m, f) => f === (m & 7) ? T('chest_front') : f < 2 ? T('chest_top') : T('chest_side') });
  // 횃불 meta: 붙은 방향 (0 바닥, 2~5 벽)
  b(39, 'torch', '횃불', { tex: faces('torch'), shape: 'torch', solid: false, opaque: false, layer: 1, hard: 0, emit: 14, emissive: true, sound: 'wood', icon: 'torch', push: 'break', cat: 'tools' });
  const plant = (id, name, k, t, extra) => b(id, name, k, Object.assign({ tex: faces(t), shape: 'cross', solid: false, opaque: false, layer: 1, hard: 0, sound: 'grass', icon: t, push: 'break', wave: 2, cat: 'nature', replace: false }, extra || {}));
  plant(40, 'tallgrass', '잔디', 'tallgrass', { tint: 'grass', replace: true, drop: (m, rnd) => rnd() < 0.125 ? [[266, 1]] : [] });
  plant(41, 'dandelion', '민들레', 'dandelion');
  plant(42, 'poppy', '양귀비', 'poppy');
  plant(43, 'blue_orchid', '파란 난초', 'blue_orchid');
  plant(44, 'dead_bush', '마른 덤불', 'dead_bush', { replace: true, drop: () => [] });
  plant(45, 'sugar_cane', '사탕수수', 'sugar_cane', { wave: 0 });
  b(46, 'wheat', '밀', { shape: 'crop', solid: false, opaque: false, layer: 1, hard: 0, sound: 'grass', push: 'break', item: false, wave: 2,
    texf: (m) => T('wheat_' + Math.min(7, m & 7)),
    drop: (m, rnd) => (m & 7) >= 7 ? [[265, 1], [266, 1 + (rnd() * 3 | 0)]] : [[266, 1]] });
  b(47, 'farmland', '경작지', { shape: 'farmland', opaque: false, tex: faces({ top: 'farmland', side: 'dirt', bottom: 'dirt' }), hard: 0.6, tool: 'shovel', sound: 'gravel', drop: 3, conductor: false, cat: 'nature',
    texf: (m, f) => f === 1 ? T(m ? 'farmland_wet' : 'farmland') : T('dirt') });
  b(48, 'glowstone', '발광석', { tex: faces('glowstone'), hard: 0.3, emit: 15, emissive: true, sound: 'glass' });
  b(49, 'iron_block', '철 블록', { tex: faces('iron_block'), hard: 5, tool: 'pick', lvl: 2, sound: 'metal' });
  b(50, 'gold_block', '금 블록', { tex: faces('gold_block'), hard: 3, tool: 'pick', lvl: 3, sound: 'metal' });
  b(51, 'diamond_block', '다이아몬드 블록', { tex: faces('diamond_block'), hard: 5, tool: 'pick', lvl: 3, sound: 'metal' });
  b(52, 'coal_block', '석탄 블록', { tex: faces('coal_block'), hard: 5, tool: 'pick', lvl: 1 });
  plant(53, 'sapling', '묘목', 'sapling', { wave: 0 });
  // 반 블록 meta: 0 아래, 1 위
  b(54, 'stone_slab', '돌 반 블록', { tex: faces('smooth_stone'), shape: 'slab', opaque: false, hard: 2, tool: 'pick', lvl: 1, conductor: false });
  b(55, 'oak_slab', '참나무 반 블록', { tex: faces('oak_planks'), shape: 'slab', opaque: false, hard: 2, tool: 'axe', sound: 'wood', conductor: false });
  // 계단 meta: facing(2~5 올라가는 방향) | 8 뒤집힘
  b(56, 'oak_stairs', '참나무 계단', { tex: faces('oak_planks'), shape: 'stairs', opaque: false, hard: 2, tool: 'axe', sound: 'wood', conductor: false, facingH: true });
  b(57, 'cobblestone_stairs', '조약돌 계단', { tex: faces('cobblestone'), shape: 'stairs', opaque: false, hard: 2, tool: 'pick', lvl: 1, conductor: false, facingH: true });
  b(58, 'ladder', '사다리', { tex: faces('ladder'), shape: 'ladder', solid: false, opaque: false, layer: 1, hard: 0.4, tool: 'axe', sound: 'wood', icon: 'ladder', climb: true, push: 'break', cat: 'tools' });
  b(59, 'oak_fence', '참나무 울타리', { tex: faces('oak_planks'), shape: 'fence', opaque: false, hard: 2, tool: 'axe', sound: 'wood', conductor: false });
  // 문 meta: facing(2~5) | 8 열림 | 16 윗부분 | 32 경첩 반대
  b(60, 'oak_door', '참나무 문', { shape: 'door', solid: true, opaque: false, layer: 1, hard: 3, tool: 'axe', sound: 'wood', icon: 'door_oak_item', push: 'break', stack: 64, cat: 'redstone', rs: 'door', use: 'door',
    texf: (m) => T((m & 16) ? 'door_oak_top' : 'door_oak_bottom'), drop: (m) => (m & 16) ? [] : [[60, 1]] });
  b(61, 'iron_door', '철 문', { shape: 'door', solid: true, opaque: false, layer: 1, hard: 5, tool: 'pick', lvl: 1, sound: 'metal', icon: 'door_iron_item', push: 'break', cat: 'redstone', rs: 'door',
    texf: (m) => T((m & 16) ? 'door_iron_top' : 'door_iron_bottom'), drop: (m) => (m & 16) ? [] : [[61, 1]] });
  // 다락문 meta: facing(2~5) | 8 열림 | 16 위쪽 절반
  b(62, 'oak_trapdoor', '참나무 다락문', { tex: faces('trapdoor_oak'), shape: 'trapdoor', opaque: false, layer: 1, hard: 3, tool: 'axe', sound: 'wood', cat: 'redstone', rs: 'door', use: 'door', conductor: false });
  b(63, 'iron_trapdoor', '철 다락문', { tex: faces('trapdoor_iron'), shape: 'trapdoor', opaque: false, layer: 1, hard: 5, tool: 'pick', lvl: 1, sound: 'metal', cat: 'redstone', rs: 'door', conductor: false });
  b(64, 'smooth_stone', '매끄러운 돌', { tex: faces('smooth_stone'), hard: 2, tool: 'pick', lvl: 1 });
  b(65, 'slime_block', '슬라임 블록', { tex: faces('slime_block'), opaque: false, layer: 2, hard: 0, sound: 'wool', bouncy: true, conductor: false, cat: 'redstone' });
  b(66, 'lapis_block', '청금석 블록', { tex: faces('lapis_block'), hard: 3, tool: 'pick', lvl: 2 });
  b(67, 'sandstone_slab', '사암 반 블록', { tex: faces({ top: 'sandstone_top', side: 'sandstone' }), shape: 'slab', opaque: false, hard: 2, tool: 'pick', lvl: 1, conductor: false });
  b(68, 'stone_brick_stairs', '석재 벽돌 계단', { tex: faces('stone_bricks'), shape: 'stairs', opaque: false, hard: 2, tool: 'pick', lvl: 1, conductor: false, facingH: true });
  b(69, 'brick_stairs', '벽돌 계단', { tex: faces('bricks'), shape: 'stairs', opaque: false, hard: 2, tool: 'pick', lvl: 1, conductor: false, facingH: true });
  for (let i = 0; i < 16; i++) {
    const [n, k] = DYES[i];
    b(70 + i, 'wool_' + n, k + ' 양털', { tex: faces('wool_' + n), hard: 0.8, sound: 'wool', cat: 'color' });
    b(86 + i, 'concrete_' + n, k + ' 콘크리트', { tex: faces('concrete_' + n), hard: 1.8, tool: 'pick', lvl: 1, cat: 'color' });
  }

  // ======================= 전기 회로 (레드스톤) =======================
  // 레드스톤 가루(전선) meta: 전력 0~15
  b(110, 'redstone_wire', '레드스톤 가루(전선)', { shape: 'wire', solid: false, opaque: false, layer: 1, hard: 0, tex: faces('wire'), tint: 'wire', rs: 'wire', push: 'break', item: false, drop: () => [[262, 1]], cat: 'redstone' });
  // 레드스톤 횃불 meta: 붙은 방향(0 바닥, 2~5 벽) | 8 꺼짐
  b(111, 'redstone_torch', '레드스톤 횃불', { shape: 'torch', solid: false, opaque: false, layer: 1, hard: 0, rs: 'torch', push: 'break', icon: 'redstone_torch', emissive: true, cat: 'redstone',
    emit: m => (m & 8) ? 0 : 7, texf: m => T((m & 8) ? 'redstone_torch_off' : 'redstone_torch') });
  // 레버 meta: 붙은 방향(0~5) | 8 켜짐
  b(112, 'lever', '레버', { shape: 'lever', solid: false, opaque: false, layer: 0, hard: 0.5, rs: 'lever', push: 'break', icon: 'lever_icon', sound: 'wood', cat: 'redstone', use: 'lever', tex: faces('cobblestone') });
  // 버튼 meta: 붙은 방향 | 8 눌림
  b(113, 'stone_button', '돌 버튼', { shape: 'button', solid: false, opaque: false, hard: 0.5, rs: 'button', push: 'break', tex: faces('stone'), cat: 'redstone', use: 'button', pulse: 20 });
  b(114, 'oak_button', '나무 버튼', { shape: 'button', solid: false, opaque: false, hard: 0.5, rs: 'button', push: 'break', tex: faces('oak_planks'), sound: 'wood', cat: 'redstone', use: 'button', pulse: 30 });
  // 압력판 meta: 8 눌림
  b(115, 'stone_pressure_plate', '돌 압력판', { shape: 'plate', solid: false, opaque: false, hard: 0.5, rs: 'plate', push: 'break', tex: faces('stone'), cat: 'redstone' });
  b(116, 'oak_pressure_plate', '나무 압력판', { shape: 'plate', solid: false, opaque: false, hard: 0.5, rs: 'plate', push: 'break', tex: faces('oak_planks'), sound: 'wood', cat: 'redstone', anyEntity: true });
  // 중계기 meta: facing(2~5, 출력 방향) | (지연-1)<<3 | 32 켜짐 | 64 잠김
  b(117, 'repeater', '레드스톤 중계기', { shape: 'diode', solid: true, opaque: false, hard: 0, rs: 'repeater', push: 'break', icon: 'repeater_icon', cat: 'redstone', use: 'repeater', facingH: true, conductor: false,
    texf: (m, f) => f === 1 ? T('repeater_top') : T('smooth_stone') });
  // 비교기 meta: facing | 8 빼기모드 | 16 켜짐   (출력 세기는 blockEntity)
  b(118, 'comparator', '레드스톤 비교기', { shape: 'diode', solid: true, opaque: false, hard: 0, rs: 'comparator', push: 'break', icon: 'comparator_icon', cat: 'redstone', use: 'comparator', facingH: true, conductor: false,
    texf: (m, f) => f === 1 ? T('comparator_top') : T('smooth_stone') });
  b(119, 'redstone_block', '레드스톤 블록', { tex: faces('redstone_block'), hard: 5, tool: 'pick', lvl: 1, rs: 'source', sound: 'metal', cat: 'redstone', conductor: false, emissive: true });
  // 레드스톤 램프 meta: 1 켜짐
  b(120, 'redstone_lamp', '레드스톤 램프', { hard: 0.3, rs: 'lamp', sound: 'glass', cat: 'redstone', emit: m => m & 1 ? 15 : 0,
    texf: m => T(m & 1 ? 'lamp_on' : 'lamp_off'), emissiveF: m => !!(m & 1) });
  // 피스톤 meta: facing(0~5 머리 방향) | 8 늘어남
  const pistonTex = (sticky) => (m, f) => {
    const fc = m & 7, ext = m & 8;
    if (f === fc) return T(ext ? 'piston_inner' : (sticky ? 'piston_top_sticky' : 'piston_top'));
    if (f === OPP[fc]) return T('piston_bottom');
    return T('piston_side');
  };
  b(121, 'piston', '피스톤', { shape: 'piston', hard: 0.5, rs: 'piston', cat: 'redstone', texf: pistonTex(false), facing6: true, faceToPlayer: true, conductor: false, opaque: false });
  b(122, 'sticky_piston', '끈끈이 피스톤', { shape: 'piston', hard: 0.5, rs: 'piston', sticky: true, cat: 'redstone', texf: pistonTex(true), facing6: true, faceToPlayer: true, conductor: false, opaque: false });
  // 피스톤 머리 meta: facing | 8 끈끈이
  b(123, 'piston_head', '피스톤 머리', { shape: 'pistonhead', opaque: false, hard: 0.5, item: false, push: 'block', drop: () => [], conductor: false,
    texf: (m, f) => f === (m & 7) ? T(m & 8 ? 'piston_top_sticky' : 'piston_top') : T('piston_arm') });
  // 소리 블록 meta: 음(0~24) | 32 전력 받음
  b(124, 'note_block', '소리 블록', { tex: faces('note_block'), hard: 0.8, tool: 'axe', sound: 'wood', rs: 'note', cat: 'redstone', use: 'note' });
  b(125, 'tnt', 'TNT', { tex: faces({ top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }), hard: 0, sound: 'grass', rs: 'tnt', cat: 'redstone' });
  // 관측기 meta: facing(0~5 보는 방향) | 8 켜짐 → 뒤쪽으로 출력
  b(126, 'observer', '관측기', { hard: 3, tool: 'pick', rs: 'observer', cat: 'redstone', facing6: true, conductor: false,
    texf: (m, f) => { const fc = m & 7; if (f === fc) return T('observer_front'); if (f === OPP[fc]) return T(m & 8 ? 'observer_back_on' : 'observer_back'); return (fc < 2 ? (f === 2 || f === 3) : f < 2) ? T('observer_top') : T('observer_side'); } });
  // 햇빛 감지기 meta: 전력(0~15) | 16 반전(밤 감지)
  b(127, 'daylight_sensor', '햇빛 감지기', { shape: 'daylight', opaque: false, hard: 0.2, tool: 'axe', sound: 'wood', rs: 'daylight', cat: 'redstone', use: 'daylight', conductor: false,
    texf: (m, f) => f === 1 ? T(m & 16 ? 'daylight_top_inv' : 'daylight_top') : T('oak_planks'), icon: 'daylight_top' });
  // 발사기 meta: facing(0~5) | 8 전력
  b(128, 'dispenser', '발사기', { hard: 3.5, tool: 'pick', rs: 'dispenser', cat: 'redstone', facing6: true, faceToPlayer: true, container: true, use: 'dispenser', push: 'block',
    texf: (m, f) => f === (m & 7) ? T('dispenser_front') : f < 2 ? T('furnace_top') : T('furnace_side') });
  // 레일 meta: 모양 0~9 (0 남북, 1 동서, 2~5 경사 동/서/북/남, 6~9 곡선 남동/남서/북서/북동)
  b(129, 'rail', '레일', { shape: 'rail', solid: false, opaque: false, layer: 1, hard: 0.7, tool: 'pick', sound: 'metal', push: 'break', icon: 'rail', cat: 'redstone', rail: true,
    texf: m => T((m & 15) >= 6 ? 'rail_curve' : 'rail') });
  b(130, 'powered_rail', '전동 레일', { shape: 'rail', solid: false, opaque: false, layer: 1, hard: 0.7, tool: 'pick', sound: 'metal', push: 'break', icon: 'powered_rail', rs: 'prail', cat: 'redstone', rail: true,
    texf: m => T(m & 8 ? 'powered_rail_on' : 'powered_rail') });
  b(131, 'detector_rail', '감지 레일', { shape: 'rail', solid: false, opaque: false, layer: 1, hard: 0.7, tool: 'pick', sound: 'metal', push: 'break', icon: 'detector_rail', rs: 'drail', cat: 'redstone', rail: true,
    texf: m => T(m & 8 ? 'detector_rail_on' : 'detector_rail') });
  // 논리 게이트 (교육용) meta: facing(2~5 출력 방향) | 8 켜짐
  const gate = (id, g, k, desc) => b(id, 'gate_' + g.toLowerCase(), k, { shape: 'diode', solid: true, opaque: false, hard: 0, rs: 'gate', gate: g, push: 'break', cat: 'redstone', facingH: true, conductor: false, desc,
    texf: (m, f) => f === 1 ? T('gate_' + g + (m & 8 ? '_on' : '')) : T('gate_side'), icon: 'gate_' + g });
  gate(132, 'AND', 'AND 게이트', '왼쪽(A)과 오른쪽(B)이 모두 켜지면 앞으로 신호를 보냅니다.');
  gate(133, 'OR', 'OR 게이트', '왼쪽(A)이나 오른쪽(B) 중 하나라도 켜지면 신호를 보냅니다.');
  gate(134, 'XOR', 'XOR 게이트', 'A와 B 중 딱 하나만 켜졌을 때 신호를 보냅니다.');
  gate(135, 'NOT', 'NOT 게이트', '뒤쪽 입력이 꺼져 있으면 켜고, 켜져 있으면 끕니다.');
  // 숫자 표시기 meta: 표시값 0~15
  b(136, 'number_display', '숫자 표시기', { hard: 0.5, rs: 'display', cat: 'redstone', sound: 'glass', conductor: false, emissiveF: m => (m & 15) > 0,
    texf: (m, f) => f === 0 ? T('display_side') : T('display_' + (m & 15)), icon: 'display_7', desc: '옆으로 들어오는 신호 세기(0~15)를 숫자로 보여줍니다.' });
  // 색깔 램프 meta: 받은 전력 0~15
  b(137, 'color_lamp', '색깔 램프', { tex: faces('color_lamp'), hard: 0.3, rs: 'colorlamp', cat: 'redstone', sound: 'glass', tint: 'colorlamp', emit: m => m & 15, emissiveF: m => (m & 15) > 0, desc: '신호 세기에 따라 색이 바뀝니다 (1 빨강 → 15 보라).' });
  // 클럭 블록 meta: 주기(0~3) | 4 출력 켜짐
  b(138, 'clock_block', '클럭 블록', { hard: 0.5, rs: 'clock', cat: 'redstone', use: 'clock', conductor: false,
    texf: (m, f) => f === 1 ? T(m & 4 ? 'clock_top_on' : 'clock_top') : T('gate_side'), icon: 'clock_top', desc: '일정한 간격으로 켜졌다 꺼집니다. 우클릭으로 주기 변경, 신호를 받으면 멈춥니다.' });
  // 플레이어 감지기 meta: 8 켜짐
  b(139, 'player_sensor', '플레이어 감지기', { hard: 0.5, rs: 'sensor', cat: 'redstone', conductor: false,
    texf: (m, f) => f === 1 ? T(m & 8 ? 'sensor_front_on' : 'sensor_front') : T('sensor_side'), icon: 'sensor_front', desc: '5칸 안에 플레이어나 동물이 있으면 신호를 보냅니다.' });
  // 선풍기 meta: facing(0~5) | 8 켜짐
  b(140, 'fan', '전기 선풍기', { hard: 0.8, rs: 'fan', cat: 'redstone', facing6: true, faceToPlayer: false, conductor: false,
    texf: (m, f) => f === (m & 7) ? T('fan_front') : T('fan_side'), icon: 'fan_front', desc: '전기를 받으면 앞쪽(최대 8칸)의 플레이어·몹·아이템을 밀어냅니다.' });
  // 투척기 meta: facing | 8 전력
  b(141, 'dropper', '공급기', { hard: 3.5, tool: 'pick', rs: 'dispenser', dropper: true, cat: 'redstone', facing6: true, faceToPlayer: true, container: true, use: 'dispenser', push: 'block',
    texf: (m, f) => f === (m & 7) ? T('dropper_front') : f < 2 ? T('furnace_top') : T('furnace_side') });
  // 엘리베이터 블록: 전기를 받으면 위에 선 개체를 위로 들어올림
  b(142, 'elevator', '전기 엘리베이터', { tex: faces('elevator'), hard: 0.8, rs: 'elevator', cat: 'redstone', sound: 'metal', desc: '신호를 받으면 위에 서 있는 개체를 높이 띄워 올립니다. 점프로 위층, 웅크리기로 아래층 이동도 됩니다.' });
  b(143, 'target', '과녁', { tex: faces('target'), hard: 0.5, rs: 'target', cat: 'redstone', sound: 'grass', desc: '화살이 맞으면 신호를 보냅니다.' });
  b(144, 'speaker', '스피커', { tex: faces('speaker'), hard: 0.8, rs: 'note', speaker: true, cat: 'redstone', use: 'note', desc: '신호가 들어올 때 소리를 냅니다. 우클릭으로 음을 바꿉니다 (신호 세기 = 음 높이).' });

  // 침대 meta: facing(베개 방향)
  b(145, 'bed', '침대', { shape: 'bed', opaque: false, hard: 0.2, sound: 'wool', cat: 'tools', use: 'bed', facingH: true, faceAway: true, conductor: false,
    texf: (m, f) => f === 1 ? T('bed_top') : f === 0 ? T('oak_planks') : T('bed_side'), desc: '밤에 우클릭하면 아침까지 잠을 자고, 다시 태어날 곳이 여기로 정해져요.' });
  // 깔때기 meta: 출력 방향(0 아래, 2~5 옆) | 8 전기로 잠김
  b(146, 'hopper', '깔때기', { shape: 'hopper', opaque: false, hard: 3, tool: 'pick', lvl: 1, sound: 'metal', rs: 'hopper', cat: 'redstone', container: true, use: 'dispenser', push: 'block', conductor: false,
    texf: (m, f) => f === 1 ? T('hopper_top') : T('hopper_side'), desc: '위에 있는 상자나 떨어진 아이템을 빨아들여 주둥이 쪽 상자로 옮겨요. 전기를 받으면 멈춰요.' });
  // 컨베이어 벨트 meta: facing(움직이는 방향) | 8 켜짐
  b(147, 'conveyor', '컨베이어 벨트', { shape: 'conveyor', opaque: false, hard: 1, tool: 'pick', sound: 'metal', rs: 'conveyor', cat: 'redstone', facingH: true, faceAway: true, conductor: false,
    texf: (m, f) => f === 1 ? T(m & 8 ? 'conveyor_top_on' : 'conveyor_top') : f === 0 ? T('smooth_stone') : T('conveyor_side'), desc: '전기를 받으면 위에 올라간 플레이어·몹·아이템을 화살표 방향으로 옮겨요.' });
  defineSurvivalBlocks();
  if (typeof defineDimBlocks === 'function') defineDimBlocks();
  if (typeof defineVanillaBlocks === 'function') defineVanillaBlocks();
  if (typeof defineNatureBlocks === 'function') defineNatureBlocks();
  if (typeof defineParkourBlocks === 'function') defineParkourBlocks();
  // 설명 기본값
  for (const d of BLOCKS) if (d) {
    if (!d.tex && !d.texf) d.tex = faces('stone');
    if (d.emit === undefined) d.emit = 0;
  }
}

// 블록 텍스처 레이어 (meta, face)
function blockTex(d, meta, face) {
  if (d.texf) return d.texf(meta, face);
  if (d.axis) {
    const ax = meta & 3;
    if (ax === 0) return face < 2 ? d.texTop : d.texSide;
    if (ax === 1) return face >= 4 ? d.texTop : d.texSide;
    return (face === 2 || face === 3) ? d.texTop : d.texSide;
  }
  return d.tex[face];
}
function blockEmit(id, meta) { const d = BLOCKS[id]; if (!d) return 0; const e = d.emit; return typeof e === 'function' ? e(meta) : e; }
function isEmissive(d, meta) { return d.emissiveF ? d.emissiveF(meta) : d.emissive; }

// 충돌/선택 상자 (블록 단위 0~1). null → 없음, 'full' → 한 칸 전체
function blockBoxes(id, meta, forSelect, world, x, y, z) {
  const d = BLOCKS[id];
  if (!d || id === 0) return null;
  if (d.fluid) return forSelect ? null : null;
  const s = d.shape;
  if (s === 'cube' || s === 'piston' && !(meta & 8)) return FULL_BOX;
  if (!forSelect && !d.solid) return null;
  switch (s) {
    case 'slab': return meta & 1 ? [[0, 0.5, 0, 1, 1, 1]] : [[0, 0, 0, 1, 0.5, 1]];
    case 'stairs': {
      const up = meta & 8, f = meta & 7;
      const base = up ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
      const y0 = up ? 0 : 0.5, y1 = up ? 0.5 : 1;
      let st;
      if (f === 2) st = [0, y0, 0, 1, y1, 0.5]; else if (f === 3) st = [0, y0, 0.5, 1, y1, 1];
      else if (f === 4) st = [0, y0, 0, 0.5, y1, 1]; else st = [0.5, y0, 0, 1, y1, 1];
      return [base, st];
    }
    case 'fence': return forSelect ? [[0.375, 0, 0.375, 0.625, 1, 0.625]] : [[0.375, 0, 0.375, 0.625, 1.5, 0.625]].concat(fenceArms(world, x, y, z));
    case 'door': return [doorBox(meta)];
    case 'trapdoor': return [trapBox(meta)];
    case 'cactus': return [[1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]];
    case 'chest': return [[1 / 16, 0, 1 / 16, 15 / 16, 14 / 16, 15 / 16]];
    case 'farmland': return [[0, 0, 0, 1, 15 / 16, 1]];
    case 'diode': return [[0, 0, 0, 1, 2 / 16, 1]];
    case 'daylight': return [[0, 0, 0, 1, 6 / 16, 1]];
    case 'bed': return [[0, 0, 0, 1, 9 / 16, 1]];
    case 'conveyor': return [[0, 0, 0, 1, 6 / 16, 1]];
    case 'hopper': return FULL_BOX;
    case 'portal': case 'endportal': return null;
    case 'endframe': return [[0, 0, 0, 1, 13 / 16, 1]];
    case 'egg': return [[1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]];
    case 'piston': { const f = meta & 7; const b = [0, 0, 0, 1, 1, 1]; if (f === 0) b[1] = 0.25; else if (f === 1) b[4] = 0.75; else if (f === 2) b[2] = 0.25; else if (f === 3) b[5] = 0.75; else if (f === 4) b[0] = 0.25; else b[3] = 0.75; return [b]; }
    case 'pistonhead': { const f = meta & 7; const b = [0, 0, 0, 1, 1, 1]; if (f === 0) b[4] = 0.25; else if (f === 1) b[1] = 0.75; else if (f === 2) b[5] = 0.25; else if (f === 3) b[2] = 0.75; else if (f === 4) b[3] = 0.25; else b[0] = 0.75; return [b]; }
    // 선택 전용 (충돌 없음)
    case 'torch': { const a = meta & 7; if (a === 0) return [[0.4, 0, 0.4, 0.6, 0.65, 0.6]]; return [wallBox(a, 0.35, 0.2, 0.3, 0.9)]; }
    case 'lever': return [attachBox(meta & 7, 0.25, 0.2)];
    case 'button': return [attachBox(meta & 7, 0.19, meta & 8 ? 0.07 : 0.13)];
    case 'plate': return [[1 / 16, 0, 1 / 16, 15 / 16, 1 / 16, 15 / 16]];
    case 'wire': return [[0, 0, 0, 1, 1 / 16, 1]];
    case 'rail': return [[0, 0, 0, 1, 2 / 16, 1]];
    case 'ladder': return [wallBox(meta & 7, 0, 0, 0.12, 1).map((v, i) => v)];
    case 'cross': case 'crop': return [[0.15, 0, 0.15, 0.85, 0.8, 0.85]];
  }
  return FULL_BOX;
}
const FULL_BOX = [[0, 0, 0, 1, 1, 1]];
// 벽에 붙은 얇은 상자 (a: 붙은 방향)
function wallBox(a, lo, y0, depth, y1) {
  const w0 = 0.5 - (0.5 - lo) , w1 = 1 - lo;
  if (a === 2) return [lo, y0, 0, 1 - lo, y1, depth];
  if (a === 3) return [lo, y0, 1 - depth, 1 - lo, y1, 1];
  if (a === 4) return [0, y0, lo, depth, y1, 1 - lo];
  if (a === 5) return [1 - depth, y0, lo, 1, y1, 1 - lo];
  return [lo, y0, lo, 1 - lo, y1, 1 - lo];
}
// 붙은 면 기준 상자 (버튼/레버)
function attachBox(a, half, depth) {
  const lo = 0.5 - half, hi = 0.5 + half;
  switch (a) {
    case 0: return [lo, 0, lo, hi, depth, hi];
    case 1: return [lo, 1 - depth, lo, hi, 1, hi];
    case 2: return [lo, lo, 0, hi, hi, depth];
    case 3: return [lo, lo, 1 - depth, hi, hi, 1];
    case 4: return [0, lo, lo, depth, hi, hi];
    default: return [1 - depth, lo, lo, 1, hi, hi];
  }
}
// 문: 닫혔을 때 facing 방향 쪽 면에 얇은 판, 열리면 경첩 쪽으로 90도
function doorPanelDir(meta) {
  const f = meta & 7, open = meta & 8, hinge = meta & 32;
  if (!open) return f;
  return hinge ? CCW[f] : CW[f];
}
function doorBox(meta) {
  const t = 3 / 16, d = doorPanelDir(meta);
  if (d === 2) return [0, 0, 0, 1, 1, t];
  if (d === 3) return [0, 0, 1 - t, 1, 1, 1];
  if (d === 4) return [0, 0, 0, t, 1, 1];
  return [1 - t, 0, 0, 1, 1, 1];
}
function trapBox(meta) {
  const t = 3 / 16, f = meta & 7;
  if (!(meta & 8)) return meta & 16 ? [0, 1 - t, 0, 1, 1, 1] : [0, 0, 0, 1, t, 1];
  // 열리면 facing 반대쪽 벽에 세워짐
  if (f === 2) return [0, 0, 1 - t, 1, 1, 1];
  if (f === 3) return [0, 0, 0, 1, 1, t];
  if (f === 4) return [1 - t, 0, 0, 1, 1, 1];
  return [0, 0, 0, t, 1, 1];
}
function fenceConnects(world, x, y, z) {
  if (!world) return false;
  const id = world.getBlock(x, y, z); const d = BLOCKS[id];
  return (d && d.shape === 'fence') || (d && d.opaque);
}
function fenceArms(world, x, y, z) {
  const r = [];
  if (fenceConnects(world, x, y, z - 1)) r.push([0.375, 0, 0, 0.625, 1.5, 0.5]);
  if (fenceConnects(world, x, y, z + 1)) r.push([0.375, 0, 0.5, 0.625, 1.5, 1]);
  if (fenceConnects(world, x - 1, y, z)) r.push([0, 0, 0.375, 0.5, 1.5, 0.625]);
  if (fenceConnects(world, x + 1, y, z)) r.push([0.5, 0, 0.375, 1, 1.5, 0.625]);
  return r;
}
