'use strict';
// =====================================================================
// UI: 메뉴 화면, HUD, 인벤토리/제작/화로/상자, 채팅, 도움말
// =====================================================================
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VERSION = 'v1.4';

// HUD용 픽셀 아이콘 (하트/배고픔/숨)
const HUD_ART = {
  heart: ['.XX...XX.', 'XRRX.XRRX', 'XRWRXRRRX', 'XRRRRRRRX', 'XRRRRRRRX', '.XRRRRRX.', '..XRRRX..', '...XRX...', '....X....'],
  food: ['......XX.', '.....XBBX', '....XBWBX', '...XMMBX.', '..XMMMMX.', '.XMWMMX..', 'XMMMMX...', 'XMMMX....', '.XXX.....'],
  air: ['..XXXXX..', '.XBBBBBX.', 'XBWWBBBBX', 'XBWBBBBBX', 'XBBBBBBBX', 'XBBBBBBBX', 'XBBBBBBBX', '.XBBBBBX.', '..XXXXX..'],
  armor: ['.XX...XX.', 'XAAX.XAAX', 'XAAAXAAAX', '.XAAAAAX.', '.XAWAAAX.', '.XAAAAAX.', '.XAAAAAX.', '.XXXXXXX.', '.........'],
};
function hudIcon(art, pal, half) {
  const c = document.createElement('canvas'); c.width = c.height = 9;
  const g = c.getContext('2d');
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    let col = pal[ch]; if (!col) return;
    if (half && x > 4 && ch !== 'X') col = pal.E;
    if (half === 'empty' && ch !== 'X') col = pal.E;
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }));
  return c.toDataURL();
}
const HUD_ICONS = {};
function buildHudIcons() {
  const hp = { X: '#8a2c4c', R: '#ff6f8f', W: '#fff', E: '#f6d6e0' };
  const fp = { X: '#7a4a2a', B: '#fff4e0', M: '#f09a5c', W: '#ffd0a8', E: '#f3e3d6' };
  const ap = { X: '#3d77a8', B: '#9fd8ff', W: '#fff', E: 'rgba(0,0,0,0)' };
  HUD_ICONS.h = [hudIcon(HUD_ART.heart, hp, 'empty'), hudIcon(HUD_ART.heart, hp, true), hudIcon(HUD_ART.heart, hp, false)];
  HUD_ICONS.f = [hudIcon(HUD_ART.food, fp, 'empty'), hudIcon(HUD_ART.food, fp, true), hudIcon(HUD_ART.food, fp, false)];
  HUD_ICONS.a = hudIcon(HUD_ART.air, ap, false);
  const arp = { X: '#5d6478', A: '#dfe6f2', W: '#fff', E: '#e4e0ec' };
  HUD_ICONS.ar = [hudIcon(HUD_ART.armor, arp, 'empty'), hudIcon(HUD_ART.armor, arp, true), hudIcon(HUD_ART.armor, arp, false)];
}

class UI {
  constructor(g) {
    buildHudIcons();
    this.g = g; this.modal = null; this.cursor = null; this.slots = []; this.chatOpen = false;
    this.screens = $('#screens');
    this.cursorEl = $('#cursor-item'); this.tip = $('#tooltip');
    this.hotbarEls = [];
    const hb = $('#hotbar');
    for (let i = 0; i < 9; i++) {
      const s = this.slotEl();
      let lpT = null;
      s.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (this.g.state !== 'play' || this.modal) return;
        this.g.selectSlot(i);
        if (e.pointerType === 'touch') lpT = setTimeout(() => { this.g.input.ev.drop = true; this.toast('아이템을 하나 버렸어요', 1000); }, 600);
      });
      s.addEventListener('pointerup', () => clearTimeout(lpT)); s.addEventListener('pointerleave', () => clearTimeout(lpT));
      hb.appendChild(s); this.hotbarEls.push(s);
    }
    this.stat = {};
    this.lastDebug = 0;
    document.addEventListener('pointermove', e => { this.mx = e.clientX; this.my = e.clientY; if (this.cursor) this.moveCursor(); if (this.tip.style.display === 'block') this.placeTip(); });
    const ci = $('#chat-input');
    ci.addEventListener('keydown', e => {
      // 한글 조합 중 Enter 는 글자 확정용 (웨일·엣지·크롬에서 마지막 글자가 두 번 가거나 남는 문제)
      if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }
      if (e.key === 'Enter') { const v = ci.value.trim(); ci.value = ''; this.closeChat(); if (v) this.submitChat(v); e.preventDefault(); }
      else if (e.key === 'Escape') { this.closeChat(); }
      e.stopPropagation();
    });
    window.addEventListener('resize', () => this.g.renderer && (this.g.renderer.fbW = 0));
  }
  // ---------------- 공통 ----------------
  screen(id, html, cls) {
    let s = document.getElementById(id);
    if (!s) { s = document.createElement('div'); s.id = id; this.screens.appendChild(s); }
    s.className = 'screen ' + (cls || '');
    s.innerHTML = html;
    return s;
  }
  show(id) { $$('.screen', this.screens).forEach(s => s.classList.toggle('show', s.id === id)); }
  hideAll() { $$('.screen', this.screens).forEach(s => s.classList.remove('show')); }
  toast(msg, ms) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), ms || 2500);
  }
  toastIf(local, msg) { if (local !== false) this.toast(msg); }
  btn(label, cls, fn) { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.innerHTML = label; b.onclick = fn; return b; }

  // ---------------- 아바타 ----------------
  openAvatar(back) {
    const g = this.g;
    if (g.state === 'play') { this.modal = 'avatar'; document.body.classList.add('modal'); g.input.releaseLock(); }
    g.avatarEd.open(() => {
      if (back) back();
      else if (g.state === 'play' && this.modal === 'avatar') this.closeModal();
    });
  }
  faceUrl(av) {
    if (!av) return '';
    ensureAvatarPixels(av);
    if (!av.pixels) return '';
    if (av._faceKey !== av.key) { av._face = skinFaceDataUrl(av.pixels, 32); av._faceKey = av.key; }
    return av._face;
  }
  fillFace(img) {
    if (!img) return;
    const av = this.g.avatar;
    const set = () => { const u = this.faceUrl(av); if (u) { img.src = u; img.style.display = ''; } else img.style.display = 'none'; };
    set();
    if (av && !av.pixels) setTimeout(set, 300);
  }
  // ---------------- 메인 메뉴 ----------------
  showMain() {
    document.body.classList.remove('playing', 'modal');
    this.modal = null;
    const s = this.screen('menu-main', `
      <div class="menu-box">
        <div class="eyebrow">EDU CRAFT · 블록 코딩 × 서바이벌</div>
        <h1 class="logo">에듀<br><em>크래프트</em></h1>
        <div class="logo-sub">나무를 베고 광석을 캐고, 빌더봇을 코딩해 집을 지어요.<br>지옥(네더)을 지나 엔드의 <b>엔더 드래곤</b>에 도전해 보세요!</div>
        <div class="topic-row">
          <button class="topic-card survive" data-quick="survival"><span class="ti">⛏</span><span class="tx"><span class="tc">바로 시작</span><b>서바이벌</b><span class="td">자원이 풍부한 세계에서 캐고 만들고 살아남아요. 코딩 블록은 재료를 얻으면 하나씩 열려요.</span></span></button>
          <button class="topic-card create" data-quick="creative"><span class="ti">✨</span><span class="tx"><span class="tc">바로 시작</span><b>크리에이티브</b><span class="td">모든 블록과 코딩 블록을 마음껏! 하늘을 날며 상상한 것을 지어요.</span></span></button>
        </div>
        <div class="btns" style="margin-top:16px">
        <button class="btn primary" id="m-single">🌍 혼자 하기 (세계 고르기)</button>
        <div class="row" style="justify-content:center;gap:8px;margin:0">
        <button class="btn blue small" id="m-multi">🤝 함께 하기</button>
        <button class="btn small av-btn" id="m-avatar"><img class="av-face" id="m-face" alt="">아바타</button>
        <button class="btn small" id="m-settings">⚙ 설정</button>
        <button class="btn small" id="m-help">📖 도움말</button>
        ${canOpenNewWindow() ? '<button class="btn small" id="m-newwin">↗ 새 창에서 크게 열기</button>' : ''}</div>
        </div>
      </div>
      <div class="ver">에듀 크래프트 ${VERSION} · CC0 오픈 코드 · 그림과 소리는 모두 코드로 만들었어요</div>`, 'menu-bg');
    $('#m-single', s).onclick = () => this.showWorlds();
    $$('.topic-card', s).forEach(btn => btn.onclick = async () => {
      const mode = btn.dataset.quick;
      const id = 'w' + Date.now();
      const rec = { id, name: (mode === 'creative' ? '크리에이티브 ' : '서바이벌 ') + new Date().toLocaleDateString('ko-KR'), seed: (Math.random() * 2147483647) | 0, type: 'normal', mode, created: Date.now(), played: Date.now(), rules: { peaceful: false } };
      try { await DB.put(rec); } catch (e) { }
      this.g.startWorld({ id, name: rec.name, seed: rec.seed, type: rec.type, mode, rules: rec.rules });
    });
    $('#m-multi', s).onclick = () => this.showMulti();
    if ($('#m-newwin', s)) $('#m-newwin', s).onclick = () => openInNewWindow();
    $('#m-avatar', s).onclick = () => this.openAvatar(() => this.showMain());
    this.fillFace($('#m-face', s));
    $('#m-settings', s).onclick = () => this.showSettings(() => this.showMain());
    $('#m-help', s).onclick = () => this.showHelp(() => this.showMain());
    this.show('menu-main');
  }
  decoHtml() {
    const cols = ['#ffb3c8', '#9fd3ff', '#8fe0b0', '#ffe28a', '#c9b4f2', '#ffc9a3'];
    let h = '';
    for (let i = 0; i < 14; i++) {
      const s = 26 + (i * 37) % 44, x = (i * 71) % 100, y = (i * 43 + 11) % 100;
      if (x > 28 && x < 72 && y > 12 && y < 88) continue;
      h += `<div class="deco" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;background:${cols[i % cols.length]};animation-delay:${(i % 5) * 0.7}s;transform:rotate(${(i * 23) % 40 - 20}deg)"></div>`;
    }
    return h;
  }
  async showWorlds(pickMode) {
    const s = this.screen('menu-worlds', `
      <div class="panel">
        <h2>${pickMode ? '함께 할 세계 고르기' : '세계 고르기'}</h2>
        <div class="list" id="w-list"><div class="muted">불러오는 중...</div></div>
        <div class="row">
          <button class="btn primary" id="w-new">＋ 새 세계 만들기</button>
          <button class="btn" id="w-import">📂 세계 파일 불러오기</button>
          <span style="flex:1"></span>
          <button class="btn" id="w-back">← 뒤로</button>
        </div>
        <input type="file" id="w-file" accept=".json,.opuscraft" style="display:none">
      </div>`, 'menu-bg');
    $('#w-back', s).onclick = () => pickMode ? this.showMulti() : this.showMain();
    $('#w-new', s).onclick = () => this.showNewWorld(pickMode);
    $('#w-import', s).onclick = () => $('#w-file', s).click();
    $('#w-file', s).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const rec = JSON.parse(await f.text());
        if (!rec.seed && rec.seed !== 0) throw new Error('세계 파일이 아닙니다');
        rec.id = 'w' + Date.now(); rec.name = (rec.name || '불러온 세계') + ' (불러옴)';
        await DB.put(rec); this.toast('세계를 불러왔습니다'); this.showWorlds(pickMode);
      } catch (err) { this.toast('불러오기 실패: ' + err.message); }
    };
    this.show('menu-worlds');
    let list = [];
    try { list = await DB.list(); } catch (e) { $('#w-list', s).innerHTML = '<div class="muted">저장소를 사용할 수 없습니다 (시크릿 모드?)</div>'; return; }
    list.sort((a, b) => (b.played || 0) - (a.played || 0));
    const L = $('#w-list', s); L.innerHTML = '';
    if (!list.length) L.innerHTML = '<div class="muted">아직 세계가 없어요. 새 세계를 만들어 보세요!</div>';
    for (const w of list) {
      const c = document.createElement('div'); c.className = 'card';
      const d = w.played ? new Date(w.played).toLocaleString('ko-KR') : '';
      c.innerHTML = `<div class="grow"><div class="t">${esc(w.name)}</div><div class="s">${w.mode === 'creative' ? '크리에이티브' : '서바이벌'} · ${w.type === 'flat' ? '평지' : '기본 지형'} · ${d}</div></div>`;
      const play = this.btn(pickMode ? '열기' : '▶ 하기', 'primary small', async (e) => { e.stopPropagation(); const rec = await DB.get(w.id); if (pickMode) pickMode(rec); else this.g.startWorld({ id: w.id, rec }); });
      const exp = this.btn('💾', 'small', async (e) => {
        e.stopPropagation(); const rec = await DB.get(w.id);
        const blob = new Blob([JSON.stringify(rec)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (w.name || 'world') + '.educraft.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
      exp.title = '파일로 내보내기';
      const del = this.btn('🗑', 'red small', async (e) => { e.stopPropagation(); if (confirm(`'${w.name}' 세계를 지울까요? 되돌릴 수 없어요.`)) { await DB.del(w.id); this.showWorlds(pickMode); } });
      c.append(play, exp, del);
      c.onclick = () => play.click();
      L.appendChild(c);
    }
  }
  showNewWorld(pickMode) {
    const st = { mode: 'survival', type: 'normal', peaceful: false };
    const s = this.screen('menu-new', `
      <div class="panel narrow">
        <h2>새 세계 만들기</h2>
        <div class="field"><label>세계 이름</label><input type="text" id="n-name" value="나의 세계 ${1 + Math.random() * 99 | 0}" maxlength="30"></div>
        <div class="field"><label>게임 모드</label><div class="seg" id="n-mode"><button class="btn small" data-v="survival">⛏ 서바이벌 (캐고 모으기·배고픔·체력)</button><button class="btn small" data-v="creative">✨ 크리에이티브 (무한 블록·날기)</button></div></div>
        <div class="field"><label>지형</label><div class="seg" id="n-type"><button class="btn small" data-v="normal">기본 지형</button><button class="btn small" data-v="flat">평지 (회로·건축용)</button></div></div>
        <label class="check"><input type="checkbox" id="n-peace"> 평화로움 (몬스터 없음)</label>
        <div class="field"><label>시드 (비워 두면 무작위)</label><input type="text" id="n-seed" placeholder="예: 1234 또는 우리반"></div>
        <div class="row"><button class="btn primary" id="n-go" style="flex:1">세계 만들기</button><button class="btn" id="n-back">취소</button></div>
      </div>`, 'menu-bg');
    const seg = (id, key) => { const el = $('#' + id, s); const upd = () => $$('button', el).forEach(b => b.classList.toggle('on', b.dataset.v === st[key])); $$('button', el).forEach(b => b.onclick = () => { st[key] = b.dataset.v; upd(); if (key === 'type' && st.type === 'flat') $('#n-peace', s).checked = true; }); upd(); };
    seg('n-mode', 'mode'); seg('n-type', 'type');
    $('#n-back', s).onclick = () => this.showWorlds(pickMode);
    $('#n-go', s).onclick = async () => {
      const name = $('#n-name', s).value.trim() || '나의 세계';
      const sv = $('#n-seed', s).value.trim();
      const seed = sv ? (/^-?\d+$/.test(sv) ? parseInt(sv) | 0 : strHash(sv) | 0) : (Math.random() * 2147483647) | 0;
      const id = 'w' + Date.now();
      const rules = { peaceful: $('#n-peace', s).checked };
      const opt = { id, name, seed, type: st.type, mode: st.mode, rules };
      const rec = { id, name, seed, type: st.type, mode: st.mode, created: Date.now(), played: Date.now(), rules };
      try { await DB.put(rec); } catch (e) { }
      if (pickMode) pickMode(rec); else this.g.startWorld(opt);
    };
    this.show('menu-new');
  }
  // ---------------- 멀티플레이 ----------------
  async showMulti() {
    const g = this.g;
    const s = this.screen('menu-multi', `
      <div class="panel">
        <h2>🤝 함께 하기 (같은 와이파이)</h2>
        <div class="row">
          <div class="field" style="flex:1;min-width:160px"><label>내 이름</label><input type="text" id="mp-name" maxlength="16" value="${esc(g.settings.name)}"></div>
          <div class="field"><label>내 아바타</label><button class="btn pink small av-btn" id="mp-avatar"><img class="av-face" id="mp-face" alt="">👗 꾸미기</button></div>
        </div>
        <div class="tabs" id="mp-tabs"><button data-t="join" class="on">방에 들어가기</button><button data-t="host">내 방 만들기</button><button data-t="how">방법 안내</button></div>
        <div id="mp-body"></div>
        <div class="row"><span style="flex:1"></span><button class="btn" id="mp-back">← 뒤로</button></div>
      </div>`, 'menu-bg');
    this.fillFace($('#mp-face', s));
    $('#mp-avatar', s).onclick = () => { g.net.stopListing(); this.openAvatar(() => this.showMulti()); };
    $('#mp-name', s).onchange = (e) => { g.settings.name = e.target.value.trim().slice(0, 16) || g.settings.name; g.saveSettings(); };
    $('#mp-back', s).onclick = () => { g.net.stopListing(); this.showMain(); };
    const body = $('#mp-body', s);
    const lan = await g.net.detectServer();
    const tab = (t) => {
      $$('#mp-tabs button', s).forEach(b => b.classList.toggle('on', b.dataset.t === t));
      g.net.stopListing();
      if (t === 'join') {
        body.innerHTML = `
          ${lan ? `<h3>이 와이파이의 방 목록 (LAN 서버)</h3><div class="list" id="mp-rooms"><div class="muted">찾는 중...</div></div>` : ''}
          <h3>방 코드로 들어가기</h3>
          <div class="row"><input type="text" id="mp-code" placeholder="방 코드 4자리" maxlength="8" style="flex:1;min-width:120px;font-size:22px;letter-spacing:4px;text-align:center;background:#10141d;color:#fff;border:2px solid #3a4254;padding:8px;border-radius:4px" inputmode="numeric">
          <button class="btn primary" id="mp-join">들어가기</button></div>
          <p class="muted">${lan ? 'LAN 서버 방은 위 목록에서 누르면 바로 들어갑니다. ' : ''}방 코드는 인터넷 연결 방식(P2P)으로 만든 방에 쓰입니다. 친구의 화면에 보이는 코드를 입력하세요.</p>`;
        $('#mp-join', s).onclick = () => { const code = $('#mp-code', s).value.trim(); if (code) g.net.joinPeer(code); };
        $('#mp-code', s).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) $('#mp-join', s).click(); });
        if (lan) g.net.listRooms(rooms => {
          const L = $('#mp-rooms', s); if (!L) return;
          L.innerHTML = rooms.length ? '' : '<div class="muted">아직 열린 방이 없어요. 친구가 방을 열면 여기 나타나요.</div>';
          for (const r of rooms) {
            const c = document.createElement('div'); c.className = 'card';
            c.innerHTML = `<div class="grow"><div class="t">${esc(r.name)}</div><div class="s">방장 ${esc(r.host)} · ${r.players}명 접속 중</div></div>`;
            c.appendChild(this.btn('들어가기', 'primary small', () => g.net.joinLan(r.id)));
            L.appendChild(c);
          }
        });
      } else if (t === 'host') {
        body.innerHTML = `
          <p>내 세계를 열어 친구들을 초대합니다. 방을 연 기기(주로 노트북)가 세계를 저장하고 회로·몹을 계산해요.</p>
          <div class="col">
            ${lan ? `<button class="btn primary" id="mp-host-lan">🏠 LAN 서버로 방 열기 (인터넷 없이 가능)</button>` : ''}
            <button class="btn blue" id="mp-host-p2p">📡 방 코드로 열기 (인터넷 연결 필요)</button>
          </div>
          <p class="muted">방을 연 뒤에는 게임 안에서 <kbd>Esc</kbd> 메뉴의 "멀티플레이 방 정보"로 주소와 코드를 다시 볼 수 있어요.</p>`;
        const pick = (mode) => this.showWorlds((rec) => { g.net.pendingHost = mode; g.startWorld({ id: rec.id, rec }); });
        if (lan) $('#mp-host-lan', s).onclick = () => pick('lan');
        $('#mp-host-p2p', s).onclick = () => pick('peer');
      } else {
        body.innerHTML = this.multiHowTo(lan);
      }
    };
    $$('#mp-tabs button', s).forEach(b => b.onclick = () => tab(b.dataset.t));
    tab('join');
    this.show('menu-multi');
  }
  multiHowTo(lan) {
    const info = this.g.net.serverInfo;
    return `<div class="help">
      <h3>방법 1. LAN 서버 (추천 · 인터넷 없이 됨)</h3>
      <p>① 선생님(또는 한 사람) 노트북에서 <b>「서버실행.bat」</b>을 더블클릭합니다. (파이썬 필요)<br>
      ② 창에 나오는 주소(예: <b>http://192.168.0.10:8080</b>)를 같은 와이파이의 다른 노트북·태블릿·휴대폰 브라우저에 입력합니다.<br>
      ③ 한 명이 「내 방 만들기 → LAN 서버로 방 열기」를 누르고, 나머지는 「방에 들어가기」 목록에서 방을 누르면 끝!</p>
      ${lan && info ? `<div class="code-box" style="font-size:18px;letter-spacing:1px">${(info.urls || []).map(esc).join('<br>')}</div>` : '<p class="muted">지금은 LAN 서버 없이 파일로 열려 있어요. LAN 서버로 열면 목록이 보입니다.</p>'}
      <h3>방법 2. 방 코드 (P2P)</h3>
      <p>인터넷이 되는 곳이라면 서버 없이도 됩니다. 방장이 「방 코드로 열기」를 누르면 4자리 코드가 나오고, 친구는 그 코드를 입력하면 같은 와이파이 안에서 직접 연결됩니다.</p>
      <h3>함께 할 때 알아두기</h3>
      <p>· 방장이 나가면 방이 닫혀요. 세계는 방장 기기에 저장됩니다.<br>· 떨어진 아이템은 각자에게 따로 보여요.<br>· 회로, 몹, 물 흐름은 방장이 계산해서 모두에게 똑같이 보여 줘요.</p>
    </div>`;
  }
  // ---------------- 설정 ----------------
  showSettings(back) {
    const g = this.g, st = g.settings;
    const s = this.screen('menu-settings', `
      <div class="panel">
        <h2>⚙ 설정</h2>
        <div class="field"><label>셰이더 품질</label><div class="seg" id="s-q">
          <button class="btn small" data-v="0">낮음 (그림자 없음)</button><button class="btn small" data-v="1">보통 (그림자)</button><button class="btn small" data-v="2">높음 (빛내림·블룸)</button><button class="btn small" data-v="3">최고 (고해상도 그림자·선명한 화면)</button></div></div>
        <label class="check"><input type="checkbox" id="s-auto"> 🐢 느려지면 화질 자동으로 낮추기 (학생 노트북 추천)</label>
        <div class="field"><label>시야 거리: <b id="s-rd-v"></b> 청크</label><input type="range" id="s-rd" min="2" max="14" step="1"></div>
        <div class="field"><label>화면 해상도 배율: <b id="s-rs-v"></b></label><input type="range" id="s-rs" min="0.4" max="1" step="0.05"></div>
        <div class="field"><label>시야각(FOV): <b id="s-fov-v"></b>°</label><input type="range" id="s-fov" min="55" max="110" step="1"></div>
        <div class="field"><label>밝기 (어두운 동굴·밤): <b id="s-br-v"></b></label><input type="range" id="s-br" min="0" max="1" step="0.05"></div>
        <div class="field"><label>마우스 시점 방식 (게임 중 V 키로도 바꿔요)</label><div class="seg" id="s-look"><button class="btn small" data-v="auto">자동</button><button class="btn small" data-v="lock">🔒 화면 고정</button><button class="btn small" data-v="follow">🖱 따라보기</button><button class="btn small" data-v="drag">✋ 끌어서 보기</button></div>
          <div class="muted" style="margin-top:4px">화면 고정: 클릭하면 마우스가 사라지고 움직이는 대로 시야가 돌아요(Esc로 풀기). 따라보기: 고정 없이 마우스만 움직여도 돌고, 화면 끝에 가면 계속 돌아요. 구글 사이트처럼 고정이 막힌 곳에서는 자동으로 따라보기가 돼요.</div></div>
        <div class="field"><label>시점 감도: <b id="s-sens-v"></b></label><input type="range" id="s-sens" min="0.2" max="3" step="0.05"></div>
        <div class="field"><label>소리 크기: <b id="s-vol-v"></b></label><input type="range" id="s-vol" min="0" max="1" step="0.05"></div>
        <div class="field"><label>터치 버튼 크기: <b id="s-ts-v"></b></label><input type="range" id="s-ts" min="0.7" max="1.5" step="0.05"></div>
        <div class="field"><label>조작 방식 (바꾸면 새로고침돼요)</label><div class="seg" id="s-ctl"><button class="btn small" data-v="auto">자동</button><button class="btn small" data-v="mouse">키보드·마우스</button><button class="btn small" data-v="touch">터치</button></div></div>
        <label class="check"><input type="checkbox" id="s-clouds"> 구름</label>
        <label class="check"><input type="checkbox" id="s-leaves"> 화려한 나뭇잎</label>
        <label class="check"><input type="checkbox" id="s-bob"> 걸을 때 화면 흔들림</label>
        <label class="check"><input type="checkbox" id="s-aj"> 자동 점프 (모바일)</label>
        <label class="check"><input type="checkbox" id="s-rs2"> 회로 정보 표시 (바라보는 회로 블록의 전력)</label>
        <h3 style="margin:10px 0 2px">편의 기능</h3>
        <label class="check"><input type="checkbox" id="s-tree"> 🪓 나무 한 번에 베기 (도끼로 밑동을 베면 위까지, Shift 누르면 한 칸)</label>
        <label class="check"><input type="checkbox" id="s-vein"> ⛏ 광맥 한 번에 캐기 (이어진 광석을 한꺼번에)</label>
        <label class="check"><input type="checkbox" id="s-refill"> 🔁 다 쓰면 가방의 같은 아이템으로 자동 채우기</label>
        <label class="check"><input type="checkbox" id="s-map"> 🗺 미니맵과 좌표 보기</label>
        <div class="row"><span style="flex:1"></span><button class="btn primary" id="s-done">완료</button></div>
      </div>`, this.g.state === 'play' ? '' : 'menu-bg');
    const segQ = $('#s-q', s);
    const updQ = () => $$('button', segQ).forEach(b => b.classList.toggle('on', +b.dataset.v === st.quality));
    $$('button', segQ).forEach(b => b.onclick = () => { st.quality = +b.dataset.v; updQ(); g.applySettings(); });
    updQ();
    const rng = (id, key, fmt) => { const el = $('#' + id, s), v = $('#' + id + '-v', s); el.value = st[key]; v.textContent = fmt ? fmt(st[key]) : st[key]; el.oninput = () => { st[key] = parseFloat(el.value); v.textContent = fmt ? fmt(st[key]) : st[key]; if (key === 'renderDist') g._order = null; g.applySettings(); }; };
    rng('s-rd', 'renderDist'); rng('s-rs', 'renderScale', v => Math.round(v * 100) + '%'); rng('s-fov', 'fov'); rng('s-br', 'brightness', v => Math.round(v * 100) + '%'); rng('s-sens', 'sens', v => v.toFixed(2)); rng('s-vol', 'volume', v => Math.round(v * 100) + '%'); rng('s-ts', 'touchSize', v => Math.round(v * 100) + '%');
    const chk = (id, key, fn) => { const el = $('#' + id, s); el.checked = st[key] !== false; el.onchange = () => { st[key] = el.checked; g.applySettings(); fn && fn(); }; };
    chk('s-clouds', 'clouds'); chk('s-leaves', 'fancyLeaves', () => { if (g.world) for (const c of g.world.chunks.values()) c.dirty = true; }); chk('s-bob', 'viewBob'); chk('s-aj', 'autoJump'); chk('s-rs2', 'showRs');
    chk('s-auto', 'autoQuality'); chk('s-tree', 'treeFell'); chk('s-vein', 'veinMine'); chk('s-refill', 'autoRefill'); chk('s-map', 'minimap');
    const lk = $('#s-look', s), updLk = () => $$('button', lk).forEach(b => b.classList.toggle('on', b.dataset.v === (st.lookMode || 'auto')));
    $$('button', lk).forEach(b => b.onclick = () => { st.lookMode = b.dataset.v; g.saveSettings && g.saveSettings(); g.input.setLookPref(st.lookMode); updLk(); });
    updLk();
    const ctl = $('#s-ctl', s); let cur = 'auto'; try { cur = localStorage.getItem('educraft.control') || 'auto'; } catch (e) { }
    $$('button', ctl).forEach(b => { b.classList.toggle('on', b.dataset.v === cur); b.onclick = () => {
      if (b.dataset.v === cur) return;
      if (!confirm('조작 방식을 바꾸려면 새로고침해야 해요. 지금 세계는 저장돼요. 계속할까요?')) return;
      try { if (b.dataset.v === 'auto') localStorage.removeItem('educraft.control'); else localStorage.setItem('educraft.control', b.dataset.v); } catch (e) { }
      const go = () => location.reload();
      if (g.state === 'play' && g.world && !g.world.remote) g.saveWorld(true).then(go); else go();
    }; });
    $('#s-done', s).onclick = () => back();
    this.show('menu-settings');
  }
  // ---------------- 도움말 ----------------
  showHelp(back, tab) {
    const s = this.screen('menu-help', `
      <div class="panel help" style="max-width:860px">
        <h2>📖 도움말</h2>
        <div class="tabs" id="h-tabs"><button data-t="keys">조작법</button><button data-t="rs">⚡ 레드스톤</button><button data-t="ex">회로 예제</button><button data-t="code">🤖 블록 코딩</button><button data-t="survive">서바이벌</button><button data-t="vanilla">✨ 마을·마법·낚시</button><button data-t="nature">🐴 동물·점프맵</button><button data-t="dims">🔥 지옥과 엔드</button></div>
        <div id="h-body"></div>
        <div class="row"><span style="flex:1"></span><button class="btn primary" id="h-back">닫기</button></div>
      </div>`, this.g.state === 'play' ? '' : 'menu-bg');
    const body = $('#h-body', s);
    const icon = (name) => { const id = I(name); const n = ICON.idx[id]; return `<i class="rsi ic" style="background-position:${(n % ICON.cols) / (ICON.cols - 1) * 100}% ${Math.floor(n / ICON.cols) / (Math.max(2, Math.ceil(ICON.h / ICON.size)) - 1) * 100}%"></i>`; };
    const T = {
      nature: `<h3>🌍 새 생물군계 (v1.3 이후 새로 만든 세계)</h3><p>정글(큰 나무·대나무·수박) · 사바나(아카시아) · 늪(수련잎·진흙) · 벚꽃 숲(분홍 나무·벌집) · 메사(줄무늬 테라코타 고원). 옛 세계는 지은 건물이 어긋나지 않게 지형을 그대로 둬요.</p>
        <h3>🐴 동물과 아이템</h3><table>
        <tr><td>말·기린·낙타</td><td>먹이(사과·밀·당근·황금 당근 / 아카시아 잎 / 선인장)로 길들이고 <b>안장</b>(가죽 3 + 철 1)을 얹으면 타요. W 달리기 · Space 점프 · Shift 내리기</td></tr>
        <tr><td>🦄 유니콘</td><td>벚꽃 숲에 드물게. 황금 당근·황금 사과로 길들이면 아주 빠르고 <b>공중에서 한 번 더 점프</b>! 가위로 빗으면 <b>무지개 갈기</b> → 무지개 블록</td></tr>
        <tr><td>🔥 불사조</td><td>메사·사막 하늘을 날아요. 가끔 <b>불사조 깃털</b>을 떨어뜨려요 → 깃털 4 + 금 주괴 = <b>불사조 토템</b>(쓰러질 때 한 번 되살아남)</td></tr>
        <tr><td>☁ 구름 양</td><td>산에 살아요. 가위로 깎으면 <b>구름 블록</b>(떨어져도 안 다침) → 구름 4개로 <b>구름 부츠</b></td></tr>
        <tr><td>🐉 아기 용</td><td>산·벚꽃 숲에 드물게. 황금 사과로 친구가 되면 따라다니며 몬스터에게 불꽃을 뿜어요</td></tr>
        <tr><td>🐝 벌·벌집</td><td>꿀이 꽉 차면(5/5) 빈 병(유리 3)으로 <b>꿀병</b>, 가위로 <b>밀랍</b>. 꿀병 4 = 꿀 블록, 밀랍 + 실 = 양초, 판자 + 밀랍 = 벌통</td></tr>
        <tr><td>🐢 거북</td><td>해변에서 가끔 <b>껍데기 조각</b> → 5개로 <b>거북 투구</b>(물속에서 숨이 안 줄어요)</td></tr>
        <tr><td>🐼 판다 · 🐸 개구리</td><td>판다는 대나무를 좋아하고 재채기로 <b>슬라임 볼</b>을! 늪의 개구리도 슬라임 볼 → 점프 발판 재료</td></tr>
        <tr><td>🐻‍❄️ 북극곰 · 🐧 펭귄 · 🦜 앵무새</td><td>북극곰은 건드리면 화내요(물고기). 펭귄에게 물고기를 주면 깃털 선물. 앵무새는 씨앗으로 친구가 돼요</td></tr></table>
        <h3>🏃 점프맵</h3><table>
        <tr><td>출발·도착 발판</td><td>출발을 밟으면 ⏱ 시작, 도착에서 기록 (코스마다 1~5등, <code>/parkour</code>)</td></tr>
        <tr><td>체크포인트 · 되돌림 블록</td><td>떨어지거나 보라 블록에 닿으면 마지막 체크포인트로 (다치지 않아요)</td></tr>
        <tr><td>점프·대시 발판</td><td>높이 뛰기 / 바라보는 쪽으로 쌩!</td></tr>
        <tr><td>부서지는 발판 · 깜빡이 A/B</td><td>밟으면 잠시 뒤 사라짐 / 2초마다 A와 B가 번갈아 나타남</td></tr>
        <tr><td>빌더봇 「점프맵 만들기」</td><td>발판 수와 난이도(1~4)만 정하면 코스를 지어 줘요. 예제 「🏃 점프맵 코스」</td></tr></table>`,
      vanilla: `<h3>✨ 원작 마인크래프트 요소</h3><table>
        <tr><td>경험치</td><td>광석을 캐고, 몹을 물리치고, 화로에서 구우면 초록 구슬이 나와요. 단축바 위 초록 막대가 차면 레벨이 올라요.</td></tr>
        <tr><td>마법 부여대</td><td>책 + 다이아몬드 2 + 흑요석 4. 도구·갑옷·낚싯대를 넣고 청금석과 레벨을 써서 효율·날카로움·보호·내구성·바다의 행운을 걸어요.</td></tr>
        <tr><td>마을</td><td>평원·사막·자작나무 숲에 마을이 있어요 (<code>/locate village</code>). 주민을 우클릭하면 에메랄드로 거래해요. 철 골렘이 마을을 지켜요.</td></tr>
        <tr><td>늑대</td><td>숲·눈밭의 늑대에게 뼈를 주면 길들여져요. 우클릭으로 앉기/따라오기, 고기를 주면 회복. 저장해도 남아요.</td></tr>
        <tr><td>낚시</td><td>막대기 3 + 실 2로 낚싯대. 물에 던지고 찌가 쏙 들어가면 다시 우클릭! 물고기·보물·경험치.</td></tr>
        <tr><td>방패</td><td>판자 + 철 주괴. 들고 오른쪽 버튼을 누르고 있으면 공격·화살을 막아요.</td></tr>
        <tr><td>나침반·시계</td><td>들고 있으면 집 방향 / 지금 시각을 보여 줘요.</td></tr>
        <tr><td>농사·음식</td><td>당근·감자(마을 밭), 호박·잭오랜턴, 수박, 버섯 스튜, 구운 감자, 호박 파이, 황금 당근, 건초 더미.</td></tr>
        <tr><td>도전 과제</td><td>나무 베기부터 드래곤까지 27개 (<kbd>L</kbd> 키). 깰 때마다 경험치!</td></tr></table>`,
      keys: `<h3>노트북 (키보드 + 마우스)</h3><table>
        <tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></td><td>이동 (W 두 번 빠르게 = 달리기, <kbd>Ctrl</kbd>도 달리기)</td></tr>
        <tr><td><kbd>Space</kbd></td><td>점프 · 크리에이티브에서 두 번 빠르게 누르면 날기 / 날 때 위로</td></tr>
        <tr><td><kbd>Shift</kbd></td><td>웅크리기 (가장자리에서 안 떨어짐) · 날 때 아래로 · 수레에서 내리기</td></tr>
        <tr><td>마우스 움직이기</td><td>시야 돌리기 — 🔒 화면 고정(처음 클릭하면 마우스가 고정돼요, <kbd>Esc</kbd>로 풀기) · 🖱 따라보기(고정 없이 움직이기만, 화면 끝에서 계속 회전) · ✋ 끌어서 보기</td></tr>
        <tr><td><kbd>V</kbd></td><td>마우스 시점 방식 바꾸기 (고정이 안 되는 곳에서는 자동으로 따라보기)</td></tr>
        <tr><td><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd></td><td>방향키로 시야 돌리기 (터치패드가 불편할 때)</td></tr>
        <tr><td>마우스 왼쪽</td><td>블록 부수기(누르고 있기) · 공격</td></tr>
        <tr><td>마우스 오른쪽</td><td>블록 놓기 · 레버/버튼/문 사용 · 먹기 · 활 쏘기</td></tr>
        <tr><td>마우스 가운데</td><td>바라보는 블록 집기</td></tr>
        <tr><td><kbd>1</kbd>~<kbd>9</kbd> / 휠</td><td>단축바 선택</td></tr>
        <tr><td><kbd>E</kbd></td><td>인벤토리 (크리에이티브: 모든 블록)</td></tr>
        <tr><td><kbd>B</kbd></td><td>🤖 블록 코딩 창 (빌더봇)</td></tr>
        <tr><td><kbd>Q</kbd></td><td>아이템 버리기 (<kbd>Ctrl</kbd>+<kbd>Q</kbd> 한 묶음)</td></tr>
        <tr><td><kbd>T</kbd> / <kbd>/</kbd></td><td>채팅 / 명령어 (<code>/help</code>)</td></tr>
        <tr><td><kbd>F</kbd></td><td>회로 정보 표시 켜기/끄기</td></tr>
        <tr><td><kbd>F1</kbd> <kbd>F3</kbd> <kbd>F5</kbd></td><td>화면 정보 숨기기 · 디버그 정보 · 3인칭 시점</td></tr>
        <tr><td><kbd>Esc</kbd> / <kbd>P</kbd> / ☰</td><td>일시정지 메뉴 (멀티로 열기·친구 방 들어가기·저장·설정)</td></tr>
        <tr><td><kbd>L</kbd></td><td>🏆 도전 과제</td></tr></table>
        <h3>휴대폰 · 태블릿 (터치)</h3><table>
        <tr><td>왼쪽 아래 끌기</td><td>이동 (끝까지 밀면 달리기)</td></tr>
        <tr><td>화면 끌기</td><td>둘러보기</td></tr>
        <tr><td>화면 짧게 톡</td><td>블록 놓기 / 사용</td></tr>
        <tr><td>화면 길게 누르기</td><td>블록 부수기</td></tr>
        <tr><td>⛏ / ✋ 버튼</td><td>부수기(누르고 있기) / 놓기·사용</td></tr>
        <tr><td>⤒ / ⇩</td><td>점프(두 번 = 날기) / 웅크리기 켜고 끄기</td></tr>
        <tr><td>위쪽 버튼</td><td>Ⅱ 메뉴 · 🎒 인벤토리 · 🤖 블록 코딩 · 💬 채팅 · 👁 시점</td></tr></table>
        <p class="muted">인벤토리에서 톡 = 집기/놓기, 길게 누르기 = 반만 집기(또는 하나씩 놓기)</p>`,
      rs: `<p>레드스톤은 게임 속 <b>신호 전기</b>예요. 전원(스위치)에서 나온 신호가 <b>레드스톤 가루(전선)</b>를 따라 흐르고, 한 칸 갈 때마다 세기가 1씩 줄어 <b>15칸</b>까지 갑니다. 바라보면 화면 가운데 아래에 전력 세기가 보여요.</p>
        <h3>전원 (신호를 만드는 것)</h3><table>
        <tr><td>${icon('lever')}레버</td><td>켜고 끄는 스위치. 누를 때마다 바뀜</td></tr>
        <tr><td>${icon('stone_button')}버튼</td><td>잠깐(돌 1초, 나무 1.5초) 켜졌다 꺼짐</td></tr>
        <tr><td>${icon('stone_pressure_plate')}압력판</td><td>밟고 있으면 켜짐 (나무 압력판은 아이템도 감지)</td></tr>
        <tr><td>${icon('redstone_torch')}레드스톤 횃불</td><td>항상 켜져 있지만, 붙어 있는 블록에 전기가 들어오면 <b>꺼짐</b> → 신호 뒤집기(NOT)</td></tr>
        <tr><td>${icon('redstone_block')}레드스톤 블록</td><td>늘 켜져 있는 전원 블록 (피스톤으로 옮길 수 있음)</td></tr>
        <tr><td>${icon('daylight_sensor')}햇빛 감지기</td><td>낮의 햇빛 세기만큼 신호. 우클릭하면 밤 감지 모드</td></tr>
        <tr><td>${icon('observer')}관측기</td><td>얼굴 앞 블록이 바뀌면 뒤쪽(빨간 점)으로 짧은 신호</td></tr>
        <tr><td>${icon('clock_block')}클럭 블록</td><td>(교육용) 일정한 간격으로 깜빡이는 신호. 우클릭=주기, 웅크리고 우클릭=멈춤</td></tr>
        <tr><td>${icon('player_sensor')}플레이어 감지기</td><td>(교육용) 5칸 안에 사람이나 동물이 오면 켜짐 → 자동문에 딱!</td></tr>
        <tr><td>${icon('target')}과녁</td><td>화살이 맞으면 켜짐</td></tr>
        <tr><td>${icon('detector_rail')}감지 레일</td><td>광산 수레가 지나가면 켜짐</td></tr></table>
        <h3>전선과 부품 (신호를 전달·가공)</h3><table>
        <tr><td>${icon('redstone')}레드스톤 가루</td><td>바닥에 뿌리면 전선. 켜지면 밝은 빨강. 계단처럼 한 칸 오르내릴 수 있음</td></tr>
        <tr><td>${icon('repeater')}중계기</td><td>신호를 다시 15로 키우고, 한 방향으로만 보냄. 우클릭으로 지연 1~4틱. 옆에서 다른 중계기가 들어오면 잠김</td></tr>
        <tr><td>${icon('comparator')}비교기</td><td>뒤 신호 ≥ 옆 신호면 뒤 신호를 그대로 출력. 우클릭하면 빼기 모드(뒤−옆). 상자 뒤에 두면 얼마나 찼는지 알려 줌</td></tr>
        <tr><td>${icon('gate_and')}AND 게이트</td><td>(교육용) 왼쪽(A) <b>그리고</b> 오른쪽(B)이 모두 켜져야 앞으로 출력</td></tr>
        <tr><td>${icon('gate_or')}OR 게이트</td><td>(교육용) A <b>또는</b> B 하나라도 켜지면 출력</td></tr>
        <tr><td>${icon('gate_xor')}XOR 게이트</td><td>(교육용) A와 B가 <b>서로 다를 때만</b> 출력</td></tr>
        <tr><td>${icon('gate_not')}NOT 게이트</td><td>(교육용) 뒤 입력을 반대로 뒤집어 출력</td></tr></table>
        <h3>전기로 움직이는 도구</h3><table>
        <tr><td>${icon('redstone_lamp')}레드스톤 램프</td><td>신호가 들어오면 환하게 켜짐</td></tr>
        <tr><td>${icon('color_lamp')}색깔 램프</td><td>(교육용) 신호 세기(1~15)에 따라 빨강→보라로 색이 바뀜</td></tr>
        <tr><td>${icon('number_display')}숫자 표시기</td><td>(교육용) 들어온 신호 세기를 숫자로 보여 줌</td></tr>
        <tr><td>${icon('piston')}피스톤</td><td>블록을 최대 12개까지 밀어냄. 끈끈이 피스톤은 다시 당겨옴</td></tr>
        <tr><td>${icon('iron_door')}철 문·다락문</td><td>전기로만 열리는 문 (나무 문은 손으로도)</td></tr>
        <tr><td>${icon('note_block')}소리 블록 / ${icon('speaker')}스피커</td><td>신호가 들어오면 소리. 우클릭으로 음 높이 변경. 아래 블록에 따라 악기가 바뀜</td></tr>
        <tr><td>${icon('dispenser')}발사기 / ${icon('dropper')}공급기</td><td>안에 든 아이템을 쏘거나(화살, 물, TNT) 떨어뜨림. 공급기는 앞 상자로 옮김</td></tr>
        <tr><td>${icon('tnt')}TNT</td><td>신호를 받으면 4초 뒤 폭발</td></tr>
        <tr><td>${icon('powered_rail')}전동 레일</td><td>전기가 들어오면 수레를 빠르게, 꺼지면 멈춤</td></tr>
        <tr><td>${icon('fan')}전기 선풍기</td><td>(교육용) 켜지면 앞쪽 8칸 안의 플레이어·몹·아이템을 날려 보냄</td></tr>
        <tr><td>${icon('conveyor')}컨베이어 벨트</td><td>(교육용) 전기가 들어오면 위에 올라간 것을 화살표 방향으로 옮김</td></tr>
        <tr><td>${icon('hopper')}깔때기</td><td>위의 상자·아이템을 빨아들여 주둥이 쪽으로 옮김. 전기를 받으면 멈춤. 비교기로 얼마나 찼는지 알 수 있음</td></tr>
        <tr><td>${icon('elevator')}전기 엘리베이터</td><td>(교육용) 신호가 오면 위에 선 개체를 높이 띄움. 위아래로 같은 블록을 두면 점프/웅크리기로 층 이동</td></tr></table>
        <h3>도움 도구</h3><table>
        <tr><td>${icon('multimeter')}멀티미터</td><td>들고 우클릭하면 그 블록의 전력 정보를 채팅에 적어 줌</td></tr>
        <tr><td>${icon('wrench')}렌치</td><td>회로 블록을 우클릭하면 방향을 돌림</td></tr></table>
        <h3>강한 전력 vs 약한 전력</h3>
        <p>레버·버튼·중계기가 <b>블록에 직접</b> 전기를 넣으면 그 블록은 <b>강하게</b> 충전되어 옆의 전선까지 켭니다. 전선이 블록을 가리키기만 하면 <b>약하게</b> 충전되어 램프 같은 부품은 켜지만 다른 전선은 못 켜요.</p>`,
      ex: `<p>🤖 <b>블록 코딩</b> 창(<kbd>B</kbd>)의 「예제」에서 아래 회로를 빌더봇이 직접 지어 줘요!</p>
        <h3>1. 기본 램프 회로</h3><p>레버 — 전선 — 램프. 레버를 켜면 램프가 켜져요. 전선을 16칸 넘게 늘이면? 중계기를 넣어 보세요.</p>
        <h3>2. 깜빡이 (클럭)</h3><p>레드스톤 횃불과 중계기로 고리를 만들면 스스로 깜빡여요. 교육용 클럭 블록을 쓰면 더 쉬워요.</p>
        <h3>3. 자동문</h3><p>압력판(또는 플레이어 감지기) → 철 문. 다가가면 문이 열리고 지나가면 닫혀요.</p>
        <h3>4. 논리 게이트 체험장</h3><p>레버 2개(A, B) → AND/OR/XOR 게이트 → 램프. 표로 정리해 보세요: A와 B가 켜짐/꺼짐일 때 램프는?</p>
        <h3>5. 피스톤 문</h3><p>끈끈이 피스톤 2개가 벽을 열고 닫아요.</p>
        <h3>6. 신호 세기 실험</h3><p>레버에서 시작한 전선 옆에 숫자 표시기와 색깔 램프를 한 칸씩 두면, 거리마다 세기가 1씩 줄어드는 걸 볼 수 있어요.</p>`,
      code: `<p><b>빌더봇</b>은 내가 만든 블록 코드대로 움직이며 건물을 지어 주는 로봇이에요. <kbd>B</kbd> 키, 🤖 버튼, 또는 <b>빌더봇 리모컨</b>을 우클릭하면 코딩 창이 열립니다.</p>
        <table>
        <tr><td>① 블록 끌어오기</td><td>왼쪽 목록에서 블록을 끌어 오른쪽 작업판에 놓아요. (톡 누르면 맨 아래에 붙어요)</td></tr>
        <tr><td>② 값 바꾸기</td><td>숫자 칸에는 <code>5</code>, <code>i*2</code>, <code>반복+1</code> 같은 식도 쓸 수 있어요.</td></tr>
        <tr><td>③ 실행</td><td>▶ 실행을 누르면 빌더봇이 내 앞에 나타나 코드를 따라 움직여요. 속도 조절 가능!</td></tr>
        <tr><td>④ 되돌리기</td><td>↶ 되돌리기를 누르면 마지막 실행으로 지은 것이 사라져요.</td></tr>
        <tr><td>👁 미리보기</td><td>짓기 전에 생길 자리를 파란 테두리로 보여 주고, 서바이벌이면 <b>필요한 재료</b>를 계산해 줘요. 「▶ 이대로 짓기」로 바로 지어요.</td></tr>
        <tr><td>👣 한 단계씩</td><td>블록 하나씩 멈추며 실행해요. 오른쪽 창의 「다음 ▶」을 누를 때마다 한 걸음! (실행 중 ⏸ 로도 멈출 수 있어요)</td></tr>
        <tr><td>🎓 코딩 마스터</td><td>차례대로 → 반복 → 변수 → 조건 → 함수 → 마스터, 6장 22단계. 빌더봇이 실제로 지은 모양을 검사하고, 모자란 점을 알려 줘요. 장을 깨면 빌더봇 색이 바뀌어요.</td></tr></table>
        <h3>새 블록 (v1.1)</h3><table>
        <tr><td>만약 ~이면 / 아니면</td><td>앞·아래·위에 블록이 있는지, 물인지, 낮·밤, 동전 던지기, 또는 <code>i % 2 == 0</code> 같은 식으로 갈라져요.</td></tr>
        <tr><td>~이(가) 될 때까지 반복 · 계속 반복</td><td>조건이 맞을 때까지 / 멈출 때까지 되풀이해요. 「코드 멈추기」로 끝낼 수 있어요.</td></tr>
        <tr><td>함수 만들기 · 실행하기</td><td>자주 쓰는 블록 묶음에 이름을 붙이고 여러 번 불러요 (나만의 블록).</td></tr>
        <tr><td>무작위 수 · 식</td><td><code>random(1, 6)</code>, <code>무작위(0, 15)</code>, 비교 <code>&lt; &gt; == !=</code>, <code>and / or / not</code>, 목록 <code>[14,1,4][i]</code>, <code>높이</code>·<code>놓은수</code> 변수.</td></tr>
        <tr><td>원 · 선 · 복사/붙여넣기 · 바라보기 · 부르기</td><td>평평한 원, 비스듬한 선, 지은 것을 도장처럼 찍기, 북·남·동·서 보기, 빌더봇을 내 앞으로.</td></tr></table>
        <h3>🔓 서바이벌에서 코딩 블록 열기</h3><p>서바이벌에서는 처음에 <b>앞으로·뒤로·돌기·블록 고르기·놓기·말하기</b>만 쓸 수 있어요. 다른 코딩 블록은 정해진 <b>재료를 처음 얻으면</b> 하나씩 열려요. 잠긴 블록에는 🔒와 필요한 재료가 적혀 있어요.</p>
        <table>
        <tr><td>판자</td><td>왼쪽·오른쪽으로 이동</td></tr><tr><td>석탄(숯)</td><td>반복하기</td></tr><tr><td>제작대</td><td>뒤로 돌기 · 처음 자리로</td></tr>
        <tr><td>막대기 / 사다리</td><td>방향 정해 놓기 / 위·아래로 이동</td></tr><tr><td>곡괭이 / 삽</td><td>블록 부수기 / 공간 비우기</td></tr>
        <tr><td>횃불 · 조약돌 · 모래</td><td>지나가며 놓기 · 벽 쌓기 · 바닥 깔기</td></tr><tr><td>상자 · 계단 · 나무 문</td><td>상자 · 계단 · 집 짓기</td></tr>
        <tr><td>유리 · 화로 · 사암 · 석재 벽돌</td><td>구 · 원기둥 · 피라미드 · 탑</td></tr><tr><td>양털 · 빵 · 책 · 침대 · 철 주괴</td><td>색 고르기 · 기다리기 · 변수 · 좌표 이동 · 변수 반복</td></tr>
        <tr><td>레드스톤 · 레드스톤 횃불 · 중계기</td><td>전선 깔기 · 회로 부품 놓기 · 회로 예제</td></tr></table>
        <p>서바이벌의 빌더봇은 <b>내 가방의 블록</b>을 꺼내 쓰고, 치운 블록은 가방에 넣어 줘요. 재료가 떨어지면 멈추니 넉넉히 모아 두세요. (크리에이티브는 전부 열려 있고 블록도 무한!)</p>
        <h3>블록 종류</h3><p><b>이동</b>: 앞/뒤/위/아래로, 돌기 · <b>건축</b>: 블록 고르기, 놓기, 부수기, 지나가며 놓기(펜) · <b>도형</b>: 벽, 바닥, 상자, 구, 원기둥, 피라미드, 집, 탑 · <b>반복</b>: 반복하기, 변수 반복(i를 1부터 n까지) · <b>전기 회로</b>: 레버/전선/램프 놓기, 회로 예제</p>`,
      dims: `<h3>🔥 지옥(네더)에 가려면</h3><p>① <b>흑요석</b>으로 가로 4 × 세로 5 틀(안쪽 2 × 3)을 세워요. 흑요석은 다이아몬드 곡괭이로 캐거나, 용암 원천에 물을 부어 만들어요. 처음 자리 근처의 <b>무너진 지옥문</b> 상자에도 흑요석과 부싯돌이 들어 있어요!<br>
        ② <b>부싯돌과 부시</b>(철 주괴 + 부싯돌)로 틀 안쪽을 오른쪽 클릭 → 보라색 지옥문이 열려요.<br>③ 문 안에 <b>3초</b> 서 있으면 지옥으로! 지옥에서 1칸 = 평소 세계 8칸이에요.</p>
        <h3>지옥에서 조심할 것</h3><table>
        <tr><td>좀비 피글린</td><td>먼저 때리지 않으면 공격하지 않아요. 한 마리를 때리면 무리가 모두 화내요!</td></tr>
        <tr><td>가스트</td><td>하늘을 떠다니며 폭발하는 화염구를 쏴요. 가스트의 눈물이 나와요.</td></tr>
        <tr><td>블레이즈</td><td>네더 벽돌로 지은 <b>지옥 요새</b>에 살아요. 불덩이 3발을 쏴요. 물리치면 <b>블레이즈 막대</b>!</td></tr>
        <tr><td>불 · 마그마 · 용암</td><td>밟으면 뜨거워요. 마그마 블록은 웅크리면(Shift) 괜찮아요. 지옥에서는 물이 바로 증발해요.</td></tr></table>
        <h3>🌌 엔드에 가려면</h3><p>① 밤에 나타나는 <b>엔더맨</b>을 물리쳐 <b>엔더 진주</b>를 모아요. (먼저 때리지 않으면 얌전해요)<br>
        ② 블레이즈 막대 → <b>블레이즈 가루</b> 2개. 엔더 진주 + 블레이즈 가루 = <b>엔더의 눈</b>.<br>
        ③ 엔더의 눈을 오른쪽 클릭으로 던지면 <b>엔드 요새</b> 쪽으로 날아가요(채팅에 방향과 거리). 바로 아래를 가리키면 그 아래 땅속에 요새가 있어요. 이끼 낀 돌기둥과 사다리 통로를 찾아보세요!<br>
        ④ 요새 방의 <b>엔드 차원문 틀 12개</b>에 엔더의 눈을 모두 끼우면 차원문이 열려요. 뛰어들면 엔드로!</p>
        <h3>🐉 엔더 드래곤</h3><p>흑요석 기둥 위의 <b>엔드 수정</b>이 드래곤을 치료해요. 활로 수정부터 부수세요(가까이서 부수면 폭발해요). 드래곤이 가운데 기둥에 내려앉으면 칼로 공격할 기회! 물리치면 출구 차원문과 <b>드래곤 알</b>이 생겨요. 엔드에서 떨어지면 끝없는 허공이니 블록과 음식을 꼭 챙겨요.</p>
        <h3>선생님용 명령어</h3><p><code>/dimension nether</code> · <code>/dimension end</code> · <code>/dimension overworld</code> 차원 이동, <code>/locate</code> 엔드 요새 좌표, <code>/summon blaze</code> 몹 불러오기. 함께 하기(멀티) 중에는 차원 이동이 막혀 있어요.</p>`,
      survive: `<h3>처음 시작했다면</h3><p>🎁 바로 옆의 <b>보너스 상자</b>를 열어 보세요! ① 나무 밑동을 캐서(왼쪽 누르고 있기) 원목을 모아요 → ② <kbd>E</kbd>에서 원목 1개로 판자 4개, <b>판자 4개(2×2)로 제작대</b>를 만들어요 → ③ 제작대를 놓고 우클릭 → 나무 곡괭이로 돌을 캐고 돌 도구를 만들어요 → ④ 밤이 오기 전에 집을 짓고 횃불을 켜요!</p>
        <h3>📖 제작법 도감</h3><p>인벤토리 오른쪽 도감에서 아이템을 누르면 <b>재료를 놓는 모양</b>과 필요한 재료, 제작대가 필요한지 보여요. 「🔨 만들기」를 누르면 바로 만들어지고, 「🔎 쓰임새」는 그 재료로 만들 수 있는 것을 찾아 줘요.</p>
        <h3>광석과 도구 단계</h3><p>나무 곡괭이 → 석탄·돌 / 돌 곡괭이 → 철·구리·청금석 / 철 곡괭이 → 금·다이아몬드·레드스톤·에메랄드(산). 철·금·구리 광석은 <b>원석</b>이 나오니 화로에서 녹여 주괴로 만들어요. 아주 깊은 곳(높이 8~11 아래)은 단단한 <b>심층암</b>이에요.</p>
        <h3>갑옷</h3><p>가죽(소)·철·금·다이아몬드로 투구·흉갑·레깅스·부츠를 만들어요. 우클릭하거나 인벤토리 왼쪽 칸에 넣으면 입어요. 몬스터·화살·폭발 피해를 줄여 줘요 (떨어짐·굶주림은 못 막아요).</p>
        <h3>편의 기능 (모드처럼)</h3><p>🪓 나무 밑동만 베면(맨손도 OK) 위까지 한 번에 · ⛏ 이어진 광석을 한 번에 캐기 · 🍃 나무를 베면 잎이 금방 떨어짐 · 🌾 다 자란 밀을 우클릭하면 수확하고 다시 심기 · 🔁 다 쓴 블록·도구는 가방에서 자동으로 채우기 · 🧹 가방 정리 · 🗺 미니맵(눌러서 크게) · 📍 쓰러진 곳 좌표 알림. <b>Shift</b>를 누른 채 부수면 한 칸만 부서져요. 설정에서 끄고 켤 수 있어요.</p>
        <h3>그 밖에</h3><p>뼛가루(뼈 1 → 3개)를 묘목·밀·잔디에 우클릭하면 쑥쑥 자라요. 가위(철 2)로 양털을 깎고 나뭇잎을 모아요. 자갈에서 부싯돌, 소에게서 가죽이 나와요. 황금 사과는 체력을 크게 회복해요.</p>
        <h3>레드스톤 구하기</h3><p>깊은 땅속(높이 24 아래)의 빨간 <b>레드스톤 광석</b>을 철 곡괭이로 캐면 레드스톤 가루가 4~5개 나와요. 철은 화로에서 철 광석을 녹여 만들어요.</p>
        <h3>명령어 (/help)</h3><p><code>/gamemode c</code> 크리에이티브, <code>/time set day</code> 낮, <code>/give redstone 64</code>, <code>/peaceful on</code> 몬스터 끄기, <code>/fill</code> 채우기 등</p>`,
    };
    const tabF = (t) => { $$('#h-tabs button', s).forEach(b => b.classList.toggle('on', b.dataset.t === t)); body.innerHTML = T[t]; };
    $$('#h-tabs button', s).forEach(b => b.onclick = () => tabF(b.dataset.t));
    tabF(tab || 'keys');
    $('#h-back', s).onclick = () => back();
    this.show('menu-help');
  }
  // ---------------- 로딩/게임 진입 ----------------
  showLoading(text) {
    document.body.classList.remove('playing');
    const s = this.screen('loading', `<div class="panel narrow"><h2>${esc(text)}</h2><div class="progress"><div id="ld-bar"></div></div><p class="muted" id="ld-tip"></p></div>`, 'menu-bg');
    const tips = ['흑요석 틀에 부싯돌로 불을 붙이면 지옥문이 열려요', '엔더의 눈을 던지면 엔드 요새 쪽으로 날아가요', '좀비 피글린은 먼저 때리지 않으면 얌전해요', '서바이벌에서는 재료를 처음 얻을 때마다 코딩 블록이 하나씩 열려요', '나무는 밑동만 베면 한 번에 쓰러져요', '레드스톤 신호는 15칸까지 가요. 더 멀리 보내려면 중계기!', '빌더봇에게 코드로 집을 지어 달라고 해 보세요 (B 키)', '레드스톤 횃불은 신호를 뒤집는 NOT 게이트예요', '밤에는 몬스터가 나와요. 횃불로 주변을 밝히세요', '색깔 램프는 신호 세기를 색으로 보여 줘요', '관측기는 블록의 변화를 감지해요', '크리에이티브에서 스페이스를 두 번 누르면 날 수 있어요'];
    $('#ld-tip', s).textContent = '💡 ' + tips[Math.random() * tips.length | 0];
    this.show('loading');
  }
  setLoading(p) { const b = $('#ld-bar'); if (b) b.style.width = p + '%'; }
  hideLoading() { const s = $('#loading'); if (s) s.classList.remove('show'); }
  enterGame() {
    this.cursor = null; this.renderCursor();
    this.refreshHotbar(); this.refreshStats();
    $('#chat-log').innerHTML = '';
  }
  onPlayStart() {
    document.body.classList.add('playing');
    this.applyHudVisibility();
    const g = this.g;
    this.chatLine(g.input.touch ? `「${g.worldName}」에 오신 것을 환영합니다! Ⅱ → 도움말, 🤖 버튼으로 블록 코딩` : `「${g.worldName}」에 오신 것을 환영합니다! 도움말은 Esc → 도움말, 블록 코딩은 B 키`, '#ffe27a');
    if (g.net.pendingHost) { const m = g.net.pendingHost; g.net.pendingHost = null; g.net.host(m); }
    if (!g.player.creative) { this.chatLine('⛏ 서바이벌: 블록을 누르고 있으면 부서져요. 배고픔(🍗)이 줄면 음식을 먹고(오른쪽 누르고 있기), 밤에는 몬스터를 조심하세요!', '#fff'); this.chatLine('🌳 먼저 나무를 캐고 E(🎒) → 📖 제작법 도감에서 판자와 제작대를 만들어 보세요!', '#bfffc8'); }
  }
  toggleRsOverlay() { const st = this.g.settings; st.showRs = !st.showRs; this.g.saveSettings(); this.toast(st.showRs ? '⚡ 회로 정보 표시 켜짐' : '회로 정보 표시 꺼짐', 1200); }
  applyHudVisibility() { document.body.classList.toggle('hidehud', !!this.g.settings.hideHud); }
  // ---------------- 일시정지 ----------------
  openPause() {
    const g = this.g;
    if (this.modal) this.closeModal(true);
    this.modal = 'pause'; document.body.classList.add('modal');
    g.input.releaseLock();
    const net = g.net;
    const s = this.screen('menu-pause', `
      <div class="panel narrow">
        <h2>일시정지</h2>
        <div class="col">
          <button class="btn primary" id="p-resume">▶ 계속하기</button>
          <button class="btn blue" id="p-look">시점 방식: ${LOOK_NAMES[g.input.lookMode]}</button>
          ${canOpenNewWindow() ? '<button class="btn" id="p-newwin">↗ 새 창에서 열기 (화면 고정 가능)</button>' : ''}
          ${!g.world.remote ? `<button class="btn blue" id="p-host">${net.isHost ? '📡 멀티플레이 방 정보' : '🤝 이 세계를 멀티로 열기 (친구 초대)'}</button>` : ''}
          <button class="btn blue" id="p-join">${g.world.remote ? '🌍 방 나가서 혼자 하기' : '🔗 다른 친구 방에 들어가기'}</button>
          <button class="btn" id="p-adv">🏆 도전 과제</button>
          <button class="btn pink av-btn" id="p-avatar"><img class="av-face" id="p-face" alt="">👗 아바타 꾸미기</button>
          <button class="btn" id="p-mode">${g.player.creative ? '🛠 서바이벌로 바꾸기' : '✨ 크리에이티브로 바꾸기'}</button>
          <button class="btn" id="p-set">⚙ 설정</button>
          <button class="btn" id="p-help">📖 도움말</button>
          ${!g.world.remote ? `<button class="btn" id="p-save">💾 저장</button>` : `<button class="btn" id="p-copy">💾 이 세계 사본을 내 기기에 저장</button>`}
          <button class="btn red" id="p-quit">${g.world.remote ? '방 나가기' : '저장하고 메인으로'}</button>
        </div>
      </div>`);
    $('#p-resume', s).onclick = () => this.closeModal();
    if ($('#p-newwin', s)) $('#p-newwin', s).onclick = () => { g.saveWorld(true); openInNewWindow(); };
    const pl = $('#p-look', s); if (pl) pl.onclick = () => { g.input.cycleLookMode(); pl.textContent = '시점 방식: ' + LOOK_NAMES[g.input.lookMode]; };
    this.fillFace($('#p-face', s));
    $('#p-avatar', s).onclick = () => { this.hideAll(); this.openAvatar(); };
    if ($('#p-host', s)) $('#p-host', s).onclick = () => this.showHostInfo();
    $('#p-join', s).onclick = () => { this.modal = null; document.body.classList.remove('modal'); const remote = g.world.remote; g.quitToMenu(); if (remote) this.showWorlds(); else this.showMulti(); };
    $('#p-adv', s).onclick = () => { if (this.showAdvancements) this.showAdvancements(() => { this.modal = null; this.openPause(); }); };
    $('#p-mode', s).onclick = () => { g.command(g.player.creative ? '/gamemode s' : '/gamemode c'); this.closeModal(); };
    $('#p-set', s).onclick = () => { this.showSettings(() => { this.modal = null; this.openPause(); }); this.modal = 'settings'; };
    $('#p-help', s).onclick = () => { this.showHelp(() => { this.modal = null; this.openPause(); }); this.modal = 'settings'; };
    if ($('#p-save', s)) $('#p-save', s).onclick = () => g.saveWorld();
    if ($('#p-copy', s)) $('#p-copy', s).onclick = () => g.saveCopy && g.saveCopy();
    $('#p-quit', s).onclick = () => { this.modal = null; document.body.classList.remove('modal'); g.quitToMenu(); };
    this.show('menu-pause');
  }
  async showHostInfo() {
    const g = this.g, net = g.net;
    this.modal = 'settings';
    const lan = await net.detectServer();
    const s = this.screen('menu-host', `
      <div class="panel narrow">
        <h2>📡 친구 초대하기</h2>
        <div id="hi-body"></div>
        <div class="row"><span style="flex:1"></span><button class="btn primary" id="hi-back">돌아가기</button></div>
      </div>`);
    const body = $('#hi-body', s);
    const render = () => {
      if (net.isHost) {
        body.innerHTML = `<p>방이 열려 있어요! 지금 <b>${net.peerCount() + 1}명</b>이 함께 하고 있어요.</p>
          ${net.mode === 'peer' ? `<p>친구에게 이 <b>방 코드</b>를 알려 주세요:</p><div class="code-box">${esc(net.roomCode)}</div>` : ''}
          ${net.mode === 'lan' ? `<p>친구 기기의 브라우저에서 아래 주소를 열고 「방에 들어가기」를 누르게 하세요:</p><div class="code-box" style="font-size:17px;letter-spacing:1px">${(net.serverInfo && net.serverInfo.urls || [location.origin]).map(esc).join('<br>')}</div>` : ''}
          <p class="muted">방을 닫으려면 메인으로 나가면 됩니다.</p>`;
      } else {
        body.innerHTML = `<p>이 세계에 친구를 초대합니다.</p><div class="col">
          ${lan ? `<button class="btn primary" id="hi-lan">🏠 LAN 서버로 열기 (인터넷 없이)</button>` : `<p class="muted">LAN 서버 없이 열려 있어요. 「서버실행.bat」으로 열면 인터넷 없이도 함께 할 수 있어요.</p>`}
          <button class="btn blue" id="hi-peer">📡 방 코드로 열기 (인터넷 필요)</button></div>`;
        if (lan) $('#hi-lan', s).onclick = async () => { await net.host('lan'); setTimeout(render, 600); };
        $('#hi-peer', s).onclick = async () => { await net.host('peer'); setTimeout(render, 1500); };
      }
    };
    render();
    $('#hi-back', s).onclick = () => { this.modal = null; this.openPause(); };
    this.show('menu-host');
  }
  showDeath(msg) {
    this.modal = 'death'; document.body.classList.add('modal');
    const s = this.screen('menu-death', `
      <div class="panel narrow" style="text-align:center;border-color:#5a0e0e;background:rgba(60,8,8,0.9)">
        <h2 style="color:#ff6b5a;font-size:30px">쓰러졌어요!</h2>
        <p>${esc(msg)}</p>
        <div class="col"><button class="btn primary" id="d-re">다시 태어나기</button><button class="btn" id="d-q">메인으로</button></div>
      </div>`);
    s.style.background = 'rgba(120,0,0,0.35)';
    $('#d-re', s).onclick = () => { this.modal = null; document.body.classList.remove('modal'); s.classList.remove('show'); this.g.respawn(); };
    $('#d-q', s).onclick = () => { this.modal = null; this.g.respawn(); this.g.quitToMenu(); };
    this.show('menu-death');
  }
  hideDeath() { const s = $('#menu-death'); if (s) s.classList.remove('show'); }

  // ---------------- HUD ----------------
  slotEl() {
    const s = document.createElement('div'); s.className = 'slot';
    s.innerHTML = '<i></i><b></b><u><s></s></u>';
    return s;
  }
  drawSlot(el, it) {
    const i = el.firstChild, b = el.children[1], u = el.children[2];
    if (!it) { i.classList.remove('ic'); b.textContent = ''; u.style.display = 'none'; el._id = 0; return; }
    if (el._id !== it.id) { applyIcon(i, it.id); el._id = it.id; }
    b.textContent = it.n > 1 ? it.n : '';
    const d = ITEMS[it.id];
    if (d && d.dur && it.d) { u.style.display = 'block'; const f = 1 - it.d / d.dur; u.firstChild.style.width = (f * 100) + '%'; u.firstChild.style.background = `hsl(${f * 120},90%,50%)`; }
    else u.style.display = 'none';
  }
  refreshHotbar() {
    const p = this.g.player; if (!p) return;
    for (let i = 0; i < 9; i++) { this.drawSlot(this.hotbarEls[i], p.inv[i]); this.hotbarEls[i].classList.toggle('sel', i === p.sel); }
    if (this.modal === 'inv' || this.modal === 'container' || this.modal === 'craft') this.refreshSlots();
  }
  showHeldName() {
    const p = this.g.player, el = $('#held-name');
    const it = p.held;
    el.textContent = it ? itemName(it.id) : '';
    el.classList.add('show');
    clearTimeout(this._hnT); this._hnT = setTimeout(() => el.classList.remove('show'), 1600);
  }
  refreshStats() {
    const p = this.g.player; if (!p) return;
    const st = $('#stats');
    st.style.display = p.creative ? 'none' : '';
    const hearts = $('#hearts'), food = $('#food'), air = $('#air');
    const ico = (url) => `<i class="ico" style="background-image:url(${url})"></i>`;
    let h = '';
    for (let i = 0; i < 10; i++) { const v = p.health - i * 2; h += ico(HUD_ICONS.h[v >= 2 ? 2 : v >= 1 ? 1 : 0]); }
    hearts.innerHTML = h;
    let f = '';
    for (let i = 0; i < 10; i++) { const v = p.food - i * 2; f += ico(HUD_ICONS.f[v >= 2 ? 2 : v >= 1 ? 1 : 0]); }
    food.innerHTML = f;
    const apt = p.armorPoints ? p.armorPoints() : 0; let ar = '';
    if (apt > 0) for (let i = 0; i < 10; i++) { const v = apt - i * 2; ar += ico(HUD_ICONS.ar[v >= 2 ? 2 : v >= 1 ? 1 : 0]); }
    $('#armor').innerHTML = ar;
    if (p.air < 300) { const n = Math.ceil(p.air / 30); let a = ''; for (let i = 0; i < 10; i++) a += i < n ? ico(HUD_ICONS.a) : '<i class="ico"></i>'; air.innerHTML = a; } else air.innerHTML = '';
    st.classList.toggle('shake', p.food <= 6);
    st.classList.toggle('low', p.health <= 5);
    $('#mode-badge').textContent = (p.creative ? '크리에이티브' : '') + (p.flying ? ' · 비행' : '');
  }
  update(dt) {
    const g = this.g, p = g.player;
    const key = [p.health | 0, p.food | 0, Math.ceil(p.air / 30), p.creative, p.flying, p.armorPoints ? p.armorPoints() : 0].join();
    if (key !== this._statKey) { this._statKey = key; this.refreshStats(); }
    // 회로 정보
    const H = this._hudEls || (this._hudEls = { rs: $('#rs-info'), ch: $('#crosshair'), dbg: $('#debug'), log: $('#chat-log'), nb: $('#net-badge'), lh: $('#lock-hint'), lb: $('#look-badge'), nw: $('#newwin-btn') });
    const rs = H.rs;
    let info = null;
    const held = p.held;
    const meter = held && ITEMS[held.id] && ITEMS[held.id].name === 'multimeter';
    if (g.target && (g.settings.showRs || meter)) {
      const d = BLOCKS[g.target.id];
      if (meter || (d && d.rs)) info = g.redstone.describe(g.target.x, g.target.y, g.target.z);
    }
    if (info) { rs.textContent = '⚡ ' + info; rs.classList.add('show'); } else rs.classList.remove('show');
    const te = !!g.targetEnt; if (te !== this._lastTE) { this._lastTE = te; H.ch.classList.toggle('ent', te); }
    // 디버그
    const dbg = H.dbg;
    if (g.settings.debug) {
      dbg.classList.add('show');
      if (performance.now() - this.lastDebug > 250) {
        this.lastDebug = performance.now();
        const w = g.world, t = g.target;
        const L = w.getLight(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z));
        const dir = ['남', '서', '북', '동'][(Math.round(-p.yaw / (Math.PI / 2)) % 4 + 6) % 4];
        dbg.textContent = `에듀 크래프트 ${VERSION}  ${g.fps} fps
XYZ ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}
청크 ${Math.floor(p.x / 16)}, ${Math.floor(p.z / 16)}  방향 ${dir}
바이옴 ${(BIOMES[w.biomeAt(Math.floor(p.x), Math.floor(p.z))] || {}).name}  빛 하늘 ${L >> 4} 블록 ${L & 15}
시간 ${w.time} (${Math.floor((w.time / 1000 + 6) % 24)}시)  틱 ${w.tick}
청크 ${w.chunks.size} (그림 ${g.renderer.stats.chunks})  삼각형 ${(g.renderer.stats.tris / 1000).toFixed(0)}k
개체 ${g.ents.list.length}  파티클 ${g.particles.list.length}  HDR ${g.renderer.hdr ? '예' : '아니오'}
${t ? `바라봄 ${BLOCKS[t.id].k} (${t.x}, ${t.y}, ${t.z}) meta ${t.meta}` : ''}`;
      }
    } else dbg.classList.remove('show');
    // 채팅 오래된 줄
    const now = performance.now();
    if (!this._chatT || now - this._chatT > 500) { this._chatT = now; for (const d of H.log.children) if (!d.classList.contains('old') && now - d._t > 10000) d.classList.add('old'); }
    // 네트워크 표시
    const nb = H.nb;
    if (g.net.connected) { nb.classList.add('show'); const nt = g.net.isHost ? `📡 방장 · ${g.net.peerCount() + 1}명${g.net.mode === 'peer' ? ' · 코드 ' + g.net.roomCode : ''}` : `🔗 참가 중 · ${g.remotes.size + 1}명`; if (nb._t !== nt) { nb._t = nt; nb.textContent = nt; } }
    else nb.classList.remove('show');
    if (this.modal === 'container') this.refreshSlots(true);
    const lh = H.lh, lhOn = !g.input.touch && !g.input.locked && g.input.lookMode === 'lock' && !this.modal && !p.dead;
    lh.classList.toggle('show', lhOn);
    if (lhOn && lh._v !== VERSION) { lh._v = VERSION; lh.innerHTML = `🖱 화면을 클릭하면 마우스가 고정되고, 마우스를 움직이면 시야가 돌아가요<small>Esc 메뉴 · V 시점 방식 바꾸기 · 방향키로도 시야 회전 · ${VERSION}</small>`; }
    const lb = H.lb; if (lb) { const t = g.input.touch ? '' : LOOK_NAMES[g.input.lookMode] + (g.input.lookMode === 'lock' ? (g.input.locked ? ' · 켜짐' : ' · 클릭하세요') : '') + ' (V) · ' + VERSION; if (lb._t !== t) { lb._t = t; lb.textContent = t; } }
    const nw = H.nw; if (nw) { const d = canOpenNewWindow() && !g.input.touch && !this.modal ? '' : 'none'; if (nw.style.display !== d) nw.style.display = d; }
  }
  updateNameTags(cam) {
    const g = this.g, R = g.renderer, box = $('#nametags');
    const tags = [];
    for (const [id, r] of g.remotes) { tags.push([r.x, r.y + 2.25, r.z, r.name, '', this.faceUrl(r.av)]); if (r.bot) tags.push([r.bot.x + 0.5, r.bot.y + 1.3, r.bot.z + 0.5, r.name + '의 빌더봇', 'bot']); }
    if (g.builder.visible) tags.push([g.builder.bx + 0.5, g.builder.by + 1.3, g.builder.bz + 0.5, '빌더봇', 'bot']);
    while (box.children.length < tags.length) { const d = document.createElement('div'); d.className = 'tag'; box.appendChild(d); }
    while (box.children.length > tags.length) box.lastChild.remove();
    tags.forEach((t, i) => {
      const el = box.children[i];
      const pr = R.project([t[0] - cam[0], t[1] - cam[1], t[2] - cam[2]]);
      if (!pr || pr[2] > 64) { el.style.display = 'none'; return; }
      el.style.display = ''; el.style.left = pr[0] + 'px'; el.style.top = pr[1] + 'px';
      el.className = 'tag ' + t[4];
      const face = t[5] || '';
      if (el._n !== t[3] || el._f !== face) { el._n = t[3]; el._f = face; el.innerHTML = (face ? `<img src="${face}" alt="">` : '') + esc(t[3]); }
    });
  }
  // ---------------- 채팅 ----------------
  chatLine(text, color) {
    const log = $('#chat-log');
    const d = document.createElement('div'); d.textContent = text; d._t = performance.now();
    if (color) d.style.color = color;
    log.appendChild(d);
    while (log.children.length > 60) log.firstChild.remove();
    const vis = $$('div', log); vis.forEach((e, i) => e.style.display = i >= vis.length - (this.chatOpen ? 20 : 8) ? '' : 'none');
  }
  openChat(prefix) {
    if (this.modal) return;
    this.chatOpen = true; this.modal = 'chat';
    this.g.input.releaseLock();
    $('#chat').classList.add('open');
    const ci = $('#chat-input'); ci.value = prefix || ''; setTimeout(() => ci.focus(), 10);
    this.chatLine('', null); $('#chat-log').lastChild.remove();
    const vis = $$('#chat-log div'); vis.forEach((e, i) => e.style.display = i >= vis.length - 20 ? '' : 'none');
  }
  closeChat() {
    this.chatOpen = false; if (this.modal === 'chat') this.modal = null;
    $('#chat').classList.remove('open'); $('#chat-input').blur();
    if (this.g.state === 'play' && !this.g.input.touch) this.g.input.requestLock();
  }
  submitChat(v) {
    if (v.startsWith('/')) { this.chatLine('> ' + v, '#999'); this.g.command(v); return; }
    this.g.net.sendChat(`<${this.g.player.name}> ${v}`);
  }

  // ---------------- 인벤토리 ----------------
  openInventory() {
    const g = this.g;
    if (this.modal) return;
    if (g.player.creative) return this.openCreative();
    this.craftW = 2; this.craftGrid = new Array(4).fill(null);
    this.buildInvScreen('inv', '인벤토리');
  }
  openCrafting() {
    this.craftW = 3; this.craftGrid = new Array(9).fill(null);
    this.buildInvScreen('craft', '제작대');
  }
  beginModal(name) {
    this.modal = name; document.body.classList.add('modal');
    this.g.input.releaseLock();
    this.slots = [];
  }
  closeModal(noLock) {
    const g = this.g;
    const m = this.modal;
    if (m === 'code') { g.builder.closeEditor(); }
    if (m === 'avatar' && g.avatarEd.isOpen) { g.avatarEd.onClose = null; g.avatarEd.close(false); }
    if (m === 'chat') { this.closeChat(); return; }
    // 제작 칸/커서 아이템 돌려주기
    if (this.craftGrid) { for (const it of this.craftGrid) if (it) this.returnItem(it); this.craftGrid = null; }
    if (this.cursor) { this.returnItem(this.cursor); this.cursor = null; this.renderCursor(); }
    this.modal = null; document.body.classList.remove('modal');
    const ae = document.activeElement; if (ae && ae !== document.body && ae.blur) ae.blur();
    this.container = null;
    this.tip.style.display = 'none';
    this.hideAll();
    this.refreshHotbar();
    if (g.state === 'play' && !noLock && !g.input.touch && !g.player.dead) g.input.requestLock();
  }
  returnItem(it) {
    const p = this.g.player;
    const left = p.give(it.id, it.n, it.d);
    if (left > 0) this.g.dropItem(p.x, p.eyeY() - 0.3, p.z, { id: it.id, n: left, d: it.d });
  }
  // 슬롯 참조 만들기
  ref(arr, i, kind, extra) { return Object.assign({ get: () => (typeof arr === 'function' ? arr() : arr)[i], set: (v) => { (typeof arr === 'function' ? arr() : arr)[i] = v; }, kind: kind || 'normal' }, extra || {}); }
  mountSlot(parent, r, cls) {
    const el = this.slotEl(); if (cls) el.className += ' ' + cls;
    el._ref = r; r.el = el;
    let lpT = null, lp = false;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (e.pointerType === 'touch') { lp = false; lpT = setTimeout(() => { lp = true; this.clickSlot(r, 2, false); }, 380); return; }
      this.clickSlot(r, e.button === 2 ? 2 : 0, e.shiftKey);
    });
    el.addEventListener('pointerup', e => { if (e.pointerType === 'touch') { clearTimeout(lpT); if (!lp) this.clickSlot(r, 0, false); } });
    el.addEventListener('pointerleave', () => { clearTimeout(lpT); this.tip.style.display = 'none'; });
    el.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') this.showTip(r); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    parent.appendChild(el);
    this.slots.push(r);
    this.drawSlot(el, r.get());
    return el;
  }
  showTip(r) {
    const it = r.tipItem ? r.tipItem() : r.get();
    if (!it) { this.tip.style.display = 'none'; return; }
    const d = ITEMS[it.id];
    let html = esc(d.k);
    if (r.tipExtra) html += r.tipExtra();
    if (d.desc) html += `<small>${esc(d.desc)}</small>`;
    if (d.food) html += `<small>배고픔 +${d.food}</small>`;
    if (d.dur) html += `<small>내구도 ${d.dur - (it.d || 0)} / ${d.dur}</small>`;
    this.tip.innerHTML = html; this.tip.style.display = 'block'; this.placeTip();
  }
  placeTip() { const t = this.tip; t.style.left = Math.min(window.innerWidth - t.offsetWidth - 8, (this.mx || 0) + 14) + 'px'; t.style.top = Math.max(4, (this.my || 0) - t.offsetHeight - 6) + 'px'; }
  refreshSlots(onlyDynamic) {
    for (const r of this.slots) if (r.el && (!onlyDynamic || r.dynamic)) this.drawSlot(r.el, r.get());
    if (this.modal === 'container' && this.furnaceEls) this.updateFurnaceBars();
    if (this.recipeListEl && !onlyDynamic) this.updateRecipeList();
  }
  renderCursor() {
    const c = this.cursorEl;
    if (!this.cursor) { c.style.display = 'none'; return; }
    c.style.display = 'block';
    applyIcon(c.firstChild, this.cursor.id);
    c.children[1].textContent = this.cursor.n > 1 ? this.cursor.n : '';
    this.moveCursor();
  }
  moveCursor() { this.cursorEl.style.left = (this.mx || 0) + 'px'; this.cursorEl.style.top = (this.my || 0) + 'px'; }
  clickSlot(r, btn, shift) {
    const p = this.g.player;
    if (r.kind === 'palette') {
      const it = r.get(); const max = itemMaxStack(it.id);
      if (this.cursor) { this.cursor = null; }
      else if (shift) { p.give(it.id, max); }
      else this.cursor = { id: it.id, n: btn === 2 ? 1 : max };
      this.renderCursor(); this.refreshSlots(); this.refreshHotbar(); return;
    }
    if (r.kind === 'trash') { this.cursor = null; this.renderCursor(); return; }
    if (r.kind === 'output') { this.takeCraft(shift); return; }
    if (r.kind === 'recipe') { this.showRecipe(r.recipe); if (shift && !r.recipe.smelt) this.quickCraft(r.recipe, true); return; }
    let it = r.get();
    if (shift && it) { this.quickMove(r); this.afterSlotChange(r); return; }
    const cur = this.cursor;
    if (r.kind === 'take') { // 결과 칸 (화로 출력)
      if (!it) return;
      if (!cur) { this.cursor = it; r.set(null); }
      else if (cur.id === it.id && cur.n + it.n <= itemMaxStack(it.id)) { cur.n += it.n; r.set(null); }
    } else if (btn === 0) {
      if (!cur && it) { this.cursor = it; r.set(null); }
      else if (cur && !it) { if (!r.accept || r.accept(cur)) { r.set(cur); this.cursor = null; } }
      else if (cur && it) {
        if (cur.id === it.id && !cur.d && !it.d) { const max = itemMaxStack(it.id); const t = Math.min(cur.n, max - it.n); it.n += t; cur.n -= t; if (!cur.n) this.cursor = null; }
        else if (!r.accept || r.accept(cur)) { r.set(cur); this.cursor = it; }
      }
    } else {
      if (!cur && it) { const h = Math.ceil(it.n / 2); this.cursor = { id: it.id, n: h }; if (it.d) this.cursor.d = it.d; it.n -= h; if (!it.n) r.set(null); }
      else if (cur && (!it || (it.id === cur.id && it.n < itemMaxStack(it.id) && !it.d))) {
        if (!r.accept || r.accept(cur)) { if (!it) r.set({ id: cur.id, n: 1, d: cur.d }); else it.n++; cur.n--; if (!cur.n) this.cursor = null; }
      } else if (cur && it) { if (!r.accept || r.accept(cur)) { r.set(cur); this.cursor = it; } }
    }
    this.renderCursor();
    this.afterSlotChange(r);
  }
  afterSlotChange(r) {
    if (r.grid) this.updateCraftResult();
    if (r.container) this.syncContainer();
    this.refreshSlots(); this.refreshHotbar();
    if (this.g.player.creative) { }
  }
  quickMove(r) {
    const p = this.g.player;
    const it = r.get(); if (!it) return;
    const ad = ITEMS[it.id] && ITEMS[it.id].armor;
    if (r.inv && ad && !p.armor[ad.slot] && !this.slots.some(s => s.container)) { p.armor[ad.slot] = it; r.set(null); return; }
    const tryInto = (targets) => {
      for (const t of targets) { const s = t.get(); if (s && s.id === it.id && !s.d && !it.d && s.n < itemMaxStack(it.id)) { const n = Math.min(it.n, itemMaxStack(it.id) - s.n); s.n += n; it.n -= n; if (!it.n) { r.set(null); return true; } } }
      for (const t of targets) { if (!t.get() && (!t.accept || t.accept(it))) { t.set(it); r.set(null); return true; } }
      return false;
    };
    const inv = this.slots.filter(s => s.inv);
    const hot = inv.filter(s => s.idx < 9), main = inv.filter(s => s.idx >= 9);
    if (r.container || r.grid || r.armorSlot !== undefined) { tryInto(hot.concat(main)); return; }
    const cont = this.slots.filter(s => s.container && s.kind !== 'take');
    if (cont.length) {
      if (this.furnace) {
        const be = this.container && this.g.world.be.get(this.container);
        if (SMELT[it.id] !== undefined) tryInto([cont[0]]); else if (FUEL[it.id]) tryInto([cont[1]]);
        return;
      }
      if (tryInto(cont)) return;
      return;
    }
    if (r.idx < 9) tryInto(main); else tryInto(hot);
  }
  hotkeySwap(n) {
    // 마우스가 올라가 있는 슬롯과 단축바 n 교환
    const el = document.elementFromPoint(this.mx || 0, this.my || 0);
    const slot = el && el.closest('.slot');
    if (!slot || !slot._ref || slot._ref.kind !== 'normal') return;
    const r = slot._ref, p = this.g.player;
    const a = r.get(), b = p.inv[n];
    r.set(b); p.inv[n] = a;
    this.afterSlotChange(r);
  }
  // ---- 제작 ----
  updateCraftResult() {
    const r = matchRecipe(this.craftGrid, this.craftW);
    this.craftResult = r ? { id: r.resultId, n: r.count } : null;
    if (this.outRef) this.drawSlot(this.outRef.el, this.craftResult);
  }
  takeCraft(shift) {
    const p = this.g.player;
    let loops = shift ? 64 : 1;
    while (loops-- > 0) {
      const res = this.craftResult; if (!res) break;
      if (shift) { const left = p.give(res.id, res.n); if (left) { if (left === res.n) break; this.g.dropItem(p.x, p.y + 1, p.z, { id: res.id, n: left }); } }
      else {
        if (this.cursor && (this.cursor.id !== res.id || this.cursor.n + res.n > itemMaxStack(res.id))) break;
        if (this.cursor) this.cursor.n += res.n; else this.cursor = { id: res.id, n: res.n };
      }
      for (let i = 0; i < this.craftGrid.length; i++) { const c = this.craftGrid[i]; if (c) { c.n--; if (!c.n) this.craftGrid[i] = null; } }
      this.updateCraftResult();
    }
    this.g.sound.play('pop');
    this.renderCursor(); this.refreshSlots(); this.refreshHotbar();
  }
  canCraft(r) {
    const p = this.g.player;
    if (p.creative) return true;
    for (const [ids, n] of recipeNeeds(r)) { let c = 0; for (const s of p.inv) if (s && ids.includes(s.id)) c += s.n; if (c < n) return false; }
    return true;
  }
  quickCraft(r, shift) {
    const p = this.g.player;
    let times = shift ? 64 : 1;
    if (r.smelt) { this.toast('화로에서 녹여 만들어요'); return; }
    if (((r.w > this.craftW || r.h > this.craftW) && r.shaped) || (!r.shaped && r.listIds.length > this.craftW * this.craftW)) { this.toast('제작대에서 만들 수 있어요'); return; }
    let made = 0;
    while (times-- > 0 && this.canCraft(r)) {
      if (!p.creative) for (const [ids, n] of recipeNeeds(r)) {
        let need = n;
        for (let i = 0; i < 36 && need > 0; i++) { const s = p.inv[i]; if (s && ids.includes(s.id)) { const t = Math.min(need, s.n); s.n -= t; need -= t; if (!s.n) p.inv[i] = null; } }
      }
      const left = p.give(r.resultId, r.count);
      if (left) this.g.dropItem(p.x, p.y + 1, p.z, { id: r.resultId, n: left });
      made++;
    }
    if (made) { this.g.sound.play('pop'); this.toast(`${itemName(r.resultId)} ×${made * r.count} 제작!`, 1200); }
    this.refreshSlots(); this.refreshHotbar();
  }
  buildRecipePanel(parent) {
    const box = document.createElement('div'); box.className = 'recipe-panel';
    box.innerHTML = `<h4>📖 제작법 도감</h4><div class="rc-detail" id="rc-detail"><p class="rc-hint">아이템을 누르면 만드는 방법이 보여요.<br>초록 테두리 = 지금 만들 수 있어요!</p></div>
      <label class="check" style="color:#333;font-size:14px"><input type="checkbox" id="rc-only"> 만들 수 있는 것만</label><div id="rc-uses"></div><input class="search" id="rc-q" placeholder="🔍 검색 (예: 제작대, 곡괭이)"><div class="inv-grid" id="rc-list"></div>`;
    parent.appendChild(box);
    this.rcUses = null;
    this.recipeListEl = $('#rc-list', box);
    $('#rc-only', box).onchange = () => this.updateRecipeList(true);
    $('#rc-q', box).oninput = () => this.updateRecipeList(true);
    this.recipeBox = box;
    this.updateRecipeList(true);
  }
  updateRecipeList(rebuild) {
    const box = this.recipeBox; if (!box) return;
    const only = $('#rc-only', box).checked, q = $('#rc-q', box).value.trim(), uses = this.rcUses;
    const ub = $('#rc-uses', box);
    ub.innerHTML = uses ? `<button class="chip on" id="rc-uses-x">🔎 ${esc(itemName(uses))}(으)로 만드는 것 ✕</button>` : '';
    if (uses) $('#rc-uses-x', box).onclick = () => { this.rcUses = null; this.updateRecipeList(true); };
    const seen = new Set(); const list = [];
    const all = RECIPES.concat(smeltRecipes());
    for (const r of all) {
      if (r.smelt) { if (only) continue; }
      else if (r.shaped && (r.w > this.craftW || r.h > this.craftW)) { if (this.craftW < 3) { if (only) continue; } }
      const key = r.smelt ? 's' + r.input : r.resultId + ':' + (r.shaped ? r.pattern.join('|') : r.list.join());
      if (seen.has(key)) continue; seen.add(key);
      if (q && !itemName(r.resultId).includes(q)) continue;
      if (uses && !(r.smelt ? r.input === uses : recipeNeeds(r).some(([ids]) => ids.includes(uses)))) continue;
      const can = !r.smelt && this.canCraft(r) && !(r.shaped && (r.w > this.craftW || r.h > this.craftW));
      if (only && !can) continue;
      list.push([r, can]);
    }
    list.sort((a, b) => (b[1] - a[1]));
    const sig = (uses || '') + list.map(x => x[0].resultId + (x[1] ? 'y' : 'n')).join();
    if (!rebuild && sig === this._rcSig) return;
    this._rcSig = sig;
    const L = this.recipeListEl; L.innerHTML = '';
    this.slots = this.slots.filter(s => s.kind !== 'recipe');
    for (const [r, can] of list) {
      const ref = { get: () => ({ id: r.resultId, n: r.count }), set: () => { }, kind: 'recipe', recipe: r, tipExtra: () => r.smelt ? `<small>🔥 화로: ${esc(itemName(r.input))} 녹이기</small>` : '<small>재료: ' + recipeNeeds(r).map(([ids, n]) => itemName(ids[0]) + (ids.length > 1 ? '(아무거나)' : '') + ' ×' + n).join(', ') + ((r.shaped && (r.w > 2 || r.h > 2)) ? ' · 제작대 필요' : '') + '</small>' };
      const el = this.mountSlot(L, ref, can ? 'can' : r.smelt ? 'smelt' : 'no');
    }
    if (!list.length) L.innerHTML = '<div style="grid-column:1/-1;color:#555;font-size:13px">재료가 부족해요</div>';
  }
  // 제작법 자세히 보기 (배치 그림)
  showRecipe(rc) {
    const box = this.recipeBox && $('#rc-detail', this.recipeBox); if (!box) return;
    this.rcSel = rc;
    const p = this.g.player;
    const have = (ids) => { if (p.creative) return 999; let c = 0; for (const s of p.inv) if (s && ids.includes(s.id)) c += s.n; return c; };
    const needs = rc.smelt ? [[[rc.input], 1]] : recipeNeeds(rc);
    const lack = new Set(); for (const [ids, n] of needs) if (have(ids) < n) lack.add(ids.join());
    const ic = (ids, n) => ids ? `<span class="rc-ic${lack.has(ids.join()) ? ' miss' : ''}" data-id="${ids[0]}" title="${esc(itemName(ids[0]))}"><i></i>${n > 1 ? `<b>${n}</b>` : ''}</span>` : '<span class="rc-ic empty"></span>';
    let html = `<div class="rc-title"><span class="rc-ic big" data-id="${rc.resultId}"><i></i>${rc.count > 1 ? `<b>${rc.count}</b>` : ''}</span> <b>${esc(itemName(rc.resultId))}</b></div>`;
    if (rc.smelt) {
      html += `<div class="rc-row">${ic([rc.input])}<span class="rc-arrow">🔥</span>${ic([rc.resultId])}</div><p class="rc-where">🔥 <b>화로</b> 위 칸에 넣고, 아래 칸에 석탄·숯·나무를 넣어요.</p>`;
    } else {
      let cells = '';
      if (rc.shaped) { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const ch = (rc.pattern[y] || '')[x]; cells += ic(ch && ch !== ' ' ? rc.keyIds[ch] : null); } }
      else { for (let i = 0; i < 9; i++) cells += ic(rc.listIds[i] || null); }
      const small = rc.shaped ? rc.w <= 2 && rc.h <= 2 : rc.listIds.length <= 4;
      html += `<div class="rc-row"><div class="rc-grid">${cells}</div><span class="rc-arrow">➜</span>${ic([rc.resultId], rc.count)}</div>`;
      html += `<p class="rc-where">${small ? '🎒 인벤토리(<kbd>E</kbd>)의 2×2 칸에서도 만들 수 있어요' : '🛠 <b>제작대</b>(3×3)에서 만들어요'}${rc.shaped ? '' : ' · 놓는 자리는 상관없어요'}</p>`;
    }
    html += `<p class="rc-need">${needs.map(([ids, n]) => `<span class="${lack.has(ids.join()) ? 'no' : 'ok'}">${esc(itemName(ids[0]))}${ids.length > 1 ? '(종류 상관없음)' : ''} ${Math.min(have(ids), 999)}/${n}</span>`).join(' ')}</p>`;
    const fits = !rc.smelt && !((rc.shaped && (rc.w > this.craftW || rc.h > this.craftW)) || (!rc.shaped && rc.listIds.length > this.craftW * this.craftW));
    html += `<div class="row rc-btns">${fits ? `<button class="btn small primary" id="rc-make" ${this.canCraft(rc) ? '' : 'disabled'}>🔨 만들기</button><button class="btn small" id="rc-make-all" ${this.canCraft(rc) ? '' : 'disabled'}>여러 개</button>` : ''}<button class="btn small" id="rc-use">🔎 쓰임새</button></div>`;
    box.innerHTML = html;
    $$('.rc-ic[data-id]', box).forEach(el => applyIcon(el.firstChild, +el.dataset.id));
    $$('.rc-grid .rc-ic[data-id], .rc-row > .rc-ic[data-id]', box).forEach(el => el.onclick = () => { const id = +el.dataset.id; const r2 = RECIPES.find(r => r.resultId === id) || smeltRecipes().find(r => r.resultId === id); if (r2) this.showRecipe(r2); else this.toast(`${itemName(id)}: 자연에서 모으거나 캐요`, 1600); });
    if ($('#rc-make', box)) { $('#rc-make', box).onclick = () => { this.quickCraft(rc, false); this.showRecipe(rc); }; $('#rc-make-all', box).onclick = () => { this.quickCraft(rc, true); this.showRecipe(rc); }; }
    $('#rc-use', box).onclick = () => { this.rcUses = rc.resultId; $('#rc-only', this.recipeBox).checked = false; this.updateRecipeList(true); };
  }
  buildPlayerInv(parent) {
    const p = this.g.player;
    const h = document.createElement('h4'); h.textContent = '인벤토리'; parent.appendChild(h);
    const main = document.createElement('div'); main.className = 'inv-grid'; parent.appendChild(main);
    for (let i = 9; i < 36; i++) this.mountSlot(main, Object.assign(this.ref(p.inv, i), { inv: true, idx: i }));
    const gap = document.createElement('div'); gap.style.height = '8px'; parent.appendChild(gap);
    const hot = document.createElement('div'); hot.className = 'inv-grid'; parent.appendChild(hot);
    for (let i = 0; i < 9; i++) this.mountSlot(hot, Object.assign(this.ref(p.inv, i), { inv: true, idx: i }));
  }
  buildInvScreen(kind, title) {
    this.beginModal(kind === 'inv' ? 'inv' : 'craft');
    const s = this.screen('inv-screen', `<div class="inv-wrap"><div class="inv-panel" id="ip-main"><button class="inv-close" id="ip-x">✕</button><h4>${esc(title)} <button class="btn small inv-sort" id="ip-sort" title="가방 정리">🧹 정리</button></h4><div class="inv-flex" id="ip-craft"></div><div id="ip-inv" style="margin-top:10px"></div></div></div>`);
    const cr = $('#ip-craft', s);
    const pl = this.g.player;
    const arm = document.createElement('div'); arm.className = 'armor-col'; cr.appendChild(arm);
    for (let i = 0; i < 4; i++) this.mountSlot(arm, Object.assign(this.ref(pl.armor, i), { armorSlot: i, accept: it => !!(ITEMS[it.id] && ITEMS[it.id].armor && ITEMS[it.id].armor.slot === i), tipExtra: () => '' }), 'armor ph' + i);
    $('#ip-sort', s).onclick = () => { Survival.sortInv(pl); this.refreshSlots(); this.refreshHotbar(); this.g.sound.play('pop'); };
    const grid = document.createElement('div'); grid.className = 'inv-grid c' + this.craftW; cr.appendChild(grid);
    for (let i = 0; i < this.craftGrid.length; i++) this.mountSlot(grid, Object.assign(this.ref(() => this.craftGrid, i), { grid: true }));
    const ar = document.createElement('div'); ar.className = 'arrow'; ar.textContent = '➜'; cr.appendChild(ar);
    const out = document.createElement('div'); cr.appendChild(out);
    this.outRef = { get: () => this.craftResult, set: () => { }, kind: 'output' };
    this.mountSlot(out, this.outRef, 'out');
    this.craftResult = null;
    this.buildPlayerInv($('#ip-inv', s));
    this.buildRecipePanel($('.inv-wrap', s));
    $('#ip-x', s).onclick = () => this.closeModal();
    this.show('inv-screen');
  }
  openCreative() {
    this.beginModal('inv');
    this.craftGrid = null;
    const p = this.g.player;
    const cats = [['build', '건축'], ['redstone', '⚡레드스톤'], ['color', '색깔'], ['nature', '자연'], ['tools', '도구·음식'], ['all', '전체'], ['p', '내 가방']];
    this.creativeCat = this.creativeCat || 'build';
    const s = this.screen('inv-screen', `<div class="inv-panel" id="ip-main"><button class="inv-close" id="ip-x">✕</button>
      <div class="ctabs" id="cr-tabs"></div><input class="search" id="cr-q" placeholder="🔍 블록/아이템 검색 (예: 램프, 피스톤)"><div class="palette" id="cr-pal"></div>
      <div style="height:8px"></div><div id="cr-inv"></div>
      <div class="inv-flex" style="margin-top:6px"><div class="inv-grid" id="cr-hot"></div><div id="cr-trash"></div></div>
      <p style="font-size:13px;color:#555;margin:6px 0 0">클릭: 한 묶음 · 오른쪽 클릭(길게 누르기): 1개 · Shift+클릭: 바로 인벤토리로 · 🗑에 놓으면 삭제</p></div>`);
    const tabs = $('#cr-tabs', s);
    const pal = $('#cr-pal', s);
    const drawPal = () => {
      this.slots = this.slots.filter(r => r.kind !== 'palette');
      pal.innerHTML = '';
      const q = $('#cr-q', s).value.trim();
      const cat = this.creativeCat;
      $('#cr-inv', s).style.display = cat === 'p' ? '' : 'none';
      pal.style.display = cat === 'p' ? 'none' : '';
      if (cat === 'p') return;
      for (const d of ITEMS) {
        if (!d) continue;
        if (d.name === 'redstone_wire') continue;
        const c = d.cat || 'build';
        const cc = c === 'food' || c === 'items' ? 'tools' : c;
        if (q) { if (!d.k.includes(q) && !d.name.includes(q)) continue; }
        else if (cat !== 'all' && cc !== cat) continue;
        this.mountSlot(pal, { get: () => ({ id: d.id, n: 1 }), set: () => { }, kind: 'palette' });
      }
    };
    for (const [k, n] of cats) { const b = document.createElement('button'); b.textContent = n; b.dataset.k = k; b.onclick = () => { this.creativeCat = k; $$('button', tabs).forEach(x => x.classList.toggle('on', x.dataset.k === k)); drawPal(); }; tabs.appendChild(b); }
    $$('button', tabs).forEach(x => x.classList.toggle('on', x.dataset.k === this.creativeCat));
    $('#cr-q', s).oninput = () => drawPal();
    const inv = $('#cr-inv', s); const main = document.createElement('div'); main.className = 'inv-grid'; inv.appendChild(main);
    for (let i = 9; i < 36; i++) this.mountSlot(main, Object.assign(this.ref(p.inv, i), { inv: true, idx: i }));
    const hot = $('#cr-hot', s);
    for (let i = 0; i < 9; i++) this.mountSlot(hot, Object.assign(this.ref(p.inv, i), { inv: true, idx: i }));
    this.mountSlot($('#cr-trash', s), { get: () => null, set: () => { }, kind: 'trash' }, 'trash');
    drawPal();
    $('#ip-x', s).onclick = () => this.closeModal();
    this.show('inv-screen');
  }
  // ---- 상자/화로/발사기 ----
  openContainer(x, y, z) {
    const g = this.g, w = g.world;
    const k = fmtKey(x, y, z);
    let be = w.be.get(k);
    const id = w.getBlock(x, y, z);
    if (!be) { if (w.remote) { g.net.send({ t: 'beReq', k }); } g.createContainer(x, y, z, id); be = w.be.get(k); }
    this.beginModal('container');
    this.container = k; this.furnace = be.t === 'furnace';
    const title = BLOCKS[id].k;
    const s = this.screen('inv-screen', `<div class="inv-panel" id="ip-main"><button class="inv-close" id="ip-x">✕</button><h4>${esc(title)}</h4><div id="ct-box" class="inv-flex"></div><div id="ct-inv" style="margin-top:10px"></div></div>`);
    const box = $('#ct-box', s);
    const items = () => { const b = w.be.get(k); return b ? b.items : new Array(27).fill(null); };
    this.furnaceEls = null;
    if (be.t === 'furnace') {
      const left = document.createElement('div'); left.className = 'col'; left.style.alignItems = 'center'; box.appendChild(left);
      this.mountSlot(left, Object.assign(this.ref(items, 0), { container: true, dynamic: true }));
      const fire = document.createElement('div'); fire.className = 'fire'; fire.innerHTML = '<div></div>'; left.appendChild(fire);
      this.mountSlot(left, Object.assign(this.ref(items, 1), { container: true, dynamic: true, accept: it => !!FUEL[it.id] }));
      const cook = document.createElement('div'); cook.className = 'cook'; cook.innerHTML = '<div></div>'; box.appendChild(cook);
      const out = document.createElement('div'); box.appendChild(out);
      this.mountSlot(out, Object.assign(this.ref(items, 2, 'take'), { container: true, dynamic: true }), 'out');
      this.furnaceEls = { fire: fire.firstChild, cook: cook.firstChild };
      const tip = document.createElement('p'); tip.style.cssText = 'color:#555;font-size:13px;margin:0'; tip.textContent = '위: 녹일 것 · 아래: 연료(석탄, 나무)'; box.appendChild(tip);
    } else {
      const n = be.items.length;
      const grid = document.createElement('div'); grid.className = 'inv-grid' + (n === 9 ? ' c3' : ''); box.appendChild(grid);
      for (let i = 0; i < n; i++) this.mountSlot(grid, Object.assign(this.ref(items, i), { container: true, dynamic: true }));
      if (be.t === 'hopper') { const tip = document.createElement('p'); tip.style.cssText = 'color:#555;font-size:13px;max-width:220px'; tip.textContent = '위의 상자·아이템을 빨아들여 주둥이 쪽 상자(또는 화로)로 옮겨요. 전기를 받으면 멈춰요.'; box.appendChild(tip); }
      if (be.t === 'disp') { const tip = document.createElement('p'); tip.style.cssText = 'color:#555;font-size:13px;max-width:200px'; tip.textContent = id === BL.dispenser ? '화살·물 양동이·TNT·광산 수레를 넣으면 신호가 올 때 발사해요' : '신호가 올 때 아이템을 하나씩 앞으로 내보내요 (앞에 상자가 있으면 넣어 줘요)'; box.appendChild(tip); }
    }
    this.buildPlayerInv($('#ct-inv', s));
    $('#ip-x', s).onclick = () => this.closeModal();
    this.show('inv-screen');
  }
  updateFurnaceBars() {
    const be = this.g.world.be.get(this.container); if (!be || !this.furnaceEls) return;
    this.furnaceEls.fire.style.height = (be.burnMax ? be.burn / be.burnMax * 100 : 0) + '%';
    this.furnaceEls.cook.style.width = (be.cook / 200 * 100) + '%';
  }
  syncContainer() {
    const g = this.g, k = this.container; if (!k) return;
    const be = g.world.be.get(k);
    const [x, y, z] = parseKey(k);
    if (g.world.remote) g.net.send({ t: 'be', k, v: be });
    else { if (g.net.isHost) g.net.broadcast({ t: 'be', k, v: be }); g.redstone.queueAround(x, y, z); }
  }
  openCode() {
    if (this.modal) return;
    this.beginModal('code');
    this.g.builder.openEditor();
  }
}
