'use strict';
// =====================================================================
// 에듀 크래프트 v1.8 — 🛠 문제 해결 (다른 파일이 고장 나도 돌아가게, 맨 앞에서 홀로 동작)
//  - 오류 기록: 마지막 20개를 localStorage educraft.errlog 에 (버전·시각·내용)
//  - 불러오기 감시: 세계 준비가 40초 넘게 멈추거나, 오류가 계속 나면 「문제 해결」 창을 띄움
//  - 🛟 안전 모드(?safe=1): 일꾼(워커) 끄고 가장 가벼운 화질로 — 그래픽·메모리가 약한 기기용
//  - ⏪ 이전 버전으로 열기: 사이트의 versions/ (versions/list.json), 같은 저장소를 씀
//  - 📋 오류 내용 복사(선생님께 보내기), 💾 지금 세계 파일로 내보내기, 설정만 초기화
// =====================================================================
const EC_SAFE = (() => {
  try { const q = new URLSearchParams(location.search); if (q.has('safe')) { const on = q.get('safe') !== '0'; localStorage.setItem('educraft.safe', on ? '1' : '0'); return on; } return localStorage.getItem('educraft.safe') === '1'; } catch (e) { return /[?&]safe=1/.test(location.search); }
})();
if (EC_SAFE && typeof window !== 'undefined') window.__noMeshWorker = true;
// 보관해 둔 이전 버전 (사이트의 versions/list.json 이 있으면 그것을 씀)
const EC_VERSIONS_FALLBACK = [{ v: 'v1.7', path: 'versions/v1.7/', date: '2026-10-06', note: '블록 코딩 3판·물약·바다와 동굴' }, { v: 'v1.4', path: 'versions/v1.4/', date: '2026-10-03', note: '도전 과제 2판·코딩 마스터 22단계 (지난 버전)' }];
const ecRescue = {
  errs: [], shown: false, loadT0: 0, loadErr: 0, playErr: [], ver: () => (typeof VERSION !== 'undefined' ? VERSION : '?'),
  load() { try { return JSON.parse(localStorage.getItem('educraft.errlog') || '[]') || []; } catch (e) { return []; } },
  log(kind, e) {
    const msg = String(e && (e.message || e.reason && e.reason.message || e.reason) || e || '').slice(0, 300);
    if (!msg || /ResizeObserver|Script error\.?$/.test(msg)) return;
    const stack = String(e && (e.stack || e.error && e.error.stack || e.reason && e.reason.stack) || '').split('\n').slice(0, 3).join(' | ').slice(0, 300);
    const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
    const it = { t: `${d.getMonth() + 1}/${d.getDate()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`, v: this.ver(), k: kind, m: msg, s: stack, n: 1 };
    // 같은 오류가 화면마다 되풀이되면 한 줄로 묶어 셈 (저장소에 너무 자주 쓰지 않게)
    const last = this.errs[this.errs.length - 1];
    if (last && last.m === msg) { last.n++; last.t = it.t; }
    else { this.errs.push(it); if (this.errs.length > 40) this.errs.shift(); }
    const now = Date.now();
    if (!last || last.m !== msg || now - (this._wT || 0) > 3000) {
      this._wT = now;
      try { const L = this.load(); const cur = this.errs[this.errs.length - 1]; if (L.length && L[L.length - 1].m === cur.m && L[L.length - 1].v === cur.v) L[L.length - 1] = cur; else L.push(cur); while (L.length > 20) L.shift(); localStorage.setItem('educraft.errlog', JSON.stringify(L)); } catch (er) { }
    }
    const g = typeof game !== 'undefined' ? game : null;
    if (g && g.state === 'loading') this.loadErr++;
    if (g && g.state === 'play') { const now = Date.now(); this.playErr.push(now); this.playErr = this.playErr.filter(x => now - x < 10000); if (this.playErr.length >= 15) this.show('play'); }
  },
  diag() {
    const g = typeof game !== 'undefined' ? game : null, L = [];
    L.push(`에듀 크래프트 ${this.ver()} · ${new Date().toLocaleString()}`);
    L.push('주소: ' + location.href.split('#')[0]);
    L.push('브라우저: ' + navigator.userAgent);
    L.push(`화면 ${screen.width}×${screen.height} · 배율 ${devicePixelRatio} · 메모리 ${navigator.deviceMemory || '?'}GB · 코어 ${navigator.hardwareConcurrency || '?'}`);
    try { const c = document.createElement('canvas'), gl = c.getContext('webgl2'); if (!gl) L.push('WebGL2: 없음 ⚠'); else { const ex = gl.getExtension('WEBGL_debug_renderer_info'); L.push('그래픽: ' + (ex ? gl.getParameter(ex.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))); } } catch (e) { L.push('WebGL2 확인 실패'); }
    if (g) {
      L.push(`상태: ${g.state}${g.worldName ? ' · 세계 「' + g.worldName + '」' : ''}${g.world ? ` · 차원 ${g.world.dim} · 판 ${g.world.gen}` : ''} · fps ${g.fps || '?'}`);
      if (g.settings) L.push(`설정: 화질 ${g.settings.quality} · 시야 ${g.settings.renderDist} · 해상도 ${g.settings.renderScale} · FPS ${g.settings.fpsCap || '-'}`);
      try { if (g.meshPool && g.meshPool.info) { const i = g.meshPool.info(); L.push(`일꾼: ${i.ok ? '켜짐' : '꺼짐'} ${i.reason || ''} · 오류 ${i.err || 0}`); } } catch (e) { }
    }
    L.push('안전 모드: ' + (EC_SAFE ? '켜짐' : '꺼짐'));
    const errs = this.load().slice(-8);
    L.push(`최근 오류 ${errs.length}개:`);
    for (const e of errs) L.push(`- [${e.t} ${e.v} ${e.k}${e.n > 1 ? ' ×' + e.n : ''}] ${e.m}${e.s ? '\n    ' + e.s : ''}`);
    return L.join('\n');
  },
  async versions() {
    try {
      const r = await fetch(new URL('versions/list.json', document.baseURI).href + '?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); const out = []; const add = (x) => { if (Array.isArray(x)) x.forEach(add); else if (x && Array.isArray(x.value)) x.value.forEach(add); else if (x && x.v) out.push(x); }; add(j); if (out.length) return out; }
    } catch (e) { }
    return /github\.io/.test(location.host) ? EC_VERSIONS_FALLBACK : [];
  },
  url(extra) { const u = new URL(location.href); u.searchParams.delete('safe'); u.searchParams.delete('r'); for (const k in extra) u.searchParams.set(k, extra[k]); return u.toString(); },
  // why: 'start'(켜지지 않음) · 'load'(세계 준비가 멈춤) · 'play'(오류가 계속) · 'menu'(직접 엶)
  async show(why, err) {
    if (this.shown && why !== 'menu') return;
    this.shown = true;
    const g = typeof game !== 'undefined' ? game : null;
    if (err) this.log(why, err);
    let box = document.getElementById('ec-rescue');
    if (box) box.remove();
    box = document.createElement('div'); box.id = 'ec-rescue';
    const head = { start: '😢 게임을 시작하지 못했어요', load: '⏳ 세계를 불러오는 데 문제가 생겼어요', play: '⚠ 게임에서 오류가 계속 나요', menu: '🛠 문제 해결' }[why] || '🛠 문제 해결';
    const sub = { start: '아래 순서대로 해 보세요. 그래도 안 되면 「이전 버전으로 열기」를 눌러요.', load: '조금 더 기다려도 되고, 아래 방법을 써 봐도 돼요. 세계는 지워지지 않아요.', play: '세계는 5분마다 저장돼요. 아래 방법을 써 봐요.', menu: '게임이 잘 안 될 때 써요. 세계(저장)는 지워지지 않아요.' }[why];
    const lastErr = err ? String(err.message || err).slice(0, 160) : (this.errs.length ? this.errs[this.errs.length - 1].m.slice(0, 160) : '');
    const hasWorld = !!(g && g.worldId && g.world && !g.world.remote);
    box.innerHTML = `<div class="ecr-panel" role="dialog" aria-modal="true">
      <h2>${head}</h2><p class="ecr-sub">${sub}</p>
      ${lastErr ? `<p class="ecr-err">오류: ${lastErr.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p>` : ''}
      <div class="ecr-btns">
        <button data-a="reload"><b>🔄 새로 불러오기</b><small>예전 파일이 섞였을 때 (Ctrl+F5 와 같아요)</small></button>
        <button data-a="safe"><b>${EC_SAFE ? '🛟 안전 모드 끄기' : '🛟 안전 모드로 열기'}</b><small>${EC_SAFE ? '보통 화질로 돌아가요' : '가장 가볍게 · 크롬북·오래된 노트북'}</small></button>
        ${hasWorld ? '<button data-a="export"><b>💾 이 세계 파일로 내보내기</b><small>다른 버전·컴퓨터에서 「불러오기」로 열 수 있어요</small></button>' : ''}
        <button data-a="copy"><b>📋 오류 내용 복사</b><small>선생님께 보여 드려요</small></button>
        ${why === 'menu' ? '<button data-a="reset"><b>⚙ 설정만 처음으로</b><small>화질·조작 설정을 지워요 (세계는 그대로)</small></button>' : ''}
        ${why === 'load' || why === 'play' ? '<button data-a="wait"><b>⏳ 계속 기다리기</b><small>창을 닫고 그대로 둬요</small></button>' : ''}
      </div>
      <h3>⏪ 이전 버전으로 열기</h3>
      <div class="ecr-vers"><small>찾는 중…</small></div>
      <p class="ecr-note">이전 버전도 같은 저장소를 써요. 새 버전에서 만든 세계를 이전 버전에서 열면 새 블록이 안 보일 수 있어서, 그럴 땐 <b>사본</b>으로 열어요.</p>
      <details><summary>자세한 정보 보기</summary><pre class="ecr-diag"></pre></details>
      <div class="ecr-foot"><span>지금 버전: <b>${this.ver()}</b>${EC_SAFE ? ' · 🛟 안전 모드' : ''}</span><button data-a="close">✕ 닫기</button></div>
    </div>`;
    document.body.appendChild(box);
    box.querySelector('.ecr-diag').textContent = this.diag();
    const act = async (a) => {
      if (a === 'reload') { try { sessionStorage.removeItem('educraft.freshReload'); } catch (e) { } this.saveNow(); location.replace(this.url({ r: Date.now().toString(36) })); }
      else if (a === 'safe') { this.saveNow(); location.replace(this.url({ safe: EC_SAFE ? '0' : '1', r: Date.now().toString(36) })); }
      else if (a === 'copy') { const t = this.diag(); try { await navigator.clipboard.writeText(t); this.note(box, '📋 복사했어요. 선생님께 붙여넣어 보여 드려요.'); } catch (e) { window.prompt('아래 글을 복사해 가세요 (Ctrl+C)', t); } }
      else if (a === 'export') { try { if (g.saveWorld) await g.saveWorld(true); await g.ui.exportWorld(g.worldId); this.note(box, '💾 파일을 내려받았어요 (다운로드 폴더)'); } catch (e) { this.note(box, '내보내기 실패: ' + e.message); } }
      else if (a === 'reset') { if (!confirm('화질·조작 설정을 처음으로 돌릴까요? (세계와 코드는 그대로예요)')) return; try { localStorage.removeItem('educraft.settings.v1'); localStorage.removeItem('educraft.control'); localStorage.removeItem('educraft.safe'); localStorage.removeItem('educraft.meshWorker'); } catch (e) { } location.replace(this.url({ r: Date.now().toString(36) })); }
      else if (a === 'wait' || a === 'close') { box.remove(); this.shown = false; if (a === 'wait') this.loadT0 = performance.now(); }
    };
    box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act(b.dataset.a));
    // 이전 버전 목록
    const vs = await this.versions(), here = this.ver(), vb = box.querySelector('.ecr-vers');
    const inOld = /\/versions\/v[\d.]+\//.test(location.pathname);
    const root = inOld ? new URL('../../', location.href) : new URL('./', location.href);
    let html = '';
    if (inOld) html += `<a class="ecr-v now" href="${root.href}"><b>⭐ 최신 버전으로 돌아가기</b><small>지금은 이전 버전 ${here} 이에요</small></a>`;
    for (const v of vs) if (v.v !== here) html += `<a class="ecr-v" href="${new URL(v.path, root).href}"><b>${v.v}</b><small>${v.date || ''} ${v.note || ''}</small></a>`;
    vb.innerHTML = html || '<small>보관된 이전 버전이 없어요 (사이트 주소에서 열면 보여요)</small>';
  },
  note(box, t) { let n = box.querySelector('.ecr-msg'); if (!n) { n = document.createElement('p'); n.className = 'ecr-msg'; box.querySelector('.ecr-btns').after(n); } n.textContent = t; },
  saveNow() { try { const g = game; if (g && g.state === 'play' && g.world && !g.world.remote) g.saveWorld(true); } catch (e) { } },
};
if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof importScripts === 'undefined') {   // 워커 안에서는 안 함
  // 게임 화면이 잡아서 console.error 로만 남기는 오류도 셈
  const _ce = console.error;
  console.error = function (...a) { const e = a.find(x => x instanceof Error); if (e) ecRescue.log('console', e); return _ce.apply(console, a); };
  window.addEventListener('error', (e) => ecRescue.log('error', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => ecRescue.log('promise', e.reason));
  // 그림 상자(CSS)는 여기 넣어 둠 — style.css 가 안 읽혀도 보이게
  const st = document.createElement('style');
  st.textContent = `#ec-rescue{position:fixed;inset:0;z-index:9999;background:rgba(40,30,80,.45);display:flex;align-items:center;justify-content:center;padding:10px;font-family:Pretendard,'Malgun Gothic',sans-serif}
#ec-rescue .ecr-panel{background:#fff;color:#0f1b3d;border-radius:20px;max-width:620px;width:100%;max-height:94vh;overflow:auto;padding:18px 20px;box-shadow:0 18px 50px rgba(20,20,60,.35)}
#ec-rescue h2{margin:0 0 4px;font-size:22px} #ec-rescue h3{margin:14px 0 6px;font-size:16px} #ec-rescue .ecr-sub{margin:0 0 8px;color:#55607e}
#ec-rescue .ecr-err{background:#fff0f2;border:1.5px solid #ffc2cb;color:#b0263c;border-radius:10px;padding:6px 10px;font-size:13px;word-break:break-all}
#ec-rescue .ecr-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#ec-rescue button,#ec-rescue .ecr-v{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;background:#f4f7ff;border:1.5px solid #c6d2ee;border-radius:14px;padding:9px 12px;cursor:pointer;font:inherit;color:inherit;text-decoration:none}
#ec-rescue button:hover,#ec-rescue .ecr-v:hover{background:#e8efff} #ec-rescue small{color:#66728f;font-size:12.5px}
#ec-rescue .ecr-vers{display:flex;flex-direction:column;gap:6px} #ec-rescue .ecr-v.now{background:#fff6d6;border-color:#f2d27a}
#ec-rescue .ecr-note{font-size:12.5px;color:#66728f;margin:8px 0} #ec-rescue .ecr-msg{color:#1f8a5b;font-weight:700}
#ec-rescue pre{white-space:pre-wrap;word-break:break-all;font-size:11.5px;background:#f6f7fb;border-radius:10px;padding:8px;max-height:220px;overflow:auto}
#ec-rescue .ecr-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px} #ec-rescue .ecr-foot button{flex-direction:row;padding:6px 14px}
@media(max-width:520px){#ec-rescue .ecr-btns{grid-template-columns:1fr}}
#ec-safe-badge{position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:60;background:#fff6d6;border:1.5px solid #f2d27a;color:#7a5a10;border-radius:999px;padding:3px 12px;font:600 13px Pretendard,'Malgun Gothic',sans-serif;cursor:pointer}`;
  (document.head || document.documentElement).appendChild(st);
  // 다른 파일이 다 읽힌 뒤(게임이 만들어지기 전): 감시 붙이기
  window.addEventListener('load', () => {
    if (typeof Game === 'undefined') return;
    const G = Game.prototype;
    // 안전 모드: 가장 가볍게 (설정 화면에서 바꾼 것보다 우선)
    if (EC_SAFE && G.applySettings) {
      const _as = G.applySettings;
      G.applySettings = function () {
        const s = this.settings;
        if (s && !this._ecSafeDone) { this._ecSafeDone = true; Object.assign(s, { quality: 0, renderDist: Math.min(s.renderDist || 3, 3), renderScale: Math.min(s.renderScale || 0.6, 0.6), clouds: false, fpsCap: 30 }); if ('fancyLeaves' in s) s.fancyLeaves = false; if ('dprCap' in s) s.dprCap = 1; }
        return _as.apply(this, arguments);
      };
      const b = document.createElement('div'); b.id = 'ec-safe-badge'; b.textContent = '🛟 안전 모드 · 끄려면 누르기'; b.title = '보통 화질로 돌아가요';
      b.onclick = () => location.replace(ecRescue.url({ safe: '0', r: Date.now().toString(36) }));
      document.body.appendChild(b);
    }
    // 세계 준비 감시
    if (G.startWorld) {
      const _sw = G.startWorld;
      G.startWorld = async function (opt) {
        ecRescue.loadT0 = performance.now(); ecRescue.loadErr = 0; ecRescue.shown = false;
        try { return await _sw.call(this, opt); }
        catch (e) { console.error(e); ecRescue.show('load', e); throw e; }
      };
    }
    setInterval(() => {
      const g = typeof game !== 'undefined' ? game : null;
      if (!g || g.state !== 'loading' || ecRescue.shown || !ecRescue.loadT0) return;
      const sec = (performance.now() - ecRescue.loadT0) / 1000;
      if (sec > 40 || (ecRescue.loadErr >= 3 && sec > 6)) ecRescue.show('load');
    }, 1000);
  });
}
