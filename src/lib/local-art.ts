import fs from 'node:fs';
import path from 'node:path';
import { THEME_IDS, type ThemeId } from '@/lib/themes';

export type LocalArt = { url: string; mobileUrl?: string; artist?: string; link?: string };
export type LocalArtCollection = Partial<Record<ThemeId, LocalArt[]>>;

const EXTENSIONS = ['webp', 'avif', 'png', 'jpg', 'jpeg'] as const;
const EXT_RANK = new Map<string, number>(EXTENSIONS.map((ext, index) => [ext, index] as const));

type ArtFile = { stem: string; ext: string; order: number; rank: number };

/**
 * Discover locally bundled images only. Add more variants without touching code:
 *   anemo.png, anemo2.png, anemo3.png, electro2.png, cryo 2.webp, etc.
 * For smaller phone versions, optionally add matching files such as
 *   anemo.mobile.webp, anemo2.mobile.webp, electro2.mobile.webp.
 * No image provider, external image URL, or network request is used here.
 */
export function findLocalCharacters(): LocalArtCollection {
  const dir = path.join(process.cwd(), 'public', 'art', 'characters');
  let credits: Record<string, { artist?: string; link?: string }> = {};
  try {
    credits = JSON.parse(fs.readFileSync(path.join(dir, 'credits.json'), 'utf8'));
  } catch {
    // Credits are optional for local files.
  }

  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const found: LocalArtCollection = {};

  for (const theme of THEME_IDS) {
    // Match base filename and numbered variants. `.mobile.webp` is handled as
    // a responsive companion and must not become an independent artwork entry.
    const matcher = new RegExp(`^${theme}(?:[ -]?(\\d+))?\\.(webp|avif|png|jpg|jpeg)$`, 'i');
    const candidates: ArtFile[] = [];
    for (const filename of files) {
      const match = filename.match(matcher);
      if (!match) continue;
      const ext = match[2].toLowerCase();
      const number = match[1] ? Number(match[1]) : 1;
      if (!Number.isSafeInteger(number) || number < 1) continue;
      candidates.push({
        stem: filename.slice(0, filename.lastIndexOf('.')),
        ext,
        order: number,
        rank: EXT_RANK.get(ext) ?? 99,
      });
    }

    // Pick the preferred format for each numbered slot, with base and `1`
    // aliases treated as the same first slot, then order naturally by number.
    const bySlot = new Map<number, ArtFile>();
    for (const candidate of candidates) {
      const old = bySlot.get(candidate.order);
      if (!old || candidate.rank < old.rank || (candidate.rank === old.rank && candidate.stem.length < old.stem.length)) {
        bySlot.set(candidate.order, candidate);
      }
    }

    const variants: LocalArt[] = [...bySlot.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, file]) => {
        const mobileName = `${file.stem}.mobile.webp`;
        return {
          url: `/art/characters/${file.stem}.${file.ext}`,
          ...(fs.existsSync(path.join(dir, mobileName)) ? { mobileUrl: `/art/characters/${mobileName}` } : {}),
          ...(credits[file.stem] ?? credits[theme] ?? {}),
        };
      });

    if (variants.length > 0) found[theme] = variants;
  }

  return found;
}
