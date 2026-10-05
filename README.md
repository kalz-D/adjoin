# Adjoin

Marketing and demand-testing site for **Adjoin**: collaborative spaces in Newcastle and the Hunter,
plus a private members area where people looking for space make a profile and meet their circle.

Static HTML, CSS and vanilla JS in `public/`, and one Netlify Function for the members API.
Member data lives in Netlify Blobs, so there's no separate database or auth service to sign up for.
See `PRODUCT.md` for positioning, voice and the visual system.

## Structure

```
public/                 everything that's published
  index.html            the marketing site
  styles.css, main.js   site styles and interactions
  members/              the members area (sign in, circle, profile, your profile, admin)
  privacy.html, success.html, 404.html, assets/
netlify/functions/api.mts   the members API, served at /api/*
netlify/lib/                auth, profiles, storage and example profiles used by the API
netlify.toml                publish dir, functions dir, security headers
```

## Members area

- **Accounts:** email and password. Passwords are hashed with scrypt; sessions are HttpOnly cookies.
- **Profiles:** a hero photo plus up to three more, the basics, kind of work, a headline, an about,
  and what they're looking for. Photos are resized in the browser before upload.
- **Approval:** new profiles wait for review. Members only see each other once an admin welcomes them in.
- **Your circle:** up to five live profiles at a time in the member's kind of work, nearest suburb first.
- **Introductions:** members ask Adjoin to introduce them; requests appear on the admin page.
- **Admin** (`/members/admin.html`): welcome in or hide profiles, see introduction requests, and create a
  temporary password for anyone who's forgotten theirs.
- **Example profiles** show on previews and local dev so the design can be reviewed. Never on the live site.

### Settings (Netlify: Project configuration → Environment variables)

| Variable | What it does |
| --- | --- |
| `ADJOIN_ADMIN_EMAILS` | Comma-separated emails that get the admin page. Sign up with one of these. |
| `ADJOIN_EXAMPLES` | Optional. `on` shows example profiles anywhere, `off` hides them everywhere. |

Live data is kept in site-wide stores. Previews and local dev use throwaway deploy-scoped stores.

## Run locally

```bash
npm install
cp .env.example .env
netlify dev
```

Then open http://localhost:8888. Sign up with `admin@adjoin.test` to get the admin page locally.

```bash
npm run typecheck
```

## Deploy

The Netlify project isn't linked to this repo, so pushing to `main` doesn't deploy. Deploy with:

```bash
netlify deploy --prod --dir public --functions netlify/functions --site 52cab672-6997-4a15-89d3-3ed9d0b1117c
```

Drop `--prod` for a private preview link. To deploy on every push instead, link the repo in Netlify under
Build & deploy (build command empty, publish directory `public`).

## Enquiry form

Submissions land in Netlify under **Forms → enquiry** once Netlify Forms is enabled for the project.
A hidden `role` field records `business` or `partner`, and `work_type` records studio, service or workshop.

## To do before launch

- **Email:** `hello@adjoin.com.au` is a placeholder. Search and replace across `public/` once the inbox exists.
- **Domain:** swap `adjoin.netlify.app` in `public/index.html`, `public/privacy.html`, `public/sitemap.xml`
  and `public/robots.txt`.
- **Photos:** `public/assets/photos/` holds stock images, labelled on the page as illustrative.
- **Password resets by email:** there's no email service yet, so admins reset passwords from the admin page.
