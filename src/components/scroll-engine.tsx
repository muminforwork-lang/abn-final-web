'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { useSnapScroll } from '@/lib/use-snap-scroll';

/* ==========================================================================
   Scroll engine wrapper
   ==========================================================================
   Mounted once in the root layout. It

   • flags the document as immersive so CSS can hand scrolling to <main>,
   • runs the one-gesture-one-page engine over the section list,
   • renders the right-hand page rail ("which page am I on").

   The character art is NOT rendered here any more — it lives inside each
   section via <CharacterArt>, which is what makes it reliable. See the note in
   src/components/character-art.tsx.
   ========================================================================== */

export function ScrollEngine() {
  const pathname = usePathname();
  const immersive = pathname === '/';
  const { index, ids, goTo } = useSnapScroll(immersive);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.immersive = immersive ? 'true' : 'false';
    return () => {
      delete html.dataset.immersive;
    };
  }, [immersive]);

  if (!immersive || ids.length < 2) return null;

  return (
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
  );
}
