'use strict';
// =====================================================================
// 메시 작업자 (Web Worker) — 청크 메시를 메인 스레드 밖에서 만든다
//  - 페이지와 똑같은 게임 파일들을 importScripts 로 불러옴 (다른 파일이 Mesher 를 감싸도 그대로 적용)
//  - 받음 init {scripts, ls, texNames, blockSig}  → ready / fail
//         job  {id, world:{seed,type,dim,gen}, mp(메셔 설정), st(설정), chunks:[가운데 + 이웃 8개]}
//           → done {id, arrays:[불투명, 컷아웃, 반투명], minY, maxY, ms, back:[돌려줄 버퍼]}
//  - 오류가 나면 err/fail 을 보내고, 메인은 원래 방식(메인 스레드 메시)으로 돌아감
// =====================================================================
(function shim() {
  // 페이지 파일의 맨 위 코드가 window·document 를 건드려도 멈추지 않게 아무 일도 안 하는 대역
  const stub = () => new Proxy(function () { }, {
    get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === Symbol.iterator ? function* () { } : k === 'length' ? 0 : k === 'then' ? undefined : stub(),
    set: () => true, apply: () => stub(), construct: () => stub(), has: () => true,
  });
  const store = (init) => {
    const m = new Map(Object.entries(init || {}));
    return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, clear: () => m.clear(), key: i => [...m.keys()][i] || null, get length() { return m.size; } };
  };
  self.window = self;
  self.document = stub();
  self.localStorage = store(); self.sessionStorage = store();
  self.__mwStore = store;
  self.matchMedia = () => ({ matches: false, addEventListener() { }, removeEventListener() { }, addListener() { } });
  self.requestAnimationFrame = () => 0; self.cancelAnimationFrame = () => { };
  self.alert = self.confirm = self.prompt = () => null;
  self.devicePixelRatio = 1; self.innerWidth = 1280; self.innerHeight = 720; self.screen = { width: 1280, height: 720 };
  for (const n of ['Image', 'Audio', 'AudioContext', 'webkitAudioContext', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver']) if (!(n in self)) self[n] = stub();
  if (!self.addEventListener) self.addEventListener = () => { };
})();

let MW = null;   // { mesher, worlds }
function mwInit(m) {
  const t0 = performance.now();
  if (m.ls) { const s = self.__mwStore(m.ls); self.localStorage = s; }
  // 게임 파일 불러오기 (하나씩: 어느 파일에서 멈췄는지 알 수 있게)
  //  - 파일이 없어서(404 등) 못 받은 것은 페이지에서도 안 읽혔을 테니 건너뜀. 파일 안에서 오류가 나면 멈춤
  const skipped = [];
  for (const src of m.scripts) {
    try { importScripts(src); }
    catch (e) {
      if (e && e.name === 'NetworkError') { skipped.push(src.split('/').pop()); continue; }
      throw new Error('불러오기 실패 ' + src.split('/').pop() + ': ' + (e && e.message || e));
    }
  }
  self.__mwSkipped = skipped;
  // 메인 game.boot() 의 앞부분과 같은 순서 (파스텔은 픽셀만 바꾸고 번호는 그대로라 생략)
  buildTextures(); defineBlocks(); buildBlockTables();
  // 텍스처 번호·블록 모양이 메인과 똑같은지 확인
  if (TEX.names.join('|') !== m.texNames) throw new Error('텍스처 목록이 달라요 (' + TEX.names.length + ')');
  if (meshBlockSig() !== m.blockSig) throw new Error('블록 정의가 달라요');
  MW = { mesher: new Mesher(), worlds: new Map() };
  return performance.now() - t0;
}
function mwWorld(w) {
  const k = w.seed + '|' + w.type + '|' + w.dim;
  let W = MW.worlds.get(k);
  if (!W) { W = new World(w.seed, w.type, w.dim); MW.worlds.set(k, W); if (MW.worlds.size > 4) MW.worlds.delete(MW.worlds.keys().next().value); }
  for (const p in w) if (p !== 'seed' && p !== 'type' && p !== 'dim') W[p] = w[p];
  return W;
}
function mwJob(m) {
  const t0 = performance.now();
  const W = mwWorld(m.world);
  W.chunks.clear(); W._cc = null;
  let center = null;
  for (const d of m.chunks) {
    const c = Object.create(Chunk.prototype);
    Object.assign(c, d.props);
    c.cx = d.cx; c.cz = d.cz; c.state = d.state;
    c.ids = d.ids; c.meta = d.meta; c.light = d.light; c.biome = d.biome; c.heights = d.heights;
    c.mesh = null; c.dirty = true;
    W.chunks.set(ckey(c.cx, c.cz), c);
    if (!center) center = c;
  }
  const me = MW.mesher;
  Object.assign(me, m.mp);
  if (m.st) { const g = self.game || (self.game = {}); g.settings = m.st; g.mesher = me; g.world = W; }
  const arrays = me.build(W, center);
  W.chunks.clear(); W._cc = null;
  const tr = [], back = [];
  for (const a of arrays) if (a) tr.push(a.buffer);
  // 받은 큰 버퍼는 메인에 돌려줘서 다음 일에 다시 씀 (메모리 아낌)
  for (const d of m.chunks) for (const a of [d.ids, d.meta, d.light]) if (a.byteLength === CSZ && tr.indexOf(a.buffer) < 0) { back.push(a.buffer); tr.push(a.buffer); }
  self.postMessage({ t: 'done', id: m.id, arrays, minY: center.minY, maxY: center.maxY, ms: performance.now() - t0, back }, tr);
}
self.onmessage = (ev) => {
  const m = ev.data;
  if (m.t === 'init') {
    try { const ms = mwInit(m); self.postMessage({ t: 'ready', ms }); }
    catch (e) { self.postMessage({ t: 'fail', msg: String(e && e.message || e) }); }
  } else if (m.t === 'job') {
    if (!MW) { self.postMessage({ t: 'err', id: m.id, msg: '준비 안 됨' }); return; }
    try { mwJob(m); }
    catch (e) { self.postMessage({ t: 'err', id: m.id, msg: String(e && e.stack || e) }); }
  }
};
