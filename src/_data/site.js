/**
 * Global site data.
 *
 * JS rather than JSON because the absolute origin has to follow the deploy
 * context: canonical links, og:url, and the sitemap all need a real origin, and a
 * hard-coded one would make every deploy preview claim to be the production site.
 */

// Netlify sets these on every build: URL is the site's primary domain,
// DEPLOY_PRIME_URL the branch/preview origin, and CONTEXT one of
// production | deploy-preview | branch-deploy.
const context = process.env.CONTEXT;
const isPreview = context === "deploy-preview" || context === "branch-deploy";

// TODO: replace with the real domain. Used for local builds and anywhere the
// Netlify environment is absent.
const FALLBACK_ORIGIN = "https://example.com";

const origin =
  (isPreview ? process.env.DEPLOY_PRIME_URL : process.env.URL) ||
  FALLBACK_ORIGIN;

export default {
  // No trailing slash — every consumer joins a path onto this.
  url: origin.replace(/\/+$/, ""),

  // Only previews are held back. Defaulting to indexable means a build outside
  // Netlify (where CONTEXT is unset) publishes normally instead of silently
  // shipping a Disallow: / that nobody would think to look for.
  indexable: !isPreview,

  lang: "en",
  // og:locale wants the language_TERRITORY form, which `lang` deliberately isn't.
  ogLocale: "en_US",
  description: "Ethics, moral psychology, and the philosophy of perception.",

  // Fallback social card for pages with no `cover` of their own.
  ogImage: "/assets/images/cover.jpg",
  ogImageAlt: "Fog settling between forested ridges at first light.",

  themeColor: {
    light: "#faf8f4",
    dark: "#120e09",
  },
};
