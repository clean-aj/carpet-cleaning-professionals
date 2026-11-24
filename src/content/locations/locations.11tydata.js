// Location pages keep the exact URLs from the previous site: the filename is the URL.
// e.g. src/content/locations/carpet-cleaning-reading.md → /carpet-cleaning-reading/
export default {
  layout: "location.njk",
  pageType: "location",
  eleventyComputed: {
    permalink: (data) => (data.draft ? false : `/${data.page.fileSlug}/`),
  },
};
