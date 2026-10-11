'use strict';
// =====================================================================
// 아바타 꾸미기 화면
//  - 🎀 캐릭터 만들기: 고르기만 하면 스킨 완성
//  - ✏️ 도트 그리기: 전개도(64x64 스킨)나 3D 모델 위에 한 칸씩 칠하기
//  - 💎 소품: 리본·귀·날개 같은 입체 소품
//  - 📁 저장함: 여러 아바타 보관, 마인크래프트 스킨 PNG 내보내기/불러오기
// =====================================================================
const AV_PALETTE = [
  '#ffffff', '#f5f1ee', '#c9c3cc', '#8a8494', '#3a3a44', '#1f1b24',
  '#ffe3d3', '#f9d2bb', '#efbf9e', '#dca47f', '#bb7f58', '#8a5a3c',
  '#ffd6e2', '#ffb3c8', '#ff8fb1', '#f06a7a', '#d4507e', '#b0305a',
  '#ffe4c9', '#ffc9a3', '#ffb37d', '#f39a60', '#ffe08a', '#ffd84a',
  '#dff7e8', '#a8e6c4', '#8fe0c4', '#6fcf97', '#3b8a5c', '#2d6b4a',
  '#dcefff', '#9fd0ff', '#7fb2f0', '#4d7fd0', '#2f4a8a', '#26345e',
  '#efe6ff', '#c7aef5', '#b89cf0', '#9b7fe0', '#8a44b8', '#5a2d80',
  '#f3d27a', '#c9a06a', '#7a4a2e', '#4a2e24', '#2e2733', '#000000',
];
const AV_SLOTS_MAX = 8;

// ---------------- 미리보기 3D ----------------
const AVV_SKIN_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos; layout(location=1) in vec3 a_nrm; layout(location=2) in vec2 a_uv; layout(location=3) in float a_layer; layout(location=4) in vec2 a_light; layout(location=5) in vec3 a_tint;
uniform mat4 u_vp;
out vec3 v_nrm; out vec2 v_uv; flat out float v_layer;
void main(){ v_nrm = a_nrm; v_uv = a_uv; v_layer = a_layer; gl_Position = u_vp * vec4(a_pos, 1.0); }`;
const AVV_SKIN_FS = `#version 300 es
precision highp float; precision highp sampler2D;
in vec3 v_nrm; in vec2 v_uv; flat in float v_layer;
uniform sampler2D u_tex; uniform vec2 u_hover; uniform float u_overA; uniform float u_grid; uniform float u_time;
out vec4 o_col;
void main(){
  bool base = v_layer > 999.5;
  vec4 t = texture(u_tex, v_uv);
  if (!base && t.a < 0.5) discard;
  vec3 N = normalize(v_nrm);
  float lam = max(dot(N, normalize(vec3(-0.35, 0.8, -0.55))), 0.0);
  float fill = max(dot(N, normalize(vec3(0.7, 0.1, 0.6))), 0.0);
  vec3 col = t.rgb * (0.6 + 0.4 * lam + 0.12 * fill);
  vec2 tx = floor(v_uv * 64.0);
  if (tx.x == u_hover.x && tx.y == u_hover.y) col = mix(col, vec3(1.0), 0.45 + 0.2 * sin(u_time * 9.0));
  if (u_grid > 0.5) { vec2 f = fract(v_uv * 64.0); float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)); if (e < 0.05) col *= 0.8; }
  o_col = vec4(col, base ? 1.0 : u_overA);
}`;
const AVV_COL_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos; layout(location=1) in vec3 a_nrm; layout(location=2) in vec3 a_col;
uniform mat4 u_vp;
out vec3 v_nrm; out vec3 v_col;
void main(){ v_nrm = a_nrm; v_col = a_col; gl_Position = u_vp * vec4(a_pos, 1.0); }`;
const AVV_COL_FS = `#version 300 es
precision highp float;
in vec3 v_nrm; in vec3 v_col;
out vec4 o_col;
void main(){
  vec3 N = normalize(v_nrm);
  float lam = max(dot(N, normalize(vec3(-0.35, 0.8, -0.55))), 0.0);
  float fill = max(dot(N, normalize(vec3(0.7, 0.1, 0.6))), 0.0);
  o_col = vec4(v_col * (0.6 + 0.4 * lam + 0.12 * fill), 1.0);
}`;

class AvatarView {
  constructor(canvas) {
    this.cv = canvas;
    this.yaw = 0.45; this.pitch = 0.12; this.zoom = 1; this.walk = false;
    this.hover = [-1, -1]; this.overA = 1; this.showOver = true; this.grid = false;
    this.sbBase = new SkinBatch(); this.sbOver = new SkinBatch(); this.eb = new EntityBatch();
    this.vp = M4.create(); this.M = null;
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false });
    this.gl = gl;
    if (!gl) return;
    const mk = (vs, fs) => {
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name] = gl.getUniformLocation(p, inf.name); }
      return { p, u };
    };
    this.ps = mk(AVV_SKIN_VS, AVV_SKIN_FS); this.pc = mk(AVV_COL_VS, AVV_COL_FS);
    const es = 56;
    const vao = (layout) => {
      const v = gl.createVertexArray(), b = gl.createBuffer();
      gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      for (const [loc, n, off] of layout) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, es, off); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bindVertexArray(null);
      return { v, b };
    };
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    const Q = 4096, idx = new Uint32Array(Q * 6);
    for (let i = 0; i < Q; i++) { idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); }
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.vSkin = vao([[0, 3, 0], [1, 3, 12], [2, 2, 24], [3, 1, 32], [4, 2, 36], [5, 3, 44]]);
    this.vCol = vao([[0, 3, 0], [1, 3, 12], [2, 3, 24]]);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  upload(px) {
    const gl = this.gl; if (!gl) return;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(px.buffer.slice(0)));
  }
  camera() {
    const cv = this.cv, w = cv.width || 1, h = cv.height || 1;
    const proj = M4.create(), view = M4.create();
    const fov = 32 * Math.PI / 180, tf = Math.tan(fov / 2), asp = w / h;
    M4.perspective(proj, fov, asp, 0.1, 50);
    // 화면 모양에 맞춰 전신이 들어오는 거리 × 확대
    const dist = Math.max(1.42 / tf, 0.95 / (tf * asp)) * this.zoom;
    const cy = 1.08 + Math.max(0, 1 - this.zoom) * 0.8, cp = Math.cos(this.pitch);
    const eye = [Math.sin(this.yaw) * cp * dist, cy + Math.sin(this.pitch) * dist, -Math.cos(this.yaw) * cp * dist];
    M4.lookAt(view, eye, [0, cy, 0], [0, 1, 0]);
    M4.mul(this.vp, proj, view);
  }
  draw(slim, acc, t) {
    const gl = this.gl, cv = this.cv; if (!gl) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(cv.clientWidth * dpr)), H = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    this.camera();
    const pose = { sw: this.walk ? Math.sin(t * 5.5) * 0.6 : 0, time: t, speed: this.walk ? 1 : 0, walk: t * 5.5, armsOut: 0.07, headPitch: this.walk ? 0 : Math.sin(t * 0.8) * 0.04 };
    const base = M4.create();
    if (this.walk) base[13] = Math.abs(Math.sin(t * 5.5)) * 0.03;
    const M = this.M = avatarMatrices(base, pose, slim);
    const B = this.B = avatarBoxes(slim); this.slim = slim;
    this.sbBase.reset(); this.sbOver.reset(); this.eb.reset();
    for (const part of SKIN_PART_KEYS) {
      this.sbBase.addPart(M[part], part, 0, slim, B[part], 0, 1, 0, [1, 1, 1]);
      if (this.showOver) this.sbOver.addPart(M[part], part, 1, slim, inflateBox(B[part], (part === 'head' ? 0.5 : 0.25) / 16 + 0.0005), 0, 1, 0, [1, 1, 1]);
    }
    if (acc) renderAvatarAcc(this.eb, M, acc, pose, [1, 0], false);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const drawSkin = (sb) => {
      if (!sb.n) return;
      gl.useProgram(this.ps.p);
      gl.uniformMatrix4fv(this.ps.u.u_vp, false, this.vp);
      gl.uniform2f(this.ps.u.u_hover, this.hover[0], this.hover[1]);
      gl.uniform1f(this.ps.u.u_overA, this.overA);
      gl.uniform1f(this.ps.u.u_grid, this.grid ? 1 : 0);
      gl.uniform1f(this.ps.u.u_time, t);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(this.ps.u.u_tex, 0);
      gl.bindVertexArray(this.vSkin.v); gl.bindBuffer(gl.ARRAY_BUFFER, this.vSkin.b);
      gl.bufferData(gl.ARRAY_BUFFER, sb.f32.subarray(0, sb.n * 14), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, sb.n / 4 * 6, gl.UNSIGNED_INT, 0);
    };
    drawSkin(this.sbBase);
    if (this.eb.n) {
      gl.useProgram(this.pc.p); gl.uniformMatrix4fv(this.pc.u.u_vp, false, this.vp);
      gl.bindVertexArray(this.vCol.v); gl.bindBuffer(gl.ARRAY_BUFFER, this.vCol.b);
      gl.bufferData(gl.ARRAY_BUFFER, this.eb.f32.subarray(0, this.eb.n * 14), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, this.eb.n / 4 * 6, gl.UNSIGNED_INT, 0);
    }
    if (this.overA < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
    drawSkin(this.sbOver);
    gl.disable(gl.BLEND); gl.depthMask(true);
    gl.bindVertexArray(null);
  }
  // 화면 좌표 → 스킨 텍셀 [x, y] (over: 바깥 층 상자로 검사)
  pick(cx, cy, over) {
    if (!this.M) return null;
    const r = this.cv.getBoundingClientRect();
    const nx = (cx - r.left) / r.width * 2 - 1, ny = 1 - (cy - r.top) / r.height * 2;
    const inv = M4.invert(M4.create(), this.vp); if (!inv) return null;
    const un = (z) => { const v = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) v[i] = inv[i] * nx + inv[4 + i] * ny + inv[8 + i] * z + inv[12 + i]; return [v[0] / v[3], v[1] / v[3], v[2] / v[3]]; };
    const A = un(-1), Bp = un(1);
    let best = null;
    const tp = (m, p) => M4.transformPoint(m, p[0], p[1], p[2], [0, 0, 0]);
    for (const part of SKIN_PART_KEYS) {
      const mi = M4.invert(M4.create(), this.M[part]); if (!mi) continue;
      const o = tp(mi, A), f = tp(mi, Bp), d = [f[0] - o[0], f[1] - o[1], f[2] - o[2]];
      const box = over ? inflateBox(this.B[part], (part === 'head' ? 0.5 : 0.25) / 16) : this.B[part];
      let t0 = -Infinity, t1 = Infinity, ax = -1, sgn = 0;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-9) { if (o[k] < box[k] || o[k] > box[k + 3]) { t0 = Infinity; break; } continue; }
        let a = (box[k] - o[k]) / d[k], b = (box[k + 3] - o[k]) / d[k], s = d[k] > 0 ? 1 : -1;
        if (a > b) { const tt = a; a = b; b = tt; }
        if (a > t0) { t0 = a; ax = k; sgn = s; }
        if (b < t1) t1 = b;
      }
      if (t0 > t1 || t0 < 0 || ax < 0 || !isFinite(t0)) continue;
      if (!best || t0 < best.t) {
        const face = ax === 0 ? (sgn > 0 ? 'left' : 'right') : ax === 1 ? (sgn > 0 ? 'bottom' : 'top') : (sgn > 0 ? 'front' : 'back');
        best = { t: t0, part, face, box, p: [o[0] + d[0] * t0, o[1] + d[1] * t0, o[2] + d[2] * t0] };
      }
    }
    if (!best) return null;
    const C = skinFaceCorners(best.face, best.box), TL = C[0], TR = C[1], BL = C[3];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const u = sub(TR, TL), v = sub(BL, TL), q = sub(best.p, TL);
    const s = dot(q, u) / dot(u, u), tt = dot(q, v) / dot(v, v);
    const rc = skinFaceRect(best.part, best.face, over ? 1 : 0, this.slim);
    const ix = Math.max(0, Math.min(rc[2] - 1, Math.floor(s * rc[2]))), iy = Math.max(0, Math.min(rc[3] - 1, Math.floor(tt * rc[3])));
    return [rc[0] + ix, rc[1] + iy];
  }
}

// ---------------- 편집 화면 ----------------
class AvatarEditor {
  constructor(g) {
    this.g = g; this.open_ = false;
    this.tab = 'make'; this.tool = 'pen'; this.color = '#ff8fb1'; this.layer = 0; this.part = 'head'; this.mirror = true;
    this.undoS = []; this.redoS = [];
  }
  get isOpen() { return this.open_; }
  async open(onClose) {
    const g = this.g, ui = g.ui;
    this.onClose = onClose;
    const cur = g.avatar || defaultAvatar();
    let px = cur.pixels;
    if (!px) { try { px = await pngToPixels(cur.png); } catch (e) { px = composeSkin(AV_DEFAULT); } }
    this.px = new Uint8ClampedArray(px);
    this.slim = !!cur.slim;
    this.opts = Object.assign({}, AV_DEFAULT, cur.opts || {}, { slim: this.slim });
    this.acc = Object.assign({}, AV_ACC_DEFAULT, cur.acc || {});
    this.name = g.settings.name;
    this.undoS = []; this.redoS = []; this.painted = false;
    this.open_ = true;
    const s = ui.screen('avatar-screen', `
      <div class="av-wrap">
        <div class="av-head">
          <h2>👗 내 아바타 꾸미기</h2>
          <label class="av-name">닉네임 <input type="text" id="av-name" maxlength="16" value="${esc(this.name)}"></label>
          <span class="grow"></span>
          <button class="btn small" id="av-cancel">취소</button>
          <button class="btn primary small" id="av-save">✔ 저장하기</button>
        </div>
        <div class="av-main">
          <div class="av-stage">
            <canvas id="av-3d"></canvas>
            <div class="av-bar">
              <button class="btn small" data-view="0">앞</button><button class="btn small" data-view="1">옆</button><button class="btn small" data-view="2">뒤</button>
              <button class="btn small" id="av-walk">🚶 걷기</button>
              <button class="btn small" id="av-over">🧥 겉옷층</button>
              <button class="btn small" id="av-grid">▦ 칸</button>
            </div>
            <div class="av-tip" id="av-tip">끌어서 돌려 보기 · 휠이나 두 손가락으로 크게 보기</div>
          </div>
          <div class="av-panel">
            <div class="tabs" id="av-tabs"><button data-t="make">🎀 캐릭터 만들기</button><button data-t="paint">✏️ 도트 그리기</button><button data-t="acc">💎 소품</button><button data-t="file">📁 저장함</button></div>
            <div class="av-body" id="av-body"></div>
          </div>
        </div>
      </div>`, 'av-screen');
    ui.show('avatar-screen');
    this.s = s;
    this.view = new AvatarView($('#av-3d', s));
    if (!this.view.gl) $('#av-tip', s).textContent = '이 브라우저에서는 3D 미리보기를 쓸 수 없어요 (전개도는 쓸 수 있어요)';
    this.view.upload(this.px);
    $('#av-name', s).oninput = (e) => { this.name = e.target.value; };
    $('#av-cancel', s).onclick = () => this.close(false);
    $('#av-save', s).onclick = () => this.close(true);
    $$('#av-tabs button', s).forEach(b => b.onclick = () => this.setTab(b.dataset.t));
    $$('[data-view]', s).forEach(b => b.onclick = () => { this.view.yaw = [0, Math.PI / 2, Math.PI][+b.dataset.view]; this.view.pitch = 0.08; });
    $('#av-walk', s).onclick = (e) => { this.view.walk = !this.view.walk; e.currentTarget.classList.toggle('on', this.view.walk); };
    $('#av-over', s).onclick = (e) => { this.view.showOver = !this.view.showOver; e.currentTarget.classList.toggle('on', !this.view.showOver); };
    $('#av-grid', s).onclick = (e) => { this.view.grid = !this.view.grid; e.currentTarget.classList.toggle('on', this.view.grid); };
    this.bindStage($('#av-3d', s));
    this.setTab(this.tab);
    const loop = () => { if (!this.open_) return; this.frame(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    this.frame();
  }
  frame() {
    if (!this.view) return;
    this.view.overA = this.tab === 'paint' && this.layer === 0 && this.view.showOver ? 0.3 : 1;
    this.view.draw(this.slim, this.resolvedAcc(), performance.now() / 1000);
  }
  resolvedAcc() { const a = Object.assign({}, this.acc); if (!a.hairCol) a.hairCol = this.opts.hairCol; return a; }
  close(save) {
    const g = this.g;
    this.open_ = false; cancelAnimationFrame(this.raf);
    if (save) {
      const nm = String(this.name || '').trim().slice(0, 16);
      if (nm) { g.settings.name = nm; if (g.player) g.player.name = nm; g.saveSettings(); }
      g.setAvatar(makeAvatar(this.px, this.slim, this.resolvedAcc(), Object.assign({}, this.opts, { slim: this.slim })));
      g.ui.toast('👗 아바타를 저장했어요!', 1800);
    }
    if (this.view && this.view.gl) { const ext = this.view.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
    this.view = null;
    $('#avatar-screen').classList.remove('show');
    if (this.onClose) this.onClose(save);
  }
  // ---------- 되돌리기 ----------
  pushUndo() { this.undoS.push({ px: new Uint8ClampedArray(this.px), slim: this.slim, opts: Object.assign({}, this.opts) }); if (this.undoS.length > 60) this.undoS.shift(); this.redoS = []; }
  undo() { const u = this.undoS.pop(); if (!u) return; this.redoS.push({ px: new Uint8ClampedArray(this.px), slim: this.slim, opts: Object.assign({}, this.opts) }); this.restore(u); }
  redo() { const u = this.redoS.pop(); if (!u) return; this.undoS.push({ px: new Uint8ClampedArray(this.px), slim: this.slim, opts: Object.assign({}, this.opts) }); this.restore(u); }
  restore(u) { this.px = u.px; this.slim = u.slim; this.opts = u.opts; this.changed(); if (this.tab !== 'paint') this.setTab(this.tab); }
  changed() { if (this.view) this.view.upload(this.px); this.drawNet(); }
  // ---------- 캐릭터 만들기 ----------
  compose() {
    this.pushUndo();
    if (this.painted) { this.g.ui.toast('직접 그린 도트는 ↶ 되돌리기로 다시 살릴 수 있어요', 2600); this.painted = false; }
    this.slim = !!this.opts.slim;
    this.px = composeSkin(this.opts);
    this.changed();
  }
  setTab(t) {
    this.tab = t;
    const s = this.s, body = $('#av-body', s);
    $$('#av-tabs button', s).forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $('#av-tip', s).textContent = t === 'paint' ? '모델 위를 눌러 바로 칠하기 · 모델 밖을 끌면 돌리기' : '끌어서 돌려 보기 · 휠이나 두 손가락으로 크게 보기';
    if (t === 'make') body.innerHTML = this.makeHtml();
    else if (t === 'paint') { body.innerHTML = this.paintHtml(); this.bindPaint(); }
    else if (t === 'acc') body.innerHTML = this.accHtml();
    else if (t === 'file') { body.innerHTML = this.fileHtml(); this.bindFile(); }
    body.onclick = (e) => this.onBodyClick(e);
    body.oninput = (e) => this.onBodyInput(e);
  }
  chips(title, g, key, list, obj) {
    return `<div class="av-sec"><div class="av-lbl">${title}</div><div class="av-chips">${list.map(([v, n]) => `<button class="chip${obj[key] === v ? ' on' : ''}" data-g="${g}" data-k="${key}" data-v="${v}">${n}</button>`).join('')}</div></div>`;
  }
  swatches(title, g, key, cols, obj, allowNone) {
    const cur = String(obj[key] || '').toLowerCase();
    return `<div class="av-sec"><div class="av-lbl">${title}</div><div class="av-sw">${allowNone ? `<button class="sw none${!cur ? ' on' : ''}" data-g="${g}" data-k="${key}" data-v="" title="머리색과 같게">=</button>` : ''}${cols.map(c => `<button class="sw${cur === c ? ' on' : ''}" style="background:${c}" data-g="${g}" data-k="${key}" data-v="${c}"></button>`).join('')}<label class="sw pick" title="다른 색"><input type="color" data-g="${g}" data-k="${key}" value="${cur || '#ffffff'}">🎨</label></div></div>`;
  }
  makeHtml() {
    const o = this.opts, C = AV_OPTS;
    const pres = AV_PRESETS.map((p, i) => {
      if (!p._img) { const oo = Object.assign({}, AV_DEFAULT, p.o); p._img = skinBodyCanvas(composeSkin(oo), oo.slim, 3).toDataURL(); }
      return `<button class="av-pre" data-g="pre" data-v="${i}"><img src="${p._img}" alt=""><span>${p.n}</span></button>`;
    }).join('');
    return `<p class="av-note">고르기만 하면 캐릭터가 완성돼요! 더 꾸미고 싶으면 <b>✏️ 도트 그리기</b>에서 한 칸씩 칠해 보세요.</p>
      <div class="av-sec"><div class="av-lbl">예시 캐릭터</div><div class="av-pres">${pres}</div></div>
      ${this.chips('팔 굵기', 'o', 'slim', [[true, '가는 팔 (3칸)'], [false, '보통 팔 (4칸)']].map(([v, n]) => [String(v), n]), { slim: String(o.slim) })}
      ${this.swatches('피부색', 'o', 'skinTone', C.skinTone, o)}
      ${this.chips('머리 모양', 'o', 'hair', C.hair, o)}
      ${this.swatches('머리색', 'o', 'hairCol', C.hairCol, o)}
      ${this.chips('눈', 'o', 'eyes', C.eyes, o)}
      ${this.swatches('눈동자 색', 'o', 'eyeCol', C.eyeCol, o)}
      ${this.chips('입', 'o', 'mouth', C.mouth, o)}
      ${this.chips('볼터치', 'o', 'blush', [['true', '볼그레 ♥'], ['false', '없음']], { blush: String(o.blush) })}
      ${this.chips('얼굴 꾸미기', 'o', 'deco', C.deco, o)}
      ${this.chips('윗옷', 'o', 'top', C.top, o)}
      ${this.swatches('윗옷 색', 'o', 'topCol', C.cloth, o)}
      ${this.swatches('포인트 색 (무늬·깃·리본)', 'o', 'topCol2', C.cloth, o)}
      ${this.chips('아래옷', 'o', 'bottom', C.bottom, o)}
      ${this.swatches('아래옷 색', 'o', 'bottomCol', C.cloth, o)}
      ${this.chips('신발', 'o', 'shoes', C.shoes, o)}
      ${this.swatches('신발 색', 'o', 'shoeCol', C.cloth, o)}`;
  }
  accHtml() {
    const a = this.acc, C = AV_OPTS.cloth.concat(['#ffd84a', '#bfe8ff']);
    return `<p class="av-note">입체 소품은 게임 속 모습과 친구들 화면에도 보여요. (마인크래프트 스킨 파일에는 들어가지 않아요)</p>
      ${this.chips('머리 장식', 'a', 'head', AV_ACC.head, a)}
      ${this.swatches('장식 색', 'a', 'headCol', C, a)}
      ${this.chips('입체 머리카락', 'a', 'hair', AV_ACC.hair, a)}
      ${this.swatches('머리카락 색', 'a', 'hairCol', AV_OPTS.hairCol, a, true)}
      ${this.chips('치마', 'a', 'skirt', AV_ACC.skirt, a)}
      ${this.swatches('치마 색', 'a', 'skirtCol', C, a)}
      ${this.chips('등', 'a', 'back', AV_ACC.back, a)}
      ${this.swatches('등 소품 색', 'a', 'backCol', C, a)}`;
  }
  onBodyClick(e) {
    const b = e.target.closest('[data-g]'); if (!b || b.tagName === 'INPUT') return;
    const g = b.dataset.g, k = b.dataset.k, v = b.dataset.v;
    if (g === 'o') {
      this.opts[k] = v === 'true' ? true : v === 'false' ? false : v;
      this.compose(); this.refreshSel(b);
    } else if (g === 'a') { this.acc[k] = v; this.refreshSel(b); }
    else if (g === 'pre') {
      const p = AV_PRESETS[+v];
      this.opts = Object.assign({}, AV_DEFAULT, p.o); this.acc = Object.assign({}, AV_ACC_DEFAULT, p.a);
      this.compose(); this.g.ui.toast(`「${p.n}」 완성! 원하는 대로 바꿔 보세요`, 1800);
    } else if (g === 'tool') { this.tool = v; this.refreshSel(b); }
    else if (g === 'layer') { this.layer = +v; this.refreshSel(b); this.drawNet(); }
    else if (g === 'part') { this.part = v; this.refreshSel(b); this.drawNet(); }
    else if (g === 'col') { this.color = v; this.tool = this.tool === 'picker' || this.tool === 'eraser' ? 'pen' : this.tool; this.setTab('paint'); }
    else if (g === 'mirror') { this.mirror = !this.mirror; b.classList.toggle('on', this.mirror); }
    else if (g === 'undo') this.undo();
    else if (g === 'redo') this.redo();
  }
  onBodyInput(e) {
    const t = e.target; if (t.type !== 'color') return;
    const g = t.dataset.g, k = t.dataset.k;
    if (g === 'o') { this.opts[k] = t.value; clearTimeout(this._ct); this._ct = setTimeout(() => this.compose(), 60); }
    else if (g === 'a') this.acc[k] = t.value;
    else if (g === 'col') { this.color = t.value; const cur = $('#av-cur', this.s); if (cur) cur.style.background = t.value; }
  }
  refreshSel(b) {
    const grp = b.closest('.av-chips, .av-sw, .av-tools');
    if (grp) $$('.on', grp).forEach(x => { if (x.dataset.g !== 'mirror') x.classList.remove('on'); });
    b.classList.add('on');
  }
  // ---------- 도트 그리기 ----------
  paintHtml() {
    const parts = [['head', '머리'], ['body', '몸'], ['rarm', '오른팔'], ['larm', '왼팔'], ['rleg', '오른다리'], ['lleg', '왼다리'], ['all', '전체']];
    const tools = [['pen', '✏️ 연필'], ['eraser', '🧽 지우개'], ['fill', '🪣 채우기'], ['picker', '💧 색 찍기']];
    return `<div class="av-tools">${tools.map(([v, n]) => `<button class="chip${this.tool === v ? ' on' : ''}" data-g="tool" data-v="${v}">${n}</button>`).join('')}
        <button class="chip" data-g="undo">↶</button><button class="chip" data-g="redo">↷</button></div>
      <div class="av-tools"><button class="chip${this.layer === 0 ? ' on' : ''}" data-g="layer" data-v="0">🧍 안쪽 층 (피부·옷)</button><button class="chip${this.layer === 1 ? ' on' : ''}" data-g="layer" data-v="1">🧥 바깥 층 (머리카락·겉옷)</button>
        <button class="chip${this.mirror ? ' on' : ''}" data-g="mirror">🪞 좌우 대칭</button></div>
      <div class="av-tools">${parts.map(([v, n]) => `<button class="chip${this.part === v ? ' on' : ''}" data-g="part" data-v="${v}">${n}</button>`).join('')}</div>
      <div class="av-palette"><span class="av-cur" id="av-cur" style="background:${this.color}"></span>${AV_PALETTE.map(c => `<button class="sw${c === this.color ? ' on' : ''}" style="background:${c}" data-g="col" data-v="${c}"></button>`).join('')}<label class="sw pick" title="다른 색"><input type="color" data-g="col" value="${this.color}">🎨</label></div>
      <div class="av-netwrap"><canvas id="av-net"></canvas></div>
      <p class="av-note small">전개도는 상자를 펼친 그림이에요. <b>앞·뒤·옆·위·아래</b> 면이 3D 모델에 그대로 입혀져요. 바깥 층은 안쪽 층보다 살짝 크게 씌워져서 머리카락·모자·겉옷을 입체적으로 표현해요. 투명한 칸(체크무늬)은 안 보여요.</p>`;
  }
  netRegion() {
    if (this.part === 'all') return [0, 0, 64, 64];
    const P = skinPartDims(this.part, this.slim), u = this.layer ? P.ou : P.u, v = this.layer ? P.ov : P.v;
    return [u, v, 2 * P.d + 2 * P.w, P.d + P.h];
  }
  bindPaint() {
    const cv = $('#av-net', this.s); if (!cv) return;
    this.net = cv;
    const texel = (e) => {
      const r = cv.getBoundingClientRect(), R = this.netRegion();
      const x = R[0] + Math.floor((e.clientX - r.left) / r.width * R[2]), y = R[1] + Math.floor((e.clientY - r.top) / r.height * R[3]);
      if (x < R[0] || y < R[1] || x >= R[0] + R[2] || y >= R[1] + R[3]) return null;
      return [x, y];
    };
    let down = false, last = null;
    cv.onpointerdown = (e) => { e.preventDefault(); const t = texel(e); if (!t) return; down = true; cv.setPointerCapture(e.pointerId); this.pushUndo(); last = null; this.paintAt(t[0], t[1]); last = t.join(); };
    cv.onpointermove = (e) => {
      const t = texel(e);
      if (this.view) this.view.hover = t && skinOwnerTable(this.slim)[t[1] * 64 + t[0]] ? t : [-1, -1];
      if (!down || !t || t.join() === last) return;
      last = t.join(); if (this.tool === 'pen' || this.tool === 'eraser') this.paintAt(t[0], t[1]);
    };
    cv.onpointerup = cv.onpointercancel = () => { down = false; };
    cv.onpointerleave = () => { if (this.view) this.view.hover = [-1, -1]; };
    requestAnimationFrame(() => this.drawNet());
    this.drawNet();
  }
  drawNet() {
    const cv = this.net; if (!cv || !cv.isConnected || this.tab !== 'paint') return;
    const R = this.netRegion();
    const wrap = cv.parentElement, availW = Math.max(160, wrap.clientWidth || 320);
    const maxH = Math.max(180, Math.min(window.innerHeight * 0.5, 420));
    const cell = Math.max(3, Math.floor(Math.min(availW / R[2], maxH / R[3])));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = cell * R[2] + 'px'; cv.style.height = cell * R[3] + 'px';
    cv.width = Math.round(cell * R[2] * dpr); cv.height = Math.round(cell * R[3] * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const own = skinOwnerTable(this.slim), px = this.px;
    for (let j = 0; j < R[3]; j++) for (let i = 0; i < R[2]; i++) {
      const x = R[0] + i, y = R[1] + j, o = own[y * 64 + x];
      const X = i * cell, Y = j * cell;
      if (!o) { g.fillStyle = '#e9e2f2'; g.fillRect(X, Y, cell, cell); continue; }
      const k = (y * 64 + x) * 4;
      if (px[k + 3] < 128) {
        g.fillStyle = (i + j) % 2 ? '#ffffff' : '#f1ecf7'; g.fillRect(X, Y, cell, cell);
        if (o.over) { const r0 = skinFaceRect(o.part, o.face, 0, this.slim), kk = ((r0[1] + o.j) * 64 + r0[0] + o.i) * 4; g.fillStyle = `rgba(${px[kk]},${px[kk + 1]},${px[kk + 2]},0.28)`; g.fillRect(X, Y, cell, cell); }
      } else { g.fillStyle = `rgb(${px[k]},${px[k + 1]},${px[k + 2]})`; g.fillRect(X, Y, cell, cell); }
    }
    if (cell >= 6) {
      g.strokeStyle = 'rgba(90,70,120,0.13)'; g.lineWidth = 1; g.beginPath();
      for (let i = 1; i < R[2]; i++) { g.moveTo(i * cell + 0.5, 0); g.lineTo(i * cell + 0.5, R[3] * cell); }
      for (let j = 1; j < R[3]; j++) { g.moveTo(0, j * cell + 0.5); g.lineTo(R[2] * cell, j * cell + 0.5); }
      g.stroke();
    }
    // 면 테두리와 이름
    const fcol = { front: '#ff6f9a', back: '#5aa9f5', right: '#3fbf7f', left: '#ff9f3d', top: '#9b7fe0', bottom: '#8b7fa3' };
    g.font = `${Math.max(10, Math.min(15, cell * 1.1))}px Pretendard, "Malgun Gothic", sans-serif`; g.textBaseline = 'top';
    const parts = this.part === 'all' ? SKIN_PART_KEYS : [this.part], layers = this.part === 'all' ? [0, 1] : [this.layer];
    for (const p of parts) for (const L of layers) for (const f of SKIN_FACES) {
      const r = skinFaceRect(p, f, L, this.slim);
      const X = (r[0] - R[0]) * cell, Y = (r[1] - R[1]) * cell;
      g.strokeStyle = fcol[f]; g.lineWidth = this.part === 'all' ? 1.5 : 2.5;
      g.strokeRect(X + 1, Y + 1, r[2] * cell - 2, r[3] * cell - 2);
      if (this.part !== 'all' && cell >= 9) {
        const label = SKIN_FACE_NAMES[f];
        g.fillStyle = 'rgba(255,255,255,0.85)'; const tw = g.measureText(label).width;
        g.fillRect(X + 3, Y + 3, tw + 6, Math.min(16, cell * 1.1 + 3)); g.fillStyle = fcol[f]; g.fillText(label, X + 6, Y + 4);
      }
    }
    if (this.part === 'all') {
      g.fillStyle = 'rgba(74,61,94,0.8)';
      for (const p of SKIN_PART_KEYS) for (const L of [0, 1]) { const P = skinPartDims(p, this.slim); g.fillText(SKIN_PARTS[p].name + (L ? '+' : ''), ((L ? P.ou : P.u) - R[0]) * cell + 2, ((L ? P.ov : P.v) - R[1]) * cell + 2); }
    }
  }
  setPx(x, y, c) {
    const k = (y * 64 + x) * 4, px = this.px;
    if (c) { px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; px[k + 3] = 255; } else { px[k] = px[k + 1] = px[k + 2] = px[k + 3] = 0; }
  }
  paintAt(x, y) {
    const own = skinOwnerTable(this.slim), o = own[y * 64 + x];
    if (!o) return;
    const targets = [[x, y]];
    if (this.mirror && this.tool !== 'picker') { const m = skinMirrorTexel(x, y, this.slim); if (m && (m[0] !== x || m[1] !== y)) targets.push(m); }
    if (this.tool === 'picker') {
      const k = (y * 64 + x) * 4; if (this.px[k + 3] < 128) { this.g.ui.toast('투명한 칸이에요', 900); return; }
      this.color = rgbHex([this.px[k], this.px[k + 1], this.px[k + 2]]); this.tool = 'pen'; this.setTab('paint'); return;
    }
    for (const [tx, ty] of targets) {
      const to = own[ty * 64 + tx]; if (!to) continue;
      if (this.tool === 'pen') this.setPx(tx, ty, hexRgb(this.color));
      else if (this.tool === 'eraser') this.setPx(tx, ty, to.over ? null : hexRgb(this.opts.skinTone));
      else if (this.tool === 'fill') this.fill(tx, ty, hexRgb(this.color));
    }
    this.painted = true;
    this.changed();
  }
  fill(x, y, c) {
    const own = skinOwnerTable(this.slim), o = own[y * 64 + x], px = this.px;
    const r = skinFaceRect(o.part, o.face, o.over, this.slim);
    const k0 = (y * 64 + x) * 4, src = [px[k0], px[k0 + 1], px[k0 + 2], px[k0 + 3]];
    const same = (k) => (src[3] < 128 ? px[k + 3] < 128 : px[k + 3] >= 128 && px[k] === src[0] && px[k + 1] === src[1] && px[k + 2] === src[2]);
    if (src[3] >= 128 && src[0] === c[0] && src[1] === c[1] && src[2] === c[2]) return;
    const st = [[x, y]], seen = new Set();
    while (st.length) {
      const [cx, cy] = st.pop();
      if (cx < r[0] || cy < r[1] || cx >= r[0] + r[2] || cy >= r[1] + r[3]) continue;
      const id = cy * 64 + cx; if (seen.has(id)) continue; seen.add(id);
      if (!same(id * 4)) continue;
      this.setPx(cx, cy, c);
      st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }
  // 3D 미리보기 조작 (돌리기·확대·바로 칠하기)
  bindStage(cv) {
    const ptrs = new Map();
    let mode = null, lastT = null, pinch0 = 0, dist0 = 0;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.view) return;
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { const [a, b] = Array.from(ptrs.values()); pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = this.view.zoom; mode = 'pinch'; return; }
      mode = 'rotate';
      if (this.tab === 'paint' && e.button === 0) {
        const t = this.view.pick(e.clientX, e.clientY, this.layer === 1);
        if (t && skinOwnerTable(this.slim)[t[1] * 64 + t[0]]) { mode = 'paint'; this.pushUndo(); this.paintAt(t[0], t[1]); lastT = t.join(); }
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.view) return;
      const prev = ptrs.get(e.pointerId);
      if (!prev) {
        if (this.tab === 'paint' && e.pointerType === 'mouse') { const t = this.view.pick(e.clientX, e.clientY, this.layer === 1); this.view.hover = t || [-1, -1]; }
        return;
      }
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (mode === 'pinch' && ptrs.size >= 2) { const [a, b] = Array.from(ptrs.values()); const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0 > 0) this.view.zoom = Math.max(0.3, Math.min(1.6, dist0 * pinch0 / d)); return; }
      if (mode === 'paint') {
        const t = this.view.pick(e.clientX, e.clientY, this.layer === 1);
        this.view.hover = t || [-1, -1];
        if (t && t.join() !== lastT && (this.tool === 'pen' || this.tool === 'eraser')) { lastT = t.join(); this.paintAt(t[0], t[1]); }
        return;
      }
      if (mode === 'rotate') { this.view.yaw -= (e.clientX - prev[0]) * 0.012; this.view.pitch = Math.max(-1.2, Math.min(1.2, this.view.pitch + (e.clientY - prev[1]) * 0.01)); }
    });
    const up = (e) => { ptrs.delete(e.pointerId); if (!ptrs.size) mode = null; else if (mode === 'pinch') mode = 'rotate'; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (!ptrs.size && this.view) this.view.hover = [-1, -1]; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); if (this.view) this.view.zoom = Math.max(0.3, Math.min(1.6, this.view.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // ---------- 저장함 ----------
  store() { return loadAvatarStore() || { cur: avatarNet(this.g.avatar), saved: [] }; }
  fileHtml() {
    const st = this.store(), saved = st.saved || [];
    return `<div class="av-sec"><div class="av-lbl">내 저장함 (${saved.length}/${AV_SLOTS_MAX})</div>
        <div class="av-slots" id="av-slots">${saved.map((a, i) => `<div class="av-slot" data-i="${i}"><img alt=""><span>${esc(a.title || '아바타 ' + (i + 1))}</span><button class="btn small red" data-del="${i}">🗑</button></div>`).join('') || '<div class="muted">아직 비어 있어요. 아래 버튼으로 지금 모습을 넣어 두세요.</div>'}</div>
        <div class="row"><button class="btn small primary" id="av-keep">＋ 지금 모습 저장함에 넣기</button></div></div>
      <div class="av-sec"><div class="av-lbl">마인크래프트 스킨 파일 (64×64 PNG)</div>
        <div class="row"><button class="btn small blue" id="av-export">⬇ 스킨 PNG 내려받기</button>
        <label class="btn small" id="av-import-l">📂 스킨 PNG 불러오기<input type="file" id="av-import" accept="image/png" hidden></label></div>
        <p class="av-note small">다른 곳에서 만든 마인크래프트 스킨(64×64, 옛 64×32도 가능)을 불러와 입을 수 있어요. 가는 팔 스킨이면 🎀 탭의 「가는 팔」을 고른 뒤 불러오세요.</p></div>
      <div class="av-sec"><div class="row"><button class="btn small red" id="av-reset">↺ 처음 캐릭터로 되돌리기</button></div></div>`;
  }
  bindFile() {
    const s = this.s, st = this.store(), saved = st.saved || [];
    $$('.av-slot', s).forEach(el => {
      const a = saved[+el.dataset.i]; if (!a) return;
      pngToPixels(a.png).then(px => { const img = $('img', el); if (img) img.src = skinBodyCanvas(px, a.slim, 3).toDataURL(); }).catch(() => { });
      el.onclick = async (e) => {
        if (e.target.dataset.del !== undefined) {
          e.stopPropagation(); if (!confirm('이 아바타를 저장함에서 지울까요?')) return;
          saved.splice(+e.target.dataset.del, 1); st.saved = saved; saveAvatarStore(st); this.setTab('file'); return;
        }
        try {
          const px = await pngToPixels(a.png);
          this.pushUndo(); this.px = px; this.slim = !!a.slim; this.acc = Object.assign({}, AV_ACC_DEFAULT, a.acc || {});
          if (a.opts) this.opts = Object.assign({}, AV_DEFAULT, a.opts);
          this.changed(); this.g.ui.toast('저장함에서 꺼냈어요', 1200);
        } catch (err) { this.g.ui.toast('불러오지 못했어요'); }
      };
    });
    $('#av-keep', s).onclick = () => {
      if (saved.length >= AV_SLOTS_MAX) { this.g.ui.toast(`저장함은 ${AV_SLOTS_MAX}칸까지예요. 하나를 지워 주세요`); return; }
      const title = prompt('이 아바타의 이름', (this.name || '나') + '의 아바타 ' + (saved.length + 1));
      if (title === null) return;
      saved.push({ png: pixelsToPng(this.px), slim: this.slim, acc: this.resolvedAcc(), opts: Object.assign({}, this.opts, { slim: this.slim }), title: String(title).slice(0, 20) });
      st.saved = saved; saveAvatarStore(st); this.setTab('file');
    };
    $('#av-export', s).onclick = () => {
      const a = document.createElement('a'); a.href = pixelsToPng(this.px); a.download = (String(this.name || 'skin').replace(/[\\/:*?"<>|]/g, '') || 'skin') + '_skin.png'; a.click();
    };
    $('#av-import', s).onchange = (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const px = await pngToPixels(rd.result);
          this.pushUndo(); this.px = px; this.painted = true; this.changed();
          this.g.ui.toast('스킨을 불러왔어요! ✏️ 도트 그리기로 더 꾸밀 수 있어요', 2200);
        } catch (err) { this.g.ui.toast('64×64 스킨 PNG가 아니에요'); }
      };
      rd.readAsDataURL(f);
    };
    $('#av-reset', s).onclick = () => { this.opts = Object.assign({}, AV_DEFAULT); this.acc = Object.assign({}, AV_ACC_DEFAULT); this.compose(); };
  }
}
