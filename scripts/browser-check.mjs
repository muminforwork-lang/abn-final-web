/**
 * ============================================================================
 *  BROWSER CHECK
 * ============================================================================
 *  Optional but worth running. It drives a real browser against the site and
 *  verifies the things unit tests cannot see: that the full-page layout really
 *  applies, that one scroll gesture moves exactly one page, that every section
 *  shows its character, and that the footer is reachable and clickable.
 *
 *  It also writes screenshots to .check-shots/ so you can look at every page
 *  without scrolling yourself.
 *
 *  HOW TO RUN
 *  ----------
 *  1. In one terminal:   npm run dev
 *  2. In another:        npm run check
 *
 *  It uses Microsoft Edge, which is already installed on Windows. If Edge is
 *  somewhere else, or you prefer Chrome, set the path:
 *
 *      set BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
 *      npm run check
 *
 *  On macOS or Linux, point it at any Chromium-based browser:
 *
 *      BROWSER_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run check
 *
 *  This is a development tool. It is not part of the deployed site and adds
 *  nothing to what visitors download.
 * ============================================================================
 */

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

const executablePath = CANDIDATES.find((candidate) => candidate && existsSync(candidate));
if (!executablePath) {
  console.error(
    'No Chromium-based browser found.\n' +
      'Set BROWSER_PATH to your browser executable, for example:\n' +
      '  set BROWSER_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\n' +
      'Then run npm run check again.',
  );
  process.exit(2);
}

const SHOTS = '.check-shots';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

console.log(`Using ${executablePath}`);
console.log(`Checking ${BASE}\n`);

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
} catch (error) {
  console.error(`Could not reach ${BASE}. Is "npm run dev" running?`);
  console.error(String(error));
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(1200);

/** Waits until page scrolling has genuinely stopped. */
async function settle() {
  await page.evaluate(async () => {
    const v = document.querySelector('[data-snap-viewport]');
    await new Promise((resolve) => {
      let last = -1;
      let stable = 0;
      const t0 = performance.now();
      const tick = () => {
        const top = Math.round(v.scrollTop);
        if (top === last) stable += 1;
        else stable = 0;
        last = top;
        if (stable > 8 || performance.now() - t0 > 3000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
  await page.waitForTimeout(200);
}

const pageIndex = () =>
  page.evaluate(() => {
    const v = document.querySelector('[data-snap-viewport]');
    return Math.round(v.scrollTop / v.clientHeight);
  });

/* ------------------------------------------------------------- layout */
const layout = await page.evaluate(() => {
  const html = document.documentElement;
  const viewport = document.querySelector('[data-snap-viewport]');
  const sections = [...document.querySelectorAll('[data-snap-section]')];
  return {
    snapType: viewport ? getComputedStyle(viewport).scrollSnapType : null,
    overflowY: viewport ? getComputedStyle(viewport).overflowY : null,
    htmlOverflow: getComputedStyle(html).overflow,
    sectionHeights: sections.map((s) => Math.round(s.getBoundingClientRect().height)),
    snapStop: sections[0] ? getComputedStyle(sections[0]).scrollSnapStop : null,
    footerSlot: (() => {
      const s = document.querySelector('[data-snap-footer-slot]');
      return s ? getComputedStyle(s).display : 'missing';
    })(),
    railDots: document.querySelectorAll('.page-rail__dot').length,
    characters: [...document.querySelectorAll('.page-art__img')].map(
      (img) => img.naturalWidth,
    ),
  };
});

check('page scrolling is handed to the section container', layout.snapType?.includes('y'), layout.snapType);
check('the container is scrollable', layout.overflowY === 'auto', layout.overflowY);
check('the window itself does not scroll', layout.htmlOverflow === 'hidden', layout.htmlOverflow);
check('one gesture cannot skip a section', layout.snapStop === 'always', layout.snapStop);
check('six full-page sections', layout.sectionHeights.length === 6, String(layout.sectionHeights.length));
check(
  'every section fills one screen',
  layout.sectionHeights.every((h) => h > 700 && h <= 900),
  layout.sectionHeights.join(','),
);
check('the page rail is rendered', layout.railDots === 6, String(layout.railDots));
check(
  'every element section loaded its character',
  layout.characters.length >= 5 && layout.characters.every((w) => w > 0),
  layout.characters.join(','),
);
check('the layout footer is hidden on the home page', layout.footerSlot === 'none', layout.footerSlot);

/* ------------------------------------------------- scrolling behaviour */
await page.keyboard.press('Home');
await settle();
const at0 = await pageIndex();

await page.mouse.move(700, 450);
await page.mouse.wheel(0, 140);
await settle();
const at1 = await pageIndex();
check('one wheel flick = one page', at1 - at0 === 1, `${at0} -> ${at1}`);

// A hard flick: 12 wheel events released 8 ms apart, with no other calls in
// between so the timings reflect a real trackpad/mouse burst rather than the
// round-trip cost of the automation API.
await page.mouse.move(700, 450);
const burst = await page.evaluate(async () => {
  const v = document.querySelector('[data-snap-viewport]');
  const before = Math.round(v.scrollTop / v.clientHeight);
  const times = [];
  for (let i = 0; i < 12; i += 1) {
    times.push(Math.round(performance.now()));
    v.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 8));
  }
  return { before, spanMs: times[times.length - 1] - times[0] };
});
await settle();
const afterBurst = await pageIndex();
check(
  'a hard 12-event flick still = one page',
  afterBurst - at1 === 1,
  `${at1} -> ${afterBurst}, burst spanned ${burst.spanMs}ms`,
);

await page.mouse.wheel(0, 140);
await settle();
const at3 = await pageIndex();
check('a second deliberate flick works', at3 - afterBurst === 1, `${afterBurst} -> ${at3}`);

await page.waitForTimeout(600);
await page.mouse.wheel(0, -140);
await settle();
const at4 = await pageIndex();
check('scrolling up moves back a page', at4 - at3 === -1, `${at3} -> ${at4}`);

const theme = await page.evaluate(() => document.documentElement.dataset.theme);
check('the colour theme changed while scrolling', theme !== 'electro', `theme=${theme}`);

const before = await pageIndex();
await page.keyboard.press('PageDown');
await settle();
const afterDown = await pageIndex();
check('PageDown moves one page', afterDown - before === 1, `${before} -> ${afterDown}`);

await page.keyboard.press('PageUp');
await settle();
const afterUp = await pageIndex();
check('PageUp moves back one page', afterUp - afterDown === -1, `${afterDown} -> ${afterUp}`);

/* ------------------------------------------------------ footer page */
for (let i = 0; i < 8; i += 1) {
  await page.keyboard.press('PageDown');
  await settle();
}
const footerState = await page.evaluate(() => {
  const footer = document.querySelector('.footer-page__footer');
  const rect = footer?.getBoundingClientRect();
  const v = document.querySelector('[data-snap-viewport]');
  return {
    exists: Boolean(footer),
    fullyVisible: rect ? rect.top >= 0 && rect.bottom <= window.innerHeight + 1 : false,
    index: Math.round(v.scrollTop / v.clientHeight),
  };
});
check('the footer is the last page', footerState.index === 5, `index=${footerState.index}`);
check('the whole footer is visible', footerState.exists && footerState.fullyVisible, JSON.stringify(footerState));

const clickable = await page.evaluate(() => {
  const footer = document.querySelector('.footer-page__footer');
  const link = [...footer.querySelectorAll('a')].find((a) => /Discord/i.test(a.textContent));
  if (!link) return { found: false };
  const r = link.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { found: true, clear: link.contains(top) || top === link };
});
check('footer links are not covered by artwork', clickable.found && clickable.clear, JSON.stringify(clickable));

/* ------------------------------------------------------ screenshots */
await page.keyboard.press('Home');
await settle();
const names = ['01-hero', '02-pc', '03-android', '04-ios', '05-catalog', '06-footer'];
for (let i = 0; i < names.length; i += 1) {
  if (i > 0) {
    await page.keyboard.press('PageDown');
    await settle();
  }
  await page.screenshot({ path: `${SHOTS}/${names[i]}.png` });
}

/* ------------------------------------------------ ordinary pages */
await page.goto(`${BASE}/android`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const other = await page.evaluate(() => ({
  htmlOverflow: getComputedStyle(document.documentElement).overflow,
  scrollable: document.body.scrollHeight > window.innerHeight,
  footerVisible: (() => {
    const s = document.querySelector('[data-snap-footer-slot]');
    return s ? getComputedStyle(s).display !== 'none' : false;
  })(),
}));
check('/android scrolls normally', other.htmlOverflow !== 'hidden' && other.scrollable, JSON.stringify(other));
check('/android shows its footer', other.footerVisible);

check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
console.log(`Screenshots of every page are in ./${SHOTS}/`);
if (failed.length) {
  console.log('\nFAILED:');
  for (const f of failed) console.log(`  - ${f.name} (${f.detail})`);
  process.exit(1);
}
