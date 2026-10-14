/**
 * ============================================================================
 *  PAGE BACKDROP
 * ============================================================================
 *  The character art behind an ordinary (non-full-page) route such as /pc,
 *  /android, /payments or /support.
 *
 *  Why this exists
 *  ---------------
 *  The immersive front page renders a character inside each of its sections
 *  (see character-art.tsx). The other routes used to get their character from
 *  a global fixed layer, which was removed when the front page was rebuilt —
 *  so those pages silently lost their artwork and showed only a colour change.
 *
 *  This component restores it, using the same drawing-free approach: a real
 *  <img> loaded eagerly, so it can never fail to appear.
 *
 *  Usage — the parent must be `position: relative`:
 *
 *      <div className="page-shell">
 *        <PageBackdrop theme="cryo" />
 *        ...
 *      </div>
 * ============================================================================
 */

import { CharacterArt } from '@/components/character-art';
import { findLocalCharacters } from '@/lib/local-art';
import type { ThemeId } from '@/lib/themes';

export function PageBackdrop({
  theme,
  /** 'right' keeps the character clear of left-aligned text. */
  align = 'right',
  /** Which picture to use when the element has more than one. */
  variant = 0,
}: {
  theme: ThemeId;
  align?: 'right' | 'left';
  variant?: number;
}) {
  const local = findLocalCharacters();

  return (
    <div aria-hidden="true" className={`page-backdrop page-backdrop--${align}`}>
      <CharacterArt theme={theme} local={local} variant={variant} />
    </div>
  );
}

/**
 * A second, lower character partway down a long page.
 *
 * The platform and payment pages are several screens tall, so a single
 * character pinned to the top is gone by the time you reach the products.
 * This places another one further down so the page keeps its atmosphere.
 */
export function MidPageBackdrop({
  theme,
  variant = 1,
}: {
  theme: ThemeId;
  variant?: number;
}) {
  return (
    <div aria-hidden="true" className="page-backdrop page-backdrop--mid">
      <CharacterArt theme={theme} local={findLocalCharacters()} variant={variant} />
    </div>
  );
}
