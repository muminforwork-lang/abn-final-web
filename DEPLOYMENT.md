# Deployment

ABNORMAL is a public Next.js catalogue and manual checkout flow. It does not use Firebase, Google sign-in, customer accounts, a customer database, wishlists or saved order history.

## Before publishing

1. Install Node.js 20.9 or newer.
2. Run `npm install` in the project directory.
3. Run `npm run build` and fix any reported build errors.
4. Open `src/data/store.ts` and verify the payment destinations, Discord URL and Telegram URL.
5. Verify products and prices in `src/data/products.ts` and `src/data/custom-products.json`.
6. Check the site on a desktop and a real phone before sending the public URL to customers.

## Vercel

1. Sign in at https://vercel.com/.
2. Import the project from GitHub, or upload/push it to a Git provider first.
3. Keep the standard Next.js build settings. The project does not need Firebase environment variables.
4. Deploy and open the generated URL.
5. Update `STORE_URL` in `src/data/store.ts` to your public domain and redeploy so SEO links use the correct site address.

## Manual order flow

Customers choose a product, duration and payment method, then enter the bKash/Nagad sender number and transaction ID, or the Binance transaction ID only. The app places those details in client-side React memory for the confirmation screen. It does not upload them to an API or store them in browser storage. Customers must copy the confirmation and send it with payment proof to Discord or Telegram themselves. Support should verify every payment manually before delivering a product.

Since no database is used, the site does not have an admin order queue, payment webhook, user accounts, or durable order history. Refreshing the confirmation page clears the details. Tell customers to copy the summary before leaving the page.

## Add products

On Windows, run `add-product.bat` and follow the prompts. The wizard appends entries to `src/data/custom-products.json`. Restart the dev server to preview local changes, then rebuild/redeploy to publish them.

## Phone performance

All character artwork is served from `public/art/characters`; no online anime-image providers or background-removal downloads are used. Keep the base files such as `anemo.png`, then add variants such as `anemo2.png`, `anemo3.png`, `electro2.png`, or `cryo 2.webp`. Optional phone versions can use matching names such as `anemo2.mobile.webp`. The site discovers the numbered variants and cycles through local images. Original fixed CSS themes stay tied to the active section and are not changed by artwork colour. After adding files, redeploy and check theme switching on desktop and mobile.
