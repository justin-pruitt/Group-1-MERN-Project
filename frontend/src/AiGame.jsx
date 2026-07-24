import React, { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import { sound } from "./sound";
import { useAuth } from "./AuthContext";
import "./AiGame.css";

// Must match backend/game/PongMatch.js
const WIDTH = 700;
const HEIGHT = 450;
const PADDLE_MARGIN = 15;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 8;

export default React.memo(function AiGame() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null); // latest server snapshot; render loop reads this, not React state
  const { user } = useAuth();
  const [phase, setPhase] = useState("idle"); // idle | connecting | playing | ended
  const [endInfo, setEndInfo] = useState(null);
  const [score, setScore] = useState({ left: 0, right: 0 });
  const [authError, setAuthError] = useState(false);
  const [line, setLine] = useState(null); // latest commentary line

  // Same auth-gated connection pattern as VsGame — the server rejects
  // unauthenticated socket connections outright (see server.js).
  useEffect(() => {
    if (!user) return;
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    const onMatched = () => {
      setEndInfo(null);
      setScore({ left: 0, right: 0 });
      setLine(null);
      setPhase("playing");
    };
    const onState = (state) => {
      stateRef.current = state;
    };
    const onEnd = ({ score, longestVolley }) => {
      setEndInfo({ score, longestVolley });
      setPhase("ended");
    };
    const onSay = (text) => {
      if (text) setLine(text);
    };
    const onConnectError = () => {
      setAuthError(true);
      setPhase("idle");
    };

    socket.on("ai:matched", onMatched);
    socket.on("pong:state", onState);
    socket.on("pong:end", onEnd);
    socket.on("ai:say", onSay);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("ai:matched", onMatched);
      socket.off("pong:state", onState);
      socket.off("pong:end", onEnd);
      socket.off("ai:say", onSay);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  // Leaving the mode mid-match should free the server-side match/interval
  // rather than leaving it running against a socket nobody's watching.
  useEffect(() => {
    return () => {
      if (socket.connected) socket.emit("ai:stop");
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

      ctx.strokeStyle = "#1e2740";
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, 8);
      ctx.lineTo(WIDTH / 2, HEIGHT - 8);
      ctx.stroke();
      ctx.setLineDash([]);

      if (state) {
        ctx.fillStyle = "#3fe0d0"; // left = you
        ctx.shadowColor = "#3fe0d0";
        ctx.shadowBlur = 8;
        ctx.fillRect(PADDLE_MARGIN, state.paddles.left.y, PADDLE_W, PADDLE_H);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#ff7a45"; // right = agent
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

  const startMatch = () => {
    setPhase("connecting");
    socket.emit("ai:start");
  };

  return (
    <div className="ai-shell">
      <div className="hud-label ai-heading">ai protocol</div>

      {!user ? (
        <div className="ai-status">
          <span>Sign in with Google to face the model.</span>
        </div>
      ) : (
        <>
          <div className="ai-status">
            {phase === "idle" && (
              <button className="hud-btn" onClick={startMatch}>
                Initiate match
              </button>
            )}
            {phase === "connecting" && <span>Loading model…</span>}
            {phase === "playing" && (
              <span className="ai-matchup">
                <strong className="ai-side-you">You</strong>
                <span className="ai-matchup-vs">vs</span>
                <strong className="ai-side-agent">Agent</strong>
              </span>
            )}
            {phase === "ended" && (
              <>
                <span>
                  {`Final — you ${endInfo?.score?.left ?? 0} · agent ${endInfo?.score?.right ?? 0}`}
                  {endInfo?.longestVolley ? ` · longest volley ${endInfo.longestVolley}` : ""}
                </span>
                <button className="hud-btn" onClick={startMatch}>
                  Rematch
                </button>
              </>
            )}
            {authError && (
              <span className="ai-auth-error">Sign-in required — try refreshing and signing in again.</span>
            )}
          </div>

          {phase === "playing" && (
            <div className="ai-stats">
              <span className="hud-label ai-stat-left">You {score.left}</span>
              <span className="hud-label ai-stat-right">Agent {score.right}</span>
            </div>
          )}

          <div className="ai-canvas-wrap">
            <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="ai-canvas" />
            {(phase === "playing" || phase === "ended") && line && (
              <div className="ai-say bracket-frame" key={line}>
                {line}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
});
