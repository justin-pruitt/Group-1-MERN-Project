import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from './sound';
import './SoloGame.css';

// Theme colors (kept as literals here since canvas fillStyle can't read
// CSS custom properties directly — keep in sync with theme.css if it changes).
const COLOR_BG = '#0d1220';
const COLOR_EDGE = '#1e2740';
const COLOR_PADDLE = '#3fe0d0';
const COLOR_BALL = '#e8edf7';
const COLOR_CELL = '#b98cff';

function Rally({ onGameOver }) {
  const canvasRef = useRef(null);
  const [gameStats, setGameStats] = useState({ volleys: 0, points: 0, total: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const player = { x: 15, y: 150, w: 12, h: 80, volleys: 0 };

    // Base speed the ball resets to on each life; growth is capped so
    // things never become unplayable.
    // Matched to versus mode's real-world speed: PongMatch.js runs its
    // physics on a 50Hz server tick (launch ~250px/s, cap ~1000px/s),
    // while this loop is normalized to REFERENCE_FPS=60 below, so the
    // per-"frame" constants here are those targets divided by 60.
    const BASE_SPEED = 4.2;
    const MAX_SPEED = 16.7;

    // Launch at a random angle each time so the very first rally isn't
    // always the same predictable path.
    const randomLaunch = () => {
      const angle = (Math.random() * 0.6 - 0.3) * Math.PI; // ~-54deg to 54deg
      const dir = Math.random() < 0.5 ? 1 : -1; // toward paddle or away first
      return {
        x: 300,
        y: 150 + Math.random() * 100,
        r: 8,
        speedX: Math.cos(angle) * BASE_SPEED * dir,
        speedY: Math.sin(angle) * BASE_SPEED
      };
    };

    const ball = randomLaunch();

    // Keep the ball's speed within [BASE_SPEED, MAX_SPEED] while preserving
    // its current direction, so ramping never runs away or stalls out.
    const clampSpeed = () => {
      const speed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
      if (speed > MAX_SPEED) {
        const scale = MAX_SPEED / speed;
        ball.speedX *= scale;
        ball.speedY *= scale;
      } else if (speed < BASE_SPEED) {
        const scale = BASE_SPEED / speed;
        ball.speedX *= scale;
        ball.speedY *= scale;
      }
    };

    let cell = { x: 400, y: 200, r: 12, value: 5 };
    let totalPointsCollected = 0;

    const respawnCell = () => {
      cell.x = Math.floor(Math.random() * (canvas.width - 150)) + 100;
      cell.y = Math.floor(Math.random() * (canvas.height - 40)) + 20;
    };

    const handleMove = (clientY) => {
      const rect = canvas.getBoundingClientRect();
      const scaleY = canvas.height / rect.height;
      const relativeY = (clientY - rect.top) * scaleY;
      player.y = relativeY - player.h / 2;
    };

    const onMouseMove = (e) => handleMove(e.clientY);
    const onTouchMove = (e) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientY);
        e.preventDefault();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    let animationFrameId;
    let lastTime = null;

    // Reference frame rate the BASE_SPEED/MAX_SPEED constants were tuned
    // against. Scaling by (dt * REFERENCE_FPS) means the ball covers the
    // same distance per second on a 30Hz, 60Hz, or 144Hz device instead of
    // moving faster on higher refresh-rate screens.
    const REFERENCE_FPS = 60;
    const MAX_DT = 1 / 30; // clamp so a tab-switch/lag spike can't let the ball tunnel through the paddle in one jump

    const updateGame = (now) => {
      if (lastTime === null) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, MAX_DT);
      lastTime = now;
      const step = dt * REFERENCE_FPS;

      ball.x += ball.speedX * step;
      ball.y += ball.speedY * step;

      if (ball.y - ball.r <= 8 || ball.y + ball.r >= canvas.height - 8) {
        ball.speedY *= -1;
        ball.speedX += (Math.random() - 0.5) * 0.6;
        clampSpeed();
        sound.play('wall');
      }

      if (ball.x + ball.r >= canvas.width - 8) {
        ball.speedX *= -1;
        ball.speedY += (Math.random() - 0.5) * 0.6;
        clampSpeed();
        sound.play('wall');
      }

      if (
        ball.x - ball.r <= player.x + player.w &&
        ball.x + ball.r >= player.x &&
        ball.y + ball.r >= player.y &&
        ball.y - ball.r <= player.y + player.h
      ) {
        if (ball.speedX < 0) {
          const hitPos = ((ball.y - player.y) / player.h) * 2 - 1;
          const clampedHit = Math.max(-1, Math.min(1, hitPos));

          const speed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY) * 1.05;
          const maxBounceAngle = (Math.PI / 180) * 60;
          const angle = clampedHit * maxBounceAngle;

          ball.speedX = Math.cos(angle) * speed;
          ball.speedY = Math.sin(angle) * speed;
          clampSpeed();
          sound.play('paddle');

          player.volleys += 1;
          setGameStats({
            volleys: player.volleys,
            points: totalPointsCollected,
            total: player.volleys + totalPointsCollected
          });
        }
      }

      const distX = ball.x - cell.x;
      const distY = ball.y - cell.y;
      const distance = Math.sqrt(distX * distX + distY * distY);

      if (distance < ball.r + cell.r) {
        totalPointsCollected += cell.value;
        setGameStats({
          volleys: player.volleys,
          points: totalPointsCollected,
          total: player.volleys + totalPointsCollected
        });
        respawnCell();
      }

      if (ball.x - ball.r <= 0) {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
        onGameOver(player.volleys + totalPointsCollected);
        return;
      }

      ctx.fillStyle = COLOR_BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = COLOR_EDGE;
      ctx.fillRect(canvas.width - 8, 0, 8, canvas.height);
      ctx.fillRect(0, 0, canvas.width, 8);
      ctx.fillRect(0, canvas.height - 8, canvas.width, 8);

      ctx.fillStyle = COLOR_PADDLE;
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.shadowColor = COLOR_PADDLE;
      ctx.shadowBlur = 8;
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.shadowBlur = 0;

      ctx.fillStyle = COLOR_BALL;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLOR_CELL;
      ctx.shadowColor = COLOR_CELL;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, cell.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(updateGame);
    };

    animationFrameId = requestAnimationFrame(updateGame);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [onGameOver]);

  return (
    <div className="solo-wrap">
      <div className="solo-stats">
        <span className="hud-label">Volleys {gameStats.volleys}</span>
        <span className="hud-label solo-stat-cells">Cells +{gameStats.points}</span>
        <span className="solo-stat-total">{gameStats.total}</span>
      </div>

      <canvas
        ref={canvasRef}
        width={700}
        height={450}
        className="solo-canvas"
      />
    </div>
  );
}

export default React.memo(function SoloGame() {
  const [key, setKey] = useState(0);
  const [finalScore, setFinalScore] = useState(null);

  const handleGameOver = useCallback((score) => {
    setFinalScore(score);
  }, []);

  const restart = () => {
    setFinalScore(null);
    setKey((k) => k + 1);
  };

  return (
    <div className="solo-shell">
      <div className="hud-label solo-heading">solo ops</div>
      {finalScore === null ? (
        <Rally key={key} onGameOver={handleGameOver} />
      ) : (
        <div className="solo-gameover bracket-frame">
          <div className="hud-label">run ended</div>
          <div className="solo-final-score">{finalScore}</div>
          <button className="hud-btn" onClick={restart}>
            Run it back
          </button>
        </div>
      )}
    </div>
  );
});
