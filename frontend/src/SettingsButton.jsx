import { useState, useRef, useEffect } from 'react';
import SettingsPanel from './SettingsPanel';
import './SettingsButton.css';

export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="settings-dock" ref={ref}>
      <button
        className="hud-btn settings-gear-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
      >
        ⚙
      </button>
      {open && (
        <div className="settings-popover">
          <SettingsPanel />
        </div>
      )}
    </div>
  );
}