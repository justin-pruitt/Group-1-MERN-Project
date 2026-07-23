import React, { memo, useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import { sound } from "./sound";
import { useAuth } from "./AuthContext";
import { getInitials } from "./initials";
import "./VsGame.css";

// Must match backend/game/PongMatch.js
const WIDTH = 700;
const HEIGHT = 450;
const PADDLE_MARGIN = 15;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 8;

export default React.memo(function VsGame() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null); // latest server snapshot; render loop reads this, not React state
  const { user } = useAuth();
  const [phase, setPhase] = useState("idle"); // idle | waiting | playing | ended
  const [side, setSide] = useState(null);
  const [matchup, setMatchup] = useState(null); // { you, opponent } display names from the server
  const [endInfo, setEndInfo] = useState(null);
  const [score, setScore] = useState({ left: 0, right: 0 });
  const [authError, setAuthError] = useState(false);

  // connect only while this mode is mounted, and only once signed in —
  // the server rejects unauthenticated socket connections outright (see
  // server.js), so there's no point connecting without an account.
  useEffect(() => {
    if (!user) return;
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    const onWaiting = () => setPhase("waiting");
    const onMatched = ({ side, you, opponent }) => {
      setSide(side);
      setMatchup({ you, opponent });
      setEndInfo(null);
      setScore({ left: 0, right: 0 });
      setPhase("playing");
    };
    const onState = (state) => {
      stateRef.current = state;
    };
    const onEnd = ({ score, longestVolley }) => {
      setEndInfo({ score, longestVolley });
      setPhase("ended");
    };
    const onOpponentLeft = () => {
      setEndInfo({ opponentLeft: true });
      setPhase("ended");
    };
    const onConnectError = () => {
      setAuthError(true);
      setPhase("idle");
    };

    socket.on("pong:waiting", onWaiting);
    socket.on("pong:matched", onMatched);
    socket.on("pong:state", onState);
    socket.on("pong:end", onEnd);
    socket.on("pong:opponent_left", onOpponentLeft);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("pong:waiting", onWaiting);
      socket.off("pong:matched", onMatched);
      socket.off("pong:state", onState);
      socket.off("pong:end", onEnd);
      socket.off("pong:opponent_left", onOpponentLeft);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const ctx = canvasRef.current.getContext("2d");
    let frameId;
    let lastDrawnScore = { left: 0, right: 0 };
    let lastSpeed = { x: null, y: null };

    const draw = () => {
      const state = stateRef.current;

      ctx.fillStyle = "#0d1220";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#1e2740";
      ctx.fillRect(0, 0, WIDTH, 8);
      ctx.fillRect(0, HEIGHT - 8, WIDTH, 8);

      // faint center line
      ctx.strokeStyle = "#1e2740";
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, 8);
      ctx.lineTo(WIDTH / 2, HEIGHT - 8);
      ctx.stroke();
      ctx.setLineDash([]);

      if (state) {
        // Glowing paddles, matching solo mode's shadowBlur treatment.
        ctx.fillStyle = "#3fe0d0"; // left = signal-a
        ctx.shadowColor = "#3fe0d0";
        ctx.shadowBlur = 8;
        ctx.fillRect(PADDLE_MARGIN, state.paddles.left.y, PADDLE_W, PADDLE_H);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#ff7a45"; // right = signal-b
        ctx.shadowColor = "#ff7a45";
        ctx.shadowBlur = 8;
        ctx.fillRect(WIDTH - PADDLE_MARGIN - PADDLE_W, state.paddles.right.y, PADDLE_W, PADDLE_H);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#e8edf7";
        ctx.beginPath();
        ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();

        const scored =
          state.score.left !== lastDrawnScore.left || state.score.right !== lastDrawnScore.right;

        if (!scored && lastSpeed.x !== null) {
          if (Math.sign(state.ball.speedX) !== Math.sign(lastSpeed.x)) {
            sound.play("paddle");
          }
          if (Math.sign(state.ball.speedY) !== Math.sign(lastSpeed.y)) {
            sound.play("wall");
          }
        }
        lastSpeed = { x: state.ball.speedX, y: state.ball.speedY };

        if (scored) {
          lastDrawnScore = state.score;
          setScore(state.score);
        }
      }

      frameId = requestAnimationFrame(draw);
    };
    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    let lastSent = 0;

    const sendY = (clientY) => {
      const rect = canvas.getBoundingClientRect();
      const scaleY = HEIGHT / rect.height;
      const y = (clientY - rect.top) * scaleY - PADDLE_H / 2;
      const now = performance.now();
      if (now - lastSent > 33) {
        socket.emit("pong:input", y);
        lastSent = now;
      }
    };

    const onMouseMove = (e) => sendY(e.clientY);
    const onTouchMove = (e) => {
      if (e.touches.length > 0) {
        sendY(e.touches[0].clientY);
        e.preventDefault();
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [phase]);

  const findMatch = () => {
    setPhase("connecting");
    socket.emit("pong:queue");
  };

  return (
    <div className="vs-shell">
      <div className="hud-label vs-heading">vs encounter</div>

      {!user ? (
        <div className="vs-status">
          <span>Sign in with Google to play VS mode.</span>
        </div>
      ) : (
        <>
          <div className="vs-status">
            {phase === "idle" && (
              <button className="hud-btn" onClick={findMatch}>
                Find opponent
              </button>
            )}
            {(phase === "connecting" || phase === "waiting") && <span>Scanning for an opponent…</span>}
            {phase === "playing" && matchup && (
              <span className="vs-matchup">
                <strong className={side === "left" ? "vs-side-a" : "vs-side-b"}>
                  {getInitials(matchup.you?.displayName)}
                </strong>
                <span className="vs-matchup-vs">vs</span>
                <strong className={side === "left" ? "vs-side-b" : "vs-side-a"}>
                  {getInitials(matchup.opponent?.displayName)}
                </strong>
              </span>
            )}
            {phase === "ended" && (
              <>
                <span>
                  {endInfo?.opponentLeft
                    ? "Opponent disconnected"
                    : `Final — left ${endInfo?.score?.left ?? 0} · right ${endInfo?.score?.right ?? 0}`}
                  {!endInfo?.opponentLeft && endInfo?.longestVolley ? ` · longest volley ${endInfo.longestVolley}` : ""}
                </span>
                <button className="hud-btn" onClick={findMatch}>
                  Find another
                </button>
              </>
            )}
            {authError && (
              <span className="vs-auth-error">Sign-in required — try refreshing and signing in again.</span>
            )}
          </div>

          {phase === "playing" && (
            <div className="vs-stats">
              <span className="hud-label vs-stat-left">Left {score.left}</span>
              <span className="hud-label vs-stat-right">Right {score.right}</span>
            </div>
          )}

          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="vs-canvas" />
        </>
      )}
    </div>
  );
});
