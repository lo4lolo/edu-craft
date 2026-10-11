'use strict';
// =====================================================================
// 소리: WebAudio 로 모든 효과음을 합성 (외부 파일 없음)
// =====================================================================
class Sound {
  constructor() { this.ctx = null; this.vol = 0.7; this.listener = { x: 0, y: 0, z: 0, yaw: 0 }; this.last = {}; }
  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { return false; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  out(x, y, z, vol) {
    const c = this.ctx;
    const g = c.createGain();
    let v = vol === undefined ? 1 : vol;
    let pan = 0;
    if (x !== undefined && x !== null) {
      const L = this.listener;
      const dx = x - L.x, dy = y - L.y, dz = z - L.z, d = Math.hypot(dx, dy, dz);
      v *= clamp(1 - d / 28, 0, 1);
      if (v <= 0.01) return null;
      const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
      pan = d > 0.5 ? clamp((dx * rx + dz * rz) / d, -1, 1) * 0.8 : 0;
    }
    g.gain.value = v;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.master); }
    else g.connect(this.master);
    return g;
  }
  noiseHit(dest, t0, dur, type, freq, q, gain, rate) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate || 1;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  tone(dest, t0, dur, type, f0, f1, gain, attack) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + (attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  material(id) { const d = BLOCKS[id]; return d ? d.sound : 'stone'; }
  play(name, x, y, z, opt) {
    if (!this.ensure()) return;
    const now = performance.now();
    const key = name + (x | 0) + (z | 0);
    if (this.last[key] && now - this.last[key] < 25) return;
    this.last[key] = now;
    const c = this.ctx, t = c.currentTime;
    opt = opt || {};
    const vol = opt.vol !== undefined ? opt.vol : 1;
    const o = this.out(x, y, z, vol);
    if (!o) return;
    const mat = opt.mat || 'stone';
    const pitch = opt.pitch || (0.9 + Math.random() * 0.2);
    switch (name) {
      case 'break': case 'place': case 'step': case 'dig': {
        const g = name === 'step' ? 0.25 : name === 'dig' ? 0.3 : 0.6;
        const dur = name === 'break' ? 0.22 : name === 'step' ? 0.08 : 0.12;
        if (mat === 'wood') { this.noiseHit(o, t, dur, 'bandpass', 480 * pitch, 3, g); this.tone(o, t, dur * 0.8, 'triangle', 180 * pitch, 120, g * 0.5); }
        else if (mat === 'grass') this.noiseHit(o, t, dur, 'highpass', 2500 * pitch, 0.7, g * 0.8);
        else if (mat === 'sand') this.noiseHit(o, t, dur * 1.2, 'lowpass', 1400 * pitch, 0.5, g * 0.8);
        else if (mat === 'gravel') this.noiseHit(o, t, dur, 'bandpass', 900 * pitch, 0.8, g);
        else if (mat === 'wool') this.noiseHit(o, t, dur, 'lowpass', 600 * pitch, 0.5, g * 0.7);
        else if (mat === 'glass') { if (name === 'break') { for (let i = 0; i < 5; i++) this.tone(o, t + i * 0.02, 0.15, 'sine', 2000 + Math.random() * 2500, 0, 0.12); } this.noiseHit(o, t, dur, 'highpass', 4000, 1, g * 0.5); }
        else if (mat === 'metal') { this.tone(o, t, 0.25, 'square', 700 * pitch, 0, g * 0.15); this.noiseHit(o, t, dur, 'bandpass', 3000, 2, g * 0.5); }
        else this.noiseHit(o, t, dur, 'bandpass', 1300 * pitch, 1.2, g);
        break;
      }
      case 'click_on': this.tone(o, t, 0.05, 'square', 1000, 0, 0.15); this.noiseHit(o, t, 0.04, 'highpass', 3000, 1, 0.2); break;
      case 'click_off': this.tone(o, t, 0.05, 'square', 750, 0, 0.12); this.noiseHit(o, t, 0.04, 'highpass', 2500, 1, 0.15); break;
      case 'piston_out': this.noiseHit(o, t, 0.25, 'bandpass', 500, 1, 0.5, 0.7); this.tone(o, t, 0.2, 'sawtooth', 120, 60, 0.12); break;
      case 'piston_in': this.noiseHit(o, t, 0.2, 'bandpass', 350, 1, 0.4, 0.6); this.tone(o, t, 0.15, 'sawtooth', 90, 50, 0.1); break;
      case 'door_open': case 'door_close': this.noiseHit(o, t, 0.15, 'bandpass', name === 'door_open' ? 600 : 400, 3, 0.6); this.tone(o, t, 0.12, 'triangle', 150, 90, 0.3); break;
      case 'explode': {
        this.noiseHit(o, t, 1.6, 'lowpass', 700, 0.7, 1.2, 0.5);
        this.tone(o, t, 0.8, 'sine', 70, 30, 0.9);
        this.noiseHit(o, t, 0.4, 'bandpass', 1500, 0.5, 0.6);
        break;
      }
      case 'hurt': this.tone(o, t, 0.2, 'triangle', 330, 160, 0.35); this.noiseHit(o, t, 0.1, 'bandpass', 800, 2, 0.3); break;
      case 'mob_hurt': this.tone(o, t, 0.18, 'sawtooth', 260 * pitch, 140, 0.12); break;
      case 'pop': this.tone(o, t, 0.08, 'sine', 600 * pitch, 1400, 0.2); break;
      case 'fuse': this.noiseHit(o, t, 1.4, 'highpass', 3000, 0.7, 0.35); break;
      case 'fizz': this.noiseHit(o, t, 0.4, 'highpass', 4000, 0.5, 0.25); break;
      case 'bow': this.tone(o, t, 0.2, 'triangle', 400, 150, 0.3); this.noiseHit(o, t, 0.1, 'highpass', 2000, 1, 0.2); break;
      case 'arrow_hit': this.noiseHit(o, t, 0.08, 'bandpass', 1800, 2, 0.4); this.tone(o, t, 0.1, 'triangle', 500, 300, 0.15); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noiseHit(o, t + i * 0.12, 0.08, 'bandpass', 900 + Math.random() * 500, 2, 0.35); break;
      case 'burp': this.tone(o, t, 0.25, 'sawtooth', 110, 80, 0.2); break;
      case 'splash': this.noiseHit(o, t, 0.5, 'lowpass', 1800, 0.5, 0.5); break;
      case 'break_tool': this.noiseHit(o, t, 0.3, 'highpass', 2500, 1, 0.5); this.tone(o, t, 0.2, 'square', 900, 300, 0.1); break;
      case 'cart': this.noiseHit(o, t, 0.3, 'bandpass', 250, 2, 0.12); break;
      case 'elevator': this.tone(o, t, 0.3, 'sine', 300, 900, 0.25); break;
      case 'levelup': [0, 4, 7, 12].forEach((k, i) => this.tone(o, t + i * 0.08, 0.3, 'triangle', 440 * Math.pow(2, k / 12), 0, 0.25)); break;
      case 'bot': this.tone(o, t, 0.06, 'square', 880, 1320, 0.05); break;
      case 'fan': this.noiseHit(o, t, 0.5, 'lowpass', 400, 0.5, 0.15); break;
      case 'note': this.note(o, t, opt.note || 0, opt.inst || 'harp'); break;
    }
  }
  note(o, t, n, inst) {
    const f = 185 * Math.pow(2, n / 12);
    switch (inst) {
      case 'bass': this.tone(o, t, 0.6, 'triangle', f / 4, 0, 0.6); this.tone(o, t, 0.4, 'sine', f / 2, 0, 0.3); break;
      case 'basedrum': this.tone(o, t, 0.25, 'sine', 120 * Math.pow(2, n / 24), 45, 0.9); break;
      case 'snare': this.noiseHit(o, t, 0.18, 'bandpass', 1800 * Math.pow(2, n / 24), 0.8, 0.6); break;
      case 'hat': this.noiseHit(o, t, 0.06, 'highpass', 7000 * Math.pow(2, n / 36), 1, 0.4); break;
      case 'bell': this.tone(o, t, 1.4, 'sine', f * 2, 0, 0.35); this.tone(o, t, 1.0, 'sine', f * 5.04, 0, 0.12); break;
      case 'flute': this.tone(o, t, 0.6, 'sine', f, 0, 0.35, 0.06); break;
      case 'chime': this.tone(o, t, 1.6, 'sine', f * 4, 0, 0.25); this.tone(o, t, 1.2, 'sine', f * 8.1, 0, 0.08); break;
      case 'guitar': this.tone(o, t, 0.7, 'sawtooth', f / 2, 0, 0.12); this.tone(o, t, 0.5, 'triangle', f, 0, 0.2); break;
      case 'xylophone': this.tone(o, t, 0.35, 'sine', f * 2, 0, 0.45); this.tone(o, t, 0.15, 'sine', f * 8, 0, 0.1); break;
      case 'bit': this.tone(o, t, 0.4, 'square', f, 0, 0.12); break;
      default: this.tone(o, t, 0.9, 'triangle', f, 0, 0.45); this.tone(o, t, 0.5, 'sine', f * 2, 0, 0.1);
    }
  }
}
function noteInstrument(world, x, y, z, speaker) {
  if (speaker) return 'bit';
  const id = world.getBlock(x, y - 1, z);
  const n = BLOCKS[id] ? BLOCKS[id].name : '';
  if (/planks|log|bookshelf|crafting|chest|note/.test(n)) return 'bass';
  if (/stone|cobble|brick|obsidian|ore|bedrock|sandstone/.test(n)) return 'basedrum';
  if (/sand|gravel/.test(n)) return 'snare';
  if (/glass|lamp|glowstone/.test(n)) return 'hat';
  if (n === 'gold_block') return 'bell';
  if (n === 'clay') return 'flute';
  if (n === 'ice') return 'chime';
  if (/wool/.test(n)) return 'guitar';
  if (n === 'iron_block') return 'xylophone';
  return 'harp';
}
