'use strict';
// =====================================================================
// 에듀 크래프트 v1.7 — 블록 코딩 3판 (code2.js 다음에 로드)
//  1) 동시에 여러 코드(스레드): 이벤트 모자 블록이 일이 생길 때마다 따로 돌고, 「신호 보내고 함께 하기」·복제 빌더봇도 함께 움직임
//     이벤트: ⌨ 키 · 💬 채팅 · 👣 블록 밟기 · 🌙 밤/아침 · 🧬 복제되었을 때 (▶ 실행한 뒤 ■ 멈춤까지 기다림)
//  2) 말풍선·생각·숨기기, ❓ 묻고 기다리기 + 대답, ⏱ 타이머, 플레이어·시각·가방·키 감지, 글자 합치기·글자 수·n번째 글자
//  3) 📺 변수·목록 모니터(게임 화면 왼쪽), 🌍 세계 블록(시간·날씨·불러오기·순간이동·주기·명령어 — 크리에이티브)
//  4) 편집기: ↶↷ 편집 되돌리기(Ctrl+Z/Y), 오른쪽 클릭(길게 누르기) 메뉴, 🔍 블록 찾기, 확대·축소, 📺 함께 보기(창을 열어 둔 채 실행)
//  5) 글자 코딩도 새 블록을 앎: @on_key("G"), ask("…"), answer(), join(a, b), clone() …
// =====================================================================
CODE_CATS.push(['world', '세계', '#a07a4c', '🌍']);
CAT_COLOR.world = '#a07a4c';
CAT_NAMES.world = '세계';
const CODE3_KEY_CHOICES = [['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyN', 'N'], ['KeyM', 'M'], ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyR', 'R'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'],
  ['ArrowUp', '↑'], ['ArrowDown', '↓'], ['ArrowLeft', '←'], ['ArrowRight', '→'], ['Space', '스페이스'], ['any', '아무']];
const KEY_WORD = Object.fromEntries(CODE3_KEY_CHOICES.map(([c, k]) => [c, c.startsWith('Key') ? c.slice(3) : c === 'any' ? 'any' : c]));
const WORD_KEY = Object.fromEntries(Object.entries(KEY_WORD).map(([c, w]) => [w.toLowerCase(), c]));
const LISTEN_HATS = new Set(['whenKey', 'whenChat', 'whenStep', 'whenTime']);
const BOT_FIELDS = ['bx', 'by', 'bz', 'facing', 'block', 'blockMeta', 'pen', 'sx', 'sy', 'sz', 'startFacing'];
const CODE3_DEFS = {
  whenKey: { cat: 'event', text: '⌨ #k 키를 눌렀을 때', a: { k: 'KeyG' }, c: true, hat: true },
  whenChat: { cat: 'event', text: '💬 채팅에 #s (이)라고 쓰면', a: { s: '집' }, c: true, hat: true },
  whenStep: { cat: 'event', text: '👣 플레이어가 #b 을(를) 밟으면', a: { b: 'gold_block' }, c: true, hat: true },
  whenTime: { cat: 'event', text: '🌙 #d 이(가) 되면', a: { d: 'night' }, c: true, hat: true },
  whenClone: { cat: 'event', text: '🧬 복제 빌더봇으로 태어났을 때', a: {}, c: true, hat: true },
  bcastGo: { cat: 'event', text: '📣 #m 신호 보내고 바로 다음 (함께 하기)', a: { m: '기둥' } },
  gotoAbs: { cat: 'move', text: '세계 좌표 x #x y #y z #z (으)로 가기', a: { x: '0', y: '70', z: '0' } },
  placeAbs: { cat: 'build', text: '세계 좌표 x #x y #y z #z 에 블록 놓기', a: { x: '0', y: '70', z: '0' } },
  waitUntil: { cat: 'ctrl', text: '#c 이(가) 될 때까지 기다리기', a: { c: 'night', e: 'x > 3' } },
  clone: { cat: 'ctrl', text: '🧬 나를 복제하기', a: {} },
  cloneDel: { cat: 'ctrl', text: '🧬 이 복제 빌더봇 없애기', a: {} },
  ask: { cat: 'sense', text: '❓ #s 묻고 기다리기', a: { s: '몇 층으로 지을까요?' } },
  op_answer: { cat: 'sense', r: 'n', text: '대답', a: {} },
  op_player: { cat: 'sense', r: 'n', text: '플레이어 #k', a: { k: 'x' } },
  op_blockName: { cat: 'sense', r: 'n', text: '#d 쪽 블록 이름', a: { d: 'f' } },
  op_count: { cat: 'sense', r: 'n', text: '가방 속 #b 개수', a: { b: 'cobblestone' } },
  s_key: { cat: 'sense', r: 'b', text: '#k 키를 누르고 있는가?', a: { k: 'KeyG' } },
  op_timer: { cat: 'sense', r: 'n', text: '타이머 (초)', a: {} },
  timerReset: { cat: 'sense', text: '⏱ 타이머 초기화', a: {} },
  op_clock: { cat: 'sense', r: 'n', text: '#k', a: { k: 'game' } },
  op_join: { cat: 'op', r: 'n', text: '#a 와(과) #b 합치기', a: { a: '빌더', b: '봇' } },
  op_letter: { cat: 'op', r: 'n', text: '#a 의 #n 번째 글자', a: { a: '사과나무', n: '1' } },
  op_length: { cat: 'op', r: 'n', text: '#a 의 글자 수', a: { a: '사과나무' } },
  s_contains: { cat: 'op', r: 'b', text: '#a 에 #b 이(가) 들어 있는가?', a: { a: '사과나무', b: '나무' } },
  op_expr: { cat: 'op', r: 'n', text: '식 #e', a: { e: 'i * 2 + 1' } },
  showVar: { cat: 'data', text: '📺 #v 을(를) 화면에 보이기', a: { v: 'x' } },
  hideVar: { cat: 'data', text: '📺 #v 을(를) 화면에서 숨기기', a: { v: 'x' } },
  bubble: { cat: 'look', text: '💬 #s 말하기', a: { s: '안녕!' } },
  sayFor: { cat: 'look', text: '💬 #s 을(를) #n 초 동안 말하기', a: { s: '안녕!', n: '2' } },
  think: { cat: 'look', text: '💭 #s 생각하기', a: { s: '음…' } },
  hideBot: { cat: 'look', text: '🙈 빌더봇 숨기기', a: {} },
  showBot: { cat: 'look', text: '🙂 빌더봇 보이기', a: {} },
  fx: { cat: 'sound', text: '✨ #e 효과 보여 주기', a: { e: 'sparkle' } },
  wTime: { cat: 'world', text: '☀ 시간을 #t (으)로 바꾸기', a: { t: 'day' }, creative: true },
  wWeather: { cat: 'world', text: '🌦 날씨를 #w (으)로 바꾸기', a: { w: 'clear' }, creative: true },
  wSummon: { cat: 'world', text: '🐷 빌더봇 자리에 #m 불러오기', a: { m: 'pig' }, creative: true },
  wTp: { cat: 'world', text: '🌀 플레이어를 빌더봇 자리로 순간이동', a: {}, creative: true },
  wGive: { cat: 'world', text: '🎁 플레이어에게 #b #n 개 주기', a: { b: 'diamond', n: '1' }, creative: true },
  wEffect: { cat: 'world', text: '🧪 플레이어에게 #e 효과 #n 초 주기', a: { e: 'speed', n: '30' }, creative: true, needs: () => typeof game !== 'undefined' && !!game && typeof game.giveEffect === 'function' },
  wCmd: { cat: 'world', text: '⌨ 명령어 / #s 실행하기', a: { s: 'time set day' }, creative: true },
};
{
  const all = Object.assign({}, CODE_DEFS, CODE3_DEFS);
  for (const k of Object.keys(CODE_DEFS)) delete CODE_DEFS[k];
  for (const [cat] of CODE_CATS) for (const [k, v] of Object.entries(all)) if (v.cat === cat) CODE_DEFS[k] = v;
  for (const [k, v] of Object.entries(all)) if (!CODE_DEFS[k]) CODE_DEFS[k] = v;
}
// 서바이벌 열쇠 재료 (세계 블록은 크리에이티브에서만)
Object.assign(CODE_KEYS, {
  whenKey: [['#planks'], '판자'], whenChat: [['#planks'], '판자'], whenStep: [['stone_pressure_plate', '#planks'], '판자'], whenTime: [['clock', 'torch'], '횃불'], whenClone: [['book', 'bookshelf'], '책'], bcastGo: [['#planks'], '판자'],
  gotoAbs: [['compass', 'bed'], '침대(또는 나침반)'], placeAbs: [['compass', 'bed'], '침대(또는 나침반)'], waitUntil: [['bread'], '빵'], clone: [['book', 'bookshelf'], '책'], cloneDel: [['book', 'bookshelf'], '책'],
  ask: [['paper', 'book'], '종이'], op_answer: [['paper', 'book'], '종이'], op_player: [['#coal', 'lever'], '석탄(또는 레버)'], op_blockName: [['#coal', 'lever'], '석탄(또는 레버)'], op_count: [['chest'], '상자'],
  s_key: [['#coal', 'lever'], '석탄(또는 레버)'], op_timer: [['clock', 'bread'], '빵'], timerReset: [['clock', 'bread'], '빵'], op_clock: [['clock', 'bread'], '빵'],
  op_join: [['stick'], '막대기'], op_letter: [['stick'], '막대기'], op_length: [['stick'], '막대기'], s_contains: [['stick'], '막대기'], op_expr: [['stick'], '막대기'],
  showVar: [['book'], '책'], hideVar: [['book'], '책'], bubble: [['#planks'], '판자'], sayFor: [['#planks'], '판자'], think: [['#planks'], '판자'], hideBot: [['#planks'], '판자'], showBot: [['#planks'], '판자'], fx: [['gunpowder', 'paper', 'glowstone'], '화약(또는 종이)'],
});
for (const t in CODE3_DEFS) if (CODE3_DEFS[t].creative) CODE_KEYS[t] = [['bedrock'], '크리에이티브 모드'];
// 고르는 칸
const CLOCK_CHOICES = [['game', '게임 속 시각 (0~23시)'], ['year', '올해 (연도)'], ['month', '이번 달'], ['date', '오늘 (며칠)'], ['wday', '요일 (0 일요일)'], ['hour', '지금 몇 시'], ['minute', '지금 몇 분'], ['second', '지금 몇 초']];
const PLAYER_CHOICES = [['x', '세계 x'], ['y', '세계 y'], ['z', '세계 z'], ['hp', '체력'], ['food', '배고픔'], ['level', '레벨']];
const FX3_CHOICES = [['sparkle', '반짝반짝 ✨'], ['heart', '하트 💗'], ['rainbow', '무지개 🌈'], ['smoke', '연기 💨'], ['note', '음표 🎵']];
Object.assign(CH2, {
  'whenKey.k': CODE3_KEY_CHOICES, 's_key.k': CODE3_KEY_CHOICES, 'whenStep.b': 'blocks', 'whenTime.d': [['night', '밤'], ['day', '아침']],
  'op_player.k': PLAYER_CHOICES, 'op_blockName.d': DIR_CHOICES.concat([['here', '지금 자리']]), 'op_clock.k': CLOCK_CHOICES, 'fx.e': FX3_CHOICES,
  'wTime.t': [['day', '아침'], ['noon', '낮 12시'], ['sunset', '저녁'], ['night', '밤'], ['midnight', '한밤중']],
  'wWeather.w': [['clear', '맑음'], ['rain', '비']], 'wSummon.m': [], 'wGive.b': [], 'op_count.b': [], 'wEffect.e': [],
});
NAME_KEYS.add('v');
// 그때그때 채우는 고르기 목록 (몹·아이템·효과는 다른 파일이 더 만들 수 있으므로)
function code3Fill() {
  CH2['wSummon.m'] = Object.keys(MOB_TYPES).filter(k => !/ender_dragon|end_crystal/.test(k)).map(k => [k, MOB_TYPES[k].k || k]);
  const items = []; for (const d of ITEMS) if (d && d.k && d.id) items.push([d.name, d.k]);
  CH2['wGive.b'] = items; CH2['op_count.b'] = items;
  CH2['wEffect.e'] = typeof EFFECTS !== 'undefined' ? Object.keys(EFFECTS).map(k => [k, EFFECTS[k].k || EFFECTS[k].name || k]) : [['speed', '신속']];
  const w = [['clear', '맑음'], ['rain', '비']];
  if (typeof EFFECTS !== 'undefined') w.push(['thunder', '천둥 번개']);   // mc2.js: /weather thunder
  CH2['wWeather.w'] = w;
}

// ---------------- 값 블록 → 식 ----------------
// 글자 칸: 숫자면 숫자, 아니면 따옴표 글자 (변수는 「변수 x」 블록을 끼움)
function strArg(v, dflt) {
  if (v && typeof v === 'object') return argExpr(v, dflt);
  const s = String(v == null ? (dflt == null ? '' : dflt) : v);
  return isNumLit(s) ? s : pyStr(s);
}
{
  const _rep = repExpr;
  repExpr = function (n) {
    const a = n.a || {}, d = (CODE_DEFS[n.t] || { a: {} }).a, A = (k) => argExpr(a[k], d[k]), S = (k) => strArg(a[k], d[k]);
    switch (n.t) {
      case 'op_answer': return 'answer()';
      case 'op_player': return `player_${['x', 'y', 'z', 'hp', 'food', 'level'].includes(a.k) ? a.k : 'x'}()`;
      case 'op_blockName': return `block_name(${pyStr(a.d || 'f')})`;
      case 'op_count': return `count(${pyStr(a.b || 'cobblestone')})`;
      case 's_key': return `key_pressed(${pyStr(KEY_WORD[a.k] || 'G')})`;
      case 'op_timer': return 'timer()';
      case 'op_clock': return `now(${pyStr(a.k || 'game')})`;
      case 'op_join': return `join(${S('a')}, ${S('b')})`;
      case 'op_letter': return `letter(${S('a')}, ${A('n')})`;
      case 'op_length': return `len(${S('a')})`;
      case 's_contains': return `contains(${S('a')}, ${S('b')})`;
      case 'op_expr': return String(a.e == null ? '0' : a.e).trim() || '0';
    }
    return _rep(n);
  };
}
// 새 감지 함수 (BOT_CTX = 지금 계산 중인 빌더봇)
{
  const P = () => BOT_CTX && BOT_CTX.g && BOT_CTX.g.player;
  Object.assign(EXPR_FN, {
    answer: () => { const b = BOT_CTX; return b && b.answer !== undefined ? b.answer : ''; },
    timer: () => { const b = BOT_CTX; return b ? Math.round((performance.now() - (b.timer0 || performance.now())) / 100) / 10 : 0; },
    player_x: () => { const p = P(); return p ? Math.floor(p.x) : 0; }, player_y: () => { const p = P(); return p ? Math.floor(p.y) : 0; }, player_z: () => { const p = P(); return p ? Math.floor(p.z) : 0; },
    player_hp: () => { const p = P(); return p ? Math.round(p.health || 0) : 0; }, player_food: () => { const p = P(); return p ? Math.round(p.food || 0) : 0; }, player_level: () => { const p = P(); return p ? p.xpLv || 0 : 0; },
    key_pressed: (k) => { const b = BOT_CTX; if (!b || !b.keysDown) return 0; const c = WORD_KEY[String(k).toLowerCase()] || ('Key' + String(k).toUpperCase()); return (c === 'any' ? b.keysDown.size > 0 : b.keysDown.has(c)) ? 1 : 0; },
    now: (k) => {
      const d = new Date();
      switch (String(k)) {
        case 'game': { const w = BOT_CTX && BOT_CTX.g.world; return Math.floor(((w ? w.time : 0) / 1000 + 6) % 24); }
        case 'year': return d.getFullYear(); case 'month': return d.getMonth() + 1; case 'date': return d.getDate(); case 'wday': return d.getDay();
        case 'hour': return d.getHours(); case 'minute': return d.getMinutes(); case 'second': return d.getSeconds();
      }
      return 0;
    },
    count: (name) => { const p = P(); if (!p) return 0; let id; try { id = I(String(name)); } catch (e) { return 0; } return p.count(id); },
    block_name: (d) => {
      const b = BOT_CTX; if (!b) return '';
      const s = WORD_DIR[String(d)] || String(d);
      let x = b.bx, y = b.by, z = b.bz;
      if (s !== 'here') { const dir = b.relDir(s); x += DX[dir]; y += DY[dir]; z += DZ[dir]; }
      const id = b.sense(x, y, z); return id ? (BLOCKS[id].k || BLOCKS[id].name) : '공기';
    },
    join: (a, b) => fmt3(a) + fmt3(b),
    letter: (s, n) => [...fmt3(s)][Math.round(+n || 0) - 1] || '',
    len: (s) => [...fmt3(s)].length,
    contains: (a, b) => fmt3(a).toLowerCase().includes(fmt3(b).toLowerCase()) ? 1 : 0,
  });
}
function fmt3(v) { if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000); return v == null ? '' : String(v); }

// ---------------- 빌더봇: 값 · 새 블록 실행 ----------------
{
  const B = Builder.prototype;
  // 글자 칸: 값 블록은 글자 그대로(대답·합치기), 글자는 {변수} 바꿔 넣기
  const _textOf = B.textOf;
  B.textOf = function (s) {
    if (s && typeof s === 'object') { BOT_CTX = this; return fmt3(evalExprRaw(repExpr(s), this.vars)); }
    return _textOf.call(this, s);
  };
  // 변수에 넣을 값: 숫자 · 아는 이름과 식 → 계산(글자도 그대로), 모르는 말 → 글자
  B.smartVal = function (s) {
    BOT_CTX = this;
    if (s && typeof s === 'object') return evalExprRaw(repExpr(s), this.vars);
    const t = String(s == null ? '' : s).trim();
    if (t === '') return 0;
    if (isNumLit(t)) return +t;
    if (/^["'].*["']$/.test(t)) return evalExprRaw(t, this.vars);
    const ids = t.replace(/"[^"]*"|'[^']*'/g, '').match(/[a-zA-Z가-힣_][a-zA-Z0-9가-힣_]*/g) || [];
    const known = ids.every(w => (this.vars && w in this.vars) || EXPR_FN[w.toLowerCase()] || ['and', 'or', 'not', 'in', 'True', 'False', 'true', 'false', '그리고', '또는', '아니다', '참', '거짓', 'len'].includes(w));
    if (known && (ids.length || /[-+*/%()<>=]/.test(t))) return evalExprRaw(t, this.vars);
    return t;
  };
  const _exec = B.exec;
  B.exec = function* (n) {
    const a = n.a || {}, g = this.g;
    switch (n.t) {
      case 'whenKey': case 'whenChat': case 'whenStep': case 'whenTime': case 'whenClone': return;   // 몸통은 일이 생길 때만
      case 'set': { const v = codeIdent(a.v || 'x'); this.vars[v] = this.smartVal(a.x); this.monDirty = true; return; }
      case 'change': { const v = codeIdent(a.v || 'x'); const old = this.vars[v]; this.vars[v] = (typeof old === 'number' ? old : isNumLit(String(old)) ? +old : 0) + this.num(a.x); this.monDirty = true; return; }
      case 'listAdd': { const L = this.list(a.l); if (L.length < 10000) L.push(this.smartVal(a.v)); this.monDirty = true; return; }
      case 'listSet': { const L = this.list(a.l), i = this.inum(a.n) - 1; if (i >= 0 && i < 10000) { while (L.length <= i) L.push(0); L[i] = this.smartVal(a.v); } this.monDirty = true; return; }
      case 'listDel': case 'listClear': this.monDirty = true; break;
      case 'bcastGo': {
        const name = String(a.m || '').trim(), hs = (this.msgs && this.msgs[name]) || [];
        if (!hs.length) { if (!this.dry) g.ui.chatLine(`🤖 「${name}」 신호를 받을 블록이 없어요 (📣 ${name} 신호를 받았을 때)`, '#ffb37a'); return; }
        if (this.stats) this.stats.msgRuns = (this.stats.msgRuns || 0) + hs.length;
        if (this.dry || !this.threads) { for (const h of hs) yield* this.runList(h.c || []); return; }
        for (const h of hs) this.spawnBody(h, this.th ? this.th.bot : this.mainBot());
        yield; return;
      }
      case 'gotoAbs': this.bx = this.inum(a.x); this.by = this.inum(a.y); this.bz = this.inum(a.z); yield; return;
      case 'placeAbs': this.putCur(this.inum(a.x), this.inum(a.y), this.inum(a.z)); yield; return;
      case 'waitUntil': { if (this.dry) return; let k = 0; while (!this.cond(a)) { if (++k > 1e7) break; yield 'F'; } return; }
      case 'clone': if (!this.dry && this.threads) this.makeClone(); yield; return;
      case 'cloneDel': if (this.th && this.th.bot.clone) throw { botDel: true }; return;
      case 'ask': {
        if (this.dry || !this.threads) { this.answer = ''; return; }
        const q = this.textOf(a.s), me = this.th;
        this.openAsk(q, me);
        while (this.asking === me && this.running) yield 'F';
        return;
      }
      case 'timerReset': this.timer0 = performance.now(); return;
      case 'showVar': case 'hideVar': this.setMonitor(codeIdent(a.v || 'x'), n.t === 'showVar'); return;
      case 'bubble': case 'think': if (!this.dry) this.botSay(this.textOf(a.s), n.t === 'think'); yield; return;
      case 'sayFor': {
        if (this.dry) return;
        const tok = this.botSay(this.textOf(a.s), false); this.waitT = Math.max(0, this.num(a.n)); yield;
        const b = this.th ? this.th.bot : this.mainBot(); if (b && b.say && b.say.tok === tok) b.say = null;
        return;
      }
      case 'hideBot': case 'showBot': { const b = this.th ? this.th.bot : this.mainBot(); if (b) b.hidden = n.t === 'hideBot'; yield; return; }
      case 'fx': if (!this.dry) this.botFx(a.e); yield; return;
      case 'wTime': if (!this.dry) this.quietCommand('/time set ' + (a.t || 'day')); yield; return;
      case 'wWeather': if (!this.dry) { this.quietCommand('/weather ' + (a.w || 'clear')); } yield; return;
      case 'wSummon': {
        if (this.dry || !MOB_TYPES[a.m] || /ender_dragon|end_crystal/.test(a.m)) { yield; return; }
        if (g.world.remote) { g.ui.toast('함께 하기에서는 방장만 동물·몹을 불러올 수 있어요'); yield; return; }
        const before = new Set(g.ents.list);
        this.quietCommand('/summon ' + a.m);
        for (const e of g.ents.list) if (!before.has(e)) { e.x = this.bx + 0.5; e.y = this.by + 0.05; e.z = this.bz + 0.5; e.vx = e.vy = e.vz = 0; }
        yield; return;
      }
      case 'wTp': { if (this.dry) return; const p = g.player; p.x = this.bx + 0.5; p.y = this.by + 1.01; p.z = this.bz + 0.5; p.vx = p.vy = p.vz = 0; yield; return; }
      case 'wGive': {
        if (this.dry) return;
        let id; try { id = I(a.b); } catch (e) { return; }
        const k = Math.max(1, Math.min(640, this.inum(a.n)));
        const left = g.player.give(id, k); if (left) g.dropItem(g.player.x, g.player.y + 1, g.player.z, { id, n: left });
        g.ui.refreshHotbar(); return;
      }
      case 'wEffect': if (!this.dry && typeof g.giveEffect === 'function') { try { g.giveEffect(g.player, a.e, Math.max(1, this.num(a.n)), 1); } catch (e) { } } yield; return;
      case 'wCmd': {
        if (this.dry) return;
        const line = '/' + this.textOf(a.s).replace(/^\/+/, '').trim();
        if (/^\/(gamemode|kill|clear)\b/.test(line)) { g.ui.toast('빌더봇은 이 명령어를 쓸 수 없어요'); return; }
        g.command(line); yield; return;
      }
    }
    yield* _exec.call(this, n);
  };
  // 채팅에 결과 글이 쌓이지 않게 명령어 실행 (시간·날씨·소환)
  B.quietCommand = function (line) {
    const ui = this.g.ui, cl = ui.chatLine;
    ui.chatLine = function (t, c) { if (c === '#f88') cl.call(ui, t, c); };
    try { this.g.command(line); } finally { ui.chatLine = cl; }
  };
  // 세계 블록: 서바이벌에서는 잠김
  const _isOpen = B.isOpen;
  B.isOpen = function (t) { const d = CODE_DEFS[t]; if (d && d.creative && this.survival()) return false; return _isOpen.call(this, t); };
}

// ---------------- 동시에 여러 코드 (스레드) ----------------
{
  const B = Builder.prototype;
  const _begin = B.begin;
  B.begin = function (pv) {
    _begin.call(this, pv);
    this.hats = { whenKey: [], whenChat: [], whenStep: [], whenTime: [], whenClone: [] };
    const walk = (list) => { for (const n of list || []) { if (this.hats[n.t]) this.hats[n.t].push(n); walk(n.c); walk(n.c2); } };
    walk(this.program);
    this.bots = [this.newBot(false)];
    this.threads = []; this.th = null;
    this.answer = ''; this.asking = null; this.timer0 = performance.now();
    this._stepId = -1; this._night = undefined; this._evT = 0; this._finPlaced = 0; this._mainDone = false;
    this.monDirty = true;
  };
  B.newBot = function (clone) { const b = { clone, hidden: false, say: null }; for (const k of BOT_FIELDS) b[k] = this[k]; return b; };
  B.loadBot = function (b) { for (const k of BOT_FIELDS) this[k] = b[k]; };
  B.storeBot = function (b) { for (const k of BOT_FIELDS) b[k] = this[k]; };
  B.mainBot = function () { return this.bots && this.bots[0]; };
  B.newThread = function (gen, bot, hat) {
    const th = { gen, bot: bot || this.mainBot(), hat: hat || null, depth: 0, node: null, waitT: 0, done: false, frameWait: false };
    this.threads.push(th); this._drained = false;
    return th;
  };
  // 모자 블록 몸통 하나를 새 스레드로 (같은 빌더봇에서 이미 돌고 있으면 건너뜀)
  B.spawnBody = function (hat, bot) {
    bot = bot || this.mainBot();
    if (!bot || !this.threads) return null;
    if (this.threads.some(t => t.hat === hat && t.bot === bot && !t.done)) return null;
    if (this.threads.length >= 64) return null;
    if (this.stats) this.stats.evRuns = (this.stats.evRuns || 0) + 1;
    return this.newThread(this.runList(hat.c || []), bot, hat);
  };
  B.makeClone = function () {
    if (this.bots.length >= 31) { if (!this._cloneWarn) { this._cloneWarn = true; this.g.ui.toast('복제 빌더봇은 30개까지예요'); } return; }
    const b = this.newBot(true); b.hidden = this.th ? this.th.bot.hidden : false;
    this.bots.push(b);
    if (this.stats) this.stats.clones = (this.stats.clones || 0) + 1;
    for (const h of this.hats.whenClone) this.spawnBody(h, b);
  };
  B._enter = function (th) { this.loadBot(th.bot); this.depth = th.depth; this.curNode = th.node; this.waitT = 0; this.th = th; };
  B._leave = function (th) {
    this.storeBot(th.bot); th.depth = this.depth; th.node = this.curNode;
    if (this.waitT > 0) { th.waitT = this.waitT; this.waitT = 0; }
    this.th = null;
  };
  const _run = B.run;
  B.run = function (opt) {
    const ui = this.g.ui, cm = ui.closeModal;
    // 함께 보기: 코딩 창을 열어 둔 채로
    if (this.docked && ui.modal === 'code') ui.closeModal = function () { };
    try { _run.call(this, opt); } finally { ui.closeModal = cm; }
    if (!this.running || !this.gen) return;
    this.hookKeys();
    this.threads = []; this.newThread(this.gen, this.mainBot(), null).main = true;
    this.listening = LISTEN_HATS.size && Object.keys(this.hats).some(k => LISTEN_HATS.has(k) && this.hats[k].length);
    if (this.listening) { const hs = this.hatSummary(); if (hs) this.log('빌더봇 작업 시작! 🤖 그다음엔 ' + hs + ' 기다려요 (■ 멈춤까지)'); }
    code3Fill();
  };
  const _stop = B.stop;
  B.stop = function (quiet) {
    _stop.call(this, quiet);
    this.listening = false; this.threads = null; this.th = null;
    if (this.bots && this.bots.length) { this.loadBot(this.bots[0]); this.bots.length = 1; this.bots[0].say = null; }
    this.closeAsk();
    if (this.markRunning) this.markRunning();
  };
  const _reset = B.reset;
  B.reset = function () { _reset.call(this); this.bots = null; this.threads = null; this.listening = false; this.closeAsk(); };
  // 실행이 끝났을 때: 기다리는 이벤트가 있으면 계속 켜 둠
  const _fin = B.finishRun;
  B.finishRun = function () {
    const keep = this.listening && this.threads;
    if (keep && this.placed <= this._finPlaced && this._mainDone) { this.updateStatus(); return; }   // 이벤트 코드가 아무것도 안 지었으면 조용히
    // 이벤트를 기다리는 중의 검사는 「아직이에요」를 채팅에 쌓지 않음 (성공만 알림)
    const ui = this.g.ui, cl = ui.chatLine, quiet = keep && this._mainDone;
    if (quiet) ui.chatLine = function (t, c) { if (c !== '#ffb37a') cl.call(ui, t, c); };
    try { _fin.call(this); } finally { ui.chatLine = cl; }
    this._finPlaced = this.placed; this._mainDone = true;
    if (keep) { this.running = true; this.gen = true; this.updateStatus(true); }
    else { this.threads = null; if (this.bots) { this.loadBot(this.bots[0]); this.bots.length = 1; } this.closeAsk(); }   // 마지막 말풍선은 남겨 둠
  };
  B.threadError = function (th, e) {
    const g = this.g;
    if (e && e.botStop) { this.listening = false; this.finishRun(); this.stop(true); this.log('「코드 멈추기」 블록에서 멈췄어요'); return; }
    if (e && e.botBreak) { th.done = true; return; }
    if (e && e.botDel) { const b = th.bot; for (const t of this.threads) if (t.bot === b) t.done = true; const i = this.bots.indexOf(b); if (i > 0) this.bots.splice(i, 1); return; }
    if (e && e.botOut) { g.ui.chatLine(`🤖 빌더봇: ${itemName(e.botOut)}이(가) 다 떨어졌어요! 가방에 더 모아 오면 이어서 지을 수 있어요. (${this.placed}칸 지음)`, '#ffb37a'); g.ui.toast(`🤖 ${itemName(e.botOut)}이(가) 부족해요`); }
    else { g.ui.chatLine('🤖 코드 오류: ' + ((e && e.message) || e), '#f88'); this.log('🤖 코드 오류: ' + ((e && e.message) || e)); }
    this.stop();
  };
  // 한 프레임: 스레드를 돌아가며 한 걸음씩 (모두 기다리는 중이면 바로 끝)
  B.sched = function (budget, ms) {
    const t0 = performance.now(), list = this.threads.slice();
    let steps = 0, progressed = true;
    outer: while (steps < budget && progressed) {
      progressed = false;
      for (let i = 0; i < list.length; i++) {
        const th = list[i];
        if (steps >= budget || performance.now() - t0 > ms) break outer;
        if (th.done || th.waitT > 0 || th.frameWait) continue;
        this._enter(th);
        let r = null, err = null;
        const mr = Math.random; Math.random = this.rng;
        try { r = th.gen.next(); } catch (e) { err = e; } finally { Math.random = mr; }
        this._leave(th);
        progressed = true;
        if (err) { steps++; this.threadError(th, err); if (!this.running || !this.threads) return steps; continue; }
        if (r.done) { steps++; th.done = true; }
        else if (r.value === 'F') th.frameWait = true;   // 기다리는 중 (걸음으로 안 셈)
        else steps++;
        if (this.paused) break outer;
      }
      if (this.threads) for (const th of this.threads) if (!list.includes(th)) { list.push(th); progressed = true; }
    }
    if (this.threads) { for (const th of this.threads) th.frameWait = false; this.threads = this.threads.filter(th => !th.done); }
    return steps;
  };
  B.update = function (dt) {
    this.anim += dt;
    this.scanFound(dt);
    if (!this.running || !this.threads) { this.updateMonitors(); return; }
    this.pollEvents(dt);
    if (!this.paused || this.stepReq) {
      let budget;
      if (this.paused) { this.stepReq = false; budget = 1; for (const th of this.threads) th.waitT = 0; }
      else {
        for (const th of this.threads) if (th.waitT > 0) th.waitT -= dt;
        this.acc += dt * this.speed; budget = Math.floor(this.acc); this.acc -= budget; if (budget > 5000) budget = 5000;
        // 기다리는 코드만 있을 땐 화면마다 한 번은 살펴봄 (기다림이 끝났는지)
        if (budget < 1 && this.threads.some(t => !t.waitT && t.node && /^(waitUntil|ask|bcastWait)$/.test(t.node.t))) budget = 1;
      }
      const steps = this.threads.length && budget > 0 ? this.sched(budget, 12) : 0;
      if (!this.threads) { this.updateMonitors(); return; }
      if (this.bots && this.bots.length) this.loadBot(this.bots[0]);
      if (steps && (this.anim * 4 | 0) % 2 === 0) this.g.sound.play('bot', this.bx, this.by, this.bz);
      if (this.running && !this.threads.length && !this._drained) { this._drained = true; this.finishRun(); }
    }
    this.updateStatus();
    this.updateMonitors();
    if (this.markRunning) this.markRunning();
  };
  // ---- 이벤트 감지 ----
  B.hookKeys = function () {
    if (this._keysHooked || typeof document === 'undefined') return;
    this._keysHooked = true; this.keysDown = new Set();
    const typing = () => { const ae = document.activeElement, tg = ae && ae.tagName; return tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (ae && ae.isContentEditable); };
    document.addEventListener('keydown', (e) => {
      if (typing()) return;
      this.keysDown.add(e.code);
      if (e.repeat || !this.running || !this.listening || !this.threads || this.g.state !== 'play' || (this.g.ui.modal && !(this.docked && this.g.ui.modal === 'code'))) return;
      for (const h of this.hats.whenKey) if (h.a.k === e.code || h.a.k === 'any') this.spawnBody(h);
    });
    document.addEventListener('keyup', (e) => { this.keysDown.delete(e.code); });
    window.addEventListener('blur', () => this.keysDown.clear());
  };
  B.onChat = function (text) {
    if (!this.running || !this.listening || !this.threads) return;
    const t = String(text).trim().toLowerCase();
    for (const h of this.hats.whenChat) { const w = String(h.a.s || '').trim().toLowerCase(); if (w && (t === w || t.includes(w))) this.spawnBody(h); }
  };
  B.pollEvents = function (dt) {
    if (!this.listening) return;
    this._evT -= dt; if (this._evT > 0) return;
    this._evT = 0.1;
    const g = this.g, p = g.player, w = g.world;
    if (!p || !w) return;
    const id = w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.05), Math.floor(p.z));
    if (id !== this._stepId) {
      this._stepId = id;
      if (id) for (const h of this.hats.whenStep) if ((h.a.b === 'air' ? 0 : BL[h.a.b]) === id) this.spawnBody(h);
    }
    const night = w.dayFactor() <= 0.4;
    if (this._night !== undefined && night !== this._night) for (const h of this.hats.whenTime) if ((h.a.d === 'night') === night) this.spawnBody(h);
    this._night = night;
  };
  B.hatSummary = function () {
    const out = [];
    for (const h of this.hats.whenKey) out.push((CODE3_KEY_CHOICES.find(c => c[0] === h.a.k) || [0, h.a.k])[1] + ' 키');
    for (const h of this.hats.whenChat) out.push(`채팅 「${h.a.s}」`);
    for (const h of this.hats.whenStep) out.push((BLOCKS[BL[h.a.b]] ? BLOCKS[BL[h.a.b]].k : h.a.b) + ' 밟기');
    for (const h of this.hats.whenTime) out.push(h.a.d === 'night' ? '밤' : '아침');
    return [...new Set(out)].slice(0, 3).join(' · ');
  };
  // 상태 창: 이벤트를 기다리는 중
  const _us = B.updateStatus;
  B.updateStatus = function (force) {
    const el = typeof document !== 'undefined' && document.getElementById('bot-status');
    if (!el) return;
    if (this.running && !this.paused && this.threads && !this.threads.length && this.listening) {
      if (this._stMode !== 'listen' || force) {
        this._stMode = 'listen'; this._stTxt = null;
        el.classList.add('show');
        el.innerHTML = `👂 빌더봇이 기다려요 <small>${esc(this.hatSummary())}</small><span class="bs-btns"><button class="btn small red" id="bs-stop">멈춤</button></span>`;
        el.querySelector('#bs-stop').onclick = () => this.stop();
      }
      return;
    }
    if (this._stMode === 'listen') this._stMode = null;
    _us.call(this, force);
    if (this.threads && this.threads.length > 1 && (this._stMode === 'run' || this._stMode === 'pause')) {
      const cur = el.querySelector('.bs-cur'); if (cur) { const t = ` · 코드 ${this.threads.length}개`; if (!cur.textContent.endsWith(t)) cur.textContent = cur.textContent.replace(/ · 코드 \d+개$/, '') + t; }
    }
  };
  // ---- 말풍선 · 효과 ----
  B.botSay = function (text, think) {
    const b = this.th ? this.th.bot : this.mainBot(); if (!b) return 0;
    const tok = (this._sayTok = (this._sayTok || 0) + 1);
    b.say = text ? { text: String(text).slice(0, 160), think: !!think, tok } : null;
    return tok;
  };
  B.botFx = function (e) {
    const P = this.g.particles, x = this.bx + 0.5, y = this.by + 0.7, z = this.bz + 0.5, layer = T('white');
    const add = (vx, vy, vz, col, life, size, gr) => P.add({ x, y, z, vx, vy, vz, life, size, layer, u: 0, v: 0, g: gr, tint: col, emissive: true });
    const RB = [[1, 0.35, 0.4], [1, 0.65, 0.25], [1, 0.9, 0.3], [0.4, 0.9, 0.45], [0.35, 0.65, 1], [0.7, 0.45, 1]];
    switch (e) {
      case 'sparkle': for (let i = 0; i < 24; i++) add((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, [1, 0.95, 0.6], 0.8 + Math.random() * 0.5, 0.06, -0.5); break;
      case 'heart': for (let i = 0; i < 14; i++) add((Math.random() - 0.5) * 1.2, 1 + Math.random(), (Math.random() - 0.5) * 1.2, [1, 0.45, 0.65], 1.2, 0.1, -0.3); break;
      case 'rainbow': { const f = this.facing, rx = DX[CW[f]], rz = DZ[CW[f]]; for (let i = 0; i < 42; i++) { const t = (i / 42) * Math.PI, c = RB[(i / 7 | 0) % 6], r = 3; add(rx * Math.cos(t) * r, Math.sin(t) * r, rz * Math.cos(t) * r, c, 1.1, 0.1, 0); } break; }
      case 'smoke': P.smoke(x, y, z, 16, [0.85, 0.85, 0.85]); break;
      case 'note': for (let i = 0; i < 10; i++) add((Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5, RB[i % 6], 1, 0.08, -0.4); break;
    }
  };
  // ---- 묻고 기다리기 ----
  B.openAsk = function (q, th) {
    const g = this.g;
    this.asking = th;
    this.botSay(q, false);
    let box = document.getElementById('code-ask');
    if (!box) {
      box = document.createElement('div'); box.id = 'code-ask';
      box.innerHTML = '<div class="ca-q"></div><div class="ca-row"><input maxlength="120" autocomplete="off" placeholder="대답을 쓰고 Enter"><button class="btn small primary" type="button">✔</button></div>';
      document.getElementById('hud').appendChild(box);
      const inp = box.querySelector('input'), send = () => this.answerAsk(inp.value);
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });
      box.querySelector('button').onclick = send;
    }
    box.querySelector('.ca-q').textContent = '🤖 ' + q;
    const inp = box.querySelector('input'); inp.value = '';
    box.classList.add('show');
    if (!g.ui.modal) g.input.releaseLock();
    setTimeout(() => { try { inp.focus(); } catch (e) { } }, 30);
  };
  B.answerAsk = function (v) {
    const s = String(v || '').trim();
    this.answer = isNumLit(s) ? +s : s;
    const me = this.asking; this.asking = null;
    if (me && me.bot.say) me.bot.say = null;
    this.closeAsk();
    this.g.sound.play('pop');
    if (!this.g.ui.modal && !this.g.input.touch && this.g.input.requestLock) this.g.input.requestLock();
  };
  B.closeAsk = function () {
    this.asking = null;
    const box = typeof document !== 'undefined' && document.getElementById('code-ask');
    if (box) { box.classList.remove('show'); const inp = box.querySelector('input'); if (inp && document.activeElement === inp) inp.blur(); }
  };
  // ---- 📺 변수·목록 모니터 (게임 화면 왼쪽) ----
  B.monList = function () { if (!this._mon) { try { this._mon = JSON.parse(localStorage.getItem('educraft.codeMon') || '[]'); } catch (e) { this._mon = []; } if (!Array.isArray(this._mon)) this._mon = []; } return this._mon; };
  B.setMonitor = function (name, on) {
    const L = this.monList(), i = L.indexOf(name);
    if (on && i < 0) L.push(name); else if (!on && i >= 0) L.splice(i, 1);
    try { localStorage.setItem('educraft.codeMon', JSON.stringify(L)); } catch (e) { }
    this.monDirty = true; this.updateMonitors();
  };
  B.updateMonitors = function () {
    if (typeof document === 'undefined') return;
    const now = performance.now();
    if (!this.monDirty && now - (this._monT || 0) < 250) return;
    this._monT = now; this.monDirty = false;
    const L = this.monList();
    let box = document.getElementById('code-mon');
    if (!L.length && !box) return;
    if (!box) { box = document.createElement('div'); box.id = 'code-mon'; document.getElementById('hud').appendChild(box); }
    const vars = this.vars || {};
    let html = '';
    for (const k of L) {
      const v = vars[k];
      if (Array.isArray(v)) html += `<div class="mon list"><b>${esc(k)}</b><ol>${v.slice(0, 12).map(x => `<li>${esc(fmt3(x))}</li>`).join('')}${v.length > 12 ? '<li class="more">…</li>' : ''}</ol><small>항목 ${v.length}개</small></div>`;
      else html += `<div class="mon"><b>${esc(k)}</b><span>${esc(fmt3(v === undefined ? 0 : v))}</span></div>`;
    }
    if (html !== this._monHtml) { this._monHtml = html; box.innerHTML = html; }
    const show = L.length && this.g.state === 'play' ? '' : 'none';
    if (box.style.display !== show) box.style.display = show;
  };
  // ---- 그리기: 복제 빌더봇도 ----
  const _render = B.render;
  B.render = function (R, cam) {
    if (!this.visible) return;
    if (!this.bots || !this.bots.length) return _render.call(this, R, cam);
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i]; if (b.hidden) continue;
      this.renderBotAt(R, cam, { x: b.bx, y: b.by, z: b.bz, f: b.facing, t: this.anim + i * 0.37 });
    }
  };
  B.drawBubbles = function (cam) {
    const R = this.g.renderer;
    let box = document.getElementById('bot-bubbles');
    const list = this.visible && this.bots ? this.bots.filter(b => b.say && !b.hidden) : [];
    if (!box) { if (!list.length) return; box = document.createElement('div'); box.id = 'bot-bubbles'; document.getElementById('hud').appendChild(box); }
    while (box.children.length < list.length) { const d = document.createElement('div'); d.className = 'bb'; box.appendChild(d); }
    while (box.children.length > list.length) box.lastChild.remove();
    for (let i = 0; i < list.length; i++) {
      const b = list[i], el = box.children[i];
      const pr = R.project([b.bx + 0.5 - cam[0], b.by + 1.55 - cam[1], b.bz + 0.5 - cam[2]]);
      if (!pr || pr[2] > 48) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.transform = `translate(${pr[0] | 0}px, ${pr[1] | 0}px) translate(-50%, -100%)`;
      const cls = 'bb' + (b.say.think ? ' think' : '');
      if (el.className !== cls) el.className = cls;
      if (el._t !== b.say.text) { el._t = b.say.text; el.textContent = b.say.text; }
    }
  };
  const _ns = B.netState;
  B.netState = function () { if (this.bots && this.bots[0] && this.bots[0].hidden) return null; return _ns.call(this); };
}
// 채팅 → 「채팅에 ~라고 쓰면」, 이름표 그릴 때 말풍선도
{
  const U = UI.prototype;
  const _sc = U.submitChat;
  U.submitChat = function (v) { const r = _sc.call(this, v); if (v && v[0] !== '/' && this.g.builder && this.g.builder.onChat) this.g.builder.onChat(v); return r; };
  const _unt = U.updateNameTags;
  U.updateNameTags = function (cam) { _unt.call(this, cam); const b = this.g.builder; if (b && b.drawBubbles) b.drawBubbles(cam); };
}

// ---------------- 편집기 ----------------
{
  const B = Builder.prototype;
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5];
  // ---- 편집 되돌리기: 저장할 때마다 바뀐 것을 기록 (짧은 시간 연달아 바뀐 것은 한 번으로) ----
  const _save = B.saveProgram;
  B.saveProgram = function () {
    _save.call(this);
    if (this._histLock) return;
    const j = JSON.stringify(this.program), h = this.hist || (this.hist = { past: [], future: [], last: null, t: 0 });
    if (h.last === null) { h.last = j; return; }
    if (j === h.last) return;
    const now = performance.now();
    if (!(h.grouping && now - h.t < 900)) { h.past.push(h.last); if (h.past.length > 60) h.past.shift(); }
    h.grouping = !!this._typing; h.t = now; h.last = j; h.future.length = 0;
    this.histButtons();
  };
  B.histApply = function (j) {
    this._histLock = true;
    try { this.program = JSON.parse(j); this.renderWs(); } finally { this._histLock = false; }
    _save.call(this); this.histButtons();
    if (this.syncText) this.syncText();
  };
  B.editUndo = function () {
    const h = this.hist; if (!h || !h.past.length) { this.log('되돌릴 편집이 없어요'); return; }
    h.future.push(h.last); h.last = h.past.pop(); this.histApply(h.last); this.log('↶ 편집을 되돌렸어요');
  };
  B.editRedo = function () {
    const h = this.hist; if (!h || !h.future.length) { this.log('다시 할 편집이 없어요'); return; }
    h.past.push(h.last); h.last = h.future.pop(); this.histApply(h.last); this.log('↷ 다시 했어요');
  };
  B.histButtons = function () {
    const h = this.hist, u = document.getElementById('cd-eundo'), r = document.getElementById('cd-eredo');
    if (u) u.disabled = !(h && h.past.length); if (r) r.disabled = !(h && h.future.length);
  };
  // ---- 작업판 블록: 실행 중 표시용 기록 + 오른쪽 클릭 메뉴 ----
  const _be = B.blockEl;
  B.blockEl = function (node, inPalette) {
    const el = _be.call(this, node, inPalette);
    const def = CODE_DEFS[node.t];
    if (def && def.creative && el.classList.contains('locked')) { const w = el.querySelector('.lockwhy'); if (w) w.textContent = '🔒 크리에이티브에서만'; }
    if (!inPalette) {
      if (this.nodeEls) this.nodeEls.set(node, el);
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this.blockMenu(node, e.clientX, e.clientY); });
      // 터치: 길게 누르기
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' || e.target.closest('input, select, button')) return;
        const sx = e.clientX, sy = e.clientY; let gone = false;
        const mv = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cancel(); };
        const cancel = () => { gone = true; clearTimeout(t); document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', cancel); };
        const t = setTimeout(() => { if (gone) return; cancel(); if (this.drag && !this.drag.started) this.drag = null; this.blockMenu(node, sx, sy); }, 600);
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', cancel);
      }, true);
    }
    return el;
  };
  const _rws = B.renderWs;
  B.renderWs = function () {
    this.nodeEls = new Map();
    _rws.call(this);
    this._runEls = null;
    this.markRunning(true);
    this.applyZoom();
  };
  // 실행 중인 블록 빛내기 (함께 보기에서 보임)
  B.markRunning = function (force) {
    if (!this.nodeEls || !this.g.ui || this.g.ui.modal !== 'code') return;
    const now = new Set();
    if (this.running && this.threads) for (const th of this.threads) { if (th.node) { const el = this.nodeEls.get(th.node); if (el) now.add(el); } }
    else if (this.running && this.curNode) { const el = this.nodeEls.get(this.curNode); if (el) now.add(el); }
    const prev = this._runEls || new Set();
    let same = !force && prev.size === now.size; if (same) for (const el of now) if (!prev.has(el)) { same = false; break; }
    if (same) return;
    for (const el of prev) if (!now.has(el)) el.classList.remove('running');
    for (const el of now) el.classList.add('running');
    this._runEls = now;
  };
  // ---- 메뉴 ----
  B.menu = function (x, y, items) {
    this.closeMenu();
    const m = document.createElement('div'); m.className = 'cd-menu';
    for (const it of items) {
      if (!it) { m.appendChild(document.createElement('hr')); continue; }
      const b = document.createElement('button'); b.type = 'button'; b.textContent = it[0]; if (it[2]) b.disabled = true;
      b.onclick = (e) => { e.stopPropagation(); this.closeMenu(); it[1](); };
      m.appendChild(b);
    }
    document.body.appendChild(m);
    m.style.left = Math.max(4, Math.min(x, innerWidth - m.offsetWidth - 6)) + 'px'; m.style.top = Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 6)) + 'px';
    this._menu = m;
    setTimeout(() => { this._menuOff = (e) => { if (!m.contains(e.target)) this.closeMenu(); }; document.addEventListener('pointerdown', this._menuOff, true); }, 0);
  };
  B.closeMenu = function () { if (this._menu) { this._menu.remove(); this._menu = null; } if (this._menuOff) { document.removeEventListener('pointerdown', this._menuOff, true); this._menuOff = null; } };
  // 노드가 들어 있는 목록 / 입력칸 찾기
  B.locate = function (node) {
    const walkA = (n) => { for (const [k, v] of Object.entries(n.a || {})) if (v && typeof v === 'object' && v.t) { if (v === node) return { parent: n, key: k }; const r = walkA(v); if (r) return r; } return null; };
    const walk = (list) => {
      for (let i = 0; i < (list || []).length; i++) {
        const n = list[i]; if (n === node) return { list, i };
        const r = walkA(n) || walk(n.c) || walk(n.c2); if (r) return r;
      }
      return null;
    };
    return walk(this.program);
  };
  B.blockMenu = function (node, x, y) {
    const loc = this.locate(node); if (!loc) return;
    const def = CODE_DEFS[node.t] || {};
    const items = [];
    if (loc.list) {
      items.push(['⧉ 복제하기', () => { loc.list.splice(loc.i + 1, 0, JSON.parse(JSON.stringify(node))); this.renderWs(); }]);
      items.push(['🗑 지우기', () => { loc.list.splice(loc.i, 1); this.renderWs(); }]);
      if (loc.i < loc.list.length - 1) items.push(['🗑 이 블록부터 아래 모두 지우기', () => { loc.list.splice(loc.i); this.renderWs(); }]);
      items.push(null);
      items.push(['⬆ 위로 옮기기', () => { const L = loc.list; [L[loc.i - 1], L[loc.i]] = [L[loc.i], L[loc.i - 1]]; this.renderWs(); }, loc.i === 0]);
      items.push(['⬇ 아래로 옮기기', () => { const L = loc.list; [L[loc.i + 1], L[loc.i]] = [L[loc.i], L[loc.i + 1]]; this.renderWs(); }, loc.i >= loc.list.length - 1]);
      if (def.c && (node.c || []).length) items.push(['📤 안쪽 블록 꺼내기', () => { const inner = (node.c || []).concat(node.c2 || []); loc.list.splice(loc.i, 1, node, ...inner); node.c = []; if (node.c2) node.c2 = []; this.renderWs(); }]);
    } else {
      items.push(['🗑 값 블록 빼기', () => { const d = CODE_DEFS[loc.parent.t]; if (loc.key === 'e' && !d.r) { loc.parent.a.c = d.a.c; loc.parent.a.e = d.a.e || 'x > 3'; } else loc.parent.a[loc.key] = d.a[loc.key] !== undefined ? d.a[loc.key] : '0'; this.renderWs(); }]);
    }
    items.push(null, ['❓ 이 블록 설명', () => this.explain(node)]);
    this.menu(x, y, items);
  };
  const EXPLAIN = {
    whenMsg: '「신호 보내기」가 이 신호를 보내면 안쪽 블록을 해요. 「보내기」는 다 할 때까지 기다리고, 「보내고 바로 다음」은 함께 해요.',
    whenKey: '▶ 실행한 뒤, 게임 화면에서 이 키를 누를 때마다 안쪽 블록을 해요. ■ 멈춤을 누를 때까지 기다려요.',
    whenChat: '▶ 실행한 뒤 채팅(T)에 이 글자를 쓰면 안쪽 블록을 해요.',
    whenStep: '▶ 실행한 뒤 플레이어가 이 블록 위에 올라서면 안쪽 블록을 해요. 초인종·함정·자동문을 만들어 봐요!',
    whenTime: '▶ 실행한 뒤 밤이 되거나 아침이 되면 안쪽 블록을 해요.',
    whenClone: '「나를 복제하기」로 복제 빌더봇이 생기면, 그 복제 빌더봇이 안쪽 블록을 해요. 여럿이 함께 지어요!',
    bcastGo: '신호를 보내고 기다리지 않고 바로 다음 블록으로 가요. 신호를 받은 코드와 동시에 움직여요.',
    clone: '지금 빌더봇과 같은 자리·방향·블록을 가진 복제 빌더봇을 만들어요 (30개까지).',
    ask: '빌더봇이 물어보고 대답을 쓸 때까지 기다려요. 쓴 말은 「대답」 블록에 들어가요.',
    waitUntil: '조건이 맞을 때까지 이 자리에서 기다려요. 예: 밤이 될 때까지, 키를 누를 때까지.',
    op_join: '두 글자를 이어 붙여요. 「높이」 와(과) 「층」 → 「높이층」',
    op_expr: '식을 직접 써요: + - * / %, ( ), 비교 > < ==, and/or/not, random(1, 6), len(목록)',
    showVar: '변수나 목록의 값을 게임 화면 왼쪽에 보여 줘요. 코딩 창 「자료」의 📺 상자로도 켤 수 있어요.',
  };
  B.explain = function (n) {
    const d = CODE_DEFS[n.t] || {};
    const t = EXPLAIN[n.t] || (d.hat ? '모자 블록: 그 일이 생기면 안쪽 블록을 해요.' : d.r === 'b' ? '판단 블록(뾰족): 참/거짓. 「만약」·「동안」의 조건 칸에 끼워요.' : d.r ? '값 블록(둥근): 숫자·글자 칸에 끼워요.' : d.creative ? '세계 블록: 크리에이티브에서만 쓸 수 있어요.' : '「' + codeName(n.t) + '」 블록이에요.');
    this.log('❓ ' + t);
  };
  // ---- 확대·축소 ----
  B.applyZoom = function () {
    const ws = document.getElementById('cd-ws'); if (!ws) return;
    const sc = ws.querySelector('.code-script'); if (sc) sc.style.zoom = this.zoom && this.zoom !== 1 ? String(this.zoom) : '';
    const zb = document.getElementById('cd-z1'); if (zb) zb.textContent = Math.round((this.zoom || 1) * 100) + '%';
  };
  B.setZoom = function (d) {
    let i = ZOOMS.indexOf(this.zoom || 1); if (i < 0) i = 3;
    this.zoom = d === 0 ? 1 : ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + d))];
    lsSet('educraft.codeZoom', String(this.zoom)); this.applyZoom();
  };
  // ---- 팔레트: 블록 찾기 · 📺 모니터 상자 ----
  const _rp = B.renderPalette;
  B.renderPalette = function () {
    code3Fill();
    _rp.call(this);
    const pal = document.getElementById('cd-pal'); if (!pal) return;
    const list = pal.querySelector('.cp-list'); if (!list) return;
    const sw = document.createElement('div'); sw.className = 'cp-search';
    sw.innerHTML = '<input type="search" placeholder="🔍 블록 찾기 (예: 반복, 신호)" autocomplete="off">';
    list.insertBefore(sw, list.firstChild);
    const inp = sw.querySelector('input');
    inp.value = this._palQ || '';
    inp.addEventListener('keydown', e => e.stopPropagation());
    inp.addEventListener('pointerdown', e => e.stopPropagation());
    const filt = () => {
      const q = (this._palQ = inp.value.trim().toLowerCase());
      for (const el of list.children) {
        if (el === sw) continue;
        if (!q) { el.style.display = ''; continue; }
        if (el.classList.contains('cb')) { const t = el._node && CODE_DEFS[el._node.t] ? codeName(el._node.t).toLowerCase() : ''; el.style.display = t.includes(q) ? '' : 'none'; }
        else el.style.display = 'none';
      }
    };
    inp.oninput = filt; if (inp.value) filt();
    // 자료 범주: 화면에 보일 변수 고르기
    const h = [...list.querySelectorAll('.cp-h')].find(x => /자료/.test(x.textContent));
    if (h) {
      const box = document.createElement('div'); box.className = 'cp-mon';
      const names = this.varNamesInCode();
      box.innerHTML = '<b>📺 게임 화면에 보이기</b>' + (names.length ? names.map(n => `<label><input type="checkbox" data-v="${esc(n)}"${this.monList().includes(n) ? ' checked' : ''}> ${esc(n)}</label>`).join('') : '<small>코드에 변수나 목록을 쓰면 여기서 고를 수 있어요</small>');
      box.querySelectorAll('input').forEach(cb => { cb.onchange = () => this.setMonitor(cb.dataset.v, cb.checked); cb.addEventListener('pointerdown', e => e.stopPropagation()); });
      h.after(box);
    }
  };
  B.varNamesInCode = function () {
    const s = new Set();
    const walkA = (n) => { for (const [k, v] of Object.entries(n.a || {})) { if (v && typeof v === 'object' && v.t) { if (v.t === 'op_var') s.add(codeIdent(v.a.v)); walkA(v); } } };
    const walk = (list) => { for (const n of list || []) { const a = n.a || {}; if (/^(set|change|rand|for)$/.test(n.t) && a.v) s.add(codeIdent(a.v)); if (/^list/.test(n.t) && a.l) s.add(codeIdent(a.l)); if (n.t === 'func') for (const p of splitTop(a.p || '')) s.add(codeIdent(p)); walkA(n); walk(n.c); walk(n.c2); } };
    walk(this.program);
    for (const k of this.monList()) s.add(k);
    return [...s].filter(Boolean).slice(0, 30);
  };
  // ---- 열기: 위쪽 단추 더하기 ----
  const _oe = B.openEditor;
  B.openEditor = function () {
    this.docked = lsGet('educraft.codeDock', '0') === '1';
    this.zoom = +lsGet('educraft.codeZoom', '1') || 1;
    _oe.call(this);
    const s = document.getElementById('code-screen'); if (!s) return;
    s.classList.toggle('docked', !!this.docked); document.body.classList.toggle('code-docked', !!this.docked);
    const top = s.querySelector('.code-top'), close = s.querySelector('#cd-close');
    const mk = (id, txt, title, fn) => { const b = document.createElement('button'); b.className = 'btn small'; b.id = id; b.textContent = txt; b.title = title; b.onclick = fn; top.insertBefore(b, close); return b; };
    mk('cd-eundo', '↶', '편집 되돌리기 (Ctrl+Z)', () => this.editUndo());
    mk('cd-eredo', '↷', '다시 하기 (Ctrl+Y)', () => this.editRedo());
    mk('cd-dock', '📺 함께 보기', '코딩 창을 오른쪽에 두고, 빌더봇이 짓는 모습을 함께 봐요', () => {
      this.docked = !this.docked; lsSet('educraft.codeDock', this.docked ? '1' : '0'); s.classList.toggle('docked', this.docked); document.body.classList.toggle('code-docked', this.docked);
      this.log(this.docked ? '📺 함께 보기: 코딩 창을 열어 둔 채로 ▶ 실행하면 빌더봇이 짓는 모습이 왼쪽에 보여요. 실행 중인 블록이 빛나요!' : '함께 보기를 껐어요');
    });
    this.histButtons();
    // 확대·축소 (작업판 오른쪽 아래)
    const ws = s.querySelector('#cd-ws');
    if (ws && !s.querySelector('.ws-zoom')) {
      const z = document.createElement('div'); z.className = 'ws-zoom';
      z.innerHTML = '<button class="btn small" data-z="-1" title="작게">－</button><button class="btn small" id="cd-z1" data-z="0" title="원래 크기">100%</button><button class="btn small" data-z="1" title="크게">＋</button>';
      z.querySelectorAll('button').forEach(b => { b.onclick = () => this.setZoom(+b.dataset.z); });
      const sp = s.querySelector('.code-bottom .speed'); if (sp) sp.parentElement.insertBefore(z, sp); else ws.parentElement.appendChild(z);
      ws.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); this.setZoom(e.deltaY < 0 ? 1 : -1); } }, { passive: false });
      ws.addEventListener('contextmenu', (e) => { if (e.target.closest('.cb')) return; e.preventDefault(); this.menu(e.clientX, e.clientY, [['↶ 편집 되돌리기', () => this.editUndo(), !(this.hist && this.hist.past.length)], ['↷ 다시 하기', () => this.editRedo(), !(this.hist && this.hist.future.length)], null, ['🗑 작업판 비우기', () => { if (confirm('작업판을 비울까요? (↶ 로 되돌릴 수 있어요)')) { this.program = []; this.renderWs(); } }]]); });
    }
    this.applyZoom();
    // 키보드: Ctrl+Z / Ctrl+Y (글자 입력 중이 아닐 때)
    s.addEventListener('keydown', (e) => {
      const tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) this.editRedo(); else this.editUndo(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); this.editRedo(); }
    });
    // 입력칸을 고치는 동안은 한 번의 편집으로 묶음
    s.addEventListener('focusin', (e) => { if (e.target.tagName === 'INPUT') this._typing = true; });
    s.addEventListener('focusout', () => { this._typing = false; if (this.hist) this.hist.grouping = false; });
    // 명령어 목록에 새 명령도
    const ref = s.querySelector('#ct-ref');
    if (ref) ref.addEventListener('click', () => {
      const box = s.querySelector('#ct-refbox'); if (!box || box.querySelector('.ct3')) return;
      const tb = box.querySelector('table'); if (!tb) return;
      tb.insertAdjacentHTML('beforeend', `<tr class="ct3"><td colspan="3"><b>이벤트</b> <code>@on_key("G")</code> · <code>@on_chat("집")</code> · <code>@on_step("gold_block")</code> · <code>@on_time("night")</code> · <code>@on_clone()</code> 다음 줄에 <code>def 이름():</code> · <code>send_message_go("문")</code> (기다리지 않음)</td></tr>
        <tr class="ct3"><td colspan="3"><b>묻기·글자</b> <code>ask("몇 층?")</code> → <code>answer()</code> · <code>join("높이 ", x)</code> · <code>letter(글, 1)</code> · <code>len("사과")</code> · <code>contains(글, "나무")</code></td></tr>
        <tr class="ct3"><td colspan="3"><b>감지</b> <code>player_x() player_y() player_z() player_hp() timer() now("hour") count("cobblestone") key_pressed("G") block_name("front")</code></td></tr>`);
    });
    // 드래그 끝나면 지운 블록 안내 (팔레트에 놓으면 지워짐)
  };
  // 팔레트에 끌어다 놓으면 지우기
  const _dd = B.dragDrop;
  B.dragDrop = function (e) {
    const d = this.drag;
    if (d && d.started && !d.fromPalette && e && typeof e.clientX === 'number') {
      const pal = document.getElementById('cd-pal');
      if (pal) { const r = pal.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { this.drag = null; if (d.ghost) d.ghost.remove(); pal.classList.remove('trash'); this.renderWs(); this.log('🗑 블록을 지웠어요 (↶ 로 되돌릴 수 있어요)'); return; } }
    }
    const pal = document.getElementById('cd-pal'); if (pal) pal.classList.remove('trash');
    return _dd.call(this, e);
  };
  const _dm = B.dragMove;
  B.dragMove = function (e) {
    _dm.call(this, e);
    const d = this.drag; if (!d || !d.started || d.fromPalette) return;
    const pal = document.getElementById('cd-pal'); if (!pal) return;
    const r = pal.getBoundingClientRect();
    pal.classList.toggle('trash', e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  };
  const _ce = B.closeEditor;
  B.closeEditor = function () { this.closeMenu(); this.nodeEls = null; this._runEls = null; document.body.classList.remove('code-docked'); return _ce.call(this); };
}

// ---------------- 글자 코딩: 새 블록 ----------------
{
  PY_API.push(
    ['say_bubble', '말풍선', 'bubble', ['s:text'], '💬 말풍선으로 말하기'], ['say_for', '말풍선_초', 'sayFor', ['s:text', 'n'], 'n초 동안 말풍선'], ['think', '생각하기', 'think', ['s:text'], '💭 생각하기'],
    ['hide', '숨기기', 'hideBot', [], '빌더봇 숨기기'], ['show', '보이기', 'showBot', [], '빌더봇 보이기'], ['effect', '효과', 'fx', ['e:s'], '효과 "sparkle"'],
    ['ask', '묻기', 'ask', ['s:text'], '묻고 기다리기 → answer()'], ['reset_timer', '타이머_초기화', 'timerReset', [], '타이머를 0으로'],
    ['clone', '복제하기', 'clone', [], '복제 빌더봇 만들기'], ['delete_clone', '복제_없애기', 'cloneDel', [], '이 복제 빌더봇 없애기'],
    ['wait_until', '될때까지_기다리기', 'waitUntil', ['e'], '조건이 될 때까지 기다리기'], ['send_message_go', '신호_보내고_다음', 'bcastGo', ['m:s'], '신호 보내고 기다리지 않기'],
    ['go_to_world', '세계좌표로', 'gotoAbs', ['x', 'y', 'z'], '세계 좌표로 가기'], ['place_at_world', '세계좌표에_놓기', 'placeAbs', ['x', 'y', 'z'], '세계 좌표에 블록 놓기'],
    ['show_variable', '보이기_변수', 'showVar', ['v:s'], '변수를 화면에 보이기'], ['hide_variable', '숨기기_변수', 'hideVar', ['v:s'], '변수를 화면에서 숨기기'],
    ['set_time', '시간', 'wTime', ['t:s'], '"day" "night" (크리에이티브)'], ['set_weather', '날씨', 'wWeather', ['w:s'], '"clear" "rain" (크리에이티브)'],
    ['summon', '불러오기', 'wSummon', ['m:s'], '"pig" 불러오기 (크리에이티브)'], ['teleport_player', '순간이동', 'wTp', [], '플레이어를 빌더봇 자리로 (크리에이티브)'],
    ['give', '주기', 'wGive', ['b:s', 'n'], '"diamond" n개 주기 (크리에이티브)'], ['command', '명령어', 'wCmd', ['s:s'], '"time set day" (크리에이티브)'],
  );
  for (const r of PY_API) { if (!PY_BY_TYPE[r[2]]) PY_BY_TYPE[r[2]] = r; PY_BY_NAME[r[0]] = PY_BY_NAME[r[0]] || r; PY_BY_NAME[r[1]] = PY_BY_NAME[r[1]] || r; PY_RESERVED.add(r[0]); PY_RESERVED.add(r[1]); }
  for (const w of ['answer', 'timer', 'join', 'letter', 'contains', 'now', 'count']) PY_RESERVED.add(w);
  // 이벤트 모자 → 글자: 신호 모자 모양을 빌려서 바꿔 씀
  const HAT_PY = { whenKey: ['on_key', 'k'], whenChat: ['on_chat', 's'], whenStep: ['on_step', 'b'], whenTime: ['on_time', 'd'], whenClone: ['on_clone', null] };
  const MARK = '\u0001';
  const toMsgForm = (list) => (list || []).map(n => {
    const m = Object.assign({}, n, { a: Object.assign({}, n.a) });
    if (n.c) m.c = toMsgForm(n.c); if (n.c2) m.c2 = toMsgForm(n.c2);
    const hp = HAT_PY[n.t];
    if (hp) { const v = hp[1] ? String(n.t === 'whenKey' ? (KEY_WORD[n.a.k] || 'G') : n.a[hp[1]]) : ''; m.t = 'whenMsg'; m.a = { m: MARK + hp[0] + MARK + v }; }
    if (n.t === 'waitUntil' && n.a.c !== 'expr') { m.a.c = 'expr'; m.a.e = COND_PY[n.a.c] || 'block_ahead()'; }
    return m;
  });
  const _b2t = blocksToText;
  blocksToText = function (prog, opt) {
    let s = _b2t(toMsgForm(prog), opt);
    const label = (fn, v) => ({ on_key: `⌨ ${v} 키를 눌렀을 때`, on_chat: `💬 채팅에 「${v}」(이)라고 쓰면`, on_step: `👣 ${BLOCKS[BL[v]] ? BLOCKS[BL[v]].k : v} 을(를) 밟으면`, on_time: v === 'day' ? '☀ 아침이 되면' : '🌙 밤이 되면', on_clone: '🧬 복제 빌더봇으로 태어났을 때' })[fn] || '';
    s = s.replace(new RegExp('@on_message\\("' + MARK + '(on_\\w+)' + MARK + '([^"]*)"\\)\\n(\\s*)def when_message_(\\d+)\\(\\):[^\\n]*', 'g'), (m, fn, v, pad, k) => `@${fn}(${fn === 'on_clone' ? '' : pyStr(v)})\n${pad}def when_${fn.slice(3)}_${k}():${opt && opt.comments === false ? '' : '  # ' + label(fn, v)}`);
    s = s.replace(new RegExp(MARK, 'g'), '');
    return s;
  };
  const _t2b = textToBlocks;
  textToBlocks = function (src) {
    // @on_key("G") 같은 줄을 신호 모자 모양으로 바꿔서 읽은 뒤 되돌림
    const s2 = String(src).replace(/^(\s*)@(on_key|on_chat|on_step|on_time|on_clone)\s*\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)\s*$/gm, (m, pad, fn, a1, a2) => `${pad}@on_message("${MARK}${fn}${MARK}${a1 !== undefined ? a1 : a2 !== undefined ? a2 : ''}")`);
    const r = _t2b(s2);
    const fix = (list) => {
      for (const n of list || []) {
        if (n.t === 'whenMsg' && String(n.a.m).startsWith(MARK)) {
          const [, fn, v] = String(n.a.m).split(MARK);
          const t = Object.keys(HAT_PY).find(k => HAT_PY[k][0] === fn);
          n.t = t; n.a = Object.assign({}, CODE_DEFS[t].a);
          if (t === 'whenKey') n.a.k = WORD_KEY[String(v).toLowerCase()] || ('Key' + String(v).toUpperCase().slice(0, 1));
          else if (t === 'whenStep') { const d = BLOCKS.find(b => b && (b.name === v || b.k === v)); n.a.b = d ? d.name : 'gold_block'; }
          else if (t === 'whenTime') n.a.d = /day|아침|낮/.test(v) ? 'day' : 'night';
          else if (t === 'whenChat') n.a.s = v;
        }
        if (n.t === 'waitUntil') { const e = String(n.a.e || '').trim(); n.a.c = PY_COND[e] || 'expr'; if (PY_COND[e]) n.a.e = 'x > 3'; }
        fix(n.c); fix(n.c2);
      }
    };
    fix(r.prog);
    return r;
  };
}

// ---------------- 예제 ----------------
Object.assign(SAMPLE_PROGRAMS, {
  '⌨ 키로 짓는 빌더봇 (이벤트)': [
    { t: 'setblk', a: { b: 'concrete_lime' } }, { t: 'bubble', a: { s: 'G: 한 칸 쌓기 · H: 앞으로 · J: 폭죽!' } },
    { t: 'whenKey', a: { k: 'KeyG' }, c: [{ t: 'place', a: {} }, { t: 'up', a: { n: '1' } }] },
    { t: 'whenKey', a: { k: 'KeyH' }, c: [{ t: 'fwd', a: { n: '1' } }] },
    { t: 'whenKey', a: { k: 'KeyJ' }, c: [{ t: 'firework', a: { c: 'rainbow' } }, { t: 'bubble', a: { s: '멋지다!' } }] }],
  '🧬 복제 빌더봇 4명이 함께 (복제)': [
    { t: 'setblk', a: { b: 'stone_bricks' } },
    { t: 'whenClone', a: {}, c: [{ t: 'repeat', a: { n: '8' }, c: [{ t: 'place', a: {} }, { t: 'up', a: { n: '1' } }] }, { t: 'fx', a: { e: 'sparkle' } }, { t: 'cloneDel', a: {} }] },
    { t: 'repeat', a: { n: '4' }, c: [{ t: 'clone', a: {} }, { t: 'fwd', a: { n: '3' } }] },
    { t: 'sayFor', a: { s: '친구들, 기둥을 세워 줘!', n: '2' } }],
  '❓ 물어보고 짓는 탑 (묻고 기다리기)': [
    { t: 'ask', a: { s: '몇 층으로 지을까요? (1~30)' } }, { t: 'set', a: { v: '층', x: { t: 'op_answer', a: {} } } },
    { t: 'setblk', a: { b: 'quartz_block' } },
    { t: 'repeat', a: { n: { t: 'op_var', a: { v: '층' } } }, c: [{ t: 'place', a: {} }, { t: 'up', a: { n: '1' } }] },
    { t: 'bubble', a: { s: { t: 'op_join', a: { a: { t: 'op_var', a: { v: '층' } }, b: '층 탑 완성!' } } } }],
  '👣 밟으면 축하해 주는 발판 (이벤트)': [
    { t: 'setblk', a: { b: 'gold_block' } }, { t: 'placeDir', a: { d: 'd' } }, { t: 'bubble', a: { s: '금 블록을 밟아 봐!' } },
    { t: 'whenStep', a: { b: 'gold_block' }, c: [{ t: 'firework', a: { c: 'gold' } }, { t: 'sayFor', a: { s: '축하해요! 🎉', n: '2' } }, { t: 'bubble', a: { s: '또 밟아 봐!' } }] }],
  '🌙 밤이 되면 횃불 켜기 (이벤트)': [
    { t: 'bubble', a: { s: '밤이 되면 횃불을 켤게요 🌙' } },
    { t: 'whenTime', a: { d: 'night' }, c: [{ t: 'setblk', a: { b: 'torch' } }, { t: 'repeat', a: { n: '4' }, c: [{ t: 'place', a: {} }, { t: 'fwd', a: { n: '2' } }] }, { t: 'bubble', a: { s: '횃불 켰어요!' } }] },
    { t: 'whenTime', a: { d: 'day' }, c: [{ t: 'bubble', a: { s: '좋은 아침! ☀' } }] }],
  '⏱ 10초 안에 블록 많이 놓기 (타이머)': [
    { t: 'setblk', a: { b: 'concrete_orange' } }, { t: 'timerReset', a: {} }, { t: 'showVar', a: { v: '놓은수' } },
    { t: 'whilec', a: { c: 'expr', e: { t: 'cmp_lt', a: { a: { t: 'op_timer', a: {} }, b: '10' } } }, c: [{ t: 'place', a: {} }, { t: 'fwd', a: { n: '1' } }, { t: 'if', a: { c: 'ahead' }, c: [{ t: 'turnR', a: {} }] }] },
    { t: 'bubble', a: { s: { t: 'op_join', a: { a: '10초 동안 ', b: { t: 'op_join', a: { a: { t: 'op_placed', a: {} }, b: '칸!' } } } } } }],
});

// ---------------- 코딩 마스터: 6장을 「이벤트·목록」으로 (키·복제·묻기 3단계) ----------------
{
  const ch = CM_CHAPTERS.findIndex(c => c[0] === '신호·목록');
  if (ch >= 0) {
    CM_CHAPTERS[ch] = ['이벤트·목록', '신호·키·복제로 여러 코드를 깨우고, 목록에 값을 담아요.'];
    const NEW = [
      ['c30', ch, '키로 짓기', '「⌨ 키를 눌렀을 때」로 키를 3번 이상 눌러 6칸 이상 지어요', '▶ 실행한 뒤 코딩 창을 닫고 G 키를 눌러 봐요. 「⌨ G 키를 눌렀을 때」 안에 놓기 + 위로 1칸!', { must: [['whenKey']] },
        R => { const k = CM_B && CM_B.stats ? CM_B.stats.evRuns || 0 : 0; return [k >= 3 && R.n >= 6, `키로 깨운 횟수 ${k} / 3 · 블록 ${R.n} / 6`]; }],
      ['c31', ch, '복제 빌더봇', '「🧬 나를 복제하기」로 복제 빌더봇 3명 이상이 함께 12칸 이상', '「🧬 복제 빌더봇으로 태어났을 때」 안에 기둥 짓기 → 반복 안에서 「나를 복제하기」 + 「앞으로 2칸」.', { must: [['clone'], ['whenClone']] },
        R => { const c = CM_B && CM_B.stats ? CM_B.stats.clones || 0 : 0; return [c >= 3 && R.n >= 12, `복제 ${c} / 3 · 블록 ${R.n} / 12`]; }],
      ['c32', ch, '묻고 답하기', '「❓ 묻고 기다리기」로 물어보고, 「대답」 값으로 3칸 이상 지어요', '「대답」 블록을 「□번 반복하기」 칸에 끼워요. 대답에 숫자를 써 봐요!', { must: [['ask'], ['op_answer']] },
        R => [R.n >= 3, `블록 ${R.n} / 3`]],
    ];
    const at = CM_LIST.findIndex(m => m[0] === 'c27');
    CM_LIST.splice(at < 0 ? CM_LIST.length : at, 0, ...NEW);
  }
}
if (typeof ACH !== 'undefined' && ACH.cm6) { ACH.cm6.desc = '「이벤트·목록」 단계를 모두 깨요'; ACH.cm6.tip = '신호·키·복제로 코드를 깨우고, 목록에 값을 담아요.'; const r = ACH_LIST.find(a => a[0] === 'cm6'); if (r) { r[5] = ACH.cm6.desc; r[6] = ACH.cm6.tip; } }
