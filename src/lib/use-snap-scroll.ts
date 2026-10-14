'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { clampIndex, createWheelGesture, decideSwipe, decideWheel } from '@/lib/gesture';

/* ==========================================================================
   Smooth full-page scrolling
   ==========================================================================
   The page glides to its next section instead of snapping to it.

   How it works
   ------------
   A single rAF loop eases `scrollTop` toward a target every frame using
   exponential smoothing:

       scrollTop += (target - scrollTop) * (1 - exp(-k * dt))

   That curve is frame-rate independent, has no fixed duration, and starts
   quickly then settles gently — the same unhurried motion the big showcase
   sites use. Because the loop drives the scroll position itself, nothing
   fights the browser: CSS scroll-snap is deliberately OFF and the wheel event
   is cancelled, so the browser never runs its own scrolling underneath.

   Why not native scroll-snap?
   ---------------------------
   Two earlier attempts used it and both felt wrong:
     • `scroll-snap-stop: always` is not supported everywhere, so a hard flick
       skipped several sections in some browsers;
     • adding a JavaScript lock to compensate made fast scrolling and Page Down
       feel broken, because input was refused while a transition ran.
   Driving the position directly removes both problems.

   Input
   -----
   • Wheel: one notch is one page. A long continuous flick earns more pages
     (see gesture.ts), which keeps fast scrolling responsive rather than sticky.
   • Touch: a vertical swipe is taken over and animated the same way.
   • Keyboard: retargets instantly, never rate-limited.
   • The rAF loop only runs while there is distance left to cover.
   ========================================================================== */

/** Higher settles faster. ~7 gives a smooth, unhurried glide. */
const SMOOTHING = 7.4;
/** Below this distance the target is considered reached. */
const EPSILON = 0.6;
/** Wheel input arriving after this gap starts a new gesture. */
const WHEEL_IDLE_MS = 150;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export type SnapScrollApi = {
  index: number;
  ids: string[];
  goTo: (index: number) => void;
  goToId: (id: string) => void;
  next: () => void;
  previous: () => void;
};

export function useSnapScroll(enabled: boolean): SnapScrollApi {
  const [state, setState] = useState<{ index: number; ids: string[] }>({
    index: 0,
    ids: [],
  });

  const viewportRef = useRef<HTMLElement | null>(null);
  const sectionsRef = useRef<HTMLElement[]>([]);
  const indexRef = useRef(0);
  const targetRef = useRef(0);
  const loopRef = useRef(0);
  const lastFrameRef = useRef(0);
  const wheelRef = useRef(createWheelGesture());
  const touchRef = useRef({ y: 0, handled: false });

  /* ------------------------------------------------------------ helpers */

  const collect = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return [] as HTMLElement[];
    const list = Array.from(viewport.querySelectorAll<HTMLElement>('[data-snap-section]'));
    sectionsRef.current = list;
    return list;
  }, []);

  /**
   * Offset to scroll to so a section sits just below the fixed header.
   *
   * `--snap-offset` is how much of the scroll container the header covers
   * (zero on desktop, the header height on a phone). Without subtracting it
   * the top of every page — the eyebrow and the heading — slides under the
   * header.
   */
  const offsetOf = useCallback((element: HTMLElement) => {
    const viewport = viewportRef.current;
    if (!viewport) return 0;
    const measured =
      element.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop;
    const raw = getComputedStyle(viewport).getPropertyValue('--snap-offset').trim();
    const parsed = Number.parseFloat(raw);
    // The value is in rem; convert against the root font size.
    const rootFont = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const offset = Number.isFinite(parsed) ? parsed * (raw.endsWith('rem') ? rootFont : 1) : 0;
    return Math.max(0, Math.round(measured - offset));
  }, []);

  const markActive = useCallback((list: HTMLElement[], active: number) => {
    list.forEach((element, position) => {
      const flag = position === active ? 'true' : 'false';
      if (element.dataset.active !== flag) element.dataset.active = flag;
    });

    // A page may contain its own scrollable list (the catalog grid). Reset it
    // when the page becomes active, or returning to it shows the list still
    // scrolled down and the page heading is out of view.
    const current = list[active];
    if (!current) return;
    current.querySelectorAll<HTMLElement>('[data-snap-scroll]').forEach((panel) => {
      if (panel.scrollTop !== 0) panel.scrollTop = 0;
    });
  }, []);

  /** The rAF loop: eases scrollTop toward the target until it arrives. */
  const startLoop = useCallback(() => {
    if (loopRef.current) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const step = (now: number) => {
      const previous = lastFrameRef.current || now;
      lastFrameRef.current = now;
      // Clamp dt so a background tab or a long frame cannot teleport the page.
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));

      const distance = targetRef.current - viewport.scrollTop;
      if (Math.abs(distance) <= EPSILON) {
        viewport.scrollTop = targetRef.current;
        loopRef.current = 0;
        lastFrameRef.current = 0;
        return;
      }

      // Frame-rate independent exponential approach.
      viewport.scrollTop += distance * (1 - Math.exp(-SMOOTHING * dt));
      loopRef.current = window.requestAnimationFrame(step);
    };

    lastFrameRef.current = 0;
    loopRef.current = window.requestAnimationFrame(step);
  }, []);

  /** The index the engine is currently heading for. */
  const targetIndex = useCallback(() => {
    const viewport = viewportRef.current;
    const list = sectionsRef.current;
    if (!viewport || list.length === 0) return indexRef.current;
    const base = offsetOf(list[0]);
    return clampIndex(
      Math.round((targetRef.current - base) / Math.max(1, viewport.clientHeight)),
      list.length,
    );
  }, [offsetOf]);

  /** Points the engine at a page index and starts gliding toward it. */
  const goTo = useCallback(
    (target: number) => {
      const list = sectionsRef.current.length ? sectionsRef.current : collect();
      if (!list.length) return;
      const clamped = clampIndex(target, list.length);

      if (clamped !== indexRef.current) {
        indexRef.current = clamped;
        markActive(list, clamped);
        setState((previous) =>
          previous.index === clamped ? previous : { ...previous, index: clamped },
        );
      }

      targetRef.current = offsetOf(list[clamped]);

      const viewport = viewportRef.current;
      if (!viewport) return;

      if (prefersReducedMotion()) {
        viewport.scrollTop = targetRef.current;
        return;
      }
      startLoop();
    },
    [collect, markActive, offsetOf, startLoop],
  );

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo]);
  const previous = useCallback(() => goTo(indexRef.current - 1), [goTo]);

  const goToId = useCallback(
    (id: string) => {
      const list = sectionsRef.current.length ? sectionsRef.current : collect();
      const found = list.findIndex((element) => element.id === id);
      if (found >= 0) goTo(found);
    },
    [collect, goTo],
  );

  /* --------------------------------------------------------------- mount */
  useEffect(() => {
    if (!enabled) return;

    const viewport = document.querySelector<HTMLElement>('[data-snap-viewport]');
    if (!viewport) return;
    viewportRef.current = viewport;

    const list = collect();
    markActive(list, indexRef.current);
    setState({ index: indexRef.current, ids: list.map((element) => element.id) });
    targetRef.current = offsetOf(list[indexRef.current]) ?? 0;

    /* --------------------------------------------------------- wheel */
    // Cancelled so the browser's own scrolling never runs under the animation:
    // the engine owns the position while a page is in flight.
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return; // browser zoom
      event.preventDefault();
      if (prefersReducedMotion()) return;

      const outcome = decideWheel(wheelRef.current, event.deltaY, performance.now());
      wheelRef.current = outcome.gesture;
      if (!outcome.shouldMove) return;

      // Retarget from where the engine is already heading, so a second flick
      // during a glide extends the journey instead of fighting it.
      const base = Math.abs(targetRef.current - viewport.scrollTop) > 4
        ? targetIndex()
        : indexRef.current;
      goTo(base + outcome.pages);
    };

    /* ------------------------------------------------------ keyboard */
    // Keys are one deliberate action each, so they are never rate-limited.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
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
          goTo(0);
          break;
        case 'End':
          event.preventDefault();
          goTo(list.length - 1);
          break;
        default:
          break;
      }
    };

    /* --------------------------------------------------------- touch */
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      touchRef.current = { y: event.touches[0].clientY, handled: false };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (prefersReducedMotion()) return;
      if (event.touches.length !== 1 || touchRef.current.handled) return;

      const dy = event.touches[0].clientY - touchRef.current.y;

      // A deliberately scrollable inner list keeps its own scrolling.
      let node: HTMLElement | null =
        event.target instanceof HTMLElement ? event.target : null;
      while (node && node !== viewport) {
        if (node.hasAttribute('data-snap-scroll')) {
          const style = window.getComputedStyle(node);
          const scrollable =
            /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2;
          const canMove = dy < 0
            ? node.scrollTop + node.clientHeight < node.scrollHeight - 1
            : node.scrollTop > 0;
          if (scrollable && canMove) return;
        }
        node = node.parentElement;
      }

      const outcome = decideSwipe(0, dy);
      if (!outcome.shouldMove) return;

      touchRef.current.handled = true;
      event.preventDefault();
      goTo(indexRef.current + outcome.pages);
    };

    /* --------------------------------- the wheel gesture ends on its own */
    let wheelIdle = 0;
    const onWheelIdle = () => {
      if (wheelIdle) window.clearTimeout(wheelIdle);
      wheelIdle = window.setTimeout(() => {
        wheelRef.current = createWheelGesture();
      }, WHEEL_IDLE_MS);
    };

    /* --------------------------------------------------------- resize */
    let resizeFrame = 0;
    const onResize = () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        // Re-align to the active page after a viewport height change (mobile
        // browser bars, rotation) without animating.
        const current = sectionsRef.current[indexRef.current];
        if (!current) return;
        const top = offsetOf(current);
        targetRef.current = top;
        viewport.scrollTop = top;
      });
    };

    /* -------------------------- follow a manual scroll (scrollbar drag) */
    let scrollFrame = 0;
    const onScroll = () => {
      if (loopRef.current) return; // the engine is driving; ignore its own scrolls
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        const sections = sectionsRef.current;
        if (!sections.length) return;
        const middle = viewport.clientHeight * 0.5;
        let nearest = indexRef.current;
        let best = Number.POSITIVE_INFINITY;
        sections.forEach((element, position) => {
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
          targetRef.current = offsetOf(sections[nearest]);
          markActive(sections, nearest);
          setState((previous) =>
            previous.index === nearest ? previous : { ...previous, index: nearest },
          );
        }
      });
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('wheel', onWheelIdle, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('wheel', onWheelIdle);
      window.removeEventListener('keydown', onKeyDown);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (loopRef.current) window.cancelAnimationFrame(loopRef.current);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (wheelIdle) window.clearTimeout(wheelIdle);
      loopRef.current = 0;
      lastFrameRef.current = 0;
    };
  }, [collect, enabled, goTo, markActive, next, offsetOf, previous, targetIndex]);

  return { ...state, goTo, goToId, next, previous };
}
