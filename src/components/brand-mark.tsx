/**
 * ============================================================================
 *  BRAND MARKS
 * ============================================================================
 *  Small original SVG sigils, one per platform. They are used as the floating
 *  "element badge" on each full-page section and inside the product boxes.
 *  Everything is drawn here — no icon package, no external request.
 * ============================================================================
 */

import type { Platform } from '@/data/products';

export function BrandMark({
  platform,
  className = '',
}: {
  platform: Platform;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {platform === 'pc' ? <PcSigil /> : null}
      {platform === 'android' ? <AndroidSigil /> : null}
      {platform === 'ios' ? <IosSigil /> : null}
    </svg>
  );
}

/** PC — a faceted monitor monogram. */
function PcSigil() {
  return (
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 4 42 14v20L24 44 6 34V14z" strokeWidth="1.5" opacity="0.5" />
      <rect x="13" y="15" width="22" height="15" rx="2.5" strokeWidth="1.9" />
      <path d="M20 35h8M24 30v5" strokeWidth="1.9" />
      <path d="M17 20h9" strokeWidth="1.5" opacity="0.75" />
      <path d="M17 24h6" strokeWidth="1.5" opacity="0.5" />
    </g>
  );
}

/** Android — a hexagonal phone sigil with a robot-eye notch. */
function AndroidSigil() {
  return (
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 3 43 13.5v21L24 45 5 34.5v-21z" strokeWidth="1.5" opacity="0.5" />
      <rect x="17" y="13" width="14" height="22" rx="3.5" strokeWidth="1.9" />
      <circle cx="24" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M21 30.5h6" strokeWidth="1.6" opacity="0.7" />
      <path d="M13 20v8M35 20v8" strokeWidth="1.6" opacity="0.65" />
    </g>
  );
}

/** iOS — a rounded-square sigil with a rising wing. */
function IosSigil() {
  return (
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 3 43 13.5v21L24 45 5 34.5v-21z" strokeWidth="1.5" opacity="0.5" />
      <path d="M20 33c0-7 4-12 11-14-1 8-5 12-11 14z" strokeWidth="1.9" />
      <path d="M20 33c-3-3-4-7-3-11 3 2 5 5 6 8" strokeWidth="1.6" opacity="0.7" />
      <path d="M24 33v5" strokeWidth="1.9" />
    </g>
  );
}
