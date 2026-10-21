/** @prose
 * # The survey
 *
 * Checks a repository's files against the rules, from a folder, and lists the repositories that
 * follow them, for `pnpm align`.
 *
 * Each repository is compared with the files in [reference/](../reference/), so there's no second
 * copy of them to keep in step. [The rules](../docs/rules.md) say what each check means.
 */
import { execFileSync } from "node:child_process";
import { basename, join } from "node:path";
import { type Rule, RULES } from "./rules.ts";
import { parts, stated } from "./stated.ts";
import { OWNER, TOPIC, type Pkg, read } from "./reference.ts";
import { type Worker, worker } from "./worker.ts";

export { type Worker, worker };

/** @prose
 * # The repositories
 *
 * Every public repository of the owner's with the topic `craftz`, other than craftz itself and
 * any that's archived. `craftz settings` adds the topic, so a repository joins when its settings
 * are written, and leaves when it's archived. A private one isn't listed, since craftz is public
 * and would name it.
 *
 * GitHub's search answers without a login, and only with public repositories then, so a login
 * never adds a private one to the list.
 */
export async function repos(): Promise<string[]> {
  const q = `topic:${TOPIC} user:${OWNER} is:public archived:false`;
  const token = process.env["GITHUB_TOKEN"];
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=100`,
    { headers: token ? { authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error(`GitHub's search returned HTTP ${res.status}`);
  const { items } = (await res.json()) as { items: { name: string }[] };
  return items
    .map((it) => it.name)
    .filter((name) => name !== "craftz")
    .sort();
}

const FILES = [
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "vite.config.ts",
  ".gitignore",
  ".vscode/settings.json",
  ".vscode/extensions.json",
  "cloudflare.config.ts",
  "wrangler.jsonc",
  "wrangler.toml",
  // Whether a static site has its own page, which says what `craftz()` fills in for it.
  "index.html",
  "AGENTS.md",
  "CLAUDE.md",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/workflows/label.yml",
  ".github/release.yml",
  ".github/dependabot.yml",
  "README.md",
  "docs/README.md",
  "docs/design.md",
  "docs/plan.md",
  "docs/development.md",
  "docs/lessons.md",
  "docs/usage.md",
  "scripts/pr.ts",
  "scripts/gone.ts",
];

type Files = Record<string, string>;

function fromDisk(dir: string): Files {
  return Object.fromEntries(FILES.map((file) => [file, read(join(dir, file))]));
}

/** @prose
 * # Branch rules
 *
 * GitHub shows a public repository's branch rules to anyone, so `craftz settings` reads them
 * without a login, and `github-rules` compares them with [.github/ruleset.json](../reference/.github/ruleset.json). A
 * `GITHUB_TOKEN`, when set, only raises the rate limit.
 */
export type BranchRule = { type: string; parameters?: Record<string, unknown> };

/** @prose
 * # GitHub's rate limit
 *
 * Without a login, GitHub answers 60 requests an hour, so a handful of runs can use them up.
 * That's not drift. The check says it wasn't made, and doesn't fail.
 */
class RateLimit extends Error {
  override name = "RateLimit";
}

async function github(path: string): Promise<unknown> {
  try {
    const token = process.env["GITHUB_TOKEN"];
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if ([403, 429].includes(res.status) && res.headers.get("x-ratelimit-remaining") === "0") {
      return new RateLimit("GitHub's rate limit was reached");
    }
    if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

export const branchRules = (repo: string) =>
  github(`${repo}/rules/branches/main`) as Promise<BranchRule[] | Error>;

/** @prose
 * # Labels
 *
 * A package's labels, for `releases-labels`. GitHub shows a public repository's labels to anyone.
 */
export async function repoLabels(repo: string): Promise<string[] | Error> {
  const found = (await github(`${repo}/labels?per_page=100`)) as { name: string }[] | Error;
  return found instanceof Error ? found : found.map((label) => label.name);
}

export type Repo = {
  pkg: Pkg;
  files: Files;
  deps: Record<string, string>;
  vitePlus?: string;
  worker?: Worker;
  // Left out for a folder that isn't on GitHub yet.
  rules?: BranchRule[] | Error;
  labels?: string[] | Error;
};

/** @prose
 * # The checks
 *
 * Each check covers one part of the rules, and they run in the order of the rules' parts, so
 * what a check prints reads like the rules.
 *
 * A check returns what the repository has, like the version it pins, and what has drifted, which is empty when
 * nothing has. It returns `undefined` when it doesn't apply, like the Cloudflare check for a
 * package with no site, or the typescript check for a repository without typescript. A check
 * that couldn't be made says why in `unchecked`, with no drift.
 */
export type Finding = {
  value?: string;
  drift: string[];
  held?: string;
  unchecked?: string;
  // The id of the rule it checks, when the rule has one.
  rule?: string;
};

/** @prose
 * # Held
 *
 * Some drift can't be fixed yet, because a tool the repository depends on doesn't support the
 * standard. Each hold names the repository and the check, says why, and says when to look
 * again. A held check is printed with its reason, and doesn't fail `craftz check`.
 *
 * A hold is for what a tool can't do, never for a choice. When the reason goes away, so does
 * the hold. A held check that has nothing left to hold reports that as drift, so a hold can't
 * outlive its reason.
 */
export const HELD: Record<string, Record<string, string>> = {
  base: {
    "versions-typescript":
      "svelte-check accepts TypeScript 5 and 6 only. Move when its peer range takes 7.",
    "cloudflare-config":
      "cf can't deploy SvelteKit, since the adapter doesn't write cf's Build Output. Move when it does.",
  },
};

function hold(repo: string, check: Check, finding: Finding | undefined): Finding | undefined {
  const reason = HELD[repo]?.[check.name];
  if (!reason) return finding;
  if (!finding?.drift.length) {
    return { ...finding, drift: [`${check.name} is held, but nothing has drifted: drop the hold`] };
  }
  return { ...finding, held: reason };
}

export type Check = {
  name: string;
  // The part of the rules it's in, which orders the checks.
  group: string;
  run: (repo: Repo) => Finding | undefined;
};

/** @prose
 * # Rules with an id
 *
 * A rule with an id is stated in the rules and checked in [rules.ts](rules.ts). Its check here
 * is named by its id, and grouped under the part the rules state it in.
 */
const statements = new Map(stated().map((s) => [s.id, s]));

function fromRule(rule: Rule): Check {
  const statement = statements.get(rule.id);
  return {
    name: rule.id,
    group: statement?.part ?? "",
    run: (repo) => {
      const finding = rule.check(repo);
      return finding && { ...finding, rule: rule.id };
    },
  };
}

// Every rule, in the order of the rules' parts, and within a part in the order rules.ts lists it.
const order = parts();
export const CHECKS = RULES.map(fromRule).toSorted(
  (a, b) => order.indexOf(a.group) - order.indexOf(b.group),
);

function repoOf(files: Files): Repo {
  const pkg = JSON.parse(files["package.json"] ?? "{}") as Pkg;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return { pkg, files, deps, vitePlus: deps["vite-plus"], worker: worker(files) };
}

/** @prose
 * # A folder
 *
 * Checks a folder from disk, which is how `craftz check` reads a repository, in its own CI or on
 * a laptop. Branch rules and labels aren't read, since they're settings, which `craftz settings`
 * reads and writes.
 *
 * A listed repository's holds apply, found by the repository its `origin` names, so a worktree or
 * a checkout under another name gets them too. A folder with no `origin` on GitHub, like one
 * `pnpm new` just wrote, goes by its own name.
 */
/** The repository the folder's `origin` names, when it's the owner's on GitHub. */
export function origin(dir: string): string | undefined {
  let url = "";
  try {
    url = execFileSync("git", ["-C", dir, "remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {}
  return new RegExp(`github\\.com[:/]${OWNER}/([^/]+?)(?:\\.git)?$`).exec(url)?.[1];
}

/** The repository a folder holds: the one its `origin` names, or else the folder's name. */
export const repoIn = (dir: string): string => origin(dir) ?? basename(dir);

export async function checkFolder(dir: string): Promise<{ findings: Finding[]; worker?: Worker }> {
  const repo = repoIn(dir);
  const it = repoOf(fromDisk(dir));
  const findings = CHECKS.flatMap((c) => hold(repo, c, c.run(it)) ?? []);
  return { findings, worker: it.worker };
}
