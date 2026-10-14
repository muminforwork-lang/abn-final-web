import type { Platform } from '@/data/products';

/**
 * Section themes (inspired by the seven elements on the Genshin site).
 * The actual colours live in globals.css under html[data-theme='…'].
 */
export const THEMES = {
  anemo: { label: 'Anemo', glyph: '風' },
  geo: { label: 'Geo', glyph: '岩' },
  electro: { label: 'Electro', glyph: '雷' },
  dendro: { label: 'Dendro', glyph: '草' },
  hydro: { label: 'Hydro', glyph: '水' },
  pyro: { label: 'Pyro', glyph: '火' },
  cryo: { label: 'Cryo', glyph: '氷' },
} as const;

export type ThemeId = keyof typeof THEMES;

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = 'dendro';

export function isTheme(value: string | undefined): value is ThemeId {
  return !!value && value in THEMES;
}

/** Theme for each platform block on the home page. */
export const PLATFORM_THEME: Record<Platform, ThemeId> = {
  pc: 'dendro',
  android: 'cryo',
  ios: 'pyro',
};

/** Theme for pages that have no themed sections of their own. */
export function themeForPath(path: string): ThemeId {
  if (path.startsWith('/pc')) return 'electro';
  if (path.startsWith('/android')) return 'dendro';
  if (path.startsWith('/ios')) return 'cryo';
  if (path.startsWith('/payments')) return 'geo';
  if (path.startsWith('/products')) return 'hydro';
  if (path.startsWith('/support')) return 'anemo';
  return DEFAULT_THEME;
}
