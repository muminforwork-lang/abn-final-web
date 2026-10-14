# How to check this site locally

Everything below runs on your own PC. Nothing is uploaded and nothing is
published. Total time: about 5 minutes.

---

## 1. One-time setup

You need **Node.js 20.9 or newer** — download the LTS installer from
<https://nodejs.org> and accept the defaults. Then close and reopen your
terminal so `node -v` works.

```bash
cd path\to\abnormal
npm install
```

---

## 2. Start it and look at it

```bash
npm run dev
```

Open **http://localhost:3000**.

### The six things to check, in order

1. **The hero appears** with a character on the right, the headline
   "Seven worlds. One store.", three stat boxes, and a "Jump to a world" panel.
2. **Scroll once.** The page should **glide** to the next one — a smooth
   animated movement, not an instant jump. You land on the green PC page with
   its own character, and the whole page has changed colour.
3. **Scroll fast.** Flick hard several times. It should feel quick and fluid and
   still land cleanly on a page boundary — never stuck between two pages, never
   flying several pages ahead in one jump.
4. **Press Page Down, then Page Up.** Each press moves exactly one page.
5. **Keep scrolling to the end.** You pass Android (blue), iOS (red), the
   catalog (aqua, with search and filters), and reach the **footer on its own
   last page**. Six pages, six dots on the right.
6. **Click PC, Android or Payments in the top menu.** Each of those pages
   should now show **its own character artwork** behind the content — that was
   missing before.

Then open a product: click any product name in a platform page, or
**http://localhost:3000/products**, and check the prices look right.

### On your phone

Find your PC's local address (the terminal prints something like
`http://192.168.0.101:3000` under "Network"), open it on your phone on the same
Wi-Fi. Check that:

- a **swipe** turns a page, and the motion looks smooth
- the headline and paragraph are **fully readable** and nothing is cut off at
  the right edge
- the buttons are **full width** and comfortable to tap with a thumb
- product names and prices are readable
- the menu button (top right) opens the navigation

You can also run the phone checks from your PC, which uses a real phone-sized
viewport and touch emulation:

```bash
npm run check:mobile
```

---

## 3. Run the automated checks

These catch things your eyes will miss, and they save a screenshot of every
page so you can review the whole site without scrolling.

```bash
npm run check
```

It drives a real browser (Edge, which is already on your PC) against the site
and reports PASS/FAIL for 22 things — that one gesture moves one page, that
every page shows its character, that the footer is reachable and its links are
clickable, that the colours change, and that ordinary pages still scroll.

**Screenshots appear in `.check-shots/`** — one PNG per page. Open them; that is
the fastest way to see the whole site at once.

> `npm run check` needs `npm run dev` already running in another terminal.
> If it complains about the browser, point it at one:
> `set BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`

### Basic tests (no browser needed)

```bash
npm test
```

This builds the site and runs 49 unit tests covering the scroll rules, the page
structure and the catalogue data. It finishes with a pass/fail count.

---

## 4. What to tell me if something is wrong

The most useful thing you can send is **which of the five checks failed, and on
which page**. For example: "check 3 — a hard flick skipped from PC to iOS", or
"the catalog page's heading is cut off" (that one is fixed, but as an example).

If you can, also tell me:

- **Which browser** you used (Chrome, Edge, Firefox).
- **Mouse wheel or trackpad.** These behave differently.
- Whether it also happens **on your phone**.
- Whether `npm run check` passes — if it does, the problem is likely something
  the checks do not cover, which narrows it down a lot.

If `npm run check` fails, paste the FAIL lines. They include the measurements.

---

## 5. If the scroll feel is wrong

The responsiveness has one knob, in `src/lib/gesture.ts`:

```ts
export const GESTURE_WINDOW_MS = 650;  // gap that ends one gesture
export const MIN_MOVE_GAP_MS = 420;    // minimum time between two page moves
export const WHEEL_THRESHOLD = 24;     // scroll needed before a page turns
export const PAGE_DISTANCE = 220;      // distance that earns another page
export const SWIPE_MIN = 44;           // swipe distance on touch
```

- **Pages turn too eagerly** → raise `GESTURE_WINDOW_MS` and `PAGE_DISTANCE`.
- **Pages turn too slowly / need too much scrolling** → lower them.

The animation speed lives in `src/lib/use-snap-scroll.ts`:

```ts
const SMOOTHING = 7.4;   // higher settles faster; lower is more languid
```

- **The glide feels sluggish** → raise `SMOOTHING` (e.g. 9–10).
- **It feels too abrupt / not smooth enough** → lower it (e.g. 5–6).

After any change, run `npm test` (it asserts these rules) and `npm run check`.

---

## 6. When you are happy: deploy

Follow **[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)** — push to GitHub, import at
vercel.com/new, click Deploy. No environment variables, no database.

Before that, open `src/data/store.ts` and make sure the **payment numbers,
Discord and Telegram links are really yours**, and set `STORE_URL` to your
domain after the first deploy.
