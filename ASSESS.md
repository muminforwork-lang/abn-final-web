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

### The five things to check, in order

1. **The hero appears** with a character on the right, the headline
   "Seven worlds. One store.", three stat boxes, and a "Jump to a world" panel.
2. **Scroll once** — one flick of the wheel or one swipe. You should land on the
   **green PC page with its own character**, and the whole page should have
   changed colour.
3. **Scroll fast** — flick hard several times in a row. Each flick should turn
   **exactly one page**. It must never skip past a page.
4. **Press Page Down, then Page Up.** Each press should move exactly one page.
5. **Keep scrolling to the end.** You should pass Android (blue), iOS (red),
   the catalog (aqua, with search and filters), and finally reach the **footer
   on its own last page**. There are 6 pages and 6 dots on the right.

Then open a product: click any product name in a platform page, or
**http://localhost:3000/products**, and check the prices look right. Also try
**/payments** and **/support**.

### On your phone

Find your PC's local address (the terminal prints something like
`http://192.168.0.101:3000` under "Network"), open it on your phone on the same
Wi-Fi, and check that a **swipe** moves one page and that you can reach the
bottom.

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
export const GESTURE_WINDOW_MS = 400;  // gap that ends one gesture
export const MIN_MOVE_GAP_MS = 500;    // minimum time between two page moves
export const WHEEL_THRESHOLD = 24;     // scroll needed before a page turns
export const SWIPE_MIN = 48;           // swipe distance on touch
```

- **Pages turn too slowly / need too much scrolling** → lower
  `WHEEL_THRESHOLD` (e.g. 12) and `GESTURE_WINDOW_MS` (e.g. 250).
- **Pages turn too eagerly** → raise them.
- **A flick occasionally turns two pages** → raise `MIN_MOVE_GAP_MS`.

After any change, run `npm test` (it asserts these rules) and `npm run check`.

---

## 6. When you are happy: deploy

Follow **[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)** — push to GitHub, import at
vercel.com/new, click Deploy. No environment variables, no database.

Before that, open `src/data/store.ts` and make sure the **payment numbers,
Discord and Telegram links are really yours**, and set `STORE_URL` to your
domain after the first deploy.
