// Shape of a player's public identity sent to their opponent over sockets
// — deliberately excludes email, googleId, and anything else account-ish.
// Shared between matchmaking.js (VS) and aiMatchmaking.js so both modes
// describe a player the same way to the frontend's PlayerAvatar/PlayerTag/
// ClashScreen components.
function publicPlayer(user) {
  if (!user) return null;
  return {
    displayName: user.displayName,
    username: user.username || null,
    profilePicture: user.profilePicture || null,
    avatarUrl: user.avatarUrl || null,
    hasBeatenAI: !!user.hasBeatenAI,
  };
}

module.exports = { publicPlayer };
