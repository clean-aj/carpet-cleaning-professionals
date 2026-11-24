// Blog posts live at the site root, e.g. /how-to-remove-odours-from-carpet/,
// matching the URLs of the previous WordPress site.
export default {
  layout: "post.njk",
  pageType: "post",
  eleventyComputed: {
    permalink: (data) => (data.draft ? false : `/${data.page.fileSlug}/`),
  },
};
