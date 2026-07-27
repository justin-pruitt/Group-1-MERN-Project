import { useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import './ProfilePanel.css';

const MAX_DIMENSION = 128;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Resizes/re-encodes the chosen file client-side so uploads stay small —
// the backend caps stored images at 300KB and this keeps well under that.
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read image'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilePanel({ onClose }) {
  const { user, refresh } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [preview, setPreview] = useState(user?.profilePicture || user?.avatarUrl || null);
  const [pendingImage, setPendingImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-choosing the same file later
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a PNG, JPEG, or WEBP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large (max 5MB)');
      return;
    }

    try {
      const dataUrl = await resizeImage(file);
      setPendingImage(dataUrl);
      setPreview(dataUrl);
      setError('');
    } catch {
      setError('Could not process that image');
    }
  };

  const handleSave = async () => {
    const trimmed = username.trim();
    const body = {};
    if (trimmed !== (user?.username || '')) body.username = trimmed;
    if (pendingImage) body.profilePicture = pendingImage;

    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save profile');
        return;
      }
      await refresh();
      onClose();
    } catch {
      setError('Network error saving profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-panel bracket-frame">
      <div className="hud-label settings-title">edit profile</div>

      <div className="profile-panel-avatar-row">
        {preview ? (
          <img src={preview} alt="" className="profile-panel-preview" />
        ) : (
          <div className="profile-panel-preview profile-panel-preview-empty hud-label">?</div>
        )}
        <button type="button" className="hud-btn" onClick={() => fileRef.current?.click()}>
          Choose picture
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>

      <label className="profile-panel-field">
        <span className="hud-label">username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={user?.displayName}
          maxLength={20}
        />
      </label>

      {error && <div className="profile-panel-error hud-label">{error}</div>}

      <div className="profile-panel-actions">
        <button type="button" className="hud-btn" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="hud-btn profile-panel-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
