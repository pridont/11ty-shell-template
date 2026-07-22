/**
 * Reading and writing the essays in src/writing/.
 *
 * Front matter is handled as lines, never parsed into an object and re-emitted.
 * A YAML round trip would normalise quoting, drop the commented-out `# cover:`
 * hints, and reformat anything the author wrote by hand — a heavy price for what
 * is usually a one-line change. Toggling a draft edits one line and leaves every
 * other byte alone.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const POSTS_DIR = "src/writing";

export const PLACEHOLDER_EXCERPT =
  "TODO — one sentence; it shows on /writing/ and in the feed.";
export const PLACEHOLDER_BODY = "Opening paragraph.";

const FENCE = "---";

/**
 * "On the Texture of Attention" -> "on-the-texture-of-attention".
 *
 * NFD + stripping combining marks folds accents onto their base letter (café ->
 * cafe) rather than dropping the character. A title in a script with no ASCII
 * form leaves nothing behind, which is why callers have to handle "".
 */
export function slugify(title) {
  return String(title)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Local calendar date, not toISOString() — that is UTC, and west of Greenwich it
// hands you yesterday for most of the working day.
export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  // Round-trips only for real dates: "2026-02-30" normalises to March 2nd.
  return new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
}

/**
 * Existing posts have bare, unquoted front-matter values, so quote only when YAML
 * would otherwise misread the string — a colon starts a mapping, `#` a comment,
 * and the indicator characters mean something in first position.
 */
export function yamlValue(s) {
  const value = String(s);
  const needsQuotes =
    value === "" ||
    /: |:$|\s#|^[-?:,[\]{}#&*!|>'"%@`]|^\s|\s$/.test(value) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(value) ||
    /^[\d.+-]/.test(value);

  if (!needsQuotes) return value;
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

// The inverse, for display only: strips the quoting yamlValue may have added.
function unquote(value) {
  const s = value.trim();
  if (
    s.length > 1 &&
    ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))
  ) {
    return s.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
  }
  return s;
}

/**
 * Splits a file into its front-matter lines and its body, both verbatim.
 * Returns null for a file with no front matter — Eleventy would still build it,
 * but it has no title or date to show, so the shell leaves it alone.
 */
function splitFrontMatter(text) {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== FENCE) return null;

  const end = lines.findIndex((l, i) => i > 0 && l.trim() === FENCE);
  if (end === -1) return null;

  return { front: lines.slice(1, end), body: lines.slice(end + 1).join("\n") };
}

// Only matches uncommented, top-level keys — `# cover: …` is deliberately not a
// hit, which is what keeps the commented hints inert.
const keyLine = (key) => new RegExp(`^${key}:\\s*(.*)$`);

function readKey(front, key) {
  const re = keyLine(key);
  for (const l of front) {
    const m = l.match(re);
    if (m) return unquote(m[1]);
  }
  return undefined;
}

export function postPath(slug) {
  return path.join(root, POSTS_DIR, `${slug}.md`);
}

export function postUrl(slug) {
  return `/writing/${slug}/`;
}

/** Every essay in src/writing/, newest first — the order /writing/ uses. */
export async function listPosts() {
  const dir = path.join(root, POSTS_DIR);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".md"));

  const posts = [];
  for (const name of names) {
    const file = path.join(dir, name);
    const text = await readFile(file, "utf8");
    const parts = splitFrontMatter(text);
    if (!parts) continue;

    const slug = name.replace(/\.md$/, "");
    posts.push({
      slug,
      name,
      file,
      relative: path.join(POSTS_DIR, name),
      url: postUrl(slug),
      title: readKey(parts.front, "title") ?? slug,
      date: readKey(parts.front, "date") ?? "",
      excerpt: readKey(parts.front, "excerpt") ?? "",
      draft: readKey(parts.front, "draft") === "true",
      body: parts.body,
      front: parts.front,
    });
  }

  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Adds or removes the single `draft: true` line.
 *
 * On insert it goes after the last recognised scalar key rather than at the top,
 * so it lands below title/date/excerpt and above the commented cover hints —
 * matching what the scaffold writes.
 */
export function setDraft(front, draft) {
  const re = keyLine("draft");
  const without = front.filter((l) => !re.test(l));
  if (!draft) return without;

  const anchors = ["excerpt", "date", "title"];
  for (const key of anchors) {
    const at = without.findIndex((l) => keyLine(key).test(l));
    if (at !== -1)
      return [
        ...without.slice(0, at + 1),
        "draft: true",
        ...without.slice(at + 1),
      ];
  }
  return [...without, "draft: true"];
}

/** Reassembles a file from front-matter lines and a body. */
export function render(front, body) {
  return `${FENCE}\n${front.join("\n")}\n${FENCE}\n${body}`;
}

export async function writePost(post, front) {
  await writeFile(post.file, render(front, post.body), "utf8");
}

export function scaffold({ title, date, excerpt }) {
  const front = [
    `title: ${yamlValue(title)}`,
    `date: ${date}`,
    `excerpt: ${yamlValue(excerpt)}`,
    "draft: true",
    "# cover: /assets/images/cover.jpg",
    "# coverAlt: Describe the image for anyone who cannot see it.",
  ];

  return render(front, `\n${PLACEHOLDER_BODY}\n`);
}

/**
 * Writes a new draft. `flag: "wx"` makes the existence check atomic — checking
 * first and writing second would leave a window where two runs both think the
 * slug is free.
 */
export async function createPost({ title, slug, date, excerpt }) {
  const file = postPath(slug);
  await writeFile(file, scaffold({ title, date, excerpt }), { flag: "wx" });
  return {
    slug,
    file,
    relative: path.join(POSTS_DIR, `${slug}.md`),
    url: postUrl(slug),
    title,
    date,
  };
}

/** True when the scaffold's excerpt or body was never touched. */
export function isUnfinished(post) {
  return {
    excerpt: post.excerpt === PLACEHOLDER_EXCERPT || post.excerpt === "",
    body: post.body.trim() === PLACEHOLDER_BODY,
  };
}
