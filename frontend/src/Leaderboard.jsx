import { useEffect, useState } from 'react';
import './Leaderboard.css';

// Shared leaderboard widget. Used both on the post-game screen (locked to
// one mode, no tabs) and on the home screen (mode switch enabled since
// there's no "current game" to infer it from).
export default function Leaderboard({ mode = 'solo', refreshKey, allowModeSwitch = false }) {
  const [activeMode, setActiveMode] = useState(mode);
  const [scores, setScores] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  // Keep in sync if the caller changes `mode` out from under us (not used
  // today, but avoids a stale tab if that ever happens).
  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetch(`/api/leaderboard?mode=${activeMode}`)
      .then((res) => {
        if (!res.ok) throw new Error('bad response');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setScores(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [activeMode, refreshKey]);

  return (
    <div className="leaderboard-widget">
      {allowModeSwitch && (
        <div className="leaderboard-tabs">
          <button
            type="button"
            className={`leaderboard-tab hud-label${activeMode === 'solo' ? ' active' : ''}`}
            onClick={() => setActiveMode('solo')}
          >
            solo
          </button>
          <button
            type="button"
            className={`leaderboard-tab hud-label${activeMode === 'vs' ? ' active' : ''}`}
            onClick={() => setActiveMode('vs')}
          >
            vs
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="leaderboard-status hud-label">Loading leaderboard…</div>
      )}
      {status === 'error' && (
        <div className="leaderboard-status hud-label">Leaderboard unavailable</div>
      )}
      {status === 'ready' && scores.length === 0 && (
        <div className="leaderboard-status hud-label">No runs saved yet</div>
      )}
      {status === 'ready' && scores.length > 0 && (
        <ol className="leaderboard-list">
          {scores.map((entry, i) => (
            <li key={entry._id} className="leaderboard-row">
              <span className="leaderboard-rank hud-label">{i + 1}</span>
              <span className="leaderboard-name">{entry.displayName}</span>
              <span className="leaderboard-score">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
