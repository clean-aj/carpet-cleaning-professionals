# Carpet Cleaning Professionals website

A static website built with [Eleventy](https://www.11ty.dev/), edited with [Pages CMS](https://pagescms.org/) and deployed to GitHub Pages.

## Run it locally

```bash
npm install
npm start        # http://localhost:8080, reloads when you save
npm run build    # builds the site into _site/
```

## Where things live

| What | Where |
|---|---|
| Page content (Markdown) | `src/content/` (`home.md`, `pages/`, `services/`, `posts/`, `locations/`) |
| Location pages (one per town) | `src/content/locations/` – the file name is the URL, e.g. `carpet-cleaning-reading.md` → `/carpet-cleaning-reading/` |
| Business details, menu, SEO defaults | `src/_data/site.json` |
| Templates | `src/_includes/` |
| Styles | `src/assets/styles.css` |
| Images uploaded in the CMS | `src/images/` |
| CMS setup | `.pages.yml` |
| Deployment | `.github/workflows/deploy.yml` |

## Location pages

- 140 town pages, each at the same URL as on the previous WordPress site, so rankings carry over when the domain moves.
- Add, edit or hide (Draft) locations in Pages CMS → **Locations**. The Areas page, footer, nearby-area links, sitemap and schema all update automatically.
- The copy was generated from a template. Adding genuinely local detail to the most important towns (recent jobs, local landmarks, testimonials) will help them rank.
- `scripts/generate-locations.mjs` created the pages and illustrations. Re-running it only creates missing files; `--force` overwrites everything, including CMS edits.

## Blog

- 118 posts in `src/content/posts/`, including 116 imported from the old WordPress site with `scripts/import-wordpress-posts.py`.
- Every post keeps its old URL at the site root (e.g. `/how-to-remove-odours-from-carpet/`). The file name is the URL: `2023-07-10-how-to-remove-odours-from-carpet.md`.
- The blog index is paginated, 12 posts per page (`/blog/`, `/blog/page/2/`…).
- Old WordPress page URLs (e.g. `/professional-sofa-cleaning/`) redirect to their new pages; see `src/_data/redirects.json`.

## Images

- Upload images in Pages CMS. Give each file a descriptive name **before** uploading (e.g. `sofa-cleaning-guildford-surrey.jpg`), and fill in the "Image description (alt text)" box with what is actually in the picture, plus the service and place.
- At build time every image is resized to 400/800/1200px and converted to WebP + JPEG, keeping its descriptive name (e.g. `carpet-cleaning-reading-berkshire-800w.webp`), with width/height and lazy loading added automatically.
- The current images are branded illustrations. Real photos of the team at work will perform better for both SEO and enquiries.

## Title case

All titles and headings use title case: first and last words capitalised, important words capitalised, short words (a, an, the, and, of, in, for…) lowercase, and the first word after a colon capitalised. After editing lots of content, run:

```bash
python3 scripts/titlecase.py
```

It fixes `title`, `metaTitle`, `heading` and `##` headings in every Markdown file.

## SEO features

- An SEO title and meta description for every page, editable in the CMS
- Canonical URLs, Open Graph and Twitter tags
- `sitemap.xml` and `robots.txt`, generated automatically
- Schema.org JSON-LD on every page: `LocalBusiness` (with all 140 areas served), `WebSite`, `WebPage`, `ImageObject` and `BreadcrumbList`, plus `Service` on service and location pages, `FAQPage` on location pages and `BlogPosting` on blog posts
- Visible breadcrumbs, clean URLs and internal links between services

## Deploying (GitHub Pages)

1. Push this repo to GitHub.
2. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Every push to `main` builds and publishes the site.
4. Custom domain: add it under Settings → Pages and point DNS at GitHub. The build picks up the domain automatically.

## Editing with Pages CMS

1. Go to https://app.pagescms.org and sign in with GitHub.
2. Choose this repository.
3. Edit the pages, services, blog posts and **Site settings**. Each save commits to `main`, and the site redeploys automatically.

## Before going live (TODO)

- [ ] Replace the placeholder phone number (`01632 960000`) and confirm the email address in **Site settings**
- [ ] Add the address, areas served and opening hours (they appear on the site and in the schema once filled in)
- [ ] Add a logo and social profile links
- [ ] Set a contact form endpoint (e.g. Formspree) so the quote form appears on the Contact page
- [ ] Review all copy and claims (insured, guarantee, drying times) to make sure they're accurate for the business
