/** @prose
 * # The reference's helpers
 *
 * The reference holds the one `gh` and the one command runner, so no other module in `src/`
 * wraps `gh` again. Five of them did, each with its own handling of an error.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

const src = join(import.meta.dirname, "..", "src");

test("only reference.ts defines gh in src/", () => {
  const defines = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts") && file !== "reference.ts")
    .filter((file) => /\bconst gh\s*=/.test(readFileSync(join(src, file), "utf8")));
  expect(defines).toEqual([]);
});
