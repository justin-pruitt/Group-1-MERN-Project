// Minimal feedforward neural network — no ML dependencies. Small enough
// (6 -> 8 -> 1, ~65 parameters) that plain array math is plenty fast for
// a per-tick forward pass, and it keeps train.js/agent.js dependency-free.
//
// Trained via neuroevolution (see train.js) rather than backprop: for a
// network this small, mutate-and-select converges fine and is far less
// code than writing an autodiff engine from scratch.

class Network {
  constructor({ inputSize, hiddenSize, outputSize, w1, b1, w2, b2 }) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    this.w1 = w1; // inputSize * hiddenSize, row-major [input][hidden]
    this.b1 = b1; // hiddenSize
    this.w2 = w2; // hiddenSize * outputSize, row-major [hidden][output]
    this.b2 = b2; // outputSize
  }

  static random(inputSize, hiddenSize, outputSize, scale = 1) {
    const rnd = (n) => Array.from({ length: n }, () => (Math.random() * 2 - 1) * scale);
    return new Network({
      inputSize,
      hiddenSize,
      outputSize,
      w1: rnd(inputSize * hiddenSize),
      b1: rnd(hiddenSize),
      w2: rnd(hiddenSize * outputSize),
      b2: rnd(outputSize),
    });
  }

  forward(inputs) {
    const { inputSize, hiddenSize, outputSize, w1, b1, w2, b2 } = this;
    const hidden = new Array(hiddenSize);
    for (let h = 0; h < hiddenSize; h++) {
      let sum = b1[h];
      for (let i = 0; i < inputSize; i++) sum += inputs[i] * w1[i * hiddenSize + h];
      hidden[h] = Math.tanh(sum);
    }
    const out = new Array(outputSize);
    for (let o = 0; o < outputSize; o++) {
      let sum = b2[o];
      for (let h = 0; h < hiddenSize; h++) sum += hidden[h] * w2[h * outputSize + o];
      out[o] = Math.tanh(sum);
    }
    return out;
  }

  clone() {
    return new Network({
      inputSize: this.inputSize,
      hiddenSize: this.hiddenSize,
      outputSize: this.outputSize,
      w1: [...this.w1],
      b1: [...this.b1],
      w2: [...this.w2],
      b2: [...this.b2],
    });
  }

  // Gaussian-ish mutation: each weight has `rate` chance of being nudged
  // by a small random amount. Simple, no dependencies, works well enough
  // for a network this size.
  mutate(rate, amount) {
    const bump = (arr) =>
      arr.map((v) => (Math.random() < rate ? v + (Math.random() * 2 - 1) * amount : v));
    this.w1 = bump(this.w1);
    this.b1 = bump(this.b1);
    this.w2 = bump(this.w2);
    this.b2 = bump(this.b2);
    return this;
  }

  toJSON() {
    return {
      inputSize: this.inputSize,
      hiddenSize: this.hiddenSize,
      outputSize: this.outputSize,
      w1: this.w1,
      b1: this.b1,
      w2: this.w2,
      b2: this.b2,
    };
  }
}

module.exports = { Network };
