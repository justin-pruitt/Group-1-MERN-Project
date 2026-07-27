// Resolves what to actually show for a "player" object. The shape
// returned by /api/auth/me (the signed-in user, via AuthContext) and the
// shape sent over sockets in pong:matched/ai:matched (see
// backend/game/publicPlayer.js) share the same four fields, so both feed
// PlayerAvatar/PlayerTag/ClashScreen identically.
export function playerLabel(player) {
  return player?.username || player?.displayName || '?';
}

export function playerAvatarSrc(player) {
  return player?.profilePicture || player?.avatarUrl || null;
}
