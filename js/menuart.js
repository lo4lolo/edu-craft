'use strict';
// =====================================================================
// 메인 화면 — v1.5
//  - 코드로 그린 픽셀 그림(빌더봇이 코드 블록대로 집을 짓고, 도전 과제 트로피·지옥문·엔드 섬)
//    384×160 작은 캔버스를 크게 늘려 그림 → 가볍고 어느 화면에서도 선명. 메인 화면이 보일 때만 움직임(초당 12장)
//  - 「나의 도전」: 도전 과제 칭호·개수, 코딩 마스터 단계·빌더봇 등급, 다음 단계 이름
//  - 이어하기(최근 세계) · 서바이벌 새로 · 크리에이티브(평지)
//  일장기를 떠올리게 하는 방사형 빛줄기는 쓰지 않음 (반짝이 별·부드러운 빛만)
// 도전 과제 최고 기록: localStorage educraft.achBest {n, pts} (저장할 때마다 갱신)
// =====================================================================
const ACH_BEST_KEY = 'educraft.achBest';
function achBestLoad() { try { return JSON.parse(localStorage.getItem(ACH_BEST_KEY) || 'null') || { n: 0, pts: 0 }; } catch (e) { return { n: 0, pts: 0 }; } }
function achBestSave(g) {
  if (!g.adv || typeof achPoints !== 'function') return;
  const b = achBestLoad(), n = g.adv.size, pts = achPoints(g);
  if (n > b.n || pts > b.pts) { try { localStorage.setItem(ACH_BEST_KEY, JSON.stringify({ n: Math.max(n, b.n), pts: Math.max(pts, b.pts) })); } catch (e) { } }
}
{
  const G = Game.prototype;
  const _ser = G.serializeWorld;
  G.serializeWorld = function () { const r = _ser.call(this); achBestSave(this); return r; };
  const _ag = G.advGrant;
  G.advGrant = function (id) { const had = this.adv && this.adv.has(id); _ag.call(this, id); if (!had && this.adv && this.adv.has(id)) achBestSave(this); };
}

// ---------------- 픽셀 그림 ----------------
class MenuArt {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.W = cv.width; this.H = cv.height; this.t = 0;
    this.stars = []; const r = mulberry32(7);
    for (let i = 0; i < 46; i++) this.stars.push([r() * this.W | 0, r() * 70 | 0, r() * 6.28, r() < 0.2]);
    this.loop = (ts) => {
      if (!this.cv.isConnected || !this.cv.offsetParent) { this.raf = 0; return; }
      if (!this.last || ts - this.last > 80) { this.last = ts; this.t += 0.08; this.draw(); }
      this.raf = requestAnimationFrame(this.loop);
    };
    this.draw(); this.raf = requestAnimationFrame(this.loop);
  }
  R(x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
  // 8칸 블록 (위 밝게, 아래 어둡게)
  block(x, y, c, top, dark) { this.R(x, y, 8, 8, c); this.R(x, y, 8, 1, top || c); this.R(x, y + 7, 8, 1, dark || 'rgba(0,0,0,0.18)'); this.R(x + 7, y, 1, 8, 'rgba(0,0,0,0.12)'); }
  dashed(x, y) { const c = 'rgba(120,230,255,0.9)'; for (let i = 0; i < 8; i += 2) { this.R(x + i, y, 1, 1, c); this.R(x + i + 1, y + 7, 1, 1, c); this.R(x, y + i + 1, 1, 1, c); this.R(x + 7, y + i, 1, 1, c); } }
  star(x, y, s, c) { this.R(x, y - s, 1, s * 2 + 1, c); this.R(x - s, y, s * 2 + 1, 1, c); }
  glow(x, y, r, col) { const g = this.ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); this.ctx.fillStyle = g; this.ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  draw() {
    const c = this.ctx, W = this.W, H = this.H, t = this.t, GY = 136;
    // 하늘 (노을 → 보라)
    const sky = c.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#2b2a6e'); sky.addColorStop(0.55, '#7b6fd6'); sky.addColorStop(1, '#ffc7b8');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (const [x, y, ph, big] of this.stars) { const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.4 + ph)); this.R(x, y, 1, 1, `rgba(255,255,240,${a})`); if (big && a > 0.8) this.star(x, y, 1, 'rgba(255,255,240,0.5)'); }
    // 엔드 섬과 드래곤 (오른쪽 위)
    this.glow(330, 34, 34, 'rgba(200,150,255,0.35)');
    c.fillStyle = '#e8e2a6'; c.beginPath(); c.moveTo(296, 38); c.lineTo(366, 38); c.lineTo(352, 47); c.lineTo(336, 52); c.lineTo(316, 48); c.closePath(); c.fill();
    this.R(296, 37, 70, 2, '#f4f0c0');
    for (const [px, h] of [[304, 12], [318, 18], [334, 15], [350, 20], [360, 10]]) { this.R(px, 37 - h, 3, h, '#2a1b3d'); this.R(px + 1, 36 - h, 1, 1, '#ff8de0'); }
    const dx = 330 + Math.sin(t * 0.6) * 26, dy = 16 + Math.sin(t * 1.2) * 4, fl = Math.sin(t * 4) > 0 ? -2 : 2;
    c.fillStyle = '#1b1226';
    c.fillRect(dx - 6, dy, 12, 3); c.fillRect(dx + 5, dy - 1, 4, 2);
    c.beginPath(); c.moveTo(dx - 3, dy + 1); c.lineTo(dx - 11, dy - 3 + fl); c.lineTo(dx - 1, dy + 1); c.fill();
    c.beginPath(); c.moveTo(dx + 1, dy + 1); c.lineTo(dx + 4, dy - 4 + fl); c.lineTo(dx + 4, dy + 1); c.fill();
    this.R(dx + 7, dy - 1, 1, 1, '#d86bff');
    // 먼 산
    c.fillStyle = '#6a63b8'; c.beginPath(); c.moveTo(0, GY); for (let x = 0; x <= W; x += 12) c.lineTo(x, GY - 26 - Math.sin(x * 0.045) * 12 - Math.sin(x * 0.11) * 5); c.lineTo(W, GY); c.fill();
    c.fillStyle = '#8a7fd0'; c.beginPath(); c.moveTo(0, GY); for (let x = 0; x <= W; x += 8) c.lineTo(x, GY - 12 - Math.sin(x * 0.07 + 1) * 7); c.lineTo(W, GY); c.fill();
    // 땅 (잔디 + 흙 + 광석)
    for (let x = 0; x < W; x += 8) {
      this.block(x, GY, '#7fcf6b', '#a6ec8a', '#5fa04f');
      for (let y = GY + 8; y < H; y += 8) { const ore = ((x * 7 + y * 3) % 53) === 0; this.block(x, y, ore ? '#9a8a7a' : '#a8785a', ore ? '#b5a595' : '#b98a6a'); if (ore) { this.R(x + 2, y + 2, 2, 2, '#59e0d8'); this.R(x + 5, y + 4, 1, 2, '#59e0d8'); } }
    }
    // 반쯤 지은 집 + 앞으로 지을 칸(점선) = 코드 미리보기
    const hx = 26, built = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 1], [5, 1], [0, 2], [5, 2], [0, 3], [1, 3], [2, 3]];
    const plan = [[3, 3], [4, 3], [5, 3], [1, 4], [2, 4], [3, 4], [4, 4], [2, 5], [3, 5]];
    for (const [i, j] of built) this.block(hx + i * 8, GY - 8 - j * 8, j === 3 ? '#c99a5e' : '#d9b27a', '#ecd09a', '#a8834f');
    this.R(hx + 16, GY - 24, 8, 16, '#8a5a30'); this.R(hx + 21, GY - 16, 1, 1, '#ffd34a');
    this.R(hx + 8, GY - 20, 6, 5, '#bfe8ff'); this.R(hx + 32, GY - 20, 6, 5, '#bfe8ff');
    const nextK = Math.floor(t * 0.7) % plan.length;
    plan.forEach(([i, j], k) => { if (k < nextK) this.block(hx + i * 8, GY - 8 - j * 8, '#e46a6a', '#f39a8a', '#b84a4a'); else this.dashed(hx + i * 8, GY - 8 - j * 8); });
    // 빌더봇 (방금 놓은 칸을 비춤)
    const [ti, tj] = plan[Math.max(0, nextK - 1)] || plan[0];
    const bx = 92 + Math.sin(t * 0.8) * 3, by = 66 + Math.sin(t * 2) * 2;
    const tx = hx + ti * 8 + 4, ty = GY - 8 - tj * 8 + 4;
    for (let k = 0; k < 10; k++) { const q = k / 10; if ((k + Math.floor(t * 8)) % 2) this.R(bx + 6 + (tx - bx - 6) * q, by + 12 + (ty - by - 12) * q, 1, 1, '#7ff0ff'); }
    this.R(bx, by, 13, 11, '#e6ebf2'); this.R(bx, by + 10, 13, 1, '#aeb6c4'); this.R(bx + 2, by + 3, 9, 4, '#1c2633');
    this.R(bx + 3, by + 4, 2, 2, '#59f0ff'); this.R(bx + 8, by + 4, 2, 2, '#59f0ff');
    this.R(bx + 6, by - 4, 1, 4, '#8a94a6'); this.R(bx + 5, by - 6, 3, 2, '#ff5a4a');
    this.R(bx - 2, by + 4, 2, 4, '#aeb6c4'); this.R(bx + 13, by + 4, 2, 4, '#aeb6c4');
    this.R(bx + 4, by + 12, 5, 2, '#59d0ff');
    // 떠 있는 코드 블록 (반복 안에 앞으로·놓기)
    const cx = 128, cy = 14 + Math.sin(t * 1.1) * 2, BLK = (x, y, w, col, icon) => {
      this.R(x, y, w, 9, col); this.R(x, y, w, 1, 'rgba(255,255,255,0.45)'); this.R(x, y + 8, w, 1, 'rgba(0,0,0,0.18)'); this.R(x + 3, y - 1, 5, 1, col);
      this.R(x + 13, y + 4, w - 18, 1, 'rgba(255,255,255,0.85)');
      if (icon === 'play') { this.R(x + 4, y + 2, 1, 5, '#fff'); this.R(x + 5, y + 3, 1, 3, '#fff'); this.R(x + 6, y + 4, 1, 1, '#fff'); }
      if (icon === 'loop') { this.R(x + 4, y + 2, 4, 1, '#fff'); this.R(x + 4, y + 6, 4, 1, '#fff'); this.R(x + 3, y + 3, 1, 3, '#fff'); this.R(x + 8, y + 3, 1, 2, '#fff'); this.R(x + 7, y + 5, 3, 1, '#fff'); }
      if (icon === 'blk') { this.R(x + 4, y + 2, 5, 5, '#fff'); this.R(x + 5, y + 3, 3, 3, col); }
      if (icon === 'arrow') { this.R(x + 4, y + 4, 5, 1, '#fff'); this.R(x + 7, y + 3, 1, 3, '#fff'); this.R(x + 8, y + 4, 1, 1, '#fff'); }
    };
    BLK(cx, cy, 64, '#ffc34d', 'play');
    this.R(cx, cy + 10, 6, 34, '#ff9f5c'); BLK(cx, cy + 10, 70, '#ff9f5c', 'loop');
    BLK(cx + 6, cy + 20, 60, '#6fb3f7', 'arrow'); BLK(cx + 6, cy + 30, 56, '#5ccf8e', 'blk');
    this.R(cx, cy + 40, 30, 4, '#ff9f5c');
    // 현재 실행 중인 줄 표시
    const runRow = Math.floor(t * 0.7) % 2;
    this.R(cx + 4, cy + 20 + runRow * 10 - 1, 1, 11, '#ffffff');
    // 코딩 마스터 별 (단계)
    for (let k = 0; k < 5; k++) { const sx = cx + 76 + k * 9, sy = cy + 22, on = k < 3; this.star(sx, sy, 2, on ? '#ffe27a' : 'rgba(255,255,255,0.35)'); this.R(sx, sy, 1, 1, on ? '#fff' : 'rgba(255,255,255,0.5)'); }
    // 모험가 (칼 + 왼손 방패)
    const ax = 222, ay = GY - 24, step = Math.sin(t * 3) > 0 ? 1 : 0;
    this.R(ax + 1, ay, 6, 6, '#f2c9a5'); this.R(ax + 1, ay, 6, 2, '#5a3a2a'); this.R(ax + 2, ay + 3, 1, 1, '#222'); this.R(ax + 5, ay + 3, 1, 1, '#222');
    this.R(ax, ay + 6, 8, 8, '#4f8fe6'); this.R(ax + 1, ay + 14, 3, 9 + step, '#3a4a8a'); this.R(ax + 4, ay + 14, 3, 10 - step, '#3a4a8a');
    this.R(ax - 5, ay + 6, 5, 9, '#a87a48'); this.R(ax - 5, ay + 6, 5, 1, '#c8cdd6'); this.R(ax - 3, ay + 9, 1, 3, '#c8cdd6');
    this.R(ax + 8, ay + 7, 2, 6, '#f2c9a5'); this.R(ax + 10, ay - 2, 1, 10, '#bff4ff'); this.R(ax + 9, ay + 7, 3, 1, '#7a5a3a');
    // 도전 과제 트로피 + 메달 (반짝이 별)
    const tx2 = 262, tyB = GY - 8;
    this.block(tx2, tyB, '#9aa3b4', '#b9c1d0'); this.block(tx2 + 8, tyB, '#9aa3b4', '#b9c1d0');
    this.glow(tx2 + 8, tyB - 10, 16, 'rgba(255,220,120,0.45)');
    this.R(tx2 + 3, tyB - 3, 10, 3, '#c8901e'); this.R(tx2 + 6, tyB - 7, 4, 4, '#e0a020');
    this.R(tx2 + 2, tyB - 17, 12, 10, '#ffd24a'); this.R(tx2 + 3, tyB - 16, 3, 7, '#fff1a8');
    this.R(tx2, tyB - 16, 2, 5, '#ffd24a'); this.R(tx2 + 14, tyB - 16, 2, 5, '#ffd24a');
    for (const [mx, col] of [[tx2 - 14, '#e05a5a'], [tx2 + 22, '#4a8fe0']]) { this.R(mx + 1, tyB - 12, 2, 5, col); this.R(mx + 4, tyB - 12, 2, 5, col); this.R(mx, tyB - 7, 7, 7, '#ffcf4a'); this.R(mx + 2, tyB - 5, 3, 3, '#fff1a8'); }
    for (let k = 0; k < 4; k++) { const a = t * 1.3 + k * 1.57, s = Math.sin(t * 3 + k) > 0.3 ? 2 : 1; this.star(tx2 + 8 + Math.cos(a) * 16, tyB - 12 + Math.sin(a) * 8, s, '#fff6c8'); }
    // 지옥문 (흑요석 틀 + 보라 소용돌이)
    const px = 330, py = GY - 40;
    this.glow(px + 12, py + 20, 22, 'rgba(180,80,255,0.35)');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) if (i === 0 || i === 3 || j === 0 || j === 4) this.block(px + i * 8, py + j * 8, '#2a1d3f', '#3b2b57', '#140c22');
    for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) { const v = Math.sin((x + y) * 0.6 - t * 3) * 0.5 + 0.5; this.R(px + 8 + x, py + 8 + y, 1, 1, `rgb(${140 + v * 80 | 0},${40 + v * 40 | 0},${210 + v * 40 | 0})`); }
  }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
}

// ---------------- 메인 화면 ----------------
UI.prototype.showMain = function () {
  document.body.classList.remove('playing', 'modal');
  this.modal = null;
  const ach = achBestLoad(), achTotal = typeof ACH_LIST !== 'undefined' ? ACH_LIST.length : 72;
  const rank = typeof achRank === 'function' ? achRank(ach.pts) : [0, '🌱 새싹'];
  const done = typeof cmLoad === 'function' ? cmLoad() : new Set(), cmTotal = typeof CM_LIST !== 'undefined' ? CM_LIST.length : 22;
  const cur = typeof cmCurrent === 'function' ? cmCurrent(done) : null, chDone = typeof cmChaptersDone === 'function' ? cmChaptersDone() : 0;
  const bot = typeof BOT_RANK !== 'undefined' ? BOT_RANK[Math.min(chDone, BOT_RANK.length - 1)] : { k: '새내기', css: '#7a8494' };
  const pct = (a, b) => Math.round(Math.min(1, a / Math.max(1, b)) * 100);
  const s = this.screen('menu-main', `
    <div class="mm-wrap">
      <div class="mm-hero"><canvas id="mm-art" width="384" height="160"></canvas>
        <div class="mm-tags"><span>🤖 코딩으로 짓기</span><span>🏆 도전 과제 ${achTotal}개</span><span>🎓 코딩 마스터 ${cmTotal}단계</span><span>🐉 엔더 드래곤</span></div></div>
      <div class="mm-title"><h1 class="logo">에듀 <em>크래프트</em></h1>
        <p class="logo-sub">캐고, 짓고, <b>코딩</b>하며 도전 과제를 깨요. 빌더봇에게 명령을 짜 줄수록 내 <b>코딩 실력</b>이 자라요!</p></div>
      <div class="mm-prog">
        <button class="mm-card ach" id="m-ach"><span class="mi">🏆</span><span class="mt"><span class="mk">나의 도전 과제</span><b>${esc(rank[1])} · ${ach.n} / ${achTotal}</b>
          <span class="mbar"><i style="width:${pct(ach.n, achTotal)}%"></i></span><span class="md">세계에서 과제를 깰 때마다 보상과 새 칭호! (가장 많이 깬 세계 기준)</span></span></button>
        <button class="mm-card code" id="m-cm"><span class="mi">🎓</span><span class="mt"><span class="mk">코딩 마스터 · 빌더봇 <span class="mrank" style="color:${bot.css}">${esc(bot.k)}</span></span><b>${done.size} / ${cmTotal} 단계</b>
          <span class="mbar"><i style="width:${pct(done.size, cmTotal)}%"></i></span><span class="md">${cur ? '다음 단계: 「' + esc(cur[2]) + '」 · 게임 안에서 B → 🎓' : '🏅 모든 단계를 깼어요! 디지털 배지를 받아 보세요'}</span></span></button>
      </div>
      <div class="mm-start">
        <button class="btn primary mm-cont" id="m-cont" style="display:none">▶ 이어하기</button>
        <button class="topic-card survive" data-quick="survival"><span class="ti">⛏</span><span class="tx"><span class="tc">새 세계</span><b>서바이벌</b><span class="td">자원이 풍부한 세계! 재료를 얻을 때마다 코딩 블록이 열려요.</span></span></button>
        <button class="topic-card create" data-quick="creative"><span class="ti">✨</span><span class="tx"><span class="tc">새 세계 · 평지</span><b>크리에이티브</b><span class="td">넓은 평지에서 모든 블록과 코딩 블록으로 마음껏 지어요.</span></span></button>
      </div>
      <div class="row mm-more">
        <button class="btn small" id="m-single">🌍 세계 고르기</button>
        <button class="btn blue small" id="m-multi">🤝 함께 하기</button>
        <button class="btn small av-btn" id="m-avatar"><img class="av-face" id="m-face" alt="">아바타</button>
        <button class="btn small" id="m-settings">⚙ 설정</button>
        <button class="btn small" id="m-help">📖 도움말</button>
        ${canOpenNewWindow() ? '<button class="btn small" id="m-newwin">↗ 새 창</button>' : ''}
      </div>
    </div>
    <div class="ver">에듀 크래프트 ${VERSION} · CC0 오픈 코드 · 그림과 소리는 모두 코드로 만들었어요</div>`, 'menu-bg');
  if (this._menuArt) this._menuArt.stop();
  this._menuArt = new MenuArt($('#mm-art', s));
  $('#m-single', s).onclick = () => this.showWorlds();
  $$('.topic-card', s).forEach(btn => btn.onclick = async () => {
    const mode = btn.dataset.quick, flat = mode === 'creative';
    const id = 'w' + Date.now();
    const rec = { id, name: (flat ? '크리에이티브 ' : '서바이벌 ') + new Date().toLocaleDateString('ko-KR'), seed: (Math.random() * 2147483647) | 0, type: flat ? 'flat' : 'normal', mode, created: Date.now(), played: Date.now(), rules: { peaceful: flat } };
    try { await DB.put(rec); } catch (e) { }
    this.g.startWorld({ id, name: rec.name, seed: rec.seed, type: rec.type, mode, rules: rec.rules });
  });
  const goWorlds = () => this.showWorlds();
  $('#m-ach', s).onclick = goWorlds;
  $('#m-cm', s).onclick = () => this.toast('🎓 코딩 마스터는 게임 안에서 B(🤖 블록 코딩) → 🎓 단추로 도전해요. 아무 세계나 들어가 보세요!', 4000);
  $('#m-multi', s).onclick = () => this.showMulti();
  if ($('#m-newwin', s)) $('#m-newwin', s).onclick = () => openInNewWindow();
  $('#m-avatar', s).onclick = () => this.openAvatar(() => this.showMain());
  this.fillFace($('#m-face', s));
  $('#m-settings', s).onclick = () => this.showSettings(() => this.showMain());
  $('#m-help', s).onclick = () => this.showHelp(() => this.showMain());
  this.show('menu-main');
  // 이어하기: 가장 최근에 한 세계
  DB.list().then(list => {
    const w = (list || []).filter(x => x && x.id).sort((a, b) => (b.played || 0) - (a.played || 0))[0];
    const b = $('#m-cont', s); if (!w || !b) return;
    b.style.display = ''; b.innerHTML = `▶ 이어하기 <small>${esc(w.name)}</small>`;
    b.onclick = async () => { const rec = await DB.get(w.id); if (rec) this.g.startWorld({ id: w.id, rec }); };
  }).catch(() => { });
};
