// Trains the AI Protocol paddle agent and writes backend/ai/model.json.
//
// Why neuroevolution instead of "real" RL/backprop: the network is small
// and PongMatch's tick() is cheap deterministic arithmetic we already
// have and already trust (it's the exact physics used live, imported
// straight from game/PongMatch.js — no separate reimplementation to
// drift out of sync). Running thousands of headless matches and
// mutate-and-select is simple, dependency-free, and enough signal for a
// network this size.
//
// Run: node backend/ai/train.js [generations] [populationSize]
// Writes: backend/ai/model.json

const fs = require('fs');
const path = require('path');
const { PongMatch, HEIGHT, PADDLE_H } = require('../game/PongMatch');
const { Network } = require('./network');
const { extractFeatures, FEATURE_SIZE } = require('./features');
const { stepPaddleTowardTarget } = require('./paddleMotion');

const HIDDEN_SIZE = 12;
const OUTPUT_SIZE = 1;
const MAX_TICKS_PER_MATCH = 3000; // ~60s of simulated game time, bounds worst-case runtime

// Scripted sparring partners, each with:
//   lookEvery  — ticks between "glances" at the ball (reaction delay)
//   maxSpeed   — top tracking speed, px/tick
//   accel      — how fast the paddle can change velocity, px/tick^2
//                (low accel = momentum/overshoot — can't reverse
//                instantly, which is exactly what lets a fast direction
//                change bait a wrong commitment: an emergent feint,
//                not a scripted one)
//   noise      — aiming error, px
//
// 'human' is deliberately imperfect and slow to change direction — the
// tier that teaches the agent to exploit hesitation. 'hard' and 'elite'
// exist so the agent also stays sharp against fast, low-error tracking
// and doesn't just learn to be a bully that only beats slow opponents.
const OPPONENTS = [
  { name: 'human', lookEvery: 7, maxSpeed: 11, accel: 2.2, noise: 20 },
  { name: 'hard', lookEvery: 3, maxSpeed: 15, accel: 4, noise: 8 },
  { name: 'elite', lookEvery: 1, maxSpeed: 20, accel: 8, noise: 2 },
];

function scriptedTarget(state, opp, memo) {
  if (memo.ticksSinceLook >= opp.lookEvery) {
    memo.ticksSinceLook = 0;
    memo.lastTargetCenter = state.ball.y + (Math.random() * 2 - 1) * opp.noise;
  }
  memo.ticksSinceLook += 1;

  const current = state.paddles.left.y + PADDLE_H / 2;
  const desiredVelocity = Math.max(
    -opp.maxSpeed,
    Math.min(opp.maxSpeed, memo.lastTargetCenter - current)
  );
  const velDelta = Math.max(-opp.accel, Math.min(opp.accel, desiredVelocity - memo.velocity));
  memo.velocity = Math.max(-opp.maxSpeed, Math.min(opp.maxSpeed, memo.velocity + velDelta));

  return current + memo.velocity - PADDLE_H / 2;
}

// Plays one headless match: scripted opponent on the left, the given
// network on the right — using the exact same per-tick retarget +
// glide motion as live AiMatch.js, so the trained weights transfer
// unchanged into a real match. Returns a fitness score.
function playMatch(network, opp) {
  const match = new PongMatch(`train:${opp.name}`, 'left', 'right');
  const memo = { ticksSinceLook: 99, lastTargetCenter: HEIGHT / 2, velocity: 0 };
  let ticks = 0;
  let ended = false;
  let agentHitSpeedSum = 0;
  let prevVolley = 0;

  match.onGameEnd = () => {
    ended = true;
  };

  while (!ended && ticks < MAX_TICKS_PER_MATCH) {
    const leftTarget = scriptedTarget(match.state, opp, memo);
    match.setPaddleTarget('left', leftTarget);

    const features = extractFeatures(match.state, 'right');
    const [out] = network.forward(features);
    const desiredCenter = ((out + 1) / 2) * HEIGHT;
    const currentCenter = match.state.paddles.right.y + PADDLE_H / 2;
    const nextCenter = stepPaddleTowardTarget(currentCenter, desiredCenter);
    match.setPaddleTarget('right', nextCenter - PADDLE_H / 2);

    match.tick();
    ticks += 1;

    // A contact just happened if volley ticked up. ball.speedX < 0
    // right after a hit means it was the right paddle (the agent) that
    // just hit it — see PongMatch's collision blocks. Summing the exit
    // speed of the agent's own hits rewards hitting the ball hard (a
    // flick), not just eventually winning the point.
    if (match.volley > prevVolley && match.state.ball.speedX < 0) {
      agentHitSpeedSum += Math.hypot(match.state.ball.speedX, match.state.ball.speedY);
    }
    prevVolley = match.volley;
  }

  const finalScore = match.state.score;
  // Win/loss margin dominates. Longest volley and hit-speed are smaller
  // shaping bonuses — reward actually rallying and hitting with
  // conviction, not just grinding out a win. Timing out at the tick cap
  // (rare, mostly early on) gets a small penalty so stalling isn't free.
  const timedOut = !ended ? -5 : 0;
  return (
    (finalScore.right - finalScore.left) * 25 +
    match.longestVolley * 2 +
    agentHitSpeedSum * 0.4 +
    timedOut
  );
}

function evaluate(network) {
  let total = 0;
  for (const opp of OPPONENTS) total += playMatch(network, opp);
  return total / OPPONENTS.length;
}

function run(generations, populationSize) {
  const ELITES = Math.max(2, Math.round(populationSize * 0.15));
  let population = Array.from({ length: populationSize }, () =>
    Network.random(FEATURE_SIZE, HIDDEN_SIZE, OUTPUT_SIZE, 0.8)
  );

  let best = null;
  let bestFitness = -Infinity;
  const startedAt = Date.now();

  for (let gen = 0; gen < generations; gen++) {
    const scored = population
      .map((net) => ({ net, fitness: evaluate(net) }))
      .sort((a, b) => b.fitness - a.fitness);

    if (scored[0].fitness > bestFitness) {
      bestFitness = scored[0].fitness;
      best = scored[0].net.clone();
    }

    const avg = scored.reduce((s, x) => s + x.fitness, 0) / scored.length;
    console.log(
      `gen ${String(gen + 1).padStart(3)}/${generations} — best ${scored[0].fitness.toFixed(1)}` +
        ` avg ${avg.toFixed(1)} (all-time best ${bestFitness.toFixed(1)})`
    );

    const elites = scored.slice(0, ELITES).map((x) => x.net);
    const nextPop = [...elites.map((n) => n.clone())]; // carry elites unmutated

    while (nextPop.length < populationSize * 0.85) {
      const parent = elites[Math.floor(Math.random() * elites.length)];
      const mutationScale = 0.4 * (1 - gen / generations) + 0.05; // anneal over time
      nextPop.push(parent.clone().mutate(0.3, mutationScale));
    }

    while (nextPop.length < populationSize) {
      nextPop.push(Network.random(FEATURE_SIZE, HIDDEN_SIZE, OUTPUT_SIZE, 0.8));
    }

    population = nextPop;
  }

  console.log(`Training done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  return { best, bestFitness };
}

if (require.main === module) {
  const generations = parseInt(process.argv[2], 10) || 500;
  const populationSize = parseInt(process.argv[3], 10) || 50;

  console.log(`Training AI Protocol agent — ${generations} generations, population ${populationSize}`);
  const { best, bestFitness } = run(generations, populationSize);

  const outPath = path.join(__dirname, 'model.json');
  const payload = {
    ...best.toJSON(),
    meta: {
      trainedAt: new Date().toISOString(),
      generations,
      populationSize,
      bestFitness,
      opponents: OPPONENTS.map((o) => o.name),
    },
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outPath} (fitness ${bestFitness.toFixed(1)})`);
}

module.exports = { run, evaluate, playMatch };
