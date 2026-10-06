'use strict';
// =====================================================================
// 에듀 크래프트 v1.6 — 블록 코딩 고도화 (엔트리·스크래치처럼)
//  1) 범주: 왼쪽 색깔 막대(시작·움직임·건축·도형·흐름·판단·계산·자료·함수·말하기·소리·레드스톤)
//  2) 값 블록: 계산(＋−×÷ 나머지 무작위 수학), 판단(감지·비교·그리고/또는/아니다), 자료(변수·목록)를
//     입력칸에 끌어다 끼움. 값 블록은 식 글자로 바뀌어 계산됨(evalExpr) → 텍스트 코딩과 같은 길
//  3) 새 블록: 신호 보내기/받았을 때, 목록, 입력값이 있는 함수, ~인 동안 반복, 반복 멈추기, 음 연주·효과음·폭죽·크게 말하기
//  4) 텍스트 코딩: 블록 ↔ 파이썬 모양 글자 코드. 글자 코드를 블록에 적용·바로 실행. 오류는 몇째 줄인지 알려 줌
//  5) 코딩 마스터: 6장 「신호·목록」, 7장 「텍스트 코딩」 추가 (8장 29단계), 빌더봇 등급·도전 과제 맞춤
// =====================================================================
const CODE_CATS = [
  ['event', '시작', '#ffc34d', '▶'], ['move', '움직임', '#4c97ff', '➜'], ['build', '건축', '#3fbf7a', '■'], ['shape', '도형', '#9b7cf0', '◆'],
  ['ctrl', '흐름', '#ff9f40', '↻'], ['sense', '판단', '#3ab8d0', '?'], ['op', '계산', '#7cbf3a', '+'], ['data', '자료', '#f57eb6', 'x'],
  ['func', '함수', '#d4a020', 'ƒ'], ['look', '말하기', '#6a7fe0', '…'], ['sound', '소리', '#cf63cf', '♪'], ['rs', '레드스톤', '#ff6b81', '⚡'],
];
const CAT_COLOR = Object.fromEntries(CODE_CATS.map(c => [c[0], c[2]]));
// 예전 범주 → 새 범주
for (const t of ['set', 'change', 'rand']) if (CODE_DEFS[t]) CODE_DEFS[t].cat = 'data';
if (CODE_DEFS.say) CODE_DEFS.say.cat = 'look';
CODE_DEFS.func.text = '함수 #f 만들기 · 입력 #p'; CODE_DEFS.func.a = { f: '기둥', p: '' };
// 빌더봇이 스스로 바꾸는 이름 (목록·함수 입력으로 쓰면 값이 덮여 쓰임)
const BOT_VARS = new Set(['높이', '놓은수', '반복']);
CODE_DEFS.call.text = '함수 #f 실행하기 · 값 #args'; CODE_DEFS.call.a = { f: '기둥', args: '' };
// 새 블록 (r: 값 블록 'n' 숫자 / 'b' 참·거짓)
const CODE_DEFS2 = {
  whenMsg: { cat: 'event', text: '📣 #m 신호를 받았을 때', a: { m: '기둥' }, c: true, hat: true },
  broadcast: { cat: 'event', text: '📣 #m 신호 보내기', a: { m: '기둥' } },
  op_bot: { cat: 'move', r: 'n', text: '빌더봇 #k 위치', a: { k: 'x' } },
  op_placed: { cat: 'build', r: 'n', text: '놓은 블록 수', a: {} },
  whilec: { cat: 'ctrl', text: '#c 인 동안 반복', a: { c: 'aheadAir', e: 'x < 10' }, c: true },
  brk: { cat: 'ctrl', text: '반복 멈추기', a: {} },
  op_loop: { cat: 'ctrl', r: 'n', text: '반복 횟수', a: {} },
  s_cond: { cat: 'sense', r: 'b', text: '#c ?', a: { c: 'ahead' } },
  s_blockIs: { cat: 'sense', r: 'b', text: '#d 쪽 블록이 #b 인가?', a: { d: 'd', b: 'grass' } },
  s_dist: { cat: 'sense', r: 'n', text: '나와 빌더봇 사이 거리', a: {} },
  cmp_lt: { cat: 'sense', r: 'b', text: '#a < #b', a: { a: 'x', b: '5' } },
  cmp_eq: { cat: 'sense', r: 'b', text: '#a = #b', a: { a: 'x', b: '5' } },
  cmp_gt: { cat: 'sense', r: 'b', text: '#a > #b', a: { a: 'x', b: '5' } },
  b_and: { cat: 'sense', r: 'b', text: '#a 그리고 #b', a: { a: '1', b: '1' } },
  b_or: { cat: 'sense', r: 'b', text: '#a 또는 #b', a: { a: '1', b: '0' } },
  b_not: { cat: 'sense', r: 'b', text: '#a 이(가) 아니다', a: { a: '0' } },
  op_add: { cat: 'op', r: 'n', text: '#a + #b', a: { a: '1', b: '2' } },
  op_sub: { cat: 'op', r: 'n', text: '#a − #b', a: { a: '5', b: '2' } },
  op_mul: { cat: 'op', r: 'n', text: '#a × #b', a: { a: 'i', b: '2' } },
  op_div: { cat: 'op', r: 'n', text: '#a ÷ #b', a: { a: '10', b: '2' } },
  op_mod: { cat: 'op', r: 'n', text: '#a 를 #b 로 나눈 나머지', a: { a: 'i', b: '2' } },
  op_rand: { cat: 'op', r: 'n', text: '#a 부터 #b 사이 무작위 수', a: { a: '1', b: '10' } },
  op_math: { cat: 'op', r: 'n', text: '#f ( #n )', a: { f: 'abs', n: '-3' } },
  op_var: { cat: 'data', r: 'n', text: '변수 #v', a: { v: 'x' } },
  listAdd: { cat: 'data', text: '목록 #l 에 #v 넣기', a: { l: '막대', v: '3' } },
  listSet: { cat: 'data', text: '목록 #l 의 #n 번째를 #v 로 바꾸기', a: { l: '막대', n: '1', v: '5' } },
  listDel: { cat: 'data', text: '목록 #l 의 #n 번째 지우기', a: { l: '막대', n: '1' } },
  listClear: { cat: 'data', text: '목록 #l 비우기', a: { l: '막대' } },
  list_get: { cat: 'data', r: 'n', text: '목록 #l 의 #n 번째 항목', a: { l: '막대', n: '1' } },
  list_len: { cat: 'data', r: 'n', text: '목록 #l 의 길이', a: { l: '막대' } },
  list_has: { cat: 'data', r: 'b', text: '목록 #l 에 #v 이(가) 있는가?', a: { l: '막대', v: '3' } },
  shout: { cat: 'look', text: '화면에 크게 보여 주기 #s', a: { s: '완성!' } },
  note: { cat: 'sound', text: '🎵 #n 번 음을 #i 소리로 연주', a: { n: '12', i: 'harp' } },
  sfx: { cat: 'sound', text: '🔊 #s 효과음 내기', a: { s: 'levelup' } },
  firework: { cat: 'sound', text: '🎆 #c 폭죽 터뜨리기', a: { c: 'rainbow' } },
};
// 범주 순서대로 다시 정렬 (팔레트는 범주가 바뀔 때마다 제목을 붙이므로)
{
  const all = Object.assign({}, CODE_DEFS, CODE_DEFS2);
  for (const k of Object.keys(CODE_DEFS)) delete CODE_DEFS[k];
  for (const [cat] of CODE_CATS) for (const [k, v] of Object.entries(all)) if (v.cat === cat) CODE_DEFS[k] = v;
  for (const [k, v] of Object.entries(all)) if (!CODE_DEFS[k]) CODE_DEFS[k] = v;
}
for (const [cat, name] of CODE_CATS) CAT_NAMES[cat] = name;
// 서바이벌 열쇠 재료
Object.assign(CODE_KEYS, {
  whenMsg: [['#planks'], '판자'], broadcast: [['#planks'], '판자'],
  whilec: [['redstone_torch', 'iron_ingot'], '철 주괴'], brk: [['#coal', 'lever'], '석탄(또는 레버)'],
  s_cond: [['#coal', 'lever'], '석탄(또는 레버)'], s_blockIs: [['#coal', 'lever'], '석탄(또는 레버)'], s_dist: [['#coal', 'lever'], '석탄(또는 레버)'],
  cmp_lt: [['stick'], '막대기'], cmp_eq: [['stick'], '막대기'], cmp_gt: [['stick'], '막대기'], b_and: [['#coal', 'lever'], '석탄(또는 레버)'], b_or: [['#coal', 'lever'], '석탄(또는 레버)'], b_not: [['#coal', 'lever'], '석탄(또는 레버)'],
  op_add: [['stick'], '막대기'], op_sub: [['stick'], '막대기'], op_mul: [['stick'], '막대기'], op_div: [['stick'], '막대기'], op_mod: [['stick'], '막대기'], op_rand: [['flint', 'gravel'], '자갈'], op_math: [['stick'], '막대기'],
  op_var: [['book'], '책'], listAdd: [['chest'], '상자'], listSet: [['chest'], '상자'], listDel: [['chest'], '상자'], listClear: [['chest'], '상자'], list_get: [['chest'], '상자'], list_len: [['chest'], '상자'], list_has: [['chest'], '상자'],
  note: [['#planks'], '판자'], sfx: [['#planks'], '판자'], firework: [['gunpowder', 'paper'], '화약(또는 종이)'],
});
// 고르는 칸
const AXIS_CHOICES = [['x', '오른쪽(x)'], ['y', '위(y)'], ['z', '앞(z)']];
const MATH_CHOICES = [['abs', '절댓값'], ['round', '반올림'], ['floor', '내림'], ['sqrt', '제곱근'], ['sin', 'sin'], ['cos', 'cos']];
const INST_CHOICES = [['harp', '하프'], ['bass', '베이스'], ['bell', '종'], ['flute', '플루트'], ['chime', '차임'], ['guitar', '기타'], ['xylophone', '실로폰'], ['bit', '8비트'], ['basedrum', '큰북'], ['snare', '작은북'], ['hat', '심벌']];
const SFX_CHOICES = [['levelup', '레벨 업'], ['pop', '뽁'], ['victory', '승리'], ['portal', '차원문'], ['teleport', '순간이동'], ['explode', '펑!'], ['click_on', '딸깍'], ['splash', '첨벙'], ['door_open', '문 열림'], ['bot', '삐빅']];
const FIRE_CHOICES = [['rainbow', '무지개'], ['gold', '금빛'], ['pink', '분홍'], ['blue', '파랑'], ['green', '초록']];
const CH2 = {
  'op_bot.k': AXIS_CHOICES, 'op_math.f': MATH_CHOICES, 'note.i': INST_CHOICES, 'sfx.s': SFX_CHOICES, 'firework.c': FIRE_CHOICES,
  's_cond.c': COND_CHOICES.filter(c => c[0] !== 'expr'), 's_blockIs.d': DIR_CHOICES, 's_blockIs.b': 'blocks',
};
const NAME_KEYS = new Set(['v', 'l', 'f', 'p', 'm', 'args']);
const COND_PY = { ahead: 'block_ahead()', aheadAir: 'not block_ahead()', below: 'block_below()', belowAir: 'not block_below()', above: 'block_above()', here: 'block_here()', water: 'water_below()', coin: 'coin()', day: 'is_day()', night: 'is_night()', near: 'player_near()' };
const PY_COND = Object.fromEntries(Object.entries(COND_PY).map(([k, v]) => [v, k]));

// ---------------- 값 블록 → 식 글자 ----------------
function codeIdent(s) { let t = String(s == null ? '' : s).trim().replace(/[^0-9a-zA-Z가-힣_]+/g, '_'); if (!t) t = 'x'; if (/^\d/.test(t)) t = '_' + t; return t; }
function isNumLit(s) { return /^-?\d+(\.\d+)?$/.test(String(s).trim()); }
function exprMinus1(s) { s = String(s).trim(); if (isNumLit(s)) return String(+s - 1); const m = /^(.*?)\s*\+\s*1$/.exec(s); if (m) return m[1]; return s + ' - 1'; }
function exprPlus1(s) { s = String(s).trim(); if (isNumLit(s)) return String(+s + 1); const m = /^(.*?)\s*-\s*1$/.exec(s); if (m) return m[1]; return s + ' + 1'; }
function argExpr(v, dflt) {
  if (v && typeof v === 'object') { const e = repExpr(v); return /^[\w가-힣.]+(\(.*\))?$/.test(e) ? e : '(' + e + ')'; }
  const s = String(v == null ? '' : v).trim();
  return s || String(dflt == null ? '0' : dflt);
}
function argBare(v, dflt) { return v && typeof v === 'object' ? repExpr(v) : argExpr(v, dflt); }
function repExpr(n) {
  const a = n.a || {}, d = (CODE_DEFS[n.t] || { a: {} }).a, A = (k) => argExpr(a[k], d[k]);
  switch (n.t) {
    case 'op_add': return `${A('a')} + ${A('b')}`;
    case 'op_sub': return `${A('a')} - ${A('b')}`;
    case 'op_mul': return `${A('a')} * ${A('b')}`;
    case 'op_div': return `${A('a')} / ${A('b')}`;
    case 'op_mod': return `${A('a')} % ${A('b')}`;
    case 'op_rand': return `random(${A('a')}, ${A('b')})`;
    case 'op_math': return `${MATH_CHOICES.some(c => c[0] === a.f) ? a.f : 'abs'}(${A('n')})`;
    case 'op_var': return codeIdent(a.v);
    case 'op_bot': return `bot_${['x', 'y', 'z'].includes(a.k) ? a.k : 'x'}()`;
    case 'op_placed': return 'placed()';
    case 'op_loop': return 'loop_count()';
    case 's_cond': return COND_PY[a.c] || 'block_ahead()';
    case 's_blockIs': return `block_is("${a.d || 'd'}", "${a.b || 'grass'}")`;
    case 's_dist': return 'distance()';
    case 'cmp_lt': return `${A('a')} < ${A('b')}`;
    case 'cmp_eq': return `${A('a')} == ${A('b')}`;
    case 'cmp_gt': return `${A('a')} > ${A('b')}`;
    case 'b_and': return `${A('a')} and ${A('b')}`;
    case 'b_or': return `${A('a')} or ${A('b')}`;
    case 'b_not': return `not ${A('a')}`;
    case 'list_get': return `${codeIdent(a.l)}[${exprMinus1(argExpr(a.n, '1'))}]`;
    case 'list_len': return `len(${codeIdent(a.l)})`;
    case 'list_has': return `${A('v')} in ${codeIdent(a.l)}`;
  }
  return '0';
}
// 감지 함수 (식 안에서 씀). 계산할 때 BOT_CTX = 지금 빌더봇
let BOT_CTX = null;
{
  const C = (c) => () => (BOT_CTX ? (BOT_CTX.cond({ c }) ? 1 : 0) : 0);
  Object.assign(EXPR_FN, {
    block_ahead: C('ahead'), block_below: C('below'), block_above: C('above'), block_here: C('here'), water_below: C('water'), coin: C('coin'),
    is_day: C('day'), is_night: C('night'), player_near: C('near'),
    bot_x: () => BOT_CTX ? BOT_CTX.localPos()[0] : 0, bot_y: () => BOT_CTX ? BOT_CTX.localPos()[1] : 0, bot_z: () => BOT_CTX ? BOT_CTX.localPos()[2] : 0,
    placed: () => BOT_CTX ? BOT_CTX.placed : 0, loop_count: () => BOT_CTX && BOT_CTX.vars ? BOT_CTX.vars['반복'] || 0 : 0,
    distance: () => { const b = BOT_CTX; if (!b || !b.g.player) return 0; const p = b.g.player; return Math.round(Math.hypot(p.x - b.bx - 0.5, p.y - b.by, p.z - b.bz - 0.5) * 10) / 10; },
    block_is: (d, name) => {
      const b = BOT_CTX; if (!b) return 0;
      const dir = b.relDir(String(d)), id = b.sense(b.bx + DX[dir], b.by + DY[dir], b.bz + DZ[dir]);
      const want = name === 'air' ? 0 : BL[name];
      return id === want ? 1 : 0;
    },
  });
}

// ---------------- 빌더봇: 계산·조건·새 블록 실행 ----------------
{
  const B = Builder.prototype;
  B.localPos = function () {
    const f = this.startFacing, fv = [DX[f], DZ[f]], rv = [DX[CW[f]], DZ[CW[f]]], dx = this.bx - this.sx, dz = this.bz - this.sz;
    return [dx * rv[0] + dz * rv[1], this.by - this.sy, dx * fv[0] + dz * fv[1]];
  };
  const _num = B.num;
  B.num = function (s) {
    BOT_CTX = this;
    if (s && typeof s === 'object') {
      const c = this._rexp || (this._rexp = new Map());
      let ex = c.get(s); if (ex === undefined) { ex = repExpr(s); c.set(s, ex); }
      return _num.call(this, ex);
    }
    return _num.call(this, s);
  };
  const _cond = B.cond;
  B.cond = function (a) {
    BOT_CTX = this;
    if (a.c === 'expr' && a.e && typeof a.e === 'object') return this.num(a.e) !== 0;
    return _cond.call(this, a);
  };
  B.list = function (name) { const k = codeIdent(name); if (BOT_VARS.has(k)) throw new Error(`「${k}」는 빌더봇이 쓰는 이름이라 목록 이름으로 쓸 수 없어요`); if (!Array.isArray(this.vars[k])) this.vars[k] = []; return this.vars[k]; };
  B.textOf = function (s) {
    if (s && typeof s === 'object') { const v = this.num(s); return String(Math.round(v * 1000) / 1000); }
    return String(s || '').replace(/\{(\w+|[가-힣_][\w가-힣]*)\}/g, (_, k) => { const x = this.vars[k]; return Array.isArray(x) ? '[' + x.join(', ') + ']' : x !== undefined ? x : '?'; });
  };
  const _begin = B.begin;
  B.begin = function (pv) {
    _begin.call(this, pv);
    this._rexp = new Map(); this.msgs = {};
    const walk = (list) => { for (const n of list || []) { if (n.t === 'whenMsg') { const k = String(n.a && n.a.m || '').trim(); (this.msgs[k] || (this.msgs[k] = [])).push(n); } walk(n.c); walk(n.c2); } };
    walk(this.program);
    if (this.stats) this.stats.msgRuns = 0;
    this.runFromText = !!(this.textSig && this.textSig === codeSig(this.program));
  };
  const _locked = B.lockedIn;
  B.lockedIn = function (list, out) {
    out = _locked.call(this, list, out);
    const walkA = (n) => { for (const v of Object.values(n.a || {})) if (v && typeof v === 'object' && v.t) { if (CODE_DEFS[v.t] && !this.isOpen(v.t)) out.add(v.t); walkA(v); } };
    const walk = (l) => { for (const n of l || []) { walkA(n); walk(n.c); walk(n.c2); } };
    walk(list);
    return out;
  };
  const _exec = B.exec;
  B.exec = function* (n) {
    const a = n.a || {};
    switch (n.t) {
      case 'whenMsg': return;
      case 'broadcast': {
        const name = String(a.m || '').trim(), hs = (this.msgs && this.msgs[name]) || [];
        if (!hs.length) { if (!this.dry) this.g.ui.chatLine(`🤖 「${name}」 신호를 받을 블록이 없어요 (📣 ${name} 신호를 받았을 때)`, '#ffb37a'); return; }
        if (this.depth > 40) throw new Error('신호가 너무 여러 번 겹쳐 보내졌어요 (40번까지)');
        this.depth++;
        try { for (const h of hs) { if (this.stats) this.stats.msgRuns = (this.stats.msgRuns || 0) + 1; yield* this.runList(h.c || []); } } finally { this.depth--; }
        return;
      }
      case 'whilec': { for (let k = 0; k < 10000 && this.cond(a); k++) { this.vars['반복'] = k + 1; if (yield* this.loopBody(n.c)) break; yield; } return; }
      case 'brk': throw { botBreak: true };
      case 'listAdd': { const L = this.list(a.l); if (L.length < 10000) L.push(this.num(a.v)); return; }
      case 'listSet': { const L = this.list(a.l), i = this.inum(a.n) - 1; if (i >= 0 && i < 10000) { while (L.length <= i) L.push(0); L[i] = this.num(a.v); } return; }
      case 'listDel': { const L = this.list(a.l), i = this.inum(a.n) - 1; if (i >= 0 && i < L.length) L.splice(i, 1); return; }
      case 'listClear': this.list(a.l); this.vars[codeIdent(a.l)] = []; return;
      case 'shout': { if (!this.dry) { const s = this.textOf(a.s); this.g.ui.toast('🤖 ' + s, 3500); this.g.ui.chatLine('🤖 빌더봇: ' + s, '#9ff'); } return; }
      case 'say': { if (!this.dry) { const s = this.textOf(a.s); this.g.ui.chatLine('🤖 빌더봇: ' + s, '#9ff'); this.g.ui.toast('🤖 ' + s); } return; }
      case 'note': {
        if (!this.dry) {
          const nn = ((this.inum(a.n) % 25) + 25) % 25, inst = INST_CHOICES.some(c => c[0] === a.i) ? a.i : 'harp';
          this.g.sfx('note', this.bx + 0.5, this.by + 0.5, this.bz + 0.5, { note: nn, inst });
          const h = nn / 24; this.g.particles.dust(this.bx + 0.5, this.by + 1.2, this.bz + 0.5, [clamp(Math.abs(h * 6 - 3) - 1, 0, 1), clamp(2 - Math.abs(h * 6 - 2), 0, 1), clamp(2 - Math.abs(h * 6 - 4), 0, 1)]);
          this.waitT = Math.max(this.waitT || 0, 0.18);
        }
        yield; return;
      }
      case 'sfx': if (!this.dry) this.g.sound.play(SFX_CHOICES.some(c => c[0] === a.s) ? a.s : 'pop', this.bx + 0.5, this.by + 0.5, this.bz + 0.5); yield; return;
      case 'firework': {
        if (!this.dry) {
          const C = { rainbow: [[1, 0.4, 0.4], [1, 0.8, 0.3], [0.4, 1, 0.5], [0.4, 0.7, 1], [0.8, 0.5, 1]], gold: [[1, 0.85, 0.3], [1, 1, 0.6]], pink: [[1, 0.5, 0.8], [1, 0.75, 0.9]], blue: [[0.4, 0.7, 1], [0.6, 0.9, 1]], green: [[0.4, 1, 0.5], [0.7, 1, 0.6]] }[a.c] || [[1, 1, 1]];
          for (let k = 0; k < C.length; k++) this.g.particles.smoke(this.bx + 0.5, this.by + 3, this.bz + 0.5, 14, C[k], true);
          this.g.sound.play('explode', this.bx, this.by + 3, this.bz, { vol: 0.5 }); this.g.sound.play('levelup', this.bx, this.by, this.bz);
        }
        yield; return;
      }
      case 'call': {
        const name = String(a.f || '').trim(), fn = this.funcs && this.funcs[name];
        const params = fn ? splitTop(String(fn.a && fn.a.p || '')).map(codeIdent).filter(Boolean) : [];
        if (!params.length) break;
        const clash = params.find(p => BOT_VARS.has(p)); if (clash) throw new Error(`「${clash}」는 빌더봇이 쓰는 이름이라 함수 입력 이름으로 쓸 수 없어요 (예: 층, 크기)`);
        const vals = splitTop(String(a.args || '')).map(x => this.num(x));
        const saved = params.map(p => this.vars[p]);
        params.forEach((p, i) => { this.vars[p] = vals[i] !== undefined ? vals[i] : 0; });
        try { yield* _exec.call(this, n); } finally { params.forEach((p, i) => { this.vars[p] = saved[i]; }); }
        return;
      }
    }
    yield* _exec.call(this, n);
  };
}
// 쉼표로 나누기 (괄호·따옴표 안의 쉼표는 그대로)
function splitTop(s) {
  const out = []; let depth = 0, q = null, cur = '';
  for (const ch of String(s)) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function codeSig(prog) { return JSON.stringify(prog || []); }

// ---------------- 편집기: 범주 막대 · 값 블록 끼우기 ----------------
{
  const B = Builder.prototype;
  // 블록 고르기 목록(수백 개)은 한 번 만든 HTML을 재사용 (칸마다 option을 새로 만들면 1칸에 4ms)
  B.blockOptionsHTML = function (withAir) {
    const found = this.survival() ? this.g.found : null, key = (found ? 's' + found.size : 'all') + (withAir ? 'A' : '');
    const c = this._optCache || (this._optCache = {});
    if (c[key]) return c[key];
    const gr = BUILD_BLOCK_CHOICES(found);
    if (withAir) { gr['건축'] = gr['건축'] || []; if (!gr['건축'].some(x => x[0] === 'air')) gr['건축'].unshift(['air', '공기']); }
    let h = '';
    for (const k in gr) { h += `<optgroup label="${esc(k)}">`; for (const [n, kk] of gr[k]) h += `<option value="${esc(n)}">${esc(kk)}</option>`; h += '</optgroup>'; }
    return (c[key] = h);
  };
  B.selectEl = function (node, key, def, choices) {
    const el = document.createElement('select'), v = node.a[key] !== undefined ? node.a[key] : def.a[key];
    if (choices === 'blocks') {
      // 처음엔 고른 블록 하나만 → 누르거나 포커스가 오면 전체 목록을 채움 (작업판 그리기·배치가 빨라짐)
      const d = v === 'air' ? null : BLOCKS[BL[v]], o = document.createElement('option'); o.value = v; o.textContent = v === 'air' ? '공기' : d ? (d.k || d.name) : v; el.appendChild(o);
      const fill = () => { if (el._full) return; el._full = true; el.innerHTML = this.blockOptionsHTML(node.t === 's_blockIs'); el.value = v; };
      el.addEventListener('pointerdown', fill); el.addEventListener('focus', fill); el.addEventListener('keydown', fill);
    }
    else for (const [n, kk] of choices) { const o = document.createElement('option'); o.value = n; o.textContent = kk; el.appendChild(o); }
    el.value = v;
    el.addEventListener('pointerdown', e => e.stopPropagation()); el.addEventListener('keydown', e => e.stopPropagation());
    el.onchange = () => { node.a[key] = el.value; this.saveProgram(); this.afterEdit(); };
    return el;
  };
  B.slotWrap = function (node, key, child, cls) { const s = document.createElement('span'); s.className = 'rslot' + (cls ? ' ' + cls : ''); s._slot = { node, key }; s.appendChild(child); return s; };
  B.nestEl = function (rep, parent, key) { const el = this.repEl(rep, false); el._parent = { node: parent, key }; return el; };
  const _ai = B.argInput;
  B.argInput = function (node, key, def) {
    if (key === 'c' && !def.r && !CH2[node.t + '.c']) return this.condSlot(node, def);   // 폭죽 색(c)은 조건이 아님
    const v = node.a[key];
    if (v && typeof v === 'object' && v.t) return this.slotWrap(node, key, this.nestEl(v, node, key));
    const ch = node.t === 'setblk' && key === 'b' ? 'blocks' : CH2[node.t + '.' + key];
    const el = ch ? this.selectEl(node, key, def, ch) : _ai.call(this, node, key, def);
    if (el.tagName === 'INPUT') {
      el.addEventListener('input', () => this.afterEdit());
      if (NAME_KEYS.has(key)) { el.classList.add('nm'); el.placeholder = key === 'p' || key === 'args' ? '없음' : ''; return el; }
      return this.slotWrap(node, key, el);
    }
    return el;
  };
  B.condSlot = function (node, def) {
    if (node.a.c === 'expr' && node.a.e && typeof node.a.e === 'object') return this.slotWrap(node, 'e', this.nestEl(node.a.e, node, 'e'), 'cond');
    const inner = this.condInput(node, def);
    for (const el of inner.querySelectorAll('select, input')) el.addEventListener('change', () => this.afterEdit());
    return this.slotWrap(node, 'e', inner, 'cond');
  };
  // 값 블록 모양 (둥근 = 숫자, 뾰족 = 참·거짓)
  B.repEl = function (node, inPalette) {
    const def = CODE_DEFS[node.t];
    const el = document.createElement('div');
    const locked = !this.isOpen(node.t);
    el.className = 'cb rep c-' + def.cat + (def.r === 'b' ? ' bool' : '') + (locked ? ' locked' : '');
    for (const part of def.text.split(/(#\w+)/)) {
      if (!part) continue;
      if (part[0] === '#') el.appendChild(this.argInput(node, part.slice(1), def));
      else { const sp = document.createElement('span'); sp.textContent = part; el.appendChild(sp); }
    }
    if (locked && inPalette) { const w = document.createElement('span'); w.className = 'lockwhy'; w.textContent = `🔒 ${CODE_KEYS[node.t][1]}`; el.appendChild(w); }
    el._node = node;
    if (locked && inPalette) { el.addEventListener('pointerdown', e => { e.preventDefault(); this.log(`🔒 「${codeName(node.t)}」 블록은 ${CODE_KEYS[node.t][1]}을(를) 처음 얻으면 열려요.`); }); return el; }
    el.addEventListener('pointerdown', e => this.dragStart(e, node, el, inPalette, el._parent));
    return el;
  };
  const _be = B.blockEl;
  B.blockEl = function (node, inPalette) {
    const def = CODE_DEFS[node.t];
    if (def && def.r) return this.repEl(node, inPalette);
    const el = _be.call(this, node, inPalette);
    if (def && def.hat) el.classList.add('hat');
    return el;
  };
  // 왼쪽 범주 막대 + 블록 목록
  B.renderPalette = function () {
    const pal = document.getElementById('cd-pal'); if (!pal) return;
    pal.classList.add('v2'); pal.innerHTML = '';
    if (this.survival()) {
      const all = Object.keys(CODE_DEFS), open = all.filter(t => this.isOpen(t)).length;
      const pr = document.createElement('div'); pr.className = 'code-progress';
      pr.innerHTML = `🔓 열린 코딩 블록 <b>${open}</b> / ${all.length} · 재료를 처음 얻으면 하나씩 열려요`;
      pal.appendChild(pr);
    }
    const wrap = document.createElement('div'); wrap.className = 'cp-wrap'; pal.appendChild(wrap);
    const rail = document.createElement('div'); rail.className = 'cp-rail'; wrap.appendChild(rail);
    const list = document.createElement('div'); list.className = 'cp-list'; wrap.appendChild(list);
    const heads = [];
    for (const [cat, name, col, ic] of CODE_CATS) {
      const types = Object.keys(CODE_DEFS).filter(t => CODE_DEFS[t].cat === cat);
      if (!types.length) continue;
      const lockedN = this.survival() ? types.filter(t => !this.isOpen(t)).length : 0;
      const b = document.createElement('button'); b.className = 'cp-cat'; b.dataset.cat = cat;
      b.innerHTML = `<span class="dot" style="background:${col}">${ic}</span><small>${name}</small>${lockedN === types.length ? '<i class="lk">🔒</i>' : ''}`;
      rail.appendChild(b);
      const h = document.createElement('h5'); h.className = 'cp-h'; h.innerHTML = `<span class="dot" style="background:${col}"></span>${name}`; list.appendChild(h);
      heads.push([h, b]);
      b.onclick = () => { list.scrollTo({ top: h.offsetTop - 4, behavior: 'smooth' }); };
      if (cat === 'sense' || cat === 'op') { const tip = document.createElement('p'); tip.className = 'cp-tip'; tip.textContent = cat === 'sense' ? '◇ 뾰족한 블록은 「만약」·「동안」 칸에 끼워요' : '◯ 둥근 블록은 숫자 칸에 끌어다 끼워요'; list.appendChild(tip); }
      for (const t of types) {
        const def = CODE_DEFS[t];
        const node = { t, a: Object.assign({}, def.a) }; if (def.c) node.c = []; if (def.c2) node.c2 = [];
        list.appendChild(this.blockEl(node, true));
      }
    }
    const mark = () => {
      const top = list.scrollTop + 10; let cur = heads[0];
      for (const hb of heads) if (hb[0].offsetTop <= top) cur = hb;
      for (const hb of heads) hb[1].classList.toggle('on', hb === cur);
    };
    let tk = 0; list.addEventListener('scroll', () => { if (tk) return; tk = requestAnimationFrame(() => { tk = 0; mark(); }); });
    mark();
  };
  // ---- 끌어다 놓기 (값 블록은 입력칸에) ----
  B.dragStart = function (e, node, el, fromPalette, parentSlot) {
    if (e.button && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    this.drag = { node, el, fromPalette, parentSlot: parentSlot || null, sx: e.clientX, sy: e.clientY, started: false, rep: !!(CODE_DEFS[node.t] && CODE_DEFS[node.t].r) };
    const mv = (ev) => this.dragMove(ev), up = (ev) => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); this.dragDrop(ev); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  };
  const resetSlot = (ps) => {
    const n = ps.node, def = CODE_DEFS[n.t];
    if (ps.key === 'e' && !def.r) { n.a.c = def.a.c; n.a.e = def.a.e || 'x > 3'; }
    else n.a[ps.key] = def.a[ps.key] !== undefined ? def.a[ps.key] : '0';
  };
  B.dragMove = function (e) {
    const d = this.drag; if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 7) return;
      d.started = true;
      if (d.parentSlot) { resetSlot(d.parentSlot); this.renderWs(); }
      else if (!d.fromPalette) { this.removeNode(d.node); this.renderWs(); }
      else d.node = JSON.parse(JSON.stringify(d.node));
      const gh = this.blockEl(d.node, true); gh.classList.add('ghost'); gh.style.width = d.rep ? 'auto' : Math.min(360, d.el.offsetWidth) + 'px';
      document.body.appendChild(gh); d.ghost = gh;
    }
    d.ghost.style.left = (e.clientX - 20) + 'px'; d.ghost.style.top = (e.clientY - 16) + 'px';
    const ws = document.getElementById('cd-ws'); if (!ws) return;
    const wr = ws.getBoundingClientRect();
    const inWs = e.clientX >= wr.left && e.clientX <= wr.right && e.clientY >= wr.top && e.clientY <= wr.bottom;
    for (const l of ws.querySelectorAll('.dropline.on, .rslot.on')) l.classList.remove('on');
    d.target = null; d.slot = null;
    if (inWs && d.rep) {
      const hit = document.elementFromPoint(e.clientX, e.clientY), sl = hit && hit.closest && hit.closest('.rslot');
      if (sl && ws.contains(sl) && sl._slot) {
        const boolOk = sl.classList.contains('cond') ? CODE_DEFS[d.node.t].r === 'b' : true;
        if (boolOk) { sl.classList.add('on'); d.slot = sl._slot; }
      }
    } else if (inWs) {
      let best = null, bd = 1e9;
      for (const l of ws.querySelectorAll('.dropline')) {
        if (this.isInside(l._list, d.node)) continue;
        const r = l.getBoundingClientRect();
        const dy = Math.abs(e.clientY - (r.top + r.height / 2)), dx = e.clientX < r.left ? r.left - e.clientX : 0, dist = dy + dx * 0.5;
        if (dist < bd) { bd = dist; best = l; }
      }
      if (best) best.classList.add('on');
      d.target = best;
    }
    if (inWs) { if (e.clientY > wr.bottom - 40) ws.scrollTop += 12; else if (e.clientY < wr.top + 40) ws.scrollTop -= 12; }
  };
  B.dragDrop = function () {
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (d.ghost) d.ghost.remove();
    if (!d.started) {
      if (d.fromPalette && d.rep) { this.log('◯ 값 블록은 숫자 칸(또는 ◇ 조건 칸)에 끌어다 끼워요'); return; }
      if (d.fromPalette) { const n = JSON.parse(JSON.stringify(d.node)); this.program.push(n); this.renderWs(); const ws = document.getElementById('cd-ws'); if (ws) ws.scrollTop = ws.scrollHeight; }
      return;
    }
    if (d.rep) {
      if (d.slot) { const s = d.slot; if (s.key === 'e' && !CODE_DEFS[s.node.t].r) { s.node.a.c = 'expr'; s.node.a.e = d.node; } else s.node.a[s.key] = d.node; }
    } else if (d.target) d.target._list.splice(d.target._index, 0, d.node);
    this.renderWs();
  };
  // 블록이 바뀌면 (나란히 보기일 때) 글자 코드도 새로
  B.afterEdit = function () { clearTimeout(this._aeT); this._aeT = setTimeout(() => this.syncText && this.syncText(), 250); };
  const _rws = B.renderWs;
  B.renderWs = function () { _rws.call(this); this.afterEdit(); };
}

// ---------------- 텍스트 코딩: 블록 → 글자 ----------------
const DIR_WORD = { f: 'front', b: 'back', l: 'left', r: 'right', u: 'up', d: 'down' };
const WORD_DIR = { front: 'f', back: 'b', left: 'l', right: 'r', up: 'u', down: 'd', '앞': 'f', '뒤': 'b', '왼쪽': 'l', '오른쪽': 'r', '위': 'u', '아래': 'd' };
const FACE_WORD = { n: 'north', e: 'east', s: 'south', w: 'west' };
const WORD_FACE = { north: 'n', east: 'e', south: 's', west: 'w', '북': 'n', '동': 'e', '남': 's', '서': 'w', '북쪽': 'n', '동쪽': 'e', '남쪽': 's', '서쪽': 'w' };
// [파이썬 이름, 한글 이름, 블록, [입력칸:종류], 설명]  종류: e 식(기본) · s 글자 · block 블록 이름 · dir 방향 · face 동서남북 · bool 참거짓 · fill 속빈/꽉찬 · text 말(f"…")
const PY_API = [
  ['forward', '앞으로', 'fwd', ['n'], '앞으로 n칸'], ['back', '뒤로', 'back', ['n'], '뒤로 n칸'], ['up', '위로', 'up', ['n'], '위로 n칸'], ['down', '아래로', 'down', ['n'], '아래로 n칸'],
  ['left', '왼쪽으로', 'left', ['n'], '왼쪽으로 n칸'], ['right', '오른쪽으로', 'right', ['n'], '오른쪽으로 n칸'],
  ['turn_left', '왼쪽으로_돌기', 'turnL', [], '왼쪽으로 돌기'], ['turn_right', '오른쪽으로_돌기', 'turnR', [], '오른쪽으로 돌기'], ['turn_around', '뒤로_돌기', 'turnB', [], '뒤로 돌기'],
  ['go_home', '처음_자리로', 'home', [], '처음 자리로'], ['goto', '이동하기', 'goto', ['x', 'y', 'z'], '시작점 기준 (오른쪽, 위, 앞)으로'], ['face', '바라보기', 'face', ['d:face'], '"north" 북쪽 보기'], ['come_here', '부르기', 'come', [], '빌더봇을 내 앞으로'],
  ['block', '블록', 'setblk', ['b:block'], '블록 고르기 "stone_bricks"'], ['color', '색깔', 'setcolor', ['k:s', 'n'], '"wool" 색 번호 n'], ['place', '놓기', 'place', [], '지금 자리에 놓기'],
  ['place_at', '방향_놓기', 'placeDir', ['d:dir'], '"down" 쪽에 놓기'], ['dig', '부수기', 'dig', [], '지금 자리 부수기'], ['pen', '펜', 'pen', ['on:bool'], 'True 면 지나간 자리에 놓기'],
  ['wall', '벽', 'wall', ['w', 'h'], '벽 길이·높이'], ['floor', '바닥', 'floor', ['d', 'w'], '바닥 앞·오른쪽'], ['box', '상자', 'box', ['d', 'w', 'h', 'fill:fill'], '상자 앞·오른쪽·높이 "hollow"'],
  ['sphere', '구', 'sphere', ['r', 'fill:fill'], '구 반지름'], ['cylinder', '원기둥', 'cyl', ['r', 'h', 'fill:fill'], '원기둥'], ['pyramid', '피라미드', 'pyramid', ['s'], '피라미드 크기'],
  ['house', '집', 'house', ['d', 'w', 'h'], '집 짓기'], ['tower', '탑', 'tower', ['r', 'h'], '탑 짓기'], ['stairs', '계단', 'stair', ['n', 'w'], '계단 n칸 폭 w'], ['clear', '비우기', 'clear', ['d', 'w', 'h'], '공간 비우기'],
  ['circle', '원', 'circle', ['r', 'fill:fill'], '평평한 원'], ['line', '선', 'line', ['x', 'y', 'z'], '선 긋기'], ['copy', '복사', 'copy', ['d', 'w', 'h'], '복사하기'], ['paste', '붙여넣기', 'paste', [], '붙여넣기'],
  ['parkour', '점프맵', 'parkour', ['n', 'd'], '점프맵 발판 n개 난이도 d'],
  ['wait', '기다리기', 'wait', ['s'], 's초 기다리기'], ['stop', '멈추기', 'stop', [], '코드 멈추기'],
  ['say', '말하기', 'say', ['s:text'], 'say(f"x는 {x}") 말하기'], ['shout', '크게_말하기', 'shout', ['s:text'], '화면에 크게'],
  ['send_message', '신호_보내기', 'broadcast', ['m:s'], '신호 보내기'],
  ['play_note', '음_연주', 'note', ['n', 'i:s'], '음 연주 (0~24, "harp")'], ['play_sound', '효과음', 'sfx', ['s:s'], '효과음 "levelup"'], ['firework', '폭죽', 'firework', ['c:s'], '폭죽 "rainbow"'],
  ['wire', '전선', 'rsLine', ['n'], '레드스톤 전선 n칸'], ['part', '부품', 'rsPlace', ['p:s', 'd:dir'], '회로 부품 놓기'], ['circuit', '회로', 'rsEx', ['e:s'], '회로 예제'],
];
const PY_BY_TYPE = {}, PY_BY_NAME = {};
for (const r of PY_API) { PY_BY_TYPE[r[2]] = r; PY_BY_NAME[r[0]] = r; PY_BY_NAME[r[1]] = r; }
const PY_RESERVED = new Set(['for', 'in', 'range', 'if', 'elif', 'else', 'while', 'def', 'not', 'and', 'or', 'True', 'False', 'break', 'pass', 'del', 'random', 'len'].concat(Object.keys(PY_BY_NAME)));
function pyStr(s) { return '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
function blocksToText(prog, opt) {
  opt = opt || {};
  const out = ['# 에듀 크래프트 빌더봇 — 파이썬 모양 글자 코드', '# 위에서부터 한 줄씩 실행해요. 들여쓰기(빈칸 4개)가 반복·조건의 안쪽이에요.', ''];
  let msgN = 0;
  // 설명: 블록 글자에 실제 값을 넣어서 (예: 「목록 높이 에 3 넣기」)
  const cmt = (n) => {
    if (opt.comments === false || !CODE_DEFS[n.t]) return '';
    const d = CODE_DEFS[n.t], a = n.a || {};
    const t = d.text.replace(/#(\w+)/g, (_, k) => { if (k === 'c' && !CH2[n.t + '.c']) return a.c === 'expr' ? '(조건)' : ((COND_CHOICES.find(c => c[0] === a.c) || [0, '조건'])[1]); const v = a[k] !== undefined ? a[k] : d.a[k]; return v && typeof v === 'object' ? '(값)' : String(v === '' ? '없음' : v); });
    return '  # ' + t.replace(/\s+/g, ' ').trim();
  };
  const condT = (a) => a.c === 'expr' ? (a.e && typeof a.e === 'object' ? repExpr(a.e) : String(a.e || '0').trim() || '0') : (COND_PY[a.c] || 'block_ahead()');
  const emit = (list, ind) => {
    const pad = '    '.repeat(ind);
    if (!list || !list.length) { out.push(pad + 'pass'); return; }
    for (const n of list) {
      const def = CODE_DEFS[n.t]; if (!def || def.r) continue;
      const a = n.a || {}, E = (k) => argBare(a[k], def.a[k]);
      const api = PY_BY_TYPE[n.t];
      switch (n.t) {
        case 'repeat': out.push(`${pad}for _ in range(${E('n')}):${cmt(n)}`); emit(n.c, ind + 1); continue;
        case 'for': { const v = codeIdent(a.v || 'i'), A0 = E('a'), B0 = E('b'); out.push(`${pad}for ${v} in range(${A0 === '0' ? '' : A0 + ', '}${exprPlus1(B0)}):${cmt(n)}`); emit(n.c, ind + 1); continue; }
        case 'if': out.push(`${pad}if ${condT(a)}:${cmt(n)}`); emit(n.c, ind + 1); continue;
        case 'ifelse': out.push(`${pad}if ${condT(a)}:${cmt(n)}`); emit(n.c, ind + 1); out.push(`${pad}else:`); emit(n.c2, ind + 1); continue;
        case 'until': { const c = condT(a); out.push(`${pad}while ${c.startsWith('not ') ? c.slice(4) : 'not ' + (/^[\w가-힣]+\(\)$/.test(c) ? c : '(' + c + ')')}:${cmt(n)}`); emit(n.c, ind + 1); continue; }
        case 'whilec': out.push(`${pad}while ${condT(a)}:${cmt(n)}`); emit(n.c, ind + 1); continue;
        case 'forever': out.push(`${pad}while True:${cmt(n)}`); emit(n.c, ind + 1); continue;
        case 'brk': out.push(`${pad}break`); continue;
        case 'func': out.push(`${pad}def ${codeIdent(a.f)}(${splitTop(a.p || '').map(codeIdent).join(', ')}):${cmt(n)}`); emit(n.c, ind + 1); continue;
        case 'call': out.push(`${pad}${codeIdent(a.f)}(${splitTop(a.args || '').join(', ')})${cmt(n)}`); continue;
        case 'whenMsg': out.push(`${pad}@on_message(${pyStr(String(a.m || '').trim())})`); out.push(`${pad}def when_message_${++msgN}():${cmt(n)}`); emit(n.c, ind + 1); continue;
        case 'set': out.push(`${pad}${codeIdent(a.v)} = ${E('x')}${cmt(n)}`); continue;
        case 'change': out.push(`${pad}${codeIdent(a.v)} += ${E('x')}${cmt(n)}`); continue;
        case 'rand': out.push(`${pad}${codeIdent(a.v)} = random(${E('a')}, ${E('b')})${cmt(n)}`); continue;
        case 'listAdd': out.push(`${pad}${codeIdent(a.l)}.append(${E('v')})${cmt(n)}`); continue;
        case 'listSet': out.push(`${pad}${codeIdent(a.l)}[${exprMinus1(E('n'))}] = ${E('v')}${cmt(n)}`); continue;
        case 'listDel': out.push(`${pad}del ${codeIdent(a.l)}[${exprMinus1(E('n'))}]${cmt(n)}`); continue;
        case 'listClear': out.push(`${pad}${codeIdent(a.l)} = []${cmt(n)}`); continue;
      }
      if (!api) { out.push(`${pad}# (글자로 못 바꾸는 블록: ${codeName(n.t)})`); continue; }
      const args = api[3].map(spec => {
        const [k, kind] = spec.split(':'), v = a[k] !== undefined ? a[k] : def.a[k];
        if (kind === 's' || kind === 'block') return pyStr(v);
        if (kind === 'dir') return pyStr(DIR_WORD[v] || 'front');
        if (kind === 'face') return pyStr(FACE_WORD[v] || 'north');
        if (kind === 'bool') return v === '0' ? 'False' : 'True';
        if (kind === 'fill') return pyStr(v === 'solid' ? 'solid' : 'hollow');
        if (kind === 'text') { if (v && typeof v === 'object') return argBare(v); const s = String(v || ''); return (/\{[^}]+\}/.test(s) ? 'f' : '') + pyStr(s); }
        return argBare(v, def.a[k]);
      });
      out.push(`${pad}${api[0]}(${args.join(', ')})${cmt(n)}`);
    }
  };
  emit(prog, 0);
  return out.join('\n') + '\n';
}

// 오타일 때 비슷한 명령 찾기 (편집 거리 2 이하)
function pySuggest(name, userFns) {
  const dist = (x, y) => { const m = x.length, n = y.length; if (Math.abs(m - n) > 2) return 9; let prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; };
  let best = null, bd = 3;
  for (const k of Object.keys(PY_BY_NAME).concat([...userFns])) { const d = dist(name.toLowerCase(), k.toLowerCase()); if (d < bd) { bd = d; best = k; } }
  return best;
}
// ---------------- 텍스트 코딩: 글자 → 블록 ----------------
function textToBlocks(src) {
  const lines = String(src).replace(/\t/g, '    ').split('\n');
  const prog = [], errs = [];
  const err = (ln, m) => { if (errs.length < 5) errs.push({ line: ln, msg: m }); };
  // 먼저 def 이름을 모아 둠 (함수를 위에서 부르고 아래에서 만들어도 되게)
  const userFns = new Set();
  for (const L of lines) { const m = /^\s*def\s+([^\s(]+)\s*\(/.exec(L); if (m) userFns.add(m[1]); }
  const stack = [{ indent: 0, list: prog, lastIf: null }];
  let pending = null, decor = null;
  const unq = (s, ln) => { s = String(s).trim(); let f = false; if (/^f["']/.test(s)) { f = true; s = s.slice(1); } const m = /^"((?:[^"\\]|\\.)*)"$|^'((?:[^'\\]|\\.)*)'$/.exec(s); if (!m) { err(ln, `글자는 따옴표로 감싸 주세요: ${s}`); return ''; } return (m[1] !== undefined ? m[1] : m[2]).replace(/\\(.)/g, '$1'); };
  const exprChk = (s, ln) => { s = String(s).trim(); if (!s) { err(ln, '값이 비어 있어요'); return '0'; } if (/\*\*|\/\//.test(s)) err(ln, '** 와 // 는 아직 쓸 수 없어요 (pow(a, b), floor(a / b) 를 써 주세요)'); if (/\bTrue\b/.test(s) || /\bFalse\b/.test(s)) s = s.replace(/\bTrue\b/g, '1').replace(/\bFalse\b/g, '0'); return s; };
  const condOf = (s, ln) => { s = exprChk(s, ln); if (PY_COND[s]) return { c: PY_COND[s] }; return { c: 'expr', e: s }; };
  for (let li = 0; li < lines.length; li++) {
    const ln = li + 1;
    // 주석 지우기 (따옴표 밖의 #)
    let raw = lines[li], q = null, cut = raw.length;
    for (let k = 0; k < raw.length; k++) { const ch = raw[k]; if (q) { if (ch === '\\') k++; else if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '#') { cut = k; break; } }
    raw = raw.slice(0, cut).replace(/\s+$/, '');
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length, line = raw.trim();
    let top = stack[stack.length - 1];
    if (pending) {
      if (indent > top.indent) { stack.push({ indent, list: pending, lastIf: null }); top = stack[stack.length - 1]; }
      else err(ln - 1, '「:」 다음 줄은 빈칸 4개만큼 들여써야 해요');
      pending = null;
    } else {
      while (stack.length > 1 && indent < top.indent) { stack.pop(); top = stack[stack.length - 1]; }
      if (indent !== top.indent) { err(ln, '들여쓰기(빈칸)가 위 줄과 맞지 않아요'); continue; }
    }
    const L = top.list;
    let m;
    const opener = (node, list) => { L.push(node); pending = list; top.lastIf = null; };
    if ((m = /^@on_message\((.*)\)$/.exec(line))) { decor = unq(m[1], ln); continue; }
    if ((m = /^def\s+([^\s(]+)\s*\((.*)\)\s*:$/.exec(line))) {
      if (decor !== null) { const n = { t: 'whenMsg', a: { m: decor }, c: [] }; decor = null; opener(n, n.c); continue; }
      if (PY_RESERVED.has(m[1])) { err(ln, `「${m[1]}」은(는) 이미 있는 명령 이름이라 함수 이름으로 쓸 수 없어요`); continue; }
      const n = { t: 'func', a: { f: m[1], p: splitTop(m[2]).join(', ') }, c: [] }; opener(n, n.c); continue;
    }
    if (decor !== null) { err(ln, '@on_message(…) 다음 줄에는 def 가 와야 해요'); decor = null; }
    if ((m = /^for\s+([^\s]+)\s+in\s+range\((.*)\)\s*:$/.exec(line))) {
      const v = m[1], ra = splitTop(m[2]);
      if (!ra.length || ra.length > 2) { err(ln, 'range(끝) 또는 range(시작, 끝) 으로 써 주세요'); continue; }
      let n;
      if (v === '_') n = { t: 'repeat', a: { n: ra.length === 1 ? exprChk(ra[0], ln) : `${exprChk(ra[1], ln)} - ${exprChk(ra[0], ln)}` }, c: [] };
      else n = { t: 'for', a: { v, a: ra.length === 2 ? exprChk(ra[0], ln) : '0', b: exprMinus1(exprChk(ra[ra.length - 1], ln)) }, c: [] };
      opener(n, n.c); continue;
    }
    if ((m = /^while\s+(.+):$/.exec(line))) {
      const c = m[1].trim();
      if (c === 'True' || c === '1') { const n = { t: 'forever', a: {}, c: [] }; opener(n, n.c); continue; }
      const nm = /^not\s+(.+)$/.exec(c);
      if (nm) { let inner = nm[1].trim(); if (/^\(.*\)$/.test(inner)) inner = inner.slice(1, -1); const n = { t: 'until', a: condOf(inner, ln), c: [] }; opener(n, n.c); continue; }
      const n = { t: 'whilec', a: condOf(c, ln), c: [] }; opener(n, n.c); continue;
    }
    if ((m = /^if\s+(.+):$/.exec(line))) { const n = { t: 'if', a: condOf(m[1], ln), c: [] }; L.push(n); pending = n.c; top.lastIf = n; continue; }
    if ((m = /^elif\s+(.+):$/.exec(line))) {
      const p = top.lastIf; if (!p) { err(ln, 'elif 앞에 if 가 있어야 해요'); continue; }
      p.t = 'ifelse'; const n = { t: 'if', a: condOf(m[1], ln), c: [] }; p.c2 = [n]; pending = n.c; top.lastIf = n; continue;
    }
    if (/^else\s*:$/.test(line)) {
      const p = top.lastIf; if (!p) { err(ln, 'else 앞에 if 가 있어야 해요'); continue; }
      p.t = 'ifelse'; p.c2 = p.c2 && p.c2.length && p.c2[0] !== p ? p.c2 : []; if (p.c2.length) { err(ln, '이 else 는 이미 elif 로 이어졌어요'); continue; }
      pending = p.c2; top.lastIf = null; continue;
    }
    top.lastIf = null;
    if (line === 'pass') continue;
    if (line === 'break') { L.push({ t: 'brk', a: {} }); continue; }
    if (line === 'continue') { err(ln, 'continue 는 아직 쓸 수 없어요'); continue; }
    if ((m = /^([\w가-힣]+)\s*=\s*\[\s*\]$/.exec(line))) { L.push({ t: 'listClear', a: { l: m[1] } }); continue; }
    if ((m = /^([\w가-힣]+)\.append\((.*)\)$/.exec(line))) { L.push({ t: 'listAdd', a: { l: m[1], v: exprChk(m[2], ln) } }); continue; }
    if ((m = /^([\w가-힣]+)\.clear\(\)$/.exec(line))) { L.push({ t: 'listClear', a: { l: m[1] } }); continue; }
    if ((m = /^del\s+([\w가-힣]+)\[(.+)\]$/.exec(line))) { L.push({ t: 'listDel', a: { l: m[1], n: exprPlus1(exprChk(m[2], ln)) } }); continue; }
    if ((m = /^([\w가-힣]+)\[(.+)\]\s*=\s*(.+)$/.exec(line)) && !/==/.test(line)) { L.push({ t: 'listSet', a: { l: m[1], n: exprPlus1(exprChk(m[2], ln)), v: exprChk(m[3], ln) } }); continue; }
    if ((m = /^([\w가-힣]+)\s*\+=\s*(.+)$/.exec(line))) { L.push({ t: 'change', a: { v: m[1], x: exprChk(m[2], ln) } }); continue; }
    if ((m = /^([\w가-힣]+)\s*-=\s*(.+)$/.exec(line))) { L.push({ t: 'change', a: { v: m[1], x: `-(${exprChk(m[2], ln)})` } }); continue; }
    if ((m = /^([\w가-힣]+)\s*=\s*(?:random|무작위)\((.*)\)$/.exec(line)) && splitTop(m[2]).length === 2) { const r = splitTop(m[2]); L.push({ t: 'rand', a: { v: m[1], a: exprChk(r[0], ln), b: exprChk(r[1], ln) } }); continue; }
    if ((m = /^([\w가-힣]+)\s*=(?!=)\s*(.+)$/.exec(line))) {
      if (PY_RESERVED.has(m[1])) { err(ln, `「${m[1]}」은(는) 명령 이름이라 변수로 쓸 수 없어요`); continue; }
      L.push({ t: 'set', a: { v: m[1], x: exprChk(m[2], ln) } }); continue;
    }
    if ((m = /^([\w가-힣]+)\((.*)\)$/.exec(line))) {
      const name = m[1], args = splitTop(m[2]);
      if (userFns.has(name) && !PY_BY_NAME[name]) { L.push({ t: 'call', a: { f: name, args: args.map(x => exprChk(x, ln)).join(', ') } }); continue; }
      const api = PY_BY_NAME[name];
      if (!api) { const sg = pySuggest(name, userFns); err(ln, `「${name}」은(는) 모르는 명령이에요.${sg ? ` 혹시 「${sg}」?` : ' 📖 명령어 목록을 확인해 보세요'}`); continue; }
      const def = CODE_DEFS[api[2]];
      if (!def) { err(ln, `「${name}」 블록을 쓸 수 없어요`); continue; }
      if (args.length > api[3].length) err(ln, `「${name}」에는 값이 ${api[3].length}개까지 들어가요 (지금 ${args.length}개)`);
      const a = Object.assign({}, def.a);
      api[3].forEach((spec, k) => {
        if (args[k] === undefined) return;
        const [key, kind] = spec.split(':'), v = args[k];
        if (kind === 's') a[key] = unq(v, ln);
        else if (kind === 'text') a[key] = /^f?["']/.test(v.trim()) ? unq(v, ln) : (CODE_DEFS.op_expr ? { t: 'op_expr', a: { e: exprChk(v, ln) } } : exprChk(v, ln));   // 따옴표 없는 말 = 식 (say(x), say(join(…)))
        else if (kind === 'block') { const s = unq(v, ln); const d = BLOCKS.find(b => b && (b.name === s || b.k === s)); if (s === 'air' || s === '공기') a[key] = 'air'; else if (d && d.item) a[key] = d.name; else err(ln, `「${s}」 블록을 찾지 못했어요`); }
        else if (kind === 'dir') { const s = unq(v, ln); if (WORD_DIR[s]) a[key] = WORD_DIR[s]; else err(ln, `방향은 "front", "back", "left", "right", "up", "down" 중에서 골라요`); }
        else if (kind === 'face') { const s = unq(v, ln); if (WORD_FACE[s]) a[key] = WORD_FACE[s]; else err(ln, '방향은 "north", "east", "south", "west" 중에서 골라요'); }
        else if (kind === 'bool') a[key] = /^(False|0|false|거짓)$/.test(v.trim()) ? '0' : '1';
        else if (kind === 'fill') { const s = unq(v, ln); a[key] = /solid|꽉/.test(s) ? 'solid' : 'hollow'; }
        else a[key] = exprChk(v, ln);
      });
      L.push({ t: api[2], a });
      continue;
    }
    if (/^(for|if|elif|else|while|def)\b/.test(line) && !/:$/.test(line)) { err(ln, `「${line.split(/[\s(:]/)[0]}」 줄 끝에 「:」(쌍점)을 붙여 주세요`); continue; }
    if (/^(For|If|While|Def|Else)\b/.test(line)) { err(ln, '명령은 소문자로 써요 (for, if, while, def, else)'); continue; }
    if (/^[\w가-힣]+\s*\(.*[^)]$/.test(line)) { err(ln, '괄호 「)」가 닫히지 않았어요'); continue; }
    err(ln, `이 줄을 이해하지 못했어요: ${line.length > 40 ? line.slice(0, 40) + '…' : line}`);
  }
  if (pending) err(lines.length, '「:」 다음 줄에 안쪽 내용이 있어야 해요 (없으면 pass)');
  return { prog, errs };
}

// ---------------- 텍스트 코딩 편집기 ----------------
const PY_KW = /\b(for|in|range|if|elif|else|while|def|not|and|or|True|False|break|pass|del|len|random)\b/;
function pyHighlight(src) {
  const e = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return src.split('\n').map(line => {
    let out = '', i = 0;
    const re = /(#.*$)|(f?"(?:[^"\\]|\\.)*"?|f?'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|(@[\w가-힣_]+)|([A-Za-z가-힣_][\w가-힣]*)(?=\s*\()|(\b(?:for|in|range|if|elif|else|while|def|not|and|or|True|False|break|pass|del)\b)/g;
    let m;
    while ((m = re.exec(line))) {
      out += e(line.slice(i, m.index));
      const cls = m[1] ? 'cm' : m[2] ? 'st' : m[3] ? 'nu' : m[4] ? 'dc' : m[5] ? (PY_BY_NAME[m[5]] ? 'ap' : PY_KW.test(m[5]) ? 'kw' : 'fn') : 'kw';
      out += `<span class="${cls}">${e(m[0])}</span>`;
      i = m.index + m[0].length;
      if (!m[0].length) re.lastIndex++;
    }
    return out + e(line.slice(i));
  }).join('\n') + '\n';
}
{
  const B = Builder.prototype;
  const MODE_KEY = 'educraft.codeMode';
  const _oe = B.openEditor;
  B.openEditor = function () {
    _oe.call(this);
    const s = document.getElementById('code-screen'); if (!s) return;
    const top = s.querySelector('.code-top'), body = s.querySelector('.code-body');
    const tabs = document.createElement('div'); tabs.className = 'cd-modes';
    tabs.innerHTML = '<button data-m="blocks">🧩 블록</button><button data-m="split">🔀 나란히</button><button data-m="text">📝 글자</button>';
    top.insertBefore(tabs, top.children[1] || null);
    const tp = document.createElement('div'); tp.className = 'code-text'; tp.id = 'cd-text';
    tp.innerHTML = `<div class="ct-bar"><b>📝 글자 코드</b><span class="muted">파이썬 모양</span>
        <label class="ct-chk"><input type="checkbox" id="ct-cmt" checked> 설명 달기</label><span style="flex:1"></span>
        <button class="btn small" id="ct-from" title="지금 블록을 글자 코드로 바꿔요">🧩→📝 블록에서 만들기</button>
        <button class="btn small primary" id="ct-apply" title="글자 코드를 블록으로 바꿔 작업판에 넣어요">📝→🧩 블록에 적용</button>
        <button class="btn small blue" id="ct-run" title="Ctrl+Enter">▶ 글자 코드 실행</button>
        <button class="btn small" id="ct-ref">📖 명령어</button></div>
      <div class="ct-edit"><pre class="ct-gut" id="ct-gut"></pre><div class="ct-area"><pre class="ct-hl" id="ct-hl" aria-hidden="true"></pre><textarea id="ct-ta" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"></textarea></div></div>
      <div class="ct-msg" id="ct-msg"></div><div class="ct-refbox" id="ct-refbox"></div>`;
    body.insertBefore(tp, s.querySelector('#cd-missions'));
    const ta = tp.querySelector('#ct-ta'), hl = tp.querySelector('#ct-hl'), gut = tp.querySelector('#ct-gut'), msg = tp.querySelector('#ct-msg');
    const paint = (errLine) => {
      hl.innerHTML = pyHighlight(ta.value);
      const n = ta.value.split('\n').length; let g = '';
      for (let i = 1; i <= n; i++) g += (i === errLine ? `<b>${i}</b>` : i) + '\n';
      gut.innerHTML = g; hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop;
    };
    this._ct = { ta, paint, msg, dirty: false };
    const check = () => {
      const r = textToBlocks(ta.value);
      if (r.errs.length) { const e = r.errs[0]; msg.className = 'ct-msg bad'; msg.textContent = `✖ ${e.line}번째 줄: ${e.msg}`; paint(e.line); return null; }
      let cnt = 0; const walk = (l) => { for (const n of l || []) { cnt++; walk(n.c); walk(n.c2); } }; walk(r.prog);
      msg.className = 'ct-msg ok'; msg.textContent = `✓ 문법이 맞아요 · 블록 ${cnt}개가 돼요`; paint(0);
      return r.prog;
    };
    let ct = 0;
    ta.addEventListener('input', () => { this._ct.dirty = true; paint(0); clearTimeout(ct); ct = setTimeout(check, 400); });
    ta.addEventListener('scroll', () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; });
    ta.addEventListener('pointerdown', e => e.stopPropagation());
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { ta.blur(); return; }
      if (e.key === 'Tab') { e.preventDefault(); const a = ta.selectionStart, b = ta.selectionEnd; ta.setRangeText('    ', a, b, 'end'); ta.dispatchEvent(new Event('input')); return; }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); tp.querySelector('#ct-run').click(); return; }
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        const a = ta.selectionStart, before = ta.value.slice(0, a), lineStart = before.lastIndexOf('\n') + 1, cur = before.slice(lineStart);
        let ind = (/^\s*/.exec(cur) || [''])[0]; if (/:\s*(#.*)?$/.test(cur)) ind += '    ';
        ta.setRangeText('\n' + ind, a, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input'));
      }
    });
    const fromBlocks = () => { ta.value = blocksToText(this.program, { comments: tp.querySelector('#ct-cmt').checked }); this._ct.dirty = false; if (this.program.length) this.converted = true; paint(0); check(); };
    tp.querySelector('#ct-cmt').onchange = fromBlocks;
    tp.querySelector('#ct-from').onclick = () => { if (this._ct.dirty && !confirm('지금 쓴 글자 코드를 블록에서 다시 만들까요? (쓴 내용은 사라져요)')) return; fromBlocks(); this.log('🧩→📝 블록을 글자 코드로 바꿨어요'); };
    const apply = () => {
      const prog = check(); if (!prog) { this.log('글자 코드에 틀린 곳이 있어요. 빨간 줄을 고쳐 주세요'); ta.focus(); return false; }
      this.program = prog; this.textSig = codeSig(prog); this._ct.dirty = false;
      this._noTextSync = true; this.renderWs(); this._noTextSync = false;
      this.log('📝→🧩 글자 코드를 블록으로 바꿨어요');
      return true;
    };
    tp.querySelector('#ct-apply').onclick = apply;
    tp.querySelector('#ct-run').onclick = () => { if (apply()) this.run(); };
    tp.querySelector('#ct-ref').onclick = () => {
      const box = tp.querySelector('#ct-refbox'); box.classList.toggle('show');
      if (!box.innerHTML) box.innerHTML = '<h4>📖 글자 코드 명령어</h4><p class="muted">한글 이름으로 써도 돼요. 예: 앞으로(3) = forward(3)</p><table>' +
        PY_API.map(r => `<tr><td><code>${r[0]}(${r[3].map(x => x.split(':')[0]).join(', ')})</code></td><td><code>${r[1]}</code></td><td>${esc(r[4])}</td></tr>`).join('') +
        `<tr><td colspan="3"><b>흐름</b> <code>for i in range(1, 6):</code> · <code>for _ in range(4):</code> · <code>if block_ahead():</code> · <code>elif</code> / <code>else:</code> · <code>while not block_below():</code> · <code>while True:</code> · <code>break</code></td></tr>
         <tr><td colspan="3"><b>감지</b> <code>block_ahead() block_below() block_above() block_here() water_below() coin() is_day() is_night() player_near() block_is("down", "grass")</code></td></tr>
         <tr><td colspan="3"><b>값</b> <code>bot_x() bot_y() bot_z() placed() loop_count() distance() random(1, 6) abs() round() floor() sqrt()</code></td></tr>
         <tr><td colspan="3"><b>변수·목록</b> <code>x = 3</code> · <code>x += 1</code> · <code>막대 = []</code> · <code>막대.append(3)</code> · <code>막대[0]</code> · <code>len(막대)</code> · <code>3 in 막대</code></td></tr>
         <tr><td colspan="3"><b>함수·신호</b> <code>def 기둥(층):</code> → <code>기둥(5)</code> · <code>@on_message("문")</code> 다음 줄 <code>def 받기():</code> → <code>send_message("문")</code></td></tr></table>`;
    };
    tabs.querySelectorAll('button').forEach(b => b.onclick = () => this.setCodeMode(b.dataset.m));
    let mode = 'blocks'; try { mode = localStorage.getItem(MODE_KEY) || 'blocks'; } catch (e) { }
    this.setCodeMode(mode, true);
  };
  B.setCodeMode = function (mode, first) {
    const s = document.getElementById('code-screen'); if (!s || !this._ct) return;
    if (!['blocks', 'split', 'text'].includes(mode)) mode = 'blocks';
    this.codeMode = mode; try { localStorage.setItem(MODE_KEY, mode); } catch (e) { }
    s.classList.toggle('mode-text', mode === 'text'); s.classList.toggle('mode-split', mode === 'split');
    s.querySelectorAll('.cd-modes button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
    if (mode !== 'blocks' && (!this._ct.dirty || first)) { this._ct.ta.value = blocksToText(this.program, { comments: s.querySelector('#ct-cmt').checked }); this._ct.dirty = false; if (this.program.length && !first) this.converted = true; this._ct.paint(0); this._ct.msg.className = 'ct-msg'; this._ct.msg.textContent = mode === 'split' ? '🔀 블록을 바꾸면 글자 코드도 함께 바뀌어요. 글자를 고쳤으면 「📝→🧩 블록에 적용」!' : '📝 파이썬 모양으로 코드를 써 보세요. Ctrl+Enter 로 바로 실행!'; }
  };
  B.syncText = function () {
    if (this._noTextSync || !this._ct || this.codeMode !== 'split' || this._ct.dirty) return;
    const ta = this._ct.ta; if (document.activeElement === ta) return;
    ta.value = blocksToText(this.program, { comments: !!(document.getElementById('ct-cmt') || {}).checked }); this._ct.paint(0);
  };
}

// ---------------- 예제 ----------------
Object.assign(SAMPLE_PROGRAMS, {
  '📣 신호로 짓는 기둥 (신호)': [
    { t: 'whenMsg', a: { m: '기둥' }, c: [{ t: 'repeat', a: { n: '5' }, c: [{ t: 'place', a: {} }, { t: 'up', a: { n: '1' } }] }, { t: 'down', a: { n: '5' } }, { t: 'fwd', a: { n: '2' } }] },
    { t: 'setblk', a: { b: 'quartz_block' } }, { t: 'repeat', a: { n: '4' }, c: [{ t: 'broadcast', a: { m: '기둥' } }, { t: 'note', a: { n: { t: 'op_mul', a: { a: { t: 'op_loop', a: {} }, b: '3' } }, i: 'bell' } }] }, { t: 'firework', a: { c: 'rainbow' } }],
  '📋 목록 막대그래프 (목록)': [
    { t: 'listClear', a: { l: '막대' } }, { t: 'listAdd', a: { l: '막대', v: '3' } }, { t: 'listAdd', a: { l: '막대', v: '7' } }, { t: 'listAdd', a: { l: '막대', v: '5' } }, { t: 'listAdd', a: { l: '막대', v: '9' } }, { t: 'listAdd', a: { l: '막대', v: '4' } },
    { t: 'for', a: { v: 'i', a: '1', b: { t: 'list_len', a: { l: '막대' } } }, c: [{ t: 'setcolor', a: { k: 'concrete', n: 'i' } }, { t: 'repeat', a: { n: { t: 'list_get', a: { l: '막대', n: 'i' } } }, c: [{ t: 'place', a: {} }, { t: 'up', a: { n: '1' } }] }, { t: 'goto', a: { x: { t: 'op_mul', a: { a: 'i', b: '2' } }, y: '0', z: '0' } }] },
    { t: 'say', a: { s: '목록: {높이}' } }],
  '🧮 계산 블록 무지개 계단 (계산)': [
    { t: 'for', a: { v: 'i', a: '0', b: '11' }, c: [{ t: 'setcolor', a: { k: 'wool', n: { t: 'op_mod', a: { a: 'i', b: '16' } } } }, { t: 'floor', a: { d: '1', w: '3' } }, { t: 'fwd', a: { n: '1' } }, { t: 'if', a: { c: 'expr', e: { t: 'cmp_eq', a: { a: { t: 'op_mod', a: { a: 'i', b: '2' } }, b: '1' } } }, c: [{ t: 'up', a: { n: '1' } }] }] }],
  '🔧 입력값 함수 탑 (함수)': [
    { t: 'func', a: { f: '기둥', p: '층' }, c: [{ t: 'repeat', a: { n: '층' }, c: [{ t: 'place', a: {} }, { t: 'up', a: { n: '1' } }] }, { t: 'down', a: { n: '층' } }] },
    { t: 'setblk', a: { b: 'stone_bricks' } }, { t: 'for', a: { v: 'k', a: '1', b: '6' }, c: [{ t: 'call', a: { f: '기둥', args: 'k * 2' } }, { t: 'fwd', a: { n: '2' } }] }],
  '🌳 재귀 나무 (함수가 자기를 부름)': [
    { t: 'func', a: { f: '가지', p: '길이' }, c: [{ t: 'if', a: { c: 'expr', e: '길이 > 0' }, c: [{ t: 'repeat', a: { n: '길이' }, c: [{ t: 'place', a: {} }, { t: 'up', a: { n: '1' } }] }, { t: 'call', a: { f: '가지', args: '길이 - 1' } }, { t: 'turnR', a: {} }, { t: 'call', a: { f: '가지', args: '길이 - 2' } }, { t: 'turnL', a: {} }, { t: 'down', a: { n: '길이' } }] }] },
    { t: 'setblk', a: { b: 'oak_log' } }, { t: 'call', a: { f: '가지', args: '5' } }],
});

// ---------------- 코딩 마스터: 6장 신호·목록, 7장 텍스트 코딩 ----------------
let CM_B = null;   // 지금 검사 중인 빌더봇
{
  CM_CHAPTERS.splice(5, 0, ['신호·목록', '신호로 블록 묶음을 깨우고, 목록에 여러 값을 담아요.'], ['텍스트 코딩', '블록을 글자 코드로 바꾸고, 글자로 직접 짜 봐요.']);
  const OPS = ['op_add', 'op_sub', 'op_mul', 'op_div', 'op_mod', 'op_rand', 'op_math'];
  const NEW = [
    ['c23', 5, '신호로 짓기', '「신호를 받았을 때」 안에서 짓고, 그 신호를 2번 이상 보내요 (8칸 이상)', '「📣 기둥 신호를 받았을 때」 안에 기둥 짓는 블록 → 아래에서 「📣 기둥 신호 보내기」를 두 번!', { must: [['whenMsg'], ['broadcast']] },
      R => { const k = CM_B && CM_B.stats ? CM_B.stats.msgRuns || 0 : 0; return [k >= 2 && R.n >= 8, `신호 받은 횟수 ${k} / 2 · 블록 ${R.n} / 8`]; }],
    ['c24', 5, '목록 막대그래프', '목록에 높이를 4개 이상 넣고, 그 높이대로 기둥을 세워요', '「목록 막대 에 3 넣기」를 여러 번 → 「i 를 1부터 4까지」 안에서 「목록 막대 의 i 번째 항목」번 쌓기.', { must: [['listAdd'], ['list_get']], ban: SHAPE_BLOCKS },
      R => { const c = CMK.columns(R), d = new Set(c).size; return [c.length >= 4 && d >= 3, `기둥 ${c.length} / 4 · 서로 다른 높이 ${d} / 3`]; }],
    ['c25', 5, '계산 블록', '계산 블록(＋ − × ÷ 나머지 무작위)을 입력칸에 끼워 15칸 이상', '「앞으로 □칸」의 칸에 「i × 2」 같은 둥근 블록을 끌어다 넣어요.', { must: [OPS] },
      R => [R.n >= 15, `블록 ${R.n} / 15`]],
    ['c26', 5, '입력값이 있는 함수', '입력값으로 크기가 바뀌는 함수로 높이가 다른 기둥 3개', '「함수 기둥 만들기 · 입력 층」 안에서 「층」번 반복 → 「함수 기둥 실행하기 · 값 3」, 값 5, 값 7.', { must: [['func'], ['call']], funcParam: true, ban: SHAPE_BLOCKS },
      R => { const d = new Set(CMK.columns(R)).size; return [R.calls >= 3 && d >= 3, `부른 횟수 ${R.calls} / 3 · 서로 다른 높이 ${d} / 3`]; }],
    ['c27', 6, '글자로 첫 코드', '📝 글자 코드로 블록 5칸 이상 지어요', '코딩 창 위 「📝 글자」를 누르고 place() 와 forward(1) 을 써서 「▶ 글자 코드 실행」!', { text: true },
      R => [R.n >= 5, `블록 ${R.n} / 5`]],
    ['c28', 6, '블록 ↔ 글자', '블록을 글자로 바꿔 고친 뒤, 반복이 든 코드로 20칸 이상', '블록으로 짠 다음 「🧩→📝 블록에서 만들기」 → range( ) 안 숫자를 바꿔 실행해요.', { text: true, conv: true, must: [['repeat', 'for', 'whilec', 'until']] },
      R => [R.n >= 20, `블록 ${R.n} / 20`]],
    ['c29', 6, '글자로 쓴 함수', 'def 로 함수를 만들어 2번 이상 불러 30칸 이상', 'def 기둥(층): 다음 줄부터 빈칸 4개 들여쓰기 → 기둥(5) 처럼 불러요.', { text: true, must: [['func'], ['call']] },
      R => [R.calls >= 2 && R.n >= 30, `부른 횟수 ${R.calls} / 2 · 블록 ${R.n} / 30`]],
  ];
  const at = CM_LIST.findIndex(m => m[0] === 'c20');
  CM_LIST.splice(at < 0 ? CM_LIST.length : at, 0, ...NEW);
  for (const m of CM_LIST) if (['c20', 'c21', 'c22'].includes(m[0])) m[1] = 7;
  // 프로그램 살펴보기: 값 블록·입력 함수까지
  cmAnalyze = function (prog) {
    const used = new Set(), conds = new Set(); let nodes = 0, nest = 0, sayVar = false, funcLoop = false, reps = 0, fParam = false, cArgs = false;
    const walkA = (n) => { for (const v of Object.values(n.a || {})) if (v && typeof v === 'object' && v.t) { used.add(v.t); reps++; if (v.t === 's_cond') conds.add(v.a.c); walkA(v); } };
    const walk = (list, depth, inFunc) => {
      for (const n of list || []) {
        nodes++; used.add(n.t); walkA(n);
        const loop = ['repeat', 'for', 'until', 'forever', 'whilec'].includes(n.t);
        if (loop) nest = Math.max(nest, depth + 1);
        if (loop && inFunc) funcLoop = true;
        if (['if', 'ifelse', 'until', 'whilec'].includes(n.t) && n.a) conds.add(n.a.c || 'ahead');
        if ((n.t === 'say' || n.t === 'shout') && (/\{\s*[a-zA-Z가-힣_]/.test(String(n.a && n.a.s || '')) || (n.a && typeof n.a.s === 'object'))) sayVar = true;
        if (n.t === 'func' && String(n.a && n.a.p || '').trim()) fParam = true;
        if (n.t === 'call' && String(n.a && n.a.args || '').trim()) cArgs = true;
        walk(n.c, depth + (loop ? 1 : 0), inFunc || n.t === 'func'); walk(n.c2, depth + (loop ? 1 : 0), inFunc || n.t === 'func');
      }
    };
    walk(prog, 0, false);
    return { used, conds, nodes, nest, sayVar, funcLoop, reps, funcParam: fParam && cArgs };
  };
  const _rules = cmRules;
  cmRules = function (m, A) {
    const bad = _rules(m, A), o = m[5];
    if (o.funcParam && !A.funcParam) bad.push('함수에 「입력」 이름(예: 층)을 쓰고, 실행할 때 「값」을 넣어 봐요');
    if (o.text && !(CM_B && CM_B.runFromText)) bad.push('📝 글자 코드에서 「▶ 글자 코드 실행」(또는 「블록에 적용」 뒤 실행)으로 해야 해요');
    if (o.conv && !(CM_B && CM_B.converted)) bad.push('먼저 블록을 「🧩→📝 블록에서 만들기」로 글자 코드로 바꿔 봐요');
    return bad;
  };
  const B = Builder.prototype;
  const _cm = B.checkMissions;
  B.checkMissions = function (st) { CM_B = this; try { return _cm.call(this, st); } finally { CM_B = null; } };
  // 실행이 끝나면: 새 도전 과제
  const _fin = B.finishRun;
  B.finishRun = function () {
    const g = this.g, A = cmAnalyze(this.program), st = this.stats;
    _fin.call(this);
    if (!g.advGrant || this.placed <= 0) return;
    if (this.runFromText) g.advGrant('textcode');
    if (st && st.msgRuns) g.advGrant('signal');
    if (A.reps > 0) g.advGrant('reporter');
  };
}
// 빌더봇 등급: 장이 늘어나 루비·자수정 추가
BOT_RANK.splice(5, 0, { k: '루비', body: [0.92, 0.32, 0.42], css: '#d6334f' }, { k: '자수정', body: [0.66, 0.46, 0.96], css: '#8a4fd8' });
// 도전 과제 (9장 코딩)
{
  const add = [
    ['textcode', 'code', 'basic', 'paper', '글자로 코딩', '📝 글자 코드로 빌더봇을 움직여요', '코딩 창 위 「📝 글자」 → 「▶ 글자 코드 실행」.', { any: true, need: ['bot'] }],
    ['signal', 'code', 'basic', 'note_block', '신호를 보냈어요', '「신호 보내기」로 「신호를 받았을 때」를 깨워요', '시작 범주의 📣 블록 두 개를 써 봐요.', { any: true, need: ['bot'] }],
    ['reporter', 'code', 'basic', 'redstone', '계산 블록 탐험가', '둥근 계산 블록이나 뾰족한 판단 블록을 끼워 실행해요', '입력칸에 「i × 2」 같은 블록을 끌어다 넣어요.', { any: true, need: ['bot'] }],
    ['cm6', 'code', 'hard', 'chest', '코딩 마스터 6장', '「신호·목록」 단계를 모두 깨요', '신호로 블록을 깨우고, 목록에 값을 담아요.', { stat: ['cmChapter', 6], need: ['cm5'], any: true }],
    ['cm7', 'code', 'hero', 'paper', '코딩 마스터 7장', '「텍스트 코딩」 단계를 모두 깨요', '블록 ↔ 글자 코드, def 로 함수까지!', { stat: ['cmChapter', 7], need: ['cm6'], any: true }],
  ];
  const at = ACH_LIST.findIndex(a => a[0] === 'cm_master');
  ACH_LIST.splice(at, 0, ...add);
  for (const a of add) { ACH[a[0]] = { id: a[0], ch: a[1], tier: a[2], icon: a[3], name: a[4], desc: a[5], tip: a[6], o: a[7] }; ADV.push([a[0], a[3], a[4], a[5], null]); }
  const cmM = ACH_LIST.find(a => a[0] === 'cm_master');
  if (cmM) { cmM[7].stat = ['cmChapter', CM_CHAPTERS.length]; cmM[7].need = ['cm7']; cmM[6] = '마지막 장은 재귀·효율·나만의 점프맵!'; ACH.cm_master.o = cmM[7]; }
}
