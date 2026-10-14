/**
 * Structural checks on the built front page.
 *
 * These run against the HTML that `next build` actually prerendered
 * (.next/server/app/index.html) rather than a re-render of the component.
 * That is deliberately stricter: it verifies what a visitor and a search
 * engine really receive, after JSX, theming and the build have all had their
 * turn.
 *
 * `npm test` builds first, so the file is always fresh. If it is missing the
 * tests fail with a clear instruction rather than a confusing stack trace.
 */

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { getAllProducts } from '../src/lib/catalog.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const products = getAllProducts();

const CANDIDATES = [
  '.next/server/app/index.html',
  '.next/server/app/page.html',
  'out/index.html',
];

let html = '';

function locate() {
  for (const candidate of CANDIDATES) {
    const full = path.join(projectRoot, candidate);
    if (existsSync(full)) return full;
  }
  throw new Error(
    `No prerendered front page found. Run "npm run build" first.\nLooked for:\n  ${CANDIDATES.join('\n  ')}`,
  );
}

/** Counts non-overlapping occurrences of a literal string. */
const count = (needle: string): number => html.split(needle).length - 1;

before(() => {
  html = readFileSync(locate(), 'utf8');
});

describe('immersive front page structure', () => {
  it('renders substantial markup', () => {
    assert.ok(html.length > 20_000, `prerendered page looks too small (${html.length} bytes)`);
  });

  it('exposes exactly one scroll viewport for the engine to drive', () => {
    // Two would make "which element scrolls?" ambiguous.
    const mains = html.match(/<main[^>]*data-snap-viewport/g) ?? [];
    assert.equal(mains.length, 1, 'expected exactly one <main data-snap-viewport>');
  });

  it('renders one full-page section per element', () => {
    // hero + pc + android + ios + catalog
    const sections = html.match(/data-snap-section/g) ?? [];
    assert.ok(
      sections.length >= 5,
      `expected at least five full-page sections, found ${sections.length}`,
    );
  });

  it('attaches a theme to every full-page section', () => {
    const themes = [...html.matchAll(/data-theme-section="([a-z]+)"/g)].map((m) => m[1]);
    assert.ok(themes.length >= 5, `expected a theme per section, found ${themes.length}`);

    const valid = new Set(['anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo']);
    for (const theme of themes) {
      assert.ok(valid.has(theme), `unknown theme "${theme}"`);
    }
    assert.equal(new Set(themes).size, themes.length, `themes should be unique: ${themes.join(', ')}`);
  });

  it('gives every full-page section a unique id for the rail and anchors', () => {
    const tags = html.match(/<section[^>]*data-snap-section[^>]*>/g) ?? [];
    const ids = tags
      .map((tag) => /\sid="([^"]+)"/.exec(tag)?.[1])
      .filter((id) => Boolean(id));
    assert.equal(ids.length, tags.length, 'every full-page section needs an id');
    assert.equal(new Set(ids).size, ids.length, `duplicate section ids: ${ids.join(', ')}`);
  });

  it('includes every anchor the nav and hero link to', () => {
    for (const target of ['id="home"', 'id="pc"', 'id="android"', 'id="ios"', 'id="catalog"']) {
      assert.ok(html.includes(target), `missing anchor ${target}`);
    }
  });

  it('flags the document as immersive for the CSS to act on', () => {
    // The ScrollEngine sets this on the client; the markup must at least not
    // ship a conflicting value.
    assert.ok(!html.includes('data-immersive="false"'), 'immersive flag must not be baked in as false');
  });
});

describe('still a store page, not only a showcase', () => {
  it('has exactly one h1', () => {
    assert.equal(count('<h1'), 1, 'a page should have a single h1');
  });

  it('links only to products that actually exist', () => {
    // A product legitimately appears more than once (its platform gallery and
    // the full catalog), so repetition is expected. What must never happen is
    // a link to a slug that does not exist — that would be a dead product page.
    const known = new Set(products.map((product) => product.slug));
    const linked = [...html.matchAll(/href="\/products\/([a-z0-9-]+)"/g)].map((m) => m[1]);

    assert.ok(linked.length > 0, 'the page must link to products');
    for (const slug of new Set(linked)) {
      assert.ok(known.has(slug), `page links to unknown product "${slug}"`);
    }
  });

  it('links to every product in the catalogue', () => {
    // Nothing should become unreachable just because the front page changed.
    const linked = new Set(
      [...html.matchAll(/href="\/products\/([a-z0-9-]+)"/g)].map((m) => m[1]),
    );
    const missing = products.filter((product) => !linked.has(product.slug)).map((p) => p.slug);
    assert.deepEqual(missing, [], `products not reachable from the front page: ${missing.join(', ')}`);
  });

  it('keeps payments, support and the catalog reachable', () => {
    assert.ok(html.includes('href="/payments"'), 'payments route must stay linked');
    assert.ok(html.includes('href="/support"'), 'support route must stay linked');
    assert.ok(html.includes('href="/products"'), 'catalog route must stay linked');
  });

  it('shows the real payment destinations', () => {
    // These come from src/data/store.ts and must survive any redesign.
    for (const method of ['bKash', 'Nagad', 'Binance']) {
      assert.ok(html.includes(method), `${method} should be listed`);
    }
  });

  it('renders animated product boxes with real product names', () => {
    const names = [...html.matchAll(/class="product-box__name">([^<]+)</g)].map((m) => m[1].trim());
    assert.ok(names.length >= 10, `expected product boxes, found ${names.length}`);
    for (const name of names) {
      assert.ok(name.length > 1, 'a product box must show a real name');
    }
  });

  it('renders a device illustration for every platform', () => {
    for (const kind of ['type-pc', 'type-iphone', 'type-android']) {
      assert.ok(html.includes(kind), `missing the ${kind} illustration`);
    }
  });

  it('puts a character on EVERY full-page section', () => {
    // Regression: an earlier version mounted the characters in one fixed layer
    // with opacity 0 + loading="lazy". The browser never fetched them, so only
    // the first section showed a character and the rest looked empty.
    const wrappers = html.match(/class="page-art page-art--/g) ?? [];
    const images = html.match(/class="page-art__img"/g) ?? [];
    assert.ok(wrappers.length >= 5, `expected a character layer per section, found ${wrappers.length}`);
    assert.ok(images.length >= 5, `expected a character image per section, found ${images.length}`);
    assert.equal(
      wrappers.length,
      images.length,
      'every character layer must contain an actual image',
    );
  });

  it('never lazy-loads the character artwork', () => {
    // The fix for the missing characters. A lazy character image inside a
    // hidden layer is the bug; assert it stays eager.
    const lazy = html.match(/class="page-art__img"[^>]*loading="lazy"/g) ?? [];
    assert.equal(lazy.length, 0, 'character art must load eagerly, not lazily');

    const eager = html.match(/class="page-art__img"[^>]*loading="eager"/g) ?? [];
    const total = html.match(/class="page-art__img"/g) ?? [];
    assert.equal(eager.length, total.length, 'every character image should be eager');
  });

  it('gives each section a character image that really exists', () => {
    const sources = [...html.matchAll(/page-art__img"\s+src="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(sources.length >= 5, `expected character sources, found ${sources.length}`);
    for (const src of sources) {
      const file = path.join(projectRoot, 'public', src.replace(/^\//, ''));
      assert.ok(existsSync(file), `character image is missing from public/: ${src}`);
    }
    assert.equal(new Set(sources).size, sources.length, 'each section should show a different character');
  });

  it('renders the full catalogue explorer on the last page', () => {
    assert.ok(html.includes('catalog-explorer'), 'the catalog explorer should be present');
  });
});

describe('accessibility basics', () => {
  it('gives the device illustrations a text alternative', () => {
    for (const label of ['aria-label="Desktop PC"', 'aria-label="iPhone"', 'aria-label="Android phone"']) {
      assert.ok(html.includes(label), `missing ${label}`);
    }
  });

  it('hides decorative layers from assistive technology', () => {
    assert.ok(count('aria-hidden="true"') >= 3, 'decorative orbs and halos must be aria-hidden');
  });

  it('labels the full-page sections by their headings', () => {
    assert.ok(count('aria-labelledby=') >= 4, 'each full-page section should be labelled');
  });
});
