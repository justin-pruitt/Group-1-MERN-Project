import React, { useEffect, useRef, useState } from 'react';

function SquashGame({ onGameOver }) {
  const canvasRef = useRef(null);
  const [gameStats, setGameStats] = useState({ volleys: 0, points: 0, total: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const player = { x: 15, y: 150, w: 12, h: 80, volleys: 0 };

    // Base speed the ball resets to on each life; growth is capped so
    // things never become unplayable.
    const BASE_SPEED = 1.8;
    const MAX_SPEED = 9;

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

    let coin = { x: 400, y: 200, r: 12, value: 5 };
    let totalPointsCollected = 0;

    const respawnCoin = () => {
      coin.x = Math.floor(Math.random() * (canvas.width - 150)) + 100;
      coin.y = Math.floor(Math.random() * (canvas.height - 40)) + 20;
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

    const updateGame = () => {
      ball.x += ball.speedX;
      ball.y += ball.speedY;

      if (ball.y - ball.r <= 8 || ball.y + ball.r >= canvas.height - 8) {
        ball.speedY *= -1;
        // Small random nudge so the same wall doesn't always send it back
        // along an identical path.
        ball.speedX += (Math.random() - 0.5) * 0.6;
        clampSpeed();
      }

      if (ball.x + ball.r >= canvas.width - 8) {
        ball.speedX *= -1;
        ball.speedY += (Math.random() - 0.5) * 0.6;
        clampSpeed();
      }

      if (
        ball.x - ball.r <= player.x + player.w &&
        ball.x + ball.r >= player.x &&
        ball.y + ball.r >= player.y &&
        ball.y - ball.r <= player.y + player.h
      ) {
        if (ball.speedX < 0) {
          // Where the ball hit the paddle, from -1 (top edge) to 1 (bottom
          // edge), drives the new angle — center hits go straight back,
          // edge hits go steep, like classic Pong/Breakout paddles.
          const hitPos = ((ball.y - player.y) / player.h) * 2 - 1;
          const clampedHit = Math.max(-1, Math.min(1, hitPos));

          const speed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY) * 1.05;
          const maxBounceAngle = (Math.PI / 180) * 60; // up to 60 degrees off horizontal
          const angle = clampedHit * maxBounceAngle;

          ball.speedX = Math.cos(angle) * speed; // always positive: away from paddle
          ball.speedY = Math.sin(angle) * speed;
          clampSpeed();

          player.volleys += 1;
          setGameStats({
            volleys: player.volleys,
            points: totalPointsCollected,
            total: player.volleys + totalPointsCollected
          });
        }
      }

      const distX = ball.x - coin.x;
      const distY = ball.y - coin.y;
      const distance = Math.sqrt(distX * distX + distY * distY);

      if (distance < ball.r + coin.r) {
        totalPointsCollected += coin.value;
        setGameStats({
          volleys: player.volleys,
          points: totalPointsCollected,
          total: player.volleys + totalPointsCollected
        });
        respawnCoin();
      }

      if (ball.x - ball.r <= 0) {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
        onGameOver(player.volleys + totalPointsCollected);
        return;
      }

      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#333';
      ctx.fillRect(canvas.width - 8, 0, 8, canvas.height);
      ctx.fillRect(0, 0, canvas.width, 8);
      ctx.fillRect(0, canvas.height - 8, canvas.width, 8);

      ctx.fillStyle = '#00ffcc';
      ctx.fillRect(player.x, player.y, player.w, player.h);

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
      ctx.fill();

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
    <div style={{ width: '100%', maxWidth: '700px', margin: '0 auto', padding: '0 10px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', color: '#fff', fontSize: '14px', flexWrap: 'wrap' }}>
        <h3>Volleys: {gameStats.volleys}</h3>
        <h3 style={{ color: '#ffd700' }}>Bonus Items: +{gameStats.points}</h3>
        <h2 style={{ color: '#00ffcc', margin: '5px 0' }}>Total Score: {gameStats.total}</h2>
      </div>

      <canvas
        ref={canvasRef}
        width={700}
        height={450}
        style={{
          width: '100%',
          height: 'auto',
          border: '2px solid #333',
          background: '#111',
          touchAction: 'none'
        }}
      />
    </div>
  );
}

// Minimal harness so the component can run standalone: it needs an
// onGameOver callback, which this wrapper supplies, showing a
// game-over screen with the final score and a restart button.
export default function SquashGameDemo() {
  const [key, setKey] = useState(0);
  const [finalScore, setFinalScore] = useState(null);

  const handleGameOver = (score) => {
    setFinalScore(score);
  };

  const restart = () => {
    setFinalScore(null);
    setKey((k) => k + 1);
  };

  return (
    <div style={{ background: '#000', minHeight: '500px', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {finalScore === null ? (
        <SquashGame key={key} onGameOver={handleGameOver} />
      ) : (
        <div style={{ color: '#fff', textAlign: 'center' }}>
          <h2>Game over!</h2>
          <p style={{ fontSize: '20px', color: '#00ffcc' }}>Final score: {finalScore}</p>
          <button
            onClick={restart}
            style={{
              marginTop: '12px',
              padding: '10px 20px',
              background: '#00ffcc',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Play again
          </button>
        </div>
      )}
    </div>
  );
}