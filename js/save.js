'use strict';
// =====================================================================
// 에듀 크래프트: 저장·불러오기 고도화 (v1.2)
//  - IndexedDB 2판: worlds + backups(세계마다 최근 5개, 지운 세계도 14일 보관)
//  - 저장할 때 작은 미리보기 그림(썸네일), 바뀐 블록 수, 버전 기록
//  - 저장 공간이 꽉 차면 알려 주고, 브라우저가 저장소를 함부로 지우지 않게 요청(persist)
//  - 파일: gzip 으로 줄인 .educraft (안 되는 브라우저는 .json), 여러 세계 한 번에, 끌어다 놓기
//  - 함께 하기 참가자도 방장 세계의 사본을 저장
//  - 저장소를 못 쓰는 창(시크릿 등)에서는 메모리에 두고 알림
// =====================================================================
const SAVE_FMT = 2;
const BACKUP_KEEP = 5, BACKUP_ORPHAN_DAYS = 14;
{
  const mem = { worlds: new Map(), backups: new Map() };
  Object.assign(DB, {
    volatile: false,
    open() {
      if (this.db) return Promise.resolve(this.db);
      if (this.volatile) return Promise.resolve(null);
      return new Promise((res) => {
        let r;
        const fail = () => { this.volatile = true; res(null); };
        try { r = indexedDB.open('educraft', 2); } catch (e) { fail(); return; }
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('backups')) { const b = db.createObjectStore('backups', { keyPath: 'key' }); b.createIndex('wid', 'wid'); }
        };
        r.onsuccess = () => { this.db = r.result; this.db.onversionchange = () => { try { this.db.close(); } catch (e) { } this.db = null; }; res(this.db); };
        r.onerror = fail;
        // 옛 버전 창이 열려 있으면 저장소를 새 모양으로 바꾸지 못하고 기다림 → 알려 줌 (닫히면 이어서 열림)
        r.onblocked = () => { try { window.game.ui.toast('⚠ 다른 창(탭)에 옛 버전 에듀 크래프트가 열려 있어요. 그 창을 닫으면 세계 목록이 나타나요', 8000); } catch (e) { } };
      });
    },
    async txs(store, mode, fn) {
      const db = await this.open();
      if (!db) return fn(null, mem[store]);
      return new Promise((res, rej) => {
        const t = db.transaction(store, mode), st = t.objectStore(store);
        const r = fn(st);
        t.oncomplete = () => res(r && r.result !== undefined ? r.result : undefined);
        t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('저장이 취소됐어요'));
      });
    },
    tx(mode, fn) { return this.txs('worlds', mode, fn); },
    list() {
      return this.txs('worlds', 'readonly', (st, m) => m ? { result: [...m.values()] } : st.getAll())
        .then(a => (a || []).map(w => ({ id: w.id, name: w.name, mode: w.mode, type: w.type, seed: w.seed, played: w.played, created: w.created, thumb: w.thumb, blocks: w.blocks, dim: w.dim, v: w.v })));
    },
    get(id) { return this.txs('worlds', 'readonly', (st, m) => m ? { result: m.get(id) } : st.get(id)); },
    put(w) { return this.txs('worlds', 'readwrite', (st, m) => m ? (m.set(w.id, w), null) : st.put(w)); },
    del(id) { return this.txs('worlds', 'readwrite', (st, m) => m ? (m.delete(id), null) : st.delete(id)); },
    backups(wid) {
      return this.txs('backups', 'readonly', (st, m) => m ? { result: [...m.values()] } : (wid ? st.index('wid').getAll(wid) : st.getAll()))
        .then(a => (a || []).filter(b => !wid || b.wid === wid).map(b => ({ key: b.key, wid: b.wid, time: b.time, name: b.name, why: b.why, thumb: b.rec && b.rec.thumb })).sort((x, y) => y.time - x.time));
    },
    getBackup(key) { return this.txs('backups', 'readonly', (st, m) => m ? { result: m.get(key) } : st.get(key)); },
    putBackup(b) { return this.txs('backups', 'readwrite', (st, m) => m ? (m.set(b.key, b), null) : st.put(b)); },
    delBackup(key) { return this.txs('backups', 'readwrite', (st, m) => m ? (m.delete(key), null) : st.delete(key)); },
    async trimBackups(wid) {
      const list = await this.backups(wid);
      for (const b of list.slice(BACKUP_KEEP)) await this.delBackup(b.key);
    },
    // 지운 세계의 백업은 14일 뒤 정리
    async trimOrphans() {
      const ids = new Set((await this.list()).map(w => w.id)), cut = Date.now() - BACKUP_ORPHAN_DAYS * 864e5;
      for (const b of await this.backups()) if (!ids.has(b.wid) && b.time < cut) await this.delBackup(b.key);
    },
  });
}
// 저장 공간 오래 지키기 + 사용량
async function storageInfo() {
  try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } catch (e) { return null; }
}
function fmtMB(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }

// ---------------- 파일로 내보내기·불러오기 ----------------
async function packFile(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === 'function') {
    try {
      const s = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      return { blob: await new Response(s).blob(), ext: '.educraft' };
    } catch (e) { }
  }
  return { blob: new Blob([json], { type: 'application/json' }), ext: '.educraft.json' };
}
async function unpackFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let text;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw new Error('이 브라우저는 압축된 세계 파일을 열 수 없어요. 크롬·엣지·웨일 최신 버전에서 열어 주세요');
    const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(s).text();
  } else text = new TextDecoder().decode(buf);
  let obj;
  try { obj = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { throw new Error('세계 파일이 아니에요 (내용을 읽을 수 없어요)'); }
  const list = obj && obj.educraftBundle ? obj.worlds : [obj];
  if (!Array.isArray(list) || !list.length) throw new Error('세계 파일이 아니에요');
  return list;
}
function checkWorldRec(rec) {
  if (!rec || typeof rec !== 'object' || !(typeof rec.seed === 'number')) throw new Error('세계 파일이 아니에요');
  if (rec.type !== 'flat') rec.type = 'normal';
  if (rec.mode !== 'creative') rec.mode = 'survival';
  if (!rec.mods || typeof rec.mods !== 'object') rec.mods = {};
  if (!Array.isArray(rec.be)) rec.be = [];
  rec.name = String(rec.name || '불러온 세계').slice(0, 40);
  return rec;
}
async function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safeFileName = (s) => String(s || 'world').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 40);

// ---------------- 게임: 저장 ----------------
{
  const G = Game.prototype;
  const _ser = G.serializeWorld;
  G.serializeWorld = function () {
    const r = _ser.call(this);
    r.fmt = SAVE_FMT; r.v = VERSION;
    let n = 0; const ow = r.mods || {}; for (const k in ow) n += (ow[k].length / 2) | 0;
    r.blocks = n;
    if (this._thumb) r.thumb = this._thumb;
    return r;
  };
  // 저장: 지금 모습을 바로 찍어 두고(나가는 중이어도 안전), 쓰기는 하나씩 차례로.
  //  실패하면 이유를 알려 주고, 가끔(5분·직접 저장·나갈 때) 백업을 남김
  G.saveWorld = async function (silent, why) {
    if (!this.world || this.world.remote || !this.worldId) return;
    let rec;
    try { rec = this.serializeWorld(); } catch (e) { console.error(e); this.ui.toast('⚠ 저장 준비 실패: ' + e.message, 5000); return; }
    const job = { rec, silent, why };
    if (this._saving) { this._pending = job; return; }   // 쓰는 중이면 가장 최근 것만 다음에
    this._saving = true;
    try {
      for (let j = job; j; j = this._pending, this._pending = null) await this.writeSave(j);
    } finally { this._saving = false; }
  };
  G.writeSave = async function ({ rec, silent, why }) {
    try {
      await DB.put(rec);
      this.flashSave();
      if (!silent) this.ui.toast(DB.volatile ? '⚠ 이 창에서는 잠깐만 저장돼요 (창을 닫으면 사라져요) — 세계 목록의 💾로 파일로 내보내 두세요' : '저장했습니다', DB.volatile ? 5000 : 2500);
      const now = Date.now();
      if (!DB.volatile && (!silent || why === 'quit' || now - (this._lastBackup || 0) > 300000)) {
        this._lastBackup = now;
        await DB.putBackup({ key: rec.id + '@' + now, wid: rec.id, time: now, name: rec.name, why: why === 'quit' ? '나갈 때' : why || (silent ? '자동' : '직접 저장'), rec });
        DB.trimBackups(rec.id).catch(() => { });
      }
      if (!this._persistAsked && navigator.storage && navigator.storage.persist) { this._persistAsked = true; navigator.storage.persist().catch(() => { }); }
    } catch (e) {
      console.error(e);
      const full = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
      this.ui.toast(full ? '⚠ 저장 공간이 꽉 찼어요! 메인 → 세계 고르기에서 안 쓰는 세계를 지우거나 💾 파일로 내보내 주세요' : '⚠ 저장 실패: ' + (e && e.message || e), 6000);
      if (full) DB.backups().then(list => Promise.all(list.slice(2).map(b => DB.delBackup(b.key)))).catch(() => { });
    }
  };
  G.flashSave = function () {
    const el = this._saveEl || (this._saveEl = (() => { const d = document.createElement('div'); d.id = 'save-ind'; d.textContent = '💾 저장됨'; document.getElementById('hud').appendChild(d); return d; })());
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  };
  // 나갈 때는 백업도
  G.quitToMenu = (function (_q) {
    return function () {
      if ((this.state === 'play' || this.state === 'loading') && this.world && !this.world.remote) { this._quitSave = true; this.saveWorld(true, 'quit'); }
      const r = _q.call(this);
      return r;
    };
  })(G.quitToMenu);
  // 원래 quitToMenu 안의 저장은 한 번만 (위에서 이미 저장)
  const _sw0 = G.saveWorld;
  G.saveWorld = function (silent, why) { if (this._quitSave && !why) { this._quitSave = false; return Promise.resolve(); } return _sw0.call(this, silent, why); };
  // 미리보기 그림: 그린 직후 캔버스를 작게 복사 (30초마다)
  const _render = G.render;
  G.render = function (dt) {
    _render.call(this, dt);
    const now = performance.now();
    if (this.state === 'play' && !this.ui.modal && now - (this._thumbT || 0) > 30000 && now - (this.playStart || 0) > 3000) {
      this._thumbT = now;
      try {
        const c = this._thumbCv || (this._thumbCv = Object.assign(document.createElement('canvas'), { width: 192, height: 108 }));
        const src = this.canvas, sw = src.width, sh = src.height, k = Math.min(sw / 16, sh / 9);
        c.getContext('2d').drawImage(src, (sw - k * 16) / 2, (sh - k * 9) / 2, k * 16, k * 9, 0, 0, 192, 108);
        const url = c.toDataURL('image/jpeg', 0.7);
        if (url.length > 2000) this._thumb = url;
      } catch (e) { }
    }
  };
  // 창을 닫거나 숨길 때도 저장 (휴대폰 사파리는 pagehide 만 옴)
  window.addEventListener('pagehide', () => { const g = window.game; if (g && g.state === 'play' && g.world && !g.world.remote) g.saveWorld(true); });
  const _sw = G.startWorld;
  G.startWorld = async function (opt) {
    this._thumb = opt && opt.rec && opt.rec.thumb || null; this._thumbT = performance.now() - 25000;
    this._lastBackup = Date.now();
    return _sw.call(this, opt);
  };
  // 참가자: 방장 세계 사본을 내 기기에 저장
  G.saveCopy = async function () {
    const p = this.player;
    try {
      const rec = this.serializeWorld();
      rec.id = 'w' + Date.now(); rec.name = String(this.worldName || '친구 세계').slice(0, 30) + ' (사본)';
      rec.created = Date.now(); rec.mode = p.creative ? 'creative' : (this.worldMode || 'survival');
      rec.player.spawn = [p.x, p.y, p.z];
      await DB.put(rec);
      this.ui.toast('💾 이 세계의 사본을 내 기기에 저장했어요! (세계 고르기에서 혼자 이어서 할 수 있어요)', 4000);
    } catch (e) { this.ui.toast('사본 저장 실패: ' + e.message, 4000); }
  };
}

// ---------------- 화면: 세계 고르기 ----------------
UI.prototype.importFiles = async function (files, pickMode) {
  let n = 0, err = null;
  for (const f of files) {
    try {
      for (const raw of await unpackFile(f)) {
        const rec = checkWorldRec(raw);
        rec.id = 'w' + Date.now() + (n ? '_' + n : '');
        if (!/\(불러옴\)$/.test(rec.name)) rec.name += ' (불러옴)';
        await DB.put(rec); n++;
      }
    } catch (e) { err = e; }
  }
  if (n) this.toast(`📂 세계 ${n}개를 불러왔어요`, 2500);
  if (err) this.toast('불러오기 실패: ' + err.message, 5000);
  this.showWorlds(pickMode);
};
UI.prototype.exportWorld = async function (id) {
  const rec = await DB.get(id); if (!rec) return;
  const { blob, ext } = await packFile(rec);
  downloadBlob(blob, safeFileName(rec.name) + ext);
  this.toast(`💾 「${rec.name}」을(를) 파일로 내보냈어요 (${fmtMB(blob.size)}) — 다른 브라우저·컴퓨터에서 「불러오기」로 열 수 있어요`, 4500);
};
UI.prototype.exportAll = async function () {
  const list = await DB.list(); if (!list.length) { this.toast('내보낼 세계가 없어요'); return; }
  const worlds = []; for (const w of list) worlds.push(await DB.get(w.id));
  const { blob, ext } = await packFile({ educraftBundle: 1, v: VERSION, time: Date.now(), worlds });
  downloadBlob(blob, '에듀크래프트_모든세계_' + new Date().toISOString().slice(0, 10) + ext);
  this.toast(`📦 세계 ${worlds.length}개를 파일 하나로 내보냈어요 (${fmtMB(blob.size)})`, 4000);
};
UI.prototype.showBackups = async function (w, pickMode) {
  const s = this.screen('menu-backups', `<div class="panel narrow"><h2>🕘 「${esc(w.name)}」 백업</h2>
    <p class="muted">5분마다·직접 저장할 때·나갈 때 자동으로 남겨요 (최근 ${BACKUP_KEEP}개). 실수로 부수거나 망가뜨렸을 때 되돌릴 수 있어요.</p>
    <div class="list" id="bk-list"><div class="muted">불러오는 중...</div></div>
    <div class="row"><span style="flex:1"></span><button class="btn" id="bk-back">← 뒤로</button></div></div>`, 'menu-bg');
  $('#bk-back', s).onclick = () => this.showWorlds(pickMode);
  this.show('menu-backups');
  const list = await DB.backups(w.id), L = $('#bk-list', s);
  L.innerHTML = list.length ? '' : '<div class="muted">아직 백업이 없어요. 조금 놀고 나면 생겨요.</div>';
  for (const b of list) {
    const c = document.createElement('div'); c.className = 'card';
    c.innerHTML = `${b.thumb ? `<img class="w-thumb" src="${b.thumb}" alt="">` : ''}<div class="grow"><div class="t">${new Date(b.time).toLocaleString('ko-KR')}</div><div class="s">${esc(b.why || '')}</div></div>`;
    c.appendChild(this.btn('↩ 이때로 되돌리기', 'primary small', async () => {
      if (!confirm('지금 세계를 이 백업으로 바꿀까요? (지금 상태도 백업으로 남겨 둬요)')) return;
      const cur = await DB.get(w.id), bk = await DB.getBackup(b.key);
      if (cur) await DB.putBackup({ key: w.id + '@' + Date.now(), wid: w.id, time: Date.now(), name: cur.name, why: '되돌리기 전', rec: cur });
      const rec = Object.assign({}, bk.rec, { id: w.id, played: Date.now() });
      await DB.put(rec); await DB.trimBackups(w.id);
      this.toast('↩ 백업으로 되돌렸어요'); this.showWorlds(pickMode);
    }));
    L.appendChild(c);
  }
};
UI.prototype.showWorlds = async function (pickMode) {
  const s = this.screen('menu-worlds', `
    <div class="panel" id="w-panel">
      <h2>${pickMode ? '함께 할 세계 고르기' : '세계 고르기'}</h2>
      <div id="w-warn"></div>
      <div class="list" id="w-list"><div class="muted">불러오는 중...</div></div>
      <div id="w-trash"></div>
      <div class="row">
        <button class="btn primary" id="w-new">＋ 새 세계 만들기</button>
        <button class="btn" id="w-import">📂 불러오기</button>
        <button class="btn" id="w-all">📦 모두 내보내기</button>
        <span style="flex:1"></span>
        <button class="btn" id="w-back">← 뒤로</button>
      </div>
      <p class="muted w-foot" id="w-foot">세계는 이 브라우저에만 저장돼요. 다른 브라우저(웨일↔엣지)나 다른 컴퓨터로 옮기려면 💾 파일로 내보낸 뒤 그곳에서 📂 불러오기 하세요. 파일을 이 창에 끌어다 놓아도 돼요.</p>
      <input type="file" id="w-file" accept=".educraft,.json,.opuscraft,.gz,application/json,application/gzip" multiple style="display:none">
    </div>`, 'menu-bg');
  $('#w-back', s).onclick = () => pickMode ? this.showMulti() : this.showMain();
  $('#w-new', s).onclick = () => this.showNewWorld(pickMode);
  $('#w-import', s).onclick = () => $('#w-file', s).click();
  $('#w-all', s).onclick = () => this.exportAll();
  $('#w-file', s).onchange = (e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) this.importFiles(f, pickMode); };
  // 끌어다 놓기
  const panel = $('#w-panel', s);
  panel.ondragover = (e) => { e.preventDefault(); panel.classList.add('drop'); };
  panel.ondragleave = () => panel.classList.remove('drop');
  panel.ondrop = (e) => { e.preventDefault(); panel.classList.remove('drop'); const f = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (f.length) this.importFiles(f, pickMode); };
  this.show('menu-worlds');
  let list = [];
  try { list = await DB.list(); } catch (e) { $('#w-list', s).innerHTML = '<div class="muted">저장소를 사용할 수 없어요.</div>'; return; }
  if (DB.volatile) $('#w-warn', s).innerHTML = '<div class="warn-box">⚠ 이 창(시크릿 모드 등)에서는 세계가 창을 닫으면 사라져요. 💾로 파일로 내보내 두세요.</div>';
  list.sort((a, b) => (b.played || 0) - (a.played || 0));
  const L = $('#w-list', s); L.innerHTML = '';
  if (!list.length) L.innerHTML = '<div class="muted">아직 세계가 없어요. 새 세계를 만들거나, 내보낸 파일을 불러와 보세요!</div>';
  const DIMK = { nether: ' · 🔥지옥에 있음', end: ' · 🌌엔드에 있음' };
  for (const w of list) {
    const c = document.createElement('div'); c.className = 'card';
    const d = w.played ? new Date(w.played).toLocaleString('ko-KR') : '';
    c.innerHTML = `${w.thumb ? `<img class="w-thumb" src="${w.thumb}" alt="">` : '<div class="w-thumb none">🌍</div>'}<div class="grow"><div class="t">${esc(w.name)}</div><div class="s">${w.mode === 'creative' ? '크리에이티브' : '서바이벌'} · ${w.type === 'flat' ? '평지' : '기본 지형'}${DIMK[w.dim] || ''}${w.blocks ? ` · 블록 ${w.blocks.toLocaleString()}칸 바꿈` : ''}<br>${d}</div></div>`;
    const play = this.btn(pickMode ? '열기' : '▶ 하기', 'primary small', async (e) => {
      e.stopPropagation(); const rec = await DB.get(w.id);
      if (!rec) { this.toast('세계를 읽지 못했어요'); return; }
      if (pickMode) pickMode(rec); else this.g.startWorld({ id: w.id, rec });
    });
    const ren = this.btn('✏', 'small', async (e) => {
      e.stopPropagation();
      const n = prompt('새 이름', w.name); if (!n || !n.trim()) return;
      const rec = await DB.get(w.id); rec.name = n.trim().slice(0, 40); await DB.put(rec); this.showWorlds(pickMode);
    }); ren.title = '이름 바꾸기';
    const bk = this.btn('🕘', 'small', (e) => { e.stopPropagation(); this.showBackups(w, pickMode); }); bk.title = '백업 · 되돌리기';
    const exp = this.btn('💾', 'small', (e) => { e.stopPropagation(); this.exportWorld(w.id); }); exp.title = '파일로 내보내기 (다른 브라우저·컴퓨터로 옮기기)';
    const del = this.btn('🗑', 'red small', async (e) => {
      e.stopPropagation();
      if (!confirm(`'${w.name}' 세계를 지울까요?\n(실수였다면 ${BACKUP_ORPHAN_DAYS}일 안에 「지운 세계 되살리기」로 되찾을 수 있어요)`)) return;
      const rec = await DB.get(w.id);
      if (rec && !DB.volatile) await DB.putBackup({ key: w.id + '@' + Date.now(), wid: w.id, time: Date.now(), name: rec.name, why: '지우기 직전', rec });
      await DB.del(w.id); this.showWorlds(pickMode);
    });
    c.append(play, ren, bk, exp, del);
    c.onclick = () => play.click();
    L.appendChild(c);
  }
  // 지운 세계 되살리기
  if (!DB.volatile) {
    DB.trimOrphans().catch(() => { });
    const ids = new Set(list.map(w => w.id)), orphans = new Map();
    for (const b of await DB.backups()) if (!ids.has(b.wid) && !orphans.has(b.wid)) orphans.set(b.wid, b);
    if (orphans.size) {
      const T = $('#w-trash', s);
      T.innerHTML = '<h3 class="muted" style="margin:10px 0 4px">🗑 최근에 지운 세계</h3>';
      for (const b of orphans.values()) {
        const c = document.createElement('div'); c.className = 'card trash';
        c.innerHTML = `<div class="grow"><div class="t">${esc(b.name)}</div><div class="s">${new Date(b.time).toLocaleString('ko-KR')}에 마지막 백업</div></div>`;
        c.appendChild(this.btn('↩ 되살리기', 'small', async () => { const bk = await DB.getBackup(b.key); await DB.put(Object.assign({}, bk.rec, { id: b.wid, played: Date.now() })); this.toast('↩ 세계를 되살렸어요'); this.showWorlds(pickMode); }));
        T.appendChild(c);
      }
    }
  }
  const si = await storageInfo();
  if (si && si.quota) $('#w-foot', s).insertAdjacentHTML('beforeend', `<br>저장 공간: ${fmtMB(si.used)} 사용 중 (여유 ${fmtMB(Math.max(0, si.quota - si.used))})`);
};
