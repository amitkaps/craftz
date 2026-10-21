/** @prose
 * # Align
 *
 * Brings repositories in line with the released craftz: `pnpm align` does every one
 * [listed](survey.ts) by its topic, and `pnpm align markz` does one. It's what writes, where
 * [drift.ts](drift.ts) only reads, and it needs `gh` logged in as the owner.
 *
 * `pnpm bump` runs it on craftz alone, which moves the reference to the newest versions. That
 * comes before a release, and `pnpm align` after it, so a release carries the newest versions
 * and the others take them as soon as it's out.
 *
 * Each repository gets two things. Its settings outside the files, on GitHub and on its Worker,
 * are written directly and read back by [apply.ts](apply.ts), since there's no file to review. Its files
 * change in a pull request, from a fresh clone of `main` in a temporary folder, so a checkout on
 * a branch of its own is never touched. The pull request opens only when `verify` passes, with
 * auto-merge on, so CI merges it. One that fails leaves its clone and log for a look.
 *
 * Running it twice changes nothing the second time, and a repository already in line gets no
 * pull request. A run ends by waiting for its pull requests to merge.
 *
 * `--local` stops each repository before anything leaves the laptop: no push, no pull request and
 * no settings written. Its clone keeps the changes, with `verify` run, so they can be read or
 * compared with another run.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { writeSettings } from "./apply.ts";
import { fixFiles } from "./rules.ts";
import { CRAFTZ, OWNER, TOOLS } from "./reference.ts";
import { repos } from "./survey.ts";
import { workerIn } from "./worker.ts";
import { cloudflareLogin, githubLogin } from "./settings.ts";

const SELF = "craftz";
const run = promisify(execFile);

if (!githubLogin()) {
  console.error("pnpm align needs gh logged in as the owner.");
  process.exit(1);
}
const noCloudflare = cloudflareLogin();
if (noCloudflare) console.log(`not written: the Workers' build settings, since ${noCloudflare}`);

const args = process.argv.slice(2);
const local = args.includes("--local");
const named = args.filter((arg) => arg !== "--local");
const targets = named.length ? named : await repos();
const work = mkdtempSync(join(tmpdir(), "align-"));

type Pkg = {
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
type Deps = Record<string, string>;

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const depsOf = (pkg: Pkg): Deps => ({ ...pkg.dependencies, ...pkg.devDependencies });

// Runs a command in a clone, with its output kept in the repository's log.
async function sh(dir: string, log: string[], cmd: string, ...args: string[]): Promise<string> {
  log.push(`$ ${cmd} ${args.join(" ")}`);
  try {
    const { stdout, stderr } = await run(cmd, args, { cwd: dir, maxBuffer: 64 << 20 });
    log.push(stdout, stderr);
    return stdout;
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };
    log.push(stdout, stderr);
    throw error;
  }
}

/** @prose
 * # Updates
 *
 * A repository's own libraries, like zod or happy-dom, move to their newest release within the
 * major version they're on, which pnpm's one-day wait allows.
 *
 * A new major can change what the code has to do, so it's listed in the pull request rather than taken. Below 1.0, a minor counts as a
 * major, as npm's ranges treat it.
 *
 * A pre-release is pinned by hand, as [development.md](../docs/development.md#beta-packages)
 * says, since its tags don't say which build goes with which. Once npm's latest for it is a
 * release at its major or later, that's listed too.
 */
const major = (version: string): number => Number(version.split(".")[0]);

function breaking(from: string, to: string): boolean {
  const [a = 0, b = 0] = from.split(".").map(Number);
  const [c = 0, d = 0] = to.split(".").map(Number);
  return a !== c || (a === 0 && b !== d);
}

async function update(dir: string, log: string[], skip: string[]): Promise<string[]> {
  let out: string;
  try {
    out = await sh(dir, log, "pnpm", "outdated", "--format", "json");
  } catch (error) {
    // pnpm outdated exits 1 when anything is outdated, with the list on stdout.
    out = (error as { stdout?: string }).stdout ?? "{}";
  }
  const found = JSON.parse(out || "{}") as Record<string, { current: string; latest: string }>;
  const minor: string[] = [];
  const majors: string[] = [];
  for (const [name, { current, latest }] of Object.entries(found)) {
    if (skip.includes(name)) continue;
    if (current.includes("-")) {
      if (!latest.includes("-") && major(latest) >= major(current)) {
        majors.push(`${name} ${latest}, a release of the beta ${current}`);
      }
      continue;
    }
    if (breaking(current, latest)) majors.push(`${name} ${latest}, from ${current}`);
    else minor.push(name);
  }
  if (minor.length) await sh(dir, log, "pnpm", "update", "--latest", ...minor);
  return majors;
}

/** @prose
 * # craftz itself
 *
 * The rules' versions are the reference's, in [reference/](../reference/README.md), so
 * `pnpm bump` moves them in craftz's own pull request, and craftz is fixed from source against
 * its new reference. The others take those versions only once craftz is released.
 *
 * The reference is installed where it stands, as a project of its own, and moves its libraries and
 * tools as above, and the Vite+ override with `vite-plus`. What the install writes there is
 * removed, so only `package.json` and `pnpm-workspace.yaml` change. Every tool is in its
 * `package.json`, wrangler too, so one update moves them all, within pnpm's one-day wait, and each
 * stays exact.
 */
async function updateReference(dir: string, log: string[]): Promise<string[]> {
  try {
    return await moveReference(dir, log);
  } finally {
    rmSync(join(dir, "node_modules"), { recursive: true, force: true });
    rmSync(join(dir, "pnpm-lock.yaml"), { force: true });
  }
}

async function moveReference(dir: string, log: string[]): Promise<string[]> {
  await sh(dir, log, "pnpm", "install", "--ignore-scripts");
  const majors = await update(dir, log, []);
  const vitePlus = depsOf(readJson<Pkg>(join(dir, "package.json")))["vite-plus"];
  const workspace = join(dir, "pnpm-workspace.yaml");
  writeFileSync(
    workspace,
    readFileSync(workspace, "utf8").replace(/vite-plus-core@[\w.-]+/, `vite-plus-core@${vitePlus}`),
  );
  return majors;
}

/** @prose
 * # Another repository
 *
 * Each clone installs first, as any fresh clone does, which runs its `prepare`, like base's
 * generated types. `pnpm add` doesn't run it. Then it moves to the latest craftz on npm and runs
 * that version's `craftz fix`. So the rules it's fixed to are the ones it moves to, and a change in
 * craftz reaches nobody until it's released.
 *
 * The fix brings that version's holds, like base's TypeScript, and changes nothing that's in line
 * already. What it leaves to do by hand fails `verify`, which runs `craftz check`.
 */
async function alignTo(dir: string, repo: string, log: string[]): Promise<string[]> {
  if (repo === SELF) {
    const std = join(dir, "reference");
    const majors = await updateReference(std, log);
    fixFiles(dir, std);
    await sh(dir, log, "pnpm", "install");
    return [...majors, ...(await update(dir, log, [...TOOLS, "vite-plus"]))];
  }
  await sh(dir, log, "pnpm", "install");
  await sh(dir, log, "pnpm", "add", "--save-dev", "--save-exact", `${CRAFTZ}@latest`);
  // fix exits 1 when something's left to do by hand, which verify reports.
  await sh(dir, log, "pnpm", "exec", "craftz", "fix").catch(() => undefined);
  await sh(dir, log, "pnpm", "install");
  return update(dir, log, [...TOOLS, "vite-plus", CRAFTZ]);
}

/** @prose
 * # The pull request
 *
 * After the changes, the clone installs, checks its lockfile the way CI does, writes the format
 * and lint fixes, and runs `verify`. A clean tree means the repository was already in line.
 *
 * The pull request lists every version that moved, read from `package.json` before and after, and the
 * majors left for review. It's opened from a branch named `align`, which a later run updates
 * rather than opening a second one.
 *
 * The repositories clone and install side by side, but `verify` runs one at a time. markz's
 * timing tests failed when five ran at once, since they measured a busy machine, not the code.
 */
type Outcome = { repo: string; lines: string[]; failed?: string; pr?: string };

let turn: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = turn.then(task);
  turn = run.catch(() => undefined);
  return run;
}

async function files(repo: string): Promise<Outcome> {
  const dir = join(work, repo);
  const log: string[] = [];
  const lines: string[] = [];
  const logFile = join(work, `${repo}.log`);
  try {
    await sh(work, log, "gh", "repo", "clone", `${OWNER}/${repo}`, dir, "--", "--quiet");
    const before = depsOf(readJson<Pkg>(join(dir, "package.json")));
    const majors = await alignTo(dir, repo, log);
    await sh(dir, log, "pnpm", "install", "--frozen-lockfile");
    await sh(dir, log, "pnpm", "run", "fix");

    // trimEnd, since each line opens with a status column that may be a space.
    const changed = (await sh(dir, log, "git", "status", "--porcelain")).trimEnd();
    if (!changed) return { repo, lines: ["in line"] };

    const after = depsOf(readJson<Pkg>(join(dir, "package.json")));
    const moved = Object.keys(after)
      .filter((name) => before[name] !== after[name])
      .map((name) => `${name} ${after[name]}, from ${before[name] ?? "nothing"}`);
    const other = changed
      .split("\n")
      .filter((line) => !["package.json", "pnpm-lock.yaml"].includes(line.slice(3)))
      .map((line) => `${line.slice(3)} ${line.startsWith(" D") ? "deleted" : "from craftz"}`);

    // Staged first, so verify sees what the commit will hold: a check that lists files with git,
    // like prose's lexer test, would otherwise still find the ones a fix deleted.
    await sh(dir, log, "git", "add", "-A");
    await oneAtATime(() => sh(dir, log, "pnpm", "run", "verify"));
    if (local) {
      lines.push(
        ...moved,
        ...other,
        ...majors.map((m) => `left for review: ${m}`),
        `clone: ${dir}`,
      );
      return { repo, lines };
    }

    const pkg = readJson<Pkg>(join(dir, "package.json"));
    const body = [
      "Brings this repository in line with craftz's rules, from `pnpm align`.",
      "",
      ...[...moved, ...other].map((line) => `- ${line}`),
      ...(majors.length
        ? ["", "New majors, left for review:", "", ...majors.map((line) => `- ${line}`)]
        : []),
      "",
      "`verify` passed on this branch before it was pushed.",
    ].join("\n");
    await sh(dir, log, "git", "checkout", "-b", "align");
    await sh(dir, log, "git", "add", "-A");
    await sh(dir, log, "git", "commit", "-m", "Align with craftz", "--quiet");
    await sh(dir, log, "git", "push", "--force", "-u", "origin", "align", "--quiet");
    let url: string;
    try {
      const label = pkg.private ? [] : ["--label", "internal"];
      url = await sh(
        dir,
        log,
        "gh",
        "pr",
        "create",
        "--title",
        "Align with craftz",
        "--body",
        body,
        ...label,
      );
    } catch {
      url = await sh(dir, log, "gh", "pr", "view", "align", "--json", "url", "-q", ".url");
      await sh(dir, log, "gh", "pr", "edit", "align", "--body", body);
    }
    await sh(dir, log, "gh", "pr", "merge", "align", "--auto", "--squash");
    lines.push(...moved, ...other, ...majors.map((m) => `left for review: ${m}`), url.trim());
    return { repo, lines, pr: url.trim() };
  } catch (error) {
    writeFileSync(logFile, log.join("\n"));
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { repo, lines, failed: `${reason}\n      log: ${logFile}\n      clone: ${dir}` };
  }
}

/** @prose
 * # Settings
 *
 * GitHub's settings are written for every repository, with each rule's fix on GitHub, like
 * `github-rules`, and a site's Worker settings when `cf` is logged in.
 *
 * Whether a repository is a package, and the name of its Worker, are read from the clone, after
 * its pull request, so they're what `main` is about to hold. Classic branch protection is removed
 * without asking,
 * since these repositories are ones the rules already own.
 */
async function settings(repo: string): Promise<string[]> {
  const dir = join(work, repo);
  const pkg = existsSync(join(dir, "package.json")) ? readJson<Pkg>(join(dir, "package.json")) : {};
  // align says once, at the start, why the Workers aren't written.
  const site = noCloudflare ? undefined : workerIn(dir);
  return writeSettings({ repo, pkg, site }, true);
}

const outcomes = await Promise.all(targets.map((repo) => files(repo)));

let failed = false;
for (const outcome of outcomes) {
  const lines = [
    ...outcome.lines,
    ...(local || outcome.failed ? [] : await settings(outcome.repo)),
  ];
  failed ||= Boolean(outcome.failed);
  console.log(outcome.failed ? `✗ ${outcome.repo}` : `✓ ${outcome.repo}`);
  for (const line of lines) console.log(`    ${line}`);
  if (outcome.failed) console.log(`    failed: ${outcome.failed}`);
}

/** @prose
 * # Waiting for the merges
 *
 * A run ends when its pull requests have merged, so its report says what `main` now holds.
 *
 * It asks GitHub every ten seconds, as `pnpm pr --wait` does. A check counts by its latest run,
 * since adding a label starts a new run that cancels the old one. One that falls behind `main` has
 * its branch updated, as `pnpm pr --wait` does. A pull request that fails or
 * closes is reported and not waited for.
 */
type Check = { name?: string; conclusion?: string; startedAt?: string };
const FAILED = ["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"];

async function merge(url: string): Promise<string | undefined> {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const { stdout } = await run("gh", [
      "pr",
      "view",
      url,
      "--json",
      "state,mergeStateStatus,statusCheckRollup",
    ]);
    const pr = JSON.parse(stdout) as {
      state: string;
      mergeStateStatus: string;
      statusCheckRollup: Check[];
    };
    if (pr.state === "MERGED") return undefined;
    if (pr.state === "CLOSED") return `${url} was closed without merging`;
    if (pr.mergeStateStatus === "BEHIND") {
      // A pull request that's merging reads as behind its own merge for a moment, so a failed update
      // only means asking again.
      await run("gh", ["pr", "update-branch", url]).catch(() => undefined);
      continue;
    }
    const latest = new Map<string, Check>();
    for (const check of pr.statusCheckRollup) {
      const seen = latest.get(check.name ?? "");
      if ((check.startedAt ?? "") >= (seen?.startedAt ?? "")) latest.set(check.name ?? "", check);
    }
    const bad = [...latest.values()].find((check) => FAILED.includes(check.conclusion ?? ""));
    if (bad) return `${bad.name ?? "a check"} failed on ${url}`;
  }
}

const opened = outcomes.flatMap((outcome) => (outcome.pr ? [outcome] : []));
if (opened.length) {
  console.log(`Waiting for ${opened.length} pull request${opened.length > 1 ? "s" : ""} to merge.`);
  const merged = await Promise.all(
    opened.map(async ({ repo, pr = "" }) => ({ repo, problem: await merge(pr) })),
  );
  for (const { repo, problem } of merged) {
    failed ||= Boolean(problem);
    console.log(problem ? `✗ ${repo}: ${problem}` : `✓ ${repo} merged`);
  }
}
process.exitCode = failed ? 1 : 0;
