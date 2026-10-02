'use strict';
// =====================================================================
// 멀티플레이 (같은 와이파이)
//  1) LAN 서버: server.py 가 웹소켓으로 메시지를 중계 (인터넷 불필요)
//  2) 방 코드(P2P): PeerJS 로 연결 (신호 교환에만 인터넷 사용)
//  방장(호스트)이 세계를 계산하고, 참가자는 블록 변경을 요청한다.
// =====================================================================
const PEERJS_URLS = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
const PEER_PREFIX = 'educraft-v1-';
// 통신 규칙 번호: 서로 다른 버전(예: 웨일은 옛 버전이 캐시에, 엣지는 새 버전)이 섞이면 알려 주려고
const NET_PROTO = 2;
// 연결 길 찾기: 학교 와이파이처럼 기기끼리 바로 연결이 막힌 곳에서는 TURN 중계 서버로 우회
const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];
const PEER_OPTS = { debug: 0, config: { iceServers: ICE_SERVERS, sdpSemantics: 'unified-plan' } };
// P2P 메시지: JSON 글자로 보내고, 길면 잘게 나눠 보냄 (브라우저·기기마다 한 번에 보낼 수 있는 크기가 달라서)
const WIRE_CHUNK = 12000;
let WIRE_ID = 0;
function wireSend(conn, obj) {
  if (!conn || !conn.open) return false;
  const s = JSON.stringify(obj);
  try {
    if (s.length <= WIRE_CHUNK) conn.send(s);
    else {
      const id = (++WIRE_ID).toString(36), n = Math.ceil(s.length / WIRE_CHUNK);
      for (let i = 0; i < n; i++) conn.send('\u0001' + id + ':' + i + ':' + n + ':' + s.slice(i * WIRE_CHUNK, (i + 1) * WIRE_CHUNK));
    }
    return true;
  } catch (e) { return false; }
}
// 받은 조각 모으기 → 완성된 객체(또는 null). onPart(받은 수, 전체 수) 로 진행률
function wireRecv(state, d, onPart) {
  if (typeof d !== 'string') return d && typeof d === 'object' ? d : null;
  if (d.charCodeAt(0) !== 1) { try { return JSON.parse(d); } catch (e) { return null; } }
  const a = d.indexOf(':'), b = d.indexOf(':', a + 1), c = d.indexOf(':', b + 1);
  const id = d.slice(1, a), i = +d.slice(a + 1, b), n = +d.slice(b + 1, c);
  if (!(n > 0 && n < 20000 && i >= 0 && i < n)) return null;
  const parts = state[id] || (state[id] = { n, got: 0, p: new Array(n) });
  if (parts.p[i] === undefined) { parts.p[i] = d.slice(c + 1); parts.got++; }
  if (onPart && n > 4) onPart(parts.got, n);
  if (parts.got < n) return null;
  delete state[id];
  try { return JSON.parse(parts.p.join('')); } catch (e) { return null; }
}

const NET_BLOCKED_MSG = '방장 기기와 연결 길을 찾지 못했어요. 학교 와이파이가 기기끼리 연결을 막는 경우가 있어요 → ① 같은 와이파이인지 확인 ② 선생님 노트북에서 「서버실행.bat」(LAN 서버)으로 열기 ③ 휴대폰 핫스팟으로 해 보세요';
class Net {
  constructor(g) {
    this.g = g; this.mode = null; this.isHost = false; this.connected = false;
    this.peers = new Map(); // id → { name, send(obj) }
    this.out = new Map(); this.myId = 'host';
    this.stateT = 0; this.entT = 0; this.serverInfo = null; this.serverChecked = false;
    this.avs = new Map(); // 다른 플레이어 아바타 (참가자 쪽)
    this.lastHost = 0;    // 참가자: 방장에게서 마지막으로 받은 때
    // 화면이 숨겨져(다른 탭) 그리기가 멈춰도 연결 확인은 계속 (끊긴 친구가 유령처럼 남지 않게)
    setInterval(() => this.heartbeat(), 3000);
  }
  heartbeat() {
    if (!this.connected) return;
    const now = performance.now();
    if (this.isHost) {
      for (const [id, p] of this.peers) {
        if (p.last && now - p.last > 75000) { this.g.ui.chatLine(`📡 ${p.name || '친구'}님과 연결이 끊긴 것 같아 내보냈어요`, '#ffb37a'); if (p.conn) try { p.conn.close(); } catch (e) { } this.onPeerLeave(id); }
      }
      this.broadcast({ t: 'hb' }); this.flush();
    } else {
      if (this.lastHost && now - this.lastHost > 60000) { this.lost('방장과 1분 동안 연락이 없어 연결을 끊었어요. 방장의 화면이 꺼져 있지 않은지 확인해 주세요.'); return; }
      this.send({ t: 'hb' }); this.flush();
    }
  }
  peerCount() { return this.peers.size; }
  // ---------------- LAN 서버 확인 ----------------
  async detectServer() {
    if (this.serverChecked) return !!this.serverInfo;
    this.serverChecked = true;
    if (!/^https?:/.test(location.protocol)) return false;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 1500);
      const r = await fetch('/api/info', { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t);
      const j = await r.json();
      if (j && j.opuscraft) { this.serverInfo = j; return true; }
    } catch (e) { }
    return false;
  }
  wsUrl() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'; }
  openWs() {
    return new Promise((res, rej) => {
      const ws = new WebSocket(this.wsUrl());
      ws.onopen = () => res(ws);
      ws.onerror = () => rej(new Error('LAN 서버에 연결할 수 없어요'));
    });
  }
  listRooms(cb) {
    this.stopListing();
    let ws;
    const tick = () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'list' })); };
    this.openWs().then(w => {
      ws = w; this.listWs = w;
      w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'rooms') cb(m.rooms); };
      tick(); this.listTimer = setInterval(tick, 2000);
    }).catch(() => cb([]));
  }
  stopListing() { clearInterval(this.listTimer); if (this.listWs) { try { this.listWs.close(); } catch (e) { } this.listWs = null; } }
  async loadPeerJS() {
    if (window.Peer) return;
    if (!window.RTCPeerConnection) throw new Error('이 브라우저는 방 코드(P2P) 연결을 지원하지 않아요. 크롬·엣지·웨일 최신 버전이나 LAN 서버(서버실행.bat)를 써 주세요');
    for (const url of PEERJS_URLS) {
      const ok = await new Promise((res) => {
        const s = document.createElement('script'); s.src = url;
        s.onload = () => res(true); s.onerror = () => { s.remove(); res(false); };
        document.head.appendChild(s);
      });
      if (ok && window.Peer) return;
    }
    throw new Error('연결 도구(PeerJS)를 불러오지 못했어요. 인터넷 연결이나 학교 방화벽을 확인하거나 LAN 서버(서버실행.bat)를 써 주세요');
  }
  // ================= 방장 =================
  async host(mode) {
    const g = this.g;
    if (this.isHost) return;
    if (g.world && g.world.dim && g.world.dim !== 'overworld') { g.ui.toast('지옥·엔드에서는 방을 열 수 없어요. 평소 세계로 돌아간 뒤 열어 주세요.', 4000); return; }
    try {
      if (mode === 'lan') {
        await this.detectServer();
        const ws = await this.openWs();
        this.ws = ws; this.mode = 'lan';
        ws.onmessage = (e) => this.onWs(JSON.parse(e.data));
        ws.onclose = () => { if (this.ws === ws && this.isHost) { g.ui.toast('LAN 서버와 연결이 끊겼어요'); this.isHost = false; this.connected = false; this.peers.clear(); g.remotes.clear(); } };
        ws.send(JSON.stringify({ type: 'host', name: g.worldName, host: g.player.name }));
        this.isHost = true; this.connected = true;
        g.ui.chatLine('📡 LAN 서버에 방을 열었어요! 친구들이 「방에 들어가기」 목록에서 들어올 수 있어요.', '#9f9');
      } else {
        await this.loadPeerJS();
        const tryOpen = () => new Promise((res, rej) => {
          const code = String(1000 + Math.random() * 9000 | 0);
          const peer = new Peer(PEER_PREFIX + code, PEER_OPTS);
          peer.on('open', () => res({ peer, code }));
          peer.on('error', (err) => { if (err.type === 'unavailable-id') { peer.destroy(); res(null); } else rej(err); });
        });
        let r = null; for (let i = 0; i < 5 && !r; i++) r = await tryOpen();
        if (!r) throw new Error('방 코드를 만들지 못했어요');
        this.peer = r.peer; this.roomCode = r.code; this.mode = 'peer';
        this.isHost = true; this.connected = true;
        this.peer.on('connection', (conn) => {
          const id = 'p' + Math.random().toString(36).slice(2, 8), parts = {};
          conn.on('open', () => {
            this.peers.set(id, { name: '?', send: (o) => wireSend(conn, o), conn, last: performance.now() });
          });
          conn.on('data', (d) => { const p = this.peers.get(id); if (p) p.last = performance.now(); const m = wireRecv(parts, d); if (m) this.onHostData(id, m); });
          conn.on('close', () => this.onPeerLeave(id));
          conn.on('error', () => this.onPeerLeave(id));
        });
        // 신호 서버와 끊기면(와이파이 잠깐 끊김 등) 다시 붙음 — 이미 연결된 친구는 그대로
        this.peer.on('disconnected', () => { setTimeout(() => { try { if (this.peer && !this.peer.destroyed) this.peer.reconnect(); } catch (e) { } }, 1000); });
        this.peer.on('error', (err) => { if (err && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')) g.ui.toast('📡 방 코드 서버와 연결이 불안정해요. 새 친구가 못 들어올 수 있어요 (이미 들어온 친구는 괜찮아요)', 4000); });
        g.ui.chatLine(`📡 방이 열렸어요! 방 코드: ${this.roomCode}`, '#9f9');
        g.ui.toast(`방 코드: ${this.roomCode}`, 6000);
      }
    } catch (e) {
      console.error(e);
      g.ui.toast('방을 열 수 없어요: ' + e.message, 5000);
      this.isHost = false; this.connected = false;
    }
  }
  onWs(m) {
    const g = this.g;
    if (this.isHost) {
      if (m.type === 'hosted') { this.roomId = m.room; }
      else if (m.type === 'peer-join') { const id = m.id; this.peers.set(id, { name: m.name || '?', send: null, last: performance.now() }); }
      else if (m.type === 'peer-leave') this.onPeerLeave(m.id);
      else if (m.type === 'msg') { const p = this.peers.get(m.from); if (p) p.last = performance.now(); this.onHostData(m.from, m.data); }
    } else {
      if (m.type === 'joined') { this.myId = m.id; this.sendRaw(this.helloMsg()); g.ui.showLoading('방장에게 세계를 받는 중...'); }
      else if (m.type === 'msg') { this.lastHost = performance.now(); this.onClientData(m.data); }
      else if (m.type === 'closed' || m.type === 'error') this.lost(m.type === 'error' ? (m.message || '방에 들어갈 수 없어요') : '방장이 방을 닫았어요');
    }
  }
  onPeerLeave(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    const r = this.g.remotes.get(id);
    this.g.remotes.delete(id);
    this.broadcast({ t: 'leave', id });
    if (r) this.sendChat(`👋 ${r.name}님이 나갔어요`);
  }
  // 참가자가 보낸 데이터 처리 (방장)
  onHostData(id, data) {
    if (data && data.t === 'batch') { for (const m of data.m) this.onHostData(id, m); return; }
    const g = this.g, w = g.world;
    if (!w) return;
    const m = data;
    switch (m.t) {
      case 'hb': return;
      case 'hello': {
        const p = this.peers.get(id); if (p) p.name = m.name;
        if ((m.proto | 0) !== NET_PROTO) {
          const theirs = m.v || '옛 버전';
          this.sendTo(id, { t: 'refuse', why: `방장은 에듀 크래프트 ${VERSION}, 나는 ${theirs}이에요. Ctrl + F5(휴대폰은 당겨서 새로고침)로 새 버전을 받은 뒤 다시 들어와 주세요.`, v: VERSION });
          g.ui.chatLine(`⚠ ${String(m.name || '친구').slice(0, 16)}님은 다른 버전(${theirs})이라 들어오지 못했어요. 그 친구 화면에서 Ctrl + F5 로 새로고침하게 해 주세요.`, '#ffb37a');
          this.flush();
          return;
        }
        const r = { id, name: String(m.name || '친구').slice(0, 16), skin: SKINS[(m.skin | 0) % SKINS.length], av: sanitizeAvatar(m.av), x: g.player.spawn[0], y: g.player.spawn[1], z: g.player.spawn[2], yaw: 0, pitch: 0, walkAnim: 0, speed: 0, bot: null, vx: 0, vy: 0, vz: 0, h: 1.8 };
        g.remotes.set(id, r);
        const mods = {};
        for (const [k, mm] of w.mods) { const a = []; for (const [i, v] of mm) a.push(i, v); mods[k] = a; }
        this.sendTo(id, { t: 'welcome', proto: NET_PROTO, v: VERSION, id, seed: w.seed, type: w.type, mode: g.worldMode, time: w.time, rain: g.rainTarget, rules: g.worldRules, mods, be: Array.from(w.be.entries()), spawn: g.player.spawn, worldName: g.worldName });
        // 아바타 주고받기: 새 친구에게 모두의 아바타, 모두에게 새 친구의 아바타
        this.sendTo(id, { t: 'av', id: 'host', name: g.player.name, av: avatarNet(g.avatar) });
        for (const [rid, rr] of g.remotes) if (rid !== id && rr.av) this.sendTo(id, { t: 'av', id: rid, name: rr.name, av: avatarNet(rr.av) });
        if (r.av) this.broadcast({ t: 'av', id, name: r.name, av: avatarNet(r.av) }, id);
        this.sendChat(`🎉 ${r.name}님이 들어왔어요!`);
        return;
      }
      case 'av': {
        const r = g.remotes.get(id); if (!r) return;
        const a = sanitizeAvatar(m.av); if (a) r.av = a;
        const old = r.name;
        if (m.name) r.name = String(m.name).trim().slice(0, 16) || r.name;
        this.broadcast({ t: 'av', id, name: r.name, av: avatarNet(r.av) }, id);
        if (old !== r.name) this.sendChat(`✏️ ${old}님이 이름을 ${r.name}(으)로 바꿨어요`);
        return;
      }
      case 'ps': {
        const r = g.remotes.get(id); if (!r) return;
        const p = m.p;
        const ox = r.x, oz = r.z;
        r.x = p[0]; r.y = p[1]; r.z = p[2]; r.yaw = p[3]; r.pitch = p[4]; r.sneaking = !!m.s; r.held = m.h; r.bot = m.bot || null; r.swingAnim = m.sw || 0;
        r.speed = m.v || 0; r.walkAnim = m.wa || 0; r.bodyYaw = p[3]; r.armor = Array.isArray(m.ar) ? m.ar.slice(0, 4) : null;
        return;
      }
      case 'set': {
        const list = m.b;
        for (let i = 0; i + 4 < list.length + 1; i += 5) {
          const [x, y, z, bid, meta] = list.slice(i, i + 5);
          if (!(bid >= 0 && bid < 256) || !BLOCKS[bid]) continue;
          w.setBlock(x | 0, y | 0, z | 0, bid, meta & 255);
        }
        return;
      }
      case 'use': {
        g._useSneak = !!m.sneak;
        if (m.wrench) { const save = w.remote; g.useWrench(m.x, m.y, m.z); }
        else if (m.ignite) g.igniteTNT(m.x, m.y, m.z);
        else if (m.bonemeal) Survival.boneMeal(g, m.x, m.y, m.z);
        else g.useBlock(m.x, m.y, m.z, false, id);
        return;
      }
      case 'be': {
        if (m.v) { w.be.set(m.k, m.v); const [x, y, z] = parseKey(m.k); g.redstone.queueAround(x, y, z); if (m.v.t === 'furnace') g.furnaces.add(m.k); }
        this.broadcast({ t: 'be', k: m.k, v: m.v }, id);
        return;
      }
      case 'beReq': { const v = w.be.get(m.k); if (v) this.sendTo(id, { t: 'be', k: m.k, v }); return; }
      case 'hit': { const e = g.ents.byId.get(m.eid); if (e) g.damageEntity(e, m.dmg, m.kx, m.kz, 'client:' + id); return; }
      case 'arrow': { const p = m.p; g.ents.add(new ArrowEntity(p[0], p[1], p[2], p[3], p[4], p[5], 'player')); g.sfx('bow', p[0], p[1], p[2]); return; }
      case 'cart': g.ents.add(new Minecart(m.x + 0.5, m.y + 0.1, m.z + 0.5)); return;
      case 'ride': {
        for (const e of g.ents.list) if (e.type === 'cart' && e.riderId === id) { e.rider = null; e.riderId = null; }
        const e = g.ents.byId.get(m.eid);
        if (e && e.type === 'cart' && !e.rider) { e.rider = g.remotes.get(id) || true; e.riderId = id; }
        return;
      }
      case 'shear': { const e = g.ents.byId.get(m.eid); Survival.shear(g, e); return; }
      case 'cartPush': { const e = g.ents.byId.get(m.eid); if (e && e.pushDir) e.pushDir(m.d, 0.1); return; }
      case 'chat': this.sendChat(String(m.text).slice(0, 240)); return;
      case 'cmd': { const r = g.remotes.get(id); g.ui.chatLine(`(${r ? r.name : id}) ${m.line}`, '#999'); g.command(m.line); return; }
    }
  }
  // ================= 참가자 =================
  async joinLan(roomId) {
    const g = this.g;
    try {
      const ws = await this.openWs();
      this.ws = ws; this.mode = 'lan'; this.isHost = false;
      ws.onmessage = (e) => this.onWs(JSON.parse(e.data));
      ws.onclose = () => { if (this.ws === ws) this.lost('LAN 서버와 연결이 끊겼어요'); };
      ws.send(JSON.stringify({ type: 'join', room: roomId, name: g.settings.name }));
      this.stopListing();
      g.ui.showLoading('방에 들어가는 중...');
      this.joinTimer = setTimeout(() => { if (!this.connected) this.lost('방장이 응답하지 않아요. 방장 화면이 켜져 있는지 확인해 주세요'); }, 30000);
    } catch (e) { g.ui.toast(e.message); }
  }
  helloMsg() { const g = this.g; return { t: 'hello', proto: NET_PROTO, v: VERSION, name: g.settings.name, skin: g.settings.skin, av: avatarNet(g.avatar) }; }
  async joinPeer(code) {
    const g = this.g;
    code = String(code).replace(/[^0-9a-zA-Z]/g, '');
    if (!code) return;
    g.ui.showLoading('① 방 코드 서버에 연결하는 중...');
    try {
      await this.loadPeerJS();
      const peer = new Peer(PEER_OPTS);
      this.peer = peer; this.mode = 'peer'; this.isHost = false;
      const parts = {};
      let stage = 1;
      peer.on('open', () => {
        stage = 2; g.ui.showLoading('② 방장 기기를 찾는 중...');
        const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'raw' });
        this.conn = conn;
        conn.on('open', () => { stage = 3; g.ui.showLoading('③ 방장에게 세계를 받는 중...'); this.sendRaw(this.helloMsg()); });
        conn.on('data', (d) => {
          this.lastHost = performance.now();
          const m = wireRecv(parts, d, (got, n) => { if (!this.connected) g.ui.setLoading(Math.round(got / n * 100)); });
          if (m) this.onClientData(m);
        });
        conn.on('close', () => { if (this.peer === peer) this.lost('방장과 연결이 끊겼어요'); });
        conn.on('error', () => { if (this.peer === peer) this.lost('연결 오류가 났어요'); });
        // 기기끼리 길을 못 찾으면(학교 와이파이 차단 등) 알려 줌
        const pc = conn.peerConnection;
        if (pc) pc.addEventListener('iceconnectionstatechange', () => { if (pc.iceConnectionState === 'failed' && !this.connected && this.peer === peer) this.lost(NET_BLOCKED_MSG); });
      });
      peer.on('error', (err) => { if (this.peer !== peer) return; this.lost(err.type === 'peer-unavailable' ? `「${code}」 방이 없어요. 코드를 다시 확인하거나, 방장이 방을 다시 열어 달라고 해 주세요` : err.type === 'browser-incompatible' ? '이 브라우저는 방 코드 연결을 지원하지 않아요' : err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' ? '방 코드 서버에 연결할 수 없어요 (인터넷·학교 방화벽 확인). LAN 서버(서버실행.bat)를 써 보세요' : '연결 오류: ' + err.type); });
      this.joinTimer = setTimeout(() => { if (!this.connected && this.peer === peer) this.lost(stage === 1 ? '방 코드 서버에 연결하지 못했어요 (인터넷 확인)' : stage === 2 ? NET_BLOCKED_MSG : '세계를 받는 중에 멈췄어요. 다시 들어와 보세요'); }, 35000);
    } catch (e) { this.lost(e.message); }
  }
  lost(msg) {
    const g = this.g;
    clearTimeout(this.joinTimer);
    const wasPlaying = g.state === 'play' || g.state === 'loading';
    this.cleanup();
    g.ui.toast(msg, 4000);
    if (wasPlaying && g.world && g.world.remote) { g.state = 'menu'; g.quitToMenu(); }
    else if (!wasPlaying) g.ui.showMulti();
  }
  onClientData(data) {
    if (data && data.t === 'batch') { for (const m of data.m) this.onClientData(m); return; }
    const g = this.g, m = data;
    if (!m || !m.t) return;
    if (m.t === 'hb') return;
    if (m.t === 'refuse') {
      this.lost('⚠ 버전이 달라요: ' + m.why);
      // 내 쪽이 옛 버전이면 바로 새로 받기
      const num = (v) => String(v || '').replace(/[^0-9.]/g, '').split('.').map(Number);
      const a = num(m.v), b = num(VERSION), newer = (a[0] - b[0]) || ((a[1] || 0) - (b[1] || 0));
      if (newer > 0 && confirm(`방장은 새 버전(${m.v})이에요. 지금 새 버전을 받을까요? (새로고침)`)) { try { sessionStorage.removeItem('educraft.freshReload'); } catch (e) { } reloadFresh('방장과 버전 맞추기'); }
      return;
    }
    if (m.t === 'welcome') {
      if ((m.proto | 0) !== NET_PROTO) { this.lost(`⚠ 방장(${m.v || '옛 버전'})과 버전이 달라요. 두 기기 모두 Ctrl + F5 로 새로고침해 주세요`); return; }
      clearTimeout(this.joinTimer);
      this.connected = true; this.myId = m.id;
      g.startWorld({ id: null, name: m.worldName, client: m });
      g.worldName = m.worldName;
      return;
    }
    if (m.t === 'av') {
      const a = sanitizeAvatar(m.av);
      if (a) { this.avs.set(m.id, a); const r = g.remotes.get(m.id); if (r) r.av = a; }
      return;
    }
    const w = g.world; if (!w || !w.remote) return;
    switch (m.t) {
      case 'sets': { const b = m.b; for (let i = 0; i < b.length; i += 5) w.setBlock(b[i], b[i + 1], b[i + 2], b[i + 3], b[i + 4]); return; }
      case 'players': {
        const seen = new Set();
        for (const s of m.l) {
          const id = s[0]; if (id === this.myId) continue;
          seen.add(id);
          let r = g.remotes.get(id);
          if (!r) { r = { id, name: s[1], x: s[2], y: s[3], z: s[4], yaw: s[5], pitch: s[6], walkAnim: 0, h: 1.8, vx: 0, vy: 0, vz: 0 }; g.remotes.set(id, r); }
          if (!r.av && this.avs.has(id)) r.av = this.avs.get(id);
          r.name = s[1]; r.tx = s[2]; r.ty = s[3]; r.tz = s[4]; r.yaw = s[5]; r.bodyYaw = s[5]; r.pitch = s[6]; r.sneaking = !!s[7]; r.held = s[8]; r.skin = SKINS[(s[9] | 0) % SKINS.length]; r.speed = s[10]; r.walkAnim = s[11]; r.swingAnim = s[12]; r.bot = s[13]; r.armor = s[14] || null;
          if (r.x === undefined || Math.abs(r.x - r.tx) > 8) { r.x = r.tx; r.y = r.ty; r.z = r.tz; }
        }
        for (const id of Array.from(g.remotes.keys())) if (!seen.has(id)) g.remotes.delete(id);
        return;
      }
      case 'leave': g.remotes.delete(m.id); this.avs.delete(m.id); return;
      case 'be': if (m.v) w.be.set(m.k, m.v); else w.be.delete(m.k); return;
      case 'ents': {
        const seen = new Set();
        for (const s of m.l) {
          seen.add(s[0]);
          let e = g.ents.net.get(s[0]);
          if (!e) { e = new NetEntity(s[0], ETYPE_CODES[s[1]]); g.ents.net.set(s[0], e); g.ents.add(e); }
          e.setState(s);
        }
        for (const [eid, e] of g.ents.net) if (!seen.has(eid)) { e.dead = true; g.ents.net.delete(eid); }
        return;
      }
      case 'snd': g.sound.play(m.n, m.p[0], m.p[1], m.p[2], m.o); if (m.n === 'note' && m.o) g.particles.dust(m.p[0], m.p[1] + 0.7, m.p[2], [1, 0.6, 0.9]); return;
      case 'chat': g.ui.chatLine(m.text); return;
      case 'time': w.time = m.v; return;
      case 'weather': g.rainTarget = m.v; return;
      case 'rules': g.worldRules = m.v; g.settings.peaceful = m.v.peaceful; return;
      case 'boom': g.particles.smoke(m.p[0], m.p[1], m.p[2], 40, [0.85, 0.85, 0.85], true); return;
      case 'pa': for (const [x, y, z, id, meta] of m.l) g.ents.add(new MovingBlockFx(x, y, z, id, meta, m.f)); return;
      case 'hurt': g.player.hurt(m.dmg, m.src, m.kx, m.kz); return;
      case 'push': { const p = g.player; p.x += m.d[0]; p.y += m.d[1]; p.z += m.d[2]; return; }
      case 'launch': g.player.vy = 17; g.player.fallDist = 0; return;
      case 'drops': for (const it of m.items) g.dropItem(m.p[0], m.p[1], m.p[2], it); return;
      case 'xp': if (g.player.addXP && !g.player.creative) g.player.addXP(m.n | 0); return;
    }
  }
  // ================= 보내기 =================
  sendRaw(obj) {
    if (this.mode === 'lan' && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'msg', to: 'host', data: obj }));
    else if (this.mode === 'peer' && this.conn && this.conn.open) wireSend(this.conn, obj);
  }
  send(obj) { if (!this.isHost && this.connected) this.queue('host', obj); }
  sendTo(id, obj) { if (this.isHost) this.queue(id, obj); }
  broadcast(obj, except) {
    if (!this.isHost || !this.peers.size) return;
    if (except === undefined) this.queue('*', obj);
    else for (const id of this.peers.keys()) if (id !== except) this.queue(id, obj);
  }
  queue(dest, obj) { let q = this.out.get(dest); if (!q) { q = []; this.out.set(dest, q); } q.push(obj); }
  flush() {
    if (!this.out.size) return;
    for (const [dest, list] of this.out) {
      const data = list.length === 1 ? list[0] : { t: 'batch', m: list };
      if (this.isHost) {
        if (this.mode === 'lan') { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'msg', to: dest, data })); }
        else if (dest === '*') { for (const p of this.peers.values()) p.send && p.send(data); }
        else { const p = this.peers.get(dest); if (p && p.send) p.send(data); }
      } else this.sendRaw(data);
    }
    this.out.clear();
  }
  sendChat(text) {
    const g = this.g;
    if (!this.connected) { g.ui.chatLine(text); return; }
    if (this.isHost) { g.ui.chatLine(text); this.broadcast({ t: 'chat', text }); }
    else this.send({ t: 'chat', text });
  }
  sendSwing() { this.swingT = 0.3; }
  // 내 아바타·이름이 바뀌면 알리기
  sendAvatar() {
    const g = this.g;
    if (!this.connected) return;
    const msg = { t: 'av', name: g.settings.name, av: avatarNet(g.avatar) };
    if (this.isHost) { msg.id = 'host'; this.broadcast(msg); }
    else this.send(msg);
  }
  // ================= 매 프레임 =================
  update(dt) {
    const g = this.g;
    if (!this.connected || !g.world) return;
    const p = g.player;
    this.stateT += dt; this.entT += dt;
    if (this.swingT > 0) this.swingT -= dt;
    const r2 = (v) => Math.round(v * 100) / 100;
    const sw = g.swing > 0 ? r2(1 - g.swing) : 0;
    if (this.isHost) {
      if (g.netSets.length) { this.broadcast({ t: 'sets', b: g.netSets }); g.netSets = []; }
      if (this.stateT >= 0.1) {
        this.stateT = 0;
        const l = [['host', p.name, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch), p.sneaking ? 1 : 0, p.held ? p.held.id : 0, g.settings.skin, r2(Math.hypot(p.vx, p.vz) / 3), r2(p.bobPhase), sw, g.builder.netState(), p.armor.map(a => a ? a.id : 0)]];
        for (const [id, r] of g.remotes) l.push([id, r.name, r2(r.x), r2(r.y), r2(r.z), r2(r.yaw), r2(r.pitch), r.sneaking ? 1 : 0, r.held || 0, SKINS.indexOf(r.skin), r.speed || 0, r.walkAnim || 0, r.swingAnim || 0, r.bot || null, r.armor || null]);
        this.broadcast({ t: 'players', l });
      }
      if (this.entT >= 0.1) {
        this.entT = 0;
        const l = [];
        for (const e of g.ents.list) { if (e.dead) continue; const s = entityNetState(e); if (s) l.push(s); }
        this.broadcast({ t: 'ents', l });
        if (g.world.tick % 100 === 0) this.broadcast({ t: 'time', v: g.world.time });
      }
    } else {
      if (this.stateT >= 0.1) {
        this.stateT = 0;
        this.send({ t: 'ps', p: [r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch)], s: p.sneaking ? 1 : 0, h: p.held ? p.held.id : 0, v: r2(Math.hypot(p.vx, p.vz) / 3), wa: r2(p.bobPhase), sw, bot: g.builder.netState(), ar: p.armor.map(a => a ? a.id : 0) });
      }
      // 다른 플레이어 보간
      const k = Math.min(1, dt * 12);
      for (const r of g.remotes.values()) if (r.tx !== undefined) { r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k; }
    }
  }
  cleanup() {
    this.stopListing(); clearTimeout(this.joinTimer);
    try { if (this.ws) this.ws.close(); } catch (e) { }
    try { if (this.conn) this.conn.close(); } catch (e) { }
    try { if (this.peer) this.peer.destroy(); } catch (e) { }
    this.ws = null; this.conn = null; this.peer = null; this.lastHost = 0;
    this.isHost = false; this.connected = false; this.mode = null; this.peers.clear(); this.out.clear(); this.avs.clear();
    if (this.g.remotes) this.g.remotes.clear();
  }
  close() { this.cleanup(); }
}
// 참가자가 탄 수레를 움직이기 (NetEntity 에서)
NetEntity.prototype.pushDir = function (look, dt) {
  const g = window.game; if (!g) return;
  this._pushT = (this._pushT || 0) + dt;
  if (this._pushT > 0.1) { this._pushT = 0; g.net.send({ t: 'cartPush', eid: this.eid, d: look }); }
};
