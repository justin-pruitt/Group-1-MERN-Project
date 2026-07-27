import { useAuth } from './AuthContext';
import { getInitials } from './initials';
import ProfilePanel from './ProfilePanel';
import './ProfileMenu.css';
import { useEffect, useRef, useState } from 'react';

export default function ProfileMenu() {
  const { user, loading, logout, loginUrl } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!editing) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setEditing(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editing]);

  if (loading) return <div className="profile-menu" />;

  const handleResend = async () => {
    setSending(true);
    setSent(false);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send verification email');
      }
    } catch (err) {
      alert('Network error sending verification email');
    } finally {
      setSending(false);
    }
  };

  const avatarSrc = user?.profilePicture || user?.avatarUrl;
  const displayLabel = user?.username || user?.displayName;

  return (
    <div className="profile-menu" ref={menuRef}>
      {user ? (
        <>
          <button
            type="button"
            className="profile-avatar-btn"
            onClick={() => setEditing((o) => !o)}
            title="Edit profile"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="profile-avatar" />
            ) : (
              <span className="profile-avatar profile-avatar-fallback">{getInitials(displayLabel)}</span>
            )}
          </button>
          <span className="profile-name" title={displayLabel}>
            {displayLabel}
          </span>
          {editing && (
            <div className="profile-panel-popover">
              <ProfilePanel onClose={() => setEditing(false)} />
            </div>
          )}
          {!user.emailVerified && (
            <button // button for resending verification email
              className="profile-verify-banner"
              onClick={handleResend}
              disabled={sending}
              title="Click to resend the verification link to your email"
            >
              {sending ? 'Sending...' : sent ? 'Sent! Check your inbox' : 'Verify your email'}
            </button>
          )}
          <button className="hud-btn" onClick={logout}>
            Sign out
          </button>
        </>
      ) : (
        <a className="hud-btn profile-signin" href={loginUrl}>
          Sign in with Google
        </a>
      )}
    </div>
  );
}
