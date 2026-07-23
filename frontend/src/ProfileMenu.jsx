import { useAuth } from './AuthContext';
import { getInitials } from './initials';
import './ProfileMenu.css';
import { useState } from 'react';

export default function ProfileMenu() {
  const { user, loading, logout, loginUrl } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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

  return (
    <div className="profile-menu">
      {user ? (
        <>
          {user.avatarUrl && <img src={user.avatarUrl} alt="" className="profile-avatar" />}
          <span className="profile-name" title={user.displayName}>
            {getInitials(user.displayName)}
          </span>
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
