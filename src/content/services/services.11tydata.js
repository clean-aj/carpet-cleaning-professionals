export default {
  layout: "service.njk",
  pageType: "service",
  eleventyComputed: {
    permalink: (data) => `/services/${data.page.fileSlug}/`,
  },
};
