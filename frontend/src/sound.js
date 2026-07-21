// src/sound.js

// Playback order requested for the background track: stage 1, into stage 2,
// through the 2->3 transition, into stage 3, then the trailing transition
// before looping back to stage 1.
const MUSIC_PLAYLIST = [
  '/Assets/songs/Week 4 - Cloak of Darkness STAGE 1.ogg',
  '/Assets/songs/Week 4 - Cloak of Darkness STAGE 2.ogg',
  '/Assets/songs/Week 4 - Cloak of Darkness STAGE 2 TRANS.ogg',
  '/Assets/songs/Week 4 - Cloak of Darkness STAGE 3.ogg',
  '/Assets/songs/Week 4 - Cloak of Darkness STAGE 3 TRANS.ogg',
];

class SoundManager {
  constructor() {
    // --- SFX: short one-shot clips, decoded up front into an AudioContext
    // buffer graph so overlapping hits (paddle + wall in the same frame)
    // can play concurrently with minimal latency. ---
    this.ctx = null;
    this.masterGain = null;
    this.buffers = {};
    this.muted = false;
    this.sfxVolume = 0.8;

    // --- Music: multi-minute tracks streamed sequentially through a plain
    // <audio> element with its own volume, independent of SFX. Decoding
    // these fully via decodeAudioData would be slow for no benefit since
    // we only ever need one playing at a time. ---
    this.musicEl = null;
    this.musicVolume = 0.5;
    this.musicIndex = -1;
    this.musicStarted = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.sfxVolume;
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
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.sfxVolume;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // --- Music playlist ---

  // Must be called from inside a user-gesture handler (a click, in
  // practice) or browsers will block playback. Safe to call repeatedly;
  // only the first call actually starts anything.
  startMusic() {
    if (this.musicStarted) return;
    this.musicStarted = true;
    this.musicEl = new Audio();
    this.musicEl.volume = this.musicVolume;
    this.musicEl.addEventListener('ended', () => this._advanceTrack());
    this._advanceTrack();
  }

  _advanceTrack() {
    if (!this.musicEl) return;
    this.musicIndex = (this.musicIndex + 1) % MUSIC_PLAYLIST.length;
    this.musicEl.src = MUSIC_PLAYLIST[this.musicIndex];
    // Autoplay can still be rejected in edge cases (e.g. the gesture that
    // triggered startMusic() was long ago); fail silently rather than
    // throwing an unhandled rejection.
    this.musicEl.play().catch(() => {});
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicEl) {
      this.musicEl.volume = this.musicVolume;
    }
  }

  stopMusic() {
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.removeAttribute('src');
      this.musicEl = null;
    }
    this.musicStarted = false;
    this.musicIndex = -1;
  }
}

export const sound = new SoundManager();
