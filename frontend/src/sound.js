// src/sound.js
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.buffers = {};
    this.muted = false;
    this.volume = 0.8;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  async load(name, url) {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    this.buffers[name] = await this.ctx.decodeAudioData(arrayBuffer);
  }

  async loadAll(map) {
    this.init();
    await Promise.all(Object.entries(map).map(([name, url]) => this.load(name, url)));
  }

  play(name, { volume = 1 } = {}) {
    if (this.muted || !this.ctx || !this.buffers[name]) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[name];

    const gain = this.ctx.createGain();
    gain.gain.value = volume; // per-sound relative volume, still scaled by masterGain

    source.connect(gain).connect(this.masterGain);
    source.start(0);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

export const sound = new SoundManager();