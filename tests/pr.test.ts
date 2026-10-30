/** @prose
 * # The pull request commands' test
 *
 * Holds `craftz pr` and `craftz gone` to what they read from git and the notes config, without
 * running git. The fix that moves a repository onto them is tested too, since it deletes files.
 * Writing the outline runs in a new repository, once with prose installed and once without.
 */
import { tmp } from "./temp.ts";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vite-plus/test";
import { goneIn, keptBecause, writeOutline } from "../src/gone.ts";
import { branchOf, joined, labelsIn, startOn, timingOf, titled, took } from "../src/pr.ts";
import { here } from "../src/reference.ts";
import { RULES } from "../src/rules.ts";

test("a pull request's labels are the ones the notes group by", () => {
  const notes = readFileSync(join(here, "package", ".github", "notes.yml"), "utf8");
  expect(labelsIn(notes)).toEqual(["internal", "breaking", "added", "fixed", "improved", "docs"]);
});

test("a branch is named after the title, at most 48 characters", () => {
  expect(branchOf("Docs point at craftz, not ship!")).toBe("docs-point-at-craftz-not-ship");
  expect(branchOf("a ".repeat(30))).toBe("a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a-a");
});

test("branches whose upstream is gone are deleted, with their worktrees", () => {
  const refs = "main\t\t/repo\nmerged\t[gone]\t\nahead\t[ahead 1]\t\nold\t[gone]\t/repo moved";
  expect(goneIn(refs)).toEqual([{ branch: "merged" }, { branch: "old", worktree: "/repo moved" }]);
});

test("a branch whose last commit merged is deleted, with or without an upstream", () => {
  const refs = [
    "main\t\t/repo\tm1",
    "kept\t\t\ta1",
    "checkout\t\t\tb1",
    "squashed\t[ahead 3]\t\tc1",
    "after\t[ahead 1]\t\tc2",
  ].join("\n");
  const merged = (commit: string) => ["m1", "b1", "c1"].includes(commit);
  expect(goneIn(refs, merged)).toEqual([{ branch: "checkout" }, { branch: "squashed" }]);
});

test("the outline is written only where prose is installed", () => {
  const dir = tmp("craftz-outline-");
  execFileSync("git", ["init", "--quiet"], { cwd: dir });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
  writeOutline(dir);
  expect(existsSync(join(dir, "outline.md"))).toBe(false);
  const bin = join(dir, "node_modules", ".bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "prose"), '#!/bin/sh\necho "# Outline" > outline.md\n');
  chmodSync(join(bin, "prose"), 0o755);
  writeOutline(dir);
  expect(readFileSync(join(dir, "outline.md"), "utf8")).toBe("# Outline\n");
});

test("the fix runs the commands and deletes the copied scripts", () => {
  const dir = tmp("craftz-pr-");
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
  const dir = tmp("craftz-pr-");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
  mkdirSync(join(dir, "scripts"));
  for (const file of ["pr.ts", "own.ts"]) writeFileSync(join(dir, "scripts", file), "");
  for (const r of RULES) if (r.id === "scripts-pr" && r.fix?.in === "files") r.fix.apply(dir, here);
  expect(existsSync(join(dir, "scripts", "pr.ts"))).toBe(false);
  expect(existsSync(join(dir, "scripts", "own.ts"))).toBe(true);
});

test("a branch's pull request decides where a change goes", () => {
  const pr = (state: string, title = "Plan") => ({ number: 55, title, state });
  expect(startOn("main", "Fix")).toEqual({ from: "main" });
  expect(startOn("by-hand", "Fix")).toEqual({ from: "here" });
  expect(startOn("plan", "Plan", pr("OPEN"))).toEqual({ from: "here" });
  expect(startOn("plan", "Fix", pr("OPEN"))).toEqual({ from: "merge" });
  expect(startOn("plan", "Fix", pr("MERGED"))).toEqual({ from: "origin" });
  expect(startOn("plan", "Fix", pr("CLOSED"))).toHaveProperty("stop");
});

test("a body or label is read as given, even one that opens with a dash", () => {
  expect(joined(["t", "--body", "- a list", "--label", "fixed", "--wait"])).toEqual([
    "t",
    "--body=- a list",
    "--label=fixed",
    "--wait",
  ]);
  expect(joined(["t", "--body=-x", "--body"])).toEqual(["t", "--body=-x", "--body"]);
});

test("a merge says what CI took, the runs a fall behind added, and the wait after it passed", () => {
  expect([took(41_400), took(60_000), took(662_000), took(59_100_000)]).toEqual([
    "41s",
    "1m 0s",
    "11m 2s",
    "16h 25m",
  ]);
  const check = (name: string, startedAt: string, completedAt: string, conclusion = "SUCCESS") => ({
    name,
    conclusion,
    startedAt: `2026-10-24T12:${startedAt}Z`,
    completedAt: `2026-10-24T12:${completedAt}Z`,
  });
  const pr = {
    state: "MERGED",
    mergeStateStatus: "UNKNOWN",
    mergedAt: "2026-10-24T12:13:00Z",
    statusCheckRollup: [
      check("ci", "00:00", "00:02", "CANCELLED"),
      check("ci", "00:05", "00:50"),
      check("label", "00:05", "01:00"),
    ],
  };
  expect(timingOf(pr)).toBe("CI took 45s, merged 12m 0s after it passed");
  expect(timingOf(pr, 1)).toBe("CI took 45s, ran 2 times, merged 12m 0s after it passed");
  expect(timingOf({ ...pr, mergedAt: undefined, statusCheckRollup: [] })).toBe("");
});

test("a change goes into the open pull request with its exact title", () => {
  const open = [
    { title: "v0.9.0 notes", headRefName: "notes" },
    { title: "v0.9.0", headRefName: "release-0.9.0" },
  ];
  expect(titled(open, "v0.9.0")).toEqual({ title: "v0.9.0", headRefName: "release-0.9.0" });
  expect(titled(open, "v0.9")).toBeUndefined();
});

test("a checkout is caught up on main or a merged branch, and kept with changes or work of its own", () => {
  const merged = [{ branch: "done" }];
  expect(keptBecause("", "main", merged)).toBeUndefined();
  expect(keptBecause("", "done", merged)).toBeUndefined();
  expect(keptBecause(" M src/a.ts", "main", merged)).toBe("kept, with uncommitted changes");
  expect(keptBecause("", "work", merged)).toBe("kept, on work, which hasn't merged");
});

// A step exits the process, so it runs in one of its own. Before, a failed `verify` ended in Node's
// stack trace, which hid the output that said why.
test("a step that fails stops with one line, not a stack trace", () => {
  const gone = pathToFileURL(join(import.meta.dirname, "../src/gone.ts")).href;
  const script = `import { step } from "${gone}"; step(process.execPath, "-e", "process.exit(3)");`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
  });
  expect(run.status).toBe(1);
  expect(run.stderr.trim().split("\n")).toHaveLength(1);
  expect(run.stderr).toContain("failed, and its output above says why");
});
