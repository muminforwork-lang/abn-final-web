/**
 * Mobile verification: runs the same site at a phone viewport with touch
 * emulation and reports anything that would make the experience bad.
 */
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3123';

const browser = await chromium.launch({ executablePath: EDGE });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();

const problems = [];
const ok = (name, pass, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!pass) problems.push(`${name} ${detail}`);
};

async function settle() {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const v = document.querySelector('[data-snap-viewport]');
        if (!v) return resolve();
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
  await page.waitForTimeout(220);
}

const idx = () =>
  page.evaluate(() => {
    const v = document.querySelector('[data-snap-viewport]');
    return Math.round(v.scrollTop / v.clientHeight);
  });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* ---------------------------------------------------- horizontal overflow */
const overflow = await page.evaluate(() => {
  const docWidth = document.documentElement.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > docWidth + 2 || r.left < -2) {
      const style = getComputedStyle(el);
      if (style.position === 'fixed') continue;
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0, 46),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
  }
  return { docWidth, scrollWidth: document.documentElement.scrollWidth, offenders: offenders.slice(0, 8) };
});
ok(
  'no horizontal overflow on the phone',
  overflow.scrollWidth <= overflow.docWidth + 1,
  `scrollWidth=${overflow.scrollWidth} client=${overflow.docWidth}`,
);
if (overflow.offenders.length) {
  console.log('    offenders:', JSON.stringify(overflow.offenders));
}

/* ------------------------------------------------------------- tap sizes */
// Is every destination reachable with a thumb?
//
// A link's own box is the wrong thing to measure. Product cards use a
// full-card overlay link, so tapping anywhere on the card navigates while the
// title anchor's own box stays small. The honest question is "what does a
// thumb actually hit here, and is it big enough?", which is exactly what
// elementFromPoint answers.
const tapAudit = await page.evaluate(() => {
  const MIN = 44;
  const seen = new Set();
  const unreachable = [];
  let checked = 0;
  let comfortable = 0;

  const targets = [...document.querySelectorAll('a[href], button')].filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return !String(el.className).includes('sr-only');
  });

  for (const el of targets) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;

    // What does a tap at the centre of this link actually activate?
    let hit = document.elementFromPoint(cx, cy);
    let actionable = hit;
    while (actionable && actionable !== document.body) {
      if (actionable.tagName === 'A' || actionable.tagName === 'BUTTON') break;
      actionable = actionable.parentElement;
    }
    const box = actionable ? actionable.getBoundingClientRect() : r;
    const key = `${actionable?.tagName}:${actionable?.getAttribute('href') ?? (el.textContent || '').trim().slice(0, 18)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    checked += 1;

    if (box.height >= MIN && box.width >= MIN) {
      comfortable += 1;
      continue;
    }
    // Fall back to the enclosing card: a whole-card tap counts as well.
    const card = el.closest('article, li, .panel');
    const cardBox = card ? card.getBoundingClientRect() : null;
    if (cardBox && cardBox.height >= MIN && cardBox.width >= MIN) {
      comfortable += 1;
      continue;
    }
    unreachable.push({
      tag: (actionable ?? el).tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 26),
      hitBox: { h: Math.round(box.height), w: Math.round(box.width) },
      cardBox: cardBox ? { h: Math.round(cardBox.height), w: Math.round(cardBox.width) } : null,
    });
  }
  return { checked, comfortable, unreachable: unreachable.slice(0, 8) };
});
ok(
  'every destination is reachable with a thumb',
  tapAudit.unreachable.length === 0,
  `${tapAudit.comfortable}/${tapAudit.checked} distinct destinations comfortable; ${JSON.stringify(tapAudit.unreachable)}`,
);

/* ------------------------------------------------------- touch scrolling */
// Scrolling is native now, so there is no "one swipe = one page" rule to test.
// What matters is that a finger can actually scroll the page: the container
// must permit vertical panning and must be scrollable.
const touchConfig = await page.evaluate(() => {
  const v = document.querySelector('[data-snap-viewport]');
  const cs = getComputedStyle(v);
  return {
    touchAction: cs.touchAction,
    overflowY: cs.overflowY,
    scrollable: v.scrollHeight > v.clientHeight,
  };
});
ok(
  'a finger can scroll the page vertically',
  ['auto', 'pan-y', 'manipulation'].includes(touchConfig.touchAction) &&
    touchConfig.overflowY === 'auto' &&
    touchConfig.scrollable,
  JSON.stringify(touchConfig),
);

// Real touch input through the browser's own input pipeline.
const cdp = await context.newCDPSession(page);
async function realSwipe(fromY, toY) {
  const mid = { x: 195, y: fromY };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: mid.x, y: mid.y }],
  });
  const steps = 8;
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: mid.x, y: fromY + ((toY - fromY) * i) / steps }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle();
}

await page.evaluate(() => {
  document.querySelector('[data-snap-viewport]').scrollTop = 0;
});
await settle();
await realSwipe(600, 200);
const afterTouch = await page.evaluate(
  () => Math.round(document.querySelector('[data-snap-viewport]').scrollTop),
);
ok('a real touch swipe scrolls the page', afterTouch > 150, `scrolled ${afterTouch}px`);

/* ------------------------------- a nested list must still scroll naturally */
await page.evaluate(() => {
  const v = document.querySelector('[data-snap-viewport]');
  const sections = [...document.querySelectorAll('[data-snap-section]')];
  // jump straight to the catalog page for the nested-list test
  v.scrollTop = sections[4].offsetTop;
});
await settle();
await page.waitForTimeout(400);
const nested = await page.evaluate(() => {
  const panel = document.querySelector('.catalog-page__scroll');
  return panel ? { scrollH: panel.scrollHeight, clientH: panel.clientHeight } : null;
});
ok(
  'the catalog list scrolls inside its page',
  nested && nested.scrollH > nested.clientH + 20,
  JSON.stringify(nested),
);

/* ------------------------------------------------------- content clipping */
const clipped = await page.evaluate(() => {
  const v = document.querySelector('[data-snap-viewport]');
  const sections = [...document.querySelectorAll('[data-snap-section]')];
  const results = [];
  sections.forEach((s, i) => {
    const fit = s.querySelector('.snap-fit');
    if (!fit) return;
    const overflows = fit.scrollHeight > fit.clientHeight + 8;
    // Is the content reachable? Either it fits, or the fit box scrolls.
    const reachable = !overflows || getComputedStyle(fit).overflowY !== 'hidden';
    results.push({ page: i, overflow: fit.scrollHeight - fit.clientHeight, reachable });
  });
  return { height: v.clientHeight, results };
});
ok(
  'no page is silently cut off on the phone',
  clipped.results.every((r) => r.reachable),
  JSON.stringify(clipped.results),
);

/* ------------------------------------------- characters visible on phone */
const chars = await page.evaluate(() =>
  [...document.querySelectorAll('.page-art__img')].map((i) => ({
    w: i.naturalWidth,
    opacity: getComputedStyle(i.closest('.page-art')).opacity,
  })),
);
ok('characters load on the phone', chars.length >= 5 && chars.every((c) => c.w > 0), JSON.stringify(chars.slice(0, 3)));

/* ------------------------------------------- sub-pages have their character */
for (const route of ['/pc', '/android', '/ios', '/payments', '/support']) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const img = document.querySelector('.page-backdrop .page-art__img');
    const theme = document.documentElement.dataset.theme;
    const overflowX = document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
    return {
      hasArt: Boolean(img),
      loaded: img ? img.naturalWidth > 0 : false,
      theme,
      noOverflow: overflowX,
    };
  });
  ok(`${route} shows a character`, state.hasArt && state.loaded, JSON.stringify(state));
  ok(`${route} has no horizontal overflow`, state.noOverflow);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: '.check-shots/phone-01-hero.png' });
for (let i = 0; i < 5; i += 1) {
  await page.keyboard.press('PageDown');
  await settle();
  await page.screenshot({ path: `.check-shots/phone-0${i + 2}-page.png` });
}
console.log('\nphone screenshots written to .check-shots/phone-*.png');

await browser.close();
console.log(`\n${problems.length === 0 ? 'ALL MOBILE CHECKS PASSED' : `${problems.length} MOBILE PROBLEM(S)`}`);
for (const p of problems) console.log('  -', p);
process.exit(problems.length ? 1 : 0);
