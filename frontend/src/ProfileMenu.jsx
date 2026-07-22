import { useAuth } from './AuthContext';
import './ProfileMenu.css';

export default function ProfileMenu() {
  const { user, loading, logout, loginUrl } = useAuth();

  if (loading) return <div className="profile-menu" />;

  return (
    <div className="profile-menu">
      {user ? (
        <>
          {user.avatarUrl && <img src={user.avatarUrl} alt="" className="profile-avatar" />}
          <span className="profile-name">{user.displayName}</span>
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
