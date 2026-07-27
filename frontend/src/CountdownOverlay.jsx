import { useEffect, useRef, useState } from 'react';
import { sound } from './sound';
import './CountdownOverlay.css';

const STEPS = ['3', '2', '1', 'GO'];

// How long each step sits on screen. This is tied to the beat spacing
// baked into the single countdown audio clip (played once via
// sound.play('countdownSequence') below — three short beeps ~1s apart,
// then a longer "GO" tone), not to 4 separate one-shot SFX like before.
// Exported so callers that need to keep something else in sync with the
// total run length (e.g. delaying a server-side match start) can derive
// it from one place.
export const COUNTDOWN_STEP_MS = 1000;
export const COUNTDOWN_TOTAL_MS = STEPS.length * COUNTDOWN_STEP_MS;

// Renders "3, 2, 1, GO", then calls onDone once GO has had its moment on
// screen. Purely presentational — callers decide what "done" means
// (unpausing a local sim, flipping to a "playing" phase, etc), so the
// same component still works for solo, VS, and AI modes.
export default function CountdownOverlay({ onDone }) {
  const [stepIndex, setStepIndex] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // Single clip, played once — replaces the old per-step sound.play(sfx)
    // calls. Requires a 'countdownSequence' entry in sound.js (see notes).
    sound.play('countdownSequence');

    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      if (i >= STEPS.length) {
        clearInterval(interval);
        setTimeout(() => onDoneRef.current(), COUNTDOWN_STEP_MS);
        return;
      }
      setStepIndex(i);
    }, COUNTDOWN_STEP_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="countdown-overlay">
      <div className="countdown-number" key={stepIndex}>
        {STEPS[stepIndex]}
      </div>
    </div>
  );
}
