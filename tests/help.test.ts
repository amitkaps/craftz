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
import { SCRIPTS, SPECS } from "../src/args.ts";
import { commands, help, helpOn, scriptHelp } from "../src/stated.ts";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const stated = commands().commands.map((c) => c.id);

test("each command usage states has a spec for its arguments, and no other has", () => {
  expect(new Set(Object.keys(SPECS))).toEqual(new Set(stated));
});

test("a script of a checkout has a usage heading that holds its help", () => {
  for (const [name, spec] of Object.entries(SCRIPTS)) {
    expect([name, scriptHelp(spec.heading)]).toEqual([name, expect.stringContaining(spec.run)]);
  }
});

test("the README links each command", () => {
  const readme = read("../README.md");
  expect(stated.filter((id) => !readme.includes(`(docs/usage.md#${id})`))).toEqual([]);
});

test("help lists each command, and prints one's section", () => {
  for (const c of commands().commands) expect(help()).toContain(c.label);
  expect(helpOn("deps")).toMatch(/^## What's installed\n/);
  expect(helpOn("deps")).toContain("https://craftz.amitkaps.com/docs/usage.md#deps");
  expect(helpOn("nothing")).toBeUndefined();
});
