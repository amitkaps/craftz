/** @prose
 * # The command's test
 *
 * Runs `craftz check` and `craftz fix` as a repository runs them, from the package
 * [packed.ts](packed.ts) packed, installed in a package that `pnpm new` writes, after taking its
 * `prepack` script out. check has to name the rule and fail, and fix has to put it
 * back, so the command and `pnpm align` can't disagree on what a fix does.
 *
 * fix has to name the one file it changed, and a second run has to change nothing.
 *
 * A hold in `package.json` makes a holdable rule's error a warning, and the check passes. A hold
 * on a rule that isn't holdable, or one with nothing to hold, fails it.
 *
 * `craftz new` runs from the package too, so the files it writes from have to be in it, and
 * `craftz help` reads usage from it.
 */
import { tmp } from "./temp.ts";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { here } from "../src/reference.ts";
import { join } from "node:path";
import { beforeAll, expect, inject, test } from "vite-plus/test";
import { write } from "../src/new.ts";
import { commands } from "../src/stated.ts";
import { usePacked } from "./packed.ts";

const dir = join(tmp("craftz-cli-"), "example");
const craftz = (...args: string[]) =>
  spawnSync(join(dir, "node_modules/.bin/craftz"), args, { cwd: dir, encoding: "utf8" });

beforeAll(async () => {
  await write(
    dir,
    "example",
    { package: true, site: false, private: false, internal: false },
    "An example, from craftz's test.",
  );
  const restore = usePacked(dir, inject("tarball"));
  execFileSync("pnpm", ["install"], { cwd: dir, stdio: "pipe" });
  restore();
}, 120_000);

test("check finds what fix puts back", () => {
  const file = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8")) as { scripts: Record<string, string> };
  delete pkg.scripts["prepack"];
  writeFileSync(file, JSON.stringify(pkg, null, 2));

  const checked = craftz("check", dir);
  expect(checked.status).toBe(1);
  expect(checked.stdout).toContain("    craftz: warning: releases-packing: prepack is undefined");
  expect(checked.stdout).toContain("craftz: `craftz rules <id>` prints the rule an id names");

  const fixed = craftz("fix", dir);
  expect([fixed.status, fixed.stdout]).toEqual([0, expect.stringContaining(`✓ ${dir}`)]);
  expect(fixed.stdout).toMatch(/^Changed:\n {4}package\.json\n/);

  const again = craftz("fix", dir);
  expect([again.status, again.stdout]).toEqual([0, expect.stringMatching(/^Changed nothing\./)]);
}, 30_000);

test("a repository's browser workflow is compared with the reference's", () => {
  const file = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8")) as { scripts: Record<string, string> };
  pkg.scripts["test:browser"] = "playwright test";
  writeFileSync(file, JSON.stringify(pkg, null, 2));
  const workflow = join(dir, ".github/workflows/browser.yml");
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });

  // Without the workflow the repository is told it has none.
  expect(craftz("check", dir).stdout).toContain("github-browser: no .github/workflows/browser.yml");

  // With the reference's, it isn't told anything, so the survey reads the file it has.
  copyFileSync(join(here, ".github/workflows/browser.yml"), workflow);
  expect(craftz("check", dir).stdout).not.toContain("github-browser");

  // The trigger is the repository's own, so a narrower one with `workflow_dispatch` kept is fine.
  const reference = readFileSync(workflow, "utf8");
  writeFileSync(
    workflow,
    reference.replace("branches: [main]", "branches: [main]\n    paths-ignore: ['**/*.md']"),
  );
  expect(craftz("check", dir).stdout).not.toContain("github-browser");

  // Without `workflow_dispatch` there is no run by hand, and a changed step isn't the trigger.
  writeFileSync(workflow, reference.replace("  workflow_dispatch:\n", ""));
  expect(craftz("check", dir).stdout).toContain(
    "github-browser: .github/workflows/browser.yml differs",
  );
  writeFileSync(workflow, reference.replace("timeout-minutes: 4", "timeout-minutes: 9"));
  expect(craftz("check", dir).stdout).toContain(
    "github-browser: .github/workflows/browser.yml differs",
  );

  // The later tests use the same folder, so it goes back as it was.
  rmSync(workflow);
  delete pkg.scripts["test:browser"];
  writeFileSync(file, JSON.stringify(pkg, null, 2));
}, 30_000);

test("a leftover e2e name is named, since the browser rule doesn't apply to it", () => {
  const file = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8")) as { scripts: Record<string, string> };
  pkg.scripts["test:e2e"] = "playwright test";
  writeFileSync(file, JSON.stringify(pkg, null, 2));
  const workflow = join(dir, ".github/workflows/e2e.yml");
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });
  writeFileSync(workflow, "name: E2E\n");

  const found = craftz("check", dir).stdout;
  expect(found).toContain("github-browser-renamed: the script test:e2e is test:browser now");
  expect(found).toContain("github-browser-renamed: .github/workflows/e2e.yml is");

  // The later tests use the same folder, so it goes back as it was.
  rmSync(workflow);
  delete pkg.scripts["test:e2e"];
  writeFileSync(file, JSON.stringify(pkg, null, 2));
  expect(craftz("check", dir).stdout).not.toContain("github-browser-renamed");
}, 30_000);

test("a rule prints with its address", () => {
  const { status, stdout } = craftz("rules", "releases-packing");
  expect([status, stdout]).toEqual([
    0,
    expect.stringMatching(
      /^- `releases-packing`: [^\n]+\n {2}https:\/\/craftz\.amitkaps\.com\/docs\/rules\.md#releases-packing\n$/,
    ),
  ]);
});

test("new runs from the package, with the files it writes", () => {
  const craftzDir = join(dir, "node_modules/@amitkaps/craftz");
  expect(["reference/gitignore", "LICENSE"].filter((f) => !existsSync(join(craftzDir, f)))).toEqual(
    [],
  );
  const { status, stderr } = craftz("new");
  expect([status, stderr]).toEqual([1, expect.stringMatching(/^Usage: craftz new /)]);
});

test("a hold lets a holdable rule's warning pass, with its reason", () => {
  const file = join(dir, "package.json");
  const original = readFileSync(file, "utf8");
  const pkg = JSON.parse(original) as {
    devDependencies: Record<string, string>;
    craftz?: { hold: Record<string, string> };
  };
  try {
    pkg.devDependencies["@types/node"] = "25.9.3";
    pkg.craftz = { hold: { "versions-types-node": "A tool needs 25. Move when it takes 26." } };
    writeFileSync(file, JSON.stringify(pkg, null, 2));
    const held = craftz("check", dir);
    expect([held.status, held.stdout]).toEqual([
      0,
      expect.stringContaining("craftz: warning: versions-types-node: "),
    ]);
    expect(held.stdout).toContain("; held: A tool needs 25.");

    pkg.craftz = { hold: { "scripts-verify": "A choice." } };
    writeFileSync(file, JSON.stringify(pkg, null, 2));
    const choice = craftz("check", dir);
    expect([choice.status, choice.stdout]).toEqual([
      1,
      expect.stringContaining("scripts-verify: is held, but it isn't"),
    ]);

    pkg.devDependencies["@types/node"] = JSON.parse(original).devDependencies["@types/node"];
    pkg.craftz = { hold: { "versions-types-node": "Nothing left to hold." } };
    writeFileSync(file, JSON.stringify(pkg, null, 2));
    const stale = craftz("check", dir);
    expect([stale.status, stale.stdout]).toEqual([1, expect.stringContaining("drop the hold")]);
  } finally {
    writeFileSync(file, original);
  }
  // Three checks in a row, beside new's verify runs, can pass five seconds.
}, 30_000);

test("upgrade leaves craftz itself to pnpm bump", () => {
  const root = join(import.meta.dirname, "..");
  const upgraded = spawnSync("node", ["src/cli.ts", "upgrade"], { cwd: root, encoding: "utf8" });
  expect(upgraded.status).toBe(1);
  expect(upgraded.stderr).toContain("pnpm bump");
});

test("release asks for a version before it reads GitHub", () => {
  const released = craftz("release", "next");
  expect(released.status).toBe(1);
  expect(released.stderr).toContain("craftz release <X.Y.Z>");
});

test("help reads usage from the package", () => {
  const one = craftz("help", "deps");
  expect([one.status, one.stdout]).toEqual([0, expect.stringContaining("## What's installed")]);
  const none = craftz("help", "nothing");
  expect([none.status, none.stderr]).toEqual([1, expect.stringContaining("no command `nothing`")]);
});

test("every command prints its help for --help, and -h is the same flag", () => {
  const asked = [...commands().commands.map((c) => [c.id, "--help"]), ["pr", "-h"]];
  for (const [id, flag] of asked) {
    const out = craftz(id ?? "", flag ?? "");
    expect([id, flag, out.status, out.stdout]).toEqual([
      id,
      flag,
      0,
      expect.stringContaining(`craftz ${id}`),
    ]);
  }
}, 60_000);

test("the word help after pr or release is an error, and never starts a branch", () => {
  const pr = craftz("pr", "help");
  expect([pr.status, pr.stderr]).toEqual([1, expect.stringContaining("pnpm pr --help")]);
  const dashed = craftz("pr", "--", "help");
  expect(dashed.status).toBe(1);
  const release = craftz("release", "help");
  expect([release.status, release.stderr]).toEqual([1, expect.stringContaining("<X.Y.Z>")]);
});

test("pr wants one title, in words, before it touches git", () => {
  const both = craftz("pr", "--title", "one", "two");
  expect([both.status, both.stderr]).toEqual([1, expect.stringContaining("Give a title once")]);
  const none = craftz("pr", "--wait");
  expect([none.status, none.stderr]).toEqual([1, expect.stringContaining("Give a title once")]);
  const empty = craftz("pr", "--title", "!!!");
  expect([empty.status, empty.stderr]).toEqual([
    1,
    expect.stringContaining("no letters or digits"),
  ]);
});
