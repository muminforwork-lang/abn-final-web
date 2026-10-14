/**
 * Tests for the full-page scroll gesture rules.
 *
 * These cover the behaviour that matters most on the site: one wheel flick —
 * however hard — must advance exactly ONE page. Both the engine
 * (src/lib/use-snap-scroll.ts) and these tests call the same helpers in
 * src/lib/gesture.ts, so a regression in the rule fails here first.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  GESTURE_WINDOW_MS,
  SWIPE_MIN,
  WHEEL_THRESHOLD,
  clampIndex,
  createWheelGesture,
  decideSwipe,
  decideWheel,
} from '../src/lib/gesture.ts';

/** Comfortably past the threshold, so tests do not depend on its exact value. */
const D = WHEEL_THRESHOLD + 100;

/**
 * Replays a real wheel burst through the reducer, returning the page moves it
 * produced. `step` is the gap between events: a hard flick has a tiny step.
 */
function replay(deltas: number[], step = 8, start = 1000) {
  let gesture = createWheelGesture();
  const moves: number[] = [];
  let now = start;
  for (const deltaY of deltas) {
    const outcome = decideWheel(gesture, deltaY, now);
    gesture = outcome.gesture;
    if (outcome.shouldMove) moves.push(outcome.move);
    now += step;
  }
  return moves;
}

describe('one gesture = exactly one page', () => {
  it('moves a single page on one flick', () => {
    assert.deepEqual(replay([D]), [1]);
  });

  it('absorbs a hard flick that fires many events in a few milliseconds', () => {
    // This is the "fast scroll" case: 20 events 8 ms apart is one gesture.
    const burst = Array.from({ length: 20 }, () => D);
    assert.deepEqual(replay(burst, 8), [1], 'a violent flick must not skip pages');
  });

  it('absorbs the trackpad momentum tail after the fingers lift', () => {
    // One deliberate flick, then a decaying tail that is still the same burst.
    const momentum = [D, 90, 70, 55, 40, 30, 22, 15, 9, 5, 3];
    assert.deepEqual(replay(momentum, 16), [1], 'momentum must not turn a second page');
  });

  it('never moves twice for one enormous delta', () => {
    assert.deepEqual(replay([5000, 5000, 5000], 8), [1]);
  });

  it('allows another page only after the gesture goes quiet', () => {
    // Two deliberate flicks, separated by a real pause.
    const moves = replay([D, D], GESTURE_WINDOW_MS + 60);
    assert.deepEqual(moves, [1, 1], 'a new gesture after a pause should page again');
  });

  it('pages normally when the visitor scrolls slowly on purpose', () => {
    // Events spaced past the gesture window each count as their own gesture.
    const moves = replay([D, D, D], GESTURE_WINDOW_MS + 100);
    assert.deepEqual(moves, [1, 1, 1], 'slow deliberate scrolling should advance each time');
  });
});

describe('thresholds and direction', () => {
  it('ignores sub-threshold noise', () => {
    assert.deepEqual(replay([WHEEL_THRESHOLD - 1]), []);
  });

  it('accepts a delta exactly at the threshold', () => {
    assert.deepEqual(replay([WHEEL_THRESHOLD]), [1]);
  });

  it('scrolls up when the wheel goes up', () => {
    assert.deepEqual(replay([-D]), [-1]);
  });

  it('lets the first direction of a gesture win', () => {
    // A jittery wheel: the gesture is consumed by its first real movement.
    assert.deepEqual(replay([D, -D, D], 8), [1]);
  });

  it('does not mutate the gesture state it is given', () => {
    const original = createWheelGesture();
    const snapshot = JSON.stringify(original);
    decideWheel(original, D, 1000);
    assert.equal(JSON.stringify(original), snapshot, 'decideWheel must stay pure');
  });

  it('marks the first event of a burst as fresh and the rest as not', () => {
    let gesture = createWheelGesture();
    const first = decideWheel(gesture, D, 1000);
    gesture = first.gesture;
    const second = decideWheel(gesture, D, 1008);
    assert.equal(first.fresh, true);
    assert.equal(second.fresh, false, 'events inside the window are the same gesture');
  });
});

describe('touch swipes', () => {
  it('moves forward on an upward swipe', () => {
    assert.deepEqual(decideSwipe(0, -100), { move: 1, shouldMove: true });
  });

  it('moves backward on a downward swipe', () => {
    assert.deepEqual(decideSwipe(0, 100), { move: -1, shouldMove: true });
  });

  it('ignores short swipes', () => {
    assert.equal(decideSwipe(0, -(SWIPE_MIN - 5)).shouldMove, false);
  });

  it('accepts a swipe exactly at the minimum', () => {
    assert.equal(decideSwipe(0, -SWIPE_MIN).shouldMove, true);
  });

  it('leaves sideways swipes to carousels', () => {
    assert.equal(decideSwipe(120, -10).shouldMove, false);
  });
});

describe('index clamping', () => {
  it('clamps to the available sections', () => {
    assert.equal(clampIndex(-3, 5), 0);
    assert.equal(clampIndex(9, 5), 4);
    assert.equal(clampIndex(2, 5), 2);
  });

  it('is safe with no sections', () => {
    assert.equal(clampIndex(3, 0), 0);
  });
});
