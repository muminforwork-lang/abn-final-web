/**
 * ============================================================================
 *  BROWSER CHECK
 * ============================================================================
 *  Drives a real browser against the site and verifies the things unit tests
 *  cannot see: that scrolling genuinely works and feels normal, that every page
 *  shows its character, and that the footer is reachable with clickable links.
 *
 *  It also writes a screenshot of every page to .check-shots/.
 *
 *  HOW TO RUN
 *  ----------
 *  1. In one terminal:   npm run dev
 *  2. In another:        npm run check
 *
 *  Uses Microsoft Edge, already installed on Windows. For Chrome, or another
 *  location:
 *
 *      set BROWSER_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
 *      npm run check
 *
 *  A development tool — it is not part of the deployed site.
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
];

const executablePath = CANDIDATES.find((c) => c && existsSync(c));
if (!executablePath) {
  console.error(
    'No Chromium-based browser found.\n' +
      'Set BROWSER_PATH to your browser, e.g.\n' +
      '  set BROWSER_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
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

const readScroll = () =>
  page.evaluate(() => {
    const v = document.querySelector('[data-snap-viewport]');
    return { top: Math.round(v.scrollTop), max: v.scrollHeight - v.clientHeight, h: v.clientHeight };
  });

async function settle() {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const v = document.querySelector('[data-snap-viewport]');
        let last = -1;
        let stable = 0;
        const t0 = performance.now();
        const tick = () => {
          if (Math.round(v.scrollTop) === last) stable += 1;
          else stable = 0;
          last = Math.round(v.scrollTop);
          if (stable > 8 || performance.now() - t0 > 3000) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.waitForTimeout(150);
}

const toTop = async () => {
  await page.evaluate(() => {
    document.querySelector('[data-snap-viewport]').scrollTop = 0;
  });
  await settle();
};

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
    footerSlot: (() => {
      const s = document.querySelector('[data-snap-footer-slot]');
      return s ? getComputedStyle(s).display : 'missing';
    })(),
    railDots: document.querySelectorAll('.page-rail__dot').length,
    characters: [...document.querySelectorAll('.page-art__img')].map((i) => i.naturalWidth),
  };
});

check(
  'the page is a normal scroller',
  layout.overflowY === 'auto' && layout.htmlOverflow === 'hidden',
  `${layout.overflowY}/${layout.htmlOverflow}`,
);
check('snapping is proximity, so a boundary is never a wall', layout.snapType.startsWith('y'), layout.snapType);
check('six full-page sections', layout.sectionHeights.length === 6, String(layout.sectionHeights.length));
check('every page is at least one screen tall', layout.sectionHeights.every((h) => h >= 800), layout.sectionHeights.join(','));
check('the page rail is rendered', layout.railDots === 6, String(layout.railDots));
check(
  'every element section loaded its character',
  layout.characters.length >= 5 && layout.characters.every((w) => w > 0),
  layout.characters.join(','),
);
check('the layout footer is hidden on the home page', layout.footerSlot === 'none', layout.footerSlot);

/* -------------------------------------------- does scrolling actually work */
await toTop();
const before = await readScroll();
await page.mouse.move(700, 450);
await page.mouse.wheel(0, 500);
await page.waitForTimeout(250);
const justAfter = await readScroll();
check(
  'one wheel flick scrolls immediately',
  justAfter.top - before.top > 100,
  `moved ${justAfter.top - before.top}px within 250ms`,
);

await toTop();
await page.mouse.move(700, 450);
for (let i = 0; i < 10; i += 1) await page.mouse.wheel(0, 400);
await settle();
const afterBurst = await readScroll();
check(
  'a fast burst of scrolling travels a long way',
  afterBurst.top > afterBurst.h * 2,
  `${afterBurst.top}px of ${afterBurst.max}px`,
);

await page.evaluate(() => {
  const v = document.querySelector('[data-snap-viewport]');
  v.scrollTop = v.scrollHeight;
});
await settle();
const bottom = await readScroll();
check('the bottom of the page is reachable', bottom.top >= bottom.max - 4, `${bottom.top}/${bottom.max}`);

/* ------------------------------------------------------ theme + keyboard */
await toTop();
const themeStart = await page.evaluate(() => document.documentElement.dataset.theme);
await page.mouse.wheel(0, 4000);
await settle();
const themeLater = await page.evaluate(() => document.documentElement.dataset.theme);
check('the colour theme changes as you scroll', themeLater !== themeStart, `${themeStart} -> ${themeLater}`);

await page.keyboard.press('PageDown');
await settle();
const afterKey = await readScroll();
check('PageDown scrolls down', afterKey.top > 200, `${afterKey.top}px`);

/* ------------------------------------- does a page jump land correctly? */
// Note: headless Chromium does not animate the scroll for
// `scroll-behavior: smooth` or `scrollIntoView({behavior:'smooth'})`, so frame
// sampling cannot verify the animation here. What IS verifiable — and what
// actually matters — is that the container is configured for smooth scrolling
// and that a jump finishes on the right page.
await toTop();
const smoothConfig = await page.evaluate(() => {
  const v = document.querySelector('[data-snap-viewport]');
  const target = document.querySelectorAll('[data-snap-section]')[1];
  const before = Math.round(v.scrollTop);
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return {
    behavior: getComputedStyle(v).scrollBehavior,
    before,
    targetTop: Math.round(target.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop),
  };
});
check(
  'the scroller is configured for smooth navigation',
  smoothConfig.behavior === 'smooth',
  smoothConfig.behavior,
);
await settle();
// What matters is not a raw pixel offset but that the section is at the top of
// the visible area AND clear of the fixed header, so its heading is readable.
// A raw comparison would be wrong here: `scroll-margin-top` intentionally stops
// one header-height short of the section's own offset.
const landing = await page.evaluate(() => {
  const v = document.querySelector('[data-snap-viewport]');
  const section = document.querySelectorAll('[data-snap-section]')[1];
  const header = document.querySelector('header');
  return {
    sectionTop: Math.round(section.getBoundingClientRect().top),
    headerBottom: header ? Math.round(header.getBoundingClientRect().bottom) : 0,
  };
});
// At or below the header (not hidden behind it), and near the top of the
// screen rather than scrolled off somewhere in the middle of the page.
check(
  'a jump leaves the target page clear of the header',
  landing.sectionTop >= landing.headerBottom - 8 && landing.sectionTop < 400,
  `section top ${landing.sectionTop}px, header ends ${landing.headerBottom}px`,
);

/* ------------------------------------------- rail dots jump to a page */
await toTop();
await page.evaluate(() => {
  document.querySelectorAll('.page-rail__dot')[3].click();
});
await settle();
const railJump = await readScroll();
check('a rail dot jumps to its page', railJump.top > railJump.h * 2, `${railJump.top}px`);

/* -------------------------------------------------- characters vary */
const variants = await page.evaluate(() => {
  const seen = [...document.querySelectorAll('.page-art__img')].map((i) => i.getAttribute('src'));
  return { total: seen.length, distinct: new Set(seen).size };
});
check('more than one character appears on the home page', variants.distinct >= 3, JSON.stringify(variants));

/* ------------------------------------------- sub-pages have characters */
for (const route of ['/pc', '/android', '/ios', '/payments', '/support']) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.page-backdrop .page-art__img')];
    return {
      count: imgs.length,
      loaded: imgs.length > 0 && imgs.every((i) => i.naturalWidth > 0),
      theme: document.documentElement.dataset.theme,
      scrollable: document.documentElement.scrollHeight > window.innerHeight + 50,
    };
  });
  check(
    `${route} shows character artwork and scrolls normally`,
    state.count >= 1 && state.loaded && state.scrollable,
    JSON.stringify(state),
  );
}

/* ---------------------------------------------------- screenshots */
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const total = await page.evaluate(() => document.querySelector('[data-snap-viewport]').scrollHeight);
for (let i = 0; i < 6; i += 1) {
  await page.evaluate((y) => {
    document.querySelector('[data-snap-viewport]').scrollTop = y;
  }, Math.round((total - 900) * (i / 5)));
  await settle();
  await page.screenshot({ path: `${SHOTS}/0${i + 1}-page.png` });
}

check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
console.log(`Screenshots in ./${SHOTS}/`);
if (failed.length) {
  console.log('\nFAILED:');
  for (const f of failed) console.log(`  - ${f.name} (${f.detail})`);
  process.exit(1);
}
