/** @prose
 * # The reference's helpers
 *
 * The reference holds the one `gh` and the one command runner, so no other module in `src/`
 * wraps `gh` again. Five of them did, each with its own handling of an error.
 *
 * It also holds the one idea of a beta, which `align` and `notes` share: a version with a tag
 * after its numbers, which a release at its major or later graduates. Build metadata after `+` is
 * not a tag.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { graduated, isPrerelease } from "../src/reference.ts";

const src = join(import.meta.dirname, "..", "src");

test("only reference.ts defines gh in src/", () => {
  const defines = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts") && file !== "reference.ts")
    .filter((file) => /\bconst gh\s*=/.test(readFileSync(join(src, file), "utf8")));
  expect(defines).toEqual([]);
});

test("a beta is a tag after the numbers, and build metadata is not one", () => {
  expect(isPrerelease("1.0.0-rc.1")).toBe(true);
  expect(isPrerelease("1.0.0-rc.1+build")).toBe(true);
  expect(isPrerelease("1.0.0+build-7")).toBe(false);
  expect(isPrerelease("1.0.0")).toBe(false);
});

test("a beta graduates to a release at its major or later", () => {
  expect(graduated("1.0.0-beta.17", "1.0.0")).toBe(true);
  expect(graduated("1.0.0-beta.17", "2.1.0")).toBe(true);
  expect(graduated("2.0.0-beta.1", "1.9.0")).toBe(false);
  expect(graduated("1.0.0-beta.17", "1.0.0-rc.1")).toBe(false);
  expect(graduated("1.0.0-rc.1+build", "1.0.0+build-7")).toBe(true);
});
