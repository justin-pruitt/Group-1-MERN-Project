import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from './sound';
import { useAuth } from './AuthContext';
import Leaderboard from './Leaderboard';
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
    let prevPlayerY = player.y;

    // Matched to versus mode's real-world speed — see PongMatch.js.
    const BASE_SPEED = 4.2;
    const MAX_SPEED = 20;
    const FLICK_MAX_SPEED = MAX_SPEED * 1.6; // mirrors PongMatch's FLICK_MAX_BALL_SPEED headroom
    const FLICK_INFLUENCE = 0.012; // paddle px/sec -> ball speed units; mirrors PongMatch's FLICK_INFLUENCE

    const randomLaunch = () => {
      const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
      const dir = Math.random() < 0.5 ? 1 : -1;
      return {
        x: 300,
        y: 150 + Math.random() * 100,
        r: 8,
        speedX: Math.cos(angle) * BASE_SPEED * dir,
        speedY: Math.sin(angle) * BASE_SPEED
      };
    };

    const ball = randomLaunch();

    // Max-only clamp, matching PongMatch.clampBallSpeed — no floor needed
    // now that bounces are pure reflections (magnitude-preserving) rather
    // than randomized.
    const clampSpeed = (max = MAX_SPEED) => {
      const speed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
      if (speed > max) {
        const scale = max / speed;
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

    const WALL = 8; // matches PongMatch's WALL constant

    const handleMove = (clientY) => {
      const rect = canvas.getBoundingClientRect();
      const scaleY = canvas.height / rect.height;
      const relativeY = (clientY - rect.top) * scaleY;
      const targetY = relativeY - player.h / 2;
      player.y = Math.max(WALL, Math.min(targetY, canvas.height - WALL - player.h));
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
    const REFERENCE_FPS = 60;
    const MAX_DT = 1 / 30;

    const updateGame = (now) => {
      if (lastTime === null) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, MAX_DT);
      lastTime = now;
      const step = dt * REFERENCE_FPS;

      // Paddle velocity since last frame — this is the "flick," same
      // concept as PongMatch's paddleVelocity tracking.
      const paddleVelocity = (player.y - prevPlayerY) / dt;
      prevPlayerY = player.y;

      ball.x += ball.speedX * step;
      ball.y += ball.speedY * step;

      if (ball.y - ball.r <= 8 || ball.y + ball.r >= canvas.height - 8) {
        ball.speedY *= -1;
        sound.play('wall');
      }

      if (ball.x + ball.r >= canvas.width - 8) {
        ball.speedX *= -1;
        sound.play('wall');
      }

      if (
        ball.speedX < 0 &&
        ball.x - ball.r <= player.x + player.w &&
        ball.x + ball.r >= player.x &&
        ball.y + ball.r >= player.y &&
        ball.y - ball.r <= player.y + player.h
      ) {
        ball.speedX = Math.min(Math.abs(ball.speedX) * 1.05, MAX_SPEED);
        ball.speedY += paddleVelocity * FLICK_INFLUENCE;
        clampSpeed(FLICK_MAX_SPEED);
        sound.play('paddle');

        player.volleys += 1;
        setGameStats({
          volleys: player.volleys,
          points: totalPointsCollected,
          total: player.volleys + totalPointsCollected
        });
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
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [leaderboardKey, setLeaderboardKey] = useState(0);
  const { user, loading: authLoading, loginUrl } = useAuth();

  const handleGameOver = useCallback((score) => {
    setFinalScore(score);
    setSaveState('idle');
  }, []);

  const restart = () => {
    setFinalScore(null);
    setKey((k) => k + 1);
  };

  const saveScore = async () => {
    setSaveState('saving');
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ score: finalScore, mode: 'solo' }),
      });
      if (!res.ok) throw new Error('save failed');
      setSaveState('saved');
      setLeaderboardKey((k) => k + 1);
    } catch {
      setSaveState('error');
    }
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

          <div className="solo-actions">
            {!authLoading &&
              (user ? (
                <button
                  className="hud-btn"
                  onClick={saveScore}
                  disabled={saveState === 'saving' || saveState === 'saved'}
                >
                  {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save run'}
                </button>
              ) : (
                <a className="hud-btn" href={loginUrl}>
                  Sign in with Google to save
                </a>
              ))}
            <button className="hud-btn" onClick={restart}>
              Run it back
            </button>
          </div>
          {saveState === 'error' && (
            <div className="hud-label solo-save-error">Couldn't save — try again</div>
          )}

          <div className="solo-leaderboard">
            <div className="hud-label solo-leaderboard-heading">top runs</div>
            <Leaderboard mode="solo" refreshKey={leaderboardKey} />
          </div>
        </div>
      )}
    </div>
  );
});
