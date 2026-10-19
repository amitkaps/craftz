/** @prose
 * # The pull request commands' test
 *
 * Holds `craftz pr` and `craftz gone` to what they read from git and the notes config, without
 * running git. The fix that moves a repository onto them is tested too, since it deletes files.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { goneIn } from "../src/gone.ts";
import { branchOf, labelsIn } from "../src/pr.ts";
import { here } from "../src/reference.ts";
import { RULES } from "../src/rules.ts";

test("a pull request's labels are the ones the notes group by", () => {
  const notes = readFileSync(join(here, "package", ".github", "release.yml"), "utf8");
  expect(labelsIn(notes)).toEqual(["internal", "breaking", "added", "fixed", "improved", "docs"]);
});

test("a branch is named after the title, at most 48 characters", () => {
  expect(branchOf("Docs point at craftz, not ship!")).toBe("docs-point-at-craftz-not-ship");
  expect(branchOf("a ".repeat(30))).toBe("a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a");
});

test("only branches whose upstream is gone are deleted", () => {
  expect(goneIn("main \nmerged [gone]\nahead [ahead 1]\nold [gone]")).toEqual(["merged", "old"]);
});

test("the fix runs the commands and deletes the copied scripts", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-pr-"));
  const scripts = { pr: "node scripts/pr.ts", gone: "node scripts/gone.ts" };
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", scripts }));
  mkdirSync(join(dir, "scripts"));
  for (const file of ["pr.ts", "gone.ts"]) writeFileSync(join(dir, "scripts", file), "");
  writeFileSync(join(dir, "scripts", "README.md"), "# Scripts\n\n[pr.ts](pr.ts)\n");
  for (const r of RULES)
    if (r.id.match(/^scripts-(pr|gone)$/) && r.fix?.in === "files") r.fix.apply(dir, here);
  expect(existsSync(join(dir, "scripts"))).toBe(false);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  expect(pkg.scripts).toEqual({ pr: "craftz pr", gone: "craftz gone" });
});

test("a scripts folder with the repository's own scripts stays", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-pr-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
  mkdirSync(join(dir, "scripts"));
  for (const file of ["pr.ts", "own.ts"]) writeFileSync(join(dir, "scripts", file), "");
  for (const r of RULES) if (r.id === "scripts-pr" && r.fix?.in === "files") r.fix.apply(dir, here);
  expect(existsSync(join(dir, "scripts", "pr.ts"))).toBe(false);
  expect(existsSync(join(dir, "scripts", "own.ts"))).toBe(true);
});
