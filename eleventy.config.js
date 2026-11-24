import { readFileSync } from "node:fs";
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";

const site = JSON.parse(readFileSync(new URL("./src/_data/site.json", import.meta.url)));

// Base URL used for canonical links, sitemap and schema.
// In GitHub Actions this comes from the Pages deployment (SITE_URL),
// otherwise it falls back to the live domain in src/_data/site.json.
const baseUrl = (process.env.SITE_URL || site.url).replace(/\/$/, "");
const absolute = (path = "/") => (/^https?:\/\//.test(path) ? path : baseUrl + (path.startsWith("/") ? path : `/${path}`));

export default function (eleventyConfig) {
  // Rewrites root-relative links (/about/) so the site also works at user.github.io/repo/
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets", "src/images": "images" });
  eleventyConfig.addGlobalData("build", { year: new Date().getFullYear() });

  // ---- Collections ----
  eleventyConfig.addCollection("services", (api) =>
    api.getFilteredByGlob("src/content/services/*.md").sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99))
  );
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/content/posts/*.md").filter((p) => !p.data.draft).sort((a, b) => b.date - a.date)
  );

  // ---- Filters ----
  eleventyConfig.addFilter("absoluteUrl", absolute);
  eleventyConfig.addFilter("head", (arr = [], n) => arr.slice(0, n));
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  );
  eleventyConfig.addFilter("telLink", (phone = "") => "tel:" + phone.replace(/[^\d+]/g, ""));
  eleventyConfig.addFilter("isCurrent", (navUrl, pageUrl) =>
    navUrl === "/" ? pageUrl === "/" : pageUrl.startsWith(navUrl)
  );

  // ---- Schema.org JSON-LD ----
  eleventyConfig.addShortcode("schema", function ({ page, site, title, description, date, pageType }) {
    const url = absolute(page.url);
    const businessId = absolute("/#business");
    const address = site.address || {};
    const sameAs = Object.values(site.social || {}).filter(Boolean);

    const business = {
      "@type": "LocalBusiness",
      "@id": businessId,
      name: site.name,
      url: absolute("/"),
      description: site.defaultDescription,
      ...(site.phone && { telephone: site.phone }),
      ...(site.email && { email: site.email }),
      ...(site.priceRange && { priceRange: site.priceRange }),
      ...(site.logo && { logo: absolute(site.logo), image: absolute(site.logo) }),
      ...(address.street && {
        address: {
          "@type": "PostalAddress",
          streetAddress: address.street,
          addressLocality: address.town,
          addressRegion: address.county,
          postalCode: address.postcode,
          addressCountry: "GB",
        },
      }),
      ...(site.areasServed?.length && { areaServed: site.areasServed.map((name) => ({ "@type": "Place", name })) }),
      ...(site.openingHours && { openingHours: site.openingHours }),
      ...(sameAs.length && { sameAs }),
    };

    const graph = [
      business,
      { "@type": "WebSite", "@id": absolute("/#website"), url: absolute("/"), name: site.name, publisher: { "@id": businessId } },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title || site.name,
        description,
        isPartOf: { "@id": absolute("/#website") },
        ...(page.url !== "/" && { breadcrumb: { "@id": `${url}#breadcrumb` } }),
      },
    ];

    if (pageType === "service") {
      graph.push({
        "@type": "Service",
        name: title,
        serviceType: title,
        description,
        url,
        provider: { "@id": businessId },
        ...(site.areasServed?.length && { areaServed: site.areasServed }),
      });
    }

    if (pageType === "post") {
      graph.push({
        "@type": "BlogPosting",
        headline: title,
        description,
        datePublished: new Date(date).toISOString(),
        dateModified: new Date(page.date || date).toISOString(),
        mainEntityOfPage: { "@id": `${url}#webpage` },
        author: { "@id": businessId },
        publisher: { "@id": businessId },
      });
    }

    if (page.url !== "/") {
      const crumbs = [{ name: "Home", url: absolute("/") }];
      if (pageType === "service") crumbs.push({ name: "Services", url: absolute("/services/") });
      if (pageType === "post") crumbs.push({ name: "Blog", url: absolute("/blog/") });
      crumbs.push({ name: title, url });
      graph.push({
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
      });
    }

    const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
    return `<script type="application/ld+json">${json}</script>`;
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    pathPrefix: process.env.PATH_PREFIX || "/",
    // Markdown is plain content edited in the CMS – don't run it through a template engine.
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
}
