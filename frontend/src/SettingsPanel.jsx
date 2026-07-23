import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import './SettingsPanel.css';

export default function SettingsPanel() {
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();

  return (
    <div className="settings-panel bracket-frame">
      <div className="hud-label settings-title">display fx</div>

      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={settings.scanLines}
          onChange={(e) => updateSetting('scanLines', e.target.checked)}
        />
        Scan Lines
      </label>

      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={settings.crtBulge}
          onChange={(e) => updateSetting('crtBulge', e.target.checked)}
        />
        CRT Bulge
      </label>

      {!user && (
        <div className="settings-note hud-label">sign in to save these preferences</div>
      )}
    </div>
  );
}