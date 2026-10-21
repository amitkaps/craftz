/** @prose
 * # Drift
 *
 * Prints where each repository has drifted from the rules, and exits 1 when anything has. It
 * only reads. `align`, which comes next, is what writes.
 *
 * Each repository's files come from what [survey.ts](survey.ts) finds, read from GitHub's `main`,
 * as the site does. The settings outside the files come from [settings.ts](settings.ts): the merge
 * settings when `gh` is logged in, and each Worker's build settings and Access when `cf` is.
 * Every site's audience is read from Access, and a public one is noted below it, not counted, so
 * a site meant to be internal doesn't go public unseen. Without a login,
 * drift says once what it couldn't check, rather than calling it drift, so a run with no logins
 * still checks every file. A held check is printed with its reason, and doesn't count as drift.
 * A rule with an id, like `scripts-verify`, prints it before each line it drifted on, and once
 * below them, the `craftz rules` command that prints it from [the rules](../docs/rules.md).
 *
 * A folder named on the command line, like `pnpm drift ../markz`, is checked from disk in place
 * of the repositories. That checks a fix before it's pushed, with a listed repository's holds
 * found by the repository its `origin` names. It also checks one that follows the rules without
 * being in the list, such as a private repository, which a public page shouldn't name. A folder
 * with no `origin` on GitHub is taken by its own name.
 */
import { resolve } from "node:path";
import { stated } from "./stated.ts";
import { type Finding, type Worker, checkFolder, repoIn, survey } from "./survey.ts";
import { accessDrift, cloudflareLogin, githubLogin, mergeDrift, workerDrift } from "./settings.ts";

const folders = process.argv.slice(2);

const github = githubLogin();
const noCloudflare = cloudflareLogin();
if (!github) console.log("not checked: GitHub's merge settings, since gh isn't logged in");
if (noCloudflare) console.log(`not checked: the Workers' build settings, since ${noCloudflare}`);

// Every site's audience is looked up in Access. A public one is noted, not counted as drift.
function audience(site: Worker | undefined, notes: string[]): string[] {
  if (!site || noCloudflare) return [];
  const access = accessDrift(site);
  if (access.public) notes.push(`public: no Access application covers ${site.domain}`);
  return access.drift;
}

function settings(repo: string, worker: Worker | undefined, notes: string[]): string[] {
  return [
    ...(github ? mergeDrift(repo) : []),
    ...(worker && !noCloudflare ? workerDrift(worker.name) : []),
    ...audience(worker, notes),
  ];
}

const sees = new Map(stated().map((s) => [s.id, s.see]));
const lines = (f: Finding): string[] => f.drift.map((d) => (f.rule ? `${f.rule}: ${d}` : d));

function print(name: string, drift: string[], findings: Finding[], notes: string[] = []): boolean {
  console.log(drift.length ? `✗ ${name}` : `✓ ${name}`);
  for (const line of drift) console.log(`    ${line}`);
  for (const line of notes) console.log(`    ${line}`);
  const read = findings.filter((f) => f.rule && !f.held && f.drift.length);
  for (const see of new Set(read.map((f) => sees.get(f.rule ?? "")))) {
    console.log(`    see: ${see}`);
  }
  for (const f of findings.filter((f) => f.held)) {
    console.log(`    held: ${lines(f).join("; ")}\n      ${f.held}`);
  }
  for (const f of findings.filter((f) => f.unchecked))
    console.log(`    not checked: ${f.unchecked}`);
  return drift.length > 0;
}

let drifted = false;
for (const folder of folders) {
  const { findings, worker: site } = await checkFolder(resolve(folder));
  const drift = findings.flatMap((f) => (f.held ? [] : lines(f)));
  const repo = repoIn(resolve(folder));
  const notes: string[] = [];
  // A folder that isn't on GitHub yet has no merge settings to check. Only that is caught, so
  // a Worker's error isn't taken for it.
  try {
    if (github) drift.push(...mergeDrift(repo));
  } catch {
    findings.push({ drift: [], unchecked: `the merge settings, since ${repo} isn't on GitHub` });
  }
  if (site && !noCloudflare) drift.push(...workerDrift(site.name));
  drift.push(...audience(site, notes));
  drifted = print(folder, drift, findings, notes) || drifted;
}
for (const result of folders.length ? [] : await survey()) {
  const findings = result.findings.flatMap((f) => (f ? [f] : []));
  const drift = result.error ? [result.error] : findings.flatMap((f) => (f.held ? [] : lines(f)));
  const notes: string[] = [];
  if (!result.error) drift.push(...settings(result.repo, result.worker, notes));
  drifted = print(result.repo, drift, findings, notes) || drifted;
}
process.exitCode = drifted ? 1 : 0;
