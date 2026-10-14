/**
 * ============================================================================
 *  DEVICE ART
 * ============================================================================
 *  Original inline SVG illustrations of a desktop PC, an iPhone and an
 *  Android phone. Nothing is downloaded and nothing is copied — the shapes are
 *  drawn here, and every colour comes from the active element theme, so each
 *  illustration re-tints itself as the visitor scrolls into another section.
 *
 *  Swap in real photography later? Drop a file in /public/art/devices and pass
 *  its path to <DeviceArt photo="/art/devices/pc.webp" /> — the component
 *  renders the photo instead of the drawing, with the same frame and glow.
 * ============================================================================
 */

import Image from 'next/image';

export type DeviceKind = 'pc' | 'iphone' | 'android';

const KINDS: Record<DeviceKind, { ratio: string; label: string }> = {
  pc: { ratio: '200 / 168', label: 'Desktop PC' },
  iphone: { ratio: '96 / 168', label: 'iPhone' },
  android: { ratio: '96 / 176', label: 'Android phone' },
};

export function DeviceArt({
  kind,
  photo,
  priority = false,
  className = '',
}: {
  kind: DeviceKind;
  /** Optional real photograph — replaces the drawing when provided. */
  photo?: string;
  priority?: boolean;
  className?: string;
}) {
  if (photo) {
    return (
      <span className={`device-photo ${className}`} style={{ aspectRatio: KINDS[kind].ratio }}>
        <Image
          src={photo}
          alt={KINDS[kind].label}
          fill
          sizes="(max-width: 767px) 60vw, 26rem"
          priority={priority}
          className="object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={`device-art type-${kind} ${className}`}
      style={{ aspectRatio: KINDS[kind].ratio }}
      role="img"
      aria-label={KINDS[kind].label}
    >
      {kind === 'pc' ? <PcArt /> : null}
      {kind === 'iphone' ? <PhoneArt variant="iphone" /> : null}
      {kind === 'android' ? <PhoneArt variant="android" /> : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop PC — monitor + tower + keys                                         */
/* -------------------------------------------------------------------------- */

function PcArt() {
  return (
    <svg viewBox="0 0 200 168" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dv-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-crimson-900)" />
          <stop offset="55%" stopColor="var(--color-ink-900)" />
          <stop offset="100%" stopColor="var(--color-aura-900)" />
        </linearGradient>
        <linearGradient id="dv-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-ink-500)" />
          <stop offset="50%" stopColor="var(--color-ink-700)" />
          <stop offset="100%" stopColor="var(--color-ink-850)" />
        </linearGradient>
        <linearGradient id="dv-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.16" />
          <stop offset="45%" stopColor="white" stopOpacity="0.02" />
          <stop offset="100%" stopColor="white" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* monitor */}
      <rect x="14" y="10" width="130" height="82" rx="6" fill="url(#dv-metal)" />
      <rect x="18" y="14" width="122" height="74" rx="3.5" fill="url(#dv-screen)" />
      <rect x="18" y="14" width="122" height="74" rx="3.5" fill="url(#dv-glass)" />
      {/* on-screen glow + ui bars */}
      <rect x="25" y="22" width="46" height="4" rx="2" fill="var(--color-crimson-400)" opacity="0.85" />
      <rect x="25" y="31" width="70" height="3" rx="1.5" fill="var(--color-bone-300)" opacity="0.35" />
      <rect x="25" y="38" width="58" height="3" rx="1.5" fill="var(--color-bone-300)" opacity="0.22" />
      <rect x="25" y="52" width="30" height="26" rx="3" fill="var(--color-aura-500)" opacity="0.3" />
      <rect x="60" y="52" width="30" height="26" rx="3" fill="var(--color-crimson-500)" opacity="0.32" />
      <rect x="95" y="52" width="38" height="26" rx="3" fill="var(--color-bone-300)" opacity="0.12" />
      <rect x="25" y="82" width="20" height="2.5" rx="1.25" fill="var(--color-crimson-300)" opacity="0.6" />
      {/* screen sheen */}
      <path d="M18 60 L78 14 h20 L18 74 Z" fill="white" opacity="0.05" />
      {/* stand */}
      <path d="M74 92 h10 v10 h-10 z" fill="var(--color-ink-600)" />
      <path d="M56 102 h46 a4 4 0 0 1 4 4 v2 H52 v-2 a4 4 0 0 1 4-4 z" fill="url(#dv-metal)" />

      {/* tower */}
      <rect x="152" y="18" width="36" height="128" rx="5" fill="url(#dv-metal)" />
      <rect x="155" y="21" width="30" height="122" rx="3.5" fill="var(--color-ink-950)" opacity="0.9" />
      {/* intake fan */}
      <circle cx="170" cy="42" r="12" fill="none" stroke="var(--color-ink-500)" strokeWidth="1.6" />
      <circle cx="170" cy="42" r="4" fill="var(--color-crimson-500)" opacity="0.9" />
      <path
        d="M170 30 a12 12 0 0 1 10.4 6"
        stroke="var(--color-crimson-400)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* light strip */}
      <rect x="160" y="62" width="20" height="3" rx="1.5" fill="var(--color-aura-400)" opacity="0.9" />
      <rect x="160" y="68" width="20" height="3" rx="1.5" fill="var(--color-crimson-400)" opacity="0.7" />
      {/* front i/o */}
      <rect x="160" y="80" width="7" height="4" rx="2" fill="var(--color-ink-400)" />
      <rect x="171" y="80" width="7" height="4" rx="2" fill="var(--color-ink-400)" />
      <rect x="160" y="90" width="20" height="46" rx="3" fill="var(--color-ink-800)" opacity="0.85" />
      <path d="M164 96 h12 M164 102 h12 M164 108 h12" stroke="var(--color-ink-500)" strokeWidth="1.4" strokeLinecap="round" />

      {/* keyboard */}
      <rect x="26" y="128" width="112" height="30" rx="5" fill="url(#dv-metal)" />
      <rect x="30" y="132" width="104" height="22" rx="3" fill="var(--color-ink-900)" opacity="0.75" />
      {[0, 1, 2].map((row) =>
        Array.from({ length: 11 }).map((_, col) => (
          <rect
            key={`${row}-${col}`}
            x={34 + col * 9.2}
            y={135 + row * 6.4}
            width={7}
            height={4.6}
            rx="1.4"
            fill={
              row === 1 && col > 3 && col < 7
                ? 'var(--color-crimson-500)'
                : 'var(--color-ink-600)'
            }
            opacity={row === 1 && col > 3 && col < 7 ? 0.85 : 0.95}
          />
        )),
      )}
      {/* mouse */}
      <path
        d="M150 132 c0-6 4-9 8-9 s8 3 8 9 v12 c0 6-4 9-8 9 s-8-3-8-9 z"
        fill="url(#dv-metal)"
      />
      <path d="M158 124 v9" stroke="var(--color-ink-600)" strokeWidth="1.2" />
      <circle cx="158" cy="130" r="1.8" fill="var(--color-crimson-400)" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Phones — one drawing, an iPhone bezel or an Android bezel                   */
/* -------------------------------------------------------------------------- */

function PhoneArt({ variant }: { variant: 'iphone' | 'android' }) {
  const isIphone = variant === 'iphone';
  return (
    <svg viewBox="0 0 96 192" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`ph-screen-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-crimson-900)" />
          <stop offset="50%" stopColor="var(--color-ink-900)" />
          <stop offset="100%" stopColor="var(--color-aura-900)" />
        </linearGradient>
        <linearGradient id={`ph-frame-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-ink-400)" />
          <stop offset="40%" stopColor="var(--color-ink-600)" />
          <stop offset="100%" stopColor="var(--color-ink-800)" />
        </linearGradient>
        <linearGradient id={`ph-glass-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.18" />
          <stop offset="42%" stopColor="white" stopOpacity="0.02" />
          <stop offset="100%" stopColor="white" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* body */}
      <rect
        x="6"
        y="4"
        width="84"
        height="184"
        rx={isIphone ? 18 : 14}
        fill={`url(#ph-frame-${variant})`}
      />
      {/* screen */}
      <rect
        x="9.5"
        y="7.5"
        width="77"
        height="177"
        rx={isIphone ? 15 : 11}
        fill={`url(#ph-screen-${variant})`}
      />

      {/* wallpaper wash + sparkle */}
      <ellipse cx="60" cy="70" rx="34" ry="40" fill="var(--color-crimson-500)" opacity="0.2" />
      <ellipse cx="32" cy="128" rx="28" ry="34" fill="var(--color-aura-500)" opacity="0.18" />

      {/* status bar */}
      <rect x="16" y="16" width="10" height="3" rx="1.5" fill="var(--color-bone-200)" opacity="0.5" />
      <rect x="61" y="16" width="6" height="3" rx="1.5" fill="var(--color-bone-200)" opacity="0.5" />
      <rect x="70" y="16" width="10" height="3" rx="1.5" fill="var(--color-bone-200)" opacity="0.4" />

      {/* dynamic island (iPhone) or punch-hole camera (Android) */}
      {isIphone ? (
        <rect x="34" y="14" width="28" height="8" rx="4" fill="var(--color-ink-950)" />
      ) : (
        <circle cx="48" cy="18" r="3.2" fill="var(--color-ink-950)" />
      )}

      {/* app icon grid */}
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3].map((col) => {
          const highlight = row === 0 && col === 1;
          const second = row === 2 && col === 2;
          return (
            <rect
              key={`${row}-${col}`}
              x={17 + col * 16}
              y={32 + row * 20}
              width="12.5"
              height="12.5"
              rx="3.4"
              fill={
                highlight
                  ? 'var(--color-crimson-500)'
                  : second
                    ? 'var(--color-aura-500)'
                    : 'var(--color-bone-100)'
              }
              opacity={highlight ? 0.95 : second ? 0.75 : 0.18}
            />
          );
        }),
      )}

      {/* dock */}
      <rect x="19" y="114" width="58" height="17" rx="6" fill="var(--color-bone-100)" opacity="0.1" />
      {[0, 1, 2, 3].map((dockIndex) => (
        <rect
          key={dockIndex}
          x={23 + dockIndex * 14}
          y={118}
          width="11"
          height="11"
          rx="3"
          fill={dockIndex === 0 ? 'var(--color-crimson-400)' : 'var(--color-bone-100)'}
          opacity={dockIndex === 0 ? 0.8 : 0.28}
        />
      ))}

      {/* home indicator (iPhone) / nav bar (Android) */}
      {isIphone ? (
        <rect x="36" y="176" width="24" height="3" rx="1.5" fill="var(--color-bone-100)" opacity="0.55" />
      ) : (
        <>
          <path
            d="M40 177 l4 4 4-4"
            stroke="var(--color-bone-100)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
          <rect x="30" y="182" width="36" height="1.6" rx="0.8" fill="var(--color-bone-100)" opacity="0.4" />
        </>
      )}

      {/* glass reflection */}
      <path
        d="M9.5 110 L70 7.5 h17 L9.5 130 Z"
        fill={`url(#ph-glass-${variant})`}
        opacity="0.75"
      />

      {/* side buttons */}
      <rect x="4" y="44" width="2.4" height="12" rx="1.2" fill="var(--color-ink-500)" />
      <rect x="4" y="62" width="2.4" height="20" rx="1.2" fill="var(--color-ink-500)" />
      <rect x="89.6" y="56" width="2.4" height="26" rx="1.2" fill="var(--color-ink-500)" />

      {/* camera bump, back-facing hint on Android only */}
      {!isIphone ? (
        <circle cx="48" cy="168" r="2.2" fill="var(--color-ink-800)" opacity="0.7" />
      ) : null}
    </svg>
  );
}
