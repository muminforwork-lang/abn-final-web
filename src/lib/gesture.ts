/**
 * ============================================================================
 *  SCROLL GESTURE HELPERS
 * ============================================================================
 *  The pure decision logic behind the full-page scroll engine, kept separate
 *  from the DOM work in src/lib/use-snap-scroll.ts so it can be unit-tested
 *  with no browser.
 *
 *  The important rule these encode: a mouse wheel and a trackpad do not send
 *  one event per gesture — they send a BURST. A hard flick can deliver a dozen
 *  `wheel` events in a few milliseconds, and a trackpad keeps sending a
 *  decaying momentum tail after the fingers lift. If every event were allowed
 *  to advance the page, one flick would skip several sections.
 *
 *  So a burst is treated as a single gesture, and only the first event of a
 *  gesture may move. This is what makes "one scroll = one page" hold for a
 *  gentle nudge AND a violent flick.
 * ========================================================================== */

/** A burst of wheel events within this gap counts as the same gesture. */
export const GESTURE_WINDOW_MS = 400;

/** Wheel distance required before a page turns, so noise is ignored. */
export const WHEEL_THRESHOLD = 24;

export type WheelGesture = {
  /** Timestamp of the previous wheel event, or 0 before the first one. */
  last: number;
};

export function createWheelGesture(): WheelGesture {
  return { last: 0 };
}

export type WheelOutcome = {
  /** State to carry into the next event. */
  gesture: WheelGesture;
  /** Page delta: -1, 0 or 1. */
  move: -1 | 0 | 1;
  /** True when the page should advance now. */
  shouldMove: boolean;
  /** True when this event started a new gesture (useful for diagnostics). */
  fresh: boolean;
};

/**
 * Decides what one wheel event should do.
 *
 * @param gesture  state from the previous event
 * @param deltaY   this event's wheel delta
 * @param now      monotonic timestamp in ms
 */
export function decideWheel(gesture: WheelGesture, deltaY: number, now: number): WheelOutcome {
  const fresh = now - gesture.last > GESTURE_WINDOW_MS;
  const next: WheelGesture = { last: now };

  // Mid-gesture: absorb the event. This is the momentum/fling guard.
  if (!fresh) return { gesture: next, move: 0, shouldMove: false, fresh };

  // Sub-threshold noise in either direction is ignored.
  if (Math.abs(deltaY) < WHEEL_THRESHOLD) {
    return { gesture: next, move: 0, shouldMove: false, fresh };
  }

  return { gesture: next, move: deltaY > 0 ? 1 : -1, shouldMove: true, fresh };
}

/** Clamps a page index into range. */
export function clampIndex(target: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.trunc(target)));
}

/** Touch: vertical distance required before a swipe turns the page. */
export const SWIPE_MIN = 48;

/**
 * Decides whether a touch swipe should turn the page. A swipe is already a
 * single gesture, so there is no burst handling — only direction, distance,
 * and the rule that sideways swipes belong to carousels.
 */
export function decideSwipe(dx: number, dy: number): { move: -1 | 0 | 1; shouldMove: boolean } {
  if (Math.abs(dx) > Math.abs(dy)) return { move: 0, shouldMove: false };
  if (Math.abs(dy) < SWIPE_MIN) return { move: 0, shouldMove: false };
  return { move: dy < 0 ? 1 : -1, shouldMove: true };
}
