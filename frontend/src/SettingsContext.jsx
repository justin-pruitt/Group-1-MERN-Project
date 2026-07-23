import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);
const DEFAULTS = { crtBulge: false, scanLines: false };

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    setSettings(user?.settings ? { ...DEFAULTS, ...user.settings } : DEFAULTS);
  }, [user]);

  const updateSetting = async (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (!user) return; // guests: preview only, nothing to save

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSettings((prev) => ({ ...prev, [key]: !value })); // revert on failure
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}