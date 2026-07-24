// Live inference for the AI Protocol opponent. Loads the weights trained
// offline by train.js (backend/ai/model.json) once, then does a cheap
// forward pass per tick — same feature extraction as training, so the
// weights mean the same thing here as they did during evolution.

const fs = require('fs');
const path = require('path');
const { Network } = require('./network');
const { extractFeatures } = require('./features');
const { HEIGHT, PADDLE_H } = require('../game/PongMatch');

const MODEL_PATH = path.join(__dirname, 'model.json');

let cachedNetwork = null;
let cachedMeta = null;

function loadModel() {
  if (cachedNetwork) return cachedNetwork;
  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(
      'backend/ai/model.json is missing — run `node backend/ai/train.js` to generate it before starting AI Protocol matches.'
    );
  }
  const raw = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  const { meta, ...weights } = raw;
  cachedNetwork = new Network(weights);
  cachedMeta = meta || null;
  return cachedNetwork;
}

function getModelMeta() {
  loadModel();
  return cachedMeta;
}

// Given the current match state, returns the target y (top-left, same
// convention as PongMatch.setPaddleTarget) for the AI-controlled side.
function getPaddleTarget(state, side) {
  const network = loadModel();
  const features = extractFeatures(state, side);
  const [out] = network.forward(features); // out in [-1, 1]
  const centerY = ((out + 1) / 2) * HEIGHT;
  return centerY - PADDLE_H / 2;
}

module.exports = { getPaddleTarget, loadModel, getModelMeta };
