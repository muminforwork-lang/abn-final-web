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
2. **Scroll with the wheel.** This is the important one: the page must move
   **immediately**, exactly like a normal website. No delay, no resistance. You
   should reach the green PC page, which has its own character, and the whole
   page should have changed colour.
3. **Scroll fast.** Spin the wheel hard. The page must keep up and travel a long
   way — it should never feel stuck or refuse to move.
4. **Press Page Down, then Page Up.** Each press moves roughly one screen.
5. **Keep scrolling to the end.** You pass Android (blue), iOS (red), the
   catalog (aqua, with search and filters), and reach the **footer on its own
   last page**. Six dots on the right edge.
6. **Click PC, Android or Payments in the top menu.** Each of those pages
   should show **its own character artwork**, and a second character further
   down the page.

Then open a product: click any product name in a platform page, or
**http://localhost:3000/products**, and check the prices look right.

### On your phone

Find your PC's local address (the terminal prints something like
`http://192.168.0.101:3000` under "Network"), open it on your phone on the same
Wi-Fi. Check that:

- **swiping scrolls the page normally** and keeps up with your finger
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

Scrolling is native, so there is very little that can be wrong. The one setting
is the snap strength, in `src/app/globals.css`:

```css
scroll-snap-type: y proximity;   /* a resting place, not a wall */
```

- **Pages feel like they resist you / get stuck** → change to `none`. That
  removes snapping completely and leaves plain scrolling.
- **You want hard stops on each page** → change to `mandatory`. This is *not*
  recommended; mandatory snapping is what made earlier versions feel wrong.

After any change run `npm test` and `npm run check`.

## 6. When you are happy: deploy

Follow **[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)** — push to GitHub, import at
vercel.com/new, click Deploy. No environment variables, no database.

Before that, open `src/data/store.ts` and make sure the **payment numbers,
Discord and Telegram links are really yours**, and set `STORE_URL` to your
domain after the first deploy.
