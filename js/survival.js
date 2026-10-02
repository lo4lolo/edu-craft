'use strict';
// =====================================================================
// 서바이벌 확장
//  - 원래 마인크래프트: 구리·청금석·에메랄드 광석, 원석(raw), 심층암, 부싯돌, 가죽,
//    갑옷(가죽·철·금·다이아몬드), 뼛가루, 가위, 황금 사과
//  - 모드 편의 기능: 나무 한 번에 베기, 광맥 한 번에 캐기, 빠른 잎 소멸,
//    작물 우클릭 수확, 같은 아이템 자동 채우기, 인벤토리 정리, 미니맵, 죽은 위치 알림
// =====================================================================
const ARMOR_MATS = [
  { n: 'leather', k: '가죽', col: [0.66, 0.43, 0.26], def: [1, 3, 2, 1], mul: 5, item: 'leather' },
  { n: 'iron', k: '철', col: [0.86, 0.86, 0.88], def: [2, 6, 5, 2], mul: 15, item: 'iron_ingot' },
  { n: 'gold', k: '금', col: [0.98, 0.84, 0.3], def: [2, 5, 3, 1], mul: 7, item: 'gold_ingot' },
  { n: 'diamond', k: '다이아몬드', col: [0.45, 0.9, 0.88], def: [3, 8, 6, 3], mul: 33, item: 'diamond' },
];
const ARMOR_PIECES = [['helmet', '투구', 11], ['chestplate', '흉갑', 16], ['leggings', '레깅스', 15], ['boots', '부츠', 13]];
const ARMOR_SLOT_NAMES = ['머리', '몸', '다리', '발'];
// 갑옷이 막지 못하는 피해
const ARMOR_BYPASS = new Set(['fall', 'drown', 'starve', 'void']);

// ---------------- 텍스처 ----------------
function buildSurvivalTextures() {
  const oreBase = (name, base, col, n) => addTex(name, p => {
    p.copy(base);
    for (let k = 0; k < n; k++) {
      const cx = 2 + p.r() * 12 | 0, cy = 2 + p.r() * 12 | 0;
      p.set(cx, cy, col); p.set(cx + 1, cy, p.vary(col, 20)); p.set(cx, cy + 1, p.vary(col, 20));
      if (p.r() < 0.5) p.set(cx + 1, cy + 1, [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7]);
    }
  });
  oreBase('copper_ore', 'stone', [226, 124, 82], 7);
  oreBase('lapis_ore', 'stone', [40, 80, 200], 7);
  oreBase('emerald_ore', 'stone', [60, 220, 110], 4);
  addTex('copper_block', p => { p.noise([220, 128, 88], 10); p.border([180, 95, 60]); p.rect(3, 3, 2, 2, [245, 170, 130]); });
  addTex('emerald_block', p => { p.noise([70, 215, 120], 10); p.border([40, 160, 80]); p.rect(4, 4, 8, 8, [110, 240, 150]); p.rect(5, 5, 6, 6, [70, 215, 120]); });
  addTex('deepslate', p => { p.noise([80, 80, 88], 8); for (let y = 1; y < 16; y += 4) p.rect(0, y, 16, 1, [64, 64, 72]); });
  addTex('cobbled_deepslate', p => { p.noise([74, 74, 82], 12); p.blobs(7, [98, 98, 106], 8, 0.7, 1.6); p.blobs(5, [52, 52, 60], 6, 0.6, 1.1); });
  const it = (name, fn) => addTex(name, q => { q.clear(); fn(q); q.outline(); }, true);
  const raw = (name, c, hi) => it(name, p => { p.disc(8, 9, 4.6, c, 14); p.disc(10, 6.5, 2.8, c, 14); p.set(6, 7, hi); p.set(9, 5, hi); p.set(7, 11, [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7]); });
  raw('raw_iron', [210, 170, 140], [245, 215, 190]); raw('raw_gold', [245, 205, 60], [255, 245, 170]); raw('raw_copper', [220, 125, 85], [250, 180, 140]);
  it('copper_ingot', p => { for (let y = 6; y < 11; y++) for (let x = 2 + (10 - y); x < 14 - (y - 6) / 2; x++) p.set(x, y, [225, 125, 80]); for (let x = 7; x < 13; x++) p.set(x, 6, [250, 185, 150]); });
  it('lapis_lazuli', p => { p.disc(8, 8, 5, [45, 85, 210], 18); p.set(6, 6, [130, 170, 255]); p.set(10, 10, [25, 50, 150]); });
  it('emerald', p => { p.art(['.......a........', '......abb.......', '.....abccb......', '....abccccb.....', '....bccddcb.....', '....bccddcb.....', '....bccccbb.....', '.....bccbb......', '......bbb.......'], { a: [200, 255, 215], b: [60, 200, 110], c: [90, 230, 140], d: [170, 255, 200] }); });
  it('flint', p => { p.disc(8, 9, 4.8, [70, 70, 78], 10); p.disc(7, 6, 2.5, [70, 70, 78], 10); p.set(6, 6, [150, 150, 160]); p.set(9, 9, [40, 40, 46]); });
  it('leather', p => { p.rect(4, 4, 8, 9, [160, 100, 60]); p.rect(3, 5, 1, 7, [160, 100, 60]); p.rect(12, 5, 1, 7, [160, 100, 60]); p.rect(5, 5, 3, 2, [195, 135, 90]); });
  it('bone_meal', p => { p.disc(8, 10, 4.2, [245, 245, 235], 8); p.disc(6, 7, 2, [250, 250, 245], 6); p.disc(10.5, 7, 1.8, [235, 235, 225], 6); });
  it('shears', p => { p.line(4, 12, 11, 4, [210, 210, 220], 1); p.line(4, 4, 11, 12, [190, 190, 200], 1); p.disc(4, 12.5, 1.8, [230, 90, 100]); p.disc(4, 3.5, 1.8, [230, 90, 100]); });
  it('golden_apple', p => { p.disc(8, 9.5, 5, [250, 205, 60], 10); p.set(6, 7, [255, 250, 180]); p.line(8, 5, 9, 2, [120, 80, 30]); p.rect(10, 3, 2, 2, [80, 200, 90]); });
  // 갑옷 아이콘
  const piece = [
    p => { p.rect(3, 4, 10, 3, 0); p.rect(3, 7, 2, 4, 0); p.rect(11, 7, 2, 4, 0); },
    p => { p.rect(2, 3, 4, 3, 0); p.rect(10, 3, 4, 3, 0); p.rect(4, 5, 8, 9, 0); p.rect(6, 3, 4, 1, 0); },
    p => { p.rect(4, 3, 8, 3, 0); p.rect(4, 6, 3, 8, 0); p.rect(9, 6, 3, 8, 0); },
    p => { p.rect(3, 8, 3, 5, 0); p.rect(10, 8, 3, 5, 0); p.rect(2, 12, 4, 2, 0); p.rect(10, 12, 4, 2, 0); },
  ];
  for (const m of ARMOR_MATS) for (let pi = 0; pi < 4; pi++) {
    const c = m.col.map(v => v * 255), d = c.map(v => v * 0.75), hi = c.map(v => Math.min(255, v + 45));
    it(m.n + '_' + ARMOR_PIECES[pi][0], p => {
      const q = { rect: (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) p.set(i, j, (i + j) % 5 === 0 ? d : c); } };
      piece[pi](q);
      p.set(4, pi === 3 ? 9 : 5, hi); p.set(5, pi === 3 ? 9 : 5, hi);
    });
  }
}

// ---------------- 블록 ----------------
function defineSurvivalBlocks() {
  const b = defBlock;
  b(161, 'copper_ore', '구리 광석', { tex: faces('copper_ore'), hard: 3, tool: 'pick', lvl: 2, cat: 'nature', drop: (m, rnd) => [[I('raw_copper'), 2 + (rnd() * 3 | 0)]], desc: '돌 곡괭이 이상으로 캐요. 구리 원석이 나와요.' });
  b(162, 'lapis_ore', '청금석 광석', { tex: faces('lapis_ore'), hard: 3, tool: 'pick', lvl: 2, cat: 'nature', drop: (m, rnd) => [[I('lapis_lazuli'), 4 + (rnd() * 5 | 0)]] });
  b(163, 'emerald_ore', '에메랄드 광석', { tex: faces('emerald_ore'), hard: 3, tool: 'pick', lvl: 3, cat: 'nature', drop: () => [[I('emerald'), 1]], desc: '산에서만 드물게 나와요.' });
  b(164, 'copper_block', '구리 블록', { tex: faces('copper_block'), hard: 3, tool: 'pick', lvl: 2 });
  b(165, 'emerald_block', '에메랄드 블록', { tex: faces('emerald_block'), hard: 5, tool: 'pick', lvl: 3 });
  b(166, 'deepslate', '심층암', { tex: faces('deepslate'), hard: 3, tool: 'pick', lvl: 1, cat: 'nature', drop: 167 });
  b(167, 'cobbled_deepslate', '심층암 조약돌', { tex: faces('cobbled_deepslate'), hard: 3.5, tool: 'pick', lvl: 1 });
  // 원래 블록 드롭 바꾸기 (1.17 이후 마인크래프트처럼 원석)
  BLOCKS[BL.iron_ore].drop = () => [[I('raw_iron'), 1]];
  BLOCKS[BL.gold_ore].drop = () => [[I('raw_gold'), 1]];
  BLOCKS[BL.gravel].drop = (m, rnd) => (rnd() < 0.1 ? [[I('flint'), 1]] : [[BL.gravel, 1]]);
}

// ---------------- 아이템 ----------------
function defineSurvivalItems() {
  const it = defItem;
  it(293, 'raw_iron', '철 원석', { desc: '화로에서 녹이면 철 주괴가 돼요.' });
  it(294, 'raw_gold', '금 원석', { desc: '화로에서 녹이면 금 주괴가 돼요.' });
  it(295, 'raw_copper', '구리 원석', { desc: '화로에서 녹이면 구리 주괴가 돼요.' });
  it(296, 'copper_ingot', '구리 주괴', { desc: '전기가 잘 통하는 금속이에요. 구리 블록을 만들 수 있어요.' });
  it(297, 'lapis_lazuli', '청금석');
  it(298, 'emerald', '에메랄드');
  it(299, 'flint', '부싯돌', { desc: '자갈을 부수면 가끔 나와요.' });
  it(325, 'leather', '가죽', { desc: '소에게서 얻어요. 가죽 갑옷 재료.' });
  it(326, 'bone_meal', '뼛가루', { cat: 'nature', desc: '묘목·밀·잔디에 우클릭하면 쑥쑥 자라요.' });
  it(327, 'shears', '가위', { stack: 1, dur: 238, cat: 'tools', desc: '양에게 쓰면 양털, 나뭇잎을 자르면 나뭇잎 블록이 나와요.' });
  it(328, 'golden_apple', '황금 사과', { food: 4, sat: 9.6, cat: 'food', desc: '먹으면 체력이 4칸 회복돼요.', heal: 8 });
  for (let mi = 0; mi < ARMOR_MATS.length; mi++) for (let pi = 0; pi < 4; pi++) {
    const m = ARMOR_MATS[mi], pc = ARMOR_PIECES[pi];
    it(340 + mi * 4 + pi, m.n + '_' + pc[0], m.k + ' ' + pc[1], {
      stack: 1, cat: 'tools', dur: pc[2] * m.mul, armor: { slot: pi, def: m.def[pi], mat: mi },
      desc: `방어 +${m.def[pi]} · ${ARMOR_SLOT_NAMES[pi]}에 입어요 (우클릭 또는 Shift+클릭)`,
    });
  }
}
function defineSurvivalRecipes() {
  for (const [ing, blk] of [['copper_ingot', 'copper_block'], ['lapis_lazuli', 'lapis_block'], ['emerald', 'emerald_block']]) {
    R(['XXX', 'XXX', 'XXX'], { X: ing }, blk); S([blk], ing, 9);
  }
  S(['iron_ingot', 'flint'], 'flint_and_steel');
  R(['F', 'S', 'E'], { F: 'flint', S: 'stick', E: 'feather' }, 'arrow', 4);
  R([' I', 'I '], { I: 'iron_ingot' }, 'shears');
  S(['bone'], 'bone_meal', 3);
  R(['GGG', 'GAG', 'GGG'], { G: 'gold_ingot', A: 'apple' }, 'golden_apple');
  // 심층암 조약돌도 돌처럼
  R(['CCC', 'C C', 'CCC'], { C: 'cobbled_deepslate' }, 'furnace');
  R(['MMM', ' S ', ' S '], { M: 'cobbled_deepslate', S: 'stick' }, 'stone_pickaxe');
  R(['MM', 'MS', ' S'], { M: 'cobbled_deepslate', S: 'stick' }, 'stone_axe');
  R(['M', 'S', 'S'], { M: 'cobbled_deepslate', S: 'stick' }, 'stone_shovel');
  R(['M', 'M', 'S'], { M: 'cobbled_deepslate', S: 'stick' }, 'stone_sword');
  const pat = [['MMM', 'M M'], ['M M', 'MMM', 'MMM'], ['MMM', 'M M', 'M M'], ['M M', 'M M']];
  for (const m of ARMOR_MATS) for (let pi = 0; pi < 4; pi++) R(pat[pi], { M: m.item }, m.n + '_' + ARMOR_PIECES[pi][0]);
}
function defineSurvivalSmelting() {
  const s = (a, b) => { SMELT[I(a)] = I(b); };
  s('raw_iron', 'iron_ingot'); s('raw_gold', 'gold_ingot'); s('raw_copper', 'copper_ingot');
  s('copper_ore', 'copper_ingot'); s('lapis_ore', 'lapis_lazuli'); s('emerald_ore', 'emerald'); s('cobbled_deepslate', 'deepslate');
  if (typeof MOB_TYPES !== 'undefined' && MOB_TYPES.cow) MOB_TYPES.cow.drops.push(['leather', 0, 2]);
}

// ---------------- 지형: 새 광석과 심층암 (기존 세계 모양은 그대로) ----------------
World.prototype.extraOres = function (c, ids, cols) {
  const rnd = mulberry32(hashInt(c.cx, 91, c.cz, this.seed));
  const vein = (id, cnt, size, y0, y1) => {
    for (let k = 0; k < cnt; k++) {
      let x = rnd() * 16 | 0, y = y0 + (rnd() * (y1 - y0) | 0), z = rnd() * 16 | 0;
      for (let s = 0; s < size; s++) {
        if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < HEIGHT && ids[CI(x, y, z)] === BL.stone) ids[CI(x, y, z)] = id;
        const d = rnd() * 6 | 0; x += DX[d]; y += DY[d]; z += DZ[d];
      }
    }
  };
  vein(BL.copper_ore, 12, 8, 20, 90);
  vein(BL.lapis_ore, 4, 6, 4, 40);
  const bi = cols[8 | 8 << 4].biome;
  if (bi === 5 || bi === 6) vein(BL.emerald_ore, 6, 2, 16, 90);
  // 아주 깊은 곳은 심층암
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const top = 8 + (hashInt(c.cx * 16 + x, 5, c.cz * 16 + z, this.seed) % 4);
    for (let y = 1; y <= top; y++) if (ids[CI(x, y, z)] === BL.stone) ids[CI(x, y, z)] = BL.deepslate;
  }
};

// ---------------- 플레이어: 갑옷, 자동 채우기 ----------------
Player.prototype.armorPoints = function () {
  let d = 0; for (const a of this.armor || []) if (a && ITEMS[a.id] && ITEMS[a.id].armor) d += ITEMS[a.id].armor.def; return d;
};
Player.prototype.armorReduce = function (amount, src) {
  if (!this.armor || ARMOR_BYPASS.has(src)) return amount;
  const def = this.armorPoints(); if (!def) return amount;
  const wear = Math.max(1, Math.floor(amount / 4));
  for (let i = 0; i < 4; i++) {
    const a = this.armor[i]; if (!a) continue;
    const d = ITEMS[a.id]; a.d = (a.d || 0) + wear;
    if (d && a.d >= d.dur) { this.armor[i] = null; if (this.game) { this.game.sfx('break_tool', this.x, this.y + 1, this.z); this.game.ui.toast(`${d.k}이(가) 망가졌어요`); } }
  }
  return amount * (1 - Math.min(20, def) / 25);
};
// 손에 든 아이템이 다 떨어지면 가방에서 같은 것을 채움
Player.prototype.refillSlot = function (slot, id) {
  if (!this.game || this.game.settings.autoRefill === false) return;
  for (let i = 35; i >= 9; i--) { const s = this.inv[i]; if (s && s.id === id) { this.inv[slot] = s; this.inv[i] = null; return true; } }
  return false;
};
{
  const _consume = Player.prototype.consumeHeld;
  Player.prototype.consumeHeld = function (n) {
    const s = this.inv[this.sel], id = s ? s.id : -1;
    _consume.call(this, n);
    if (id >= 0 && !this.inv[this.sel] && this.refillSlot(this.sel, id) && this.game) this.game.ui.refreshHotbar();
  };
  const _dmg = Player.prototype.damageHeld;
  Player.prototype.damageHeld = function (n) {
    const s = this.inv[this.sel], id = s ? s.id : -1;
    _dmg.call(this, n);
    if (id >= 0 && !this.inv[this.sel] && this.refillSlot(this.sel, id) && this.game) { this.game.ui.refreshHotbar(); this.game.ui.toast('🔁 같은 도구로 바꿨어요', 1200); }
  };
}

// ---------------- 게임 기능 ----------------
const Survival = {
  isLog(id) { const d = BLOCKS[id]; return !!(d && d.axis && /_log$/.test(d.name)); },
  isLeaf(id) { const d = BLOCKS[id]; return !!(d && /_leaves$/.test(d.name)); },
  isOre(id) { const d = BLOCKS[id]; return !!(d && /_ore$/.test(d.name)); },
  // 연결된 같은 종류 블록 찾기 (26방향)
  connected(w, x, y, z, test, limit, minY) {
    const out = [], seen = new Set([x + ',' + y + ',' + z]), q = [[x, y, z]];
    while (q.length && out.length < limit) {
      const [cx, cy, cz] = q.shift();
      for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy && !dz) continue;
        const nx = cx + dx, ny = cy + dy, nz = cz + dz;
        if (minY !== undefined && ny < minY) continue;
        const k = nx + ',' + ny + ',' + nz; if (seen.has(k)) continue; seen.add(k);
        if (!test(w.getBlock(nx, ny, nz))) continue;
        out.push([nx, ny, nz]); q.push([nx, ny, nz]);
        if (out.length >= limit) break;
      }
    }
    return out;
  },
  // 부순 뒤: 나무 한 번에 베기 / 광맥 한 번에 캐기
  afterBreak(g, hit, id, meta, tool) {
    const p = g.player, w = g.world, st = g.settings;
    if (p.creative || p.sneaking) return;
    let list = null, kind = '';
    if (st.treeFell !== false && this.isLog(id)) {
      const logs = this.connected(w, hit.x, hit.y, hit.z, this.isLog, 160, hit.y);
      if (!logs.length) return;
      // 자연 나무인지 확인: 자연 나뭇잎이 여러 개 붙어 있어야 함 (집 기둥은 베지 않음)
      let leaves = 0;
      for (const [x, y, z] of logs.concat([[hit.x, hit.y, hit.z]])) {
        for (let d = 0; d < 6 && leaves < 6; d++) { const nid = w.getBlock(x + DX[d], y + DY[d], z + DZ[d]); if (this.isLeaf(nid) && !(w.getMeta(x + DX[d], y + DY[d], z + DZ[d]) & 1)) leaves++; }
        if (leaves >= 6) break;
      }
      if (leaves < 4) return;
      list = logs; kind = 'tree';
    } else if (st.veinMine !== false && tool && tool.kind === 'pick' && this.isOre(id) && tool.tier >= (BLOCKS[id].lvl || 0)) {
      list = this.connected(w, hit.x, hit.y, hit.z, (n) => n === id, 48); kind = 'ore';
    }
    if (!list || !list.length) return;
    list.sort((a, b) => a[1] - b[1]);
    let n = 0;
    for (const [x, y, z] of list) {
      const held = p.held, t2 = held && ITEMS[held.id] && ITEMS[held.id].tool;
      if (kind === 'ore' && (!t2 || t2.kind !== tool.kind)) break; // 곡괭이가 부서지면 멈춤
      const bid = w.getBlock(x, y, z), bm = w.getMeta(x, y, z);
      for (const [iid, c] of g.blockDrops(bid, bm, t2)) if (c > 0) g.dropItem(hit.x + 0.5, hit.y + 0.4, hit.z + 0.5, { id: iid, n: c });
      if (n % 3 === 0) g.particles.blockBreak(x, y, z, bid, bm);
      g.setBlockNet(x, y, z, 0, 0);
      if (t2 && (kind === 'ore' || t2.kind === 'axe')) p.damageHeld(1);
      p.exhaust += 0.02; n++;
    }
    if (n) {
      g.sound.play('break', hit.x + 0.5, hit.y + 1.5, hit.z + 0.5, { mat: BLOCKS[id].sound });
      if (!g._fellTip) { g._fellTip = true; g.ui.toast(kind === 'tree' ? '🪓 밑동만 베어도 나무 전체가 베어져요! (Shift를 누른 채 베면 한 칸만)' : '⛏ 이어진 광석을 한 번에 캤어요! (Shift를 누른 채 캐면 한 칸만)', 3200); }
    }
  },
  // 원목이 없어지면 주변 자연 나뭇잎을 빨리 떨어뜨림 (방장/혼자일 때)
  onBlockChange(g, x, y, z, oid, id) {
    if (!this.isLog(oid) || id || g.world.remote) return;
    const w = g.world;
    const q = g._decayQ || (g._decayQ = []);
    for (let dy = -3; dy <= 5; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const lx = x + dx, ly = y + dy, lz = z + dz;
      if (this.isLeaf(w.getBlock(lx, ly, lz)) && !(w.getMeta(lx, ly, lz) & 1)) q.push([lx, ly, lz, performance.now() + 250 + Math.random() * 2200]);
    }
    if (q.length > 4000) q.splice(0, q.length - 4000);
  },
  update(g, dt) {
    const q = g._decayQ; if (!q || !q.length || !g.world || g.world.remote) return;
    const now = performance.now(), w = g.world;
    for (let i = q.length - 1, done = 0; i >= 0 && done < 40; i--) {
      const e = q[i]; if (e[3] > now) continue;
      q[i] = q[q.length - 1]; q.pop(); done++;   // (최적화) splice 대신 맨 끝과 바꿔 지우기
      const [x, y, z] = e, lid = w.getBlock(x, y, z);
      if (!this.isLeaf(lid) || (w.getMeta(x, y, z) & 1) || w.logNear(x, y, z, 4)) continue;
      w.setBlock(x, y, z, 0, 0);
      g.dropBlockItems(x, y, z, lid, 0);
      if (Math.random() < 0.3) g.particles.blockBreak(x, y, z, lid, 0);
    }
  },
  // 우클릭 동작. true면 처리 끝
  use(g, hit, hd, held) {
    const p = g.player, w = g.world;
    // 갑옷 입기
    if (hd && hd.armor) {
      const s = hd.armor.slot, old = p.armor[s];
      p.armor[s] = held; p.inv[p.sel] = old || null;
      g.sound.play('pop'); g.ui.refreshHotbar(); g.ui.toast(`🛡 ${hd.k}을(를) 입었어요 (방어 ${p.armorPoints()})`, 1500);
      return true;
    }
    if (!hit) return false;
    // 다 자란 밀 우클릭 수확 + 다시 심기
    if (hit.id === BL.wheat && (hit.meta & 7) === 7 && !p.sneaking) {
      g.dropItem(hit.x + 0.5, hit.y + 0.3, hit.z + 0.5, { id: IT.wheat, n: 1 });
      const sd = Math.random() * 3 | 0; if (sd) g.dropItem(hit.x + 0.5, hit.y + 0.3, hit.z + 0.5, { id: I('seeds'), n: sd });
      g.setBlockNet(hit.x, hit.y, hit.z, BL.wheat, 0);
      g.sound.play('break', hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, { mat: 'grass' }); g.swing = 1;
      return true;
    }
    // 뼛가루
    if (hd && hd.name === 'bone_meal') {
      if (w.remote) g.net.send({ t: 'use', x: hit.x, y: hit.y, z: hit.z, bonemeal: 1 });
      if (w.remote || this.boneMeal(g, hit.x, hit.y, hit.z)) { p.consumeHeld(1); g.swing = 1; g.particles.dust(hit.x + 0.5, hit.y + 0.8, hit.z + 0.5, [0.5, 0.9, 0.4]); }
      return true;
    }
    return false;
  },
  boneMeal(g, x, y, z) {
    const w = g.world, id = w.getBlock(x, y, z);
    if (id === BL.sapling) {
      if (Math.random() < 0.55) { w.setBlock(x, y, z, 0, 0); if (!w.growTree(x, y, z)) w.setBlock(x, y, z, BL.sapling, 0); }
      return true;
    }
    if (id === BL.wheat) { const m = w.getMeta(x, y, z) & 7; if (m >= 7) return false; w.setBlock(x, y, z, BL.wheat, Math.min(7, m + 2 + (Math.random() * 3 | 0))); return true; }
    if (id === BL.grass) {
      for (let k = 0; k < 14; k++) {
        const gx = x + Math.round((Math.random() - 0.5) * 6), gz = z + Math.round((Math.random() - 0.5) * 6);
        for (let gy = y + 2; gy >= y - 2; gy--) {
          if (w.getBlock(gx, gy, gz) === BL.grass && !w.getBlock(gx, gy + 1, gz)) { const r = Math.random(); w.setBlock(gx, gy + 1, gz, r < 0.75 ? BL.tallgrass : r < 0.88 ? BL.dandelion : r < 0.96 ? BL.poppy : BL.blue_orchid, 0); break; }
        }
      }
      return true;
    }
    return false;
  },
  // 가위: 양털 깎기
  shear(g, e) {
    if (!e || e.sub !== 'sheep' || e.sheared) return false;
    e.sheared = true; e.woolT = 60 + Math.random() * 60;
    g.dropItem(e.x, e.y + 1, e.z, { id: BL.wool_white, n: 1 + (Math.random() * 3 | 0) });
    g.sound.play('break', e.x, e.y + 1, e.z, { mat: 'wool' });
    return true;
  },
  // 가위로 자르면 나뭇잎/풀 그대로
  shearDrops(id) { return this.isLeaf(id) || id === BL.tallgrass ? [[id, 1]] : null; },
  // 인벤토리 정리 (가방 칸 9~35)
  sortInv(p) {
    const items = [];
    for (let i = 9; i < 36; i++) if (p.inv[i]) { items.push(p.inv[i]); p.inv[i] = null; }
    const merged = [];
    for (const it of items) {
      const max = itemMaxStack(it.id);
      if (max > 1 && !it.d) { for (const m of merged) if (m.id === it.id && !m.d && m.n < max) { const t = Math.min(it.n, max - m.n); m.n += t; it.n -= t; if (!it.n) break; } }
      if (it.n) merged.push(it);
    }
    const catOrder = { tools: 0, food: 1, build: 2, nature: 3, color: 4, redstone: 5, items: 7 };
    merged.sort((a, b) => { const da = ITEMS[a.id] || {}, db = ITEMS[b.id] || {}; return ((catOrder[da.cat] ?? 8) - (catOrder[db.cat] ?? 8)) || a.id - b.id || b.n - a.n; });
    merged.forEach((it, i) => p.inv[9 + i] = it);
  },
};

// ---------------- 갑옷 그리기 ----------------
function renderArmorModel(eb, M, armorIds, L, hurt) {
  if (!armorIds || !M) return;
  const P = 1 / 16;
  const tint = (c) => hurt ? [Math.min(1, c[0] * 1.2 + 0.4), c[1] * 0.5, c[2] * 0.5] : c;
  const box = (m, x0, y0, z0, x1, y1, z1, c) => eb.addBox(m, x0 * P, y0 * P, z0 * P, x1 * P, y1 * P, z1 * P, tint(c), L[0], L[1]);
  const colOf = (id) => { const d = ITEMS[id]; return d && d.armor ? ARMOR_MATS[d.armor.mat].col : null; };
  const dk = (c) => [c[0] * 0.82, c[1] * 0.82, c[2] * 0.82];
  let c = colOf(armorIds[0]);
  if (c) { // 투구: 얼굴은 보이게
    const h = M.head;
    box(h, -4.8, 8, -4.8, 4.8, 8.8, 4.8, c); box(h, -4.8, 1.2, 4, 4.8, 8.8, 4.8, dk(c));
    box(h, -4.8, 2.5, -4.8, -4, 8.8, 4.8, c); box(h, 4, 2.5, -4.8, 4.8, 8.8, 4.8, c); box(h, -4.8, 6.6, -4.8, 4.8, 8.8, -4, c);
  }
  c = colOf(armorIds[1]);
  if (c) { box(M.body, -4.7, 13, -2.7, 4.7, 24.6, 2.7, c); for (const a of ['rarm', 'larm']) box(M[a], -2.4, -3, -2.6, 2.4, 2.6, 2.6, dk(c)); }
  c = colOf(armorIds[2]);
  if (c) { box(M.body, -4.6, 11.8, -2.6, 4.6, 14.2, 2.6, dk(c)); for (const l of ['rleg', 'lleg']) box(M[l], -2.5, -8.5, -2.5, 2.5, 0.2, 2.5, c); }
  c = colOf(armorIds[3]);
  if (c) for (const l of ['rleg', 'lleg']) { box(M[l], -2.6, -12.4, -2.6, 2.6, -8.6, 2.6, c); box(M[l], -2.7, -12.4, -3.1, 2.7, -11, -2.5, dk(c)); }
}

// ---------------- 미니맵 ----------------
const MINIMAP_COL = {};
function minimapColor(id) {
  if (MINIMAP_COL[id]) return MINIMAP_COL[id];
  const d = BLOCKS[id]; let c = [150, 150, 150];
  const special = { grass: [118, 196, 102], grass_snow: [236, 244, 250], water: [96, 170, 236], lava: [255, 140, 40], sand: [236, 222, 170], oak_leaves: [84, 164, 80], birch_leaves: [120, 186, 96], spruce_leaves: [66, 128, 90], tallgrass: [118, 196, 102] };
  if (d && special[d.name]) c = special[d.name];
  else if (d && d.tex) {
    const layer = Array.isArray(d.tex) ? d.tex[1] : null, px = layer !== null ? TEX.list[layer] : null;
    if (px) { let r = 0, g2 = 0, b = 0, n = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 20) { r += px[i]; g2 += px[i + 1]; b += px[i + 2]; n++; } if (n) c = [r / n, g2 / n, b / n]; }
  }
  return (MINIMAP_COL[id] = c);
}
class Minimap {
  constructor(g) {
    this.g = g; this.t = 0; this.big = false;
    const wrap = document.createElement('div'); wrap.id = 'minimap';
    wrap.innerHTML = '<canvas width="64" height="64"></canvas><div class="mm-arrow"></div><div class="mm-pos"></div>';
    document.getElementById('hud').appendChild(wrap);
    this.el = wrap; this.cv = wrap.firstChild; this.ctx = this.cv.getContext('2d');
    this.img = this.ctx.createImageData(64, 64);
    wrap.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.big = !this.big; this.el.classList.toggle('big', this.big); this.redraw(); });
  }
  update(dt) {
    const g = this.g, on = g.settings.minimap !== false && g.state === 'play' && !g.settings.hideHud;
    this.el.style.display = on ? '' : 'none';
    if (!on) return;
    const p = g.player;
    this.el.querySelector('.mm-arrow').style.transform = `translate(-50%,-50%) rotate(${-p.yaw}rad)`;
    const pos = `X ${Math.floor(p.x)} · Y ${Math.floor(p.y)} · Z ${Math.floor(p.z)}`;
    const pe = this.el.querySelector('.mm-pos'); if (pe.textContent !== pos) pe.textContent = pos;
    this.t -= dt; if (this.t > 0) return;
    this.t = 0.5; this.redraw();
  }
  redraw() {
    const g = this.g, w = g.world, p = g.player; if (!w) return;
    const R = this.big ? 64 : 32, N = 64, sc = (R * 2) / N;
    const px0 = Math.floor(p.x), pz0 = Math.floor(p.z), d = this.img.data;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = px0 + Math.floor((i - N / 2) * sc), z = pz0 + Math.floor((j - N / 2) * sc);
      const o = (j * N + i) * 4;
      if (!w.isLoadedAt(x, z)) { d[o] = 214; d[o + 1] = 204; d[o + 2] = 232; d[o + 3] = 255; continue; }
      let h = w.heightAt(x, z), id = w.getBlock(x, h, z);
      for (let k = 0; k < 4 && !id; k++) { h--; id = w.getBlock(x, h, z); }
      const c = minimapColor(id);
      const hw = w.heightAt(x - Math.max(1, sc | 0), z);
      const shade = h > hw ? 1.12 : h < hw ? 0.86 : 1;
      d[o] = Math.min(255, c[0] * shade); d[o + 1] = Math.min(255, c[1] * shade); d[o + 2] = Math.min(255, c[2] * shade); d[o + 3] = 255;
    }
    // 다른 플레이어
    for (const r of g.remotes.values()) {
      const i = Math.round((r.x - p.x) / sc + N / 2), j = Math.round((r.z - p.z) / sc + N / 2);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; const o = (jj * N + ii) * 4; d[o] = 255; d[o + 1] = 90; d[o + 2] = 150; }
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}

// 화로 제작법 (도감용)
let SMELT_RECIPES = null;
function smeltRecipes() {
  if (!SMELT_RECIPES) SMELT_RECIPES = Object.keys(SMELT).map(k => ({ smelt: true, input: +k, resultId: SMELT[k], count: 1 })).filter(r => ITEMS[r.input] && ITEMS[r.resultId]);
  return SMELT_RECIPES;
}
