// Ribbon medal shown in ClashScreen for a player who has beaten the AI
// Protocol — a bigger, one-off celebratory flourish, distinct from the
// small persistent Crown badge used everywhere else. Ribbon tails use
// the same signal-a/signal-b colors as the paddles for a little cohesion
// with the rest of the HUD.
export default function Medal({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M8 2 L11 13 L7 15 Z" fill="var(--signal-a, #3fe0d0)" />
      <path d="M16 2 L13 13 L17 15 Z" fill="var(--signal-b, #ff7a45)" />
      <circle cx="12" cy="15.5" r="6.5" fill="#ffcf5c" stroke="#a9711a" strokeWidth="1" />
      <path
        d="M12 11.5 L13.2 14 L16 14.4 L14 16.3 L14.5 19 L12 17.6 L9.5 19 L10 16.3 L8 14.4 L10.8 14 Z"
        fill="#a9711a"
      />
    </svg>
  );
}
