import { useState } from "react";
import SoloGame from "./SoloGame";
import VsGame from "./VsGame";
import "./theme.css";
import "./App.css";

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

  if (mode) {
    return (
      <div className="app-shell">
        <button className="hud-btn back-btn" onClick={() => setMode(null)}>
          &larr; Modes
        </button>
        {mode === "solo" && <SoloGame />}
        {mode === "vs" && <VsGame />}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="wordmark">VECTOR</div>
      <div className="tagline hud-label">select mode</div>

      <div className="mode-grid">
        {MODES.map((m) => (
          <button
            key={m.id}
            className="mode-card bracket-frame"
            disabled={m.locked}
            onClick={() => !m.locked && setMode(m.id)}
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
