import { getInitials } from './initials';
import { playerLabel, playerAvatarSrc } from './playerDisplay';
import Crown from './Crown';
import './PlayerAvatar.css';

// Avatar circle for a player, wherever one shows up in the app: falls
// back to initials when there's no picture (same profilePicture >
// avatarUrl > initials chain as ProfileMenu), and shows a crown badge
// for anyone who has beaten the AI Protocol. `size` is a preset ('md' |
// 'lg') rather than a raw pixel value so the mobile breakpoint lives in
// one place (PlayerAvatar.css) instead of fighting inline styles.
export default function PlayerAvatar({ player, size = 'md', crown = false }) {
  const src = playerAvatarSrc(player);
  const label = playerLabel(player);

  return (
    <span className={`player-avatar-wrap player-avatar-${size}`}>
      {crown && <Crown className="player-avatar-crown" />}
      {src ? (
        <img src={src} alt="" className="player-avatar-img" />
      ) : (
        <span className="player-avatar-img player-avatar-fallback">{getInitials(label)}</span>
      )}
    </span>
  );
}
