/** @prose
 * # Align
 *
 * Brings repositories in line with the released craftz: `pnpm align` does every one
 * [listed](survey.ts) by its topic, and `pnpm align markz` does one. It needs `gh` logged in as
 * the owner, since it writes the settings each repository's CI can't read without a login.
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
 * compared with another run, and its settings are read and listed where they've drifted.
 */
import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { checkSettings, writeSettings } from "./apply.ts";
import { fixFiles } from "./rules.ts";
import { CRAFTZ, OWNER, TOOLS } from "./reference.ts";
import { moveLine, report, row, type Row, type Step } from "./report.ts";
import { repos } from "./survey.ts";
import { type Run, upgrade } from "./upgrade.ts";
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
const candidate = args.includes("--candidate");
const local = candidate || args.includes("--local");
const named = args.filter((arg) => !arg.startsWith("--"));
const targets = named.length ? named : await repos();
const work = mkdtempSync(join(tmpdir(), "align-"));
const tarball = candidate ? pack() : undefined;
const many = targets.length > 1 ? "repositories" : "repository";
console.log(
  `align${candidate ? " --candidate" : ""}: ${targets.length} ${many}, to ${candidate ? "this checkout, packed" : "the latest craftz"}`,
);

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
 * major, as npm's ranges treat it. Our own packages are taken at any version, since their numbers
 * only count releases, and what a release changes is in its notes.
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
    if (breaking(current, latest) && !name.startsWith(`@${OWNER}/`))
      majors.push(`${name} ${latest}, from ${current}`);
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
 * generated types. `pnpm add` doesn't run it.
 *
 * Then it takes the steps of
 * [`craftz upgrade`](upgrade.ts), from this checkout, since a repository on an older craftz has no
 * such command. The fix still runs from the version just added. So the rules it's fixed to are the
 * ones it moves to, and a change in craftz reaches nobody until it's released.
 *
 * The fix brings that version's holds, like base's TypeScript, and changes nothing that's in line
 * already. What it leaves to do by hand fails `verify`, which runs `craftz check`.
 */
async function alignTo(dir: string, repo: string, log: string[], byHand: Run): Promise<string[]> {
  if (repo === SELF) {
    const std = join(dir, "reference");
    const majors = await updateReference(std, log);
    fixFiles(dir, std);
    await sh(dir, log, "pnpm", "install");
    return [...majors, ...(await update(dir, log, [...TOOLS, "vite-plus"]))];
  }
  await sh(dir, log, "pnpm", "install");
  // Its fix fails on what's left by hand, which the run lists and goes past.
  await upgrade(
    (command, ...args) =>
      args[0] === "run" ? byHand(command, ...args) : sh(dir, log, command, ...args),
    tarball,
  );
  return update(dir, log, [...TOOLS, "vite-plus", CRAFTZ]);
}

/** @prose
 * # The pull request
 *
 * After the changes, the clone writes its lockfile afresh, checks it the way CI does, writes the
 * format and lint fixes, and runs `verify`. A clean tree means the repository was already in line.
 *
 * pnpm keeps what a lockfile holds, so an optional peer that nothing installs any more, like
 * esbuild once Vite+ moved to Rolldown, stayed with its binaries, and `pnpm dedupe` kept it too.
 * So the lockfile and `node_modules` are removed and installed again, on every run, and every
 * nested package moves within pnpm's one-day wait, as the tools do.
 *
 * The pull request lists every version that moved, read from `package.json` before and after, the
 * dependencies a fix removed, and the majors left for review. It's opened from a branch named `align`, which a later run updates
 * rather than opening a second one.
 *
 * The repositories clone and install side by side, but `verify` runs one at a time. markz's
 * timing tests failed when five ran at once, since they measured a busy machine, not the code.
 */
type State = Row & { dir: string; log: string[]; before: Deps; updates?: number };

const PACKAGE_FILES = ["package.json", "pnpm-lock.yaml", "reference/package.json"];

// The versions a repository moves, and in craftz, the reference's too, which is what bump moves.
function versionsIn(dir: string, repo: string): Deps {
  const own = depsOf(readJson<Pkg>(join(dir, "package.json")));
  if (repo !== SELF) return own;
  const reference = depsOf(readJson<Pkg>(join(dir, "reference", "package.json")));
  return {
    ...own,
    ...Object.fromEntries(Object.entries(reference).map(([name, v]) => [`${name} (reference)`, v])),
  };
}

// What a failed step leaves by hand: craftz check's warnings that aren't held, and the count of lint and type
// errors, or the step's first line when it printed neither. A candidate's own version is a
// tarball, which versions-craftz names in every repository, so it's left out.
function findings(error: unknown): string[] {
  const {
    stdout = "",
    stderr = "",
    message = "",
  } = error as {
    stdout?: string;
    stderr?: string;
    message?: string;
  };
  const found = `${stdout}\n${stderr}`
    .split("\n")
    .filter(
      (line) =>
        (line.startsWith("    craftz: warning: ") && !line.includes("; held: ")) ||
        /^Found \d+ errors?/.test(line),
    )
    .map((line) => line.trim().replace(/^craftz: warning: /, ""))
    .filter((line) => !(candidate && line.startsWith("versions-craftz:")));
  return found.length || candidate ? found : [message.split("\n")[0] ?? ""];
}

/** @prose
 * # A candidate
 *
 * `pnpm align --candidate` tries this checkout on every repository before it's released. It packs
 * craftz, as `pnpm publish` would, and moves each clone to the tarball in place of npm's latest.
 * It's local, since a pull request can't install a tarball on a laptop.
 *
 * Each repository then lists what it leaves by hand, which is what the release's notes say to do.
 */
function pack(): string {
  const root = join(import.meta.dirname, "..");
  execFileSync("pnpm", ["pack", "--pack-destination", work], { cwd: root, stdio: "pipe" });
  const file = readdirSync(work).find((name) => name.endsWith(".tgz"));
  if (!file) throw new Error("pnpm pack wrote no tarball");
  return join(work, file);
}

/** @prose
 * # Progress
 *
 * Each step runs for every repository before the next one starts, so it prints as one line, with
 * a dot as each repository ends it and the step's time at the end. The report that follows is in
 * [report.ts](report.ts).
 *
 * A run takes about a minute longer than one that lets a fast repository verify while a slow one
 * upgrades, since `verify` runs one at a time either way. The dots go to stderr, so the report on
 * stdout reads the same whether or not they're shown.
 */
const seconds = (since: number): string => `${Math.round((Date.now() - since) / 1000)}s`;

// One step for every repository given, side by side unless `serial`. A repository that fails it
// gets `✗`, and drops out of the steps after it.
async function phase(
  label: string,
  step: Step | undefined,
  going: State[],
  task: (state: State) => Promise<void>,
  serial = false,
): Promise<void> {
  if (!going.length) return;
  const began = Date.now();
  process.stderr.write(label.padEnd(12));
  const one = async (state: State) => {
    const start = Date.now();
    let threw = false;
    try {
      await task(state);
      if (step && !state.cells[step]) state.cells[step] = seconds(start);
    } catch (error) {
      threw = true;
      writeFileSync(join(work, `${state.repo}.log`), state.log.join("\n"));
      state.status = "failed";
      state.failed = error instanceof Error ? error.message.split("\n")[0] : String(error);
      if (step) state.cells[step] = "✗";
    }
    process.stderr.write(threw || (step && state.cells[step] === "✗") ? "✗" : ".");
  };
  if (serial) for (const state of going) await one(state);
  else await Promise.all(going.map(one));
  process.stderr.write(`${" ".repeat(targets.length - going.length)}  ${seconds(began)}\n`);
}

const states: State[] = targets.map((repo) => ({
  ...row(repo),
  dir: join(work, repo),
  log: [],
  before: {},
}));
const going = () => states.filter((state) => !state.status);

// Runs a step that leaves what it finds by hand in the row, and goes past it.
const byHand =
  (state: State): Run =>
  (command, ...args) =>
    sh(state.dir, state.log, command, ...args).catch((error: unknown) => {
      for (const found of findings(error)) {
        if (!state.byHand.includes(found)) state.byHand.push(found);
      }
    });

await phase("cloning", "clone", going(), async ({ dir, log, repo }) => {
  await sh(work, log, "gh", "repo", "clone", `${OWNER}/${repo}`, dir, "--", "--quiet");
});

await phase("upgrading", "upgrade", going(), async (state) => {
  state.before = versionsIn(state.dir, state.repo);
  state.review = await alignTo(state.dir, state.repo, state.log, byHand(state));
});

await phase("installing", "install", going(), async (state) => {
  const { dir, log, repo } = state;
  rmSync(join(dir, "pnpm-lock.yaml"), { force: true });
  rmSync(join(dir, "node_modules"), { recursive: true, force: true });
  await sh(dir, log, "pnpm", "install");
  await sh(dir, log, "pnpm", "install", "--frozen-lockfile");
  await byHand(state)("pnpm", "run", "fix");

  // trimEnd, since each line opens with a status column that may be a space.
  const changed = (await sh(dir, log, "git", "status", "--porcelain")).trimEnd();
  if (!changed && !state.byHand.length) {
    state.status = "in line";
    state.cells.verify = "in line";
    return;
  }
  const after = versionsIn(dir, repo);
  state.moved = [...new Set([...Object.keys(after), ...Object.keys(state.before)])]
    .filter((name) => state.before[name] !== after[name])
    .map((name) => ({ name, from: state.before[name], to: after[name] }));
  state.files = changed
    .split("\n")
    .filter(Boolean)
    .filter((line) => !PACKAGE_FILES.includes(line.slice(3)))
    .map((line) => `${line.slice(3)} ${line.startsWith(" D") ? "deleted" : "from craftz"}`);
  // Staged first, so verify sees what the commit will hold: a check that lists files with git,
  // like prose's lexer test, would otherwise still find the ones a fix deleted.
  await sh(dir, log, "git", "add", "-A");
});

await phase(
  "verifying",
  "verify",
  going(),
  async (state) => {
    await byHand(state)("pnpm", "run", "verify");
    if (!state.byHand.length) return;
    writeFileSync(join(work, `${state.repo}.log`), state.log.join("\n"));
    state.status = "left by hand";
    state.cells.verify = "✗";
  },
  true,
);

if (!local) await phase("opening", undefined, going(), open);

async function open(state: State): Promise<void> {
  const { dir, log } = state;
  const pkg = readJson<Pkg>(join(dir, "package.json"));
  const body = [
    "Brings this repository in line with craftz's rules, from `pnpm align`.",
    "",
    ...[...state.moved.map(moveLine), ...state.files].map((line) => `- ${line}`),
    ...(state.review.length
      ? ["", "New majors, left for review:", "", ...state.review.map((line) => `- ${line}`)]
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
  state.pr = url.trim();
}

/** @prose
 * # Settings
 *
 * GitHub's settings are written for every repository, with each rule's fix on GitHub, like
 * `github-rules`, and a site's Worker settings when `cf` is logged in.
 *
 * Whether a repository is a package, and the name of its Worker, are read from the clone, after
 * its pull request, so they're what `main` is about to hold. Classic branch protection is removed
 * without asking, since these repositories are ones the rules already own. With `--local`, the
 * settings are only read.
 */
async function settings(repo: string): Promise<string[]> {
  const dir = join(work, repo);
  const pkg = existsSync(join(dir, "package.json")) ? readJson<Pkg>(join(dir, "package.json")) : {};
  // align says once, at the start, why the Workers aren't written.
  const site = noCloudflare ? undefined : workerIn(dir);
  return local ? checkSettings({ repo, pkg, site }) : writeSettings({ repo, pkg, site }, true);
}

const settled = states.filter((state) => !state.status || state.status === "in line");
await phase("settings", undefined, settled, async (state) => {
  state.settings = await settings(state.repo);
});
for (const state of states) state.status ??= "verified";

console.log(["", ...report(states), `clones and logs in ${work}`].join("\n"));
let failed = states.some((state) => state.status !== "verified" && state.status !== "in line");

/** @prose
 * # Waiting for the merges
 *
 * A run ends when its pull requests have merged, so `main` holds what its report says. Each
 * prints a dot as it merges, and one that doesn't is listed after.
 *
 * It asks GitHub every ten seconds, as `pnpm pr --wait` does. A check counts by its latest run,
 * since adding a label starts a new run that cancels the old one. One that falls behind `main` has
 * its branch updated, as `pnpm pr --wait` does. The report after says so, since that update's CI
 * is the wait that's left. A pull request that fails or closes is reported and not waited for.
 */
type Check = { name?: string; conclusion?: string; startedAt?: string };
const FAILED = ["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"];

async function merge(url: string, updated: () => void): Promise<string | undefined> {
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
      await run("gh", ["pr", "update-branch", url]).then(updated, () => undefined);
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

const opened = states.filter((state) => state.pr);
await phase("merging", undefined, opened, async (state) => {
  const problem = await merge(state.pr ?? "", () => (state.updates = (state.updates ?? 0) + 1));
  if (problem) throw new Error(problem);
});
const problems = opened
  .filter((state) => state.status === "failed")
  .map(({ repo, failed }) => `✗ ${repo}: ${failed}`);
const behind = opened
  .filter((state) => state.updates)
  .map(({ repo, updates = 0 }) => {
    const times = updates > 1 ? `, ${updates} times` : "";
    return `↻ ${repo} fell behind main, so CI ran again${times}`;
  });
if (opened.length) {
  console.log(
    [
      "",
      ...behind,
      ...problems,
      `${problems.length ? "✗" : "✓"} ${opened.length - problems.length} merged`,
    ].join("\n"),
  );
}
failed ||= problems.length > 0;
process.exitCode = failed ? 1 : 0;
