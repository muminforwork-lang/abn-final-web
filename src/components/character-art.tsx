/**
 * ============================================================================
 *  CHARACTER ART
 * ============================================================================
 *  The full-page character that stands behind each section.
 *
 *  This is a Server Component on purpose: the character for a section is
 *  rendered INSIDE that section, so it ships in the HTML and always appears
 *  with the page it belongs to.
 *
 *  An earlier version mounted every character in one fixed, full-viewport layer
 *  and cross-faded between them. That failed in a specific and confusing way:
 *  the inactive images were `opacity: 0` AND `loading="lazy"`, so the browser
 *  never downloaded them — revealing one swapped in an image that had never
 *  been fetched, and most sections showed no character at all.
 *
 *  Now every character is a real image inside its own section, loaded eagerly,
 *  and no z-index tricks are involved: the art sits at z-index 0 and the
 *  section content sits above it at z-index 1.
 * ============================================================================
 */

import type { LocalArtCollection } from '@/lib/local-art';
import type { ThemeId } from '@/lib/themes';

export function CharacterArt({
  theme,
  local,
}: {
  theme: ThemeId;
  local: LocalArtCollection;
}) {
  const options = local[theme] ?? [];
  if (options.length === 0) return null;

  return (
    <div aria-hidden="true" className={`page-art page-art--${theme}`}>
      <span className="page-art__aura" />
      <span className="page-art__ring" />
      <span className="page-art__ring page-art__ring--inner" />
      <picture>
        {options[0].mobileUrl ? (
          <source media="(max-width: 1023px)" srcSet={options[0].mobileUrl} type="image/webp" />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="page-art__img"
          src={options[0].url}
          alt=""
          decoding="async"
          /*
           * Always eager. These are the artwork the whole page is built around;
           * an unloaded character is exactly the bug this component exists to
           * prevent, so it is not worth gambling on lazy-loading heuristics.
           * Each file is 70–170 KB and next/image is not involved here because
           * these are already optimised WebP.
           */
          loading="eager"
          fetchPriority="high"
        />
      </picture>
    </div>
  );
}
