'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { clampIndex, createWheelGesture, decideSwipe, decideWheel } from '@/lib/gesture';
/* ==========================================================================
   Full-page snap scrolling
   ==========================================================================
   Design goal: every input must respond IMMEDIATELY, and every gesture must
   move exactly one page.

   How it works
   ------------
   The browser does the scrolling. The viewport is a real scroll container with
   `scroll-snap-type: y mandatory` and every section carries
   `scroll-snap-stop: always`, which is the browser's own guarantee that one
   gesture cannot fly past a snap point.

   On top of that, this engine:
     • cancels the wheel event so the browser cannot free-scroll, letting the
       snap points decide the landing position;
     • allows one page move per *gesture* (a wheel burst still arriving within
       400 ms of the last event is the same gesture), which is what stops a
       hard flick from skipping pages;
     • lets the keyboard move freely at all times, because a key press is
       already a single deliberate action.

   Earlier versions blocked input while an animation was running. That is what
   made fast scrolling and Page Up feel broken, so nothing here ever refuses an
   input: a gesture during a move is simply folded into the ongoing gesture
   instead of being discarded.
   ========================================================================== */

/** A burst of wheel events within this gap counts as one gesture. */
/** Touch: vertical distance before a swipe turns the page. */
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
  const wheelRef = useRef(createWheelGesture());
  const touchRef = useRef({ x: 0, y: 0, fired: false });
  const rafRef = useRef(0);

  /* ------------------------------------------------------------ helpers */

  const collect = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return [] as HTMLElement[];
    const list = Array.from(viewport.querySelectorAll<HTMLElement>('[data-snap-section]'));
    sectionsRef.current = list;
    return list;
  }, []);

  const markActive = useCallback((list: HTMLElement[], active: number) => {
    list.forEach((element, position) => {
      const flag = position === active ? 'true' : 'false';
      if (element.dataset.active !== flag) element.dataset.active = flag;
    });

    // A page may contain its own scrollable list (the catalog grid). Reset it
    // when its page becomes active, otherwise returning to that page shows the
    // list still scrolled down and the page heading is out of view.
    const current = list[active];
    if (!current) return;
    current.querySelectorAll<HTMLElement>('[data-snap-scroll]').forEach((panel) => {
      if (panel.scrollTop !== 0) panel.scrollTop = 0;
    });
  }, []);

  /** Offset of a section within the scroll container. */
  const offsetOf = useCallback((element: HTMLElement) => {
    const viewport = viewportRef.current;
    if (!viewport) return 0;
    const top =
      element.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop;
    return Math.max(0, Math.round(top));
  }, []);

  /** Moves to a page index. Never refuses: an in-flight animation is replaced. */
  const goTo = useCallback(
    (target: number) => {
      const list = sectionsRef.current.length ? sectionsRef.current : collect();
      if (!list.length) return;
      const clamped = clampIndex(target, list.length);

      indexRef.current = clamped;
      markActive(list, clamped);
      setState((previous) =>
        previous.index === clamped ? previous : { ...previous, index: clamped },
      );

      const top = offsetOf(list[clamped]);
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      viewport.scrollTo({
        top,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    },
    [collect, markActive, offsetOf],
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

    /* Index tracking: whichever section fills most of the viewport wins. */
    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      const ratios = new Map<number, number>();
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const position = list.indexOf(entry.target as HTMLElement);
            if (position >= 0) ratios.set(position, entry.intersectionRatio);
          }
          let best = indexRef.current;
          let bestRatio = 0;
          for (const [position, ratio] of ratios) {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              best = position;
            }
          }
          if (bestRatio > 0.55 && best !== indexRef.current) {
            indexRef.current = best;
            markActive(list, best);
            setState((previous) =>
              previous.index === best ? previous : { ...previous, index: best },
            );
          }
        },
        { root: viewport, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
      );
      list.forEach((element) => io?.observe(element));
    }

    /* --------------------------------------------------------- wheel */
    // One page per gesture. A wheel burst is one gesture, so a hard flick
    // cannot skip ahead, but a slow deliberate scroll pages normally.
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return; // browser zoom
      event.preventDefault();
      if (prefersReducedMotion()) return;

      const outcome = decideWheel(wheelRef.current, event.deltaY, performance.now());
      wheelRef.current = outcome.gesture;
      if (outcome.shouldMove) goTo(indexRef.current + outcome.move);
    };

    /* ------------------------------------------------------ keyboard */
    // Keys are already one action each, so they are never rate-limited.
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
    // Vertical swipes are taken over so the page always lands on a snap
    // point; the move itself uses smooth scrolling, which looks and feels the
    // same as a native flick.
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchRef.current = { x: touch.clientX, y: touch.clientY, fired: false };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (prefersReducedMotion()) return;
      if (event.touches.length !== 1 || touchRef.current.fired) return;
      const touch = event.touches[0];
      const dy = touch.clientY - touchRef.current.y;
      const dx = touch.clientX - touchRef.current.x;
      // Sideways swipes belong to carousels; short swipes do nothing.

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

      const outcome = decideSwipe(dx, dy);
      if (!outcome.shouldMove) return;

      touchRef.current.fired = true;
      event.preventDefault();
      goTo(indexRef.current + outcome.move);
    };

    /* -------------------------------------------------- landing safety */
    // The engine, not the browser, decides where a page ends up.
    //
    // Without this, a fast burst of wheel events can leave the container
    // momentarily between two sections; CSS scroll-snap then "corrects" toward
    // whichever section is closer, which is how a single 12-event flick was
    // measured landing 3 pages away. So after every scroll settles, the
    // intended page is restored.
    //
    // The last page is deliberately exempt: it is shorter than the viewport
    // and cannot scroll to its own top, so pulling it back would ping-pong.
    let settle = 0;
    const settleNow = () => {
      const list = sectionsRef.current;
      if (!list.length) return;

      const lastIndex = list.length - 1;
      const intended = list[indexRef.current];
      if (!intended || indexRef.current === lastIndex) return;

      const drift = Math.abs(offsetOf(intended) - viewport.scrollTop);
      // Scroll snapping tolerates a pixel or two; anything more is real drift.
      if (drift > 12) {
        viewport.scrollTo({ top: offsetOf(intended), behavior: 'smooth' });
      }
    };

    const onScroll = () => {
      if (settle) window.clearTimeout(settle);
      settle = window.setTimeout(settleNow, 140);
    };

    const onScrollEnd = () => {
      if (settle) window.clearTimeout(settle);
      settleNow();
    };

    let resizeFrame = 0;
    const onResize = () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        const current = sectionsRef.current[indexRef.current];
        if (current) viewport.scrollTop = offsetOf(current);
      });
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('scroll', onScroll, { passive: true });
    viewport.addEventListener('scrollend', onScrollEnd);
    window.addEventListener('resize', onResize);

    return () => {
      viewport.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('scrollend', onScrollEnd);
      window.removeEventListener('resize', onResize);
      io?.disconnect();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      if (settle) window.clearTimeout(settle);
    };
  }, [collect, enabled, goTo, markActive, next, offsetOf, previous]);

  return { ...state, goTo, goToId, next, previous };
}
