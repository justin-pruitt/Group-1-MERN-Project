// test line

// SquashGame.js
import React, { useEffect, useRef, useState } from 'react';

export default function SquashGame({ onGameOver }) {
  const canvasRef = useRef(null);
  const [gameStats, setGameStats] = useState({ volleys: 0, points: 0, total: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Game Objects
    const player = { x: 15, y: 150, w: 12, h: 80, volleys: 0 };
    const ball = { x: 300, y: 200, r: 8, speedX: 4, speedY: 3 };
    
    // In-game collectible coin item
    let coin = { x: 400, y: 200, r: 12, value: 5 };
    let totalPointsCollected = 0;

    // Spawn a coin safely inside the wall boundaries
    const respawnCoin = () => {
      coin.x = Math.floor(Math.random() * (canvas.width - 150)) + 100;
      coin.y = Math.floor(Math.random() * (canvas.height - 40)) + 20;
    };

    // Input handling logic for mouse and touch coordinates
    const handleMove = (clientY) => {
      const rect = canvas.getBoundingClientRect();
      
      // Calculate responsive vertical layout scale factors for mobile screens
      const scaleY = canvas.height / rect.height; 
      const relativeY = (clientY - rect.top) * scaleY;
      
      // Center the paddle on the touch/mouse input
      player.y = relativeY - player.h / 2;
    };

    // Desktop Input Router
    const onMouseMove = (e) => handleMove(e.clientY);

    // Mobile Input Router
    const onTouchMove = (e) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientY); // Targets first finger context
        e.preventDefault();                // Disables pull-to-refresh webpage bounces
      }
    };

    // Attach Event Listeners
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    let animationFrameId;

    // Main Engine Game Loop
    const updateGame = () => {
      ball.x += ball.speedX;
      ball.y += ball.speedY;

      // 1. Top/Bottom Boundary Wall Collisions (Bounce)
      if (ball.y - ball.r <= 8 || ball.y + ball.r >= canvas.height - 8) {
        ball.speedY *= -1;
      }

      // 2. Far Right Solid Wall Collision (Bounce)
      if (ball.x + ball.r >= canvas.width - 8) {
        ball.speedX *= -1;
      }

      // 3. Left Player Paddle Collision Realignment
      if (
        ball.x - ball.r <= player.x + player.w &&
        ball.x + ball.r >= player.x &&
        ball.y + ball.r >= player.y &&
        ball.y - ball.r <= player.y + player.h
      ) {
        if (ball.speedX < 0) {
          ball.speedX *= -1.05; // Game speed naturally ramps 5% per bounce
          player.volleys += 1;
          setGameStats({
            volleys: player.volleys,
            points: totalPointsCollected,
            total: player.volleys + totalPointsCollected
          });
        }
      }

      // 4. Point Coin Collection Collision Checking (Circle vs Circle)
      const distX = ball.x - coin.x;
      const distY = ball.y - coin.y;
      const distance = Math.sqrt(distX * distX + distY * distY);

      if (distance < ball.r + coin.r) {
        totalPointsCollected += coin.value; // Reward bonus points
        setGameStats({
          volleys: player.volleys,
          points: totalPointsCollected,
          total: player.volleys + totalPointsCollected
        });
        respawnCoin(); 
      }

      // 5. Game Over Sequence (Ball flies past the user's field)
      if (ball.x - ball.r <= 0) {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
        onGameOver(player.volleys + totalPointsCollected); 
        return;
      }

      // 6. Graphics Frame Rendering
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render Solid Architectural Framing Border Walls
      ctx.fillStyle = '#333';
      ctx.fillRect(canvas.width - 8, 0, 8, canvas.height); // Right Wall
      ctx.fillRect(0, 0, canvas.width, 8);                 // Top Wall
      ctx.fillRect(0, canvas.height - 8, canvas.width, 8); // Bottom Wall

      // Render Player Paddle
      ctx.fillStyle = '#00ffcc';
      ctx.fillRect(player.x, player.y, player.w, player.h);

      // Render Ball
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();

      // Render Point Coin (Glowing Gold Orb)
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(updateGame);
    };

    animationFrameId = requestAnimationFrame(updateGame);
    
    // Complete State Cleanups upon component unmount
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
          touchAction: 'none' // Disables scrolling behaviors
        }} 
      />
    </div>
  );
}
