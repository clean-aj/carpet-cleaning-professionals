export default {
  layout: "post.njk",
  pageType: "post",
  eleventyComputed: {
    // Drafts are built nowhere and left out of the sitemap.
    permalink: (data) => (data.draft ? false : `/blog/${data.page.fileSlug}/`),
  },
};
