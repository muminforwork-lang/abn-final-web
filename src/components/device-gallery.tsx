'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { DeviceArt, type DeviceKind } from '@/components/device-art';
import { ArrowIcon, PricePair } from '@/components/ui';
import { DEVICE_PHOTO } from '@/data/devices';
import type { Product } from '@/data/products';
import { getStartingPrice } from '@/lib/catalog';

/* ==========================================================================
   Device gallery — the "product box" of each full-page character section.

   Left: an oversized device illustration that floats gently.
   Right: every real product in that platform as its own box, with the product
   name animating in one row at a time. Nothing here is decorative filler —
   each row is a live link to that product's page and its real price.
   ========================================================================== */

const KIND: Record<'pc' | 'android' | 'ios', DeviceKind> = {
  pc: 'pc',
  android: 'android',
  ios: 'iphone',
};

export function DeviceGallery({
  platform,
  products,
  priority = false,
}: {
  platform: 'pc' | 'android' | 'ios';
  products: Product[];
  priority?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Rows animate in when the gallery actually reaches the screen. The
  // observer stays attached so the sequence replays on every scroll back.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setShown(entry.isIntersecting && entry.intersectionRatio > 0.25),
      { threshold: [0, 0.25, 0.5] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const visible = products.slice(0, 6);

  return (
    <div
      ref={ref}
      data-visible={shown ? 'true' : 'false'}
      className="device-gallery"
    >
      <div className="device-gallery__art">
        <span aria-hidden="true" className="device-gallery__ring" />
        <span aria-hidden="true" className="device-gallery__ring device-gallery__ring--inner" />
        <DeviceArt
          kind={KIND[platform]}
          photo={DEVICE_PHOTO[platform]}
          priority={priority}
          className="device-gallery__device"
        />
        <span aria-hidden="true" className="device-gallery__reflection" />
      </div>

      <ul className="device-gallery__list" data-snap-scroll>
        {visible.map((product, index) => {
          const starting = getStartingPrice(product);
          return (
            <li
              key={product.slug}
              className="product-box"
              style={{ '--row': index } as React.CSSProperties}
            >
              <Link href={`/products/${product.slug}`} className="product-box__link">
                <span aria-hidden="true" className="product-box__mark">
                  <BrandMark platform={product.platform} className="h-6 w-6" />
                </span>

                <span className="product-box__body">
                  <span className="product-box__name">{product.name}</span>
                  <span className="product-box__meta">
                    {product.prices.length > 1
                      ? `${product.prices.length} durations`
                      : product.prices[0]?.duration ?? 'Single duration'}
                    {product.tags?.length ? ` · ${product.tags[0]}` : ''}
                  </span>
                </span>

                <span className="product-box__price">
                  {starting ? (
                    <PricePair usd={starting.usd} bdt={starting.bdt} className="text-sm" />
                  ) : null}
                  <span className="product-box__go" aria-hidden="true">
                    <ArrowIcon className="h-4 w-4" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
