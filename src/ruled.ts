/** @prose
 * # What the rules set
 *
 * The values every Vite+ config writes out, from `tools-fmt`, `tools-lint` and `tools-test`, the ones
 * a Playwright config does, and the ones a package's `pack` does, from `releases-packing` and `releases-types`. They're stated once,
 * here. The checks compare a config's values with them, and the fixes write them in, spelled as
 * `written` spells them, which is how oxfmt lays out a short block.
 *
 * `craftz()` used to fill them in. A config that only read them through the plugin left them out
 * of the file, so a repository's format, lint and pack changed with craftz's version, where
 * nothing in its own files showed it.
 */

/** A Vite+ config, or a block of one. */
export type Config = { [key: string]: unknown };

/** What the rules set, by block. */
export const RULED: Config = {
  fmt: { proseWrap: "never" },
  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
    rules: { "no-empty": "error" },
  },
  // Naming `exclude` replaces Vitest's own, so its two stay. A worktree an agent works in sits
  // under `.claude/worktrees/` with a copy of the tests, which an include like `**/*.test.ts`
  // reaches and runs beside the repository's.
  test: { exclude: ["**/node_modules/**", "**/.git/**", ".claude/worktrees/**"] },
};

/** What the rules set in a repository's `playwright.config.ts`, from `tools-playwright-config`. */
export const PLAYWRIGHT: Config = {
  // A failed test isn't retried, so a flaky one fails the run the first time it flakes. A trace
  // on the first retry would never be written, so one is kept for each failure instead.
  retries: 0,
  use: { trace: "retain-on-failure" },
  // A stray `test.only` fails the run on a laptop too, where it's cheaper to catch than in CI.
  forbidOnly: true,
};

/** What the rules set in a package's `pack`, by block. Where it runs is `tools-browsers`'. */
export const PACKED: Config = {
  publint: { strict: true },
  dts: { generator: "oxc" },
};

// A key as it's written, bare when it's a name, like `typeAware`, and quoted otherwise, like
// `"no-empty"`.
const keyed = (key: string): string => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key));

/** A value as oxfmt writes it in a config, like `{ typeAware: true, typeCheck: true }`. */
export function written(value: unknown): string {
  if (value instanceof RegExp) return String(value);
  if (Array.isArray(value)) return `[${value.map(written).join(", ")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).map(([key, it]) => `${keyed(key)}: ${written(it)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return JSON.stringify(value);
}
