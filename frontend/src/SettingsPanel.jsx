import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { sound } from './sound';
import './SettingsPanel.css';

export default function SettingsPanel() {
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();

  const handleVolume = (key, soundSetter) => (e) => {
    const v = Number(e.target.value);
    updateSetting(key, v);
    soundSetter(v);
  };

  return (
    <div className="settings-panel bracket-frame">
      <div className="hud-label settings-title">audio</div>

      <div className="volume-control">
        <label htmlFor="settings-sfx" className="hud-label">sfx</label>
        <input
          id="settings-sfx"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.sfxVolume}
          onChange={handleVolume('sfxVolume', (v) => sound.setVolume(v))}
        />
      </div>

      <div className="volume-control">
        <label htmlFor="settings-music" className="hud-label">music</label>
        <input
          id="settings-music"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.musicVolume}
          onChange={handleVolume('musicVolume', (v) => sound.setMusicVolume(v))}
        />
      </div>

      <div className="hud-label settings-title">display fx</div>

      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={settings.scanLines}
          onChange={(e) => updateSetting('scanLines', e.target.checked)}
        />
        Scan Lines
      </label>

      {/* CRT Bulge disabled for now — cursor offset & performance issues
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={settings.crtBulge}
          onChange={(e) => updateSetting('crtBulge', e.target.checked)}
        />
        CRT Bulge (cursor may appear offset)
      </label>
      */}

      {!user && (
        <div className="settings-note hud-label">sign in to save these preferences</div>
      )}
    </div>
  );
}