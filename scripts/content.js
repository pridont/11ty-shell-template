/**
 * Interactive content shell.
 *
 *   npm run content
 *
 * Covers an essay's whole life: create, edit, publish, unpublish, delete — with
 * the git work folded in, because on this site publishing *is* a push. Netlify
 * builds from the remote, so the moment a commit lands on origin/main the site
 * rebuilds. That is why publish, unpublish and delete each stop for an explicit
 * confirmation showing what is about to leave the machine, and nothing else
 * pushes at all.
 *
 * Drafts are `draft: true` in front matter, which the `drafts` preprocessor in
 * eleventy.config.js already understands: visible under `npm run dev`, dropped
 * from production builds. The shell toggles that one line.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";

import * as git from "./lib/git.js";
import {
  createPost,
  isUnfinished,
  isValidDate,
  listPosts,
  postPath,
  root,
  slugify,
  today,
  writePost,
  setDraft,
  PLACEHOLDER_EXCERPT,
} from "./lib/posts.js";
import {
  anyKey,
  clearScreen,
  confirm,
  input,
  line,
  requireTty,
  select,
  style,
  write,
} from "./lib/prompt.js";

const HELP = `Manage the essays in src/writing/, including the git side.

  npm run content [-- <options>]

Options:
  --dry-run   Print git commands instead of running them
  --help      Show this

Publishing pushes to origin, which is what triggers a Netlify deploy.
`;

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

requireTty();

const dryRun = values["dry-run"];
git.setDryRun(dryRun, (cmd) => line(`  ${style.dim("dry-run")} ${cmd}`));

const monthYear = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  // UTC to match the site's own monthYear filter, which pins the zone for the
  // same reason: a date-only value parsed locally can render the wrong month.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const pad = (s, width) => s + " ".repeat(Math.max(0, width - [...s].length));

function header(state) {
  const bits = [style.bold("gz-site content")];
  if (state.branch) {
    const counts = state.upstream
      ? ` ${state.ahead ? `↑${state.ahead}` : ""}${state.behind ? `↓${state.behind}` : ""}`.trimEnd()
      : style.yellow(" no upstream");
    bits.push(style.dim(`· ${state.branch}${counts}`));
  }
  if (!state.remote)
    bits.push(style.yellow("· no remote — publishing disabled"));
  if (dryRun) bits.push(style.yellow("· dry run"));

  clearScreen();
  line(`  ${bits.join(" ")}`);
  line();
}

/** The post list doubles as the status view: draft state and dirtiness at a glance. */
async function postChoices(posts, state) {
  const width = Math.max(...posts.map((p) => [...p.title].length), 0);

  return posts.map((post) => {
    const mark = post.draft ? style.dim("○") : style.green("●");
    const tags = [
      post.draft ? style.yellow("draft") : "",
      state.dirty.has(post.relative) ? style.cyan("uncommitted") : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      label: `${mark} ${pad(post.title, width)}  ${style.dim(pad(monthYear(post.date), 8))} ${tags}`,
      value: post,
    };
  });
}

/**
 * Shared tail for the three actions that change what the world can see. The
 * commit has already happened by the time this runs — the push is the part worth
 * a second look, so it gets the diffstat and a plain sentence about the deploy.
 */
async function offerPush(state) {
  if (!state.remote) {
    line(`  ${style.yellow("No git remote — committed locally only.")}`);
    line(
      `  ${style.dim("git remote add origin <url> && git push -u origin " + state.branch)}`,
    );
    return;
  }

  await git.fetch();
  const { commits, stat, upstream } = await git.pendingSummary();

  if (!commits.length && !dryRun) {
    line(`  ${style.dim("Nothing to push.")}`);
    return;
  }

  line();
  line(
    `  ${style.bold("About to push")} ${style.dim(`→ ${upstream || "origin"}`)}`,
  );
  for (const c of commits) line(`    ${c}`);
  if (stat) for (const l of stat.split("\n")) line(`    ${style.dim(l)}`);
  line(`  ${style.yellow("This triggers a Netlify deploy.")}`);
  line();

  if (!(await confirm("Push?"))) {
    line(
      `  ${style.dim("Left unpushed. Run the action again, or `git push`, when ready.")}`,
    );
    return;
  }

  const result = await git.push();
  if (result.ok)
    line(`  ${style.green("Pushed.")} ${style.dim("Netlify is building.")}`);
  else line(`  ${style.red("Push failed:")} ${result.reason}`);
}

async function actionNew(state) {
  const title = await input("Title", {
    validate: (v) => (v ? undefined : "A title is required."),
  });

  // The slug is the permalink — /writing/<slug>/ — and changing it later breaks
  // every link and the feed's guid, so it is offered for editing now rather than
  // silently derived.
  const slug = await input("Slug", {
    default: slugify(title),
    validate: (v) => {
      if (!slugify(v))
        return "Nothing sluggable there — use letters or digits.";
      return undefined;
    },
  });

  const date = await input("Date", {
    default: today(),
    validate: (v) =>
      isValidDate(v) ? undefined : "Use a real YYYY-MM-DD date.",
  });

  const excerpt = await input("Excerpt", { default: PLACEHOLDER_EXCERPT });

  let post;
  try {
    post = await createPost({ title, slug: slugify(slug), date, excerpt });
  } catch (err) {
    if (err.code === "EEXIST") {
      line(`  ${style.red(`${slugify(slug)}.md already exists.`)}`);
      return;
    }
    throw err;
  }

  await git.commitPaths([post.relative], `content: add "${title}"`);
  line();
  line(`  ${style.green("Created")} ${post.relative}  ${style.dim(post.url)}`);
  line(
    `  ${style.dim("It is a draft: visible under `npm run dev`, not in production.")}`,
  );

  if (await confirm("Open it now?", { default: true })) await openEditor(post);
}

async function actionPublish(post, state) {
  const unfinished = isUnfinished(post);

  // The excerpt is the feed description and the page's meta description. A TODO
  // in there is not a cosmetic problem — it is what search results and RSS
  // readers would show.
  if (unfinished.excerpt) {
    line(`  ${style.red("The excerpt is still the placeholder.")}`);
    line(
      `  ${style.dim("It becomes the meta description and the RSS summary. Edit it first.")}`,
    );
    return;
  }

  if (unfinished.body) {
    line(`  ${style.yellow("The body is still the scaffold's one line.")}`);
    if (!(await confirm("Publish anyway?"))) return;
  }

  await writePost(post, setDraft(post.front, false));
  await git.commitPaths([post.relative], `content: publish "${post.title}"`);
  line(`  ${style.green("Published locally.")} ${style.dim(post.url)}`);
  await offerPush(state);
}

async function actionUnpublish(post, state) {
  line(`  ${style.dim(`${post.url} will 404 for anyone who linked it.`)}`);
  if (!(await confirm("Move to drafts?"))) return;

  await writePost(post, setDraft(post.front, true));
  await git.commitPaths([post.relative], `content: unpublish "${post.title}"`);
  line(`  ${style.green("Moved to drafts.")}`);
  await offerPush(state);
}

async function actionDelete(post, state) {
  line(`  ${style.red("Delete")} ${post.relative}`);
  line(
    `  ${style.dim("The commit history keeps it — `git show HEAD~1:" + post.relative + "` restores it.")}`,
  );
  if (!(await confirm("Delete it?"))) return;

  await git.removePath(post.relative, `content: delete "${post.title}"`);
  line(`  ${style.green("Deleted.")}`);
  if (!post.draft) await offerPush(state);
  else
    line(
      `  ${style.dim("It was a draft, so production never had it — nothing to push urgently.")}`,
    );
}

/**
 * Hands the terminal to $EDITOR. `stdio: "inherit"` is what lets a full-screen
 * editor work; anything else leaves vim drawing into a pipe.
 *
 * The variable is split on whitespace because `code -w` and `subl -w` are as
 * common as a bare `vim`, and spawning the whole string as one binary name would
 * look for an executable called "code -w".
 */
function openEditor(post) {
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (!editor) {
    line(
      `  ${style.red("No $EDITOR or $VISUAL set.")} ${style.dim(`Open ${post.relative} yourself.`)}`,
    );
    return Promise.resolve();
  }

  const [command, ...args] = editor.trim().split(/\s+/);

  return new Promise((resolve) => {
    const child = spawn(command, [...args, post.file ?? postPath(post.slug)], {
      stdio: "inherit",
    });
    child.on("close", () => resolve());
    child.on("error", (err) => {
      line(`  ${style.red(`Could not run ${editor}: ${err.message}`)}`);
      resolve();
    });
  });
}

async function actionEdit(post) {
  await openEditor(post);
  if (!(await git.hasChanges(post.relative))) return;
  if (await confirm("Commit the changes?", { default: true })) {
    await git.commitPaths([post.relative], `content: update "${post.title}"`);
    line(
      `  ${style.green("Committed.")} ${style.dim("Not pushed — publish when you are ready.")}`,
    );
  }
}

/**
 * A dev server, for as long as the author wants to look. Drafts render here and
 * nowhere else, so this is the only way to see one in a browser.
 *
 * The local binary is spawned directly rather than through `npx`: npx is a
 * wrapper process, and killing it leaves the real Eleventy server orphaned and
 * holding port 8080.
 */
async function actionPreview(post) {
  const bin = path.join(root, "node_modules/.bin/eleventy");
  const child = spawn(bin, ["--serve", "--quiet"], {
    cwd: root,
    stdio: "ignore",
  });

  let died = null;
  child.on("error", (err) => (died = err.message));
  child.on("exit", (code) => {
    if (died === null)
      died = `server exited (${code}) — is port 8080 already in use?`;
  });

  // Eleventy needs a moment to build before the port answers; without this the
  // URL is printed and the first click 404s.
  await new Promise((r) => setTimeout(r, 1500));

  if (died) {
    line(`  ${style.red(died)}`);
    return;
  }

  line(
    `  ${style.green("Serving")} ${style.cyan(`http://localhost:8080${post.url}`)}`,
  );
  await anyKey("press any key to stop the server");
  child.kill();
}

const ACTIONS = {
  publish: actionPublish,
  unpublish: actionUnpublish,
  edit: actionEdit,
  preview: actionPreview,
  delete: actionDelete,
};

async function postMenu(post, state) {
  header(state);
  line(
    `  ${style.bold(post.title)} ${style.dim(post.draft ? "draft" : "live")}`,
  );
  line(`  ${style.dim(`${post.relative} · ${post.url}`)}`);
  line();

  const publishDisabled = !state.remote;
  const choices = [
    post.draft
      ? {
          label: "publish",
          value: "publish",
          hint: publishDisabled
            ? "needs a git remote"
            : "commit + push · deploys",
          disabled: publishDisabled,
        }
      : {
          label: "unpublish",
          value: "unpublish",
          hint: publishDisabled
            ? "needs a git remote"
            : "back to drafts · deploys",
          disabled: publishDisabled,
        },
    { label: "edit", value: "edit", hint: "$EDITOR" },
    { label: "preview", value: "preview", hint: "local dev server" },
    { label: "delete", value: "delete", hint: "recoverable from git" },
    { label: "back", value: null },
  ];

  const action = await select("", choices, {
    footer: "↑↓ select   ↵ run   esc back",
  });
  if (!action) return;

  line();
  await ACTIONS[action](post, state);
  line();
  await anyKey("press any key to return");
}

async function main() {
  for (;;) {
    const state = await git.status();
    const posts = await listPosts();

    header(state);

    if (!posts.length) {
      line(`  ${style.dim("No essays yet.")}`);
      line();
    }

    const choices = [
      ...(await postChoices(posts, state)),
      ...(posts.length
        ? [{ label: style.dim("─".repeat(20)), value: "sep", disabled: true }]
        : []),
      { label: "new post", value: "new", key: "n" },
      { label: "quit", value: "quit", key: "q" },
    ];

    const picked = await select("", choices, {
      footer: "↑↓ select   ↵ actions   n new   q quit",
    });

    if (picked === null || picked === "quit") {
      line();
      return;
    }

    line();
    if (picked === "new") {
      await actionNew(state);
      line();
      await anyKey("press any key to return");
    } else {
      await postMenu(picked, state);
    }
  }
}

await main();
write("\x1B[?25h");
