// Defaults for every page in src/content. Keeping layout and URLs here
// means the Markdown files only hold content that is edited in Pages CMS.
export default {
  layout: "page.njk",
  pageType: "page",
  eleventyComputed: {
    permalink: (data) => (data.page.fileSlug === "home" ? "/" : `/${data.page.fileSlug}/`),
  },
};
