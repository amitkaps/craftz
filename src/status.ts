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
 *
 * `--log` prints the latest build's log after, which is where a failed deploy says why, and
 * `--notes` prints the latest release's notes in full.
 *
 * It needs `gh` logged in, and cf logged in for a site. A site with no cf of its own, like an app
 * on wrangler, has its builds read by the reference's cf, which pnpm fetches. What can't be read
 * is said, and marked `✗`, rather than taken as fine.
 */
import { execFileSync } from "node:child_process";
import { cf, cloudflareLogin, workerTag } from "./settings.ts";
import { OWNER, type Pkg } from "./reference.ts";
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

const gh = (...args: string[]): string =>
  execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

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
  if (site.domain) {
    const code = await answers(`https://${site.domain}/`);
    const ok = typeof code === "number" && code < 400;
    lines.push({ what: site.domain, found: String(code), ok });
  }
  if (dev) {
    const code = await answers(dev);
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
      const main = JSON.parse(
        gh(
          "api",
          `repos/${OWNER}/${repo}/contents/package.json?ref=main`,
          "-H",
          "Accept: application/vnd.github.raw",
        ),
      ) as { version?: string };
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
  lines.push(...(await addresses(site, found.dev)));
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

/** The lines of a build's log. */
export function buildLog(uuid: string): string[] {
  const log = cf("builds", "logs", "get", uuid) as { lines: [number, string][] };
  return log.lines.map(([, text]) => text);
}
