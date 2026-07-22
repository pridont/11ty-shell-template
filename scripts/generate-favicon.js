/**
 * Generates a monogram favicon from the site owner's initials.
 *
 *   npm run favicon
 *
 * Deliberately a manual tool, not a build step: the output is committed, so a
 * deploy never depends on this having run. Re-run it when the name in
 * profile.js or the accent color in style.css changes.
 *
 * Everything it needs is already in the repo — initials from profile.js, letter
 * color from site.js's theme colors, tile color from the `--accent` token in
 * style.css — so the icon cannot drift away from the rest of the design.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import profile from "../src/_data/profile.js";
import site from "../src/_data/site.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STYLESHEET = path.join(root, "src/css/style.css");
const DEFAULT_OUT = "src/assets/favicon.svg";

// Only used when style.css stops matching — see readAccents().
const FALLBACK_ACCENT = { light: "#a74639", dark: "#e8907f" };

const HELP = `Generate src/assets/favicon.svg from the initials in src/_data/profile.js.

  npm run favicon [-- <options>]

Options:
  --out <path>       Where to write (default: ${DEFAULT_OUT})
  --initials <str>   Use these instead of the ones derived from profile.js
  --print            Write to stdout instead of a file
  --help             Show this
`;

/**
 * "John Doe" -> "JD". Takes the first and last name part so middle names and
 * suffixes drop out, and skips parts that open with something other than a
 * letter ("(née" and friends). One-word names yield a single letter, which the
 * SVG sizes differently.
 */
function initialsFrom(nameLines, name) {
  const source =
    Array.isArray(nameLines) && nameLines.length
      ? nameLines
      : String(name ?? "").split(/\s+/);

  const letters = source
    .map((part) => String(part).trim())
    .filter((part) => /^\p{L}/u.test(part))
    .map((part) => [...part][0].toLocaleUpperCase());

  if (!letters.length) return "";
  return letters.length === 1
    ? letters[0]
    : letters[0] + letters[letters.length - 1];
}

/**
 * `--accent` is defined exactly twice in style.css: once in :root and once in
 * the [data-theme="dark"] block. Splitting on the dark selector puts one in each
 * half, so a plain first-match regex per half is enough — no CSS parser.
 */
async function readAccents() {
  let css;
  try {
    css = await readFile(STYLESHEET, "utf8");
  } catch {
    process.stderr.write(
      `warning: could not read ${path.relative(root, STYLESHEET)}, using fallback accents\n`,
    );
    return { ...FALLBACK_ACCENT };
  }

  const [lightHalf, darkHalf = ""] = css.split('[data-theme="dark"]');
  const find = (text) => text.match(/--accent:\s*(#[0-9a-fA-F]{3,8})\b/)?.[1];

  const light = find(lightHalf);
  const dark = find(darkHalf);

  if (!light || !dark) {
    process.stderr.write(
      "warning: --accent not found as a hex value in style.css, using fallback accents\n",
    );
  }

  return {
    light: light ?? FALLBACK_ACCENT.light,
    dark: dark ?? FALLBACK_ACCENT.dark,
  };
}

const escapeXml = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * Dark mode lives inside the file: a <style> block with a prefers-color-scheme
 * query, which is the only way a single favicon can respond to the theme.
 *
 * The font is a system stack — an SVG favicon is rendered by the browser chrome,
 * where the site's webfonts do not exist. Centering is text-anchor +
 * dominant-baseline rather than a hardcoded baseline, so it stays centered
 * whichever font the viewer's OS actually supplies.
 */
function buildSvg({ initials, accent, ink }) {
  const twoUp = [...initials].length > 1;
  const fontSize = twoUp ? 30 : 38;
  const tracking = twoUp ? -1 : 0;
  const text = escapeXml(initials);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${text}">
  <style>
    :root { --tile: ${accent.light}; --ink: ${ink.light} }
    @media (prefers-color-scheme: dark) {
      :root { --tile: ${accent.dark}; --ink: ${ink.dark} }
    }
  </style>
  <rect width="64" height="64" rx="14" fill="var(--tile)"/>
  <text x="32" y="32" fill="var(--ink)"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
        font-weight="700" font-size="${fontSize}" letter-spacing="${tracking}"
        text-anchor="middle" dominant-baseline="central">${text}</text>
</svg>
`;
}

const { values } = parseArgs({
  options: {
    out: { type: "string", default: DEFAULT_OUT },
    initials: { type: "string" },
    print: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const initials = (
  values.initials ?? initialsFrom(profile.nameLines, profile.name)
).trim();

if (!initials) {
  process.stderr.write(
    "error: no initials — set `name` or `nameLines` in src/_data/profile.js, or pass --initials\n",
  );
  process.exit(1);
}

const accent = await readAccents();
const ink = { light: site.themeColor.light, dark: site.themeColor.dark };
const svg = buildSvg({ initials, accent, ink });

if (values.print) {
  process.stdout.write(svg);
} else {
  const out = path.resolve(root, values.out);
  await writeFile(out, svg, "utf8");
  process.stdout.write(
    `${initials} — tile ${accent.light}/${accent.dark}, ink ${ink.light}/${ink.dark} -> ${path.relative(root, out)}\n`,
  );
}
