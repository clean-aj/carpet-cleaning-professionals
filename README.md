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
| Page content (Markdown) | `src/content/` (`home.md`, `pages/`, `services/`, `posts/`) |
| Business details, menu, SEO defaults | `src/_data/site.json` |
| Templates | `src/_includes/` |
| Styles | `src/assets/styles.css` |
| Images uploaded in the CMS | `src/images/` |
| CMS setup | `.pages.yml` |
| Deployment | `.github/workflows/deploy.yml` |

## SEO features

- An SEO title and meta description for every page, editable in the CMS
- Canonical URLs, Open Graph and Twitter tags
- `sitemap.xml` and `robots.txt`, generated automatically
- Schema.org JSON-LD on every page: `LocalBusiness`, `WebSite`, `WebPage` and `BreadcrumbList`, plus `Service` on service pages and `BlogPosting` on blog posts
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
