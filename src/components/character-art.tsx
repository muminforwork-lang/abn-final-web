/**
 * ============================================================================
 *  CHARACTER ART
 * ============================================================================
 *  The character that stands behind a full-page section.
 *
 *  This is a Server Component on purpose: the character is rendered INSIDE the
 *  section it belongs to, so it ships in the HTML and always appears with its
 *  page.
 *
 *  An earlier version mounted every character in one fixed, full-viewport layer
 *  and cross-faded between them. That failed in a specific and confusing way:
 *  the inactive images were `opacity: 0` AND `loading="lazy"`, so the browser
 *  never downloaded them — revealing one swapped in an image that had never
 *  been fetched, and most sections showed no character at all.
 *
 *  Now every character is a real image inside its own section, loaded eagerly,
 *  and no z-index tricks are involved: the art sits at z-index 0 and the
 *  section content above it at z-index 1.
 *
 *  Variants
 *  --------
 *  You can keep several pictures per element (anemo.webp, anemo2.webp, …). Pass
 *  a `variant` to choose which one: use 0 for the first, 1 for the second, and
 *  so on. The homepage rotates through them from section to section, so a long
 *  visit shows more than one character. The index is derived from the section
 *  order rather than random, so the server and browser always agree.
 * ============================================================================
 */

import type { LocalArtCollection } from '@/lib/local-art';
import type { ThemeId } from '@/lib/themes';

export function CharacterArt({
  theme,
  local,
  /** Which picture to use when an element has more than one. */
  variant = 0,
}: {
  theme: ThemeId;
  local: LocalArtCollection;
  variant?: number;
}) {
  const options = local[theme] ?? [];
  if (options.length === 0) return null;

  // Wrap safely: variant 3 with two pictures available uses the first.
  const pick = ((variant % options.length) + options.length) % options.length;
  const art = options[pick];

  return (
    <div aria-hidden="true" className={`page-art page-art--${theme}`}>
      <span className="page-art__aura" />
      <span className="page-art__ring" />
      <span className="page-art__ring page-art__ring--inner" />
      <picture>
        {art.mobileUrl ? (
          <source media="(max-width: 1023px)" srcSet={art.mobileUrl} type="image/webp" />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="page-art__img"
          src={art.url}
          alt=""
          decoding="async"
          /*
           * Always eager. This is the artwork the page is built around; an
           * unloaded character is exactly the bug this component exists to
           * prevent, so it is not worth gambling on lazy-loading heuristics.
           * Each file is 70–170 KB and these are already optimised WebP.
           */
          loading="eager"
          fetchPriority="high"
        />
      </picture>
    </div>
  );
}
