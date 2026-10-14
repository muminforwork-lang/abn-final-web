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
  MIN_MOVE_GAP_MS,
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
 * Replays a wheel burst through the reducer, returning the page moves it
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

  it('absorbs a 12-event flick even when the events are spread out', () => {
    // Regression: a browser, trackpad driver or automation tool can deliver a
    // CONTINUOUS event stream stretched over more than GESTURE_WINDOW_MS. A
    // real Chromium flick of 12 events advanced 2.68 pages before the minimum
    // gap between moves was enforced.
    //
    // The steps stay inside the gesture window (12 x 24 ms < 400 ms) so this
    // tests the minimum-gap rule rather than the burst rule.
    for (const step of [8, 16, 24]) {
      const burst = Array.from({ length: 12 }, () => D);
      const moves = replay(burst, step);
      assert.equal(
        moves.length,
        1,
        `a 12-event flick at ${step}ms intervals moved ${moves.length} pages`,
      );
    }
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
    const moves = replay([D, D], MIN_MOVE_GAP_MS + 120);
    assert.deepEqual(moves, [1, 1], 'a new gesture after a pause should page again');
  });

  it('pages normally when the visitor scrolls slowly on purpose', () => {
    // Events spaced past the gesture window each count as their own gesture.
    const moves = replay([D, D, D], GESTURE_WINDOW_MS + 150);
    assert.deepEqual(moves, [1, 1, 1], 'slow deliberate scrolling should advance each time');
  });

  it('refuses a wheel move too soon after a move made another way', () => {
    // The reachable path for the move-gap rule. The page can also be moved by
    // the keyboard, the page dots or an anchor link — none of which touch the
    // wheel gesture state. So a wheel event arriving shortly afterwards is
    // "fresh" by the gesture window (the wheel has been idle) yet far too soon
    // after the move, and it must not turn another page.
    assert.ok(
      MIN_MOVE_GAP_MS > GESTURE_WINDOW_MS,
      'the move gap must exceed the gesture window to be a real limit',
    );

    // A wheel gesture that finished long ago, plus a move made 100 ms ago by
    // some other input.
    const movedAt = 10_000;
    const gesture = { last: movedAt - 5_000, lastMove: movedAt };
    const outcome = decideWheel(gesture, D, movedAt + 100);

    assert.equal(outcome.fresh, true, 'the wheel gesture itself has expired');
    assert.equal(outcome.shouldMove, false, 'but the page must not move again so soon');

    // Once the gap has passed, the same event is allowed through.
    const later = decideWheel(outcome.gesture, D, movedAt + MIN_MOVE_GAP_MS + 20);
    assert.equal(later.shouldMove, true, 'after the gap, wheel scrolling resumes normally');
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
