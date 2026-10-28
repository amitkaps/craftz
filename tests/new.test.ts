/** @prose
 * # The generator's test
 *
 * Writes a package, a site, a package with a site, scripts in a private repository and an
 * internal site in a private one, the way `pnpm new` does, and checks each against the survey. If
 * the rules change and the generator doesn't follow, this fails here, before a new repository
 * starts out of line.
 *
 * Only two of them run their `verify`, since that's where the time goes, about 15 seconds each.
 * A package with a site is the only one that packs and builds a prose site. An internal site in a
 * private repository is the only one Vite builds from an `index.html`. The other three run a part
 * of what these two do. Being private only leaves out the licence, and being internal only changes
 * what `cloudflare.config.ts` says, which the survey reads.
 *
 * Each one depends on craftz at this checkout's version, which npm doesn't have while it's being
 * released. An override in its pnpm settings installs the package [packed.ts](packed.ts) packed
 * instead, so the test runs the craftz it's releasing, as a repository would install it, and
 * `package.json` stays as `new` wrote it. `new` writes it formatted, so `verify` passes with no
 * `fix` first.
 *
 * The reference holds `.gitignore` as `gitignore`, since npm leaves the dotted one out of a
 * package, and it has to stay craftz's own.
 */
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, inject, test } from "vite-plus/test";
import { type Start, write } from "../src/new.ts";
import { here, root } from "../src/reference.ts";
import { checkFolder } from "../src/survey.ts";
import { usePacked } from "./packed.ts";

const shapes: [string, Start][] = [
  ["a package", { package: true, site: false, private: false, internal: false }],
  ["a static site", { package: false, site: true, private: false, internal: false }],
  ["a package with a site", { package: true, site: true, private: false, internal: false }],
  [
    "scripts in a private repository",
    { package: false, site: false, private: true, internal: false },
  ],
  [
    "an internal site in a private repository",
    { package: false, site: true, private: true, internal: true },
  ],
];

// Writes a shape the way `new` does, into a folder of its own.
async function started(start: Start): Promise<string> {
  const dir = join(mkdtempSync(join(tmpdir(), "craftz-new-")), "example");
  await write(dir, "example", start, "An example, from craftz's test.");
  return dir;
}

for (const [what, start] of shapes) {
  test(`${what} follows the rules`, async () => {
    const { findings, worker } = await checkFolder(await started(start));
    expect(findings.flatMap((f) => f.drift)).toEqual([]);
    // Every site answers only on its domain, internal or not.
    if (worker) expect([worker.workersDev, worker.previewUrls]).toEqual([false, false]);
    expect(worker?.deploys).toBe(start.site ? "static" : undefined);
  });
}

// The two shapes that build differently, so between them every step a new repository's verify
// takes runs here.
const verified = shapes.filter(([what]) =>
  ["a package with a site", "an internal site in a private repository"].includes(what),
);

// Each runs in a folder of its own, so they run at once.
for (const [what, start] of verified) {
  test.concurrent(`${what} passes verify`, { timeout: 300_000 }, async () => {
    const dir = await started(start);
    const restore = usePacked(dir, inject("tarball"));
    const run = (...args: string[]) =>
      promisify(execFile)("pnpm", args, { cwd: dir, maxBuffer: 64 * 1024 * 1024 });
    await run("install");
    restore();
    // A prose site builds from a commit, so new commits before verify, as here, under a name of
    // its own where CI has none.
    const as = {
      ...process.env,
      GIT_AUTHOR_NAME: "craftz",
      GIT_AUTHOR_EMAIL: "craftz@example.com",
    };
    const env = { ...as, GIT_COMMITTER_NAME: "craftz", GIT_COMMITTER_EMAIL: "craftz@example.com" };
    const git = (...args: string[]) => promisify(execFile)("git", args, { cwd: dir, env });
    await git("add", "-A");
    await git("commit", "-q", "-m", "Start");
    await expect(run("run", "verify")).resolves.toBeTruthy();
  });
}

test("the reference's gitignore is craftz's own", () => {
  const read = (file: string): string => readFileSync(file, "utf8");
  expect(read(join(here, "gitignore"))).toBe(read(join(root, ".gitignore")));
});
