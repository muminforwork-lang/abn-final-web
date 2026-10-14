/**
 * Tests for the full-page scroll gesture rules.
 *
 * Both the engine (src/lib/use-snap-scroll.ts) and these tests call the same
 * helpers in src/lib/gesture.ts, so a regression in the rules fails here first.
 *
 * The engine eases the page toward a target section, so what matters here is
 * *how many pages* one physical gesture is worth.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  GESTURE_WINDOW_MS,
  MAX_PAGES_PER_GESTURE,
  MIN_MOVE_GAP_MS,
  PAGE_DISTANCE,
  SWIPE_MIN,
  WHEEL_THRESHOLD,
  clampIndex,
  createWheelGesture,
  decideSwipe,
  decideWheel,
  easeOutCubic,
} from '../src/lib/gesture.ts';

/** One wheel notch, as a real mouse reports it. */
const NOTCH = WHEEL_THRESHOLD + 76;

/** Replays a wheel burst, returning the total page distance it travelled. */
function replay(deltas: number[], step = 8, start = 1000) {
  let gesture = createWheelGesture();
  const moves: number[] = [];
  let now = start;
  for (const deltaY of deltas) {
    const outcome = decideWheel(gesture, deltaY, now);
    gesture = outcome.gesture;
    if (outcome.shouldMove) moves.push(outcome.pages);
    now += step;
  }
  return moves;
}

const total = (moves: number[]) => moves.reduce((sum, n) => sum + n, 0);

describe('one gesture, one page at a time', () => {
  it('moves one page on a single wheel notch', () => {
    assert.equal(total(replay([NOTCH])), 1);
  });

  it('treats a rapid burst as one gesture', () => {
    // A hard flick: many events, tiny gaps. It must not race ahead.
    const burst = Array.from({ length: 12 }, () => NOTCH);
    const moves = replay(burst, 8);
    assert.ok(moves.length >= 1, 'a flick must move at least one page');
    assert.equal(
      total(moves),
      1,
      `a 12-event burst of single notches should be one page, got ${total(moves)}`,
    );
  });

  it('does not race ahead when a burst is spread across the window', () => {
    // 12 notches over 480 ms is a sustained fast scroll, so travelling a
    // couple of pages is correct — but it must never skip through the whole
    // document (the original bug moved 6 pages here).
    const burst = Array.from({ length: 12 }, () => NOTCH);
    const travelled = total(replay(burst, 40));
    assert.ok(travelled >= 1, 'a sustained flick must move');
    assert.ok(
      travelled <= 3,
      `a 12-notch burst over 480 ms should travel a few pages at most, got ${travelled}`,
    );
  });

  it('moves exactly one page for one notch, however late it arrives', () => {
    // A single deliberate notch must always be one page, even if it lands long
    // after the previous gesture.
    assert.equal(total(replay([NOTCH], 8, 100_000)), 1);
  });

  it('absorbs a decaying momentum tail', () => {
    const momentum = [NOTCH, 90, 70, 55, 40, 30, 22, 15, 9, 5, 3];
    assert.equal(total(replay(momentum, 16)), 1);
  });

  it('lets a sustained flick travel further', () => {
    // A trackpad flung hard keeps reporting a large delta for over a second.
    // The gesture earns pages from that distance and spends them one at a
    // time, so a sustained flick covers ground without any step skipping.
    const big = Array.from({ length: 10 }, () => PAGE_DISTANCE * 6);
    const travelled = total(replay(big, 150));
    assert.ok(travelled > 1, `a sustained hard flick should travel, got ${travelled}`);
    assert.ok(
      travelled <= MAX_PAGES_PER_GESTURE,
      `but never more than ${MAX_PAGES_PER_GESTURE} pages, got ${travelled}`,
    );
  });

  it('caps a single gesture even for an absurd delta', () => {
    const huge = Array.from({ length: 40 }, () => 100_000);
    assert.ok(total(replay(huge, 5)) <= MAX_PAGES_PER_GESTURE);
  });

  it('never turns more than one page per step', () => {
    // Acceleration must come from stepping more often, never from jumping:
    // a multi-page step is exactly what reads as "skipping" to a visitor.
    const big = Array.from({ length: 12 }, () => PAGE_DISTANCE * 6);
    for (const step of [10, 60, 150]) {
      for (const pages of replay(big, step)) {
        assert.equal(Math.abs(pages), 1, `a step turned ${pages} pages at ${step}ms spacing`);
      }
    }
  });

  it('allows a new page after the gesture goes quiet', () => {
    // A gap larger than both the gesture window and the minimum move gap.
    const step = Math.max(GESTURE_WINDOW_MS, MIN_MOVE_GAP_MS) + 250;
    const moves = replay([NOTCH, NOTCH], step);
    assert.equal(moves.length, 2, 'a pause starts a new gesture');
    assert.equal(total(moves), 2);
  });

  it('pages normally when the visitor scrolls slowly on purpose', () => {
    const step = Math.max(GESTURE_WINDOW_MS, MIN_MOVE_GAP_MS) + 350;
    const moves = replay([NOTCH, NOTCH, NOTCH], step);
    assert.equal(total(moves), 3, 'each deliberate notch should turn a page');
  });
});

describe('thresholds and direction', () => {
  it('ignores sub-threshold noise', () => {
    assert.deepEqual(replay([WHEEL_THRESHOLD - 1]), []);
  });

  it('scrolls up when the wheel goes up', () => {
    assert.equal(total(replay([-NOTCH])), -1);
  });

  it('does not mutate the gesture state it is given', () => {
    const original = createWheelGesture();
    const snapshot = JSON.stringify(original);
    decideWheel(original, NOTCH, 1000);
    assert.equal(JSON.stringify(original), snapshot, 'decideWheel must stay pure');
  });

  it('marks the first event of a burst fresh and the rest as not', () => {
    let gesture = createWheelGesture();
    const first = decideWheel(gesture, NOTCH, 1000);
    gesture = first.gesture;
    const second = decideWheel(gesture, NOTCH, 1008);
    assert.equal(first.fresh, true);
    assert.equal(second.fresh, false);
  });
});

describe('touch swipes', () => {
  it('moves forward on an upward swipe', () => {
    const outcome = decideSwipe(0, -80);
    assert.equal(outcome.shouldMove, true);
    assert.ok(outcome.pages > 0);
  });

  it('moves backward on a downward swipe', () => {
    const outcome = decideSwipe(0, 80);
    assert.equal(outcome.shouldMove, true);
    assert.ok(outcome.pages < 0);
  });

  it('ignores short swipes', () => {
    assert.equal(decideSwipe(0, -(SWIPE_MIN - 5)).shouldMove, false);
  });

  it('travels further on a long swipe, so a phone flick is not sluggish', () => {
    const short = decideSwipe(0, -SWIPE_MIN - 10).pages;
    const long = decideSwipe(0, -260).pages;
    assert.ok(long > short, `expected a long swipe to travel further: ${short} vs ${long}`);
  });

  it('leaves sideways swipes to carousels', () => {
    assert.equal(decideSwipe(120, -10).shouldMove, false);
  });
});

describe('index clamping', () => {
  it('clamps to the available sections', () => {
    assert.equal(clampIndex(-3, 6), 0);
    assert.equal(clampIndex(9, 6), 5);
    assert.equal(clampIndex(2, 6), 2);
  });

  it('is safe with no sections', () => {
    assert.equal(clampIndex(3, 0), 0);
  });
});

describe('transition easing', () => {
  it('starts at 0 and lands exactly at 1', () => {
    assert.equal(easeOutCubic(0), 0);
    assert.equal(easeOutCubic(1), 1);
  });

  it('is monotonic, so a page never moves backwards mid-transition', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const value = easeOutCubic(Math.min(1, t));
      assert.ok(value >= previous, `easing went backwards at t=${t}`);
      previous = value;
    }
  });
});
