'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ==========================================================================
   Page rail tracking
   ==========================================================================
   Scrolling on the home page is COMPLETELY NORMAL — the browser does it, the
   same as every other route. Nothing here cancels a wheel event, animates
   scrollTop, or limits how fast you can scroll.

   This hook only answers one question: "which full-page section is on screen?"
   That drives the two pieces of chrome that depend on it:

     • the dots on the right edge, and
     • `data-active` on each section, which the CSS entrance animations use.

   History: two earlier versions replaced native scrolling with a custom
   engine — first hard scroll-snap, then an inertial rAF animation. Both felt
   wrong, and the second one `preventDefault()`-ed every wheel event and
   allowed only one page per 420 ms, so a normal flick appeared to do nothing
   at all. Native scrolling is what people expect; this file now stays out of
   its way.
   ========================================================================== */

export type PageRailApi = {
  index: number;
  ids: string[];
  goTo: (index: number) => void;
  goToId: (id: string) => void;
};

export function usePageRail(enabled: boolean): PageRailApi {
  const [state, setState] = useState<{ index: number; ids: string[] }>({
    index: 0,
    ids: [],
  });

  const viewportRef = useRef<HTMLElement | null>(null);
  const sectionsRef = useRef<HTMLElement[]>([]);
  const indexRef = useRef(0);

  /* ------------------------------------------------------------ helpers */

  const collect = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return [] as HTMLElement[];
    const list = Array.from(viewport.querySelectorAll<HTMLElement>('[data-snap-section]'));
    sectionsRef.current = list;
    return list;
  }, []);

  const setActive = useCallback((list: HTMLElement[], active: number) => {
    list.forEach((element, position) => {
      const flag = position === active ? 'true' : 'false';
      if (element.dataset.active !== flag) element.dataset.active = flag;
    });
  }, []);

  /** Scrolls a section into view using the browser's own smooth scrolling. */
  const goTo = useCallback(
    (target: number) => {
      const list = sectionsRef.current.length ? sectionsRef.current : collect();
      if (!list.length) return;
      const clamped = Math.max(0, Math.min(list.length - 1, Math.trunc(target)));
      const element = list[clamped];
      if (!element) return;

      indexRef.current = clamped;
      setActive(list, clamped);
      setState((previous) =>
        previous.index === clamped ? previous : { ...previous, index: clamped },
      );

      element.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'start',
      });
    },
    [collect, setActive],
  );

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
    setActive(list, indexRef.current);
    setState({ index: indexRef.current, ids: list.map((element) => element.id) });

    if (list.length === 0 || typeof IntersectionObserver === 'undefined') return;

    // Whichever section covers most of the viewport is the active one.
    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
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
        if (bestRatio > 0.5 && best !== indexRef.current) {
          indexRef.current = best;
          setActive(list, best);
          setState((previous) =>
            previous.index === best ? previous : { ...previous, index: best },
          );
        }
      },
      { root: viewport, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
    );
    list.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [collect, enabled, setActive]);

  return { ...state, goTo, goToId };
}
