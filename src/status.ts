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
 *   `package.json`. A version npm doesn't have yet is waiting to be released or approved, which
 *   is said, not marked.
 * - **The build**, for a site: the Worker's latest build, its outcome, commit and deploy command.
 *   One still running is said, not marked.
 * - **The addresses**, for a site: the domain answers, and `workers.dev` doesn't when the config
 *   turns it off. A site behind Cloudflare Access answers with a redirect to its login, which
 *   counts as answering.
 *
 * `--log` prints the latest build's log after, which is where a failed deploy says why.
 *
 * It needs `gh` logged in, and `cf` for a site. What can't be read is said, and marked `✗`,
 * rather than taken as fine.
 */
import { execFileSync } from "node:child_process";
import { cf, cloudflareLogin, workerTag } from "./settings.ts";
import { OWNER, type Pkg } from "./reference.ts";
import type { Worker } from "./worker.ts";

/** One line of the status: what it is, what was found, and whether it's fine. */
export type Line = { what: string; found: string; ok: boolean };

type Run = { workflowName: string; conclusion: string; status: string; headSha: string };
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

/** What npm serves as latest, next to the version in package.json. */
export function npmIn(latest: string | undefined, version: string | undefined): Line {
  if (!latest) return { what: "npm", found: "not published", ok: true };
  if (latest === version) return { what: "npm", found: `${latest}, as package.json`, ok: true };
  return {
    what: "npm",
    found: `${latest}, and package.json is at ${version}, not released yet`,
    ok: true,
  };
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

/** Everything live about one repository, and the latest build's id for `--log`. */
export async function status(
  repo: string,
  pkg: Pkg & { version?: string },
  site?: Worker,
): Promise<{ lines: Line[]; build?: string }> {
  const lines: Line[] = [];
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
      lines.push(npmIn(latest, pkg.version));
    } catch (error) {
      lines.push({
        what: "npm",
        found: `couldn't be read: ${(error as Error).message}`,
        ok: false,
      });
    }
  }
  if (!site) return { lines };
  const login = cloudflareLogin();
  if (login) {
    lines.push({ what: "build", found: `not read, since ${login}`, ok: false });
    return { lines: [...lines, ...(await addresses(site))] };
  }
  const found = workerTag(site.name);
  if (!found) {
    lines.push({ what: "build", found: `no Worker named ${site.name} on Cloudflare`, ok: false });
    return { lines: [...lines, ...(await addresses(site))] };
  }
  const builds = cf("builds", "list", "--external-script-id", found.id) as Build[];
  const build = builds[0];
  lines.push(buildIn(build));
  lines.push(...(await addresses(site, found.dev)));
  return { lines, build: build?.build_uuid };
}

/** The lines of a build's log. */
export function buildLog(uuid: string): string[] {
  const log = cf("builds", "logs", "get", uuid) as { lines: [number, string][] };
  return log.lines.map(([, text]) => text);
}
