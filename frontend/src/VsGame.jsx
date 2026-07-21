import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import "./VsGame.css";

// Must match backend/game/PongMatch.js
const WIDTH = 700;
const HEIGHT = 450;
const PADDLE_MARGIN = 15;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 8;

export default function VsGame() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null); // latest server snapshot; render loop reads this, not React state
  const [phase, setPhase] = useState("idle"); // idle | waiting | playing | ended
  const [side, setSide] = useState(null);
  const [endInfo, setEndInfo] = useState(null);

  // connect only while this mode is mounted
  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const onWaiting = () => setPhase("waiting");
    const onMatched = ({ side }) => {
      setSide(side);
      setEndInfo(null);
      setPhase("playing");
    };
    const onState = (state) => {
      stateRef.current = state;
    };
    const onEnd = (score) => {
      setEndInfo({ score });
      setPhase("ended");
    };
    const onOpponentLeft = () => {
      setEndInfo({ opponentLeft: true });
      setPhase("ended");
    };

    socket.on("pong:waiting", onWaiting);
    socket.on("pong:matched", onMatched);
    socket.on("pong:state", onState);
    socket.on("pong:end", onEnd);
    socket.on("pong:opponent_left", onOpponentLeft);

    return () => {
      socket.off("pong:waiting", onWaiting);
      socket.off("pong:matched", onMatched);
      socket.off("pong:state", onState);
      socket.off("pong:end", onEnd);
      socket.off("pong:opponent_left", onOpponentLeft);
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const ctx = canvasRef.current.getContext("2d");
    let frameId;

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
        ctx.fillStyle = "#3fe0d0"; // left = signal-a
        ctx.fillRect(PADDLE_MARGIN, state.paddles.left.y, PADDLE_W, PADDLE_H);
        ctx.fillStyle = "#ff7a45"; // right = signal-b
        ctx.fillRect(WIDTH - PADDLE_MARGIN - PADDLE_W, state.paddles.right.y, PADDLE_W, PADDLE_H);

        ctx.fillStyle = "#e8edf7";
        ctx.beginPath();
        ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 28px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#6b7694";
        ctx.fillText(`${state.score.left}   ${state.score.right}`, WIDTH / 2, 40);
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

      <div className="vs-status">
        {phase === "idle" && (
          <button className="hud-btn" onClick={findMatch}>
            Find opponent
          </button>
        )}
        {(phase === "connecting" || phase === "waiting") && <span>Scanning for an opponent…</span>}
        {phase === "playing" && (
          <span>
            You are <strong className={side === "left" ? "vs-side-a" : "vs-side-b"}>{side?.toUpperCase()}</strong>
          </span>
        )}
        {phase === "ended" && (
          <>
            <span>
              {endInfo?.opponentLeft
                ? "Opponent disconnected"
                : `Final — left ${endInfo?.score?.left ?? 0} · right ${endInfo?.score?.right ?? 0}`}
            </span>
            <button className="hud-btn" onClick={findMatch}>
              Find another
            </button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="vs-canvas" />
    </div>
  );
}
