/** @prose
 * # What's live
 *
 * `craftz status` reads what a repository has out in the world, where `check` reads its files and
 * `settings` its setup. Each line is one thing, marked `✓` or `✗`, and it exits 1 when any is
 * `✗`, so it can be waited on after a merge or a release.
 *
 * - **CI**: the latest run on `main` of each workflow, like CI and Release.
 * - **Pull requests**: how many are open.
 * - **npm**, for a package: the version npm serves as `latest`, next to the one in
 *   `package.json` on `main`, not the clone's, which may not be pulled. A version npm doesn't have yet is waiting to be released or approved, which
 *   is said, not marked.
 * - **The release**, for a package: the latest one on GitHub, its tag and when. The summary that
 *   opens its notes prints after the lines, so an agent reads what the release did where it
 *   already looks.
 * - **The build**, for a site: the Worker's latest build, its outcome, commit and deploy command.
 *   One still running is said, not marked.
 * - **The addresses**, for a site: the domain answers, and `workers.dev` doesn't when the config
 *   turns it off. A site behind Cloudflare Access answers with a redirect to its login, which
 *   counts as answering.
 * - **The audience**, for a site: public, or internal behind Access, read as
 *   [Access](settings.ts#access) says. Either is fine, and saying which means a site meant to be
 *   internal doesn't go public unseen. An Access application with no policy is marked.
 *
 * The [notes](notes.ts) follow the lines: a newer craftz, a `verify` over its budget, and in
 * craftz's own repository a beta that's graduated.
 *
 * `--log` prints the latest build's log after, which is where a failed deploy says why, and
 * `--notes` prints the latest release's notes in full. `--timing` prints what the last pull
 * requests took, as [Timing](#timing) says.
 *
 * It needs `gh` logged in, and cf logged in for a site, the version
 * [Which cf runs](settings.ts#which-cf-runs) says. What can't be read is said, and marked `✗`,
 * rather than taken as fine.
 */
import { stripVTControlCharacters } from "node:util";
import { accessDrift, cf, cloudflareLogin, workerTag } from "./settings.ts";
import { took } from "./pr.ts";
import { OWNER, gh, onMain, type Pkg } from "./reference.ts";
import type { Worker } from "./worker.ts";

/** One line of the status: what it is, what was found, and whether it's fine. */
export type Line = { what: string; found: string; ok: boolean };

type Run = { workflowName: string; conclusion: string; status: string; headSha: string };
type Release = { tagName: string; publishedAt: string; body: string };
type Build = {
  build_uuid: string;
  status: string;
  build_outcome: string | null;
  created_on: string;
  build_trigger_metadata?: { commit_hash?: string; deploy_command?: string };
};

const short = (sha = ""): string => sha.slice(0, 7);

// A time to the minute, in UTC, as Cloudflare gives it.
const when = (iso: string): string => `${iso.slice(0, 16).replace("T", " ")} UTC`;

// The latest run of each workflow on main, newest first as gh lists them.
export function runsIn(runs: Run[]): Line[] {
  const latest = new Map<string, Run>();
  for (const run of runs) if (!latest.has(run.workflowName)) latest.set(run.workflowName, run);
  return [...latest.values()].map((run) => {
    const done = run.status === "completed";
    const found = done
      ? `${run.conclusion} on ${short(run.headSha)}`
      : `${run.status} on ${short(run.headSha)}`;
    // A run that's going hasn't failed, and one that was skipped has nothing to do.
    const ok = !done || ["success", "skipped", "neutral"].includes(run.conclusion);
    return { what: run.workflowName, found, ok };
  });
}

/** The latest build, as a line. */
export function buildIn(build: Build | undefined): Line {
  if (!build) return { what: "build", found: "none yet", ok: false };
  const meta = build.build_trigger_metadata ?? {};
  const commit = meta.commit_hash ? ` on ${short(meta.commit_hash)}` : "";
  const with_ = meta.deploy_command ? `, deployed with ${meta.deploy_command}` : "";
  if (build.status !== "stopped") {
    return {
      what: "build",
      found: `${build.status}${commit}, started ${when(build.created_on)}`,
      ok: true,
    };
  }
  const outcome = build.build_outcome ?? "unknown";
  return {
    what: "build",
    found: `${outcome}${commit}, ${when(build.created_on)}${outcome === "success" ? with_ : ""}`,
    ok: outcome === "success",
  };
}

/** What npm serves as latest, next to the version in package.json on main. */
export function npmIn(latest: string | undefined, version: string | undefined): Line {
  if (!latest) return { what: "npm", found: "not published", ok: true };
  if (latest === version)
    return { what: "npm", found: `${latest}, as package.json on main`, ok: true };
  return {
    what: "npm",
    found: `${latest}, and package.json on main is at ${version}, not released yet`,
    ok: true,
  };
}

/** The latest release, as a line, with the summary that opens its notes. */
export function releaseIn(release: Release | undefined): { line: Line; summary?: string } {
  if (!release) return { line: { what: "GitHub release", found: "none yet", ok: true } };
  const first = release.body.trim().split(/\n\s*\n/)[0] ?? "";
  // GitHub's generated notes open with a comment or a heading, and a summary is written above.
  const summary = /^(<!--|#)/.test(first) ? undefined : first;
  const line = {
    what: "GitHub release",
    found: `${release.tagName}, ${when(release.publishedAt)}`,
    ok: true,
  };
  return summary ? { line, summary } : { line };
}

// Whether an address answers, without following a redirect: a site behind Access redirects to
// its login.
async function answers(url: string): Promise<number | string> {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    return response.status;
  } catch (error) {
    return (error as Error).message;
  }
}

async function addresses(site: Worker, dev?: string): Promise<Line[]> {
  const lines: Line[] = [];
  const [domainCode, devCode] = await Promise.all([
    site.domain ? answers(`https://${site.domain}/`) : undefined,
    dev ? answers(dev) : undefined,
  ]);
  if (site.domain && domainCode !== undefined) {
    const code = domainCode;
    const ok = typeof code === "number" && code < 400;
    lines.push({ what: site.domain, found: String(code), ok });
  }
  if (dev && devCode !== undefined) {
    const code = devCode;
    // Off means no answer: Cloudflare's 404 for a Worker with workers.dev turned off.
    const ok = site.workersDev ? typeof code === "number" && code < 400 : code === 404;
    lines.push({
      what: "workers.dev",
      found: `${code}${site.workersDev ? "" : ", turned off"}`,
      ok,
    });
  }
  return lines;
}

/** Who the site is for, as Access says. */
function audienceOf(site: Worker): Line {
  const access = accessDrift(site);
  if (access.drift.length) return { what: "audience", found: access.drift.join("; "), ok: false };
  return {
    what: "audience",
    found: access.public ? "public, with no Access application" : "internal, behind Access",
    ok: true,
  };
}

/** Everything live about one repository, the latest build's id for `--log`, and the release. */
export async function status(
  repo: string,
  pkg: Pkg,
  site?: Worker,
): Promise<{ lines: Line[]; build?: string; release?: Release; summary?: string }> {
  const lines: Line[] = [];
  let release: Release | undefined;
  let summary: string | undefined;
  try {
    const runs = JSON.parse(
      gh(
        "run",
        "list",
        "-R",
        `${OWNER}/${repo}`,
        "--branch",
        "main",
        "--limit",
        "20",
        "--json",
        "workflowName,conclusion,status,headSha",
      ),
    ) as Run[];
    lines.push(...runsIn(runs));
    const open = JSON.parse(
      gh("pr", "list", "-R", `${OWNER}/${repo}`, "--json", "number"),
    ) as unknown[];
    lines.push({ what: "pull requests", found: `${open.length} open`, ok: true });
  } catch (error) {
    lines.push({
      what: "GitHub",
      found: `couldn't be read: ${(error as Error).message.split("\n")[0]}`,
      ok: false,
    });
  }
  if (!pkg.private && pkg.name) {
    try {
      const response = await fetch(`https://registry.npmjs.org/${pkg.name}/latest`);
      const latest = response.ok
        ? ((await response.json()) as { version: string }).version
        : undefined;
      const main = JSON.parse(onMain(repo, "package.json").text) as { version?: string };
      lines.push(npmIn(latest, main.version));
    } catch (error) {
      lines.push({
        what: "npm",
        found: `couldn't be read: ${(error as Error).message}`,
        ok: false,
      });
    }
    release = latestRelease(repo);
    const read = releaseIn(release);
    lines.push(read.line);
    summary = read.summary;
  }
  const out = { ...(release ? { release } : {}), ...(summary ? { summary } : {}) };
  if (!site) return { lines, ...out };
  const login = cloudflareLogin();
  if (login) {
    lines.push({ what: "build", found: `not read, since ${login}`, ok: false });
    return { lines: [...lines, ...(await addresses(site))], ...out };
  }
  const found = workerTag(site.name);
  if (!found) {
    lines.push({ what: "build", found: `no Worker named ${site.name} on Cloudflare`, ok: false });
    return { lines: [...lines, ...(await addresses(site))], ...out };
  }
  const builds = cf("builds", "list", "--external-script-id", found.id) as Build[];
  const build = builds[0];
  lines.push(buildIn(build));
  lines.push(...(await addresses(site, found.dev)), audienceOf(site));
  return { lines, ...out, ...(build ? { build: build.build_uuid } : {}) };
}

// The latest release on GitHub, or none when there isn't one yet.
function latestRelease(repo: string): Release | undefined {
  try {
    const json = gh(
      "release",
      "view",
      "-R",
      `${OWNER}/${repo}`,
      "--json",
      "tagName,publishedAt,body",
    );
    return JSON.parse(json) as Release;
  } catch {
    return undefined;
  }
}

/** How long `verify` took on CI, and the step that ended last in it, with how far in it ended. */
export type Verified = { seconds: number; slowest?: { step: string; at: number } };

/** @prose
 * # The slowest step
 *
 * The note on a slow `verify` names the step that ended last, read from the times on CI's log.
 *
 * `vp run --log grouped` prints each step's output as one group when the step ends, under a line
 * like `── [@amitkaps/craftz#test] ──`. GitHub stamps each line of a job's log with its time. So
 * the last group's time, less the `Verify` step's start, is when the slowest step ended. The steps
 * start together, so that's its time, unless it waits for another, whose time it includes too.
 */
/** The step that ended last in a CI job's `log`, and how many seconds after `start` it ended. The
 *  `all` task that waits for the rest isn't a step. */
export function slowestIn(log: string, start: string): Verified["slowest"] {
  let slowest: Verified["slowest"];
  for (const line of stripVTControlCharacters(log).split("\n")) {
    const group = /^(\S+Z) ── \[(?:[^\]#]*#)?([^\]]+)\] ──/.exec(line);
    if (!group?.[1] || !group[2] || group[2] === "all") continue;
    const at = Math.round((Date.parse(group[1]) - Date.parse(start)) / 1000);
    if (!slowest || at >= slowest.at) slowest = { step: group[2], at };
  }
  return slowest;
}

/** What the `Verify` step took in the latest CI run on `main` that passed, or `undefined` when
 *  there's none or GitHub can't be read. A log that can't be read leaves out the slowest step. */
export function verifyTook(repo: string): Verified | undefined {
  try {
    const [run] = JSON.parse(
      gh(
        "run",
        "list",
        "-R",
        `${OWNER}/${repo}`,
        "--workflow",
        "ci.yml",
        "--branch",
        "main",
        "--status",
        "success",
        "--limit",
        "1",
        "--json",
        "databaseId",
      ),
    ) as { databaseId: number }[];
    if (!run) return undefined;
    const { jobs } = JSON.parse(
      gh("api", `repos/${OWNER}/${repo}/actions/runs/${run.databaseId}/jobs`),
    ) as {
      jobs: { id: number; steps: { name: string; started_at: string; completed_at: string }[] }[];
    };
    const job = jobs.find((it) => it.steps.some((s) => s.name === "Verify"));
    const step = job?.steps.find((s) => s.name === "Verify");
    if (!job || !step) return undefined;
    const seconds = Math.round(
      (Date.parse(step.completed_at) - Date.parse(step.started_at)) / 1000,
    );
    let slowest: Verified["slowest"];
    try {
      const log = gh(
        "api",
        "--allow-escape-sequences",
        `repos/${OWNER}/${repo}/actions/jobs/${job.id}/logs`,
      );
      slowest = slowestIn(log, step.started_at);
    } catch {
      // A log GitHub has dropped, or a gh without the flag, still leaves the time.
    }
    // The step's times are whole seconds and the log's aren't, so a step can't end after it.
    return slowest
      ? { seconds, slowest: { ...slowest, at: Math.min(slowest.at, seconds) } }
      : { seconds };
  } catch {
    return undefined;
  }
}

/** The lines of a build's log. */
export function buildLog(uuid: string): string[] {
  const log = cf("builds", "logs", "get", uuid) as { lines: [number, string][] };
  return log.lines.map(([, text]) => text);
}

/** @prose
 * # Timing
 *
 * `--timing` answers "why is this slow?" from the last 30 merged pull requests, rather than from
 * memory. It gives the median and slowest tenth of a CI run and of a pull request from open to
 * merge, and how many were open beside another. That's when one falls behind `main` and runs CI
 * again.
 *
 * Each that took over five minutes is listed with the first reason that fits. A check failed, it
 * fell behind, work was added after it opened, or the merge came minutes after the checks passed,
 * which is GitHub's auto-merge. Otherwise it was left open a while.
 */
/** A merged pull request, as `gh pr list` gives it. */
export type Merged = {
  number: number;
  createdAt: string;
  mergedAt: string;
  headRefName: string;
  commits: { committedDate: string; messageHeadline: string }[];
};
/** A workflow run on a pull request, as `gh run list` gives it. */
export type PrRun = {
  workflowName: string;
  headBranch: string;
  conclusion: string;
  startedAt: string;
  updatedAt: string;
};

const SLOW = 5 * 60_000;
const at = (iso: string): number => Date.parse(iso);
const quantile = (sorted: number[], f: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))] ?? 0;
const spread = (spans: number[]): string => {
  const sorted = [...spans].sort((a, b) => a - b);
  return `median ${took(quantile(sorted, 0.5))}, slowest tenth ${took(quantile(sorted, 0.9))}`;
};

/** What the pull requests took, as lines to print, and why each slow one was slow. */
export function timingIn(prs: Merged[], runs: PrRun[]): string[] {
  if (!prs.length) return ["No merged pull requests to time."];
  const ci = runs
    .filter((run) => run.workflowName === "CI" && run.conclusion === "success")
    .map((run) => at(run.updatedAt) - at(run.startedAt));
  const open = (pr: Merged) => at(pr.mergedAt) - at(pr.createdAt);
  const beside = (pr: Merged) =>
    prs.some(
      (other) =>
        other !== pr &&
        at(other.createdAt) < at(pr.mergedAt) &&
        at(other.mergedAt) > at(pr.createdAt),
    );
  const overlapped = prs.filter(beside).length;
  const slow = prs
    .filter((pr) => open(pr) > SLOW)
    .map((pr) => {
      // A run is the pull request's when it's on its branch while it was open.
      const own = runs.filter(
        (run) =>
          run.headBranch === pr.headRefName &&
          at(run.startedAt) >= at(pr.createdAt) - 60_000 &&
          at(run.startedAt) <= at(pr.mergedAt),
      );
      const later = pr.commits.filter((commit) => at(commit.committedDate) > at(pr.createdAt));
      // An update from main is GitHub's merge commit, not work.
      const updated = later.some((commit) => commit.messageHeadline.startsWith("Merge branch"));
      const passed = Math.max(0, ...own.map((run) => at(run.updatedAt)));
      const why = own.some((run) => run.conclusion === "failure")
        ? "a check failed"
        : updated
          ? "fell behind main, and CI ran again"
          : later.length
            ? "work was added after it opened"
            : passed && at(pr.mergedAt) - passed > 2 * 60_000
              ? `merged ${took(at(pr.mergedAt) - passed)} after its checks passed`
              : "left open a while";
      return `#${pr.number} ${took(open(pr))}, ${why}`;
    });
  const rows: [string, string][] = [
    ["CI run", ci.length ? spread(ci) : "no runs read"],
    ["open to merge", spread(prs.map(open))],
    ["beside another", `${overlapped} of ${prs.length}`],
    ...slow.map((line, i): [string, string] => [i ? "" : "over 5m", line]),
  ];
  return [
    `Timing, over the last ${prs.length} merged pull requests:`,
    ...rows.map(([what, found]) => `    ${what.padEnd(14)}  ${found}`),
  ];
}

/** Reads the last 30 merged pull requests and their runs, and times them. */
export function timing(repo: string): string[] {
  const prs = JSON.parse(
    gh(
      "pr",
      "list",
      "-R",
      `${OWNER}/${repo}`,
      "--state",
      "merged",
      "--limit",
      "30",
      "--json",
      "number,createdAt,mergedAt,headRefName,commits",
    ),
  ) as Merged[];
  const runs = JSON.parse(
    gh(
      "run",
      "list",
      "-R",
      `${OWNER}/${repo}`,
      "--event",
      "pull_request",
      "--limit",
      "200",
      "--json",
      "workflowName,headBranch,conclusion,startedAt,updatedAt",
    ),
  ) as PrRun[];
  return timingIn(prs, runs);
}
