# Adjoin

Marketing site for **Adjoin** — beautifully designed commercial spaces shared by a
curated group of complementary independent businesses. *Your space, without the whole lease.*

Two audiences are served: **independent businesses** looking for a home, and
**space partners / landlords** with underused commercial space to fill.

---

## Stack

- **Plain static site** — HTML, CSS and vanilla JavaScript. No build step, no dependencies.
- **Fonts:** Archivo (display), Inter (body), Space Mono (labels) via Google Fonts.
- **Hosting:** Netlify. **Forms:** Netlify Forms (no backend required).

Design direction: *Architectural Minimal* — white / graphite / stone, tight grotesk
typography, strict grid, hairline rules, a signature line-drawn floor plan.

---

## Project structure

```
.
├── index.html        # the whole site (single page, anchored sections)
├── styles.css        # design system + all styles
├── main.js           # nav, scroll reveals, business/partner toggle, form submit
├── success.html      # form thank-you page (no-JS fallback)
├── 404.html          # branded not-found page
├── assets/
│   └── favicon.svg    # brand mark / favicon
├── netlify.toml      # Netlify config + security headers
├── robots.txt
└── sitemap.xml
```

## Run locally

It's a static site, so any static server works:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the printed URL. (Netlify Forms only capture submissions on the deployed
Netlify site, not locally.)

## Deploy

Continuous deploy is wired to this GitHub repo. **Every push to `main` redeploys.**

```bash
git add -A
git commit -m "Update copy"
git push
```

Manual deploy (from the Netlify CLI, if ever needed):

```bash
netlify deploy --prod --dir .
```

## Enquiry form

The contact form uses **Netlify Forms**. Submissions appear in the Netlify dashboard
under **Forms → enquiry**. To get emailed on each submission, add a notification in
Netlify: *Site settings → Forms → Form notifications → Add notification → Email*.

A `role` hidden field records whether the enquiry is from a *business* or a
*space partner*, alongside the fields relevant to each.

## Editing content

Nearly all copy lives in `index.html` as plain text — edit in place. Colours,
type and spacing are CSS custom properties at the top of `styles.css` (`:root`).

## When you add a custom domain

A few values are hard-coded to the default `adjoin.netlify.app` subdomain and
should be updated to the real domain at cutover:

- `index.html` — the `<link rel="canonical">`, `og:url`, `og:image` and `twitter:image` URLs
- `sitemap.xml` — the `<loc>`
- `robots.txt` — the `Sitemap:` line

The social-share image lives at `assets/og.png` (1200×630). To refresh it, edit
`assets/og.svg`-style artwork or regenerate a 1200×630 PNG and replace the file.

---

© Adjoin. Contact: connect@careinmovement.com
