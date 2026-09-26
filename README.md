# Adjoin

Marketing and demand-testing site for **Adjoin**: shared industrial space in Newcastle and the Hunter.
*Big unit. Small business. Share it.*

Static HTML, CSS and vanilla JS. No build step. Hosted on Netlify, enquiries via Netlify Forms.
See `PRODUCT.md` for positioning, voice and the visual system.

## Structure

```
index.html     single page: hero + lease splitter, problem, how it works, the space,
               who it's for, founding members, landlords, FAQ, enquiry form
styles.css     design tokens (:root) and all styles
main.js        nav, lease splitter, business/landlord form toggle, AJAX form submit
success.html   no-JS form thank-you page
404.html       not-found page
privacy.html   privacy note (Australian Privacy Principles)
assets/        favicon, OG image, touch icon, photos
netlify.toml   headers incl. Content-Security-Policy
```

## Run locally

```bash
npx serve .
# or
python3 -m http.server 8000
```

Netlify Forms only capture submissions on the deployed site.

## Deploy

Every push to `main` redeploys on Netlify.

## Enquiry form

Submissions land in Netlify under **Forms → enquiry**. A hidden `role` field records `business` or `partner`.
Business enquiries capture trade, suburb, space size, needs (`needs[]`), group size and optional budget,
which is your demand-testing data. Export it from Netlify as CSV to see where demand is clustering.
Add an email notification under *Site settings → Forms → Form notifications*.

## To do before launch

- **Email:** `hello@adjoin.com.au` is a placeholder. Search and replace across `index.html`,
  `main.js`, `privacy.html` and `success.html` once the domain and inbox exist.
- **Domain:** swap `adjoin.netlify.app` in `index.html` (canonical, og:url, og:image, twitter:image,
  JSON-LD), `privacy.html`, `sitemap.xml` and `robots.txt`.
- **Photos:** `assets/photos/` holds stock images, labelled on the page as illustrative. Replace with
  real site and member photos as soon as you have them, keeping the same file names and a 3:2 ratio.
