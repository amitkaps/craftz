/** @prose
 * # What the rules set
 *
 * The values `craftz()` gives every Vite+ config, from `toolchain-wrap` and `toolchain-lint`.
 * They're stated once, here. The plugin fills them in, and `toolchain-craftz`'s fix takes each
 * one out of a config that sets it the same, spelled as `written` spells it, so the two can't
 * disagree on what the rules set.
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

/** A value as oxfmt writes it in a config, like `{ typeAware: true, typeCheck: true }`. */
export function written(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(written).join(", ")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).map(([key, it]) => `${key}: ${written(it)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return JSON.stringify(value);
}
