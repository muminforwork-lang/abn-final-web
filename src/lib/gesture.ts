/**
 * ============================================================================
 *  SCROLL GESTURE HELPERS
 * ============================================================================
 *  The pure decision logic behind the full-page scroll engine, kept separate
 *  from the DOM work in src/lib/use-snap-scroll.ts so it can be unit-tested
 *  with no browser.
 *
 *  The engine eases the page toward a target section instead of hard-snapping,
 *  so the rules here decide *how many* pages one gesture is worth, not how to
 *  animate it.
 *
 *  Why a burst is one gesture
 *  --------------------------
 *  A mouse wheel and a trackpad do not send one event per gesture — they send
 *  a stream. A hard flick can deliver a dozen `wheel` events in a few
 *  milliseconds, and a trackpad keeps sending a decaying tail after the
 *  fingers lift. Treating each event as its own gesture is what makes a page
 *  race ahead several sections at once.
 *
 *  Why the gap is generous
 *  -----------------------
 *  A continuous trackpad flick can stretch over half a second. A short window
 *  would split it into several "fresh" gestures and skip pages. 650 ms covers
 *  a real flick while still letting a slow, deliberate scroll page normally.
 * ========================================================================== */

/** A burst of wheel events within this gap counts as the same gesture. */
export const GESTURE_WINDOW_MS = 650;

/**
 * Minimum time between two page moves when the gesture window has expired but
 * the events are still arriving back to back.
 */
export const MIN_MOVE_GAP_MS = 420;

/** Wheel distance required before a page turns, so noise is ignored. */
export const WHEEL_THRESHOLD = 24;

/**
 * Accumulated wheel distance that earns a second page within one gesture, and
 * each page after that. A single wheel notch is ~100, so one notch is one
 * page; a long continuous flick can travel further, which is what makes fast
 * scrolling feel responsive instead of sticky.
 */
export const PAGE_DISTANCE = 220;

/** Never travel more than this many pages from a single gesture. */
export const MAX_PAGES_PER_GESTURE = 6;

/**
 * Most pages a single wheel event may turn.
 *
 * Deliberately 1. Accelerating by *jumping* more pages per event reads as
 * skipping; instead a sustained flick earns more pages (see MAX_PAGES_PER_GESTURE)
 * and spends them one per step, so it travels further while every step stays a
 * single readable page transition.
 */
export const MAX_PAGES_PER_EVENT = 1;

/** Vertical distance required before a touch swipe turns the page. */
export const SWIPE_MIN = 44;

export type WheelGesture = {
  /** Timestamp of the previous wheel event, or 0 before the first one. */
  last: number;
  /** Signed wheel distance accumulated during this gesture. */
  delta: number;
  /** Pages this gesture has earned so far, from its accumulated distance. */
  earned: number;
  /** Pages actually handed to the page. Never more than `earned`. */
  applied: number;
  /** Timestamp of the last page move. */
  lastMove: number;
};

export function createWheelGesture(): WheelGesture {
  return { last: 0, delta: 0, earned: 0, applied: 0, lastMove: 0 };
}

export type WheelOutcome = {
  /** State to carry into the next event. */
  gesture: WheelGesture;
  /** How many pages to travel: positive is down, negative is up. */
  pages: 0 | number;
  /** True when the page should move at all. */
  shouldMove: boolean;
  /** True when this event started a new gesture. */
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

  // A new gesture starts from zero; an ongoing one keeps accumulating.
  const state: WheelGesture = fresh
    ? { last: now, delta: deltaY, earned: 0, applied: 0, lastMove: gesture.lastMove }
    : { ...gesture, last: now, delta: gesture.delta + deltaY };

  // Sub-threshold noise in either direction is ignored.
  if (Math.abs(state.delta) < WHEEL_THRESHOLD) {
    return { gesture: state, pages: 0, shouldMove: false, fresh };
  }

  // How many pages this gesture has earned from its accumulated distance,
  // capped. A single notch earns one; a long continuous flick earns more,
  // which is what keeps fast scrolling responsive instead of sticky.
  const earned = Math.min(
    MAX_PAGES_PER_GESTURE,
    Math.floor(Math.abs(state.delta) / PAGE_DISTANCE) + 1,
  );
  const state2: WheelGesture = { ...state, earned };

  // `applied` records what was actually handed over, so the unapplied
  // remainder can never be cashed in as one big jump later. Without this, a
  // burst that accumulated enough distance for several pages would sit at one
  // page and then leap the rest in a single step.
  if (earned <= state.applied) {
    return { gesture: state2, pages: 0, shouldMove: false, fresh };
  }

  // Even when a new page has been earned, keep a short gap between moves so
  // the motion stays readable instead of stepping several sections at once.
  // This applies to a fresh event too — a burst stretched just past the
  // gesture window must not creep forward one page at a time.
  if (state.lastMove !== 0 && now - state.lastMove < MIN_MOVE_GAP_MS) {
    return { gesture: state2, pages: 0, shouldMove: false, fresh };
  }

  const direction = state.delta > 0 ? 1 : -1;

  // Spend the earned pages a couple at a time rather than releasing the whole
  // remaining balance in one event. A long flick therefore accelerates
  // smoothly, and `applied` keeps the rest queued for the next event.
  const pending = earned - state.applied;
  const step = Math.min(pending, MAX_PAGES_PER_EVENT);

  return {
    gesture: { ...state2, applied: state.applied + step, lastMove: now },
    pages: step * direction,
    shouldMove: true,
    fresh,
  };
}

/** Clamps a page index into range. */
export function clampIndex(target: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.trunc(target)));
}

/**
 * Decides whether a touch swipe should turn the page. A swipe is already a
 * single gesture, so there is no accumulation — only direction, distance, and
 * the rule that sideways swipes belong to carousels.
 */
export function decideSwipe(dx: number, dy: number): { pages: number; shouldMove: boolean } {
  if (Math.abs(dx) > Math.abs(dy)) return { pages: 0, shouldMove: false };
  if (Math.abs(dy) < SWIPE_MIN) return { pages: 0, shouldMove: false };
  // A long swipe travels further, up to three pages, so a deliberate big
  // flick on a phone is not limited to one page.
  const magnitude = Math.abs(dy);
  const pages = magnitude > 180 ? 3 : magnitude > 110 ? 2 : 1;
  return { pages: dy < 0 ? pages : -pages, shouldMove: true };
}

/** easeOutCubic — the section transition curve. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
