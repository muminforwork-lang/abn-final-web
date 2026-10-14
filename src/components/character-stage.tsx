'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_THEME, THEME_IDS, isTheme, type ThemeId } from '@/lib/themes';
import type { LocalArtCollection } from '@/lib/local-art';

/** Shared character scene. Images and theme colours are entirely local/static. */
export function CharacterStage({ local }: { local: LocalArtCollection }) {
  const [active, setActive] = useState<ThemeId>(DEFAULT_THEME);
  const [armed, setArmed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [artSelections, setArtSelections] = useState<Partial<Record<ThemeId, number>>>({});

  useEffect(() => {
    const html = document.documentElement;
    const read = () => {
      const value = html.dataset.theme;
      if (isTheme(value)) setActive(value);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    let timer: number | undefined;
    const sync = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      setIsMobile(query.matches);
      if (query.matches) {
        setArmed(false);
      } else {
        timer = window.setTimeout(() => setArmed(true), 700);
      }
    };
    sync();
    query.addEventListener('change', sync);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      query.removeEventListener('change', sync);
    };
  }, []);

  // Pick exactly one local image per theme for this visit. On the next page
  // load/visit, advance each theme to another available variant so characters
  // don't rotate while the user is browsing. Each theme has its own selection.
  useEffect(() => {
    const selections: Partial<Record<ThemeId, number>> = {};
    for (const theme of THEME_IDS) {
      const count = local[theme]?.length ?? 0;
      if (count < 1) continue;
      const storageKey = `abnormal-character-variant:${theme}`;
      let previous = -1;
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored !== null) previous = Number.parseInt(stored, 10);
      } catch {
        // Private browsing or storage restrictions should not block artwork.
      }
      const next = count > 1
        ? (Number.isInteger(previous) && previous >= 0 && previous < count
            ? (previous + 1) % count
            : Math.floor(Math.random() * count))
        : 0;
      selections[theme] = next;
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // The selected image still works if storage is unavailable.
      }
    }
    setArtSelections(selections);
  }, [local]);

  return (
    <div>
      {THEME_IDS.map((theme) => {
        const options = local[theme] ?? [];
        const selectedIndex = artSelections[theme] ?? 0;
        const art = options.length ? options[selectedIndex % options.length] : undefined;
        const selectionReady = Object.prototype.hasOwnProperty.call(artSelections, theme);
        const isLoaded = selectionReady && !!art && (theme === active || (armed && !isMobile));
        return (
          <div key={theme} className={`stage stage-${theme}`}>
            <div aria-hidden="true" className="stage-aura" />
            <div aria-hidden="true" className="stage-ring" />
            <div aria-hidden="true" className="stage-ring stage-ring--inner" />
            <div aria-hidden="true" className="stage-art">
              {isLoaded && art ? (
                <picture key={art.url}>
                  {art.mobileUrl ? <source media="(max-width: 1023px)" srcSet={art.mobileUrl} type="image/webp" /> : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="stage-img"
                    src={art.url}
                    alt=""
                    decoding="async"
                    loading={theme === active ? 'eager' : 'lazy'}
                  />
                </picture>
              ) : null}
            </div>
            {art?.artist && theme === active ? (
              <a className="stage-credit" href={art.link} target="_blank" rel="noopener noreferrer">
                Art: {art.artist}
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
