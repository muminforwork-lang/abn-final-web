# ABNORMAL Store

A public product catalogue for PC, Android and iOS builds. The site does **not** require Google login, create customer accounts, save wishlists, keep customer order history, or connect to a customer database.

## The full-page scroll experience

The front page is built as a sequence of **full-screen pages** — one per
element — and one gesture moves exactly one page:

| # | Section | Element theme | What it shows |
| --- | --- | --- | --- |
| 01 | Hero | Electro | Headline, live stats, jump links |
| 02 | PC | Dendro | PC illustration + every PC build |
| 03 | Android | Cryo | Android illustration + every Android build |
| 04 | iOS | Pyro | iPhone illustration + every iOS build |
| 05 | Catalog | Hydro | Search / filter / sort + payment details |

**One gesture, one page.** A mouse wheel flick, a trackpad swipe, a phone swipe
or a Page Down each advance exactly one section. It never free-scrolls past a
section and never skips two, because `src/lib/use-snap-scroll.ts` cancels the
browser's own wheel scrolling for the duration of the gesture and allows only
one move per gesture. Leftover trackpad momentum is absorbed by a short
cooldown after each landing.

**The palette follows you.** Every section carries `data-theme-section`, and
`ThemeController` rewrites `<html data-theme>` when a new section reaches the
middle of the screen. All colours in `globals.css` are defined per theme and
animated with `@property`, so the entire page re-tints smoothly rather than
cutting. Scroll from the violet hero to the green PC page and watch the
background, buttons, glow and character art all shift together.

**Ways to move**

- Mouse wheel, trackpad two-finger scroll
- Swipe up/down on any touch device
- <kbd>↓</kbd> <kbd>↑</kbd> <kbd>Page Down</kbd> <kbd>Page Up</kbd>
  <kbd>Space</kbd> <kbd>Home</kbd> <kbd>End</kbd>
- The page dots on the right edge
- Clicking a nav link or `#pc` / `#android` / `#ios` / `#catalog`

**It can never trap you.** Reduced-motion users get normal scrolling with no
snapping. Any inner list (the catalog grid, a long product list on a short
laptop) scrolls first and only hands the gesture back to page navigation once
it reaches its own edge. If a page's content is taller than a very short
screen, natural panning is restored there automatically.

### Where the pieces live

| File | Job |
| --- | --- |
| `src/lib/use-snap-scroll.ts` | The gesture engine — one gesture, one page |
| `src/components/scroll-engine.tsx` | Full-page character art, the page rail |
| `src/app/page.tsx` | The five full-page sections |
| `src/components/theme-controller.tsx` | Scroll-driven theme switching |
| `src/components/device-art.tsx` | Original SVG PC / iPhone / Android drawings |
| `src/components/device-gallery.tsx` | The device + animated product boxes |
| `src/components/brand-mark.tsx` | The per-platform sigils |

### Tuning the feel

At the top of `src/lib/use-snap-scroll.ts`:

```ts
const LOCK_MS = 880;        // how long one page transition takes
const GESTURE_IDLE_MS = 400; // gap that marks the end of one gesture
const COOLDOWN_MS = 220;    // momentum absorbed after each landing
const WHEEL_THRESHOLD = 24;  // scroll needed before a page turns
const SWIPE_THRESHOLD = 52;  // swipe distance on touch
```

Shorter `LOCK_MS` feels snappier; a bigger `WHEEL_THRESHOLD` needs a more
deliberate scroll before the page turns.

## Tests

```bash
npm test          # builds the site, then runs every test
npm run test:only # skips the build (faster while iterating)
```

No test framework to install — the suite uses Node's built-in test runner and
Node's TypeScript support, so `npm install` is still the only setup step.

| Suite | Covers |
| --- | --- |
| `tests/gesture.test.ts` | The scroll rules: one gesture = one page, momentum absorption, lock/cooldown, swipes |
| `tests/home-page.test.ts` | The **prerendered** front page: one viewport, five themed sections, unique ids, real product links, payment details, accessibility |
| `tests/catalog.test.ts` | Catalogue integrity: unique slugs, every duration priced, no validation problems |

`tests/home-page.test.ts` asserts against the HTML that `next build` actually
produced, not a re-render of the component, so it verifies what a visitor and a
search engine really receive. That is why `npm test` builds first.

The gesture rules live in `src/lib/gesture.ts` as pure functions, separate from
the DOM work in `use-snap-scroll.ts`, specifically so they can be tested with no
browser. The tests were checked against deliberate bugs — removing the
one-move-per-gesture rule, and giving two sections the same theme — to confirm
they genuinely fail when the behaviour breaks.

**What the tests cannot cover:** anything needing a real browser. The visual
feel of the scroll, the theme crossfade animation and touch behaviour on a
physical phone must still be checked by hand — see the checklist in
[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

## Run it on your PC

Requirements: Node.js 20.9 or newer.

1. Extract the project ZIP.
2. Open the extracted folder in File Explorer.
3. Click the address bar, type `cmd`, and press Enter.
4. Run:

   ```bat
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000` in your browser.

To make a production build, run `npm run build`.

## Orders and privacy

On a product page, choose a duration and payment method. After paying, enter the sender phone number for bKash/Nagad and the transaction ID/number. Binance requires only the transaction number/ID. The website prepares a confirmation summary that you can copy and send to Discord or Telegram with your payment screenshot.

**Important:** order information stays temporarily in page memory so the confirmation screen can show it. It is not uploaded to this website's server, stored in a customer account, or saved in browser storage. If the page is refreshed or the confirmation is left, the details are cleared. Copy the summary before leaving the confirmation page. Orders are not automatically sent to staff; you must submit the details and payment proof to support. Staff verify payment manually before delivery.

This keeps the website public and avoids collecting visitor account/order histories. The site still must serve its pages and images to visitors; the hosting provider may keep ordinary server access logs according to its own policy.

## Payment and support settings

Edit `src/data/store.ts` to change the public payment destinations and the Discord/Telegram URLs. Double-check all payment details before publishing. Values in this file are public and visible to website visitors; never put passwords or private keys here.

## Add a product with the Windows wizard

1. Double-click `add-product.bat`.
2. Enter the category (`PC`, `Android`, or `iOS`).
3. Enter the product name and summary.
4. Add each duration and the real USD and/or BDT price.
5. The wizard adds the product to `src/data/custom-products.json`.
6. Run `npm run dev` to preview it, or rebuild/redeploy the site to publish it online.

Example descriptions:

- **PC:** `Windows PC build with 1 Day and 1 Month access.`
- **Android:** `Android non-root build with 1 Day, 7 Days, or 30 Days access.`
- **iOS:** `iPhone and iPad build with 1 Day or 1 Month access.`

Node.js 20.9 or newer is required for the wizard. Prices must be real amounts you intend to charge.

## Local character artwork and colour themes

All character images are served from `public/art/characters`. The website makes no external anime-image API requests and does not download pictures during install, development, or deployment. Its fixed CSS colour themes remain tied to the active section; character colours never recolour the whole page.

The existing first image for each theme can stay named `anemo.png`, `electro.png`, `dendro.png`, `cryo.png`, `pyro.png`, `hydro.png`, or `geo.png` (WebP, AVIF, JPG and JPEG are also supported). Add as many extra variants as you like using names such as `anemo2.png`, `anemo3.png`, `anemo4.png`, `electro2.png`, or `cryo 2.webp`. The website discovers them automatically, prefers a compact modern format when equivalent versions exist, and rotates through the available local variants. For an optional phone-sized transparent version, use a matching name such as `anemo.mobile.webp` or `anemo2.mobile.webp`.

Keep character files in this folder and redeploy after adding them. Transparent PNG/WebP cut-outs look best; CSS alone cannot remove an opaque image's background.

On the immersive front page one character file per element is chosen at random
for the visit and crossfaded in when that element's page becomes active, with
the next pages preloaded so a scroll never reveals an empty stage. The drawn
PC / iPhone / Android devices work the same way — see
`public/art/devices/README.md` to swap in your own photographs.

## Deploy

Step-by-step instructions, including GitHub, Vercel, a custom domain and a
pre-launch checklist, are in **[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)**.

Short version: push the folder to GitHub, import it at
<https://vercel.com/new>, and click Deploy. No environment variables, no
database and no API keys are needed. After the first deploy, `git push` is all
it takes to publish a change.

