// Small badge shown next to a player's avatar/name once they've beaten
// the AI Protocol agent (see hasBeatenAI on the User model). Purely
// decorative — the win itself is announced in text nearby.
export default function Crown({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 18 L4 9 L8 13 L12 6 L16 13 L20 9 L20 18 Z"
        fill="#ffcf5c"
        stroke="#a9711a"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="9" r="1.4" fill="#ffcf5c" stroke="#a9711a" strokeWidth="0.75" />
      <circle cx="12" cy="6" r="1.6" fill="#ffcf5c" stroke="#a9711a" strokeWidth="0.75" />
      <circle cx="20" cy="9" r="1.4" fill="#ffcf5c" stroke="#a9711a" strokeWidth="0.75" />
      <rect x="3" y="17.5" width="18" height="2.5" rx="0.8" fill="#ffcf5c" stroke="#a9711a" strokeWidth="0.75" />
    </svg>
  );
}
