import { useAuth } from './AuthContext';
import { getInitials } from './initials';
import './ProfileMenu.css';

export default function ProfileMenu() {
  const { user, loading, logout, loginUrl } = useAuth();

  if (loading) return <div className="profile-menu" />;

  return (
    <div className="profile-menu">
      {user ? (
        <>
          {user.avatarUrl && <img src={user.avatarUrl} alt="" className="profile-avatar" />}
          <span className="profile-name" title={user.displayName}>
            {getInitials(user.displayName)}
          </span>
          {!user.emailVerified && (
            <span className="profile-verify-banner" title="Check your inbox for a verification link">
              Verify your email
            </span>
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
