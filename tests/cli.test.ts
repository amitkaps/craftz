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
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, expect, inject, test } from "vite-plus/test";
import { write } from "../src/new.ts";
import { usePacked } from "./packed.ts";

const dir = join(mkdtempSync(join(tmpdir(), "craftz-cli-")), "example");
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
});

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
