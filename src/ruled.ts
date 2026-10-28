/** @prose
 * # What the rules set
 *
 * The values every Vite+ config writes out, from `toolchain-wrap` and `toolchain-lint`, and the
 * ones a package's `pack` does, from `releases-packing` and `releases-types`. They're stated once,
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
  },
};

/** What the rules set in a package's `pack`, by block. Where it runs is `toolchain-browsers`'. */
export const PACKED: Config = {
  publint: { strict: true },
  dts: { generator: "oxc" },
};

/** A value as oxfmt writes it in a config, like `{ typeAware: true, typeCheck: true }`. */
export function written(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(written).join(", ")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).map(([key, it]) => `${key}: ${written(it)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return JSON.stringify(value);
}
