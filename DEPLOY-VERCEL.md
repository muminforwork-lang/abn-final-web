# ABNORMAL — Deployment Guide (A to Z)

Everything below is the exact sequence to get this site live on Vercel with your
own domain. Nothing here needs a database, an API key, or a paid plan.

Total time: **about 20 minutes**, most of it waiting for downloads.

---

## 0. What you need

| Thing | Why | Cost |
| --- | --- | --- |
| **Node.js 20.9 or newer** | To run and build the site locally | Free |
| **A GitHub account** | Vercel deploys from a Git repository | Free |
| **Git** (or GitHub Desktop) | To push your folder to GitHub | Free |
| **A Vercel account** | Hosting | Free (Hobby plan is fine) |
| A domain *(optional)* | `abnormal-shop.com` instead of `*.vercel.app` | ~$10/year |

> **Note about Node:** this project was built and verified on Node 24.
> Download the LTS installer from <https://nodejs.org> and accept the defaults.
> After installing, close and reopen your terminal so `node -v` works.

---

## 1. Test it on your own PC first

Never deploy something you have not seen working locally.

```bash
cd path\to\abnormal
npm install
npm run dev
```

Open <http://localhost:3000>.

**Check these five things:**

1. The front page shows the hero. One scroll of the mouse wheel moves to exactly
   **one** new full-page section — it must never skip two.
2. The whole page colour palette changes as you move between sections
   (violet hero → green PC → blue Android → red iOS → aqua catalog).
3. The PC / Android / iOS pages each show a device illustration with the real
   product names animating in one row at a time.
4. Click a product name — it opens that product's page with its real prices.
5. The dots on the right edge jump to a page, and `/payments` and `/support`
   still work.

When that all looks right:

```bash
npm run build
```

It must finish with no red error text. (This exact build was verified: 38
routes, TypeScript clean.)

---

## 2. Put the project on GitHub

Vercel deploys from a repository, so the folder has to get to GitHub first.

### 2a. Create the empty repository

1. Sign in at <https://github.com>.
2. Click **+** (top right) → **New repository**.
3. Name it `abnormal` (or anything you like).
4. Leave it **Public** or set **Private** — Vercel works with both.
5. **Do not** tick "Add a README" / ".gitignore" / "license". The project already
   has its own.
6. Click **Create repository**. Leave that page open — you need the URL.

### 2b. Push your folder

In the project folder, run these commands one at a time.

```bash
git init
git add .
git commit -m "ABNORMAL store with full-page element scroll"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/abnormal.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

> **First push asks for a password?** GitHub stopped accepting account
> passwords. Create a token at **GitHub → Settings → Developer settings →
> Personal access tokens → Tokens (classic) → Generate new token**, tick
> **repo**, and paste the token where it asks for a password.

> **Prefer buttons to typing?** Install
> [GitHub Desktop](https://desktop.github.com/), choose **File → Add local
> repository**, pick your folder, then **Publish repository**.

**Check before you push:** the `.gitignore` already excludes `node_modules`,
`.next` and `out`, so you will not upload gigabytes. If you have real payment
screenshots or private notes anywhere in the folder, move them out first —
anything in the repo becomes public when you share the site.

---

## 3. Deploy to Vercel

1. Go to <https://vercel.com/signup> and **Continue with GitHub**. Authorise it.
2. On the dashboard click **Add New… → Project**.
3. Find your `abnormal` repository and click **Import**.
4. Vercel detects Next.js and fills everything in. **Change nothing** —
   no build command, no output directory, no environment variables.
5. Click **Deploy**.
6. Wait ~60 seconds. You get a URL like
   `https://abnormal-xxxx.vercel.app`.

Open it and run through the same five-point checklist from step 1.

### If the build fails

| Error mentions | Fix |
| --- | --- |
| `Node.js version` | Project → **Settings → General → Node.js Version** → pick **22.x** or **24.x** → **Redeploy**. |
| `Cannot find module` | You probably did not commit everything. Run `git status`, then `git add . && git commit -m "add files" && git push`. |
| `next: not found` | `node_modules` was committed but incomplete. Delete it locally, run `npm install`, commit and push again. |
| TypeScript error | Run `npm run typecheck` locally and fix what it reports before pushing. |

---

## 4. Point your real domain at it

Skip this if the `*.vercel.app` address is fine.

1. Buy a domain (Namecheap, Cloudflare, Porkbun, GoDaddy…).
2. In Vercel open your project → **Settings → Domains**.
3. Type your domain, e.g. `abnormalshop.com`, and click **Add**.
4. Vercel shows the DNS records you need. Add them where you bought the domain:
   - **Simplest:** change the domain's nameservers to the two Vercel gave you.
   - **Or:** add an `A` record to `76.76.21.21` for the root, and a `CNAME` to
     `cname.vercel-dns.com` for `www`.
5. Wait for DNS (5 minutes to a few hours). Vercel issues HTTPS automatically.

### Then update one line in the code

Open `src/data/store.ts` and set your real address:

```ts
export const STORE_URL = 'https://abnormalshop.com';
```

This is used for the SEO tags, the sitemap and the social-share preview.
Commit and push — Vercel redeploys by itself:

```bash
git add . && git commit -m "set real store URL" && git push
```

---

## 5. After that, every update is three commands

```bash
git add .
git commit -m "what you changed"
git push
```

Vercel rebuilds and publishes automatically in under a minute. There is no
upload step and no FTP.

> **Watch the first deploy preview.** Every push gets its own preview URL.
> Vercel shows it in the dashboard *before* it replaces your live site — great
> for checking a change on your phone first.

---

## 6. Pre-launch checklist

- [ ] `src/data/store.ts` — `STORE_NAME`, `STORE_TAGLINE`, `STORE_DESCRIPTION`
- [ ] `src/data/store.ts` — **all three payment numbers are yours and correct**
- [ ] `src/data/store.ts` — Discord / Telegram / WhatsApp links work
- [ ] `src/data/store.ts` — `STORE_URL` matches your live domain
- [ ] `src/data/products.ts` — every product name, duration and price is real
- [ ] You scrolled the whole front page on a **real phone**, not just a desktop
      window shrunk down
- [ ] Tapping a product name on the phone opens the right page
- [ ] You placed one real test order and received the confirmation text
- [ ] `npm run build` passes

> **Payments are manual.** The site never collects money itself. A customer
> copies the payment details, pays you directly, then submits the transaction
> ID. Verify every payment yourself before delivering. The site keeps no order
> history, so the confirmation text is the only record — tell customers to copy
> it before leaving the page.

---

## 7. Free and paid options

| Plan | Enough for | Notes |
| --- | --- | --- |
| Vercel **Hobby** | A shop like this | 100 GB bandwidth/month. Free. |
| Vercel **Pro** | Heavy traffic | $20/month. Adds analytics and more bandwidth. |
| Cloudflare Pages | If you prefer it | Run `npm run build:static` then upload the `out/` folder. |

For a catalogue with a few hundred visitors a day, the Hobby plan is plenty.
You will get an email long before you approach any limit.

---

## 8. Common questions

**Do I need a database?** No. The catalogue is compiled into the site at build
time. Orders go to you by chat, not to a server.

**Can I edit content without touching code?** Products can be added with
`add-product.bat` (Windows) — see `DEVICE-ART.md`'s sibling section in
`README.md`. Everything else is written directly in the TypeScript files.

**Will my images be optimised on Vercel?** Yes. `next/image` converts every
image to AVIF/WebP, resizes it for each screen, and caches it on Vercel's CDN —
automatically, with no work from you and no extra cost.

**What if I want to move off Vercel?** The project is a standard Next.js app.
Netlify, Cloudflare Pages and any Node host work, and
`npm run build:static` produces a plain static site you can put anywhere.

**How do I roll back a bad deploy?** Vercel dashboard → **Deployments** → find
the last good one → **⋯ → Promote to Production**. Instant, no rebuild.
