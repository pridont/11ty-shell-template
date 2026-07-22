/**
 * The git side of the content shell.
 *
 * Every call goes through execFile with an argument array — never a shell
 * string. Titles and slugs come from the person at the keyboard and end up in
 * commit messages and pathspecs; with no shell in the middle there is nothing
 * for a quote or a semicolon in a title to break out of.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { root } from "./posts.js";

const run = promisify(execFile);

// Set by the shell's --dry-run: mutating commands are printed, not executed.
let dryRun = false;
let onDryRun = () => {};

export function setDryRun(enabled, reporter) {
  dryRun = Boolean(enabled);
  if (reporter) onDryRun = reporter;
}

export const isDryRun = () => dryRun;

async function git(args) {
  const { stdout } = await run("git", args, { cwd: root });
  return stdout.trim();
}

/**
 * Read-only commands always run — dry-run is about not changing anything, and a
 * shell that cannot read the branch name has nothing to show.
 */
const read = (args) => git(args).catch(() => "");

/** Mutating commands. Under --dry-run they are reported and skipped. */
async function mutate(args) {
  if (dryRun) {
    onDryRun(`git ${args.join(" ")}`);
    return "";
  }
  return git(args);
}

export async function hasRemote() {
  return (await read(["remote"])).length > 0;
}

/**
 * Branch, upstream, how far ahead/behind, and the paths git considers dirty.
 *
 * The ahead/behind counts come from `rev-list --left-right --count`, which is
 * local knowledge: it reflects the last fetch, not the true state of the remote.
 * publish() fetches first so the number it acts on is current.
 */
export async function status() {
  const branch = await read(["rev-parse", "--abbrev-ref", "HEAD"]);
  const upstream = await read([
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  ]);

  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const counts = await read([
      "rev-list",
      "--left-right",
      "--count",
      `${upstream}...HEAD`,
    ]);
    const [b, a] = counts.split(/\s+/).map(Number);
    behind = b || 0;
    ahead = a || 0;
  }

  const porcelain = await read(["status", "--porcelain", "--", "src/writing"]);
  const dirty = new Set(
    porcelain
      .split("\n")
      .filter(Boolean)
      // "XY path" — and for renames, "XY old -> new"; the new name is what matters.
      .map((l) => l.slice(3).split(" -> ").at(-1).replace(/^"|"$/g, "")),
  );

  return { branch, upstream, ahead, behind, dirty, remote: await hasRemote() };
}

/**
 * Commits exactly the given paths.
 *
 * The trailing pathspec on `git commit` bypasses the index, so whatever else is
 * staged in this working tree stays staged and out of the commit. Without it, a
 * content action would quietly ship any unrelated work the author had queued up.
 */
export async function commitPaths(paths, message) {
  await mutate(["add", "--", ...paths]);
  await mutate(["commit", "-m", message, "--", ...paths]);
}

/** Same, for a deletion — `git rm` removes the file and stages it in one step. */
export async function removePath(relativePath, message) {
  await mutate(["rm", "--quiet", "--", relativePath]);
  await mutate(["commit", "-m", message, "--", relativePath]);
}

export async function hasChanges(relativePath) {
  const out = await read(["status", "--porcelain", "--", relativePath]);
  return out.length > 0;
}

/** What is about to leave the machine: subjects and a diffstat, for the confirm. */
export async function pendingSummary() {
  const upstream = await read([
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  ]);
  if (!upstream) return { commits: [], stat: "", upstream: "" };

  const log = await read(["log", "--oneline", `${upstream}..HEAD`]);
  const stat = await read(["diff", "--stat", `${upstream}..HEAD`]);
  return { commits: log ? log.split("\n") : [], stat, upstream };
}

export async function fetch() {
  // A fetch changes no working-tree state, so it runs even under --dry-run:
  // being honest about behind-ness matters more than purity here.
  await read(["fetch", "--quiet"]);
}

/**
 * Pushes the current branch, refusing anything that needs a decision.
 *
 * Being behind means someone else pushed. Merging or rebasing on the author's
 * behalf from inside a content menu is exactly the kind of surprise that loses
 * work, so it stops and says what to run.
 */
export async function push() {
  const { branch, upstream, behind } = await status();

  if (behind > 0) {
    return {
      ok: false,
      reason:
        `${branch} is ${behind} commit${behind === 1 ? "" : "s"} behind ${upstream}. ` +
        "Run `git pull --rebase` first — not doing that for you.",
    };
  }

  const args = upstream ? ["push"] : ["push", "-u", "origin", branch];
  try {
    await mutate(args);
    return { ok: true, args };
  } catch (err) {
    return { ok: false, reason: (err.stderr || err.message).trim() };
  }
}
