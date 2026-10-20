/** @prose
 * # The generator's test
 *
 * Writes a package, a site, a package with a site, scripts in a private repository and an
 * internal site in a public one, the way `pnpm new` does. Each is checked against the survey and
 * runs its `verify`. If the rules change and the generator doesn't follow, this fails here,
 * before a new repository starts out of line.
 *
 * Each one depends on craftz at this checkout's version, which npm doesn't have while it's being
 * released. An override in its pnpm settings installs this checkout instead, so the test runs
 * the craftz it's testing, and `package.json` stays as `new` wrote it. It's built first, since
 * its exports are the build, and `verify` builds after the tests.
 */
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { beforeAll, expect, test } from "vite-plus/test";
import { type Start, write } from "../src/new.ts";
import { checkFolder } from "../src/survey.ts";

const here = resolve(import.meta.dirname, "..");
beforeAll(() => {
  execFileSync("pnpm", ["run", "build"], { cwd: here, stdio: "pipe" });
}, 120_000);

const starts: [string, Start][] = [
  ["a package", { package: true, site: false, private: false, internal: false }],
  ["a static site", { package: false, site: true, private: false, internal: false }],
  ["a package with a site", { package: true, site: true, private: false, internal: false }],
  [
    "scripts in a private repository",
    { package: false, site: false, private: true, internal: false },
  ],
  ["an internal site", { package: false, site: true, private: false, internal: true }],
];

// Each runs in a folder of its own, so they run at once, which takes a minute off `verify`.
for (const [what, start] of starts) {
  test.concurrent(`${what} follows the rules and passes verify`, { timeout: 300_000 }, async () => {
    const dir = join(mkdtempSync(join(tmpdir(), "craftz-new-")), "example");
    await write(dir, "example", start, "An example, from craftz's test.");
    const { findings, worker } = await checkFolder(dir);
    expect(findings.flatMap((f) => f.drift)).toEqual([]);
    // Every site answers only on its domain, internal or not.
    if (worker) expect([worker.workersDev, worker.previewUrls]).toEqual([false, false]);
    expect(worker?.deploys).toBe(start.site ? "static" : undefined);
    const settings = join(dir, "pnpm-workspace.yaml");
    const craftz = `  "@amitkaps/craftz": "link:${here}"`;
    writeFileSync(
      settings,
      readFileSync(settings, "utf8").replace(/^overrides:\n/m, `$&${craftz}\n`),
    );
    const run = (...args: string[]) =>
      promisify(execFile)("pnpm", args, { cwd: dir, maxBuffer: 64 * 1024 * 1024 });
    await run("install");
    await run("run", "fix");
    await run("run", "verify");
  });
}
