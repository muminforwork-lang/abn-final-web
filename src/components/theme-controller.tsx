'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_THEME, isTheme, themeForPath, type ThemeId } from '@/lib/themes';

/**
 * Watches which [data-theme-section] is under the middle of the viewport and
 * switches <html data-theme>. Every colour in globals.css is defined per
 * theme, so this single attribute is what makes the whole page re-tint as the
 * visitor scrolls from one element to the next.
 *
 * Two details matter for the immersive front page:
 *   • The window does not scroll there — <main> does — so we subscribe to
 *     whichever element actually owns the scroll.
 *   • In immersive mode a single [data-theme-section] may wrap several
 *     full-page sections, so we walk up to the nearest one and let the deepest
 *     match win.
 */
export function ThemeController() {
  const pathname = usePathname();
  const [burst, setBurst] = useState(0);
  const current = useRef<ThemeId>(DEFAULT_THEME);
  const announced = useRef(false);

  useEffect(() => {
    const apply = (next: ThemeId) => {
      if (next === current.current) return;
      const first = !announced.current;
      announced.current = true;
      current.current = next;
      document.documentElement.dataset.theme = next;
      // The very first paint should not fire a ripple.
      if (!first) setBurst((n) => n + 1);
    };

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-theme-section]'),
    );
    if (sections.length === 0) {
      apply(themeForPath(pathname));
      return;
    }

    // The element that owns scrolling: <main> in immersive mode, else window.
    const viewport = document.querySelector<HTMLElement>('[data-snap-viewport]');
    const immersive = document.documentElement.dataset.immersive === 'true';
    const scroller: HTMLElement | Window = immersive && viewport ? viewport : window;

    let frame = 0;
    const update = () => {
      frame = 0;
      const middle = window.innerHeight * 0.5;
      let found: string | undefined;
      // Later elements in the DOM are the more deeply nested ones, so they win.
      for (const el of sections) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= middle && rect.bottom >= middle) found = el.dataset.themeSection;
      }
      if (isTheme(found)) apply(found);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // Anchor jumps (#pc, #catalog) do not always emit a scroll event first.
    window.addEventListener('hashchange', onScroll);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return burst > 0 ? <div key={`ripple-${burst}`} aria-hidden="true" className="theme-ripple" /> : null;
}
