import { useState, useRef } from "react";
import SoloGame from "./SoloGame";
import VsGame from "./VsGame";
import "./theme.css";
import "./App.css";
import { sound } from './sound';

const MODES = [
  {
    id: "solo",
    label: "Solo Ops",
    desc: "Practice alone. Chase the volley streak, grab energy cells.",
  },
  {
    id: "vs",
    label: "VS Encounter",
    desc: "Real-time match against another player.",
  },
  {
    id: "ai",
    label: "AI Protocol",
    desc: "Face a trained model.",
    locked: true,
  },
];

export default function App() {
  const [mode, setMode] = useState(null);
  const [volume, setVolume] = useState(0.8);
  const soundsLoaded = useRef(false);

  const ensureSoundsLoaded = async () => {
    if (soundsLoaded.current) return;
    soundsLoaded.current = true;
    await sound.loadAll({
      wall: '/sfx/ball-contact.mp3',
      paddle: '/sfx/ball-paddle.mp3',
      click: '/sfx/menu-click.mp3',
    });
    sound.setVolume(volume);
  };

  const handleClickSound = async () => {
    await ensureSoundsLoaded();
    sound.play('click');
  };

  const selectMode = async (id) => {
    await handleClickSound();
    setMode(id);
  };

  const goBack = async () => {
    await handleClickSound();
    setMode(null);
  };

  const handleVolumeChange = (e) => {
    const v = Number(e.target.value);
    setVolume(v);
    sound.setVolume(v);
  };

  const VolumeSlider = (
    <div className="volume-control">
      <label htmlFor="volume" className="hud-label">vol</label>
      <input
        id="volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={handleVolumeChange}
      />
    </div>
  );

  if (mode) {
    return (
      <div className="app-shell">
        <button className="hud-btn back-btn" onClick={goBack}>
          &larr; Modes
        </button>
        {VolumeSlider}
        {mode === "solo" && <SoloGame />}
        {mode === "vs" && <VsGame />}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="wordmark">VECTOR</div>
      <div className="tagline hud-label">select mode</div>
      {VolumeSlider}

      <div className="mode-grid">
        {MODES.map((m) => (
          <button
            key={m.id}
            className="mode-card bracket-frame"
            disabled={m.locked}
            onClick={() => !m.locked && selectMode(m.id)}
          >
            <div className="mode-card-label">{m.label}</div>
            <div className="mode-card-desc">{m.desc}</div>
            {m.locked && <div className="mode-card-lock hud-label">offline</div>}
          </button>
        ))}
      </div>
    </div>
  );
}