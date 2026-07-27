import { useEffect, useRef } from "react";
import { sound } from "./sound";
import PlayerAvatar from "./PlayerAvatar";
import Medal from "./Medal";
import { playerLabel } from "./playerDisplay";
import "./ClashScreen.css";

// Total run time of the clash intro, timed to Clash.mp3 (~3.29s, with a
// touch of padding so the tail doesn't get cut off). Backend keeps
// MATCH_START_DELAY_MS in matchmaking.js in sync with this by hand — see
// the comment there.
export const CLASH_DURATION_MS = 3300;
const FADE_OUT_MS = 250;

// Plays once when two players are matched in VS Encounter, between
// matchmaking and CountdownOverlay: a diagonal "versus" split with both
// players' avatars sliding in and colliding, then holding so both sides
// can actually read who they're up against before the countdown starts.
//
// "you" always renders in the upper-left panel and "opponent" in the
// lower-right regardless of which paddle side you're actually on — side
// only controls which HUD signal color each panel uses, the same split
// VsGame's own matchup header uses, so your color stays consistent once
// the match actually starts.
export default function ClashScreen({ you, opponent, side, onDone }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    sound.play("clash");
    const timer = setTimeout(() => onDoneRef.current(), CLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const youColorVar = side === "left" ? "--signal-a" : "--signal-b";
  const opponentColorVar = side === "left" ? "--signal-b" : "--signal-a";
  const youLabel = playerLabel(you);
  const opponentLabel = playerLabel(opponent);

  return (
    <div className="clash-screen" style={{ animationDelay: `${CLASH_DURATION_MS - FADE_OUT_MS}ms` }}>
      <span className="clash-sr-announce" role="status">
        {`Matched — you vs ${opponentLabel}`}
      </span>

      <div className="clash-panel clash-panel-you" style={{ "--panel-color": `var(${youColorVar})` }}>
        <div className="clash-panel-content">
          <PlayerAvatar player={you} size="lg" crown={!!you?.hasBeatenAI} />
          <div className="clash-panel-name" title={youLabel}>
            {youLabel}
          </div>
          {you?.hasBeatenAI && (
            <div className="clash-medal">
              <Medal className="clash-medal-icon" />
              <span>AI Protocol cleared</span>
            </div>
          )}
        </div>
      </div>

      <div className="clash-panel clash-panel-opponent" style={{ "--panel-color": `var(${opponentColorVar})` }}>
        <div className="clash-panel-content">
          <PlayerAvatar player={opponent} size="lg" crown={!!opponent?.hasBeatenAI} />
          <div className="clash-panel-name" title={opponentLabel}>
            {opponentLabel}
          </div>
          {opponent?.hasBeatenAI && (
            <div className="clash-medal">
              <Medal className="clash-medal-icon" />
              <span>AI Protocol cleared</span>
            </div>
          )}
        </div>
      </div>

      <div className="clash-flash" />
      <svg className="clash-burst" viewBox="0 0 200 200" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => {
          const angle = (i / 10) * Math.PI * 2;
          const x1 = 100 + Math.cos(angle) * 18;
          const y1 = 100 + Math.sin(angle) * 18;
          const x2 = 100 + Math.cos(angle) * 44;
          const y2 = 100 + Math.sin(angle) * 44;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="clash-burst-line" />;
        })}
      </svg>
      <div className="clash-vs-badge" aria-hidden="true">
        <span className="clash-vs-v">V</span>
        <span className="clash-vs-s">S</span>
      </div>
    </div>
  );
}
