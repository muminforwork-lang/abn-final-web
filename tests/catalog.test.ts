/**
 * Catalogue integrity.
 *
 * The store takes real money, so these assert the data guarantees the UI
 * assumes: every product is reachable, every product is actually priced, and
 * the built-in catalogue validator reports nothing.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  getAllProducts,
  getAllSlugs,
  getProductsByPlatform,
  getStartingPrice,
  validateCatalog,
} from '../src/lib/catalog.ts';

describe('catalogue integrity', () => {
  it('has products to sell', () => {
    assert.ok(getAllProducts().length > 0, 'the catalogue must not be empty');
  });

  it('reports no validation problems', () => {
    assert.deepEqual(validateCatalog(), [], 'validateCatalog() should be clean');
  });

  it('gives every product a unique, URL-safe slug', () => {
    const slugs = getAllSlugs();
    assert.equal(new Set(slugs).size, slugs.length, 'duplicate slugs would collide as routes');
    for (const slug of slugs) {
      assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `"${slug}" is not URL-safe`);
    }
  });

  it('prices every duration, in at least one currency', () => {
    for (const product of getAllProducts()) {
      assert.ok(product.prices.length > 0, `${product.slug} has no prices`);
      for (const price of product.prices) {
        assert.ok(price.duration.trim().length > 0, `${product.slug} has an empty duration`);
        const hasPrice = typeof price.usd === 'number' || typeof price.bdt === 'number';
        assert.ok(hasPrice, `${product.slug} / ${price.duration} has no amount`);
        if (typeof price.usd === 'number') {
          assert.ok(price.usd > 0, `${product.slug} / ${price.duration} has a non-positive USD price`);
        }
        if (typeof price.bdt === 'number') {
          assert.ok(price.bdt > 0, `${product.slug} / ${price.duration} has a non-positive BDT price`);
        }
      }
    }
  });

  it('gives every product a name and a summary', () => {
    for (const product of getAllProducts()) {
      assert.ok(product.name.trim().length > 1, `${product.slug} has no name`);
      assert.ok(product.summary.trim().length > 0, `${product.slug} has no summary`);
    }
  });

  it('reports a starting price for every product', () => {
    for (const product of getAllProducts()) {
      const starting = getStartingPrice(product);
      assert.ok(starting, `${product.slug} has no starting price`);
      assert.ok(
        typeof starting.usd === 'number' || typeof starting.bdt === 'number',
        `${product.slug} starting price has no amount`,
      );
    }
  });

  it('covers all three platforms, which the front page depends on', () => {
    for (const platform of ['pc', 'android', 'ios'] as const) {
      assert.ok(
        getProductsByPlatform(platform).length > 0,
        `no products for platform "${platform}"`,
      );
    }
  });
});
