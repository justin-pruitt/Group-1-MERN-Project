// Converts a full display name into 1-2 character initials for compact UI
// display (profile menu, leaderboard rows, VS opponent tags). Kept as a
// small pure function so it's trivial to reuse everywhere a name shows up.
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
