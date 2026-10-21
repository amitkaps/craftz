/** @prose
 * # The command's test
 *
 * Runs `craftz check` and `craftz fix` from source on a package that `pnpm new` writes, after
 * taking its `prepack` script out. check has to name the rule and fail, and fix has to put it
 * back, so the command and `pnpm align` can't disagree on what a fix does.
 *
 * fix has to name the one file it changed, and a second run has to change nothing.
 *
 * A folder is the repository its `origin` names, whatever the folder is called, so a worktree
 * gets its repository's holds.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { expect, test } from "vite-plus/test";
import { write } from "../src/new.ts";
import { repoIn } from "../src/survey.ts";

const craftz = (...args: string[]) =>
  spawnSync("node", [join(import.meta.dirname, "../src/cli.ts"), ...args], { encoding: "utf8" });

test("check finds what fix puts back", { timeout: 60_000 }, async () => {
  const dir = join(mkdtempSync(join(tmpdir(), "craftz-cli-")), "example");
  await write(
    dir,
    "example",
    { package: true, site: false, private: false, internal: false },
    "An example, from craftz's test.",
  );
  const file = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8")) as { scripts: Record<string, string> };
  delete pkg.scripts["prepack"];
  writeFileSync(file, JSON.stringify(pkg, null, 2));

  const checked = craftz("check", dir);
  expect(checked.status).toBe(1);
  expect(checked.stdout).toContain("releases-packing: prepack is undefined");
  expect(checked.stdout).toContain("see: craftz rules releases-packing");

  const fixed = craftz("fix", dir);
  expect([fixed.status, fixed.stdout]).toEqual([0, expect.stringContaining(`✓ ${dir}`)]);
  expect(fixed.stdout).toMatch(/^Changed:\n {4}package\.json\n/);

  const again = craftz("fix", dir);
  expect([again.status, again.stdout]).toEqual([0, expect.stringMatching(/^Changed nothing\./)]);
});

test("a rule prints with its part", () => {
  const { status, stdout } = craftz("rules", "releases-packing");
  expect([status, stdout]).toEqual([0, expect.stringMatching(/^releases-packing, under /)]);
});

test("a folder is the repository its origin names", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-worktree-"));
  const git = (...args: string[]) => spawnSync("git", ["-C", dir, ...args]);
  git("init", "-q");
  expect(repoIn(dir)).toBe(basename(dir));
  git("remote", "add", "origin", "git@github.com:amitkaps/base.git");
  expect(repoIn(dir)).toBe("base");
});
