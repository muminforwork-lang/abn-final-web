'use client';

import { usePathname } from 'next/navigation';

import { usePageRail } from '@/lib/use-page-rail';

/* ==========================================================================
   Page rail
   ==========================================================================
   The dots on the right edge of the home page, plus the "01 / 06" counter.

   Scrolling itself is entirely native — see src/lib/use-page-rail.ts. This
   component only renders the chrome and highlights the page you are on.
   ========================================================================== */

export function ScrollEngine() {
  const pathname = usePathname();
  const onHome = pathname === '/';
  const { index, ids, goTo } = usePageRail(onHome);

  if (!onHome || ids.length < 2) return null;

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
