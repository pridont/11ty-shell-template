/**
 * Directory data for src/writing/ — applied to every essay in this folder.
 *
 * The `writing` tag is what builds collections.writing, which drives the /writing/
 * index, the three most recent on the home page, and the RSS feed. It also flips
 * base.njk to og:type=article.
 */
export default {
  layout: "post.njk",
  tags: ["writing"],
};
