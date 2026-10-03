'use strict';
// =====================================================================
// 입력: 키보드/마우스 (노트북) + 터치 컨트롤 (모바일)
// =====================================================================
const LOOK_NAMES = { lock: '🔒 화면 고정', follow: '🖱 따라보기', drag: '✋ 끌어서 보기' };
// 구글 사이트처럼 다른 페이지 안에 삽입(iframe)되어 열렸는지
const EMBEDDED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const LOCK_BLOCKED_KEY = 'educraft.lockBlocked';
// 새 창으로 열 수 있는 주소인지 (http/https 주소일 때만)
const canOpenNewWindow = () => EMBEDDED && /^https?:/.test(location.href);
function openInNewWindow() { try { window.open(location.href, '_blank', 'noopener'); } catch (e) { } }
class Input {
  constructor(game, canvas) {
    this.g = game; this.canvas = canvas;
    this.keys = Object.create(null);
    this.s = { moveF: 0, moveS: 0, jump: false, sneak: false, sprint: false, autoJump: false, attack: false, use: false };
    this.ev = { use: false, attack: false, pick: false, sneakPress: false, drop: false, dropAll: false };
    this.lookDX = 0; this.lookDY = 0;
    this.touch = isTouchDevice();
    this.locked = false;
    // 마우스 시점 방식 — 'lock': 화면 고정(클릭하면 마우스가 잠기고 움직이는 대로 시야 회전)
    //                    'follow': 따라보기(잠그지 않고 마우스만 움직여도 회전, 화면 끝에 닿으면 계속 회전)
    //                    'drag': 끌어서 보기(누른 채 끌면 회전)
    // 설정의 lookMode가 'auto'면 'lock'으로 시작하고, 고정이 안 되는 환경이면 'follow'로 바꿔요.
    this.lookMode = 'lock';
    this.lockFails = 0; this.lockToken = 0; this.lockPending = false; this.lockTimer = null;
    this.drag = null;
    this.mouseIn = false; this.mx = 0; this.my = 0;
    this.lastSpace = 0; this.lastW = 0; this.sprintLatch = false;
    this.joy = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
    this.lookT = new Map();
    this.tBreak = false; this.tUse = false; this.tJump = false; this.tSneak = false; this.tFlyDown = false;
    this.bind();
    if (this.touch) this.buildTouch();
  }
  playing() { return this.g.state === 'play' && !this.g.ui.modal; }
  bind() {
    const c = this.canvas;
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.s.attack = this.s.use = false; });
    const fromTouch = e => !!(e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents);
    c.addEventListener('mousedown', e => {
      if (fromTouch(e)) return;
      if (this.touch) this.setTouch(false);   // 터치 화면 노트북에서 마우스를 쓰면 마우스 조작으로 전환
      if (!this.playing()) return;
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
      if (this.lookMode === 'lock' && !this.locked) { this.requestLock(); return; }   // 첫 클릭은 고정만
      if (this.lookMode === 'drag' && !this.locked) {
        // 끌어서 둘러보기: 조금 움직이면 시점 이동, 그냥 누르면 부수기/놓기
        this.drag = { btn: e.button, moved: 0 };
        return;
      }
      this.pressButton(e.button, e);
    });
    window.addEventListener('mouseup', e => {
      const d = this.drag;
      if (d && d.btn === e.button) {
        this.drag = null;
        if (d.moved < 6) { this.pressButton(e.button, e); }
      }
      if (e.button === 0) this.s.attack = false; else if (e.button === 2) this.s.use = false;
    });
    c.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('contextmenu', e => { if (this.g.state === 'play') e.preventDefault(); });
    c.addEventListener('mouseenter', () => { this.mouseIn = true; });
    c.addEventListener('mouseleave', () => { this.mouseIn = false; });
    window.addEventListener('mousemove', e => {
      this.mx = e.clientX; this.my = e.clientY;
      if (!this.playing() || fromTouch(e)) return;
      const mx = e.movementX || 0, my = e.movementY || 0;
      // 크롬(윈도우)은 고정 직후나 창에 다시 들어올 때 아주 큰 값이 한 번 들어올 때가 있어 걸러 냅니다
      if (Math.abs(mx) > 300 || Math.abs(my) > 300) return;
      if (this.locked) { this.lookDX += mx; this.lookDY += my; }
      else if (this.lookMode === 'follow') { if (e.target === c) { this.mouseIn = true; this.lookDX += mx * 1.15; this.lookDY += my * 1.15; } }
      else if (this.drag) {
        this.drag.moved += Math.abs(mx) + Math.abs(my);
        if (this.drag.moved >= 6) { this.lookDX += mx; this.lookDY += my; }
      }
    });
    // 터치 화면이 있는 윈도우 PC: 터치 조작 레이어(#t-look)가 마우스 입력을 가로채므로, 창 전체에서 진짜 마우스가 감지되면 마우스 조작으로 바꿔요
    const onMouseish = e => { if (this.touch && e.pointerType === 'mouse' && performance.now() - (this.lastTouchT || 0) > 700) this.setTouch(false); };
    window.addEventListener('pointermove', onMouseish, true);
    window.addEventListener('pointerdown', onMouseish, true);
    window.addEventListener('touchstart', () => { this.lastTouchT = performance.now(); if (!this.touch && this.g.state === 'play' && isTouchDevice()) this.setTouch(true); }, { passive: true, capture: true });
    window.addEventListener('touchend', () => { this.lastTouchT = performance.now(); }, { passive: true, capture: true });
    window.addEventListener('wheel', e => {
      if (!this.playing()) return;
      const d = Math.sign(e.deltaY);
      if (d) { this.g.selectSlot((this.g.player.sel + d + 9) % 9); }
    }, { passive: true });
    document.addEventListener('pointerlockerror', () => { if (this.lockFailNow) this.lockFailNow('pointerlockerror', !this.lockEverWorked); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) {
        clearTimeout(this.lockTimer); this.lockPending = false; this.lockFailNow = null; this.lockEverWorked = true;
        if (EMBEDDED) { try { localStorage.removeItem(LOCK_BLOCKED_KEY); } catch (e) { } }
        this.lockFails = 0; this.drag = null; this.lookDX = this.lookDY = 0;
        if (this.lookMode !== 'lock') this.lookMode = 'lock';
      }
      if (!this.locked && this.g.state === 'play' && !this.g.ui.modal && !this.touch && !this.suppressPause && this.lookMode === 'lock') this.g.ui.openPause();
      this.suppressPause = false;
    });
    window.addEventListener('blur', () => { this.mouseIn = false; this.drag = null; });
  }
  pressButton(btn, e) {
    if (btn === 0) { this.s.attack = true; this.ev.attack = true; }
    else if (btn === 2) { this.s.use = true; this.ev.use = true; }
    else if (btn === 1) { this.ev.pick = true; if (e) e.preventDefault(); }
  }
  // 터치 <-> 마우스 조작 전환 (터치 화면이 있는 윈도우 노트북 대응)
  setTouch(on) {
    if (this.touch === on) return;
    this.touch = on;
    if (on) { if (!document.getElementById('t-look')) this.buildTouch(); document.body.classList.add('touch'); this.releaseLock(); }
    else { document.body.classList.remove('touch'); this.joy.id = null; this.joy.dx = this.joy.dy = 0; this.tBreak = this.tUse = this.tJump = false; }
    this.applyLookClass();
  }
  // 설정에서 고른 시점 방식 적용 ('auto' | 'lock' | 'follow' | 'drag')
  setLookPref(pref) {
    this.lookPref = pref || 'auto';
    if (this.lookPref === 'auto' && EMBEDDED) { try { if (localStorage.getItem(LOCK_BLOCKED_KEY) === '1') this.autoFallback = true; } catch (e) { } }
    const m = this.lookPref === 'auto' ? (this.autoFallback ? 'follow' : 'lock') : this.lookPref;
    this.setLookMode(m, true);
  }
  setLookMode(m, quiet) {
    this.lookMode = m; this.drag = null; this.lockFails = 0;
    if (m !== 'lock') this.releaseLock();
    this.applyLookClass();
    if (!quiet && this.g.ui) this.g.ui.toast(LOOK_NAMES[m] + ' 방식으로 바꿨어요', 2200);
  }
  applyLookClass() {
    document.body.classList.toggle('look-follow', !this.touch && this.lookMode === 'follow');
    document.body.classList.toggle('look-drag', !this.touch && this.lookMode === 'drag');
  }
  cycleLookMode() {
    const order = ['lock', 'follow', 'drag'];
    const m = order[(order.indexOf(this.lookMode) + 1) % order.length];
    this.g.settings.lookMode = m; this.g.saveSettings && this.g.saveSettings();
    this.lookPref = m; this.setLookMode(m);
    if (m === 'lock' && this.playing()) this.requestLock();
  }
  onLockFail(reason, hard) {
    this.lockFails++;
    const auto = (this.lookPref || 'auto') === 'auto';
    // 조용히 무시되거나(시간 초과), 이 창에서 고정이 아예 안 되거나, 세 번 연속 실패하면 따라보기로 바꿔요
    if (auto && (hard || this.lockFails >= 3)) {
      this.autoFallback = true;
      this.setLookMode('follow', true);
      if (EMBEDDED) { try { localStorage.setItem(LOCK_BLOCKED_KEY, '1'); } catch (e) { } }
      this.g.ui && this.g.ui.toast(EMBEDDED && canOpenNewWindow()
        ? '이 사이트 안에서는 마우스 고정이 막혀 있어요. 「따라보기」로 바꿨어요 — 마우스를 움직이면 시야가 돌아가요. 고정을 쓰려면 왼쪽 아래 「↗ 새 창」을 누르세요'
        : '이 화면에서는 마우스 고정이 안 돼요. 「따라보기」로 바꿨어요 — 마우스를 움직이면 시야가 돌아가요', 6000);
    } else if (this.g.ui && hard) {
      this.g.ui.toast('이 화면에서는 「화면 고정」이 안 돼요. V 키를 눌러 「따라보기」로 바꿔 주세요', 4000);
    } else if (this.g.ui) {
      this.g.ui.toast('마우스 고정이 잠깐 막혔어요. 1초 뒤에 화면을 다시 클릭해 주세요 (Esc를 누른 직후에는 크롬이 잠시 막아요)', 3500);
    }
  }
  requestLock() {
    if (this.touch || this.locked || this.lookMode !== 'lock' || this.lockPending) return;
    if (!this.canvas.requestPointerLock) { this.onLockFail('unsupported', true); return; }
    const token = ++this.lockToken;
    this.lockPending = true;
    let done = false;
    const fail = (why, hard) => {
      if (done || token !== this.lockToken) return;
      done = true; this.lockPending = false; this.lockFailNow = null; clearTimeout(this.lockTimer);
      if (this.locked) return;
      this.lastLockError = why;
      this.onLockFail(why, hard);
    };
    this.lockFailNow = fail;
    // 크롬이 성공도 실패도 알려 주지 않는 경우(임베드된 창 등)를 대비한 시간 제한
    clearTimeout(this.lockTimer);
    this.lockTimer = setTimeout(() => fail('timeout', true), 1200);
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.then) p.then(() => { }, err => {
        const n = err && err.name;
        // WrongDocument/NotSupported = 이 창에서는 고정 불가, SecurityError = Esc 직후 잠깐 막힘
        fail(n || 'rejected', !this.lockEverWorked || n === 'WrongDocumentError' || n === 'NotSupportedError');
      });
    } catch (e) { fail('throw', true); }
  }
  // 매 프레임: 따라보기 모드의 화면 가장자리 회전 + 방향키 시점
  frameLook(dt) {
    if (!this.playing()) return;
    const k = this.keys, rate = 900 * dt;   // 방향키: 초당 약 110°
    if (k.ArrowLeft) this.lookDX -= rate; if (k.ArrowRight) this.lookDX += rate;
    if (k.ArrowUp) this.lookDY -= rate * 0.7; if (k.ArrowDown) this.lookDY += rate * 0.7;
    if (!this.touch && !this.locked && this.lookMode === 'follow' && this.mouseIn) {
      const W = window.innerWidth, H = window.innerHeight, edge = Math.max(36, Math.min(W, H) * 0.06);
      const ex = this.mx < edge ? -(1 - this.mx / edge) : this.mx > W - edge ? (1 - (W - this.mx) / edge) : 0;
      const ey = this.my < edge ? -(1 - this.my / edge) : this.my > H - edge ? (1 - (H - this.my) / edge) : 0;
      this.lookDX += ex * 1100 * dt; this.lookDY += ey * 700 * dt;
    }
  }
  releaseLock() { this.lockToken++; this.lockPending = false; clearTimeout(this.lockTimer); if (document.pointerLockElement) { this.suppressPause = true; document.exitPointerLock(); } }
  onKey(e, down) {
    const g = this.g;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (document.activeElement && document.activeElement.isContentEditable);
    if (typing) {
      if (down && e.code === 'Escape') { document.activeElement.blur(); if (g.ui.chatOpen) g.ui.closeChat(); }
      return;
    }
    const code = e.code;
    if (down && g.state === 'play') {
      if (code === 'F1' || code === 'F3' || code === 'F5' || code === 'Tab' || code.startsWith('Arrow') || code === 'Space') e.preventDefault();
      if (code === 'Escape') {
        if (g.ui.modal) { g.ui.closeModal(); e.preventDefault(); return; }
        // 마우스 고정이 아닐 때(따라보기·끌어보기)도 Esc로 메뉴 열기 (고정 중이면 고정 풀림 이벤트가 엶)
        if (!this.locked && !g.player.dead) { e.preventDefault(); g.ui.openPause(); return; }
      }
      if (g.ui.modal) {
        if (code === 'KeyE' && g.ui.modal !== 'code' && g.ui.modal !== 'pause' && g.ui.modal !== 'settings' && g.ui.modal !== 'avatar') g.ui.closeModal();
        if (g.ui.modal === 'inv' || g.ui.modal === 'container') {
          if (code.startsWith('Digit')) { const n = +code.slice(5); if (n >= 1 && n <= 9) g.ui.hotkeySwap(n - 1); }
        }
        return;
      }
      if (!e.repeat) {
        switch (code) {
          case 'KeyE': g.ui.openInventory(); return;
          case 'KeyT': case 'Enter': e.preventDefault(); g.ui.openChat(''); return;
          case 'Slash': e.preventDefault(); g.ui.openChat('/'); return;
          case 'KeyB': g.ui.openCode(); return;
          case 'KeyP': g.ui.openPause(); return;
          case 'KeyL': if (g.ui.showAdvancements) g.ui.showAdvancements(); return;
          case 'KeyQ': this.ev.drop = true; this.ev.dropAll = e.ctrlKey; return;
          case 'KeyV': this.cycleLookMode(); return;
          case 'F1': g.settings.hideHud = !g.settings.hideHud; g.ui.applyHudVisibility(); return;
          case 'F3': g.settings.debug = !g.settings.debug; return;
          case 'F5': g.view = (g.view + 1) % 3; return;
          case 'Space': {
            const now = performance.now();
            if (g.player.creative && now - this.lastSpace < 300) { g.player.flying = !g.player.flying; g.player.vy = 0; this.lastSpace = 0; }
            else this.lastSpace = now;
            break;
          }
          case 'KeyW': { const now = performance.now(); if (now - this.lastW < 280) this.sprintLatch = true; this.lastW = now; break; }
          case 'ShiftLeft': case 'ShiftRight': this.ev.sneakPress = true; break;
          case 'KeyF': g.ui.toggleRsOverlay && g.ui.toggleRsOverlay(); return;
        }
        if (code.startsWith('Digit')) { const n = +code.slice(5); if (n >= 1 && n <= 9) g.selectSlot(n - 1); }
      }
    }
    if (down && g.state !== 'play' && code === 'Escape' && g.ui.modal) { g.ui.closeModal(); }
    this.keys[code] = down;
    if (code === 'KeyW' && !down) this.sprintLatch = false;
  }
  poll() {
    const k = this.keys, s = this.s;
    let f = 0, st = 0;
    if (k.KeyW) f += 1; if (k.KeyS) f -= 1;
    if (k.KeyD) st += 1; if (k.KeyA) st -= 1;
    if (this.joy.id !== null) {
      f += -this.joy.dy; st += this.joy.dx;
    }
    s.moveF = clamp(f, -1, 1); s.moveS = clamp(st, -1, 1);
    s.jump = !!k.Space || this.tJump;
    s.sneak = !!(k.ShiftLeft || k.ShiftRight) || this.tSneak || this.tFlyDown;
    s.sneakPress = this.ev.sneakPress;   // 수레·동물에서 내리기 (예전에는 전달이 안 돼서 Shift로 못 내렸음)
    s.sprint = !!(k.ControlLeft || k.ControlRight) || this.sprintLatch || (this.joy.id !== null && this.joy.dy < -0.92);
    s.autoJump = this.touch && this.g.settings.autoJump !== false;
    if (this.tBreak) s.attack = true;
    if (this.tUse) s.use = true;
    if (!this.playing()) { s.moveF = s.moveS = 0; s.jump = false; s.attack = false; s.use = false; }
    return s;
  }
  consume() { const e = this.ev; e.use = e.attack = e.pick = e.sneakPress = e.drop = e.dropAll = false; }

  // ---------------- 터치 컨트롤 ----------------
  buildTouch() {
    document.body.classList.add('touch');
    const ui = document.getElementById('touch-ui');
    ui.innerHTML = `
      <div id="t-look"></div>
      <div id="t-joyzone"><div id="t-joy"><div id="t-knob"></div></div></div>
      <div class="tbtn" id="t-jump" title="점프">⤒</div>
      <div class="tbtn small" id="t-sneak" title="웅크리기">⇩</div>
      <div class="tbtn" id="t-break" title="부수기(누르고 있기)">⛏</div>
      <div class="tbtn" id="t-use" title="놓기/사용">✋</div>
      <div class="tbtn small" id="t-flydown" title="아래로">▼</div>
      <div id="t-top">
        <div class="tbtn mini" id="t-pause">Ⅱ</div>
        <div class="tbtn mini" id="t-inv">🎒</div>
        <div class="tbtn mini" id="t-code">🤖</div>
        <div class="tbtn mini" id="t-chat">💬</div>
        <div class="tbtn mini" id="t-view">👁</div>
        <div class="tbtn mini" id="t-full">⛶</div>
      </div>`;
    const $ = id => document.getElementById(id);
    const g = this.g;
    // 조이스틱 (떠 있는 방식)
    const zone = $('t-joyzone'), joy = $('t-joy'), knob = $('t-knob');
    const R = 56;
    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (this.joy.id !== null) return;
      this.joy.id = t.identifier; this.joy.x = t.clientX; this.joy.y = t.clientY; this.joy.dx = 0; this.joy.dy = 0;
      const zr = zone.getBoundingClientRect();
      joy.style.left = (t.clientX - zr.left) + 'px'; joy.style.top = (t.clientY - zr.top) + 'px'; joy.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
    }, { passive: false });
    const joyMove = e => {
      for (const t of e.changedTouches) if (t.identifier === this.joy.id) {
        let dx = t.clientX - this.joy.x, dy = t.clientY - this.joy.y;
        const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
        this.joy.dx = dx / R; this.joy.dy = dy / R;
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        e.preventDefault();
      }
    };
    const joyEnd = e => { for (const t of e.changedTouches) if (t.identifier === this.joy.id) { this.joy.id = null; this.joy.dx = this.joy.dy = 0; joy.classList.remove('on'); } };
    zone.addEventListener('touchmove', joyMove, { passive: false });
    zone.addEventListener('touchend', joyEnd); zone.addEventListener('touchcancel', joyEnd);
    // 시점 + 탭(사용) + 길게 누르기(부수기)
    const look = $('t-look');
    look.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) this.lookT.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now(), moved: 0, hold: false, timer: setTimeout(() => {
        const L = this.lookT.get(t.identifier); if (L && L.moved < 14) { L.hold = true; this.tBreak = true; this.ev.attack = true; }
      }, 320) });
    }, { passive: false });
    look.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const L = this.lookT.get(t.identifier); if (!L) continue;
        const dx = t.clientX - L.x, dy = t.clientY - L.y;
        L.moved += Math.abs(dx) + Math.abs(dy);
        L.x = t.clientX; L.y = t.clientY;
        if (this.playing()) { this.lookDX += dx * 2.2; this.lookDY += dy * 2.2; }
      }
    }, { passive: false });
    const lookEnd = e => {
      for (const t of e.changedTouches) {
        const L = this.lookT.get(t.identifier); if (!L) continue;
        clearTimeout(L.timer);
        if (L.hold) this.tBreak = false;
        else if (L.moved < 14 && performance.now() - L.t0 < 320 && this.playing()) this.ev.use = true;
        this.lookT.delete(t.identifier);
      }
      if (![...this.lookT.values()].some(L => L.hold)) this.tBreak = false;
    };
    look.addEventListener('touchend', lookEnd); look.addEventListener('touchcancel', lookEnd);
    const hold = (id, on, off) => {
      const el = $(id);
      el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); on(); }, { passive: false });
      const end = e => { e.preventDefault(); el.classList.remove('down'); off && off(); };
      el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    };
    hold('t-jump', () => {
      const now = performance.now();
      if (g.player.creative && now - this.lastSpace < 300) { g.player.flying = !g.player.flying; g.player.vy = 0; this.lastSpace = 0; }
      else this.lastSpace = now;
      this.tJump = true;
    }, () => { this.tJump = false; });
    hold('t-sneak', () => { this.tSneak = !this.tSneak; $('t-sneak').classList.toggle('active', this.tSneak); this.ev.sneakPress = true; });
    hold('t-flydown', () => { this.tFlyDown = true; }, () => { this.tFlyDown = false; });
    hold('t-break', () => { this.tBreak = true; this.ev.attack = true; }, () => { this.tBreak = false; });
    hold('t-use', () => { this.tUse = true; this.ev.use = true; }, () => { this.tUse = false; });
    hold('t-pause', () => g.ui.openPause());
    hold('t-inv', () => g.ui.openInventory());
    hold('t-code', () => g.ui.openCode());
    hold('t-chat', () => g.ui.openChat(''));
    hold('t-view', () => { g.view = (g.view + 1) % 3; });
    const fullEl = document.documentElement;
    if (!(fullEl.requestFullscreen || fullEl.webkitRequestFullscreen)) $('t-full').style.display = 'none';
    hold('t-full', () => {
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { const p = (fullEl.requestFullscreen || fullEl.webkitRequestFullscreen).call(fullEl); if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => { }); }
      } catch (e) { }
    });
  }
  updateTouchUI() {
    if (!this.touch) return;
    const fd = document.getElementById('t-flydown');
    if (fd) fd.style.display = this.g.player.flying ? '' : 'none';
  }
}
