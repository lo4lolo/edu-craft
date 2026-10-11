'use strict';
// =====================================================================
// 에듀 크래프트: 🎓 코딩 마스터 (v1.4) — 단계별 코딩 과정
//  6장 22단계: 차례대로 → 반복 → 변수 → 조건 → 함수 → 마스터(전설)
//  - 실행을 끝까지 마치면 「빌더봇이 실제로 지은 모양」을 검사 (기둥 높이, 네모 테두리, 체크무늬…)
//  - 단계마다 조건: 블록 n개 이하로, 꼭 써야 할 블록, 쓰면 안 되는 블록(도형 블록 금지 등)
//  - 못 깼으면 무엇이 모자란지 알려 줌 (예: "기둥 높이 7 / 10")
//  - 한 단계씩 열림. 진행은 브라우저에 저장(어느 세계에서 해도 이어짐). 장을 깨면 빌더봇 색이 바뀜
// =====================================================================
const SHAPE_BLOCKS = ['wall', 'floor', 'box', 'sphere', 'cyl', 'pyramid', 'house', 'tower', 'stair', 'clear', 'circle', 'line', 'parkour', 'rsEx', 'copy', 'paste'];
const CM_CHAPTERS = [
  ['차례대로', '명령은 위에서 아래로 하나씩 실행돼요.'],
  ['반복', '같은 일을 여러 번 할 때는 반복 블록!'],
  ['변수', '숫자에 이름(i, x)을 붙여 바꿔 가며 써요.'],
  ['조건', '「만약 ~이면」으로 상황에 따라 다르게.'],
  ['함수', '블록 묶음에 이름을 붙여 다시 불러 써요.'],
  ['마스터', '배운 것을 모두 합쳐 전설에 도전!'],
];
// 지은 칸(빌더봇 기준 좌표 r 오른쪽, u 위, f 앞)으로 모양 검사
const CMK = {
  key: (r, u, f) => r + ',' + u + ',' + f,
  // 가로 일직선 최장 길이
  longestLine(R) {
    let best = 0;
    for (const c of R.cells) for (const [dr, df] of [[1, 0], [0, 1]]) {
      if (R.has(c.r - dr, c.u, c.f - df)) continue;
      let n = 1; while (R.has(c.r + dr * n, c.u, c.f + df * n)) n++;
      best = Math.max(best, n);
    }
    return best;
  },
  longestColumn(R) {
    let best = 0;
    for (const c of R.cells) { if (R.has(c.r, c.u - 1, c.f)) continue; let n = 1; while (R.has(c.r, c.u + n, c.f)) n++; best = Math.max(best, n); }
    return best;
  },
  // 계단: 한 칸 앞(또는 옆)으로 가며 한 칸씩 올라감
  longestStairs(R) {
    let best = 0;
    for (const c of R.cells) for (const [dr, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (R.has(c.r - dr, c.u - 1, c.f - df)) continue;
      let n = 1; while (R.has(c.r + dr * n, c.u + n, c.f + df * n)) n++;
      best = Math.max(best, n);
    }
    return best;
  },
  // ㄱ자: 같은 높이에서 한 칸을 꼭짓점으로 두 방향 3칸 이상
  hasL(R) {
    for (const c of R.cells) for (const [ar, af, br, bf] of [[1, 0, 0, 1], [1, 0, 0, -1], [-1, 0, 0, 1], [-1, 0, 0, -1]]) {
      let a = 0, b = 0; while (R.has(c.r + ar * (a + 1), c.u, c.f + af * (a + 1))) a++; while (R.has(c.r + br * (b + 1), c.u, c.f + bf * (b + 1))) b++;
      if (a >= 2 && b >= 2) return true;
    }
    return false;
  },
  // n×n 테두리(속 빔) / 꽉 찬 n×n
  square(R, n, filled) {
    let best = 0;
    for (const c of R.cells) {
      let ok = true, inner = 0;
      for (let i = 0; i < n && ok; i++) for (let j = 0; j < n; j++) {
        const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1, h = R.has(c.r + i, c.u, c.f + j);
        if ((edge || filled) && !h) { ok = false; break; }
        if (!edge && h) inner++;
      }
      if (ok && (filled || inner === 0)) return true;
    }
    return false;
  },
  columns(R) {   // (r,f) 마다 높이
    const m = new Map();
    for (const c of R.cells) { const k = c.r + ',' + c.f; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.values()];
  },
  layers(R) { const m = new Map(); for (const c of R.cells) m.set(c.u, (m.get(c.u) || 0) + 1); return [...m.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]); },
  checker(R, n) {
    for (const c of R.cells) {
      const a = R.id(c.r, c.u, c.f), b = R.id(c.r + 1, c.u, c.f); if (!b || a === b) continue;
      let ok = true;
      for (let i = 0; i < n && ok; i++) for (let j = 0; j < n; j++) { const want = (i + j) % 2 ? b : a; if (R.id(c.r + i, c.u, c.f + j) !== want) { ok = false; break; } }
      if (ok) return true;
    }
    return false;
  },
};
// [id, 장(0~5), 이름, 목표, 힌트, 조건{max, must[], ban[], nest}, 검사(R) → [ok, 진행 글]]
const CM_LIST = [
  ['c1', 0, '첫 블록', '빌더봇으로 블록 1개를 놓아요', '「블록 고르기」로 블록을 정하고 「지금 자리에 블록 놓기」를 붙여 ▶ 실행!', {}, R => [R.n >= 1, `놓은 블록 ${R.n} / 1`]],
  ['c2', 0, '한 줄 쌓기', '가로로 일직선 5칸을 놓아요', '「놓기」와 「앞으로 1칸」을 번갈아 5번. (도형 블록 없이!)', { ban: SHAPE_BLOCKS }, R => { const n = CMK.longestLine(R); return [n >= 5, `가장 긴 줄 ${n} / 5`]; }],
  ['c3', 0, '계단 오르기', '한 칸씩 올라가는 계단 4칸을 만들어요', '놓기 → 앞으로 1칸 → 위로 1칸 … 을 4번.', { ban: SHAPE_BLOCKS }, R => { const n = CMK.longestStairs(R); return [n >= 4, `계단 ${n} / 4`]; }],
  ['c4', 0, 'ㄱ자 길', '3칸 줄을 놓고 돌아서 다시 3칸 (ㄱ자)', '「↻ 오른쪽으로 돌기」를 써요.', { ban: SHAPE_BLOCKS, must: [['turnL', 'turnR']] }, R => [CMK.hasL(R), CMK.hasL(R) ? 'ㄱ자 완성' : 'ㄱ자 모양이 아직 없어요 (꼭짓점에서 두 방향으로 3칸씩)']],
  ['c5', 1, '반복 기둥', '높이 10칸 기둥을 블록 4개 이하로', '「10번 반복하기」 안에 놓기 + 위로 1칸.', { ban: SHAPE_BLOCKS, max: 4, must: [['repeat']] }, R => { const n = CMK.longestColumn(R); return [n >= 10, `기둥 높이 ${n} / 10`]; }],
  ['c6', 1, '네모 울타리', '5×5 네모 테두리를 블록 7개 이하로', '「4번 반복」 안에: 「4번 반복(놓기·앞으로)」 + 「돌기」.', { ban: SHAPE_BLOCKS, max: 7, must: [['repeat'], ['turnL', 'turnR']] }, R => { const ok = CMK.square(R, 5, false); return [ok, ok ? '테두리 완성' : '5×5 속이 빈 네모가 아직 없어요']; }],
  ['c7', 1, '반복 속의 반복', '5×5 꽉 찬 바닥을 반복 두 겹으로', '바깥 반복 = 줄 수, 안쪽 반복 = 한 줄의 칸 수. 줄이 끝나면 옆으로 옮기고 뒤로 돌아와요.', { ban: SHAPE_BLOCKS, nest: 2 }, R => { const ok = CMK.square(R, 5, true); return [ok, ok ? '바닥 완성' : '꽉 찬 5×5 바닥이 아직 없어요']; }],
  ['c8', 1, '끝없는 계단', '20칸 계단을 블록 5개 이하로', '반복 안에 놓기·앞으로·위로.', { ban: SHAPE_BLOCKS, max: 5, must: [['repeat']] }, R => { const n = CMK.longestStairs(R); return [n >= 20, `계단 ${n} / 20`]; }],
  ['c9', 2, '점점 높아지는 기둥', '높이가 모두 다른 기둥 5개 (i 를 바꾸며 반복)', '「i 를 1부터 5까지 바꾸며 반복」 안의 반복 횟수에 i 를 써요.', { ban: SHAPE_BLOCKS, must: [['for']] }, R => { const n = new Set(CMK.columns(R)).size; return [n >= 5, `서로 다른 높이 ${n} / 5`]; }],
  ['c10', 2, '무지개 길', '서로 다른 색 7가지를 놓아요', '「양털 색 번호 i 고르기」 + i 를 바꾸며 반복.', { must: [['for'], ['setcolor']] }, R => [R.colors >= 7, `색 ${R.colors} / 7`]],
  ['c11', 2, '직접 만든 피라미드', '아래가 넓고 위로 갈수록 좁아지는 층 4개 이상', '층마다 크기를 변수로 줄여요. (피라미드·상자·바닥 블록은 금지)', { ban: SHAPE_BLOCKS }, R => {
    const L = CMK.layers(R); let k = 1; for (let i = 1; i < L.length; i++) { if (L[i] < L[i - 1]) k++; else break; } return [L.length >= 4 && k >= 4, `줄어드는 층 ${Math.min(k, L.length)} / 4`]; }],
  ['c12', 2, '숫자 말하기', '변수를 정하고 바꾸고, 「말하기」로 값을 보여 줘요', '「x 를 0 으로 정하기」 → 「x 를 1 만큼 바꾸기」 → 말하기 「x 는 {x}」', { must: [['set'], ['change'], ['say']] }, R => [R.sayVar, R.sayVar ? '변수 값을 말했어요' : '말하기 글에 {x} 처럼 변수를 넣어 봐요']],
  ['c13', 3, '바닥까지 기둥', '공중에서 땅까지 기둥을 내려요 (높이 4 이상)', '「위로 6칸」 이동한 뒤, 「아래에 블록이 있음 이(가) 될 때까지 반복」 안에 「놓기」 + 「아래로 1칸」.', { must: [['until']], ban: SHAPE_BLOCKS }, R => { const n = CMK.longestColumn(R); return [n >= 4, `기둥 높이 ${n} / 4`]; }],
  ['c14', 3, '체크무늬', '두 색이 번갈아 나오는 4×4 체크무늬', '「만약 식이 참: (i + j) % 2 == 0 이면 / 아니면」으로 색을 골라요.', { must: [['ifelse']] }, R => { const ok = CMK.checker(R, 4); return [ok, ok ? '체크무늬 완성' : '번갈아 나오는 4×4 가 아직 없어요']; }],
  ['c15', 3, '동전 숲', '동전 던지기로 높이가 제각각인 기둥 6개', '「만약 동전 앞면 이면」 안에서 한 칸 더 쌓기.', { must: [['if', 'ifelse'], ['repeat', 'for']], cond: ['coin', 'expr'] }, R => { const c = CMK.columns(R); return [c.length >= 6 && new Set(c).size >= 2, `기둥 ${c.length} / 6 · 높이 종류 ${new Set(c).size}`]; }],
  ['c16', 3, '똑똑한 감지기', '「앞」·「아래」를 감지하는 조건으로 10칸 이상', '「만약 아래가 비어 있음 이면 놓기」로 구덩이만 메우는 다리!', { must: [['if', 'ifelse', 'until']], cond: ['ahead', 'aheadAir', 'below', 'belowAir', 'above', 'here'] }, R => [R.n >= 10, `놓은 블록 ${R.n} / 10`]],
  ['c17', 4, '기둥 공장', '함수 하나로 높이 3 이상 기둥 3개', '「함수 기둥 만들기」 안에 기둥을, 밖에서 「함수 기둥 실행하기」를 3번.', { must: [['func'], ['call']], ban: SHAPE_BLOCKS }, R => { const n = CMK.columns(R).filter(h => h >= 3).length; return [R.calls >= 3 && n >= 3, `함수 부른 횟수 ${R.calls} / 3 · 기둥 ${n} / 3`]; }],
  ['c18', 4, '함수 속 반복', '반복이 들어 있는 함수를 2번 이상 불러 20칸 이상', '함수 안에 반복 블록을 넣어요.', { must: [['func'], ['call']], funcLoop: true }, R => [R.calls >= 2 && R.n >= 20, `부른 횟수 ${R.calls} / 2 · 블록 ${R.n} / 20`]],
  ['c19', 4, '크기가 다른 두 집', '변수로 크기를 바꿔 같은 함수로 건물 2채 (40칸 이상)', '「크기 를 5 로 정하기」 → 함수 실행 → 「크기 를 3 만큼 바꾸기」 → 함수 실행.', { must: [['func'], ['call'], ['set', 'change']] }, R => [R.calls >= 2 && R.n >= 40, `부른 횟수 ${R.calls} / 2 · 블록 ${R.n} / 40`]],
  ['c20', 5, '나만의 점프맵', '반복으로 출발·도착 발판이 있는 점프맵 (발판 8개 이상)', '「점프맵 만들기」 블록 없이! 반복과 무작위로 발판 위치를 바꿔요.', { must: [['repeat', 'for']], ban: ['parkour'] }, R => {
    const s = R.ids.has(PK.start), f = R.ids.has(PK.finish), plat = R.n - (s ? 1 : 0) - (f ? 1 : 0); return [s && f && plat >= 8, `출발 ${s ? '✓' : '✗'} · 도착 ${f ? '✓' : '✗'} · 발판 ${plat} / 8`]; }],
  ['c21', 5, '효율왕', '블록 8개 이하의 코드로 200칸 이상 짓기', '반복 속의 반복 + 변수!', { max: 8, ban: SHAPE_BLOCKS }, R => [R.n >= 200, `블록 ${R.n} / 200 · 코드 ${R.nodes}개`]],
  ['c22', 5, '재귀 나무', '함수가 자기 자신을 부르게 해서 3겹 이상 (재귀)', '「함수 가지 만들기」 안에서 다시 「함수 가지 실행하기」. 깊이 변수로 멈추게!', { must: [['func'], ['call']] }, R => [R.recur >= 3, `재귀 깊이 ${R.recur} / 3`]],
];
const CM_KEY = 'educraft.codeMastery';
function cmLoad() { try { return new Set(JSON.parse(localStorage.getItem(CM_KEY) || '[]')); } catch (e) { return new Set(); } }
function cmSave(s) { try { localStorage.setItem(CM_KEY, JSON.stringify([...s])); } catch (e) { } }
function cmChaptersDone() { const d = cmLoad(); let n = 0; for (let c = 0; c < CM_CHAPTERS.length; c++) { if (CM_LIST.filter(m => m[1] === c).every(m => d.has(m[0]))) n = c + 1; else break; } return n; }
function cmCurrent(done) { return CM_LIST.find(m => !done.has(m[0])) || null; }
// 프로그램 살펴보기
function cmAnalyze(prog) {
  const used = new Set(), conds = new Set(); let nodes = 0, nest = 0, sayVar = false, funcLoop = false;
  const walk = (list, depth, inFunc) => {
    for (const n of list || []) {
      nodes++; used.add(n.t);
      const loop = n.t === 'repeat' || n.t === 'for' || n.t === 'until' || n.t === 'forever';
      if (loop) nest = Math.max(nest, depth + 1);
      if (loop && inFunc) funcLoop = true;
      if ((n.t === 'if' || n.t === 'ifelse' || n.t === 'until') && n.a) conds.add(n.a.c || 'ahead');
      if (n.t === 'say' && /\{\s*[a-zA-Z가-힣_]/.test(String(n.a && n.a.s || ''))) sayVar = true;
      walk(n.c, depth + (loop ? 1 : 0), inFunc || n.t === 'func'); walk(n.c2, depth + (loop ? 1 : 0), inFunc || n.t === 'func');
    }
  };
  walk(prog, 0, false);
  return { used, conds, nodes, nest, sayVar, funcLoop };
}
function cmRules(m, A) {
  const o = m[5], bad = [];
  if (o.max && A.nodes > o.max) bad.push(`코드 블록이 ${A.nodes}개예요. ${o.max}개 이하로 줄여 봐요`);
  for (const group of o.must || []) if (!group.some(t => A.used.has(t))) bad.push(`「${codeName(group[0])}」 블록을 써야 해요`);
  for (const t of o.ban || []) if (A.used.has(t)) { bad.push(`이번 단계는 「${codeName(t)}」 블록 없이 해 봐요`); break; }
  if (o.nest && A.nest < o.nest) bad.push(`반복 안에 반복을 넣어야 해요 (지금 ${A.nest}겹)`);
  if (o.cond && !o.cond.some(c => A.conds.has(c))) bad.push('알맞은 조건(감지)을 골라 봐요');
  if (o.funcLoop && !A.funcLoop) bad.push('함수 안에 반복 블록을 넣어 봐요');
  return bad;
}
{
  const B = Builder.prototype;
  // 실제로 지은 칸 기록
  const _begin = B.begin;
  B.begin = function (pv) { _begin.call(this, pv); this.runCells = new Map(); this.callStack = []; this.maxRecur = 0; };
  const _put = B.put;
  B.put = function (x, y, z, id, meta) {
    _put.call(this, x, y, z, id, meta);
    if (this.dry || !this.runCells) return;
    const k = x + ',' + y + ',' + z, now = this.g.world.getBlock(x, y, z);
    if (now && id) this.runCells.set(k, [x, y, z, now]); else this.runCells.delete(k);
  };
  const _exec = B.exec;
  B.exec = function* (n) {
    if (n.t !== 'call') { yield* _exec.call(this, n); return; }
    const name = String(n.a && n.a.f || '').trim(), st = this.callStack || (this.callStack = []);
    const self = st.filter(x => x === name).length + 1;
    if (st.includes(name)) this.maxRecur = Math.max(this.maxRecur || 0, self);
    st.push(name);
    try { yield* _exec.call(this, n); } finally { st.pop(); }
  };
  // 끝까지 실행했을 때 검사 (예전 「코딩 도전」을 대신함)
  B.checkMissions = function (st) {
    const g = this.g, done = cmLoad(), cur = cmCurrent(done);
    if (!cur) return;
    // 지은 칸 → 빌더봇 기준 좌표
    const f = this.startFacing, fv = [DX[f], DZ[f]], rv = [DX[CW[f]], DZ[CW[f]]];
    const cells = [], map = new Map(), ids = new Set(), colors = new Set();
    for (const [x, y, z, id] of this.runCells ? this.runCells.values() : []) {
      const dx = x - this.sx, dz = z - this.sz;
      const c = { r: dx * rv[0] + dz * rv[1], u: y - this.sy, f: dx * fv[0] + dz * fv[1], id };
      cells.push(c); map.set(CMK.key(c.r, c.u, c.f), id); ids.add(id);
      if (/^(wool|concrete)_/.test(BLOCKS[id].name)) colors.add(id);
    }
    const A = cmAnalyze(this.program);
    const R = { cells, n: cells.length, ids, colors: colors.size, calls: st ? st.calls : 0, recur: this.maxRecur || 0, nodes: A.nodes, sayVar: A.sayVar,
      has: (r, u, f) => map.has(CMK.key(r, u, f)), id: (r, u, f) => map.get(CMK.key(r, u, f)) };
    // 지금 단계부터 차례로 (한 번에 여러 단계를 깰 수도 있음)
    let m = cur, passed = [], fb = null;
    while (m) {
      const bad = cmRules(m, A), [ok, txt] = m[6](R);
      if (bad.length || !ok) { fb = { m, bad, txt, ok }; break; }
      done.add(m[0]); passed.push(m); m = cmCurrent(done);
    }
    if (passed.length) {
      cmSave(done);
      for (const p of passed) { g.ui.toast(`🎓 코딩 마스터 ${CM_LIST.indexOf(p) + 1}단계 「${p[2]}」 성공!`, 3200); g.ui.chatLine(`🎓 코딩 마스터 「${p[2]}」 성공! (${done.size}/${CM_LIST.length})`, '#ffe27a'); }
      const last = passed[passed.length - 1];
      if (done.size === CM_LIST.length) { try { if (!localStorage.getItem(CM_KEY + '.date')) localStorage.setItem(CM_KEY + '.date', String(Date.now())); } catch (e) { } setTimeout(() => g.ui.toast('🏅 코딩 마스터 디지털 배지를 받을 수 있어요! 코딩 창 → 🎓 코딩 마스터', 5000), 2500); }
      if (CM_LIST.filter(x => x[1] === last[1]).every(x => done.has(x[0]))) { g.ui.toast(`🏅 「${CM_CHAPTERS[last[1]][0]}」 장을 모두 깼어요! 빌더봇 색이 바뀌었어요`, 4000); g.sound.play('victory'); }
      else g.sound.play('levelup');
      if (g.spawnXP && g.player) g.spawnXP(g.player.x, g.player.y + 1, g.player.z, 5 * passed.length + 5 * last[1]);
      g._achT = 0;   // 도전 과제(코딩 마스터 장) 바로 확인
    } else if (fb) {
      const msg = fb.bad.length ? fb.bad[0] : fb.txt;
      g.ui.chatLine(`🎓 「${fb.m[2]}」 아직이에요 — ${msg}`, '#ffb37a');
    }
    this.cmLast = fb && !passed.length ? fb : null;
    this.renderMissions();
  };
  B.renderMissions = function () {
    const done = cmLoad(), n = document.getElementById('cd-misn'), box = document.getElementById('cd-missions');
    if (n) n.textContent = `${done.size}/${CM_LIST.length}`;
    if (!box || !box.classList.contains('show')) return;
    const cur = cmCurrent(done), chDone = cmChaptersDone();
    let html = `<h4>🎓 코딩 마스터</h4><div class="cm-rank">빌더봇 등급: <b style="color:${BOT_RANK[chDone].css}">${BOT_RANK[chDone].k}</b> · ${done.size}/${CM_LIST.length}단계</div>`;
    if (cur) {
      const fb = this.cmLast && this.cmLast.m === cur ? this.cmLast : null, o = cur[5];
      const lim = [o.max ? `코드 블록 ${o.max}개 이하` : '', (o.must || []).map(gp => '「' + codeName(gp[0]) + '」 쓰기').join(', '), o.ban && o.ban.length > 3 ? '도형 블록 금지' : (o.ban || []).map(t => '「' + codeName(t) + '」 금지').join(', ')].filter(Boolean).join(' · ');
      html += `<div class="cm-now"><small>${CM_LIST.indexOf(cur) + 1}단계 · ${CM_CHAPTERS[cur[1]][0]}${cur[1] === 5 ? ' (전설)' : ''}</small><b>${esc(cur[2])}</b><p>${esc(cur[3])}</p>
        ${lim ? `<p class="cm-lim">📏 ${esc(lim)}</p>` : ''}
        <details><summary>💡 힌트 보기</summary><p>${esc(cur[4])}</p></details>
        ${fb ? `<p class="cm-fb">🔍 지난 실행: ${esc(fb.bad.length ? fb.bad.join(' / ') : fb.txt)}</p>` : '<p class="muted">코드를 짜서 ▶ 실행하고, 끝까지 마치면 검사해요.</p>'}</div>`;
    } else html += `<div class="cm-now cm-badge"><b>🎉 모든 단계를 깼어요! 진짜 코딩 마스터!</b>
        <p>디지털 배지를 그림(PNG)으로 내려받을 수 있어요. 배지에 들어갈 이름을 확인하세요.</p>
        <div class="row" style="gap:6px;margin:0"><input id="cm-bname" maxlength="16" value="${esc(this.g.settings.name || '')}" placeholder="닉네임" style="flex:1;min-width:0"><button class="btn small primary" id="cm-bdl">🏅 배지 내려받기</button></div>
        <img id="cm-bprev" alt="코딩 마스터 배지 미리보기"></div>`;
    CM_CHAPTERS.forEach(([name, desc], ci) => {
      html += `<div class="cm-ch"><b>${ci + 1}장 ${esc(name)}</b> <small>${esc(desc)}</small></div>`;
      for (const m of CM_LIST.filter(x => x[1] === ci)) {
        const d = done.has(m[0]), now = cur && cur[0] === m[0];
        html += `<div class="cm ${d ? 'done' : now ? 'now' : 'lock'}">${d ? '✅' : now ? '▶' : '🔒'} ${CM_LIST.indexOf(m) + 1}. ${esc(d || now ? m[2] : m[2])}</div>`;
      }
    });
    box.innerHTML = html;
    if (!cur) {
      const inp = box.querySelector('#cm-bname'), img = box.querySelector('#cm-bprev');
      inp.addEventListener('keydown', e => e.stopPropagation());
      const prev = () => cmBadgeCanvas(this.g, inp.value.trim() || '코딩 마스터').then(cv => { img.src = cv.toDataURL('image/png'); }).catch(() => { });
      let t = null; inp.oninput = () => { clearTimeout(t); t = setTimeout(prev, 300); };
      prev();
      box.querySelector('#cm-bdl').onclick = () => cmBadgeDownload(this.g, inp.value.trim() || '코딩 마스터');
    }
  };
}
// 장을 깰수록 빌더봇 색이 바뀜 (브론즈 → 실버 → 골드 → 에메랄드 → 다이아 → 무지개 전설)
const BOT_RANK = [
  { k: '새내기', body: [0.85, 0.88, 0.92], css: '#7a8494' }, { k: '브론즈', body: [0.8, 0.55, 0.35], css: '#b07a4a' }, { k: '실버', body: [0.9, 0.92, 0.96], css: '#8a96aa' },
  { k: '골드', body: [1, 0.82, 0.3], css: '#d9a520' }, { k: '에메랄드', body: [0.35, 0.85, 0.5], css: '#2fae5a' }, { k: '다이아', body: [0.45, 0.9, 0.95], css: '#20a8c0' }, { k: '전설 🌈', body: null, css: '#e0458a' },
];
{
  const B = Builder.prototype;
  B.renderBotAt = function (R, cam, b) {
    const m = M4.create(), t = M4.create();
    const tm = b.t || this.anim, bob = Math.sin(tm * 4) * 0.06;
    M4.translate(m, b.x + 0.5 - cam[0], b.y + 0.35 + bob - cam[1], b.z + 0.5 - cam[2]);
    M4.mul(m, m, M4.rotY(t, { 2: 0, 3: Math.PI, 4: Math.PI / 2, 5: -Math.PI / 2 }[b.f] || 0));
    const rk = BOT_RANK[b.rank !== undefined ? b.rank : this.rankNow()] || BOT_RANK[0];
    const body = rk.body || [0.5 + 0.5 * Math.sin(tm * 2), 0.5 + 0.5 * Math.sin(tm * 2 + 2.1), 0.5 + 0.5 * Math.sin(tm * 2 + 4.2)];
    const lit = !rk.body || rk === BOT_RANK[3] || rk === BOT_RANK[5];
    const L = lit ? [1, 0.6] : [1, 0.3];
    R.ent.addBox(m, -0.28, -0.2, -0.25, 0.28, 0.3, 0.25, body, L[0], L[1]);
    R.ent.addBox(m, -0.22, -0.08, -0.27, 0.22, 0.2, -0.25, [0.1, 0.15, 0.2], 1, 0.3);
    R.ent.addBox(m, -0.15, 0.02, -0.28, -0.05, 0.12, -0.27, [0.3, 0.95, 1], 1, 1);
    R.ent.addBox(m, 0.05, 0.02, -0.28, 0.15, 0.12, -0.27, [0.3, 0.95, 1], 1, 1);
    R.ent.addBox(m, -0.02, 0.3, -0.02, 0.02, 0.5, 0.02, [0.5, 0.5, 0.55], 1, 0.3);
    R.ent.addBox(m, -0.05, 0.48, -0.05, 0.05, 0.56, 0.05, rk.body ? [1, 0.3, 0.2] : [1, 0.9, 0.3], 1, 1);
    R.ent.addBox(m, -0.36, -0.12, -0.08, -0.28, 0.12, 0.08, body.map(v => v * 0.6), L[0], L[1]);
    R.ent.addBox(m, 0.28, -0.12, -0.08, 0.36, 0.12, 0.08, body.map(v => v * 0.6), L[0], L[1]);
    R.ent.addBox(m, -0.14, -0.35, -0.12, 0.14, -0.2, 0.12, [0.3, 0.8, 1], 1, 1);
    if (rk.k === '전설 🌈' || rk === BOT_RANK[5]) R.ent.addBox(m, -0.2, 0.62, -0.03, 0.2, 0.66, 0.03, [1, 0.9, 0.4], 1, 1);   // 왕관 막대
  };
  // 등급은 3초마다만 다시 읽음 (그리기·네트워크가 매 프레임 부르므로)
  B.rankNow = function () { const now = performance.now(); if (this._rank === undefined || now > (this._rankT || 0)) { this._rankT = now + 3000; this._rank = cmChaptersDone(); } return this._rank; };
  const _ns = B.netState;
  B.netState = function () { const s = _ns.call(this); if (s) s.rank = this.rankNow(); return s; };
}

// ---------------- 🏅 코딩 마스터 디지털 배지 (PNG) ----------------
function cmDoneDate() {
  let t = 0; try { t = +localStorage.getItem(CM_KEY + '.date') || 0; if (!t) { t = Date.now(); localStorage.setItem(CM_KEY + '.date', String(t)); } } catch (e) { t = Date.now(); }
  return new Date(t);
}
// 확인 번호: 이름 + 날짜로 만든 짧은 코드 (배지를 손으로 고치면 맞지 않음)
function cmBadgeCode(name, d) {
  const s = 'EDUCRAFT-CM22|' + name + '|' + d.toISOString().slice(0, 10);
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (const ch of s) { const c = ch.codePointAt(0); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2654435761) >>> 0; }
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', enc = (h) => { let o = ''; for (let i = 0; i < 4; i++) { o += A[h % 32]; h = Math.floor(h / 32); } return o; };
  return 'EC-' + enc(h1) + '-' + enc(h2);
}
async function cmBadgeCanvas(g, name) {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const FONT = '"Pretendard Variable", Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  try { await Promise.all([document.fonts.load('800 80px "Pretendard Variable"'), document.fonts.load('500 30px "Pretendard Variable"')]); } catch (e) { }
  const RB = ['#ff5a6e', '#ff9d3c', '#ffd84a', '#5fd47a', '#4aa8ff', '#9a6cff'];
  // 바탕
  const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1d2350'); bg.addColorStop(0.55, '#3a2468'); bg.addColorStop(1, '#14193a');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const rnd = mulberry32(strHash(name) + 7);
  for (let i = 0; i < 90; i++) { const x = rnd() * W, y = rnd() * H, s = rnd() < 0.2 ? 6 : 3; c.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.5})`; c.fillRect(x, y, s, s); }
  // 무지개 픽셀 테두리
  for (let i = 0; i < 6; i++) { c.fillStyle = RB[i]; const o = 18 + i * 7; c.fillRect(o, o, W - o * 2, 7); c.fillRect(o, H - o - 7, W - o * 2, 7); c.fillRect(o, o, 7, H - o * 2); c.fillRect(W - o - 7, o, 7, H - o * 2); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(255,255,255,0.75)'; c.font = `600 30px ${FONT}`; c.fillText('EDU CRAFT · 에듀 크래프트', W / 2, 118);
  // 제목
  const tg = c.createLinearGradient(240, 0, 840, 0); RB.forEach((col, i) => tg.addColorStop(i / 5, col));
  c.fillStyle = tg; c.font = `900 104px ${FONT}`; c.fillText('코딩 마스터', W / 2, 215);
  c.fillStyle = '#ffffff'; c.font = `700 34px ${FONT}`; c.fillText('C O D I N G   M A S T E R', W / 2, 290);
  // 메달 + 아바타
  const cx = W / 2, cy = 560, R = 205;
  for (let i = 0; i < 12; i++) { c.beginPath(); c.fillStyle = RB[i % 6]; c.moveTo(cx, cy); c.arc(cx, cy, R + 34, i / 12 * Math.PI * 2 - Math.PI / 2, (i + 1) / 12 * Math.PI * 2 - Math.PI / 2); c.fill(); }
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); const mg = c.createRadialGradient(cx, cy - 60, 20, cx, cy, R); mg.addColorStop(0, '#fff8d8'); mg.addColorStop(1, '#ffd36a'); c.fillStyle = mg; c.fill();
  c.lineWidth = 10; c.strokeStyle = '#fff'; c.stroke();
  let av = g.avatar; if (av) ensureAvatarPixels(av); if (!av || !av.pixels) av = g.fallbackAvatar();
  if (av && av.pixels) {
    const body = skinBodyCanvas(av.pixels, av.slim, 1), bh = R * 1.62, bw = bh * body.width / body.height;
    c.save(); c.beginPath(); c.arc(cx, cy, R - 6, 0, Math.PI * 2); c.clip();
    c.imageSmoothingEnabled = false; c.drawImage(body, cx - bw / 2, cy - bh / 2 + 14, bw, bh); c.restore();
  }
  // 리본 + 닉네임
  c.fillStyle = '#e0458a'; c.beginPath(); c.moveTo(cx - 300, cy + R + 10); c.lineTo(cx + 300, cy + R + 10); c.lineTo(cx + 270, cy + R + 60); c.lineTo(cx + 300, cy + R + 110); c.lineTo(cx - 300, cy + R + 110); c.lineTo(cx - 270, cy + R + 60); c.closePath(); c.fill();
  c.fillStyle = '#fff'; let fs = 64; c.font = `800 ${fs}px ${FONT}`; while (c.measureText(name).width > 520 && fs > 30) { fs -= 4; c.font = `800 ${fs}px ${FONT}`; }
  c.fillText(name, cx, cy + R + 62);
  // 설명
  c.fillStyle = '#fff'; c.font = `700 40px ${FONT}`; c.fillText('6장 22단계를 모두 해냈어요!', cx, 935);
  c.fillStyle = 'rgba(255,255,255,0.78)'; c.font = `500 28px ${FONT}`; c.fillText('빌더봇 블록 코딩으로 반복 · 변수 · 조건 · 함수 · 재귀까지', cx, 985);
  // 장 칩
  const chips = CM_CHAPTERS.map(x => x[0]), cw = 150, gap = 14, x0 = cx - (chips.length * cw + (chips.length - 1) * gap) / 2;
  chips.forEach((t, i) => {
    const x = x0 + i * (cw + gap), y = 1035;
    c.fillStyle = RB[i]; c.beginPath(); if (c.roundRect) c.roundRect(x, y, cw, 64, 18); else c.rect(x, y, cw, 64); c.fill();
    c.fillStyle = '#1d2350'; c.font = `800 26px ${FONT}`; c.fillText('✓ ' + t, x + cw / 2, y + 33);
  });
  // 날짜·확인 번호
  const d = cmDoneDate();
  c.fillStyle = '#fff'; c.font = `600 30px ${FONT}`;
  c.fillText(`${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 달성 · 빌더봇 등급 전설 🌈`, cx, 1160);
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = `500 24px ${FONT}`;
  c.fillText(`확인 번호 ${cmBadgeCode(name, d)} · lo4lolo.github.io/edu-craft`, cx, 1215);
  return cv;
}
async function cmBadgeDownload(g, name) {
  if (cmLoad().size < CM_LIST.length) { g.ui.toast('코딩 마스터 22단계를 모두 깨면 받을 수 있어요'); return; }
  try {
    const cv = await cmBadgeCanvas(g, name);
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const fname = '코딩마스터_배지_' + String(name).replace(/[\\/:*?"<>|]+/g, '_') + '.png';
    if (typeof downloadBlob === 'function') downloadBlob(blob, fname);
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click(); }
    g.ui.toast('🏅 배지 그림을 내려받았어요! (다운로드 폴더)', 3000);
    g.sound.play('levelup');
  } catch (e) { g.ui.toast('배지를 만들지 못했어요: ' + e.message, 4000); }
}
