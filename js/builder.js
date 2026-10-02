'use strict';
// =====================================================================
// 블록 코딩 + 빌더봇: 끌어다 놓는 코딩으로 건물/회로를 짓는다
// =====================================================================
const BUILD_BLOCK_CHOICES = (only) => {
  const groups = { '건축': [], '색깔': [], '자연': [], '전기 회로': [] };
  for (const d of BLOCKS) {
    if (!d || !d.item || d.id === 0) continue;
    if (only && !only.has(d.id)) continue;
    const c = d.cat === 'color' ? '색깔' : d.cat === 'nature' ? '자연' : d.cat === 'redstone' ? '전기 회로' : d.cat === 'tools' ? '건축' : '건축';
    groups[c].push([d.name, d.k]);
  }
  groups['건축'].unshift(['air', '공기(지우기)']);
  if (!only || only.has(I('redstone'))) groups['전기 회로'].unshift(['redstone_wire', '레드스톤 가루(전선)']);
  for (const k in groups) if (!groups[k].length) delete groups[k];
  return groups;
};
// ---------------- 서바이벌: 코딩 블록 열기 ----------------
// 서바이벌에서는 코딩 블록마다 정해진 「열쇠 재료」를 처음 손에 넣으면 그 블록을 쓸 수 있다.
// (크리에이티브는 처음부터 전부 열림) [재료 이름들, 화면에 보일 이름]
const CODE_KEYS = {
  left: [['#planks'], '판자'], right: [['#planks'], '판자'],
  turnB: [['crafting_table'], '제작대'], home: [['crafting_table'], '제작대'],
  up: [['ladder'], '사다리'], down: [['ladder'], '사다리'],
  placeDir: [['stick'], '막대기'], dig: [['#pickaxe'], '곡괭이'], pen: [['torch'], '횃불'],
  wall: [['cobblestone'], '조약돌'], floor: [['sand'], '모래'], clear: [['#shovel'], '삽'],
  box: [['chest'], '상자'], stair: [['#stairs'], '계단'], house: [['oak_door'], '나무 문'],
  sphere: [['glass'], '유리'], cyl: [['furnace'], '화로'], pyramid: [['sandstone'], '사암'], tower: [['stone_bricks'], '석재 벽돌'],
  setcolor: [['#wool'], '양털'],
  repeat: [['#coal'], '석탄(또는 숯)'], for: [['iron_ingot'], '철 주괴'], wait: [['bread'], '빵'],
  set: [['book'], '책'], change: [['book'], '책'], goto: [['bed'], '침대'],
  rsLine: [['redstone'], '레드스톤 가루'], rsPlace: [['redstone_torch'], '레드스톤 횃불'], rsEx: [['repeater'], '레드스톤 중계기'],
};
const _codeKeyIds = {};
function codeKeyIds(t) {
  if (_codeKeyIds[t]) return _codeKeyIds[t];
  const k = CODE_KEYS[t]; const out = new Set();
  if (k) for (const n of k[0]) {
    if (n === '#pickaxe' || n === '#shovel') { const kind = n === '#pickaxe' ? 'pick' : 'shovel'; for (const d of ITEMS) if (d && d.tool && d.tool.kind === kind) out.add(d.id); }
    else if (n === '#stairs') { for (const d of BLOCKS) if (d && d.shape === 'stairs' && d.item) out.add(d.id); }
    else if (n[0] === '#') for (const id of GROUPS[n.slice(1)] || []) out.add(id);
    else out.add(I(n));
  }
  return (_codeKeyIds[t] = out);
}
function codeName(t) { return CODE_DEFS[t].text.replace(/#\w+/g, '□').replace(/\s+/g, ' ').trim(); }
// 빌더봇이 블록을 놓을 때 가방에서 꺼낼 아이템 (null = 재료 필요 없음)
function botItemFor(id, meta) {
  if (!id) return null;
  if (id === BL.redstone_wire) return I('redstone');
  if (id === BL.wheat) return I('seeds');
  const d = BLOCKS[id];
  if (d && d.shape === 'door' && (meta & 16)) return null;
  return ITEMS[id] ? id : null;
}
const BOT_DECOR = () => new Set([BL.glass, BL.torch, BL.oak_door, BL.oak_log, BL.spruce_planks, BL.cobblestone]);
const DIR_CHOICES = [['f', '앞'], ['b', '뒤'], ['l', '왼쪽'], ['r', '오른쪽'], ['u', '위'], ['d', '아래']];
const HDIR_CHOICES = [['f', '앞'], ['b', '뒤'], ['l', '왼쪽'], ['r', '오른쪽']];
const FILL_CHOICES = [['hollow', '속 빈'], ['solid', '꽉 찬']];
const RS_PARTS = [['lever', '레버'], ['stone_button', '버튼'], ['redstone_torch', '레드스톤 횃불'], ['redstone_wire', '전선'], ['repeater', '중계기'], ['comparator', '비교기'], ['redstone_lamp', '램프'], ['color_lamp', '색깔 램프'], ['number_display', '숫자 표시기'], ['piston', '피스톤'], ['sticky_piston', '끈끈이 피스톤'], ['observer', '관측기'], ['note_block', '소리 블록'], ['gate_and', 'AND 게이트'], ['gate_or', 'OR 게이트'], ['gate_xor', 'XOR 게이트'], ['gate_not', 'NOT 게이트'], ['clock_block', '클럭 블록'], ['redstone_block', '레드스톤 블록'], ['tnt', 'TNT'], ['iron_door', '철 문'], ['stone_pressure_plate', '압력판'], ['player_sensor', '플레이어 감지기'], ['daylight_sensor', '햇빛 감지기'], ['fan', '선풍기'], ['dispenser', '발사기']];
const RS_EXAMPLES = [['lamp', '기본 램프 회로'], ['strength', '신호 세기 실험'], ['gates', '논리 게이트 체험장'], ['door', '자동문'], ['clock', '깜빡이(클럭)'], ['piston', '피스톤 기본'], ['street', '밤에 켜지는 가로등'], ['repeater', '중계기로 멀리 보내기']];

// 코드 블록 정의: t, cat, text (#n 입력칸), args 기본값, c(내부 목록)
const CODE_DEFS = {
  fwd: { cat: 'move', text: '앞으로 #n 칸 이동', a: { n: '1' } },
  back: { cat: 'move', text: '뒤로 #n 칸 이동', a: { n: '1' } },
  up: { cat: 'move', text: '위로 #n 칸 이동', a: { n: '1' } },
  down: { cat: 'move', text: '아래로 #n 칸 이동', a: { n: '1' } },
  left: { cat: 'move', text: '왼쪽으로 #n 칸 이동', a: { n: '1' } },
  right: { cat: 'move', text: '오른쪽으로 #n 칸 이동', a: { n: '1' } },
  turnL: { cat: 'move', text: '↺ 왼쪽으로 돌기', a: {} },
  turnR: { cat: 'move', text: '↻ 오른쪽으로 돌기', a: {} },
  turnB: { cat: 'move', text: '⟲ 뒤로 돌기', a: {} },
  home: { cat: 'move', text: '처음 자리로 돌아가기', a: {} },
  goto: { cat: 'move', text: '시작점 기준 오른쪽 #x 위 #y 앞 #z 으로 이동', a: { x: '0', y: '0', z: '0' } },
  setblk: { cat: 'build', text: '블록 고르기 #b', a: { b: 'stone_bricks' } },
  setcolor: { cat: 'build', text: '#k 색 번호 #n 고르기', a: { k: 'wool', n: 'i' } },
  place: { cat: 'build', text: '지금 자리에 블록 놓기', a: {} },
  placeDir: { cat: 'build', text: '#d 쪽에 블록 놓기', a: { d: 'd' } },
  dig: { cat: 'build', text: '지금 자리 블록 부수기', a: {} },
  pen: { cat: 'build', text: '지나간 자리에 블록 놓기 #on', a: { on: '1' } },
  wall: { cat: 'shape', text: '벽 쌓기 · 길이 #w 높이 #h', a: { w: '5', h: '3' } },
  floor: { cat: 'shape', text: '바닥 깔기 · 앞 #d 오른쪽 #w', a: { d: '5', w: '5' } },
  box: { cat: 'shape', text: '상자 · 앞 #d 오른쪽 #w 높이 #h #fill', a: { d: '5', w: '5', h: '4', fill: 'hollow' } },
  sphere: { cat: 'shape', text: '구 · 반지름 #r #fill', a: { r: '4', fill: 'hollow' } },
  cyl: { cat: 'shape', text: '원기둥 · 반지름 #r 높이 #h #fill', a: { r: '3', h: '5', fill: 'hollow' } },
  pyramid: { cat: 'shape', text: '피라미드 · 크기 #s', a: { s: '7' } },
  house: { cat: 'shape', text: '집 짓기 · 앞 #d 오른쪽 #w 높이 #h', a: { d: '7', w: '7', h: '4' } },
  tower: { cat: 'shape', text: '탑 짓기 · 반지름 #r 높이 #h', a: { r: '3', h: '12' } },
  stair: { cat: 'shape', text: '계단 · #n 칸 폭 #w', a: { n: '5', w: '3' } },
  clear: { cat: 'shape', text: '공간 비우기 · 앞 #d 오른쪽 #w 높이 #h', a: { d: '5', w: '5', h: '5' } },
  repeat: { cat: 'ctrl', text: '#n 번 반복하기', a: { n: '4' }, c: true },
  for: { cat: 'ctrl', text: '#v 를 #a 부터 #b 까지 바꾸며 반복', a: { v: 'i', a: '1', b: '5' }, c: true },
  wait: { cat: 'ctrl', text: '#s 초 기다리기', a: { s: '1' } },
  set: { cat: 'var', text: '#v 를 #x 로 정하기', a: { v: 'x', x: '0' } },
  change: { cat: 'var', text: '#v 를 #x 만큼 바꾸기', a: { v: 'x', x: '1' } },
  say: { cat: 'var', text: '말하기 #s', a: { s: '안녕!' } },
  rsLine: { cat: 'rs', text: '전선 #n 칸 깔며 앞으로', a: { n: '5' } },
  rsPlace: { cat: 'rs', text: '#p 놓기 · 방향 #d', a: { p: 'lever', d: 'f' } },
  rsEx: { cat: 'rs', text: '회로 예제 짓기 #e', a: { e: 'lamp' } },
};
const CAT_NAMES = { move: '이동', build: '건축', shape: '도형', ctrl: '반복·제어', var: '변수·말하기', rs: '⚡ 레드스톤 회로' };
const SAMPLE_PROGRAMS = {
  '작은 집': [{ t: 'setblk', a: { b: 'oak_planks' } }, { t: 'house', a: { d: '7', w: '7', h: '4' } }],
  '피라미드': [{ t: 'setblk', a: { b: 'sandstone' } }, { t: 'pyramid', a: { s: '11' } }],
  '유리 돔': [{ t: 'up', a: { n: '1' } }, { t: 'setblk', a: { b: 'glass' } }, { t: 'fwd', a: { n: '7' } }, { t: 'sphere', a: { r: '6', fill: 'hollow' } }],
  '나선 계단 탑': [{ t: 'setblk', a: { b: 'stone_bricks' } }, { t: 'repeat', a: { n: '6' }, c: [{ t: 'repeat', a: { n: '4' }, c: [{ t: 'place', a: {} }, { t: 'fwd', a: { n: '1' } }, { t: 'up', a: { n: '1' } }] }, { t: 'turnR', a: {} }] }],
  '무지개 다리': [{ t: 'for', a: { v: 'i', a: '0', b: '6' }, c: [{ t: 'setcolor', a: { k: 'wool', n: '[14,1,4,5,3,11,10][i]' } }, { t: 'floor', a: { d: '12', w: '1' } }, { t: 'right', a: { n: '1' } }] }],
  '성벽': [{ t: 'setblk', a: { b: 'cobblestone' } }, { t: 'repeat', a: { n: '4' }, c: [{ t: 'wall', a: { w: '10', h: '4' } }, { t: 'fwd', a: { n: '9' } }, { t: 'turnR', a: {} }] }],
  '색깔 기둥 숲': [{ t: 'for', a: { v: 'i', a: '0', b: '15' }, c: [{ t: 'setcolor', a: { k: 'concrete', n: 'i' } }, { t: 'repeat', a: { n: 'i/2+2' }, c: [{ t: 'place', a: {} }, { t: 'up', a: { n: '1' } }] }, { t: 'down', a: { n: 'i/2+2' } }, { t: 'fwd', a: { n: '2' } }] }],
  '⚡ 논리 게이트 체험장': [{ t: 'rsEx', a: { e: 'gates' } }],
  '⚡ 신호 세기 실험': [{ t: 'rsEx', a: { e: 'strength' } }],
  '⚡ 자동문': [{ t: 'rsEx', a: { e: 'door' } }],
  '⚡ 깜빡이': [{ t: 'rsEx', a: { e: 'clock' } }],
  '⚡ 직접 만드는 램프 회로': [{ t: 'rsPlace', a: { p: 'lever', d: 'f' } }, { t: 'fwd', a: { n: '1' } }, { t: 'rsLine', a: { n: '6' } }, { t: 'rsPlace', a: { p: 'redstone_lamp', d: 'f' } }, { t: 'say', a: { s: '레버를 켜 보세요!' } }],
};

class Builder {
  constructor(g) {
    this.g = g;
    this.program = [];
    try { const s = localStorage.getItem('educraft.program'); if (s) this.program = JSON.parse(s); } catch (e) { }
    if (!this.program.length) this.program = JSON.parse(JSON.stringify(SAMPLE_PROGRAMS['작은 집']));
    this.speed = 20; this.running = false; this.gen = null; this.visible = false;
    this.bx = 0; this.by = 0; this.bz = 0; this.facing = 2; this.undo = null; this.anim = 0;
    this.drag = null;
  }
  reset() { this.running = false; this.gen = null; this.visible = false; this.undo = null; this.scanInit = false; this.scanT = 0; this.updateStatus(); }
  survival() { const p = this.g.player; return !!(p && !p.creative); }
  isOpen(t) {
    if (!this.survival() || !CODE_KEYS[t]) return true;
    const f = this.g.found; if (!f) return true;
    for (const id of codeKeyIds(t)) if (f.has(id)) return true;
    return false;
  }
  lockedIn(list, out) {
    out = out || new Set();
    for (const n of list || []) { if (CODE_DEFS[n.t] && !this.isOpen(n.t)) out.add(n.t); if (n.c) this.lockedIn(n.c, out); }
    return out;
  }
  // 가방을 살펴 처음 얻은 재료를 기록하고, 새로 열린 코딩 블록을 알려 줌 (0.5초마다)
  scanFound(dt) {
    const g = this.g, p = g.player; if (!p || !g.found) return;
    this.scanT -= dt; if (this.scanT > 0) return;
    this.scanT = 0.5;
    const before = this.scanInit ? Object.keys(CODE_KEYS).filter(t => this.isOpen(t)) : null;
    let added = false;
    const see = (s) => { if (s && !g.found.has(s.id)) { g.found.add(s.id); added = true; } };
    for (const s of p.inv) see(s);
    for (const s of p.armor || []) see(s);
    see(g.ui.cursor);
    if (!this.scanInit) { this.scanInit = true; return; }
    if (!added || p.creative) return;
    const fresh = Object.keys(CODE_KEYS).filter(t => this.isOpen(t) && !before.includes(t));
    if (!fresh.length) return;
    const byKey = new Map();
    for (const t of fresh) { const k = CODE_KEYS[t][1]; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push('「' + codeName(t) + '」'); }
    for (const [k, list] of byKey) g.ui.chatLine(`🔓 ${k}을(를) 처음 얻어서 새 코딩 블록이 열렸어요: ${list.join(', ')}`, '#ffe27a');
    g.ui.toast(`🔓 새 코딩 블록 ${fresh.length}개가 열렸어요! (B 키)`, 3200);
    g.sound.play('levelup');
    if (g.ui.modal === 'code') this.renderPalette();
  }
  close() { this.reset(); }
  saveProgram() { try { localStorage.setItem('educraft.program', JSON.stringify(this.program)); } catch (e) { } }
  savedPrograms() { try { return JSON.parse(localStorage.getItem('educraft.programs') || '{}'); } catch (e) { return {}; } }
  // ================= 편집기 =================
  openEditor() {
    const g = this.g;
    const s = g.ui.screen('code-screen', `
      <div class="code-wrap">
        <div class="code-top">
          <span class="title">🤖 빌더봇 블록 코딩</span>
          <select id="cd-sample" class="btn small"><option value="">📚 예제 불러오기</option></select>
          <select id="cd-saved" class="btn small"><option value="">💾 내 코드</option></select>
          <button class="btn small" id="cd-save">저장</button>
          <button class="btn small" id="cd-new">새로</button>
          <button class="btn small" id="cd-io">내보내기/가져오기</button>
          <span style="flex:1"></span>
          <button class="btn small" id="cd-close">✕ 닫기</button>
        </div>
        <div class="code-body">
          <div class="code-palette" id="cd-pal"></div>
          <div class="code-ws" id="cd-ws"></div>
        </div>
        <div class="code-bottom">
          <button class="btn primary" id="cd-run">▶ 실행</button>
          <button class="btn red" id="cd-stop">■ 멈춤</button>
          <button class="btn" id="cd-undo">↶ 되돌리기</button>
          <div class="speed">속도 <input type="range" id="cd-speed" min="1" max="200" value="${this.speed}"><span id="cd-sv">${this.speed}</span></div>
          <div class="code-log" id="cd-log">블록을 끌어다 오른쪽에 쌓아 보세요. 톡 누르면 맨 아래에 붙어요.</div>
        </div>
      </div>`);
    const smp = $('#cd-sample', s);
    for (const k in SAMPLE_PROGRAMS) { const o = document.createElement('option'); o.value = k; o.textContent = k; smp.appendChild(o); }
    smp.onchange = () => { if (smp.value) { this.program = JSON.parse(JSON.stringify(SAMPLE_PROGRAMS[smp.value])); this.renderWs(); this.log(`예제 「${smp.value}」를 불러왔어요. ▶ 실행을 눌러 보세요!`); } smp.value = ''; };
    const saved = $('#cd-saved', s);
    const fillSaved = () => { saved.innerHTML = '<option value="">💾 내 코드</option>'; const sp = this.savedPrograms(); for (const k in sp) { const o = document.createElement('option'); o.value = k; o.textContent = k; saved.appendChild(o); } };
    fillSaved();
    saved.onchange = () => { const sp = this.savedPrograms(); if (sp[saved.value]) { this.program = sp[saved.value]; this.renderWs(); this.log(`「${saved.value}」 불러옴`); } saved.value = ''; };
    $('#cd-save', s).onclick = () => { const n = prompt('코드 이름', '나의 건물'); if (!n) return; const sp = this.savedPrograms(); sp[n] = this.program; localStorage.setItem('educraft.programs', JSON.stringify(sp)); fillSaved(); this.log(`「${n}」 저장 완료`); };
    $('#cd-new', s).onclick = () => { if (confirm('작업판을 비울까요?')) { this.program = []; this.renderWs(); } };
    $('#cd-io', s).onclick = () => {
      const txt = prompt('아래 글자를 복사해 친구에게 주거나, 받은 코드를 붙여넣고 확인을 누르세요.', JSON.stringify(this.program));
      if (txt && txt !== JSON.stringify(this.program)) { try { const p = JSON.parse(txt); if (Array.isArray(p)) { this.program = p; this.renderWs(); this.log('코드를 가져왔어요'); } } catch (e) { this.log('코드 형식이 올바르지 않아요'); } }
    };
    $('#cd-close', s).onclick = () => g.ui.closeModal();
    $('#cd-run', s).onclick = () => { this.run(); };
    $('#cd-stop', s).onclick = () => { this.stop(); };
    $('#cd-undo', s).onclick = () => { this.doUndo(); };
    $('#cd-speed', s).oninput = (e) => { this.speed = +e.target.value; $('#cd-sv', s).textContent = this.speed; };
    this.renderPalette();
    this.renderWs();
    g.ui.show('code-screen');
  }
  closeEditor() { this.saveProgram(); this.dragEnd(); }
  log(t) { const el = document.getElementById('cd-log'); if (el) el.textContent = t; }
  // ---------- 블록 DOM ----------
  argInput(node, key, def) {
    const v = node.a[key] !== undefined ? node.a[key] : def.a[key];
    let el;
    const E = {
      'setblk.b': 'blocks', 'placeDir.d': DIR_CHOICES, 'rsPlace.d': HDIR_CHOICES.concat([['u', '위'], ['d', '아래']]),
      'box.fill': FILL_CHOICES, 'sphere.fill': FILL_CHOICES, 'cyl.fill': FILL_CHOICES, 'pen.on': [['1', '켜기'], ['0', '끄기']],
      'setcolor.k': [['wool', '양털'], ['concrete', '콘크리트']], 'rsPlace.p': RS_PARTS, 'rsEx.e': RS_EXAMPLES,
    };
    const choices = E[node.t + '.' + key] || null;
    if (choices === 'blocks') {
      el = document.createElement('select');
      const gr = BUILD_BLOCK_CHOICES(this.survival() ? this.g.found : null);
      for (const k in gr) { const og = document.createElement('optgroup'); og.label = k; for (const [n, kk] of gr[k]) { const o = document.createElement('option'); o.value = n; o.textContent = kk; og.appendChild(o); } el.appendChild(og); }
      el.value = v;
    } else if (choices) {
      el = document.createElement('select');
      for (const [n, kk] of choices) { const o = document.createElement('option'); o.value = n; o.textContent = kk; el.appendChild(o); }
      el.value = v;
    } else {
      el = document.createElement('input'); el.value = v; el.type = 'text';
      const fit = () => { el.style.width = Math.max(key === 'v' ? 30 : 42, Math.min(260, String(el.value).length * 9 + 18)) + 'px'; };
      fit(); el.addEventListener('input', fit);
    }
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('keydown', e => e.stopPropagation());
    el.onchange = el.oninput = () => { node.a[key] = el.value; this.saveProgram(); };
    return el;
  }
  blockEl(node, inPalette) {
    const def = CODE_DEFS[node.t];
    if (!def) { const d = document.createElement('div'); d.textContent = '?'; return d; }
    const el = document.createElement('div');
    const locked = !this.isOpen(node.t);
    el.className = 'cb c-' + def.cat + (def.c ? ' cblock-c' : '') + (locked ? ' locked' : '');
    const head = def.c ? document.createElement('div') : el;
    if (def.c) { head.className = 'head'; el.appendChild(head); }
    const parts = def.text.split(/(#\w+)/);
    for (const part of parts) {
      if (!part) continue;
      if (part[0] === '#') head.appendChild(this.argInput(node, part.slice(1), def));
      else { const sp = document.createElement('span'); sp.textContent = part; head.appendChild(sp); }
    }
    if (locked) { const w = document.createElement('span'); w.className = 'lockwhy'; w.textContent = `🔒 ${CODE_KEYS[node.t][1]}을(를) 얻으면 열려요`; head.appendChild(w); }
    if (!inPalette) {
      const del = document.createElement('span'); del.className = 'del'; del.textContent = '✕'; del.title = '지우기';
      del.addEventListener('pointerdown', e => { e.stopPropagation(); });
      del.onclick = (e) => { e.stopPropagation(); this.removeNode(node); this.renderWs(); };
      head.appendChild(del);
    }
    if (def.c) {
      const inner = document.createElement('div'); inner.className = 'inner';
      if (!node.c) node.c = [];
      if (!inPalette) this.renderList(inner, node.c);
      el.appendChild(inner);
      const foot = document.createElement('div'); foot.className = 'foot'; el.appendChild(foot);
    }
    el._node = node;
    if (locked && inPalette) { el.addEventListener('pointerdown', e => { e.preventDefault(); this.log(`🔒 「${codeName(node.t)}」 블록은 ${CODE_KEYS[node.t][1]}을(를) 처음 얻으면 열려요.`); }); return el; }
    el.addEventListener('pointerdown', e => this.dragStart(e, node, el, inPalette));
    return el;
  }
  renderPalette() {
    const pal = document.getElementById('cd-pal'); if (!pal) return;
    pal.innerHTML = '';
    if (this.survival()) {
      const all = Object.keys(CODE_DEFS), open = all.filter(t => this.isOpen(t)).length;
      const pr = document.createElement('div'); pr.className = 'code-progress';
      pr.innerHTML = `🔓 열린 코딩 블록 <b>${open}</b> / ${all.length} · 재료를 처음 얻으면 하나씩 열려요`;
      pal.appendChild(pr);
    }
    let cat = null;
    for (const t in CODE_DEFS) {
      const def = CODE_DEFS[t];
      if (def.cat !== cat) { cat = def.cat; const h = document.createElement('h5'); h.textContent = CAT_NAMES[cat]; pal.appendChild(h); }
      const node = { t, a: Object.assign({}, def.a) }; if (def.c) node.c = [];
      pal.appendChild(this.blockEl(node, true));
    }
  }
  renderWs() {
    const ws = document.getElementById('cd-ws'); if (!ws) return;
    const scroll = ws.scrollTop;
    ws.innerHTML = '';
    const scr = document.createElement('div'); scr.className = 'code-script';
    const hat = document.createElement('div'); hat.className = 'cb c-event'; hat.textContent = '▶ 실행 버튼을 누르면'; hat.style.cursor = 'default'; hat.style.display = 'inline-flex';
    scr.appendChild(hat);
    const body = document.createElement('div'); scr.appendChild(body);
    this.renderList(body, this.program);
    ws.appendChild(scr);
    ws.scrollTop = scroll;
    this.saveProgram();
  }
  renderList(container, list) {
    const line = (i) => { const d = document.createElement('div'); d.className = 'dropline'; d._list = list; d._index = i; container.appendChild(d); };
    line(0);
    list.forEach((node, i) => {
      const el = this.blockEl(node, false);
      if (this.running && this.curNode === node) el.classList.add('running');
      container.appendChild(el); line(i + 1);
    });
  }
  removeNode(node, list) {
    list = list || this.program;
    const i = list.indexOf(node);
    if (i >= 0) { list.splice(i, 1); return true; }
    for (const n of list) if (n.c && this.removeNode(node, n.c)) return true;
    return false;
  }
  // ---------- 끌어다 놓기 ----------
  dragStart(e, node, el, fromPalette) {
    if (e.button && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    this.drag = { node, el, fromPalette, sx: e.clientX, sy: e.clientY, started: false, pid: e.pointerId };
    const mv = (ev) => this.dragMove(ev), up = (ev) => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); this.dragDrop(ev); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }
  dragMove(e) {
    const d = this.drag; if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 7) return;
      d.started = true;
      if (!d.fromPalette) { this.removeNode(d.node); this.renderWs(); }
      else d.node = JSON.parse(JSON.stringify(d.node));
      const gh = this.blockEl(d.node, true); gh.classList.add('ghost'); gh.style.width = Math.min(360, d.el.offsetWidth) + 'px';
      document.body.appendChild(gh); d.ghost = gh;
    }
    d.ghost.style.left = (e.clientX - 20) + 'px'; d.ghost.style.top = (e.clientY - 16) + 'px';
    // 가장 가까운 놓을 자리
    let best = null, bd = 1e9;
    const ws = document.getElementById('cd-ws');
    const wr = ws.getBoundingClientRect();
    const inWs = e.clientX >= wr.left && e.clientX <= wr.right && e.clientY >= wr.top && e.clientY <= wr.bottom;
    for (const l of ws.querySelectorAll('.dropline')) {
      l.classList.remove('on');
      if (!inWs) continue;
      if (this.isInside(l._list, d.node)) continue;
      const r = l.getBoundingClientRect();
      const dy = Math.abs(e.clientY - (r.top + r.height / 2));
      const dx = e.clientX < r.left ? r.left - e.clientX : 0;
      const dist = dy + dx * 0.5;
      if (dist < bd) { bd = dist; best = l; }
    }
    if (best) best.classList.add('on');
    d.target = best;
    // 가장자리 자동 스크롤
    if (inWs) { if (e.clientY > wr.bottom - 40) ws.scrollTop += 12; else if (e.clientY < wr.top + 40) ws.scrollTop -= 12; }
  }
  isInside(list, node) {
    if (!node.c) return false;
    if (list === node.c) return true;
    for (const n of node.c) if (this.isInside(list, n)) return true;
    return false;
  }
  dragDrop(e) {
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (d.ghost) d.ghost.remove();
    if (!d.started) {
      if (d.fromPalette) { const n = JSON.parse(JSON.stringify(d.node)); this.program.push(n); this.renderWs(); const ws = document.getElementById('cd-ws'); ws.scrollTop = ws.scrollHeight; }
      return;
    }
    if (d.target) { d.target._list.splice(d.target._index, 0, d.node); }
    this.renderWs();
  }
  dragEnd() { if (this.drag && this.drag.ghost) this.drag.ghost.remove(); this.drag = null; }

  // ================= 실행 =================
  run() {
    const g = this.g, p = g.player;
    if (!g.world) return;
    this.stop();
    const lk = this.lockedIn(this.program);
    if (lk.size) { const m = '🔒 아직 열리지 않은 블록이 있어요: ' + [...lk].map(t => `「${codeName(t)}」(${CODE_KEYS[t][1]} 필요)`).join(', '); this.log(m); g.ui.toast(m, 4000); return; }
    const f = g.lookDirH();
    this.facing = f; this.startFacing = f;
    this.bx = Math.floor(p.x) + DX[f] * 2; this.by = Math.floor(p.y + 0.01); this.bz = Math.floor(p.z) + DZ[f] * 2;
    this.sx = this.bx; this.sy = this.by; this.sz = this.bz;
    this.block = BL.stone; this.blockMeta = 0; this.pen = false;
    this.vars = { i: 0, j: 0, k: 0, x: 0, y: 0 };
    this.undo = new Map();
    this.placed = 0;
    this.gen = this.runList(this.program);
    this.running = true; this.visible = true; this.acc = 0;
    this.log('빌더봇 작업 시작! 🤖');
    this.updateStatus();
    g.ui.closeModal();
  }
  stop() { if (this.running) this.log('멈췄어요'); this.running = false; this.gen = null; this.curNode = null; this.updateStatus(); }
  doUndo() {
    if (this.survival()) { this.log('서바이벌에서는 되돌리기를 쓸 수 없어요. 재료를 돌려받으려면 직접 부숴요.'); this.g.ui.toast('서바이벌에서는 되돌리기를 쓸 수 없어요'); return; }
    if (!this.undo || !this.undo.size) { this.log('되돌릴 것이 없어요'); return; }
    this.stop();
    for (const [k, v] of this.undo) { const [x, y, z] = parseKey(k); this.g.setBlockNet(x, y, z, v[0], v[1]); }
    this.log(`${this.undo.size}칸을 되돌렸어요`);
    this.undo = null;
  }
  updateStatus() {
    const el = document.getElementById('bot-status');
    if (!el) return;
    if (this.running) {
      el.classList.add('show');
      el.innerHTML = `🤖 빌더봇 작업 중 · ${this.placed}칸 <button class="btn small red" id="bs-stop">멈춤</button>`;
      el.querySelector('#bs-stop').onclick = () => this.stop();
    } else if (this.undo && this.undo.size && this.visible && !this.survival()) {
      el.classList.add('show');
      el.innerHTML = `🤖 완성! ${this.placed}칸 <button class="btn small" id="bs-undo">↶ 되돌리기</button><button class="btn small" id="bs-x">✕</button>`;
      el.querySelector('#bs-undo').onclick = () => { this.doUndo(); this.visible = false; this.updateStatus(); };
      el.querySelector('#bs-x').onclick = () => { this.visible = false; this.updateStatus(); };
    } else el.classList.remove('show');
  }
  update(dt) {
    this.anim += dt;
    this.scanFound(dt);
    if (!this.running || !this.gen) return;
    if (this.waitT > 0) { this.waitT -= dt; return; }
    this.acc += dt * this.speed;
    let steps = 0;
    const t0 = performance.now();
    while (this.acc >= 1 && performance.now() - t0 < 12) {
      this.acc -= 1; steps++;
      let r;
      try { r = this.gen.next(); } catch (e) {
        if (e && e.botOut) { this.g.ui.chatLine(`🤖 빌더봇: ${itemName(e.botOut)}이(가) 다 떨어졌어요! 가방에 더 모아 오면 이어서 지을 수 있어요. (${this.placed}칸 지음)`, '#ffb37a'); this.g.ui.toast(`🤖 ${itemName(e.botOut)}이(가) 부족해요`); }
        else this.g.ui.chatLine('🤖 코드 오류: ' + e.message, '#f88');
        this.stop(); return;
      }
      if (r.done) {
        this.running = false; this.gen = null; this.curNode = null;
        this.g.ui.chatLine(`🤖 빌더봇: 다 지었어요! (${this.placed}칸)`, '#9ff');
        this.g.sound.play('levelup');
        this.updateStatus();
        return;
      }
      if (this.waitT > 0) break;
    }
    if (steps && (this.anim * 4 | 0) % 2 === 0) this.g.sound.play('bot', this.bx, this.by, this.bz);
    this.updateStatus();
  }
  // ---- 인터프리터 ----
  num(s) { const v = evalExpr(s, this.vars); return v; }
  inum(s) { return Math.round(this.num(s)); }
  *runList(list) {
    let guard = 0;
    for (const node of list) {
      this.curNode = node;
      yield* this.exec(node);
      if (++guard > 100000) return;
    }
  }
  fwdVec() { return [DX[this.facing], DZ[this.facing]]; }
  rightVec() { const r = CW[this.facing]; return [DX[r], DZ[r]]; }
  // 로컬 좌표(오른쪽 r, 위 u, 앞 f) → 월드
  L(r, u, f) {
    const fv = this.fwdVec(), rv = this.rightVec();
    return [this.bx + rv[0] * r + fv[0] * f, this.by + u, this.bz + rv[1] * r + fv[1] * f];
  }
  relDir(d) {
    if (d === 'f') return this.facing; if (d === 'b') return OPP[this.facing];
    if (d === 'l') return CCW[this.facing]; if (d === 'r') return CW[this.facing];
    if (d === 'u') return 1; return 0;
  }
  put(x, y, z, id, meta) {
    const w = this.g.world;
    if (y < 1 || y >= HEIGHT) return;
    if (!w.isLoadedAt(x, z)) return;
    const k = fmtKey(x, y, z);
    if (!this.undo.has(k)) this.undo.set(k, [w.getBlock(x, y, z), w.getMeta(x, y, z)]);
    if (w.getBlock(x, y, z) === id && w.getMeta(x, y, z) === (meta | 0)) return;
    // 서바이벌: 가방의 재료를 쓰고, 치운 블록은 가방으로 (기반암·흑요석은 못 부숨)
    const p = this.g.player;
    if (!p.creative) {
      const cur = w.getBlock(x, y, z), cd = BLOCKS[cur];
      if (cur && cd && (cd.hard < 0 || cd.hard >= 30)) return;
      if (id) {
        let need = botItemFor(id, meta);
        if (need !== null && p.count(need) <= 0) {
          const decor = BOT_DECOR();
          if (id === BL.oak_door || id === BL.torch) return;
          const main = botItemFor(this.block, this.blockMeta);
          if (decor.has(id) && this.block !== id && main !== null && p.count(main) > 0) { id = this.block; meta = this.blockMeta; need = main; }
          else throw { botOut: need };
        }
        if (need !== null) p.take(need, 1);
      }
      if (cur && !IS_FLUID[cur] && !(cd && cd.replace)) {
        for (const [iid, n] of this.g.blockDrops(cur, w.getMeta(x, y, z), null)) if (n > 0) { const left = p.give(iid, n); if (left) this.g.dropItem(x + 0.5, y + 0.5, z + 0.5, { id: iid, n: left }); }
      }
      if (this.placed % 8 === 0) this.g.ui.refreshHotbar();
    }
    this.g.setBlockNet(x, y, z, id, meta | 0);
    this.placed++;
    if (this.placed % 3 === 0) this.g.particles.dust(x + 0.5, y + 0.5, z + 0.5, [0.5, 0.9, 1]);
  }
  putCur(x, y, z) { this.put(x, y, z, this.block, this.blockMeta); }
  *step(dr, du, df) {
    const old = [this.bx, this.by, this.bz];
    const fv = this.fwdVec(), rv = this.rightVec();
    this.bx += rv[0] * dr + fv[0] * df; this.by += du; this.bz += rv[1] * dr + fv[1] * df;
    if (this.pen) this.putCur(old[0], old[1], old[2]);
    yield;
  }
  *exec(n) {
    const a = n.a || {};
    switch (n.t) {
      case 'fwd': for (let i = 0; i < this.inum(a.n); i++) yield* this.step(0, 0, 1); return;
      case 'back': for (let i = 0; i < this.inum(a.n); i++) yield* this.step(0, 0, -1); return;
      case 'up': for (let i = 0; i < this.inum(a.n); i++) yield* this.step(0, 1, 0); return;
      case 'down': for (let i = 0; i < this.inum(a.n); i++) yield* this.step(0, -1, 0); return;
      case 'left': for (let i = 0; i < this.inum(a.n); i++) yield* this.step(-1, 0, 0); return;
      case 'right': for (let i = 0; i < this.inum(a.n); i++) yield* this.step(1, 0, 0); return;
      case 'turnL': this.facing = CCW[this.facing]; yield; return;
      case 'turnR': this.facing = CW[this.facing]; yield; return;
      case 'turnB': this.facing = OPP[this.facing]; yield; return;
      case 'home': this.bx = this.sx; this.by = this.sy; this.bz = this.sz; this.facing = this.startFacing; yield; return;
      case 'goto': {
        const f0 = this.facing; this.facing = this.startFacing;
        const x = this.inum(a.x), y = this.inum(a.y), z = this.inum(a.z);
        const fv = this.fwdVec(), rv = this.rightVec();
        this.bx = this.sx + rv[0] * x + fv[0] * z; this.by = this.sy + y; this.bz = this.sz + rv[1] * x + fv[1] * z;
        this.facing = f0; yield; return;
      }
      case 'setblk': { const id = a.b === 'air' ? 0 : a.b === 'redstone_wire' ? BL.redstone_wire : BL[a.b]; this.block = id === undefined ? BL.stone : id; this.blockMeta = 0; return; }
      case 'setcolor': { let c = this.inum(a.n); let v = a.n; try { if (/^\[/.test(String(v).trim())) { const m = /^\[([^\]]*)\]\s*\[(.*)\]$/.exec(String(v).trim()); if (m) { const arr = m[1].split(',').map(s => this.inum(s)); c = arr[((this.inum(m[2]) % arr.length) + arr.length) % arr.length]; } } } catch (e) { } c = ((c % 16) + 16) % 16; this.block = BL[(a.k === 'concrete' ? 'concrete_' : 'wool_') + DYES[c][0]]; this.blockMeta = 0; return; }
      case 'place': this.putCur(this.bx, this.by, this.bz); yield; return;
      case 'placeDir': { const d = this.relDir(a.d); this.putCur(this.bx + DX[d], this.by + DY[d], this.bz + DZ[d]); yield; return; }
      case 'dig': this.put(this.bx, this.by, this.bz, 0, 0); yield; return;
      case 'pen': this.pen = a.on === '1'; return;
      case 'wall': { const w = this.inum(a.w), h = this.inum(a.h); for (let u = 0; u < h; u++) for (let f = 0; f < w; f++) { const p = this.L(0, u, f); this.putCur(...p); yield; } return; }
      case 'floor': { const d = this.inum(a.d), w = this.inum(a.w); for (let f = 0; f < d; f++) for (let r = 0; r < w; r++) { const p = this.L(r, 0, f); this.putCur(...p); yield; } return; }
      case 'clear': { const d = this.inum(a.d), w = this.inum(a.w), h = this.inum(a.h); for (let u = 0; u < h; u++) for (let f = 0; f < d; f++) for (let r = 0; r < w; r++) { const p = this.L(r, u, f); this.put(...p, 0, 0); yield; } return; }
      case 'box': {
        const d = this.inum(a.d), w = this.inum(a.w), h = this.inum(a.h), hollow = a.fill !== 'solid';
        for (let u = 0; u < h; u++) for (let f = 0; f < d; f++) for (let r = 0; r < w; r++) {
          const edge = u === 0 || u === h - 1 || f === 0 || f === d - 1 || r === 0 || r === w - 1;
          if (hollow && !edge) continue;
          this.putCur(...this.L(r, u, f)); yield;
        }
        return;
      }
      case 'sphere': {
        const R = Math.min(24, this.inum(a.r)), hollow = a.fill !== 'solid';
        for (let u = -R; u <= R; u++) for (let f = -R; f <= R; f++) for (let r = -R; r <= R; r++) {
          const d = Math.sqrt(r * r + u * u + f * f);
          if (d > R + 0.5) continue;
          if (hollow && d < R - 0.5) continue;
          this.putCur(...this.L(r, u, f)); yield;
        }
        return;
      }
      case 'cyl': {
        const R = Math.min(24, this.inum(a.r)), h = this.inum(a.h), hollow = a.fill !== 'solid';
        for (let u = 0; u < h; u++) for (let f = -R; f <= R; f++) for (let r = -R; r <= R; r++) {
          const d = Math.sqrt(r * r + f * f);
          if (d > R + 0.5) continue;
          if (hollow && d < R - 0.5 && u > 0 && u < h - 1) continue;
          this.putCur(...this.L(r, u, f)); yield;
        }
        return;
      }
      case 'pyramid': {
        const s = Math.min(41, this.inum(a.s));
        for (let u = 0; u * 2 < s; u++) for (let f = u; f < s - u; f++) for (let r = u; r < s - u; r++) {
          if (f > u && f < s - u - 1 && r > u && r < s - u - 1 && u * 2 + 2 < s) continue;
          this.putCur(...this.L(r - (s >> 1), u, f)); yield;
        }
        return;
      }
      case 'house': {
        const d = Math.max(4, this.inum(a.d)), w = Math.max(4, this.inum(a.w)), h = Math.max(3, this.inum(a.h));
        const main = this.block, mm = this.blockMeta;
        const L = (r, u, f) => this.L(r - (w >> 1), u, f);
        // 바닥
        this.block = BL.cobblestone; this.blockMeta = 0;
        for (let f = 0; f < d; f++) for (let r = 0; r < w; r++) { this.putCur(...L(r, -1, f)); yield; }
        // 벽 (기둥은 원목)
        for (let u = 0; u < h; u++) for (let f = 0; f < d; f++) for (let r = 0; r < w; r++) {
          const edgeF = f === 0 || f === d - 1, edgeR = r === 0 || r === w - 1;
          if (!edgeF && !edgeR) { this.put(...L(r, u, f), 0, 0); continue; }
          const corner = edgeF && edgeR;
          let id = corner ? BL.oak_log : main, meta = corner ? 0 : mm;
          const mid = (edgeF && r === (w >> 1)) || (edgeR && f === (d >> 1));
          if (u === 1 && mid && !(f === 0 && r === (w >> 1))) id = BL.glass;
          if (f === 0 && r === (w >> 1) && u < 2) { id = 0; }
          this.put(...L(r, u, f), id, meta); yield;
        }
        // 문
        const df = this.facing;
        this.put(...L(w >> 1, 0, 0), BL.oak_door, OPP[df]); this.put(...L(w >> 1, 1, 0), BL.oak_door, OPP[df] | 16); yield;
        // 지붕 (계단식)
        for (let k = 0; k <= (w >> 1) + 1; k++) {
          for (let f = -1; f <= d; f++) {
            const u = h + k;
            const lr = k - 1, rr = w - k;
            if (lr > rr) break;
            this.put(...L(lr, u, f), BL.spruce_planks, 0);
            this.put(...L(rr, u, f), BL.spruce_planks, 0);
            if (f === -1 || f === d) { } else for (let r = lr + 1; r < rr; r++) if (k === (w >> 1) + 1 || r === lr + 1 || r === rr - 1) { }
            yield;
          }
        }
        // 삼각 벽
        for (let k = 1; k <= (w >> 1); k++) for (let r = k; r < w - k; r++) { this.put(...L(r, h + k - 1, 0), main, mm); this.put(...L(r, h + k - 1, d - 1), main, mm); yield; }
        // 안쪽 횃불
        this.put(...L(1, 2, 1), BL.torch, OPP[CCW[this.facing]]); yield;
        this.block = main; this.blockMeta = mm;
        return;
      }
      case 'tower': {
        const R = Math.min(16, this.inum(a.r)), h = this.inum(a.h);
        for (let u = 0; u < h + 2; u++) for (let f = -R; f <= R; f++) for (let r = -R; r <= R; r++) {
          const dd = Math.sqrt(r * r + f * f);
          if (dd > R + 0.5) continue;
          const shell = dd >= R - 0.5;
          if (u < h) { if (shell) { const win = u % 4 === 2 && (Math.abs(r) < 1 || Math.abs(f) < 1); this.putCur(...this.L(r, u, f + R + 1)); if (win) this.put(...this.L(r, u, f + R + 1), BL.glass, 0); yield; } else if (u % 5 === 4) { this.putCur(...this.L(r, u, f + R + 1)); yield; } }
          else if (shell && ((Math.round(Math.atan2(f, r) * 4) & 1) || u === h)) { this.putCur(...this.L(r, u, f + R + 1)); yield; }
        }
        return;
      }
      case 'stair': {
        const n2 = this.inum(a.n), w = Math.max(1, this.inum(a.w));
        for (let i = 0; i < n2; i++) for (let r = 0; r < w; r++) { this.putCur(...this.L(r, i, i)); yield; }
        return;
      }
      case 'repeat': { const c = this.inum(a.n); for (let i = 0; i < c && i < 10000; i++) { this.vars['반복'] = i + 1; yield* this.runList(n.c || []); } return; }
      case 'for': {
        const v = (a.v || 'i').trim() || 'i', s = this.inum(a.a), e = this.inum(a.b);
        const st = s <= e ? 1 : -1;
        for (let i = s, c = 0; st > 0 ? i <= e : i >= e; i += st) { this.vars[v] = i; yield* this.runList(n.c || []); if (++c > 10000) break; }
        return;
      }
      case 'wait': this.waitT = Math.max(0, this.num(a.s)); yield; return;
      case 'set': this.vars[(a.v || 'x').trim()] = this.num(a.x); return;
      case 'change': { const v = (a.v || 'x').trim(); this.vars[v] = (this.vars[v] || 0) + this.num(a.x); return; }
      case 'say': { let s = String(a.s || ''); s = s.replace(/\{(\w+)\}/g, (_, k) => this.vars[k] !== undefined ? this.vars[k] : '?'); this.g.ui.chatLine('🤖 빌더봇: ' + s, '#9ff'); this.g.ui.toast('🤖 ' + s); return; }
      case 'rsLine': {
        const c = this.inum(a.n);
        for (let i = 0; i < c; i++) {
          const w = this.g.world;
          const below = w.getBlock(this.bx, this.by - 1, this.bz);
          if (!below || !BLOCKS[below].solid) this.put(this.bx, this.by - 1, this.bz, BL.smooth_stone, 0);
          this.put(this.bx, this.by, this.bz, BL.redstone_wire, 0);
          yield* this.step(0, 0, 1);
        }
        return;
      }
      case 'rsPlace': {
        const id = BL[a.p]; if (id === undefined) return;
        const d = this.relDir(a.d);
        yield* this.placePart(this.bx, this.by, this.bz, id, d);
        return;
      }
      case 'rsEx': yield* this.example(a.e); return;
    }
  }
  // 전기 부품을 방향에 맞게 놓기 (d: 부품이 향하는/출력하는 방향)
  *placePart(x, y, z, id, d) {
    const w = this.g.world, def = BLOCKS[id];
    const below = w.getBlock(x, y - 1, z);
    const needFloor = ['wire', 'diode', 'rail', 'plate', 'torch', 'lever', 'button', 'door'].includes(def.shape) || def.rs === 'wire';
    if (needFloor && (!below || !BLOCKS[below].solid || !IS_OPAQUE[below])) this.put(x, y - 1, z, BL.smooth_stone, 0);
    let meta = 0;
    if (def.shape === 'diode') meta = d >= 2 ? d : this.facing;
    else if (def.facing6) meta = d;
    else if (def.facingH) meta = d >= 2 ? d : this.facing;
    else if (def.shape === 'torch' || def.shape === 'lever' || def.shape === 'button') meta = 0;
    if (def.shape === 'door') { this.put(x, y, z, id, d >= 2 ? d : this.facing); this.put(x, y + 1, z, id, (d >= 2 ? d : this.facing) | 16); yield; return; }
    this.put(x, y, z, id, meta);
    yield;
  }
  *example(name) {
    const P = (r, u, f, id, dir) => this.placePart(...this.L(r, u, f), typeof id === 'string' ? BL[id] : id, dir === undefined ? this.facing : this.relDir(dir));
    const base = function* (self, r0, r1, f0, f1) { for (let f = f0; f <= f1; f++) for (let r = r0; r <= r1; r++) { self.put(...self.L(r, -1, f), BL.smooth_stone, 0); yield; } };
    const clearAbove = function* (self, r0, r1, f0, f1, h) { for (let u = 0; u < h; u++) for (let f = f0; f <= f1; f++) for (let r = r0; r <= r1; r++) { self.put(...self.L(r, u, f), 0, 0); } yield; };
    const say = (s) => { this.g.ui.chatLine('🤖 ' + s, '#9ff'); };
    switch (name) {
      case 'lamp':
        yield* clearAbove(this, -1, 1, 0, 6, 3); yield* base(this, -1, 1, 0, 6);
        yield* P(0, 0, 0, 'lever'); for (let f = 1; f <= 5; f++) yield* P(0, 0, f, 'redstone_wire');
        yield* P(0, 0, 6, 'redstone_lamp');
        say('기본 램프 회로: 레버를 켜 보세요! 전선이 빨갛게 빛나며 램프가 켜져요.');
        return;
      case 'strength':
        yield* clearAbove(this, -1, 1, 0, 16, 3); yield* base(this, -1, 1, 0, 16);
        yield* P(0, 0, 0, 'lever');
        for (let f = 1; f <= 16; f++) { yield* P(0, 0, f, 'redstone_wire'); yield* P(1, 0, f, 'number_display'); yield* P(-1, 0, f, 'color_lamp'); }
        say('신호 세기 실험: 레버를 켜면 한 칸마다 세기가 1씩 줄어요. 16번째 칸은?');
        return;
      case 'gates': {
        const gates = ['gate_and', 'gate_or', 'gate_xor'];
        yield* clearAbove(this, -1, 16, 0, 3, 3); yield* base(this, -1, 16, 0, 3);
        for (let k = 0; k < 3; k++) {
          const r = k * 5;
          yield* P(r - 1, 0, 1, 'lever'); yield* P(r, 0, 1, gates[k], 'f'); yield* P(r + 1, 0, 1, 'lever');
          yield* P(r, 0, 2, 'redstone_wire'); yield* P(r, 0, 3, 'redstone_lamp');
        }
        yield* P(15, 0, 0, 'lever'); yield* P(15, 0, 1, 'gate_not', 'f'); yield* P(15, 0, 2, 'redstone_wire'); yield* P(15, 0, 3, 'redstone_lamp');
        say('논리 게이트 체험장: 왼쪽부터 AND, OR, XOR, NOT! 레버를 켜고 끄며 램프를 관찰해 보세요.');
        return;
      }
      case 'door':
        yield* clearAbove(this, -2, 2, -1, 1, 4); yield* base(this, -2, 2, -1, 1);
        for (let u = 0; u < 3; u++) for (const r of [-2, -1, 1, 2]) { this.put(...this.L(r, u, 0), BL.stone_bricks, 0); yield; }
        this.put(...this.L(0, 2, 0), BL.stone_bricks, 0);
        yield* P(0, 0, 0, 'iron_door', 'f');
        yield* P(0, 0, -1, 'stone_pressure_plate'); yield* P(0, 0, 1, 'stone_pressure_plate');
        say('자동문: 압력판을 밟으면 철 문이 열려요. 플레이어 감지기로 바꿔 보는 것도 도전!');
        return;
      case 'clock':
        yield* clearAbove(this, -1, 1, 0, 5, 3); yield* base(this, -1, 1, 0, 5);
        yield* P(0, 0, 0, 'clock_block'); for (let f = 1; f <= 3; f++) yield* P(0, 0, f, 'redstone_wire');
        yield* P(0, 0, 4, 'redstone_lamp'); yield* P(1, 0, 4, 'note_block'); yield* P(-1, 0, 4, 'color_lamp');
        say('깜빡이: 클럭 블록을 우클릭하면 빠르기가 바뀌어요. 웅크리고 우클릭하면 멈춰요.');
        return;
      case 'piston':
        yield* clearAbove(this, -1, 1, 0, 6, 3); yield* base(this, -1, 1, 0, 6);
        yield* P(0, 0, 0, 'lever'); for (let f = 1; f <= 3; f++) yield* P(0, 0, f, 'redstone_wire');
        yield* P(0, 0, 4, 'sticky_piston', 'f'); this.put(...this.L(0, 0, 5), BL.slime_block, 0); yield;
        say('피스톤: 레버를 켜면 끈끈이 피스톤이 블록을 밀고, 끄면 다시 당겨와요.');
        return;
      case 'street':
        yield* clearAbove(this, -1, 1, 0, 3, 6); yield* base(this, -1, 1, 0, 3);
        yield* P(0, 0, 0, 'daylight_sensor');
        this.put(...this.L(0, 0, 0), BL.daylight_sensor, 16); yield;
        yield* P(0, 0, 1, 'redstone_wire'); yield* P(0, 0, 2, 'redstone_wire');
        this.put(...this.L(0, 0, 3), BL.stone_bricks, 0); yield;
        this.put(...this.L(0, 1, 3), BL.redstone_torch, 0); yield;
        this.put(...this.L(0, 2, 3), BL.stone_bricks, 0); yield;
        this.put(...this.L(0, 3, 3), BL.redstone_torch, 0); yield;
        this.put(...this.L(0, 4, 3), BL.redstone_lamp, 0); yield;
        say('가로등: 햇빛 감지기(밤 모드) → 횃불 두 개로 신호를 두 번 뒤집어 위로 올려요. /time set night 로 확인!');
        return;
      case 'repeater':
        yield* clearAbove(this, -1, 1, 0, 25, 3); yield* base(this, -1, 1, 0, 25);
        yield* P(0, 0, 0, 'lever');
        for (let f = 1; f <= 24; f++) yield* P(0, 0, f, f === 14 ? 'repeater' : 'redstone_wire', 'f');
        yield* P(0, 0, 25, 'redstone_lamp');
        say('중계기: 전선은 15칸까지만 가요. 중간의 중계기가 신호를 다시 15로 키워 줘요!');
        return;
    }
  }
  // ================= 빌더봇 그리기 =================
  render(R, cam) {
    if (!this.visible) return;
    this.renderBotAt(R, cam, { x: this.bx, y: this.by, z: this.bz, f: this.facing, t: this.anim });
  }
  renderBotAt(R, cam, b) {
    const m = M4.create(), t = M4.create();
    const bob = Math.sin((b.t || this.anim) * 4) * 0.06;
    M4.translate(m, b.x + 0.5 - cam[0], b.y + 0.35 + bob - cam[1], b.z + 0.5 - cam[2]);
    const yaw = { 2: 0, 3: Math.PI, 4: Math.PI / 2, 5: -Math.PI / 2 }[b.f] || 0;
    M4.mul(m, m, M4.rotY(t, yaw));
    const L = [1, 0.3];
    R.ent.addBox(m, -0.28, -0.2, -0.25, 0.28, 0.3, 0.25, [0.85, 0.88, 0.92], L[0], L[1]);
    R.ent.addBox(m, -0.22, -0.08, -0.27, 0.22, 0.2, -0.25, [0.1, 0.15, 0.2], L[0], L[1]);
    R.ent.addBox(m, -0.15, 0.02, -0.28, -0.05, 0.12, -0.27, [0.3, 0.95, 1], 1, 1);
    R.ent.addBox(m, 0.05, 0.02, -0.28, 0.15, 0.12, -0.27, [0.3, 0.95, 1], 1, 1);
    R.ent.addBox(m, -0.02, 0.3, -0.02, 0.02, 0.5, 0.02, [0.5, 0.5, 0.55], L[0], L[1]);
    R.ent.addBox(m, -0.05, 0.48, -0.05, 0.05, 0.56, 0.05, [1, 0.3, 0.2], 1, 1);
    R.ent.addBox(m, -0.36, -0.12, -0.08, -0.28, 0.12, 0.08, [0.4, 0.45, 0.5], L[0], L[1]);
    R.ent.addBox(m, 0.28, -0.12, -0.08, 0.36, 0.12, 0.08, [0.4, 0.45, 0.5], L[0], L[1]);
    R.ent.addBox(m, -0.14, -0.35, -0.12, 0.14, -0.2, 0.12, [0.3, 0.8, 1], 1, 1);
  }
  netState() { return this.visible ? { x: this.bx, y: this.by, z: this.bz, f: this.facing } : null; }
}
