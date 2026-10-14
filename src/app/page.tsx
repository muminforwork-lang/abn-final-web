import Link from 'next/link';
import type { Metadata } from 'next';

import { BrandMark } from '@/components/brand-mark';
import { CatalogExplorer } from '@/components/catalog-explorer';
import { DeviceGallery } from '@/components/device-gallery';
import { ArrowIcon, LinkButton, ShieldIcon, Stat } from '@/components/ui';
import { PAYMENT_METHODS, STORE_DESCRIPTION, STORE_NAME, STORE_TAGLINE } from '@/data/store';
import { PLATFORMS, type Platform } from '@/data/products';
import { getAllProducts, getCatalogStats, getProductsByPlatform } from '@/lib/catalog';
import { PLATFORM_THEME } from '@/lib/themes';
import { formatBdt, formatUsd } from '@/lib/format';

export const metadata: Metadata = {
  title: `${STORE_NAME} — ${STORE_TAGLINE}`,
  description: STORE_DESCRIPTION,
  alternates: { canonical: '/' },
};

/* ==========================================================================
   The immersive front page.
   ==========================================================================
   Every `<section data-snap-section>` below is exactly one screen tall and is
   one "page" for the scroll engine: one wheel flick, one swipe or one Page
   Down moves to the next one. `data-theme-section` is what makes the palette
   crossfade — the ThemeController watches it and rewrites <html data-theme>.
   ========================================================================== */

export default function HomePage() {
  const products = getAllProducts();
  const stats = getCatalogStats();
  const byPlatform: Record<Platform, ReturnType<typeof getProductsByPlatform>> = {
    pc: getProductsByPlatform('pc'),
    android: getProductsByPlatform('android'),
    ios: getProductsByPlatform('ios'),
  };
  const startPrice =
    typeof stats.lowestUsd === 'number'
      ? formatUsd(stats.lowestUsd)
      : typeof stats.lowestBdt === 'number'
        ? formatBdt(stats.lowestBdt)
        : '—';

  const totalPages = PLATFORMS.length + 2;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* 01 — Hero                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="home"
        data-snap-section
        data-theme-section="electro"
        className="snap-page hero-page"
        aria-labelledby="hero-title"
      >
        <div aria-hidden="true" className="hero-page__orbs">
          <span className="hero-orb hero-orb--a" />
          <span className="hero-orb hero-orb--b" />
          <span className="hero-orb hero-orb--c" />
        </div>

        <div className="snap-fit">
          <div className="snap-inner hero-page__inner">
            <div className="hero-page__copy">
              <span className="eyebrow rise-1">One screen per world</span>

              <h1 id="hero-title" className="hero-page__title">
                <span className="rise-2">Seven worlds.</span>
                <span className="rise-3 hero-page__title-accent">One store.</span>
              </h1>

              <p className="hero-page__lede rise-4">{STORE_DESCRIPTION}</p>

              <div className="hero-page__actions rise-5">
                <LinkButton href="#pc">
                  Enter the catalog
                  <ArrowIcon className="h-4 w-4" />
                </LinkButton>
                <LinkButton href="/products" variant="ghost">
                  Browse all {products.length} builds
                  <ArrowIcon className="h-4 w-4" />
                </LinkButton>
              </div>

              <div className="hero-page__stats rise-6">
                <Stat value={products.length} label="Live builds" />
                <Stat value={stats.durationLabels} label="Duration options" />
                <Stat value={startPrice} label="Starting from" />
              </div>
            </div>

            <div className="hero-page__rail rise-5">
              <span className="hero-page__rail-title">Jump to a world</span>
              <ul className="hero-page__elements">
                {PLATFORMS.map((platform) => (
                  <li key={platform.id}>
                    <Link href={`#${platform.id}`} className="hero-element">
                      <BrandMark platform={platform.id} className="h-5 w-5" />
                      <span className="hero-element__label">{platform.label}</span>
                      <span className="hero-element__count">{byPlatform[platform.id].length}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div aria-hidden="true" className="scroll-hint">
          <span className="scroll-hint__label">Scroll</span>
          <span className="scroll-hint__track">
            <span className="scroll-hint__thumb" />
          </span>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 02–04 — One full page per platform                                  */}
      {/* ------------------------------------------------------------------ */}
      {PLATFORMS.map((platform, position) => {
        const list = byPlatform[platform.id];
        return (
          <section
            key={platform.id}
            id={platform.id}
            data-snap-section
            data-theme-section={PLATFORM_THEME[platform.id]}
            className="snap-page platform-page"
            aria-labelledby={`${platform.id}-title`}
          >
            <div aria-hidden="true" className="platform-page__halo" />

            <div className="snap-fit">
              <div className="snap-inner platform-page__inner">
                <header className="platform-page__head">
                  <span className="platform-page__sigil" aria-hidden="true">
                    <BrandMark platform={platform.id} className="h-full w-full" />
                  </span>

                  <span className="eyebrow">
                    {platform.kanji} · {String(position + 2).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
                  </span>

                  <h2 id={`${platform.id}-title`} className="platform-page__title">
                    {platform.label}
                    <span className="platform-page__title-sub">{platform.blurb}</span>
                  </h2>

                  <p className="platform-page__intro">{platform.intro}</p>

                  <div className="platform-page__actions">
                    <LinkButton href={platform.href}>
                      All {list.length} {platform.label} builds
                      <ArrowIcon className="h-4 w-4" />
                    </LinkButton>
                    <LinkButton href="/payments" variant="ghost">
                      How to pay
                    </LinkButton>
                  </div>
                </header>

                <DeviceGallery platform={platform.id} products={list} priority={position === 0} />
              </div>
            </div>
          </section>
        );
      })}

      {/* ------------------------------------------------------------------ */}
      {/* 05 — Full catalog + payments                                        */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="catalog"
        data-snap-section
        data-theme-section="hydro"
        className="snap-page catalog-page"
        aria-labelledby="catalog-title"
      >
        <div className="snap-inner catalog-page__inner">
          <header className="catalog-page__head">
            <span className="eyebrow">Complete catalog</span>
            <h2 id="catalog-title" className="catalog-page__title">
              Every build, every duration, every price
            </h2>
            <p className="catalog-page__lede">
              Search by name, filter by platform and narrow by duration. Prices are shown in USD
              and BDT exactly as they appear on each product page.
            </p>
          </header>

          <div className="catalog-page__body">
            <div className="catalog-page__scroll" data-snap-scroll>
              <CatalogExplorer products={products} id="catalog-explorer" />
            </div>

            <aside className="catalog-page__pay">
              <h3 className="catalog-page__pay-title">Pay with bKash, Nagad or Binance</h3>
              <ul className="catalog-page__methods">
                {PAYMENT_METHODS.map((method) => (
                  <li key={method.id} className="catalog-method">
                    <span className="catalog-method__name">{method.name}</span>
                    <span className="catalog-method__value font-mono">{method.value}</span>
                  </li>
                ))}
              </ul>

              <p className="catalog-page__safe">
                <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>We never ask for your PIN, password, OTP or wallet private key.</span>
              </p>

              <div className="catalog-page__pay-actions">
                <LinkButton href="/payments" variant="ghost" className="w-full">
                  Full payment guide
                  <ArrowIcon className="h-4 w-4" />
                </LinkButton>
                <LinkButton href="/support" className="w-full">
                  Talk to support
                  <ArrowIcon className="h-4 w-4" />
                </LinkButton>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
