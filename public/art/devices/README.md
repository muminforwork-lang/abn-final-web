# Device artwork — putting your real PC / iPhone / Android photos in

The three full-page sections currently draw their device with **original inline
SVG** (`src/components/device-art.tsx`). Nothing is downloaded and nothing is
copied — those shapes are drawn in code, and they re-colour themselves from the
active element theme.

If you would rather show a real photograph, you do not need to touch any of
that drawing code. Drop a file in this folder and uncomment one line.

---

## Step 1 — add your photo

Put the file in this folder (`public/art/devices/`) using any of these names:

```
public/art/devices/pc.webp        ←  the desktop PC photo
public/art/devices/iphone.webp    ←  the iPhone photo
public/art/devices/android.webp   ←  the Android phone photo
```

`.png`, `.jpg`, `.jpeg` and `.avif` also work — `.webp` is just smallest.

**What makes a good photo**

- **Transparent background** (cut-out PNG/WebP) looks by far the best, because
  the character art and theme glow show through behind the device.
- If it has a solid background, that is fine too — the frame will size it
  neatly, it just looks less integrated.
- Shoot or export at **around 1200 px wide**. `next/image` resizes it for every
  screen automatically, so there is no benefit to sending a 6000 px original.
- Portrait for phones, landscape-ish for the PC.

> No cut-outs yet, or not sure? **Leave it as it is.** The drawn devices already
> look sharp at every size, match each theme exactly, and add zero download
> weight.

---

## Step 2 — uncomment one line

Open `src/data/devices.ts`, find the platform, and uncomment the `photo` line:

```ts
export const DEVICE_PHOTO: Record<Platform, string | undefined> = {
  pc: '/art/devices/pc.webp',        // ← remove the // at the start
  android: undefined,
  ios: undefined,
};
```

Do them one at a time and check the result, so you always know which change did
what.

---

## Step 3 — see it

```bash
npm run dev
```

Open <http://localhost:3000> and scroll to that platform's section. To publish:

```bash
git add . && git commit -m "add real device photos" && git push
```

Vercel redeploys automatically — see `DEPLOY-VERCEL.md`.

---

## How the sizing works

Each illustration sits in a fixed aspect-ratio frame so the page layout never
jumps when an image loads, and the photo is fitted with `object-contain` so
**your image is never cropped or stretched**. Phone art renders narrower than
PC art, matching the real proportions of the hardware.

## Reverting

Set the value back to `undefined`. The drawn illustration returns immediately —
the drawing code was never removed.
