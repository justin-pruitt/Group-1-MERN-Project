import PlayerAvatar from './PlayerAvatar';
import { playerLabel } from './playerDisplay';
import './PlayerTag.css';

// Compact avatar + name used in the persistent in-match header for both
// VS Encounter and AI Protocol. `colorVar` picks which HUD signal color
// (theme.css) the name renders in, so it can be pointed at whichever
// paddle is actually this player's in the current match, rather than
// always matching left/right position.
export default function PlayerTag({ player, colorVar = '--text' }) {
  const label = playerLabel(player);
  return (
    <span className="player-tag">
      <PlayerAvatar player={player} size="md" crown={!!player?.hasBeatenAI} />
      <strong className="player-tag-name" style={{ color: `var(${colorVar})` }} title={label}>
        {label}
      </strong>
    </span>
  );
}
