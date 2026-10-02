'use strict';
// =====================================================================
// 게임: 전체 흐름(월드 시작/저장, 메인 루프, 청크 관리, 상호작용, 틱)
// =====================================================================
const SETTINGS_KEY = 'educraft.settings.v1';
const DEFAULT_SETTINGS = {
  quality: 2, renderDist: 6, fov: 75, sens: 1, lookMode: 'auto', volume: 0.7, clouds: true, autoJump: true, viewBob: true,
  hideHud: false, debug: false, renderScale: 1, fancyLeaves: true, name: '', skin: 0, touchSize: 1, showRs: true, brightness: 0.3, showFlow: true,
  treeFell: true, veinMine: true, autoRefill: true, minimap: true, autoQuality: true,
};
const SFX_LOCAL = new Set(['hurt', 'pop', 'eat', 'burp', 'bow', 'dig', 'step', 'break', 'place', 'break_tool']);
const SKINS = [[0.2, 0.55, 0.85], [0.85, 0.3, 0.3], [0.3, 0.7, 0.35], [0.9, 0.7, 0.2], [0.6, 0.35, 0.8], [0.95, 0.5, 0.7], [0.25, 0.25, 0.28], [0.95, 0.95, 0.95]];

// ---------------- 저장소 (IndexedDB) ----------------
const DB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open('educraft', 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { r.result.createObjectStore('worlds', { keyPath: 'id' }); };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('worlds', mode); const st = t.objectStore('worlds');
      const r = fn(st);
      t.oncomplete = () => res(r && r.result !== undefined ? r.result : undefined);
      t.onerror = () => rej(t.error);
    });
  },
  list() { return this.tx('readonly', st => st.getAll()).then(a => (a || []).map(w => ({ id: w.id, name: w.name, mode: w.mode, type: w.type, seed: w.seed, played: w.played, created: w.created }))); },
  get(id) { return this.tx('readonly', st => st.get(id)); },
  put(w) { return this.tx('readwrite', st => st.put(w)); },
  del(id) { return this.tx('readwrite', st => st.delete(id)); },
};

const ITEM_MESH3D = new Set(['cube', 'slab', 'stairs', 'chest', 'cactus', 'farmland', 'piston', 'daylight', 'fence', 'diode', 'torch', 'lever', 'button', 'plate', 'trapdoor', 'endframe', 'egg']);
function objToMods(o) {
  if (o instanceof Map) return o;
  const out = new Map();
  for (const k in o || {}) { const arr = o[k]; const m = new Map(); for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]); out.set(+k, m); }
  return out;
}
function modsToObj(mods) {
  if (!(mods instanceof Map)) return mods || {};
  const o = {};
  for (const [k, m] of mods) { const a = []; for (const [i, v] of m) a.push(i, v); o[k] = a; }
  return o;
}
class Game {
  constructor() {
    this.state = 'boot';
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { }
    let firstRun = true; try { firstRun = !localStorage.getItem(SETTINGS_KEY); } catch (e) { }
    if (isTouchDevice() && firstRun) { this.settings.quality = 1; this.settings.renderDist = 4; this.settings.renderScale = 0.75; }
    this.firstRun = firstRun;
    if (!this.settings.name) this.settings.name = '플레이어' + (1 + Math.random() * 999 | 0);
    // 내 아바타
    const avs = loadAvatarStore();
    this.avatar = avs ? sanitizeAvatar(avs.cur) : null;
    if (this.avatar) { this.avatar.opts = avs.cur.opts || null; ensureAvatarPixels(this.avatar); }
    this.view = 0;
    this.frame = { blockEnts: [] };
    this.remotes = new Map();
    this.netSets = []; this.flatMeshes = new Map();
    this.fans = new Set(); this.furnaces = new Set(); this.hoppers = new Set();
    this.lastTime = performance.now();
    this.tickAcc = 0; this.fps = 0; this.fpsAcc = 0; this.fpsN = 0;
    this.breakProg = 0; this.breakTarget = null; this.swing = 0; this.breakCooldown = 0; this.useCooldown = 0; this.attackCooldown = 0;
    this.eatT = 0; this.bowT = 0; this.rain = 0; this.rainTarget = 0; this.hurtFx = 0; this.equip = 0; this.lastHeld = -1;
  }
  // 처음 켤 때: 교실 노트북(내장 그래픽·코어 4개 이하)이면 가벼운 화질로 시작 (느려지기 전에)
  guessLowEnd() {
    let gpu = '';
    try { const gl = this.renderer.gl, ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { }
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
    const goodIgpu = /iris\(r\) xe|iris xe|arc|radeon\(tm\) 6|radeon 7/i.test(gpu);
    const weakGpu = /intel|uhd|hd graphics|mali|adreno|powervr|swiftshader|llvmpipe|basic render/i.test(gpu) && !goodIgpu;
    const soft = /swiftshader|llvmpipe|basic render|microsoft basic/i.test(gpu);
    const s = this.settings;
    if (soft) { s.quality = 0; s.renderDist = 4; s.renderScale = 0.6; }
    else if (weakGpu && (cores <= 4 || mem <= 4)) { s.quality = 1; s.renderDist = 5; s.renderScale = 0.85; }
    else if (weakGpu || cores <= 4) { s.quality = 1; s.renderDist = 6; }
    this.gpuName = gpu;
  }
  saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { } }
  setAvatar(av) {
    this.avatar = av;
    const st = loadAvatarStore() || { saved: [] };
    st.cur = { png: av.png, slim: av.slim, acc: av.acc, opts: av.opts || null };
    saveAvatarStore(st);
    if (this.net) this.net.sendAvatar();
  }
  fallbackAvatar() { return this._defAv || (this._defAv = defaultAvatar()); }
  boot() {
    buildTextures(); if (this.settings.pastel !== false) pastelizeTextures(); defineBlocks(); buildBlockTables(); defineItems(); defineRecipes(); defineSmelting(); buildIcons(); installIconSheet();
    this.canvas = document.getElementById('gl');
    this.renderer = new Renderer(this.canvas);
    this.mesher = new Mesher();
    this.sound = new Sound(); this.sound.setVolume(this.settings.volume);
    this.ui = new UI(this);
    this.input = new Input(this, this.canvas);
    this.input.setLookPref(this.settings.lookMode);
    this.builder = new Builder(this);
    if (!this.avatar) this.avatar = defaultAvatar();
    this.avatarEd = new AvatarEditor(this);
    this.minimap = new Minimap(this);
    this.net = new Net(this);
    if (this.firstRun && !isTouchDevice()) this.guessLowEnd();
    this.applySettings();
    this.ui.showMain();
    this.state = 'menu';
    requestAnimationFrame(t => this.loop(t));
    this.watchdog();
    const unlock = () => { if (this.sound.ensure() && this.sound.ctx.state === 'running') { window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true); } };
    window.addEventListener('pointerdown', unlock, true); window.addEventListener('keydown', unlock, true);
    window.addEventListener('beforeunload', () => { if (this.state === 'play' && !this.world.remote) this.saveWorld(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play' && !this.world.remote) this.saveWorld(); });
  }
  applySettings() {
    const s = this.settings;
    this.renderer.quality = s.quality;
    this.renderer.renderScale = s.renderScale;
    this.renderer.maxDpr = s.quality >= 3 || isTouchDevice() ? 2 : 1;
    const ss = s.quality >= 3 ? 4096 : s.quality >= 2 ? 2048 : 1024;
    if (ss !== this.renderer.shadowSize) this.renderer.setupShadow(ss);
    this.renderer.fbW = 0;
    this.mesher.fancyLeaves = s.fancyLeaves;
    this.sound.setVolume(s.volume);
    document.documentElement.style.setProperty('--touch-scale', s.touchSize);
    this.saveSettings();
  }

  // =================== 월드 시작 ===================
  async startWorld(opt) {
    // opt: { id, name, seed, type, mode, rec(저장본), client: {seed,type,mods,be,time,...} }
    this.ui.showLoading('세계를 준비하는 중...');
    this.worldId = opt.id;
    const rec = opt.rec;
    const seed = rec ? rec.seed : opt.client ? opt.client.seed : opt.seed;
    const type = rec ? rec.type : opt.client ? opt.client.type : opt.type;
    const dim = rec && rec.dim || 'overworld';
    this.world = new World(seed, type, dim);
    this.worldName = rec ? rec.name : opt.name;
    this.worldMode = rec ? rec.mode : opt.client ? opt.client.mode : opt.mode;
    this.worldCreated = rec ? rec.created : Date.now();
    this.worldRules = Object.assign({ peaceful: type === 'flat', daylightCycle: true, tntGrief: true, keepInventory: false, mobs: true }, rec && rec.rules || opt.rules || {});
    this.settings.peaceful = this.worldRules.peaceful;
    const w = this.world;
    // 차원별 저장소: 지금 차원이 아닌 곳은 저장된 모양 그대로 두었다가 갈 때 꺼냄
    this.dimStore = { overworld: null, nether: null, end: null };
    this.dragon = Object.assign({ dead: false, hp: null, crystals: null, ended: false }, rec && rec.dragon || {});
    this.found = new Set(rec && rec.found || []);
    this.portalT = 0; this.portalCD = 0; this.pendingArrive = null;
    if (rec) {
      w.time = rec.time || 1000;
      const dims = rec.dims || {};
      this.dimStore.overworld = { mods: rec.mods || {}, be: rec.be || [] };
      if (dims.nether) this.dimStore.nether = dims.nether;
      if (dims.end) this.dimStore.end = dims.end;
      const cur = this.dimStore[dim]; this.dimStore[dim] = null;
      if (cur) { w.mods = objToMods(cur.mods); for (const [k, v] of cur.be || []) w.be.set(k, v); }
      this.rainTarget = this.rain = rec.rain || 0;
    }
    if (opt.client) {
      const c = opt.client;
      w.remote = true; w.time = c.time;
      for (const k in c.mods) { const arr = c.mods[k]; const m = new Map(); for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]); w.mods.set(+k, m); }
      for (const [k, v] of c.be || []) w.be.set(k, v);
      this.worldRules = Object.assign(this.worldRules, c.rules || {});
      this.settings.peaceful = this.worldRules.peaceful;
      this.rain = this.rainTarget = c.rain || 0;
    }
    this.attachWorld(w);
    this.player = new Player(this);
    const p = this.player;
    p.name = this.settings.name; p.skin = SKINS[this.settings.skin % SKINS.length];
    p.creative = this.worldMode === 'creative';
    if (rec && rec.player) {
      const s = rec.player;
      Object.assign(p, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, health: s.health, food: s.food, sat: s.sat || 5, sel: s.sel || 0, flying: !!s.flying });
      p.inv = (s.inv || []).map(v => v ? Object.assign({}, v) : null); while (p.inv.length < 36) p.inv.push(null);
      p.armor = [0, 1, 2, 3].map(i => s.armor && s.armor[i] ? Object.assign({}, s.armor[i]) : null);
      p.creative = s.creative !== undefined ? s.creative : p.creative;
      p.spawn = s.spawn || [s.x, s.y, s.z];
      this.pendingSpawn = false;
    } else if (opt.client) {
      p.x = opt.client.spawn[0]; p.y = opt.client.spawn[1]; p.z = opt.client.spawn[2]; p.spawn = opt.client.spawn.slice();
      p.creative = opt.client.mode === 'creative';
      this.pendingSpawn = false;
      this.giveStarter();
    } else {
      this.pendingSpawn = true; this.giveStarter();
      p.x = 0.5; p.z = 0.5; p.y = 100;
    }
    this.builder.reset();
    this.state = 'loading';
    this.loadStart = performance.now();
    this.ui.enterGame();
  }
  // 세계(차원)를 게임에 연결: 블록 변화 알림, 회로, 개체
  attachWorld(w) {
    this.furnaces.clear(); this.hoppers.clear(); this.fans.clear();
    for (const [k, v] of w.be) { if (v.t === 'furnace') this.furnaces.add(k); else if (v.t === 'hopper') this.hoppers.add(k); }
    w.onChange = (x, y, z, oid, om, id, meta, flags) => this.onBlockChange(x, y, z, oid, om, id, meta, flags);
    w.onScheduled = (x, y, z, kind) => { if (kind === 1) this.redstone.scheduledTick(x, y, z); };
    w.onFluidBreak = (x, y, z, id) => this.dropBlockItems(x, y, z, id, w.getMeta(x, y, z));
    w.onFalling = (x, y, z, id) => this.ents.add(new FallingBlock(x, y, z, id));
    w.onLeafDecay = (x, y, z, id) => this.dropBlockItems(x, y, z, id, 0);
    this.redstone = new Redstone(w, this);
    this.ents = new EntityManager(this);
    this.particles = new Particles();
    this._order = null;
  }
  giveStarter() {
    const p = this.player;
    if (p.creative) {
      const hb = ['grass', 'stone', 'oak_planks', 'glass', 'redstone', 'lever', 'redstone_lamp', 'repeater', 'builder_remote'];
      hb.forEach((n, i) => p.inv[i] = { id: I(n), n: 1 });
    } else {
      p.inv[0] = { id: I('builder_remote'), n: 1 };
      p.inv[1] = { id: I('bread'), n: 5 };
    }
  }
  findSpawn() {
    const w = this.world;
    if (w.type === 'flat') return [0.5, 5, 0.5];
    for (let r = 0; r < 400; r += 8) for (let a = 0; a < 8; a++) {
      const x = Math.round(Math.cos(a / 8 * Math.PI * 2) * r), z = Math.round(Math.sin(a / 8 * Math.PI * 2) * r);
      const c = w.column(x, z);
      if (c.biome !== 0 && c.biome !== 1 && c.h > SEA + 1 && c.h < 95) return [x + 0.5, c.h + 1, z + 0.5];
    }
    return [0.5, 90, 0.5];
  }
  quitToMenu() {
    if (this.state === 'play' || this.state === 'loading') { if (!this.world.remote) this.saveWorld(); }
    this.net.close();
    this.builder.close();
    if (this.world) for (const c of this.world.chunks.values()) this.renderer.deleteChunkMesh(c);
    this.world = null; this.state = 'menu'; this.remotes.clear(); this.fans.clear(); this.furnaces.clear(); this.hoppers.clear();
    this.input.releaseLock();
    this.ui.showMain();
  }
  serializeWorld() {
    const w = this.world, p = this.player;
    // 차원별로 따로 저장 (mods/be = 평소 세계, dims = 지옥·엔드)
    const st = Object.assign({}, this.dimStore || {});
    st[w.dim] = { mods: w.mods, be: w.be };
    const pack = (d) => d ? { mods: modsToObj(d.mods), be: d.be instanceof Map ? Array.from(d.be.entries()) : (d.be || []) } : null;
    const ow = pack(st.overworld) || { mods: {}, be: [] };
    const mods = ow.mods;
    return {
      dims: { nether: pack(st.nether), end: pack(st.end) },
      id: this.worldId, name: this.worldName, seed: w.seed, type: w.type, mode: this.worldMode, created: this.worldCreated, played: Date.now(),
      time: w.time, rain: this.rainTarget, rules: this.worldRules,
      player: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, health: p.health, food: p.food, sat: p.sat, inv: p.inv, armor: p.armor, sel: p.sel, creative: p.creative, spawn: p.spawn, flying: p.flying },
      mods, be: ow.be,
      found: [...(this.found || [])], dragon: this.dragon, dim: w.dim,
    };
  }
  async saveWorld(silent) {
    if (!this.world || this.world.remote || !this.worldId) return;
    try { await DB.put(this.serializeWorld()); if (!silent) this.ui.toast('저장했습니다'); } catch (e) { console.error(e); this.ui.toast('저장 실패: ' + e.message); }
  }

  // =================== 메인 루프 ===================
  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    this.lastRaf = performance.now();
    this.frameStep(t);
    this.autoTune(t);
  }
  // 느린 노트북: 3초씩 재서 두 번 연속 38fps 아래면 화질을 한 단계 낮춤 (설정 「느려지면 화질 자동으로 낮추기」)
  // rAF 프레임만 잼 — 보조 타이머(20fps)로 돌 때 잘못 낮추지 않게
  autoTune(t) {
    const now = performance.now();
    if (this.state !== 'play' || this.settings.autoQuality === false || this.ui.modal || document.hidden || now - (this.playStart || 0) < 8000) { this._at = null; return; }
    const a = this._at || (this._at = { t0: t, n: 0 });
    a.n++;
    const sec = (t - a.t0) / 1000;
    if (sec < 3) return;
    const fps = (a.n - 1) / sec; this._at = null;
    if (fps >= 38) { this._slowN = 0; return; }
    if (++this._slowN < 2) return;
    this._slowN = 0;
    const s = this.settings;
    const steps = [
      [() => s.quality >= 3, () => s.quality = 2],
      [() => s.quality >= 2, () => s.quality = 1],
      [() => s.renderScale > 0.8, () => s.renderScale = 0.8],
      [() => s.renderDist > 5, () => s.renderDist = 5],
      [() => s.renderScale > 0.65, () => s.renderScale = 0.65],
      [() => s.quality >= 1, () => s.quality = 0],
      [() => s.renderDist > 4, () => s.renderDist = 4],
      [() => s.renderScale > 0.5, () => s.renderScale = 0.5],
    ];
    const st = steps.find(x => x[0]());
    if (!st) return;
    st[1]();
    this.applySettings();
    this.ui.toast('🐢 화면이 느려서 화질을 한 단계 낮췄어요 (설정에서 바꿀 수 있어요)', 3500);
  }
  // rAF 가 멈춘 환경(미리보기 창 등)을 위한 보조 타이머
  watchdog() {
    setInterval(() => {
      // 화면이 보일 때(rAF 멈춤 대비), 또는 함께 하기 중일 때(방장이 다른 창을 봐도 세계가 멈추지 않게)
      if ((document.visibilityState === 'visible' || (this.net && this.net.connected)) && performance.now() - (this.lastRaf || 0) > 400) this.frameStep(performance.now());
    }, 50);
  }
  frameStep(t) {
    let dt = (t - this.lastTime) / 1000; this.lastTime = t;
    if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    try {
      if (this.state === 'loading') this.updateLoading(dt);
      else if (this.state === 'play') {
        const paused = !this.net.connected && (this.ui.modal === 'pause' || this.ui.modal === 'settings');
        if (!paused) this.update(dt);
        if (!document.hidden) this.render(dt);   // 숨겨진 창은 계산만
      }
    } catch (e) {
      console.error(e);
      if (!this._errShown) { this._errShown = true; this.ui.toast('오류: ' + e.message, 6000); }
    }
    this.net.flush();
  }
  updateLoading(dt) {
    const p = this.player, w = this.world;
    this.manageChunks(40);
    const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
    let ready = true, need = 0, have = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { need++; const c = w.getChunk(pcx + dx, pcz + dz); if (c && c.mesh && !c.dirty) have++; else ready = false; }
    this.ui.setLoading(Math.round(have / need * 100));
    if (ready || performance.now() - this.loadStart > 20000) {
      if (this.pendingArrive) { if (!this.finishArrive()) return; }
      else if (this.pendingSpawn) {
        const s = this.findSpawn(); p.x = s[0]; p.y = s[1]; p.z = s[2]; p.spawn = s.slice(); this.pendingSpawn = false;
        const sc = w.getChunk(Math.floor(p.x / 16), Math.floor(p.z / 16));
        if (!sc || !sc.mesh) return;
        p.y = w.surfaceY(Math.floor(p.x), Math.floor(p.z)) + 0.01;
        if (!p.creative && this.placeBonusChest) this.placeBonusChest();
      }
      if (!w.isLoadedAt(Math.floor(p.x), Math.floor(p.z))) return;
      // 블록 안에 갇히지 않게
      let guard = 0;
      while (guard++ < 100 && (BLOCKS[w.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].solid || BLOCKS[w.getBlock(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z))].solid)) p.y += 1;
      this.state = 'play'; this.playStart = performance.now(); this._slowN = 0;
      this.ui.hideLoading();
      if (this.onDimReady) this.onDimReady();
      if (this._arrived) { this._arrived = false; document.body.classList.add('playing'); this.ui.applyHudVisibility(); }
      else this.ui.onPlayStart();
      if (!this.input.touch) this.input.requestLock();
      this.lastSave = performance.now();
    }
  }
  update(dt) {
    const p = this.player, w = this.world, inp = this.input;
    const s = inp.poll();
    inp.frameLook(dt);
    // 시점
    const sens = 0.0022 * (isFinite(+this.settings.sens) && +this.settings.sens > 0 ? +this.settings.sens : 1);
    if (inp.lookDX || inp.lookDY) {
      p.yaw -= inp.lookDX * sens; p.pitch -= inp.lookDY * sens;
      p.pitch = clamp(p.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
      inp.lookDX = inp.lookDY = 0;
    }
    // 고정 틱
    this.tickAcc += dt;
    let n = 0;
    while (this.tickAcc >= 0.05 && n++ < 5) { this.tickAcc -= 0.05; this.worldTick(); }
    if (this.tickAcc > 0.25) this.tickAcc = 0;
    // 플레이어 물리 (보조 단계)
    let rem = dt;
    while (rem > 1e-4) { const st = Math.min(rem, 1 / 60); p.update(st, s, w); rem -= st; }
    this.elevatorCheck(s);
    this.conveyorMove(p, dt);
    if (p.y < -40 && !p.dead) { if (p.creative) { p.y = 130; p.vy = 0; } else p.hurt(100, 'void'); }
    this.interact(dt, s);
    inp.consume();
    this.builder.update(dt);
    Survival.update(this, dt); this.minimap.update(dt);
    this.ents.update(dt);
    this.particles.update(dt, w);
    this.redstone.process();
    this.manageChunks(this.input.touch ? 6 : 9);
    // 날씨 보간
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.3);
    if (this.hurtFx > 0) this.hurtFx = Math.max(0, this.hurtFx - dt * 2);
    this.swing = Math.max(0, this.swing - dt * 3.5);
    if (p.sel !== this.lastHeld) { this.equip = 1; this.lastHeld = p.sel; }
    this.equip = Math.max(0, this.equip - dt * 5);
    this.net.update(dt);
    this.ui.update(dt);
    inp.updateTouchUI();
    if (!w.remote && performance.now() - this.lastSave > 60000) { this.lastSave = performance.now(); this.saveWorld(true); }
    // 소리 듣는 위치
    const L = this.sound.listener; L.x = p.x; L.y = p.eyeY(); L.z = p.z; L.yaw = p.yaw;
  }
  worldTick() {
    const w = this.world;
    w.tick++;
    if (this.worldRules.daylightCycle) w.time = (w.time + 1) % 24000;
    if (w.remote) return;
    w.runScheduled();
    this.redstone.process();
    const p = this.player;
    const centers = [[Math.floor(p.x / 16), Math.floor(p.z / 16)]];
    for (const r of this.remotes.values()) centers.push([Math.floor(r.x / 16), Math.floor(r.z / 16)]);
    w.randomTicks(centers);
    this.tickFurnaces();
    this.tickHoppers();
    this.tickConveyors();
    this.checkPlates();
    this.tickFans();
    if (w.tick % 40 === 0 && this.worldRules.mobs) this.spawnMobs();
    if (w.tick % 20 === 0) this.despawnMobs();
    // 날씨
    if (w.tick % 1200 === 0 && Math.random() < 0.15) this.setRain(this.rainTarget > 0 ? 0 : 1);
    this.redstone.process();
  }
  setRain(v) { this.rainTarget = v; if (this.net.isHost) this.net.broadcast({ t: 'weather', v }); }

  // =================== 청크 관리 ===================
  manageChunks(budgetMs) {
    const w = this.world, p = this.player;
    const t0 = performance.now();
    const R = this.settings.renderDist;
    const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
    // 1) 급한 메시 (블록 편집)
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const c = w.getChunk(pcx + dx, pcz + dz);
      if (c && c.urgent && c.state >= 2 && this.neighborsReady(c)) { c.urgent = false; this.meshChunk(c); }
    }
    // 2) 생성 & 빛 (가까운 순)
    if (!this._order || this._orderR !== R) {
      this._orderR = R; this._order = [];
      for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) if (dx * dx + dz * dz <= (R + 1.5) * (R + 1.5)) this._order.push([dx, dz, dx * dx + dz * dz]);
      this._order.sort((a, b) => a[2] - b[2]);
    }
    for (const [dx, dz] of this._order) {
      if (performance.now() - t0 > budgetMs * 0.5) break;
      const cx = pcx + dx, cz = pcz + dz;
      let c = w.getChunk(cx, cz);
      if (!c) { c = new Chunk(cx, cz); w.chunks.set(ckey(cx, cz), c); }
      if (c.state === 0) w.generate(c);
      if (c.state === 1) { w.initLight(c); this.onChunkLoaded(c); }
    }
    // 3) 메시
    for (const [dx, dz, d2] of this._order) {
      if (performance.now() - t0 > budgetMs) break;
      if (d2 > (R + 0.5) * (R + 0.5)) continue;
      const c = w.getChunk(pcx + dx, pcz + dz);
      if (!c || c.state < 2 || !c.dirty) continue;
      if (!this.neighborsReady(c)) continue;
      this.meshChunk(c);
    }
    // 4) 멀리 있는 청크 내리기
    if (w.tick % 40 === 0) {
      const UR = R + 3;
      for (const [k, c] of w.chunks) {
        const dx = c.cx - pcx, dz = c.cz - pcz;
        if (dx * dx + dz * dz > UR * UR) {
          let near = false;
          for (const r of this.remotes.values()) { const rx = c.cx - Math.floor(r.x / 16), rz = c.cz - Math.floor(r.z / 16); if (rx * rx + rz * rz <= UR * UR) near = true; }
          if (near) continue;
          this.renderer.deleteChunkMesh(c); w.chunks.delete(k); if (w._cc === c) w._cc = null;
        }
      }
    }
  }
  neighborsReady(c) {
    const w = this.world;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = w.getChunk(c.cx + dx, c.cz + dz); if (!n || n.state < 2) return false; }
    return true;
  }
  meshChunk(c) {
    const arrays = this.mesher.build(this.world, c);
    c.dirty = false; c.urgent = false;
    this.renderer.uploadChunk(c, arrays);
  }
  onChunkLoaded(c) {
    this.redstone.onChunkLoaded(c);
    // 켜진 선풍기 등록
    const ids = c.ids;
    for (let i = 0; i < ids.length; i++) if (ids[i] === BL.fan && (c.meta[i] & 8)) this.fans.add(fmtKey(c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15)));
  }

  // =================== 블록 변경 훅 ===================
  onBlockChange(x, y, z, oid, om, id, meta, flags) {
    const w = this.world;
    if (id === BL.fan && (meta & 8)) this.fans.add(fmtKey(x, y, z)); else if (oid === BL.fan) this.fans.delete(fmtKey(x, y, z));
    if (w.remote) return;
    Survival.onBlockChange(this, x, y, z, oid, id);
    if (this.net.isHost && !(flags & 4)) this.netSets.push(x, y, z, id, meta);
    this.redstone.onBlockChange(x, y, z, oid, om, id, meta, flags);
    // 유체
    if (IS_FLUID[id]) w.schedule(x, y, z, id === BL.lava ? 30 : 5, 0);
    for (let d = 0; d < 6; d++) {
      const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
      const nid = w.getBlock(nx, ny, nz);
      if (IS_FLUID[nid]) w.schedule(nx, ny, nz, nid === BL.lava ? 30 : 5, 0);
    }
    // 중력
    if (BLOCKS[id] && BLOCKS[id].gravity) w.schedule(x, y, z, 2, 2);
    const above = w.getBlock(x, y + 1, z);
    if (BLOCKS[above] && BLOCKS[above].gravity) w.schedule(x, y + 1, z, 2, 2);
    if (oid === id) return;
    // 여러 칸짜리 블록 정리
    if ((oid === BL.oak_door || oid === BL.iron_door)) {
      if (om & 16) { if (w.getBlock(x, y - 1, z) === oid) w.setBlock(x, y - 1, z, 0, 0); }
      else if (w.getBlock(x, y + 1, z) === oid) w.setBlock(x, y + 1, z, 0, 0);
    }
    if ((oid === BL.piston || oid === BL.sticky_piston) && (om & 8)) {
      const f = om & 7; if (w.getBlock(x + DX[f], y + DY[f], z + DZ[f]) === BL.piston_head) w.setBlock(x + DX[f], y + DY[f], z + DZ[f], 0, 0);
    }
    if (oid === BL.piston_head) {
      const f = om & 7, bx = x - DX[f], by = y - DY[f], bz = z - DZ[f];
      const b = w.getBlock(bx, by, bz);
      if ((b === BL.piston || b === BL.sticky_piston) && (w.getMeta(bx, by, bz) & 8) && (w.getMeta(bx, by, bz) & 7) === f) {
        if (!this.redstone.busyPiston) { w.setBlock(bx, by, bz, 0, 0); this.dropItem(bx + 0.5, by + 0.5, bz + 0.5, { id: b, n: 1 }); }
      }
    }
    // 컨테이너
    const ok = fmtKey(x, y, z);
    if (BLOCKS[oid] && BLOCKS[oid].container && !(BLOCKS[id] && BLOCKS[id].container)) {
      const be = w.be.get(ok);
      if (be && be.items) for (const it of be.items) if (it) this.dropItem(x + 0.5, y + 0.5, z + 0.5, Object.assign({}, it));
      w.be.delete(ok); this.furnaces.delete(ok); this.hoppers.delete(ok);
      if (this.net.isHost) this.net.broadcast({ t: 'be', k: ok, v: null });
    }
    if (BLOCKS[id] && BLOCKS[id].container && !w.be.get(ok)) this.createContainer(x, y, z, id);
    // 버튼/압력판 자동 해제
    if (BLOCKS[id] && BLOCKS[id].rs === 'button' && (meta & 8) && !(om & 8 && oid === id)) w.schedule(x, y, z, BLOCKS[id].pulse, 1);
    // 받침 확인
    if (!BLOCKS[id] || !BLOCKS[id].solid || id === 0) this.checkSupportAround(x, y, z);
    if (!this.supportOk(x, y, z, id, meta)) this.breakBlockDrop(x, y, z);
  }
  createContainer(x, y, z, id) {
    const k = fmtKey(x, y, z);
    let be;
    if (id === BL.chest) be = { t: 'chest', items: new Array(27).fill(null) };
    else if (id === BL.furnace) { be = { t: 'furnace', items: [null, null, null], burn: 0, burnMax: 0, cook: 0 }; this.furnaces.add(k); }
    else if (id === BL.hopper) { be = { t: 'hopper', items: new Array(5).fill(null), cd: 0 }; this.hoppers.add(k); }
    else be = { t: 'disp', items: new Array(9).fill(null) };
    this.world.be.set(k, be);
  }
  supportDir(id, meta) {
    const d = BLOCKS[id]; if (!d) return -1;
    switch (d.shape) {
      case 'torch': case 'lever': case 'button': case 'ladder': return meta & 7;
      case 'wire': case 'rail': case 'diode': case 'plate': case 'cross': case 'crop': return 0;
      case 'door': return meta & 16 ? -1 : 0;
    }
    if (id === BL.cactus || id === BL.sugar_cane) return 0;
    return -1;
  }
  supportOk(x, y, z, id, meta) {
    const sd = this.supportDir(id, meta);
    if (sd < 0) return true;
    const w = this.world;
    const sx = x + DX[sd], sy = y + DY[sd], sz = z + DZ[sd];
    const s = w.getBlock(sx, sy, sz);
    if (!w.isLoadedAt(sx, sz)) return true;
    const d = BLOCKS[id];
    if (id === BL.cactus) return s === BL.sand || s === BL.cactus;
    if (id === BL.sugar_cane) return s === BL.sugar_cane || s === BL.sand || s === BL.grass || s === BL.dirt;
    if (d.shape === 'cross' || d.shape === 'crop') {
      if (id === BL.wheat) return s === BL.farmland;
      if (id === BL.dead_bush) return s === BL.sand || s === BL.dirt || s === BL.grass;
      return s === BL.grass || s === BL.dirt || s === BL.farmland || s === BL.grass_snow;
    }
    const sdf = BLOCKS[s];
    if (!sdf || !s) return false;
    if (d.shape === 'wire' || d.shape === 'diode' || d.shape === 'rail' || d.shape === 'plate') {
      if (sdf.opaque && sdf.shape === 'cube') return true;
      if (sdf.shape === 'slab' && (w.getMeta(sx, sy, sz) & 1)) return true;
      if (s === BL.glass || s === BL.redstone_block || s === BL.observer || s === BL.piston || s === BL.sticky_piston || s === BL.slime_block || s === BL.ice || s === BL.glowstone || s === BL.color_lamp) return true;
      if (sdf.shape === 'stairs' && (w.getMeta(sx, sy, sz) & 8)) return true;
      return false;
    }
    return sdf.solid && (sdf.shape === 'cube' || sdf.shape === 'slab' || sdf.shape === 'stairs' || sdf.shape === 'piston' || sdf.shape === 'chest' || sdf.shape === 'fence' || sdf.shape === 'door');
  }
  checkSupportAround(x, y, z) {
    const w = this.world;
    for (let d = 0; d < 6; d++) {
      const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
      const nid = w.getBlock(nx, ny, nz); if (!nid) continue;
      const nm = w.getMeta(nx, ny, nz);
      const sd = this.supportDir(nid, nm);
      if (sd < 0 || sd !== OPP[d]) continue;
      if (!this.supportOk(nx, ny, nz, nid, nm)) this.breakBlockDrop(nx, ny, nz);
    }
  }
  breakBlockDrop(x, y, z) {
    const w = this.world;
    const id = w.getBlock(x, y, z); if (!id) return;
    const meta = w.getMeta(x, y, z);
    w.setBlock(x, y, z, 0, 0);
    this.dropBlockItems(x, y, z, id, meta);
    this.particles.blockBreak(x, y, z, id, meta);
  }
  blockDrops(id, meta, heldTool, rnd) {
    const d = BLOCKS[id]; if (!d) return [];
    // 에듀 크래프트: 돌·조약돌처럼 1단계 블록(광석 제외)은 맨손으로도 얻음 (느리게 캐질 뿐)
    if (d.lvl && !(heldTool && heldTool.kind === d.tool && heldTool.tier >= d.lvl) && !(d.lvl === 1 && !/_ore$/.test(d.name))) return [];
    let dr = d.drop;
    if (typeof dr === 'function') return dr(meta, rnd || Math.random);
    if (dr === undefined || dr === null) return [];
    if (!ITEMS[dr]) return [];
    return [[dr, 1]];
  }
  dropBlockItems(x, y, z, id, meta, tool) {
    if (this.player && this.player.creative && !tool) { /* 크리에이티브에서도 자연 파괴 드롭은 유지 */ }
    for (const [iid, n] of this.blockDrops(id, meta, tool || null)) if (n > 0) this.dropItem(x + 0.5, y + 0.4, z + 0.5, { id: iid, n });
  }
  dropItem(x, y, z, item, vel) {
    if (!item || !item.n || !ITEMS[item.id]) return;
    const e = this.ents.add(new ItemEntity(item, x, y, z));
    if (vel) { e.vx = vel[0]; e.vy = vel[1]; e.vz = vel[2]; e.pickup = 1.5; }
    return e;
  }

  // =================== 상호작용 ===================
  interact(dt, s) {
    const p = this.player, w = this.world, ev = this.input.ev;
    if (p.dead) return;
    const held = p.held;
    const hd = held ? ITEMS[held.id] : null;
    const eye = [p.x, p.eyeY(), p.z], dir = p.lookDir();
    const reach = p.creative ? 6 : 5;
    const hit = raycast(w, eye[0], eye[1], eye[2], dir[0], dir[1], dir[2], reach);
    this.target = hit;
    const ent = this.pickEntity(eye, dir, p.creative ? 5 : 3.5, hit ? hit.t : 99);
    this.targetEnt = ent;
    this.breakCooldown -= dt; this.useCooldown -= dt; this.attackCooldown -= dt;
    // 떨어뜨리기
    if (ev.drop && held) {
      const n = ev.dropAll ? held.n : 1;
      const item = { id: held.id, n }; if (held.d) item.d = held.d; if (held.e) item.e = held.e;
      held.n -= n; if (held.n <= 0) p.inv[p.sel] = null;
      this.dropItem(p.x, p.eyeY() - 0.3, p.z, item, [dir[0] * 6, dir[1] * 6 + 2, dir[2] * 6]);
      this.ui.refreshHotbar();
    }
    // 블록 집기 (가운데 버튼)
    if (ev.pick && hit) this.pickBlock(hit.id, hit.meta);
    // 공격
    if (ev.attack && ent && this.attackCooldown <= 0) {
      this.attackCooldown = 0.35; this.swing = 1;
      const dmg = hd && hd.dmg ? hd.dmg : 1;
      const l = Math.hypot(dir[0], dir[2]) || 1;
      this.damageEntity(ent, dmg, dir[0] / l, dir[2] / l, 'player');
      if (hd && hd.tool) p.damageHeld(hd.tool.kind === 'sword' ? 1 : 2);
      this.net.sendSwing();
      return;
    }
    // 부수기
    if (s.attack && hit && !ent) {
      const key = hit.x + ',' + hit.y + ',' + hit.z;
      if (p.creative) {
        if (this.breakCooldown <= 0 && (!(hd && hd.tool && hd.tool.kind === 'sword'))) {
          this.breakCooldown = 0.22; this.playerBreak(hit);
        }
        this.breakProg = 0;
      } else {
        if (this.breakTarget !== key) { this.breakTarget = key; this.breakProg = 0; this.digSnd = 0; }
        const bt = this.breakTime(hit.id, held);
        this.breakProg += dt / bt;
        this.swing = Math.max(this.swing, 0.6);
        this.digSnd -= dt; if (this.digSnd <= 0) { this.digSnd = 0.22; this.sound.play('dig', hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, { mat: BLOCKS[hit.id].sound }); }
        if (this.breakProg >= 1) { this.breakProg = 0; this.breakTarget = null; this.playerBreak(hit); }
      }
    } else { this.breakProg = 0; this.breakTarget = null; }
    // 먹기 / 활
    if (s.use && hd && hd.food && (p.food < 20 || p.creative)) {
      this.eatT += dt; this.swing = 0.3;
      if ((this.eatT * 4 | 0) !== ((this.eatT - dt) * 4 | 0)) this.sound.play('eat', p.x, p.y + 1.5, p.z);
      if (this.eatT >= 1.6) { this.eatT = 0; p.eat(hd.food, hd.sat); if (hd.heal) p.heal(hd.heal); p.consumeHeld(1); this.sound.play('burp', p.x, p.y + 1.5, p.z); }
      return;
    } else this.eatT = 0;
    if (hd && hd.bow) {
      if (s.use && (p.creative || p.count(I('arrow')) > 0)) { this.bowT += dt; return; }
      if (!s.use && this.bowT > 0.15) {
        const power = Math.min(1, this.bowT);
        this.spawnArrow(p.x + dir[0] * 0.5, p.eyeY() - 0.1 + dir[1] * 0.5, p.z + dir[2] * 0.5, dir[0] * 50 * power, dir[1] * 50 * power, dir[2] * 50 * power, 'player');
        this.sound.play('bow', p.x, p.y + 1.5, p.z);
        if (!p.creative) { p.take(I('arrow'), 1); p.damageHeld(1); }
        this.bowT = 0; return;
      }
      this.bowT = 0;
    }
    // 사용 / 놓기
    const wantUse = ev.use || (s.use && this.useCooldown <= 0 && !this.input.touch);
    if (wantUse && this.useCooldown <= 0) {
      this.useCooldown = 0.22;
      if (ent && ent.type === 'cart' || ent && ent.remote && ent.type === 'cart') { this.ride(ent); return; }
      if (ent && hd && hd.name === 'shears' && ent.sub === 'sheep') {
        if (this.world.remote) { this.net.send({ t: 'shear', eid: ent.eid }); p.damageHeld(1); } else if (Survival.shear(this, ent)) p.damageHeld(1);
        this.swing = 1; return;
      }
      this.playerUse(hit, s, ev.use);
    }
  }
  pickEntity(eye, dir, reach, maxT) {
    let best = null, bt = Math.min(reach, maxT);
    for (const e of this.ents.list) {
      if (e.dead || (e.type !== 'mob' && e.type !== 'cart')) continue;
      const r = e.w / 2 + 0.1;
      const hit = rayAABB(eye[0], eye[1], eye[2], dir[0], dir[1], dir[2], [e.x - r, e.y, e.z - r, e.x + r, e.y + e.h, e.z + r]);
      if (hit && hit.t < bt) { bt = hit.t; best = e; }
    }
    return best;
  }
  breakTime(id, held) {
    const d = BLOCKS[id];
    if (d.hard < 0) return Infinity;
    if (d.hard === 0) return 0.05;
    const tool = held && ITEMS[held.id] && ITEMS[held.id].tool;
    const can = !d.lvl || (tool && tool.kind === d.tool && tool.tier >= d.lvl);
    let speed = 1;
    if (tool && tool.kind === d.tool) speed = tool.speed;
    if (tool && tool.kind === 'sword' && d.wave === 1) speed = 1.5;
    let t = d.hard * (can ? 1.5 : (d.lvl === 1 && !/_ore$/.test(d.name) ? 3 : 5)) / speed;
    if (this.player.inWater && !this.player.onGround) t *= 5;
    return Math.max(0.05, t);
  }
  playerBreak(hit) {
    const p = this.player, w = this.world;
    const id = w.getBlock(hit.x, hit.y, hit.z); if (!id) return;
    const d = BLOCKS[id];
    if (d.hard < 0 && !p.creative) return;
    const meta = w.getMeta(hit.x, hit.y, hit.z);
    this.swing = 1;
    this.sound.play('break', hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, { mat: d.sound });
    this.particles.blockBreak(hit.x, hit.y, hit.z, id, meta);
    const held = p.held; const tool = held && ITEMS[held.id] && ITEMS[held.id].tool;
    const shearD = held && ITEMS[held.id] && ITEMS[held.id].name === 'shears' ? Survival.shearDrops(id) : null;
    if (!p.creative) {
      for (const [iid, n] of (shearD || this.blockDrops(id, meta, tool))) if (n > 0) this.dropItem(hit.x + 0.5, hit.y + 0.4, hit.z + 0.5, { id: iid, n });
      if (tool || shearD) p.damageHeld(1);
      p.exhaust += 0.005;
    }
    // 문은 아래 칸 기준
    let newId = 0;
    if (id === BL.ice && !p.creative) newId = BL.water;
    this.setBlockNet(hit.x, hit.y, hit.z, newId, 0);
    Survival.afterBreak(this, hit, id, meta, tool);
  }
  // 로컬 적용 + (참가자면) 호스트로 전송
  setBlockNet(x, y, z, id, meta) {
    const w = this.world;
    if (w.remote) {
      w.setBlock(x, y, z, id, meta);
      this.net.send({ t: 'set', b: [x, y, z, id, meta] });
    } else w.setBlock(x, y, z, id, meta);
  }
  pickBlock(id, meta) {
    const p = this.player;
    let iid = id;
    if (id === BL.redstone_wire) iid = I('redstone');
    if (id === BL.wheat) iid = I('seeds');
    if (id === BL.piston_head) iid = BL.piston;
    if (!ITEMS[iid]) return;
    for (let i = 0; i < 9; i++) if (p.inv[i] && p.inv[i].id === iid) { this.selectSlot(i); return; }
    if (p.creative) {
      let slot = p.sel;
      for (let i = 0; i < 9; i++) if (!p.inv[i]) { slot = i; break; }
      p.inv[slot] = { id: iid, n: 1 }; this.selectSlot(slot); this.ui.refreshHotbar();
    }
  }
  selectSlot(i) { this.player.sel = i; this.ui.refreshHotbar(); this.ui.showHeldName(); }
  lookDirH() {
    const d = this.player.lookDir();
    if (Math.abs(d[0]) > Math.abs(d[2])) return d[0] > 0 ? 5 : 4;
    return d[2] > 0 ? 3 : 2;
  }
  lookDir6() {
    const p = this.player;
    if (p.pitch > 0.85) return 1; if (p.pitch < -0.85) return 0;
    return this.lookDirH();
  }
  playerUse(hit, s, fresh) {
    const p = this.player, w = this.world;
    const held = p.held, hd = held ? ITEMS[held.id] : null;
    // 꾹 누르고 있을 때는 블록 놓기만 반복 (레버 깜빡임 방지)
    if (!fresh) {
      if (!hit || !hd || hd.places === undefined) return;
      const td0 = BLOCKS[hit.id];
      if (!p.sneaking && td0 && td0.use) return;
      this.placeBlock(hit, hd.places, held); return;
    }
    // 특수 아이템 (블록 없이도)
    if (hd && hd.name === 'builder_remote') { this.ui.openCode(); return; }
    if (Survival.use(this, hit, hd, held)) return;
    if (hd && hd.name === 'multimeter' && hit) { const info = this.redstone.describe(hit.x, hit.y, hit.z); this.ui.chatLine('🔎 ' + (info || BLOCKS[hit.id].k + ' · 전기 부품 아님'), '#ffe27a'); return; }
    // 양동이
    if (hd && (hd.name === 'bucket')) {
      const d = p.lookDir();
      const fh = raycast(w, p.x, p.eyeY(), p.z, d[0], d[1], d[2], 5, { fluids: true, sourceOnly: true });
      if (fh && BLOCKS[fh.id].fluid) {
        this.setBlockNet(fh.x, fh.y, fh.z, 0, 0);
        const nb = fh.id === BL.water ? I('water_bucket') : I('lava_bucket');
        if (!p.creative) { if (held.n > 1) { held.n--; p.give(nb, 1); } else p.inv[p.sel] = { id: nb, n: 1 }; }
        this.sound.play('splash', fh.x, fh.y, fh.z); this.swing = 1; this.ui.refreshHotbar();
      }
      return;
    }
    if (!hit) return;
    const tid = hit.id, td = BLOCKS[tid];
    // 블록 사용 (웅크리지 않았을 때)
    if (!p.sneaking && (td.use || td.rs === 'target') && !(hd && hd.name === 'wrench')) {
      if (this.useBlock(hit.x, hit.y, hit.z, true)) { this.swing = 1; return; }
    }
    if (hd && hd.name === 'wrench') { this.useWrench(hit.x, hit.y, hit.z); this.swing = 1; return; }
    if (hd && hd.name === 'flint_and_steel' && tid === BL.tnt) { if (w.remote) this.net.send({ t: 'use', x: hit.x, y: hit.y, z: hit.z, ignite: 1 }); else this.igniteTNT(hit.x, hit.y, hit.z); p.damageHeld(1); this.swing = 1; return; }
    if (hd && hd.tool && hd.tool.kind === 'hoe' && (tid === BL.grass || tid === BL.dirt) && !w.getBlock(hit.x, hit.y + 1, hit.z)) {
      this.setBlockNet(hit.x, hit.y, hit.z, BL.farmland, 0); p.damageHeld(1); this.swing = 1; this.sound.play('place', hit.x + 0.5, hit.y + 1, hit.z + 0.5, { mat: 'gravel' }); return;
    }
    if (hd && hd.name === 'minecart' && isRail(tid)) {
      if (w.remote) this.net.send({ t: 'cart', x: hit.x, y: hit.y, z: hit.z });
      else this.ents.add(new Minecart(hit.x + 0.5, hit.y + 0.1, hit.z + 0.5));
      p.consumeHeld(1); this.swing = 1; return;
    }
    if (hd && hd.fluid) {
      let [x, y, z] = [hit.x + DX[hit.face], hit.y + DY[hit.face], hit.z + DZ[hit.face]];
      if (td.replace) { x = hit.x; y = hit.y; z = hit.z; }
      const cur = w.getBlock(x, y, z);
      if (!cur || BLOCKS[cur].replace) {
        this.setBlockNet(x, y, z, hd.fluid, 0);
        if (!p.creative) p.inv[p.sel] = { id: I('bucket'), n: 1 };
        this.sound.play('splash', x, y, z); this.swing = 1; this.ui.refreshHotbar();
      }
      return;
    }
    // 블록 놓기
    if (hd && (hd.places !== undefined)) this.placeBlock(hit, hd.places, held);
  }
  // 블록 사용: 로컬 상호작용. local=true 이면 소리/UI 는 로컬에서
  useBlock(x, y, z, local, pid) {
    const w = this.world;
    const id = w.getBlock(x, y, z), d = BLOCKS[id]; if (!d) return false;
    const m = w.getMeta(x, y, z);
    const u = d.use;
    // UI 열기 (각자 로컬)
    if (u === 'craft' || u === 'furnace' || u === 'chest' || u === 'dispenser') {
      if (!local) return false;
      if (u === 'craft') this.ui.openCrafting();
      else this.ui.openContainer(x, y, z);
      return true;
    }
    if (u === 'bed' && local) {
      const p = this.player; p.spawn = [x + 0.5, y + 1, z + 0.5];
      const night = w.time > 12500 && w.time < 23500;
      this.ui.toast(night ? '잘 자요! 😴' : '다시 태어날 곳을 침대로 정했어요. (잠은 밤에만 잘 수 있어요)');
      if (!night) return true;
    }
    // 참가자는 호스트에게 부탁
    if (w.remote && local) {
      this.net.send({ t: 'use', x, y, z, sneak: this.player.sneaking ? 1 : 0 });
      if (u === 'lever' || u === 'button') this.sound.play('click_on', x + 0.5, y + 0.5, z + 0.5);
      return true;
    }
    switch (u) {
      case 'lever': w.setBlock(x, y, z, id, m ^ 8); this.sound.play(m & 8 ? 'click_off' : 'click_on', x + 0.5, y + 0.5, z + 0.5); this.redstone.queueAround(x + DX[m & 7], y + DY[m & 7], z + DZ[m & 7]); return true;
      case 'button': if (!(m & 8)) { w.setBlock(x, y, z, id, m | 8); this.sound.play('click_on', x + 0.5, y + 0.5, z + 0.5); this.redstone.queueAround(x + DX[m & 7], y + DY[m & 7], z + DZ[m & 7]); } return true;
      case 'door': {
        if (id === BL.oak_door) {
          const ly = m & 16 ? y - 1 : y;
          const lm = w.getMeta(x, ly, z);
          const open = !(lm & 8);
          w.setBlock(x, ly, z, id, open ? lm | 8 : lm & ~8, 2);
          if (w.getBlock(x, ly + 1, z) === id) { const um = w.getMeta(x, ly + 1, z); w.setBlock(x, ly + 1, z, id, open ? um | 8 : um & ~8, 2); }
          this.sound.play(open ? 'door_open' : 'door_close', x + 0.5, ly + 1, z + 0.5);
          return true;
        }
        if (id === BL.oak_trapdoor) { w.setBlock(x, y, z, id, m ^ 8, 2); this.sound.play(m & 8 ? 'door_close' : 'door_open', x + 0.5, y + 0.5, z + 0.5); return true; }
        return false;
      }
      case 'repeater': { const dl = ((m >> 3) & 3) + 1 & 3; w.setBlock(x, y, z, id, (m & ~24) | (dl << 3)); this.sound.play('click_on', x + 0.5, y + 0.2, z + 0.5); return true; }
      case 'comparator': w.setBlock(x, y, z, id, m ^ 8); this.sound.play('click_on', x + 0.5, y + 0.2, z + 0.5); return true;
      case 'note': {
        const sneak = pid !== undefined ? this._useSneak : this.player.sneaking;
        const nm = (m & ~31) | (((m & 31) + 1) % 25);
        w.setBlock(x, y, z, id, nm, 2);
        this.playNoteBlock(x, y, z, nm & 31);
        return true;
      }
      case 'daylight': w.setBlock(x, y, z, id, m ^ 16); w.schedule(x, y, z, 1, 1); return true;
      case 'bed': {
        const night = w.time > 12500 && w.time < 23500;
        if (night) { w.time = 0; this.rainTarget = 0; if (this.net.isHost) { this.net.broadcast({ t: 'time', v: 0 }); this.net.broadcast({ t: 'weather', v: 0 }); } this.net.sendChat('🌅 푹 자고 일어났어요. 아침이에요!'); }
        return true;
      }
      case 'clock': {
        const sneak = pid !== undefined ? this._useSneak : this.player.sneaking;
        if (sneak) { w.setBlock(x, y, z, id, m ^ 8); this.ui.toastIf(local, (m & 8) ? '클럭 작동' : '클럭 정지'); }
        else { const per = ((m & 3) + 1) & 3; w.setBlock(x, y, z, id, (m & ~3) | per); this.ui.toastIf(local, `클럭 주기: ${[1, 2, 4, 8][per]}초`); }
        w.schedule(x, y, z, 2, 1);
        this.sound.play('click_on', x + 0.5, y + 0.5, z + 0.5);
        return true;
      }
    }
    return false;
  }
  useWrench(x, y, z) {
    const w = this.world;
    if (w.remote) { this.net.send({ t: 'use', x, y, z, wrench: 1 }); return; }
    const id = w.getBlock(x, y, z), d = BLOCKS[id], m = w.getMeta(x, y, z);
    if (!d) return;
    let nm = m;
    if (d.facingH || d.shape === 'diode') nm = (m & ~7) | CW[m & 7];
    else if (d.facing6 && !(m & 8 && d.rs === 'piston')) nm = (m & ~7) | (((m & 7) + 1) % 6);
    else if (d.axis) nm = (m + 1) % 3;
    else if (d.rail) { const cnt = id === BL.rail ? 10 : 6; nm = id === BL.rail ? ((m & 15) + 1) % cnt : (m & 8) | (((m & 7) + 1) % 6); }
    else return;
    if (d.rs === 'piston' && (m & 8)) return;
    w.setBlock(x, y, z, id, nm);
    this.sound.play('click_on', x + 0.5, y + 0.5, z + 0.5);
  }
  placeBlock(hit, bid, held) {
    const p = this.player, w = this.world;
    const d = BLOCKS[bid]; if (!d) return;
    const td = BLOCKS[hit.id];
    let x = hit.x + DX[hit.face], y = hit.y + DY[hit.face], z = hit.z + DZ[hit.face];
    let face = hit.face;
    // 반 블록 합치기
    if ((d.shape === 'slab') && hit.id === bid) {
      const hm = hit.meta & 1;
      if ((hm === 0 && face === 1) || (hm === 1 && face === 0)) {
        const full = bid === BL.stone_slab ? BL.smooth_stone : bid === BL.oak_slab ? BL.oak_planks : BL.sandstone;
        this.setBlockNet(hit.x, hit.y, hit.z, full, 0); this.afterPlace(hit.x, hit.y, hit.z, full); return;
      }
    }
    if (td.replace && hit.id !== bid) { x = hit.x; y = hit.y; z = hit.z; face = 1; }
    if (y < 0 || y >= HEIGHT) return;
    const cur = w.getBlock(x, y, z);
    if (cur && !BLOCKS[cur].replace) {
      if (!(d.shape === 'slab' && cur === bid)) return;
      const cm = w.getMeta(x, y, z);
      const full = bid === BL.stone_slab ? BL.smooth_stone : bid === BL.oak_slab ? BL.oak_planks : BL.sandstone;
      this.setBlockNet(x, y, z, full, 0); this.afterPlace(x, y, z, full); return;
    }
    // 방향 / 메타
    let meta = 0;
    const hy = hit.hit ? hit.hit[1] - hit.y : 0.5;
    const lh = this.lookDirH();
    if (d.axis) meta = face < 2 ? 0 : face < 4 ? 2 : 1;
    else if (d.shape === 'torch') {
      if (face === 0) return;
      meta = face === 1 ? 0 : OPP[face];
    } else if (d.shape === 'lever' || d.shape === 'button') meta = OPP[face];
    else if (d.shape === 'ladder') { if (face < 2) return; meta = OPP[face]; }
    else if (d.shape === 'diode') meta = lh;
    else if (d.shape === 'stairs') { meta = lh; if (face === 0 || (face > 1 && hy > 0.5)) meta |= 8; }
    else if (d.shape === 'slab') { if (face === 0 || (face > 1 && hy > 0.5)) meta = 1; }
    else if (d.shape === 'trapdoor') { meta = lh; if (face === 0 || (face > 1 && hy > 0.5)) meta |= 16; }
    else if (d.shape === 'door') meta = lh;
    else if (d.facing6) { const l6 = this.lookDir6(); meta = d.faceToPlayer ? OPP[l6] : l6; }
    else if (bid === BL.hopper) meta = face >= 2 ? OPP[face] : 0;
    else if (d.facingH) meta = d.faceAway ? lh : OPP[lh];
    else if (d.rail) {
      meta = computeRailShape(w, x, y, z, bid, lh);
    }
    if (d.wave === 1) meta = 1;
    // 받침 확인
    if (!this.supportOk(x, y, z, bid, meta)) return;
    if (d.shape === 'door' && (y + 1 >= HEIGHT || (w.getBlock(x, y + 1, z) && !BLOCKS[w.getBlock(x, y + 1, z)].replace))) return;
    // 개체와 겹침
    if (d.solid) {
      const bs = blockBoxes(bid, meta, false, w, x, y, z) || [];
      const pb = p.aabb();
      for (const b of bs) {
        const bb = [x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]];
        if (bb[0] < pb[3] - 0.001 && bb[3] > pb[0] + 0.001 && bb[1] < pb[4] - 0.001 && bb[4] > pb[1] + 0.001 && bb[2] < pb[5] - 0.001 && bb[5] > pb[2] + 0.001) return;
        for (const e of this.ents.list) if (e.type === 'mob' && !e.dead) { const r = e.w / 2; if (bb[0] < e.x + r && bb[3] > e.x - r && bb[1] < e.y + e.h && bb[4] > e.y && bb[2] < e.z + r && bb[5] > e.z - r) return; }
        for (const r of this.remotes.values()) if (bb[0] < r.x + 0.3 && bb[3] > r.x - 0.3 && bb[1] < r.y + 1.8 && bb[4] > r.y && bb[2] < r.z + 0.3 && bb[5] > r.z - 0.3) return;
      }
    }
    this.setBlockNet(x, y, z, bid, meta);
    if (d.shape === 'door') this.setBlockNet(x, y + 1, z, bid, meta | 16);
    if (d.rail) this.updateRailNeighbors(x, y, z);
    this.afterPlace(x, y, z, bid);
    p.consumeHeld(1);
  }
  afterPlace(x, y, z, bid) {
    this.swing = 1;
    this.sound.play('place', x + 0.5, y + 0.5, z + 0.5, { mat: BLOCKS[bid].sound });
  }
  updateRailNeighbors(x, y, z) {
    const w = this.world;
    for (let d = 2; d < 6; d++) for (const oy of [0, 1, -1]) {
      const nx = x + DX[d], ny = y + oy, nz = z + DZ[d];
      const nid = w.getBlock(nx, ny, nz);
      if (!isRail(nid)) continue;
      const nm = w.getMeta(nx, ny, nz);
      const shape = railShapeOf(nid, nm);
      // 이웃이 이미 두 방향 모두 다른 레일과 연결되어 있으면 유지
      let linked = 0;
      for (const dd of RAIL_DIRS[shape]) { if (railConnectable(w, nx + DX[dd], ny, nz + DZ[dd]) !== null) linked++; }
      if (linked >= 2 && RAIL_DIRS[shape].includes(OPP[d])) continue;
      if (linked >= 2) continue;
      const ns = computeRailShape(w, nx, ny, nz, nid, d);
      const newMeta = nid === BL.rail ? ns : (nm & 8) | ns;
      if (newMeta !== nm) this.setBlockNet(nx, ny, nz, nid, newMeta);
    }
  }

  // =================== 전기 회로 도우미 (redstone.js 에서 호출) ===================
  // 효과음: 로컬 재생 + (호스트면) 참가자에게도 전달
  sfx(n, x, y, z, o) {
    this.sound.play(n, x, y, z, o);
    if (this.net.isHost && !SFX_LOCAL.has(n)) this.net.broadcast({ t: 'snd', n, p: [x, y, z], o });
  }
  playNoteBlock(x, y, z, note) {
    const w = this.world;
    const d = BLOCKS[w.getBlock(x, y, z)];
    const inst = noteInstrument(w, x, y, z, d && d.speaker);
    this.sfx('note', x + 0.5, y + 0.5, z + 0.5, { note, inst });
    const hue = note / 24;
    this.particles.dust(x + 0.5, y + 1.2, z + 0.5, [clamp(Math.abs(hue * 6 - 3) - 1, 0, 1), clamp(2 - Math.abs(hue * 6 - 2), 0, 1), clamp(2 - Math.abs(hue * 6 - 4), 0, 1)]);
  }
  igniteTNT(x, y, z) {
    if (this.world.remote) return;
    if (this.world.getBlock(x, y, z) !== BL.tnt) return;
    this.world.setBlock(x, y, z, 0, 0);
    this.ents.add(new TNTEntity(x + 0.5, y, z + 0.5));
    this.sfx('fuse', x + 0.5, y + 0.5, z + 0.5);
  }
  explode(x, y, z, power, noGrief) {
    const w = this.world;
    this.sfx('explode', x, y, z);
    this.particles.smoke(x, y, z, 40, [0.85, 0.85, 0.85], true);
    this.particles.smoke(x, y, z, 12, [1, 0.8, 0.3], true);
    if (this.net.isHost) this.net.broadcast({ t: 'boom', p: [x, y, z] });
    if (this.worldRules.tntGrief && !noGrief) {
      const r = Math.ceil(power);
      const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        const dist = Math.hypot(dx, dy, dz);
        if (dist > power * (0.65 + Math.random() * 0.5)) continue;
        const X = bx + dx, Y = by + dy, Z = bz + dz;
        const id = w.getBlock(X, Y, Z);
        if (!id || IS_FLUID[id]) continue;
        const d = BLOCKS[id];
        if (d.hard < 0 || id === BL.obsidian || d.hard >= 30) continue;
        if (id === BL.tnt) { w.setBlock(X, Y, Z, 0, 0); const t = this.ents.add(new TNTEntity(X + 0.5, Y, Z + 0.5, 10 + Math.random() * 20)); continue; }
        const meta = w.getMeta(X, Y, Z);
        w.setBlock(X, Y, Z, 0, 0);
        if (Math.random() < 0.3) this.dropBlockItems(X, Y, Z, id, meta, { kind: d.tool, tier: 4 });
      }
    }
    // 개체 피해
    const affect = (e, isPlayer) => {
      const ex = e.x, ey = e.y + (e.h || 1.8) / 2, ez = e.z;
      const dd = Math.hypot(ex - x, ey - y, ez - z);
      if (dd > power * 2) return;
      const k = 1 - dd / (power * 2);
      const dmg = Math.round(k * power * 5);
      const nx = (ex - x) / (dd || 1), nz = (ez - z) / (dd || 1);
      if (isPlayer) { this.hurtPlayer(e, dmg, 'explosion', nx * k * 2, nz * k * 2); e.vy += k * 10; }
      else { e.vx += nx * k * 12; e.vz += nz * k * 12; e.vy += k * 8; if (e.type === 'mob') this.damageEntity(e, dmg, nx, nz, 'explosion'); }
    };
    affect(this.player, true);
    for (const r of this.remotes.values()) affect(r, true);
    for (const e of this.ents.list) if (!e.dead && e.type !== 'moving' && !(e.def && e.def.boss)) affect(e, false);
  }
  dispense(x, y, z, f, dropper) {
    const w = this.world;
    const be = w.be.get(fmtKey(x, y, z)); if (!be || !be.items) return;
    const slots = []; be.items.forEach((it, i) => { if (it) slots.push(i); });
    if (!slots.length) { this.sfx('click_off', x + 0.5, y + 0.5, z + 0.5); return; }
    const si = slots[Math.random() * slots.length | 0];
    const it = be.items[si];
    const ox = x + 0.5 + DX[f] * 0.7, oy = y + 0.5 + DY[f] * 0.7, oz = z + 0.5 + DZ[f] * 0.7;
    const tx = x + DX[f], ty = y + DY[f], tz = z + DZ[f];
    const take = () => { it.n--; if (it.n <= 0) be.items[si] = null; this.redstone.queueAround(x, y, z); if (this.net.isHost) this.net.broadcast({ t: 'be', k: fmtKey(x, y, z), v: be }); };
    const d = ITEMS[it.id];
    if (!dropper) {
      if (d.name === 'arrow') { this.spawnArrow(ox, oy, oz, DX[f] * 30 + (Math.random() - 0.5), DY[f] * 30 + 1, DZ[f] * 30 + (Math.random() - 0.5), 'dispenser'); take(); this.sfx('bow', ox, oy, oz); return; }
      if (d.fluid) { const cur = w.getBlock(tx, ty, tz); if (!cur || BLOCKS[cur].replace) { w.setBlock(tx, ty, tz, d.fluid, 0); be.items[si] = { id: I('bucket'), n: 1 }; this.redstone.queueAround(x, y, z); } return; }
      if (d.name === 'bucket') { const cur = w.getBlock(tx, ty, tz); if (IS_FLUID[cur] && w.getMeta(tx, ty, tz) === 0) { w.setBlock(tx, ty, tz, 0, 0); be.items[si] = { id: cur === BL.water ? I('water_bucket') : I('lava_bucket'), n: 1 }; } return; }
      if (it.id === BL.tnt) { const cur = w.getBlock(tx, ty, tz); if (!cur || BLOCKS[cur].replace) { this.ents.add(new TNTEntity(tx + 0.5, ty, tz + 0.5)); take(); this.sfx('fuse', tx, ty, tz); } return; }
      if (d.name === 'flint_and_steel') { if (w.getBlock(tx, ty, tz) === BL.tnt) this.igniteTNT(tx, ty, tz); return; }
      if (d.name === 'minecart') { if (isRail(w.getBlock(tx, ty, tz))) { this.ents.add(new Minecart(tx + 0.5, ty + 0.1, tz + 0.5)); take(); } return; }
    }
    // 공급기(또는 일반 아이템): 앞에 컨테이너가 있으면 넣고, 없으면 던짐
    const tb = w.be.get(fmtKey(tx, ty, tz));
    if (dropper && tb && tb.items && tb.t !== 'furnace') {
      for (let i = 0; i < tb.items.length; i++) {
        const s = tb.items[i];
        if (!s || (s.id === it.id && s.n < itemMaxStack(it.id) && !s.d)) {
          if (!s) tb.items[i] = { id: it.id, n: 1 }; else s.n++;
          take(); this.redstone.queueAround(tx, ty, tz); if (this.net.isHost) this.net.broadcast({ t: 'be', k: fmtKey(tx, ty, tz), v: tb }); return;
        }
      }
      return;
    }
    const one = { id: it.id, n: 1 }; if (it.d) one.d = it.d;
    this.dropItem(ox, oy - 0.2, oz, one, [DX[f] * 5 + (Math.random() - 0.5), DY[f] * 5 + 1.5, DZ[f] * 5 + (Math.random() - 0.5)]);
    take(); this.sfx('click_on', ox, oy, oz);
  }
  targetHit(x, y, z) {
    if (this.world.remote) return;
    this.world.setBlock(x, y, z, BL.target, 15);
    this.world.schedule(x, y, z, 20, 1);
  }
  entitiesOnPlate(x, y, z, anyEnt) {
    const inside = (ex, ey, ez, r) => ex + r > x && ex - r < x + 1 && ez + r > z && ez - r < z + 1 && ey >= y - 0.01 && ey < y + 0.5;
    const p = this.player;
    if (!p.dead && inside(p.x, p.y, p.z, 0.3)) return true;
    for (const r of this.remotes.values()) if (inside(r.x, r.y, r.z, 0.3)) return true;
    for (const e of this.ents.list) if (!e.dead && (e.type === 'mob' || e.type === 'cart' || (anyEnt && (e.type === 'item' || e.type === 'arrow'))) && inside(e.x, e.y, e.z, e.w / 2)) return true;
    return false;
  }
  checkPlates() {
    const w = this.world;
    const check = (ex, ey, ez, isItem) => {
      const bx = Math.floor(ex), by = Math.floor(ey + 0.05), bz = Math.floor(ez);
      const id = w.getBlock(bx, by, bz);
      if (id !== BL.stone_pressure_plate && id !== BL.oak_pressure_plate) return;
      if (isItem && id === BL.stone_pressure_plate) return;
      const m = w.getMeta(bx, by, bz);
      if (!(m & 8)) {
        w.setBlock(bx, by, bz, id, m | 8); this.redstone.queueAround(bx, by - 1, bz);
        this.sfx('click_on', bx + 0.5, by, bz + 0.5);
        w.schedule(bx, by, bz, 10, 1);
      }
    };
    const p = this.player; if (!p.dead) check(p.x, p.y, p.z);
    for (const r of this.remotes.values()) check(r.x, r.y, r.z);
    for (const e of this.ents.list) if (!e.dead && (e.type === 'mob' || e.type === 'cart' || e.type === 'item' || e.type === 'arrow')) check(e.x, e.y, e.z, e.type === 'item' || e.type === 'arrow');
  }
  entitiesNear(x, y, z, r) {
    const p = this.player;
    const near = (ex, ey, ez) => (ex - x) ** 2 + (ey - y) ** 2 + (ez - z) ** 2 <= r * r;
    if (!p.dead && near(p.x, p.y + 1, p.z)) return true;
    for (const rp of this.remotes.values()) if (near(rp.x, rp.y + 1, rp.z)) return true;
    for (const e of this.ents.list) if (!e.dead && e.type === 'mob' && near(e.x, e.y + 0.5, e.z)) return true;
    return false;
  }
  cartOn(x, y, z) { for (const e of this.ents.list) if (!e.dead && e.type === 'cart' && Math.floor(e.x) === x && Math.floor(e.z) === z && Math.abs(e.y - y) < 1.2) return true; return false; }
  pushEntities(cells, f) {
    const hitCell = (b) => { for (const [cx, cy, cz] of cells) { if (b[0] < cx + 1 && b[3] > cx && b[1] < cy + 1 && b[4] > cy && b[2] < cz + 1 && b[5] > cz) return true; } return false; };
    const p = this.player;
    const push = (e) => { e.x += DX[f] * 1.01; e.y += DY[f] * 1.01; e.z += DZ[f] * 1.01; if (DY[f] > 0) e.vy = Math.max(e.vy || 0, 4); };
    if (hitCell(p.aabb())) push(p);
    for (const e of this.ents.list) if (!e.dead && e.type !== 'moving' && hitCell(e.aabb())) push(e);
    for (const [id, r] of this.remotes) { const b = [r.x - 0.3, r.y, r.z - 0.3, r.x + 0.3, r.y + 1.8, r.z + 0.3]; if (hitCell(b)) this.net.sendTo(id, { t: 'push', d: [DX[f] * 1.01, DY[f] * 1.01, DZ[f] * 1.01] }); }
  }
  pistonAnim(list, f, px, py, pz, extend) {
    for (const [x, y, z, id, meta] of list) this.ents.add(new MovingBlockFx(x, y, z, id, meta, f));
    if (this.net.isHost) this.net.broadcast({ t: 'pa', l: list, f });
  }
  tickFans() {
    if (!this.fans.size) return;
    const w = this.world;
    const affected = [this.player, ...this.ents.list.filter(e => !e.dead && (e.type === 'mob' || e.type === 'item' || e.type === 'arrow' || e.type === 'tnt'))];
    for (const k of this.fans) {
      const [x, y, z] = parseKey(k);
      const m = w.getMeta(x, y, z);
      if (w.getBlock(x, y, z) !== BL.fan || !(m & 8)) { this.fans.delete(k); continue; }
      const f = m & 7;
      let len = 0;
      for (let i = 1; i <= 8; i++) { const id = w.getBlock(x + DX[f] * i, y + DY[f] * i, z + DZ[f] * i); if (id && BLOCKS[id].solid) break; len = i; }
      if (!len) continue;
      const x0 = Math.min(x, x + DX[f] * len), x1 = Math.max(x, x + DX[f] * len) + 1;
      const y0 = Math.min(y, y + DY[f] * len), y1 = Math.max(y, y + DY[f] * len) + 1;
      const z0 = Math.min(z, z + DZ[f] * len), z1 = Math.max(z, z + DZ[f] * len) + 1;
      for (const e of affected) {
        if (e.x < x0 || e.x > x1 || e.z < z0 || e.z > z1 || e.y + (e.h || 1) < y0 || e.y > y1) continue;
        const dist = Math.hypot(e.x - x - 0.5, e.y - y, e.z - z - 0.5);
        const s = 1.6 * (1 - dist / 10);
        e.vx += DX[f] * s; e.vz += DZ[f] * s; e.vy += DY[f] * s * 1.4 + (DY[f] > 0 ? 1.2 : 0);
        if (e === this.player) { e.fallDist = 0; }
      }
      if (w.tick % 3 === 0) this.particles.add({ x: x + 0.5 + DX[f] * 0.6 + (Math.random() - 0.5) * 0.6, y: y + 0.5 + DY[f] * 0.6 + (Math.random() - 0.5) * 0.6, z: z + 0.5 + DZ[f] * 0.6 + (Math.random() - 0.5) * 0.6, vx: DX[f] * 6, vy: DY[f] * 6, vz: DZ[f] * 6, life: len / 6, size: 0.04, layer: T('white'), u: 0, v: 0, g: 0, tint: [0.9, 0.95, 1] });
    }
  }
  elevatorLaunch(x, y, z) {
    const lift = (e) => { if (Math.abs(e.x - x - 0.5) < 0.8 && Math.abs(e.z - z - 0.5) < 0.8 && e.y >= y + 0.9 && e.y < y + 2) { e.vy = 17; e.fallDist = 0; } };
    lift(this.player);
    for (const e of this.ents.list) if (!e.dead) lift(e);
    for (const [id, r] of this.remotes) if (Math.abs(r.x - x - 0.5) < 0.8 && Math.abs(r.z - z - 0.5) < 0.8 && r.y >= y + 0.9 && r.y < y + 2) this.net.sendTo(id, { t: 'launch' });
    this.sfx('elevator', x + 0.5, y + 1, z + 0.5);
  }
  // 엘리베이터 블록 위에서 점프 → 위층, 웅크리기 → 아래층
  elevatorCheck(s) {
    const p = this.player, w = this.world;
    if (!p.onGround || p.flying) { this.elevLatch = false; return; }
    const bx = Math.floor(p.x), by = Math.floor(p.y - 0.1), bz = Math.floor(p.z);
    if (w.getBlock(bx, by, bz) !== BL.elevator) return;
    const jumpEdge = s.jump && !this.elevJump; this.elevJump = s.jump;
    const sneakEdge = this.input.ev.sneakPress;
    let dir = jumpEdge ? 1 : sneakEdge ? -1 : 0;
    if (!dir) return;
    for (let i = 2; i < 24; i++) {
      const yy = by + dir * i;
      if (w.getBlock(bx, yy, bz) === BL.elevator && !BLOCKS[w.getBlock(bx, yy + 1, bz)].solid && !BLOCKS[w.getBlock(bx, yy + 2, bz)].solid) {
        p.y = yy + 1; p.vy = 0; this.sound.play('elevator', p.x, p.y, p.z); return;
      }
    }
  }
  // ---- 깔때기: 위에서 빨아들이고 주둥이 쪽으로 보냄 ----
  hopperInsert(be, it, slotFilter) {
    for (let i = 0; i < be.items.length; i++) {
      if (slotFilter && !slotFilter(i, it)) continue;
      const s = be.items[i];
      if (!s) { be.items[i] = { id: it.id, n: 1 }; if (it.d) be.items[i].d = it.d; return true; }
      if (s.id === it.id && !s.d && !it.d && s.n < itemMaxStack(s.id)) { s.n++; return true; }
    }
    return false;
  }
  tickHoppers() {
    if (!this.hoppers.size) return;
    const w = this.world;
    for (const k of this.hoppers) {
      const be = w.be.get(k); if (!be || be.t !== 'hopper') { this.hoppers.delete(k); continue; }
      if (be.cd > 0) { be.cd--; continue; }
      const [x, y, z] = parseKey(k);
      if (w.getBlock(x, y, z) !== BL.hopper) continue;
      const m = w.getMeta(x, y, z);
      if (m & 8) continue;
      let moved = false;
      // 내보내기
      const f = m & 7;
      const tk = fmtKey(x + DX[f], y + DY[f], z + DZ[f]);
      const tb = w.be.get(tk);
      if (tb && tb.items) {
        for (let i = 0; i < be.items.length && !moved; i++) {
          const it = be.items[i]; if (!it) continue;
          let filter = null;
          if (tb.t === 'furnace') filter = f === 0 ? (si) => si === 0 : (si, x2) => si === 1 && !!FUEL[x2.id];
          if (this.hopperInsert(tb, it, filter)) { it.n--; if (!it.n) be.items[i] = null; moved = true; this.afterContainerChange(tk, tb); }
        }
      }
      // 빨아들이기: 위 컨테이너
      const ak = fmtKey(x, y + 1, z), ab = w.be.get(ak);
      if (ab && ab.items) {
        const order = ab.t === 'furnace' ? [2] : ab.items.map((_, i) => i);
        for (const i of order) {
          const it = ab.items[i]; if (!it) continue;
          if (this.hopperInsert(be, it)) { it.n--; if (!it.n) ab.items[i] = null; moved = true; this.afterContainerChange(ak, ab); break; }
        }
      } else {
        // 위에 떨어진 아이템
        for (const e of this.ents.list) {
          if (e.dead || e.type !== 'item') continue;
          if (e.x < x || e.x > x + 1 || e.z < z || e.z > z + 1 || e.y < y + 0.9 || e.y > y + 2) continue;
          while (e.item.n > 0 && this.hopperInsert(be, e.item)) { e.item.n--; moved = true; }
          if (e.item.n <= 0) e.dead = true;
          break;
        }
      }
      if (moved) { be.cd = 8; this.afterContainerChange(k, be); }
    }
  }
  afterContainerChange(k, be) {
    const [x, y, z] = parseKey(k);
    this.redstone.queueAround(x, y, z);
    if (this.net.isHost) this.net.broadcast({ t: 'be', k, v: be });
  }
  // ---- 컨베이어 벨트 ----
  conveyorAt(e) {
    const w = this.world;
    const bx = Math.floor(e.x), by = Math.floor(e.y - 0.05), bz = Math.floor(e.z);
    if (w.getBlock(bx, by, bz) !== BL.conveyor) return -1;
    const m = w.getMeta(bx, by, bz);
    if (!(m & 8) || e.y - by > 0.5) return -1;
    return m & 7;
  }
  conveyorMove(e, dt) {
    const f = this.conveyorAt(e); if (f < 0) return;
    const sp = 2.6;
    e.move(this.world, DX[f] * sp * dt, 0, DZ[f] * sp * dt);
    if (DX[f] === 0) e.move(this.world, (Math.floor(e.x) + 0.5 - e.x) * Math.min(1, dt * 4), 0, 0);
    else e.move(this.world, 0, 0, (Math.floor(e.z) + 0.5 - e.z) * Math.min(1, dt * 4));
  }
  tickConveyors() {
    for (const e of this.ents.list) if (!e.dead && !e.remote && (e.type === 'item' || e.type === 'mob' || e.type === 'tnt')) this.conveyorMove(e, 0.05);
  }
  tickFurnaces() {
    const w = this.world;
    for (const k of this.furnaces) {
      const be = w.be.get(k); if (!be || be.t !== 'furnace') { this.furnaces.delete(k); continue; }
      const [inp, fuel, out] = be.items;
      const res = inp ? SMELT[inp.id] : undefined;
      const canSmelt = res !== undefined && (!out || (out.id === res && out.n < itemMaxStack(res)));
      let changed = false;
      if (be.burn > 0) be.burn--;
      if (be.burn <= 0 && canSmelt && fuel && FUEL[fuel.id]) {
        be.burn = be.burnMax = FUEL[fuel.id];
        if (fuel.id === I('lava_bucket')) be.items[1] = { id: I('bucket'), n: 1 };
        else { fuel.n--; if (fuel.n <= 0) be.items[1] = null; }
        changed = true;
      }
      if (be.burn > 0 && canSmelt) {
        be.cook++;
        if (be.cook >= 200) {
          be.cook = 0; inp.n--; if (inp.n <= 0) be.items[0] = null;
          if (out) out.n++; else be.items[2] = { id: res, n: 1 };
          changed = true;
        }
      } else if (be.cook > 0) be.cook = Math.max(0, be.cook - 2);
      const [x, y, z] = parseKey(k);
      const m = w.getMeta(x, y, z);
      const lit = be.burn > 0;
      if (w.getBlock(x, y, z) === BL.furnace && !!(m & 8) !== lit) w.setBlock(x, y, z, BL.furnace, lit ? m | 8 : m & ~8, 2);
      if (changed) { this.redstone.queueAround(x, y, z); if (this.net.isHost) this.net.broadcast({ t: 'be', k, v: be }); }
      else if (this.net.isHost && w.tick % 10 === 0 && (be.burn > 0 || be.cook > 0)) this.net.broadcast({ t: 'be', k, v: be });
    }
  }
  // =================== 몹 ===================
  allPlayers() {
    const a = [this.player];
    for (const r of this.remotes.values()) a.push(r);
    return a;
  }
  spawnMobs() {
    const w = this.world;
    const passive = this.ents.count(e => e.type === 'mob' && !e.def.hostile);
    const hostile = this.ents.count(e => e.type === 'mob' && e.def.hostile);
    const day = w.dayFactor();
    for (const pl of this.allPlayers()) {
      for (let a = 0; a < 6; a++) {
        const ang = Math.random() * Math.PI * 2, dist = 22 + Math.random() * 26;
        const x = Math.floor(pl.x + Math.cos(ang) * dist), z = Math.floor(pl.z + Math.sin(ang) * dist);
        if (!w.isLoadedAt(x, z)) continue;
        let y = w.surfaceY(x, z);
        const cave = Math.random() < 0.35 && !this.settings.peaceful;
        if (cave) {
          let found = false;
          for (let k = 0; k < 10; k++) {
            const yy = 6 + (Math.random() * (y - 10) | 0);
            if (!w.getBlock(x, yy, z) && !w.getBlock(x, yy + 1, z) && BLOCKS[w.getBlock(x, yy - 1, z)].solid && !IS_FLUID[w.getBlock(x, yy - 1, z)]) { y = yy; found = true; break; }
          }
          if (!found) continue;
        }
        const below = w.getBlock(x, y - 1, z);
        if (!BLOCKS[below].solid || IS_FLUID[below] || w.getBlock(x, y, z) || w.getBlock(x, y + 1, z)) continue;
        if (below === BL.oak_leaves || below === BL.birch_leaves || below === BL.spruce_leaves) continue;
        const L = w.getLight(x, y, z);
        const eff = Math.max(L & 15, (L >> 4) * day);
        if (!this.settings.peaceful && eff <= 7 && hostile < 18) {
          const r = Math.random();
          const sub = r < 0.45 ? 'zombie' : r < 0.75 ? 'skeleton' : 'creeper';
          this.ents.add(new Mob(sub, x + 0.5, y, z + 0.5));
          return;
        } else if (!cave && eff >= 9 && (below === BL.grass || below === BL.grass_snow) && passive < 10 && Math.random() < 0.2) {
          const subs = ['pig', 'cow', 'sheep', 'chicken'];
          const sub = subs[Math.random() * 4 | 0];
          const cnt = 2 + (Math.random() * 2 | 0);
          for (let i = 0; i < cnt; i++) { const ox = x + (Math.random() * 3 | 0) - 1, oz = z + (Math.random() * 3 | 0) - 1; if (!w.getBlock(ox, y, oz) && BLOCKS[w.getBlock(ox, y - 1, oz)].solid) this.ents.add(new Mob(sub, ox + 0.5, y, oz + 0.5)); }
          return;
        }
      }
    }
  }
  despawnMobs() {
    const pls = this.allPlayers();
    for (const e of this.ents.list) {
      if (e.type !== 'mob' || e.dead || e.def.boss || e.def.persist || e.tamed) continue;
      let md = Infinity; for (const p of pls) md = Math.min(md, (p.x - e.x) ** 2 + (p.z - e.z) ** 2);
      if (e.def.hostile && md > 80 * 80) e.dead = true;
      else if (!e.def.hostile && md > 140 * 140) e.dead = true;
    }
  }
  damageEntity(e, dmg, kx, kz, src) {
    if (e.remote) { this.net.send({ t: 'hit', eid: e.eid, dmg, kx, kz }); this.sound.play('mob_hurt', e.x, e.y + 1, e.z); return; }
    if (e.type === 'cart') {
      e.hp -= dmg; e.vx += kx * 2; e.vz += kz * 2;
      if (e.hp <= 0) { e.dead = true; if (e.rider) this.dismount(e.rider); this.dropItem(e.x, e.y + 0.5, e.z, { id: I('minecart'), n: 1 }); }
      return;
    }
    if (e.type !== 'mob' || e.hurtT > 0.25) return;
    e.hp -= dmg; e.hurtT = 0.45;
    e.vx += kx * 7; e.vz += kz * 7; if (e.onGround) e.vy = 5.5;
    if (!e.def.hostile) { e.panic = 5; e.yaw = Math.atan2(kx, kz) + Math.PI; }
    this.sfx('mob_hurt', e.x, e.y + 1, e.z, { pitch: e.sub === 'chicken' ? 1.8 : e.sub === 'pig' ? 1.3 : 0.9 });
    if (e.hp <= 0) {
      e.dead = true;
      if (e.onDeath) e.onDeath(this);
      this.particles.smoke(e.x, e.y + 0.5, e.z, 10, [0.9, 0.9, 0.9]);
      const drops = [];
      for (const [name, a, b] of e.def.drops) { const n = a + Math.floor(Math.random() * (b - a + 1)); if (n > 0) drops.push({ id: I(name), n }); }
      if (src && src.startsWith && src.startsWith('client:')) this.net.sendTo(src.slice(7), { t: 'drops', p: [e.x, e.y + 0.5, e.z], items: drops });
      else for (const it of drops) this.dropItem(e.x, e.y + 0.5, e.z, it);
    }
  }
  hurtPlayer(p, dmg, src, kx, kz) {
    if (p === this.player) { p.hurt(dmg, src, kx, kz); return; }
    for (const [id, r] of this.remotes) if (r === p) this.net.sendTo(id, { t: 'hurt', dmg, src, kx, kz });
  }
  onPlayerHurt(amount, src) { this.hurtFx = 1; this.ui.refreshStats(); }
  onPlayerDeath(src) {
    const p = this.player;
    const msg = { fall: '높은 곳에서 떨어졌습니다', drown: '물에 빠졌습니다', lava: '용암에 빠졌습니다', mob: '몬스터에게 당했습니다', arrow: '화살에 맞았습니다', explosion: '폭발에 휘말렸습니다', cactus: '선인장에 찔렸습니다', fire: '불에 탔습니다', dragon: '엔더 드래곤에게 당했습니다', starve: '굶주렸습니다', void: '세계 밖으로 떨어졌습니다' }[src] || '쓰러졌습니다';
    if (!this.worldRules.keepInventory && !p.creative) {
      for (let i = 0; i < 36; i++) if (p.inv[i]) { this.dropItem(p.x, p.y + 1, p.z, p.inv[i], [(Math.random() - 0.5) * 5, 3, (Math.random() - 0.5) * 5]); p.inv[i] = null; }
      for (let i = 0; i < 4; i++) if (p.armor[i]) { this.dropItem(p.x, p.y + 1, p.z, p.armor[i], [(Math.random() - 0.5) * 5, 3, (Math.random() - 0.5) * 5]); p.armor[i] = null; }
    }
    this.ui.chatLine(`📍 쓰러진 곳: X ${Math.floor(p.x)} · Y ${Math.floor(p.y)} · Z ${Math.floor(p.z)}`, '#ffe27a');
    if (p.riding) this.dismount(p);
    this.net.sendChat(`☠ ${p.name}님이 ${msg}`);
    this.ui.showDeath(msg);
    this.input.releaseLock();
  }
  respawn() {
    const p = this.player, w = this.world;
    p.dead = false; p.health = 20; p.food = 20; p.sat = 5; p.air = 300; p.vx = p.vy = p.vz = 0; p.fallDist = 0;
    p.x = p.spawn[0]; p.y = p.spawn[1]; p.z = p.spawn[2];
    if (w.isLoadedAt(Math.floor(p.x), Math.floor(p.z))) { let g = 0; while (g++ < 200 && (BLOCKS[w.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].solid || BLOCKS[w.getBlock(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z))].solid)) p.y++; }
    this.ui.hideDeath(); this.ui.refreshHotbar(); this.ui.refreshStats();
    if (!this.input.touch) this.input.requestLock();
  }
  spawnArrow(x, y, z, vx, vy, vz, owner) {
    if (this.world.remote) { this.net.send({ t: 'arrow', p: [x, y, z, vx, vy, vz] }); return; }
    const a = this.ents.add(new ArrowEntity(x, y, z, vx, vy, vz, owner));
    return a;
  }
  hitTestEntities(x, y, z, r, owner) {
    for (const e of this.ents.list) {
      if (e.dead || e.type !== 'mob') continue;
      if (owner === 'mob' && e.def.hostile) continue;
      const hw = e.w / 2 + r;
      if (x > e.x - hw && x < e.x + hw && z > e.z - hw && z < e.z + hw && y > e.y - r && y < e.y + e.h + r) return e;
    }
    if (owner !== 'player') {
      const p = this.player;
      if (!p.dead && Math.abs(x - p.x) < 0.3 + r && Math.abs(z - p.z) < 0.3 + r && y > p.y && y < p.y + 1.8) return p;
      for (const rp of this.remotes.values()) if (Math.abs(x - rp.x) < 0.3 + r && Math.abs(z - rp.z) < 0.3 + r && y > rp.y && y < rp.y + 1.8) return rp;
    }
    return null;
  }
  lineOfSight(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d = Math.hypot(dx, dy, dz);
    const n = Math.ceil(d * 2);
    for (let i = 1; i < n; i++) { const t = i / n; const id = this.world.getBlock(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t), Math.floor(z0 + dz * t)); if (id && IS_OPAQUE[id]) return false; }
    return true;
  }
  ride(cart) {
    const p = this.player;
    if (cart.remote) { this.net.send({ t: 'ride', eid: cart.eid }); p.riding = cart; return; }
    if (cart.rider && cart.rider !== p) return;
    p.riding = cart; cart.rider = p; p.flying = false;
  }
  dismount(p) {
    const c = p.riding; if (!c) return;
    if (c.rider === p) c.rider = null;
    p.riding = null; p.y = c.y + 0.8; p.x += 0.8; p.vy = 2;
    if (c.remote) this.net.send({ t: 'ride', eid: 0 });
  }
  stepSound(e, land) {
    const id = this.world.getBlock(Math.floor(e.x), Math.floor(e.y - 0.2), Math.floor(e.z));
    if (id) this.sound.play('step', e.x, e.y, e.z, { mat: BLOCKS[id].sound, vol: land ? 1.2 : 0.8 });
  }

  // =================== 렌더 ===================
  itemMesh(id) {
    const MESH3D = ITEM_MESH3D;
    const d = ITEMS[id];
    const b = d && d.block ? BLOCKS[id] : null;
    if (b && !d.icon || (b && MESH3D.has(b.shape) && b.shape !== 'cross')) {
      if (b && MESH3D.has(b.shape)) {
        let meta = 0;
        if (b.shape === 'torch' || b.shape === 'lever' || b.shape === 'button') meta = 0;
        if (b.facingH || b.shape === 'diode') meta = 2;
        if (b.facing6) meta = b.faceToPlayer ? 3 : 2;
        const m = this.blockMesh(id, meta);
        return m;
      }
    }
    return this.flatItemMesh(id);
  }
  blockMesh(id, meta) { return meshSingleBlock(this.mesher, id, meta); }
  flatItemMesh(id) {
    let m = this.flatMeshes.get(id);
    if (m) return m;
    const d = ITEMS[id];
    const layer = d.icon ? T(d.icon) : d.block ? blockTex(BLOCKS[id], 0, 2) : T(d.tex);
    const b = new MeshBuf(8);
    const tint = d.block && (BLOCKS[id].tint === 'grass' || BLOCKS[id].tint === 'leaves') ? [120, 170, 90] : [TINT_ONE, TINT_ONE, TINT_ONE];
    const q = [[-0.5, -0.5, 0, 0, 1], [0.5, -0.5, 0, 1, 1], [0.5, 0.5, 0, 1, 0], [-0.5, 0.5, 0, 0, 0]];
    for (const [x, y, z, u, v] of q) b.vert(x, y, z, u, v, layer, 3, 255, 0, 255, 0, tint[0], tint[1], tint[2]);
    m = { data: b.slice(), count: 4, gpu: null, flat: true };
    this.flatMeshes.set(id, m);
    return m;
  }
  render(dt) {
    const p = this.player, w = this.world, R = this.renderer;
    this.frame.blockEnts = [];
    // 카메라
    let cam = [p.x, p.eyeY(), p.z];
    let yaw = p.yaw, pitch = p.pitch;
    let bob = null;
    if (this.settings.viewBob && p.onGround && !p.flying && this.view === 0) {
      const ph = p.bobPhase, amp = Math.min(1, Math.hypot(p.vx, p.vz) / 4.3);
      bob = [Math.sin(ph) * 0.035 * amp, -Math.abs(Math.cos(ph)) * 0.05 * amp];
    }
    if (this.view > 0) {
      const d = p.lookDir(); const sgn = this.view === 1 ? -1 : 1;
      let dist = 4;
      const hit = raycast(w, cam[0], cam[1], cam[2], d[0] * sgn, d[1] * sgn, d[2] * sgn, 4);
      if (hit) dist = Math.max(0.3, hit.t - 0.3);
      cam = [cam[0] + d[0] * sgn * dist, cam[1] + d[1] * sgn * dist, cam[2] + d[2] * sgn * dist];
      if (this.view === 2) { yaw += Math.PI; pitch = -pitch; }
    }
    const underwater = w.getBlock(Math.floor(cam[0]), Math.floor(cam[1] + 0.05), Math.floor(cam[2])) === BL.water;
    // 개체
    // (최적화) 너무 멀거나 카메라 뒤쪽(시야 밖)인 개체는 그리지 않음
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rd2 = (this.settings.renderDist * 16) ** 2;
    for (const e of this.ents.list) if (!e.dead && e.render) {
      const dx = e.x - cam[0], dz = e.z - cam[2], d2 = dx * dx + dz * dz;
      if (d2 > rd2) continue;
      if (d2 > 36 && (dx * fx + dz * fz) < -Math.sqrt(d2) * 0.35 - (e.w || 1)) continue;
      e.render(this, R, cam);
    }
    // 다른 플레이어
    for (const r of this.remotes.values()) this.renderRemote(r, cam);
    if (this.view > 0 && !p.dead) this.renderPlayerModel(p, cam, this.settings.name);
    this.builder.render(R, cam);
    // 파티클
    const parts = this.particles.list.length ? this.particles.build(cam, yaw, pitch, w) : null;
    // 균열
    let crack = null;
    if (this.target && this.breakProg > 0 && !p.creative) {
      const t = this.target;
      const stage = Math.min(9, Math.floor(this.breakProg * 10));
      const b = this.crackBuf || (this.crackBuf = new MeshBuf(64)); b.reset();
      const bs = blockBoxes(t.id, t.meta, true, w, t.x, t.y, t.z) || FULL_BOX;
      const layer = T('crack_' + stage);
      const L = w.getLight(t.x, t.y + 1, t.z);
      for (const bx of bs) {
        const e = 0.003;
        const box = [bx[0] - e, bx[1] - e, bx[2] - e, bx[3] + e, bx[4] + e, bx[5] + e];
        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          for (let k = 0; k < 4; k++) {
            const c = F.pts[k];
            const px = c[0] ? box[3] : box[0], py = c[1] ? box[4] : box[1], pz = c[2] ? box[5] : box[2];
            const uv = faceUV(f, px, py, pz);
            b.vert(t.x + px - cam[0], t.y + py - cam[1], t.z + pz - cam[2], uv[0], uv[1], layer, f, 255, 255, 255, 0, 120, 120, 120);
          }
        }
      }
      crack = b;
    }
    // 선택 테두리
    let sel = null;
    if (this.target && !this.settings.hideHud && this.view === 0) {
      const t = this.target;
      const bs = blockBoxes(t.id, t.meta, true, w, t.x, t.y, t.z) || FULL_BOX;
      sel = [];
      for (const b of bs) {
        const e = 0.002;
        const x0 = t.x + b[0] - e - cam[0], y0 = t.y + b[1] - e - cam[1], z0 = t.z + b[2] - e - cam[2];
        const x1 = t.x + b[3] + e - cam[0], y1 = t.y + b[4] + e - cam[1], z1 = t.z + b[5] + e - cam[2];
        const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
        for (const [a, bb] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) sel.push(...c[a], ...c[bb]);
      }
    }
    // 비
    let rainBuf = null;
    if (this.rain > 0.02 && w.dim === 'overworld') rainBuf = this.buildRain(cam);
    // 손
    let hand = null;
    if (this.view === 0 && !p.dead && !this.settings.hideHud) {
      const held = p.held;
      const L = w.getLight(Math.floor(p.x), Math.floor(p.eyeY()), Math.floor(p.z));
      const light = [Math.max(0.2, (L >> 4) / 15), (L & 15) / 15];
      let sw = this.swing > 0 ? 1 - this.swing : 0;
      if (this.eatT > 0) sw = 0.2 + Math.sin(this.eatT * 20) * 0.05;
      const hb = [bob ? bob[0] * 0.6 : 0, bob ? bob[1] * 0.6 : 0];
      if (held) { const m = this.itemMesh(held.id); hand = { mesh: m, flat: !!m.flat, light, swing: sw, bob: hb, equip: this.equip }; }
      else hand = { mesh: null, light, swing: sw, bob: hb, skin: [0.87, 0.67, 0.53], av: this.avatar && this.avatar.pixels ? this.avatar : null };
    }
    const skyLightBoost = this.settings.brightness !== undefined ? this.settings.brightness : 0.3;
    R.render({
      world: w, cam, yaw, pitch, fov: this.settings.fov * (p.sprinting ? 1.1 : 1) * (this.bowT > 0 ? 1 - Math.min(1, this.bowT) * 0.15 : 1), renderDist: this.settings.renderDist,
      time: performance.now() / 1000, blockEnts: this.frame.blockEnts, particles: parts, crack, selLines: sel, hand, underwater,
      clouds: this.settings.clouds && w.dim === 'overworld', rain: w.dim === 'overworld' ? this.rain : 0, rainBuf, bob, hurt: this.hurtFx, bright: skyLightBoost,
      fogScale: w.dim === 'nether' ? 0.62 : 0, extraLines: this.builder.prev ? this.builder.prev.lines : null,
    });
    this.ui.updateNameTags(cam);
  }
  renderRemote(r, cam) {
    this.renderPlayerModel(r, cam, r.name);
    if (r.bot) this.builder.renderBotAt(this.renderer, cam, r.bot);
  }
  renderPlayerModel(p, cam, name) {
    const R = this.renderer, w = this.world;
    const base = M4.create(), t = M4.create();
    const bodyYaw = p.bodyYaw !== undefined ? p.bodyYaw : p.yaw;
    M4.translate(base, p.x - cam[0], p.y - cam[1] - (p.sneaking ? 0.12 : 0), p.z - cam[2]);
    M4.mul(base, base, M4.rotY(t, bodyYaw));
    const L = w.getLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z));
    const light = [(L >> 4) / 15, (L & 15) / 15];
    const walk = p.walkAnim !== undefined ? p.walkAnim : p.bobPhase || 0;
    const sw = Math.sin(walk) * 0.8 * Math.min(1, p.speed !== undefined ? p.speed : Math.hypot(p.vx, p.vz) / 3);
    let av = p === this.player ? this.avatar : p.av;
    if (av) ensureAvatarPixels(av);
    if (!av || !av.pixels) av = this.fallbackAvatar();
    const spd = Math.min(1, p.speed !== undefined ? p.speed : Math.hypot(p.vx, p.vz) / 3);
    const pose = { sw, headPitch: -p.pitch * 0.8, extraSwing: p.swingAnim || (p === this.player ? (this.swing > 0 ? 1 - this.swing : 0) : 0), time: performance.now() / 1000, speed: spd, walk };
    const AM = renderAvatarModel(R.skin, R.ent, base, pose, av, R.skinLayerFor(av), light, false);
    renderArmorModel(R.ent, AM, p === this.player ? p.armor.map(a => a && a.id) : p.armor, light, false);
  }
  buildRain(cam) {
    const b = this.rainBuf || (this.rainBuf = new MeshBuf(4096)); b.reset();
    const w = this.world, t = performance.now() / 1000;
    const layer = T('white');
    const cx = Math.floor(cam[0]), cz = Math.floor(cam[2]);
    const R = 12;
    const cnt = Math.floor(this.rain * 3);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > R * R) continue;
      const x = cx + dx, z = cz + dz;
      const top = w.heightAt(x, z);
      const snow = BIOMES[w.biomeAt(x, z)] && (w.biomeAt(x, z) === 3 || w.biomeAt(x, z) === 6);
      if (w.biomeAt(x, z) === 2) continue;
      for (let k = 0; k < cnt; k++) {
        const h = hashInt(x, k, z, 5);
        const speed = snow ? 3 : 14;
        const off = ((h & 1023) / 1023) * 24;
        let y = cam[1] + 12 - ((t * speed + off) % 24);
        if (y < top) continue;
        const px = x + ((h >> 10) & 255) / 255, pz = z + ((h >> 18) & 255) / 255;
        const len = snow ? 0.08 : 0.6, wdt = snow ? 0.08 : 0.02;
        const rx = px - cam[0], ry = y - cam[1], rz = pz - cam[2];
        const col = snow ? [255, 255, 255] : [110, 130, 170];
        b.vert(rx - wdt, ry, rz, 0, 1, layer, 3, 255, 0, 255, 0, col[0], col[1], col[2]);
        b.vert(rx + wdt, ry, rz, 1, 1, layer, 3, 255, 0, 255, 0, col[0], col[1], col[2]);
        b.vert(rx + wdt, ry + len, rz, 1, 0, layer, 3, 255, 0, 255, 0, col[0], col[1], col[2]);
        b.vert(rx - wdt, ry + len, rz, 0, 0, layer, 3, 255, 0, 255, 0, col[0], col[1], col[2]);
        b.vert(rx, ry, rz - wdt, 0, 1, layer, 3, 255, 0, 255, 0, col[0], col[1], col[2]);
        b.vert(rx, ry, rz + wdt, 1, 1, layer, 3, 255, 0, 255, 0, col[0], col[1], col[2]);
        b.vert(rx, ry + len, rz + wdt, 1, 0, layer, 3, 255, 0, 255, 0, col[0], col[1], col[2]);
        b.vert(rx, ry + len, rz - wdt, 0, 0, layer, 3, 255, 0, 255, 0, col[0], col[1], col[2]);
      }
    }
    return b;
  }

  // =================== 명령어 ===================
  command(line) {
    const p = this.player, w = this.world;
    const a = line.trim().slice(1).split(/\s+/);
    const cmd = (a[0] || '').toLowerCase();
    const say = (t, c) => this.ui.chatLine(t, c || '#aee');
    const host = !w.remote;
    const toHost = () => { this.net.send({ t: 'cmd', line }); };
    switch (cmd) {
      case 'help': case '도움말':
        say('명령어: /gamemode c|s, /time set day|night|noon|숫자, /tp x y z, /give 이름 [개수], /weather clear|rain, /spawnpoint, /seed, /kill, /clear, /fill x1 y1 z1 x2 y2 z2 블록, /peaceful on|off, /daycycle on|off, /tntgrief on|off, /keepinv on|off, /summon 몹');
        return;
      case 'gamemode': case 'gm': {
        const m = (a[1] || '').toLowerCase();
        p.creative = ['c', '1', 'creative', '크리에이티브'].includes(m) ? true : ['s', '0', 'survival', '서바이벌'].includes(m) ? false : !p.creative;
        if (!p.creative) p.flying = false;
        say(p.creative ? '크리에이티브 모드' : '서바이벌 모드'); this.ui.refreshStats(); return;
      }
      case 'time': {
        if (!host) return toHost();
        const v = (a[2] || a[1] || '').toLowerCase();
        const map = { day: 1000, noon: 6000, sunset: 12000, night: 13500, midnight: 18000, sunrise: 23500, '낮': 1000, '밤': 14000 };
        const t = map[v] !== undefined ? map[v] : parseInt(v);
        if (!isNaN(t)) { w.time = ((t % 24000) + 24000) % 24000; say('시간: ' + w.time); if (this.net.isHost) this.net.broadcast({ t: 'time', v: w.time }); }
        return;
      }
      case 'tp': { const x = parseFloat(a[1]), y = parseFloat(a[2]), z = parseFloat(a[3]); if ([x, y, z].every(isFinite)) { p.x = x; p.y = y; p.z = z; p.vy = 0; say(`이동: ${x} ${y} ${z}`); } return; }
      case 'give': {
        const name = a[1]; const n = parseInt(a[2]) || 1;
        let id = IT[name]; if (id === undefined) id = BL[name];
        if (id === undefined) { const f = ITEMS.find(d => d && (d.k === name || d.k.replace(/\s/g, '') === name)); if (f) id = f.id; }
        if (id === undefined || !ITEMS[id]) { say('아이템을 찾을 수 없습니다: ' + name, '#f88'); return; }
        p.give(id, n); say(`${ITEMS[id].k} ×${n} 지급`); return;
      }
      case 'weather': if (!host) return toHost(); this.setRain(a[1] === 'rain' || a[1] === '비' ? 1 : 0); say('날씨 변경'); return;
      case 'spawnpoint': p.spawn = [p.x, p.y, p.z]; say('스폰 지점 설정'); return;
      case 'seed': say('시드: ' + w.seed); return;
      case 'kill': p.creative = false; p.hurt(1000, 'void'); return;
      case 'clear': p.inv.fill(null); this.ui.refreshHotbar(); say('인벤토리를 비웠습니다'); return;
      case 'fill': {
        const n = a.slice(1, 7).map(v => v === '~' ? null : parseInt(v));
        const bn = a[7]; let id = BL[bn]; if (id === undefined) { const f = BLOCKS.find(d => d && d.k === bn); if (f) id = f.id; }
        if (id === undefined || n.some(v => v === null || isNaN(v))) { say('사용법: /fill x1 y1 z1 x2 y2 z2 블록이름', '#f88'); return; }
        const [x1, y1, z1, x2, y2, z2] = n;
        const cnt = (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1) * (Math.abs(z2 - z1) + 1);
        if (cnt > 32768) { say('한 번에 32768칸까지만 채울 수 있습니다', '#f88'); return; }
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) this.setBlockNet(x, y, z, id, 0);
        say(`${cnt}칸을 채웠습니다`); return;
      }
      case 'peaceful': case 'daycycle': case 'tntgrief': case 'keepinv': case 'mobs': {
        if (!host) return toHost();
        const key = { peaceful: 'peaceful', daycycle: 'daylightCycle', tntgrief: 'tntGrief', keepinv: 'keepInventory', mobs: 'mobs' }[cmd];
        this.worldRules[key] = a[1] ? (a[1] === 'on' || a[1] === '켜기') : !this.worldRules[key];
        if (key === 'peaceful') this.settings.peaceful = this.worldRules.peaceful;
        say(`${cmd}: ${this.worldRules[key] ? '켜짐' : '꺼짐'}`);
        if (this.net.isHost) this.net.broadcast({ t: 'rules', v: this.worldRules });
        return;
      }
      case 'summon': {
        if (!host) return toHost();
        const sub = a[1]; if (!MOB_TYPES[sub]) { say('몹: ' + Object.keys(MOB_TYPES).join(', '), '#f88'); return; }
        const d = p.lookDir(); this.ents.add(new Mob(sub, p.x + d[0] * 3, p.y + 0.5, p.z + d[2] * 3)); return;
      }
    }
    say('알 수 없는 명령어입니다. /help 를 입력해 보세요.', '#f88');
  }
}
