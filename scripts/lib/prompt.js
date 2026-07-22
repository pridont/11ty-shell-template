/**
 * Terminal prompt widgets — select, input, confirm — with no dependencies.
 *
 * Raw mode is the whole trick: with it on, keypresses arrive one at a time
 * instead of a line at a time, which is what makes arrow-key navigation
 * possible. It also means this module owns the terminal while a prompt is open,
 * so every path has to restore cooked mode on the way out — including Ctrl-C.
 */

import readline from "node:readline";
import { createInterface } from "node:readline/promises";

const OUT = process.stdout;

// NO_COLOR is the de facto standard opt-out; a redirected stdout gets no escapes
// either, so piping the shell's output to a file stays readable.
const useColor = Boolean(OUT.isTTY) && !process.env.NO_COLOR;
const sgr = (code) => (s) =>
  useColor ? `\x1B[${code}m${s}\x1B[0m` : String(s);

export const style = {
  bold: sgr(1),
  dim: sgr(2),
  red: sgr(31),
  green: sgr(32),
  yellow: sgr(33),
  cyan: sgr(36),
};

/**
 * Every widget here needs a real terminal. Without this guard the failure is
 * `setRawMode is not a function` from deep inside a prompt, which says nothing
 * about the actual problem.
 */
export function requireTty() {
  if (process.stdin.isTTY && OUT.isTTY) return;
  process.stderr.write(
    "error: this is an interactive tool and needs a terminal.\n" +
      "       Run it directly rather than through a pipe or a CI job.\n",
  );
  process.exit(1);
}

export const write = (s) => OUT.write(s);
export const line = (s = "") => OUT.write(`${s}\n`);

// Clear from the cursor to the end of the screen, then redraw. Moving up and
// overwriting keeps one frame on screen instead of scrolling a new copy of the
// menu into the scrollback on every keypress.
const EOF = Symbol("eof");

const eraseDown = "\x1B[0J";
const cursorUp = (n) => (n > 0 ? `\x1B[${n}A` : "");
const hideCursor = "\x1B[?25l";
const showCursor = "\x1B[?25h";

export function clearScreen() {
  write("\x1B[2J\x1B[H");
}

/**
 * Reads single keypresses until `handler` returns a value.
 *
 * Ctrl-C exits the process rather than resolving: a half-finished menu is not a
 * meaningful return value, and the alternative is every caller re-implementing
 * the same "user gave up" branch.
 */
function readKeys(handler) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    readline.emitKeypressEvents(stdin);
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    write(hideCursor);

    const done = (value) => {
      stdin.off("keypress", onKey);
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
      write(showCursor);
      resolve(value);
    };

    function onKey(str, key) {
      if (key?.ctrl && key.name === "c") {
        stdin.setRawMode(Boolean(wasRaw));
        write(`${showCursor}\n`);
        process.exit(130);
      }
      const result = handler(str, key);
      if (result !== undefined) done(result);
    }

    stdin.on("keypress", onKey);
  });
}

/**
 * Arrow-key list. Resolves the chosen item's `value`, or null if the user backs
 * out with Esc or q.
 *
 * `choices` entries: { label, value, hint?, disabled? }. Disabled entries stay
 * visible with their hint — a `publish` action that is unavailable because there
 * is no git remote is more useful on screen, greyed out and explained, than
 * silently missing.
 */
export async function select(message, choices, { footer } = {}) {
  const first = choices.findIndex((c) => !c.disabled);
  if (first === -1)
    throw new Error("select() needs at least one enabled choice");

  let index = first;
  let drawn = 0;

  const render = () => {
    const lines = [];
    if (message) lines.push(message);
    for (const [i, choice] of choices.entries()) {
      const active = i === index;
      const pointer = active ? style.cyan("›") : " ";
      let label = choice.label;
      if (choice.disabled) label = style.dim(label);
      else if (active) label = style.cyan(label);
      const hint = choice.hint ? ` ${style.dim(choice.hint)}` : "";
      lines.push(`  ${pointer} ${label}${hint}`);
    }
    if (footer) lines.push(`\n  ${style.dim(footer)}`);

    const text = lines.join("\n");
    write(`${cursorUp(drawn)}\r${eraseDown}${text}\n`);
    // Wrapped lines occupy more rows than they do entries, so count what was
    // actually emitted rather than lines.length.
    drawn = text.split("\n").length;
  };

  const step = (delta) => {
    let next = index;
    do {
      next = (next + delta + choices.length) % choices.length;
    } while (choices[next].disabled && next !== index);
    index = next;
    render();
  };

  render();

  return readKeys((str, key) => {
    const name = key?.name;
    if (name === "up" || name === "k") return step(-1);
    if (name === "down" || name === "j") return step(1);
    if (name === "return" || name === "enter")
      return { value: choices[index].value };
    if (name === "escape" || name === "q") return { value: null };

    // A choice can declare a shortcut key ("n" for new) and be picked directly.
    const hit = choices.find((c) => !c.disabled && c.key && c.key === str);
    if (hit) return { value: hit.value };
    return undefined;
  }).then((r) => r.value);
}

/**
 * Free text. Raw mode goes off for this one so readline handles backspace,
 * paste, kill-line and the rest — reimplementing line editing would be a bad
 * trade for a prompt that asks for a title.
 */
export async function input(
  message,
  { default: fallback = "", validate } = {},
) {
  const rl = createInterface({ input: process.stdin, output: OUT });

  // Ctrl-D closes stdin without answering, and rl.question() then never settles.
  // Racing the close event turns a silent hang into the same exit Ctrl-C gives.
  const eof = new Promise((resolve) => rl.once("close", () => resolve(EOF)));

  try {
    for (;;) {
      const suffix = fallback ? style.dim(` (${fallback})`) : "";
      const raw = await Promise.race([
        rl.question(`  ${message}${suffix}: `),
        eof,
      ]);
      if (raw === EOF) {
        line();
        process.exit(130);
      }
      const answer = raw.trim();
      const value = answer || fallback;

      const problem = validate?.(value);
      if (problem) {
        line(`  ${style.red(problem)}`);
        continue;
      }
      return value;
    }
  } finally {
    rl.close();
  }
}

export async function confirm(message, { default: fallback = false } = {}) {
  const hint = fallback ? "Y/n" : "y/N";
  write(`  ${message} ${style.dim(`(${hint})`)} `);

  const answer = await readKeys((str, key) => {
    const name = key?.name;
    if (name === "return" || name === "enter") return { value: fallback };
    if (name === "escape") return { value: false };
    if (str?.toLowerCase() === "y") return { value: true };
    if (str?.toLowerCase() === "n") return { value: false };
    return undefined;
  }).then((r) => r.value);

  line(answer ? style.green("yes") : style.dim("no"));
  return answer;
}

export async function anyKey(message = "press any key") {
  write(`  ${style.dim(message)}`);
  await readKeys(() => ({}));
  line();
}
