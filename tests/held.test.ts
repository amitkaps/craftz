/** @prose
 * # The held tools' test
 *
 * npm and nodejs.org are stood in for here. pnpm, the Node floor and a beta are listed when a
 * newer version exists, left out when they're current, and named when they can't be compared.
 */
import { expect, test } from "vite-plus/test";
import { type Latest, heldTools, later } from "../src/held.ts";

const reference = {
  devEngines: {
    packageManager: { name: "pnpm", version: "12.16.1" },
    runtime: { version: ">=26.13.0" },
  },
  devDependencies: { cf: "1.0.0-beta.21", "vite-plus": "1.5.0" },
};

const versions =
  (known: Record<string, string>): Latest =>
  async (name) =>
    known[name];

test("a newer pnpm, Node and beta build are listed", async () => {
  const found = await heldTools(
    reference,
    versions({ pnpm: "12.18.0", node: "26.14.0", cf: "1.0.0-beta.28" }),
  );
  expect(found).toEqual([
    "pnpm 12.18.0, from 12.16.1",
    "node 26.14.0, from 26.13.0",
    "cf 1.0.0-beta.28, from 1.0.0-beta.21",
  ]);
});

test("a tool at its newest version isn't listed", async () => {
  const found = await heldTools(
    reference,
    versions({ pnpm: "12.16.1", node: "26.13.0", cf: "1.0.0-beta.21" }),
  );
  expect(found).toEqual([]);
});

test("a tool that couldn't be read is named, not skipped", async () => {
  const found = await heldTools(reference, versions({ pnpm: "12.16.1", cf: "1.0.0-beta.21" }));
  expect(found).toEqual(["node wasn't checked, since no version was read"]);
});

test("a release of a beta is left to the libraries' majors", async () => {
  const found = await heldTools(
    reference,
    versions({ pnpm: "12.16.1", node: "26.13.0", cf: "1.0.0" }),
  );
  expect(found).toEqual([]);
});

test("versions compare by their numbers, and a tag's number counts", () => {
  expect(later("12.18.0", "12.9.0")).toBe(true);
  expect(later("1.0.0-beta.28", "1.0.0-beta.21")).toBe(true);
  expect(later("1.0.0-beta.9", "1.0.0-beta.10")).toBe(false);
});
