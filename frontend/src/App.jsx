import { useState, useRef, useEffect } from "react";
import SoloGame from "./SoloGame";
import VsGame from "./VsGame";
import ProfileMenu from "./ProfileMenu";
import SettingsButton from "./SettingsButton";
import { useSettings } from "./SettingsContext";
import Leaderboard from "./Leaderboard";
import "./theme.css";
import "./App.css";
import "./crt.css";
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
  const soundsLoaded = useRef(false);
  const { settings } = useSettings();

  useEffect(() => {
    document.body.classList.toggle('crt-scanlines', settings.scanLines);
    document.body.classList.toggle('crt-bulge', settings.crtBulge);
  }, [settings.scanLines, settings.crtBulge]);


  const ensureSoundsLoaded = async () => {
    if (soundsLoaded.current) return;
    soundsLoaded.current = true;
    await sound.loadAll({
      wall: '/Assets/sfx/ball-contact.mp3',
      paddle: '/Assets/sfx/ball-paddle.mp3',
      click: '/Assets/sfx/menu-click.mp3',
    });
    sound.setVolume(settings.volume);
    sound.setMusicVolume(settings.musicVolume);
    // Browsers require a user gesture before audio can start; this runs
    // inside a click handler (selectMode/goBack), so it's a valid gesture.
    sound.startMusic();
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

  const handleMusicVolumeChange = (e) => {
    const v = Number(e.target.value);
    setMusicVolume(v);
    sound.setMusicVolume(v);
  };

  if (mode) {
    return (
      <div className="app-shell">
        <button className="hud-btn back-btn" onClick={goBack}>
          &larr; Modes
        </button>
        {mode === "solo" && <SoloGame />}
        {mode === "vs" && <VsGame />}
        <SettingsButton />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ProfileMenu />
      <div className="wordmark">VECTOR</div>
      <div className="tagline hud-label">select mode</div>

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

      <div className="home-leaderboard bracket-frame">
        <div className="hud-label home-leaderboard-heading">leaderboard</div>
        <Leaderboard allowModeSwitch />
      </div>

      <SettingsButton />
    </div>
  );
}