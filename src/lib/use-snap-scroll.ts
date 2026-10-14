'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  COOLDOWN_MS,
  LOCK_MS,
  clampIndex,
  createGestureState,
  decideGesture,
  decideSwipe,
  easeInOutCubic,
} from '@/lib/gesture';

/* ==========================================================================
   Snap scroll engine
   ==========================================================================
   One wheel flick — or one swipe, or one Page Down — moves exactly one
   full-page section. It never free-scrolls past a section, and it never
   scrolls more than one section per gesture.

   How the "exactly one page" guarantee works
   -------------------------------------------
   1. `wheel` is cancelled for the whole gesture (400 ms after the last wheel
      event) while the engine is mounted, so the browser's own free scrolling
      cannot run alongside ours.
   2. A gesture may only start a move once. Every further wheel event in the
      same gesture is ignored, so a hard flick or a trackpad momentum tail
      cannot queue up a second move.
   3. After a move lands there is a short cooldown that swallows the rest of
      the momentum from the gesture that caused it.

   The decision rules themselves live in src/lib/gesture.ts, where they are
   unit-tested without a browser.

   Escape hatches (so the page never feels broken)
   -----------------------------------------------
   • `prefers-reduced-motion` → the engine stays completely out of the way.
   • A scrollable element inside a section (`[data-snap-scroll]`) keeps its
     natural scrolling until it hits its own edge, then the page takes over.
   • Ctrl/⌘ + wheel (browser zoom) is always left alone.
   • Touch uses a vertical-dominant swipe test, so sideways gestures still
     reach carousels.
   ========================================================================== */

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export type SnapScrollState = {
  /** Index of the section currently filling the viewport. */
  index: number;
  /** ids of every managed section, in document order. */
  ids: string[];
};

export type SnapScrollApi = SnapScrollState & {
  /** Scroll to a section by index. */
  goTo: (index: number) => void;
  /** Scroll to a section by element id. */
  goToId: (id: string) => void;
  next: () => void;
  previous: () => void;
};

/**
 * Finds the nearest scrollable ancestor of `node`, stopping at `root`.
 * Used to decide whether a wheel event belongs to page navigation or to a
 * nested list (catalog grid, text panel, …).
 */
function scrollableAncestor(node: EventTarget | null, root: HTMLElement): HTMLElement | null {
  let element = node instanceof HTMLElement ? node : null;
  while (element && element !== root) {
    if (element.hasAttribute('data-snap-scroll')) {
      const style = window.getComputedStyle(element);
      const scrollable = /(auto|scroll)/.test(style.overflowY);
      if (scrollable && element.scrollHeight > element.clientHeight + 2) {
        return element;
      }
    }
    element = element.parentElement;
  }
  return null;
}

/** True when the nested panel still has room to move in this direction. */
function nestedCanMove(panel: HTMLElement, deltaY: number): boolean {
  const atTop = panel.scrollTop <= 0;
  const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
  if (deltaY > 0) return !atBottom;
  if (deltaY < 0) return !atTop;
  return false;
}

export function useSnapScroll(enabled: boolean): SnapScrollApi {
  const [state, setState] = useState<SnapScrollState>({ index: 0, ids: [] });

  const rootRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const sectionsRef = useRef<HTMLElement[]>([]);
  const indexRef = useRef(0);
  const lockRef = useRef(0);
  const cooldownRef = useRef(0);
  const gestureRef = useRef(createGestureState());
  const touchRef = useRef({ x: 0, y: 0, handled: false });
  const animationRef = useRef(0);

  const collect = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return [] as HTMLElement[];
    const list = Array.from(
      viewport.querySelectorAll<HTMLElement>('[data-snap-section]'),
    ).filter((element) => !element.hasAttribute('data-snap-exclude'));
    sectionsRef.current = list;
    return list;
  }, []);

  /** Flags the section that currently owns the screen. CSS keys the whole
   *  entrance sequence off `[data-active="true"]`. */
  const markActive = useCallback((list: HTMLElement[], active: number) => {
    list.forEach((element, position) => {
      const flag = position === active ? 'true' : 'false';
      if (element.dataset.active !== flag) element.dataset.active = flag;
    });
  }, []);

  const scrollTopWithinViewport = useCallback((element: HTMLElement) => {
    const viewport = viewportRef.current;
    if (!viewport) return 0;
    const top =
      element.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop;
    return Math.max(0, Math.round(top));
  }, []);

  /** Custom eased scroll — we animate it ourselves so the lock and the
   *  movement always finish together. */
  const animateTo = useCallback(
    (top: number, onDone?: () => void) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);

      const from = viewport.scrollTop;
      const distance = top - from;
      if (Math.abs(distance) < 2) {
        viewport.scrollTop = top;
        onDone?.();
        return;
      }

      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / LOCK_MS);
        viewport.scrollTop = from + distance * easeInOutCubic(t);
        if (t < 1) {
          animationRef.current = window.requestAnimationFrame(step);
        } else {
          viewport.scrollTop = top;
          animationRef.current = 0;
          onDone?.();
        }
      };
      animationRef.current = window.requestAnimationFrame(step);
    },
    [],
  );

  const moveTo = useCallback(
    (target: number, force = false) => {
      const list = sectionsRef.current.length ? sectionsRef.current : collect();
      if (!list.length) return;
      const clamped = clampIndex(target, list.length);
      if (!force && clamped === indexRef.current) return;

      const now = performance.now();
      if (!force && now < lockRef.current) return;
      if (!force && now < cooldownRef.current) return;

      const reduced = prefersReducedMotion();
      lockRef.current = now + (reduced ? 60 : LOCK_MS);
      indexRef.current = clamped;
      markActive(list, clamped);
      setState((previous) =>
        previous.index === clamped ? previous : { ...previous, index: clamped },
      );

      const top = scrollTopWithinViewport(list[clamped]);
      if (reduced) {
        viewportRef.current?.scrollTo({ top, behavior: 'auto' });
        cooldownRef.current = performance.now() + 80;
      } else {
        animateTo(top, () => {
          cooldownRef.current = performance.now() + COOLDOWN_MS;
        });
      }
    },
    [animateTo, collect, markActive, scrollTopWithinViewport],
  );

  const goTo = useCallback((index: number) => moveTo(index, true), [moveTo]);
  const next = useCallback(() => moveTo(indexRef.current + 1), [moveTo]);
  const previous = useCallback(() => moveTo(indexRef.current - 1), [moveTo]);
  const goToId = useCallback(
    (id: string) => {
      const list = collect();
      const found = list.findIndex((element) => element.id === id);
      if (found >= 0) moveTo(found, true);
    },
    [collect, moveTo],
  );

  /* ---------------------------------------------------------------- mount */
  useEffect(() => {
    if (!enabled) return;

    const root = document.querySelector<HTMLElement>('[data-snap-root]');
    const viewport = root?.querySelector<HTMLElement>('[data-snap-viewport]') ?? null;
    if (!root || !viewport) return;

    rootRef.current = root;
    viewportRef.current = viewport;

    const list = collect();
    markActive(list, indexRef.current);
    setState({ index: indexRef.current, ids: list.map((element) => element.id) });

    // Sync the index with wherever the visitor actually is (deep link, reload).
    const syncFromScroll = () => {
      if (performance.now() < lockRef.current) return;
      const middle = viewport.clientHeight * 0.5;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      list.forEach((element, position) => {
        const rect = element.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        const centre = rect.top - viewportRect.top + rect.height / 2;
        const distance = Math.abs(centre - middle);
        if (distance < best) {
          best = distance;
          nearest = position;
        }
      });
      if (nearest !== indexRef.current) {
        indexRef.current = nearest;
        markActive(list, nearest);
        setState((previous) =>
          previous.index === nearest ? previous : { ...previous, index: nearest },
        );
      }
    };

    // A hash in the URL wins on first paint.
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const found = list.findIndex((element) => element.id === hash);
      if (found > 0) {
        moveTo(found, true);
      }
    }

    /* ---------------------------------------------------------- wheel */
    const onWheel = (event: WheelEvent) => {
      // Never fight browser zoom or a nested scroller that still has room.
      if (event.ctrlKey || event.metaKey) return;

      const panel = scrollableAncestor(event.target, viewport);
      if (panel && nestedCanMove(panel, event.deltaY)) return;

      // The engine owns page scrolling: cancel the browser's version.
      event.preventDefault();

      if (prefersReducedMotion()) return;

      const decision = decideGesture(
        gestureRef.current,
        event.deltaY,
        performance.now(),
        lockRef.current,
        cooldownRef.current,
      );
      gestureRef.current = decision.state;

      if (decision.shouldMove) {
        moveTo(indexRef.current + decision.move);
      }
    };

    /* -------------------------------------------------------- keyboard */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }

      const panel = scrollableAncestor(target, viewport);
      if (
        panel &&
        nestedCanMove(panel, event.key === 'ArrowDown' || event.key === 'PageDown' ? 1 : -1) &&
        ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(event.key)
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'PageDown':
          event.preventDefault();
          next();
          break;
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          previous();
          break;
        case ' ':
          event.preventDefault();
          if (event.shiftKey) previous();
          else next();
          break;
        case 'Home':
          event.preventDefault();
          moveTo(0);
          break;
        case 'End':
          event.preventDefault();
          moveTo(sectionsRef.current.length - 1);
          break;
        default:
          break;
      }
    };

    /* ----------------------------------------------------------- touch */
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchRef.current = { x: touch.clientX, y: touch.clientY, handled: false };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (prefersReducedMotion()) return;
      if (event.touches.length !== 1) return;
      if (touchRef.current.handled) return;

      const touch = event.touches[0];
      const dx = touch.clientX - touchRef.current.x;
      const dy = touch.clientY - touchRef.current.y;

      const panel = scrollableAncestor(event.target, viewport);
      if (panel && nestedCanMove(panel, -dy)) return;

      const decision = decideSwipe(dx, dy, performance.now(), lockRef.current, cooldownRef.current);
      if (!decision.shouldMove) return;

      touchRef.current.handled = true;
      moveTo(indexRef.current + decision.move);
    };

    // On a very short screen a page's content can be taller than the screen.
    // Flagging that lets CSS allow natural panning there instead of trapping
    // the visitor between a short viewport and a hidden overflow.
    const fits = Array.from(viewport.querySelectorAll<HTMLElement>('.snap-fit'));
    const markOverflow = () => {
      for (const box of fits) {
        const overflows = box.scrollHeight > box.clientHeight + 4;
        if (overflows !== box.classList.contains('overflows')) {
          box.classList.toggle('overflows', overflows);
        }
      }
    };

    /* ------------------------------------------------------------ resize */
    let resizeFrame = 0;
    const onResize = () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        // Re-align to the active section after a viewport height change
        // (mobile browser bars, rotation) without animating.
        const current = sectionsRef.current[indexRef.current];
        if (current) viewport.scrollTop = scrollTopWithinViewport(current);
        markOverflow();
      });
    };

    let scrollFrame = 0;
    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        syncFromScroll();
      });
    };

    let overflowObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      overflowObserver = new ResizeObserver(markOverflow);
      fits.forEach((box) => overflowObserver?.observe(box));
    }
    markOverflow();

    viewport.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('resize', onResize);
    viewport.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      viewport.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onResize);
      viewport.removeEventListener('scroll', onScroll);
      overflowObserver?.disconnect();
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    };
  }, [collect, enabled, markActive, moveTo, next, previous, scrollTopWithinViewport]);

  return { ...state, goTo, goToId, next, previous };
}
