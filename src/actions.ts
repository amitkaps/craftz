/** @prose
 * # Actions
 *
 * The reference's workflows name each action by its major version, like `actions/checkout@v7`.
 * `pnpm bump` lists the ones whose repository has a later major release, in craftz's pull request.
 * It doesn't take them, as it doesn't take a new major of a library, since a major can change what
 * an action does, and the `e2e` workflow doesn't run on craftz's own pull requests.
 *
 * Being on the latest action doesn't matter, as it doesn't for pnpm. Being on the same one does,
 * and the reference is the one place that holds it. This stops the reference from falling behind
 * in silence, as `upload-artifact@v4` did while the others were on v7.
 *
 * A workflow is read as YAML. An action that can't be compared is named, and never skipped quietly:
 * a pinned commit or a branch, a repository with no release, or a release GitHub doesn't answer
 * for.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { gh } from "./reference.ts";

/** The latest release's tag of a repository, like `v7.0.2`, or `undefined` when there's none. */
export type LatestTag = (repo: string) => string | undefined;

const fromGitHub: LatestTag = (repo) => {
  try {
    return gh("api", `repos/${repo}/releases/latest`, "--jq", ".tag_name").trim();
  } catch {
    return undefined;
  }
};

type Job = { uses?: string; steps?: { uses?: string }[] };

/** The `uses` of each job and step in a workflow's `text`, as written. */
export function usesIn(text: string): string[] {
  const jobs = (parse(text) as { jobs?: Record<string, Job> } | null)?.jobs ?? {};
  return Object.values(jobs).flatMap((job) => [
    ...(job.uses ? [job.uses] : []),
    ...(job.steps ?? []).flatMap((step) => (step.uses ? [step.uses] : [])),
  ]);
}

/** The workflow files under `dir`, in any `.github/workflows` folder. */
function workflows(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(path))
    .map((path) => join(dir, path));
}

const major = (tag: string): number | undefined => {
  const found = /^v(\d+)(?:\.\d+\.\d+)?$/.exec(tag)?.[1];
  return found === undefined ? undefined : Number(found);
};

/** What `pnpm bump` lists for the workflows under `dir`: each action with a later major release,
 *  as `actions/upload-artifact v7, from v4`, and each one that couldn't be compared, with why. A
 *  local action or a Docker image isn't a release, so it's left out. */
export function staleActions(dir: string, latest: LatestTag = fromGitHub): string[] {
  const held = new Map<string, Set<string>>();
  for (const file of workflows(dir)) {
    for (const ref of usesIn(readFileSync(file, "utf8"))) {
      if (ref.startsWith("./") || ref.startsWith("docker://")) continue;
      const [path = "", version = ""] = ref.split("@");
      const repo = path.split("/").slice(0, 2).join("/");
      held.set(repo, (held.get(repo) ?? new Set()).add(version));
    }
  }
  const found: string[] = [];
  for (const [repo, versions] of [...held].sort(([a], [b]) => a.localeCompare(b))) {
    const tag = latest(repo);
    const newest = tag === undefined ? undefined : major(tag);
    if (newest === undefined) {
      found.push(`${repo} wasn't checked, since GitHub gave no release to compare with`);
      continue;
    }
    for (const version of versions) {
      const ours = major(version);
      if (ours === undefined)
        found.push(`${repo}@${version} wasn't checked, as it isn't a major tag`);
      else if (newest > ours) found.push(`${repo} v${newest}, from ${version}`);
    }
  }
  return found;
}
