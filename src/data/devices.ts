import type { Platform } from '@/data/products';

/**
 * ============================================================================
 *  DEVICE PHOTOS
 * ============================================================================
 *  Each full-page platform section shows a device: a desktop PC, an iPhone and
 *  an Android phone. By default those are ORIGINAL INLINE SVG DRAWINGS
 *  (src/components/device-art.tsx) — nothing downloaded, nothing copied, and
 *  they re-tint themselves to match the active element theme.
 *
 *  To show a real photograph instead, drop the file in public/art/devices/
 *  and set the path here. Full instructions: public/art/devices/README.md
 *
 *      pc: '/art/devices/pc.webp',
 *
 *  Leave a value as `undefined` to keep the drawn illustration for that
 *  platform. You can mix the two freely.
 *
 *  Sizing: the photo is fitted with `object-contain` inside a fixed
 *  aspect-ratio frame, so it is never cropped, stretched or squashed.
 * ============================================================================
 */

export const DEVICE_PHOTO: Record<Platform, string | undefined> = {
  pc: undefined,
  android: undefined,
  ios: undefined,
};
