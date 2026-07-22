/**
 * Sidebar and mobile-menu links, in display order.
 *
 * `url` doubles as the active-state key: partials/nav-links.njk matches the
 * current page by prefix, so these need the trailing slash that Eleventy's
 * permalinks produce.
 */
export default [
  { text: "Home", url: "/" },
  { text: "About", url: "/about/" },
  { text: "Writing", url: "/writing/" },
  { text: "Publications", url: "/publications/" },
  { text: "Contact", url: "/contact/" },
];
