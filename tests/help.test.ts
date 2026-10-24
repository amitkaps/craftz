/** @prose
 * # The commands' test
 *
 * Each command is stated once, in usage, and run in [cli.ts](../src/cli.ts). The commands cli.ts
 * dispatches have to be the ids usage states, both ways, so a command can't ship without its docs
 * or the docs keep one that's gone. The README has to link each one, and `craftz help` has to say
 * how each is run.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { commands, help, helpOn } from "../src/stated.ts";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const stated = commands().map((c) => c.id);

test("cli.ts runs each command usage states, and no other", () => {
  const run = [...read("../src/cli.ts").matchAll(/command === "([a-z]+)"/g)].map((m) => m[1]);
  expect(new Set(run)).toEqual(new Set(stated));
});

test("the README links each command", () => {
  const readme = read("../README.md");
  expect(stated.filter((id) => !readme.includes(`(docs/usage.md#${id})`))).toEqual([]);
});

test("help lists each command, and prints one's section", () => {
  for (const c of commands()) expect(help()).toContain(c.label);
  expect(helpOn("deps")).toMatch(/^## What's installed\n/);
  expect(helpOn("deps")).toContain("https://craftz.amitkaps.com/docs/usage.md#deps");
  expect(helpOn("nothing")).toBeUndefined();
});
