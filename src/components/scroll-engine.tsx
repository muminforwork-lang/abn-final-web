'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { useSnapScroll } from '@/lib/use-snap-scroll';
import { DEFAULT_THEME, isTheme, THEMES, type ThemeId } from '@/lib/themes';
import type { LocalArtCollection } from '@/lib/local-art';

/* ==========================================================================
   Scroll engine wrapper
   ==========================================================================
   Mounted once in the root layout. It

   • flags the document as immersive so CSS can hand scrolling to <main>,
   • runs the one-gesture-one-page engine over the section list,
   • renders the full-page character artwork, crossfading between elements,
   • renders the right-hand page rail (the "which page am I on" dots).
   ========================================================================== */

export function ScrollEngine({ local }: { local: LocalArtCollection }) {
  const pathname = usePathname();
  const immersive = pathname === '/';
  const { index, ids, goTo } = useSnapScroll(immersive);

  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [artIndex, setArtIndex] = useState<Partial<Record<ThemeId, number>>>({});
  const [isPhone, setIsPhone] = useState(false);
  const artRef = useRef<Partial<Record<ThemeId, number>>>({});
  artRef.current = artIndex;

  /* ------------------------------------------------ immersive flag + theme */
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.immersive = immersive ? 'true' : 'false';
    return () => {
      delete html.dataset.immersive;
    };
  }, [immersive]);

  useEffect(() => {
    const html = document.documentElement;
    const read = () => {
      const value = html.dataset.theme;
      if (isTheme(value)) setTheme(value);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const sync = () => setIsPhone(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  /* ------------------------------------------------- one variant per visit */
  useEffect(() => {
    const selections: Partial<Record<ThemeId, number>> = {};
    for (const key of Object.keys(THEMES) as ThemeId[]) {
      const count = local[key]?.length ?? 0;
      if (count < 1) continue;
      selections[key] = count > 1 ? Math.floor(Math.random() * count) : 0;
    }
    setArtIndex(selections);
  }, [local]);

  // Warm the browser cache for the next page's artwork so a scroll never
  // reveals an empty stage.
  useEffect(() => {
    if (!ids.length) return;
    const timers: number[] = [];
    (Object.keys(THEMES) as ThemeId[]).forEach((key, position) => {
      const options = local[key] ?? [];
      const selected = options[(artRef.current[key] ?? 0) % Math.max(1, options.length)];
      if (!selected) return;
      timers.push(
        window.setTimeout(() => {
          const image = new window.Image();
          image.decoding = 'async';
          image.src = selected.url;
        }, 420 * position),
      );
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [ids, local]);

  const stageArt = (key: ThemeId) => {
    const options = local[key] ?? [];
    if (!options.length) return undefined;
    return options[(artIndex[key] ?? 0) % options.length];
  };

  if (!immersive) return null;

  return (
    <>
      {/* Full-page character artwork — one stage per element, crossfaded. */}
      {!isPhone ? (
        <div aria-hidden="true" className="stage-wrap">
          {(Object.keys(THEMES) as ThemeId[]).map((key) => {
            const art = stageArt(key);
            if (!art) return null;
            const active = key === theme;
            return (
              <div key={key} className={`stage-page stage-page--${key}`} data-active={active ? 'true' : 'false'}>
                <span className="stage-page__aura" />
                <span className="stage-page__ring" />
                <span className="stage-page__ring stage-page__ring--inner" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="stage-page__img"
                  src={art.url}
                  alt=""
                  decoding="async"
                  loading={active ? 'eager' : 'lazy'}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Right-hand page rail. */}
      {ids.length > 1 ? (
        <nav className="page-rail" aria-label="Page navigation">
          <ol className="page-rail__list">
            {ids.map((id, position) => (
              <li key={id}>
                <button
                  type="button"
                  className="page-rail__dot"
                  data-active={position === index ? 'true' : 'false'}
                  aria-current={position === index ? 'true' : undefined}
                  aria-label={`Go to page ${position + 1} of ${ids.length}`}
                  onClick={() => goTo(position)}
                >
                  <span aria-hidden="true" className="page-rail__pip" />
                </button>
              </li>
            ))}
          </ol>
          <span className="page-rail__count">
            <span className="page-rail__count-now">{String(index + 1).padStart(2, '0')}</span>
            <span className="page-rail__count-sep">/</span>
            <span className="page-rail__count-all">{String(ids.length).padStart(2, '0')}</span>
          </span>
        </nav>
      ) : null}
    </>
  );
}
