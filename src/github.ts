/** @prose
 * # GitHub over REST
 *
 * `pr`, `gone`, `status` and `release` talk to GitHub through `gh api`, never through `gh pr …` or GraphQL.
 * REST works the same on a laptop and in the cloud, so there's one path and no check for where
 * it runs.
 *
 * A Claude Code session in the cloud reaches GitHub through a proxy that refuses GraphQL with a
 * 403, and `gh pr view`, `list`, `create` and `merge` all use it.
 *
 * Auto-merge is the one thing REST can't do. GitHub offers it only through GraphQL. The cloud's
 * proxy adds a route of its own, `PUT /pulls/{n}/ccr/auto_merge`. Real GitHub answers that with a
 * 404, so `autoMerge` tries it first and falls back to `gh pr merge --auto`, which a laptop can
 * run. Neither asks where it's running.
 *
 * A cloud checkout's remote can be the proxy's, with no `github.com` in it. So the repository is
 * the last two path segments of `origin`'s URL, which holds for both.
 */
import { execFileSync } from "node:child_process";

/** `owner/name` from a remote's URL, whatever its host: its last two path segments. */
export const slugOf = (url: string): string | undefined => {
  const found = /([^/:]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.trim());
  return found ? `${found[1]}/${found[2]}` : undefined;
};

/** The repository the folder's `origin` names. */
export function repoIn(cwd?: string): string {
  const url = execFileSync("git", ["remote", "get-url", "origin"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const slug = slugOf(url);
  if (!slug) throw new Error(`origin, ${url.trim()}, doesn't name a repository.`);
  return slug;
}

/** A page of 100 pull requests is about a megabyte, past `execFileSync`'s default cap. */
const MAX_BUFFER = 256 * 1024 * 1024;

export type Where = { cwd?: string; repo?: string };

/** Calls the REST API. `{repo}` in the path is `owner/name`, from `origin` unless given. */
export function api<T>(method: string, path: string, body?: object, where: Where = {}): T {
  const full = path.replace("{repo}", where.repo ?? repoIn(where.cwd));
  const args = ["api", "--method", method, full, ...(body ? ["--input", "-"] : [])];
  const out = execFileSync("gh", args, {
    cwd: where.cwd,
    encoding: "utf8",
    input: body ? JSON.stringify(body) : undefined,
    maxBuffer: MAX_BUFFER,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return (out.trim() ? JSON.parse(out) : undefined) as T;
}

/** Every item of a list endpoint, across its pages. */
export function pages<T>(path: string, where: Where = {}): T[] {
  const full = path.replace("{repo}", where.repo ?? repoIn(where.cwd));
  const out = execFileSync("gh", ["api", "--paginate", "--jq", ".[] | tojson", full], {
    cwd: where.cwd,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

type Raw = {
  number: number;
  title: string;
  state: "open" | "closed";
  merged_at: string | null;
  html_url: string;
  mergeable_state?: string;
  head: { sha: string; ref: string };
};

/** A pull request as the rest of craftz reads it, in the words `gh pr view --json` used. */
export type Pull = {
  number: number;
  title: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  url: string;
  headRefOid: string;
  headRefName: string;
  mergeStateStatus: string;
  mergedAt?: string;
};

export const pullOf = (raw: Raw): Pull => ({
  number: raw.number,
  title: raw.title,
  state: raw.merged_at ? "MERGED" : raw.state === "open" ? "OPEN" : "CLOSED",
  url: raw.html_url,
  headRefOid: raw.head.sha,
  headRefName: raw.head.ref,
  mergeStateStatus: (raw.mergeable_state ?? "unknown").toUpperCase(),
  ...(raw.merged_at ? { mergedAt: raw.merged_at } : {}),
});

/** The newest pull request from a branch, whatever its state, or none. */
export function pullFrom(branch: string): Pull | undefined {
  const owner = repoIn().split("/")[0];
  const [newest] = pages<Raw>(
    `repos/{repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}`,
  );
  return newest && pullOf(newest);
}

/** Every open pull request. */
export const openPulls = (): Pull[] => pages<Raw>("repos/{repo}/pulls?state=open").map(pullOf);

/** A pull request by number, with `mergeStateStatus` as GitHub has worked it out by now. */
export const pullNumber = (number: number): Pull =>
  pullOf(api<Raw>("GET", `repos/{repo}/pulls/${number}`));

/** Opens a pull request into `main` from a pushed branch, with its label. */
export function createPull(
  branch: string,
  title: string,
  body: string,
  label?: string,
  where: Where = {},
): Pull {
  const made = pullOf(
    api<Raw>("POST", "repos/{repo}/pulls", { title, head: branch, base: "main", body }, where),
  );
  if (label) {
    api("POST", `repos/{repo}/issues/${made.number}/labels`, { labels: [label] }, where);
  }
  return made;
}

/** Turns on auto-merge, by the cloud's route if there is one and by GraphQL if not. */
export function autoMerge(number: number, where: Where = {}): void {
  try {
    api("PUT", `repos/{repo}/pulls/${number}/ccr/auto_merge`, { merge_method: "squash" }, where);
  } catch (error) {
    if (!String(error).includes("HTTP 404")) throw error;
    const repo = where.repo ? ["--repo", where.repo] : [];
    execFileSync("gh", ["pr", "merge", String(number), "--auto", "--squash", ...repo], {
      cwd: where.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
}

export const updateBranch = (number: number): void => {
  api("PUT", `repos/{repo}/pulls/${number}/update-branch`);
};

export const squashMerge = (number: number): void => {
  api("PUT", `repos/{repo}/pulls/${number}/merge`, { merge_method: "squash" });
};

/** A check run on a commit, in the words the status rollup used. */
export type Check = {
  name?: string;
  conclusion?: string;
  startedAt?: string;
  completedAt?: string;
};

/** The check runs on a commit. */
export function checksOn(sha: string): Check[] {
  const found = api<{
    check_runs: {
      name: string;
      conclusion: string | null;
      started_at: string | null;
      completed_at: string | null;
    }[];
  }>("GET", `repos/{repo}/commits/${sha}/check-runs?per_page=100`);
  return found.check_runs.map((run) => ({
    name: run.name,
    ...(run.conclusion ? { conclusion: run.conclusion.toUpperCase() } : {}),
    ...(run.started_at ? { startedAt: run.started_at } : {}),
    ...(run.completed_at ? { completedAt: run.completed_at } : {}),
  }));
}
