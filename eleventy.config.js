import { readFileSync } from "node:fs";
import path from "node:path";
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";

const site = JSON.parse(readFileSync(new URL("./src/_data/site.json", import.meta.url)));

// Base URL used for canonical links, sitemap and schema.
// In GitHub Actions this comes from the Pages deployment (SITE_URL),
// otherwise it falls back to the live domain in src/_data/site.json.
const baseUrl = (process.env.SITE_URL || site.url).replace(/\/$/, "");
const absolute = (p = "/") => (/^https?:\/\//.test(p) ? p : baseUrl + (p.startsWith("/") ? p : `/${p}`));
const slug = (s = "") => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const featuredFirst = (a, b) => (b.data.featured ? 1 : 0) - (a.data.featured ? 1 : 0) || (a.data.town || "").localeCompare(b.data.town || "");

// Group location pages by region, in the order set in site.json → regions
function groupByRegion(locations = []) {
  const order = site.regions || [];
  const groups = new Map();
  for (const loc of locations) {
    const r = loc.data.region || "Other";
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(loc);
  }
  for (const items of groups.values()) items.sort(featuredFirst);
  return [...groups.entries()]
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b))
    .map(([region, items]) => ({ region, slug: slug(region), items }));
}

export default function (eleventyConfig) {
  // Rewrites root-relative links (/about/) so the site also works at user.github.io/repo/
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  // Every <img> in the output is resized and converted to WebP + JPEG automatically.
  // Output files keep the descriptive source filename, e.g. carpet-cleaning-reading-berkshire-800w.webp
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp", "jpeg"],
    widths: [400, 800, 1200],
    urlPath: "/img/",
    outputDir: "./_site/img/",
    filenameFormat: (id, src, width, format) => `${path.parse(src).name}-${width}w.${format}`,
    sharpJpegOptions: { quality: 78, progressive: true },
    sharpWebpOptions: { quality: 75 },
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async", sizes: "(min-width: 1120px) 760px, 100vw" },
    },
  });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets", "src/images": "images" });
  eleventyConfig.addGlobalData("build", { year: new Date().getFullYear() });

  // ---- Collections ----
  eleventyConfig.addCollection("services", (api) =>
    api.getFilteredByGlob("src/content/services/*.md").sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99))
  );
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/content/posts/*.md").filter((p) => !p.data.draft).sort((a, b) => b.date - a.date)
  );
  eleventyConfig.addCollection("locations", (api) =>
    api.getFilteredByGlob("src/content/locations/*.md").filter((p) => !p.data.draft)
      .sort((a, b) => (a.data.town || "").localeCompare(b.data.town || ""))
  );

  // ---- Filters ----
  eleventyConfig.addFilter("absoluteUrl", absolute);
  eleventyConfig.addFilter("slug", slug);
  eleventyConfig.addFilter("groupByRegion", groupByRegion);
  eleventyConfig.addFilter("inRegion", (locations = [], region, exceptUrl) =>
    locations.filter((l) => l.data.region === region && l.url !== exceptUrl).sort(featuredFirst)
  );
  eleventyConfig.addFilter("featured", (locations = []) => locations.filter((l) => l.data.featured));
  eleventyConfig.addFilter("head", (arr = [], n) => arr.slice(0, n));
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  );
  eleventyConfig.addFilter("telLink", (phone = "") => "tel:" + phone.replace(/[^\d+]/g, ""));
  eleventyConfig.addFilter("isCurrent", (navUrl, pageUrl, pageType) =>
    navUrl === "/" ? pageUrl === "/" : pageUrl.startsWith(navUrl) || (navUrl === "/areas/" && pageType === "location")
  );
  eleventyConfig.addFilter("placeLabel", (d = {}) =>
    !d.county || d.county === d.town || (d.town === "London" && d.county === "London") ? d.town : `${d.town}, ${d.county}`
  );

  // ---- Schema.org JSON-LD ----
  eleventyConfig.addShortcode("schema", function (d) {
    const { page, title, description, date, pageType, image, imageAlt, locations = [] } = d;
    const url = absolute(page.url);
    const businessId = absolute("/#business");
    const address = site.address || {};
    const sameAs = Object.values(site.social || {}).filter(Boolean);
    const regions = [...new Set(locations.map((l) => l.data.region).filter(Boolean))];
    const placeOf = (x) => ({
      "@type": x.town === x.county ? "AdministrativeArea" : "City",
      name: x.town,
      ...(x.county && x.county !== x.town && { containedInPlace: { "@type": "AdministrativeArea", name: x.county } }),
      ...(x.wikipedia && { sameAs: x.wikipedia }),
    });

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
      ...(locations.length && { areaServed: locations.map((l) => placeOf(l.data)) }),
      ...(site.openingHours && { openingHours: site.openingHours }),
      ...(sameAs.length && { sameAs }),
    };

    const imageObj = image && {
      "@type": "ImageObject",
      "@id": `${url}#primaryimage`,
      url: absolute(image),
      contentUrl: absolute(image),
      width: 1200,
      height: 630,
      ...(imageAlt && { caption: imageAlt }),
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
        inLanguage: "en-GB",
        isPartOf: { "@id": absolute("/#website") },
        ...(imageObj && { primaryImageOfPage: { "@id": imageObj["@id"] } }),
        ...(page.url !== "/" && { breadcrumb: { "@id": `${url}#breadcrumb` } }),
      },
    ];
    if (imageObj) graph.push(imageObj);

    if (pageType === "service") {
      graph.push({
        "@type": "Service",
        name: title,
        serviceType: title,
        description,
        url,
        provider: { "@id": businessId },
        ...(imageObj && { image: { "@id": imageObj["@id"] } }),
        ...(regions.length && { areaServed: regions.map((name) => ({ "@type": "AdministrativeArea", name })) }),
      });
    }

    if (pageType === "location") {
      graph.push({
        "@type": "Service",
        name: title,
        serviceType: "Carpet cleaning",
        description,
        url,
        provider: { "@id": businessId },
        areaServed: placeOf(d),
        ...(imageObj && { image: { "@id": imageObj["@id"] } }),
      });
    }

    if (d.faqs?.length) {
      graph.push({
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: d.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
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
        ...(imageObj && { image: { "@id": imageObj["@id"] } }),
      });
    }

    if (page.url !== "/") {
      const crumbs = [{ name: "Home", url: absolute("/") }];
      if (pageType === "service") crumbs.push({ name: "Services", url: absolute("/services/") });
      if (pageType === "post") crumbs.push({ name: "Blog", url: absolute("/blog/") });
      if (pageType === "location") crumbs.push({ name: "Areas We Cover", url: absolute("/areas/") });
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
