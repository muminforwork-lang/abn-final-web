/**
 * ============================================================================
 *  GESTURE DECISION LOGIC
 * ============================================================================
 *  The pure part of the full-page scroll engine. It answers exactly one
 *  question: "given this wheel event and the current timing state, should the
 *  page advance, and by how much?"
 *
 *  It is kept separate from src/lib/use-snap-scroll.ts — which owns the DOM,
 *  the animation frame and the listeners — for two reasons:
 *
 *   1. The "one gesture = one page" rule is the single most important
 *      behaviour on the site, so it is tested directly in `tests/`.
 *   2. The rule is subtle: a mouse wheel, a trackpad flick and a trackpad's
 *      momentum tail all arrive as a stream of `wheel` events, and only the
 *      first one of a gesture may move the page.
 *
 *  Timing values are passed in rather than read from a clock, so tests are
 *  deterministic.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* Tunables — also exported so the docs and tests stay in sync with reality.   */
/* -------------------------------------------------------------------------- */

/** A pause longer than this ends the gesture and lets a new one begin. */
export const GESTURE_IDLE_MS = 400;
/** How long one page-to-page transition takes. */
export const LOCK_MS = 880;
/** Momentum absorbed after a landing, before another move may start. */
export const COOLDOWN_MS = 220;
/** Wheel distance required before a page turns, so a stray nudge is ignored. */
export const WHEEL_THRESHOLD = 24;
/** Vertical distance required before a touch swipe turns the page. */
export const SWIPE_THRESHOLD = 52;

export type GestureState = {
  /** True while wheel events are still arriving for the current gesture. */
  active: boolean;
  /** True once this gesture has already moved the page. */
  consumed: boolean;
  /** Timestamp of the most recent wheel event in this gesture. */
  last: number;
  /** Signed wheel distance accumulated during this gesture. */
  delta: number;
};

export type GestureDecision = {
  /** State to store for the next wheel event. */
  state: GestureState;
  /** Direction to move, or 0 to stay put. */
  move: -1 | 0 | 1;
  /** True when the page may advance right now. */
  shouldMove: boolean;
};

export function createGestureState(): GestureState {
  return { active: false, consumed: false, last: 0, delta: 0 };
}

/**
 * Decides what a single wheel event should do.
 *
 * @param current  gesture state from the previous event
 * @param deltaY   this event's wheel delta
 * @param now      monotonic timestamp in ms
 * @param lockedUntil   page transition in progress until this timestamp
 * @param cooldownUntil momentum cooldown ends at this timestamp
 */
export function decideGesture(
  current: GestureState,
  deltaY: number,
  now: number,
  lockedUntil: number,
  cooldownUntil: number,
): GestureDecision {
  // ── Step 1: does this event begin a new gesture? ────────────────────────
  // A gap longer than GESTURE_IDLE_MS means the previous gesture is over,
  // which is what lets the visitor scroll again after a pause.
  const startsNewGesture =
    !current.active || now - current.last > GESTURE_IDLE_MS;

  const state: GestureState = startsNewGesture
    ? { active: true, consumed: false, last: now, delta: deltaY }
    : { ...current, last: now, delta: current.delta + deltaY };

  // ── Step 2: a gesture may move the page at most once ────────────────────
  // This is the rule that stops a hard flick — or the momentum tail the
  // trackpad keeps sending after the fingers lift — from skipping pages.
  if (state.consumed) {
    return { state, move: 0, shouldMove: false };
  }

  // ── Step 3: never start a move while one is running or just finished ────
  if (now < lockedUntil || now < cooldownUntil) {
    return { state, move: 0, shouldMove: false };
  }

  // ── Step 4: ignore sub-threshold noise in either direction ──────────────
  if (Math.abs(state.delta) < WHEEL_THRESHOLD) {
    return { state, move: 0, shouldMove: false };
  }

  // ── Step 5: commit to exactly one page in the gesture's direction ───────
  return {
    state: { ...state, consumed: true },
    move: state.delta > 0 ? 1 : -1,
    shouldMove: true,
  };
}

/**
 * The touch equivalent. A swipe is a single gesture by nature, so there is no
 * accumulation — but the same lock and cooldown gates apply.
 */
export function decideSwipe(
  dx: number,
  dy: number,
  now: number,
  lockedUntil: number,
  cooldownUntil: number,
): { move: -1 | 0 | 1; shouldMove: boolean } {
  // A sideways swipe belongs to a carousel, never to page navigation.
  if (Math.abs(dx) > Math.abs(dy)) return { move: 0, shouldMove: false };
  if (Math.abs(dy) < SWIPE_THRESHOLD) return { move: 0, shouldMove: false };
  if (now < lockedUntil || now < cooldownUntil) return { move: 0, shouldMove: false };
  return { move: dy < 0 ? 1 : -1, shouldMove: true };
}

/** Clamps a page index into range. */
export function clampIndex(target: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.trunc(target)));
}

/** easeInOutCubic — the page transition curve. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
