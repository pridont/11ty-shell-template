/**
 * Eleventy 3.x config (ESM — package.json sets "type": "module").
 */

// Dates render as "Mar 2026" everywhere in the design.
// timeZone: "UTC" is mandatory — YAML parses `date: 2026-03-01` as UTC midnight, and
// formatting that in a negative-offset zone would render "Feb 2026".
const monthYearFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/assets");

  eleventyConfig.addWatchTarget("src/css/");

  eleventyConfig.addFilter("monthYear", (d) => monthYearFmt.format(d));
  eleventyConfig.addFilter("isoDate", (d) => d.toISOString().slice(0, 10));

  // Nunjucks' built-in `slice` is Jinja-style chunking, not Array.prototype.slice.
  eleventyConfig.addFilter("limit", (arr, n) => arr.slice(0, n));

  eleventyConfig.addFilter("whereType", (arr, type) =>
    arr.filter((item) => item.type === type),
  );

  // In-body image with an optional caption, usable from markdown because
  // markdownTemplateEngine is njk:
  //   {% figure "/assets/images/x.jpg", "alt text", "Figure 1. Caption." %}
  // Markdown's own ![alt](src) still works and is styled as a plain image.
  const attr = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  eleventyConfig.addShortcode("figure", (src, alt, caption) => {
    const img = `<img class="figure__img" src="${attr(src)}" alt="${attr(alt)}" loading="lazy" decoding="async">`;
    const cap = caption
      ? `<figcaption class="figure__caption">${attr(caption)}</figcaption>`
      : "";
    return `<figure class="figure">${img}${cap}</figure>`;
  });

  // Drafts: `draft: true` in front matter hides the page from production builds
  // but keeps it visible under `npm run dev`.
  eleventyConfig.addPreprocessor("drafts", "*", (data) => {
    if (data.draft && process.env.ELEVENTY_RUN_MODE === "build") return false;
  });
}

export const config = {
  dir: {
    input: "src",
    output: "_site",
    includes: "_includes",
    data: "_data",
  },
  templateFormats: ["njk", "md", "html"],
  markdownTemplateEngine: "njk",
  htmlTemplateEngine: "njk",
};
