/**
 * Tests for the full-page scroll gesture rules.
 *
 * These cover the single most important behaviour on the site: one wheel
 * flick, one swipe or one Page Down must advance exactly ONE page. A mouse
 * wheel and a trackpad both deliver a *stream* of wheel events per physical
 * gesture, and a trackpad keeps sending events after the fingers lift, so
 * "exactly one" is genuinely easy to get wrong.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  COOLDOWN_MS,
  GESTURE_IDLE_MS,
  LOCK_MS,
  SWIPE_THRESHOLD,
  WHEEL_THRESHOLD,
  clampIndex,
  createGestureState,
  decideGesture,
  decideSwipe,
  easeInOutCubic,
  type GestureState,
} from '../src/lib/gesture.ts';

/** Comfortably past the threshold, so tests do not depend on its exact value. */
const D = WHEEL_THRESHOLD + 100;

/** Replays a stream of wheel events through the reducer, like a real flick. */
function replay(
  events: number[],
  options: { start?: number; step?: number; lockUntil?: number; cooldownUntil?: number } = {},
) {
  const start = options.start ?? 1000;
  const step = options.step ?? 16;
  let state: GestureState = createGestureState();
  const moves: number[] = [];
  let time = start;

  for (const deltaY of events) {
    const decision = decideGesture(
      state,
      deltaY,
      time,
      options.lockUntil ?? 0,
      options.cooldownUntil ?? 0,
    );
    state = decision.state;
    if (decision.shouldMove) moves.push(decision.move);
    time += step;
  }
  return { moves, state };
}

describe('one gesture = exactly one page', () => {
  it('advances a single page on the first real wheel event', () => {
    const { moves } = replay([D]);
    assert.deepEqual(moves, [1], 'a single flick should move forward one page');
  });

  it('ignores the rest of the SAME gesture, however many events arrive', () => {
    // A hard mouse-wheel flick can emit a dozen events before the wheel stops.
    const { moves } = replay([D, D, D, D, D, D, D, D, D, D, D, D]);
    assert.deepEqual(moves, [1], 'one flick must never skip pages');
  });

  it('absorbs the trackpad momentum tail that follows the fingers lifting', () => {
    // The move lands, then the trackpad keeps sending decaying deltas.
    const first = replay([D]);
    assert.deepEqual(first.moves, [1]);

    // Momentum events arrive after the landing: same gesture, already consumed.
    const momentum = [90, 70, 55, 40, 30, 22, 15, 9, 5, 3];
    const { moves } = replay([D, ...momentum]);
    assert.deepEqual(moves, [1], 'momentum must not turn a second page');
  });

  it('never moves twice even for one enormous delta', () => {
    // A violent flick reports a huge deltaY. It is still one page.
    const { moves } = replay([5000]);
    assert.deepEqual(moves, [1]);
  });

  it('allows a new page only after the gesture has gone quiet', () => {
    // First gesture moves; then a gap longer than the idle window; then a
    // second deliberate flick must work.
    let state = createGestureState();
    const d1 = decideGesture(state, D, 1000, 0, 0);
    state = d1.state;
    assert.equal(d1.shouldMove, true);

    const d2 = decideGesture(state, D, 1000 + GESTURE_IDLE_MS + 50, 0, 0);
    assert.equal(d2.shouldMove, true, `a pause longer than ${GESTURE_IDLE_MS}ms starts a new gesture`);
    assert.equal(d2.move, 1);
  });

  it('treats a slow continuous drag as one gesture', () => {
    // Small deltas that individually fail the threshold but accumulate.
    const half = Math.max(1, Math.floor(WHEEL_THRESHOLD / 2));
    const { moves } = replay([half, half, half, half, half, half]);
    assert.equal(moves.length, 1, 'accumulated drag should move exactly once');
  });
});

describe('lock and cooldown gates', () => {
  it('does not move while a page transition is still running', () => {
    const now = 5000;
    const decision = decideGesture(
      createGestureState(),
      D,
      now,
      now + LOCK_MS, // a transition that has not finished yet
      0,
    );
    assert.equal(decision.shouldMove, false);
    assert.equal(decision.move, 0);
  });

  it('does not move during the momentum cooldown after a landing', () => {
    const landed = 2000;
    const decision = decideGesture(
      createGestureState(),
      D,
      landed + 40, // well inside COOLDOWN_MS
      0,
      landed + COOLDOWN_MS,
    );
    assert.equal(decision.shouldMove, false);
  });

  it('moves again once both gates have expired', () => {
    const landed = 2000;
    const later = landed + LOCK_MS + COOLDOWN_MS + 10;
    const decision = decideGesture(
      createGestureState(),
      D,
      later,
      landed + LOCK_MS, // transition over
      landed + COOLDOWN_MS, // cooldown over
    );
    assert.equal(decision.shouldMove, true);
  });

  it('swallows a whole gesture that arrives during the lock', () => {
    // Events during the lock must not be banked up and fire on release.
    const now = 3000;
    const lockedUntil = now + LOCK_MS;
    const { moves } = replay([D, D, D], { start: now, lockUntil: lockedUntil });
    assert.deepEqual(moves, [], 'a gesture landing mid-transition is discarded, not queued');
  });
});

describe('noise rejection and direction', () => {
  it('ignores sub-threshold wheel noise', () => {
    const { moves } = replay([WHEEL_THRESHOLD - 1]);
    assert.deepEqual(moves, []);
  });

  it('scrolls up when the wheel goes up', () => {
    const { moves } = replay([-D]);
    assert.deepEqual(moves, [-1]);
  });

  it('resolves a gesture that changes direction to exactly one move', () => {
    // A jittery wheel: net direction decides, and it still moves only once.
    const { moves } = replay([D, -D, D]);
    assert.deepEqual(moves, [1]);
  });

  it('never mutates the state object handed to it', () => {
    const original = createGestureState();
    const snapshot = JSON.stringify(original);
    decideGesture(original, D, 1000, 0, 0);
    assert.equal(JSON.stringify(original), snapshot, 'the reducer must stay pure');
  });
});

describe('touch swipes', () => {
  it('moves forward on an upward swipe', () => {
    assert.deepEqual(decideSwipe(0, -100, 1000, 0, 0), { move: 1, shouldMove: true });
  });

  it('moves backward on a downward swipe', () => {
    assert.deepEqual(decideSwipe(0, 100, 1000, 0, 0), { move: -1, shouldMove: true });
  });

  it('ignores short swipes', () => {
    assert.equal(decideSwipe(0, -(SWIPE_THRESHOLD - 5), 1000, 0, 0).shouldMove, false);
  });

  it('leaves sideways swipes to carousels', () => {
    assert.equal(decideSwipe(120, -10, 1000, 0, 0).shouldMove, false);
  });

  it('respects the lock and cooldown', () => {
    // Clear-cut inside each window, not exactly on the boundary.
    assert.equal(decideSwipe(0, -100, 1000, 1600, 0).shouldMove, false, 'blocked during a transition');
    assert.equal(decideSwipe(0, -100, 1000, 0, 1600).shouldMove, false, 'blocked during cooldown');
    assert.equal(decideSwipe(0, -100, 2000, 1600, 0).shouldMove, true, 'free once the transition ends');
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

describe('transition easing', () => {
  it('starts at 0 and lands exactly at 1', () => {
    assert.equal(easeInOutCubic(0), 0);
    assert.equal(easeInOutCubic(1), 1);
  });

  it('is monotonic, so a page never moves backwards mid-transition', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const value = easeInOutCubic(Math.min(1, t));
      assert.ok(value >= previous, `easing went backwards at t=${t}`);
      previous = value;
    }
  });
});
