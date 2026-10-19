/** @prose
 * # The survey
 *
 * Reads every repository and checks it against the rules, returning what it found as data.
 * `pnpm drift` prints it, and a page can show it as tables.
 *
 * Each repository is compared with the files in [reference/](../reference/), so there's no second
 * copy of them to keep in step. [The rules](../docs/rules.md) say what each check means.
 *
 * Every repository is read from GitHub, from `main`, so a check run on a laptop and one run in CI
 * see the same thing. To check a fix before it's pushed, `pnpm drift` takes the folder instead
 * ([A folder](#a-folder)).
 */
import { basename, join } from "node:path";
import { type Rule, RULES } from "./rules.ts";
import { parts, stated } from "./stated.ts";
import { OWNER, type Pkg, read } from "./reference.ts";

export const REPOS = ["base", "markz", "prose", "pagez", "sitez", "ship"];

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
  "AGENTS.md",
  "CLAUDE.md",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
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

// A missing file is an empty one, as on disk. Any other failure means the repository couldn't
// be read, and the survey says so rather than reporting drift that isn't there.
async function fromGitHub(repo: string): Promise<Files> {
  const entries = await Promise.all(
    FILES.map(async (file) => {
      const url = `https://raw.githubusercontent.com/${OWNER}/${repo}/main/${file}`;
      const res = await fetch(url);
      if (res.status === 404) return [file, ""];
      if (!res.ok) throw new Error(`${file} returned HTTP ${res.status}`);
      return [file, await res.text()];
    }),
  );
  return Object.fromEntries(entries);
}

/** @prose
 * # A repository's Worker
 *
 * A repository deploys if it has a Cloudflare config, and the Worker's name is read from it.
 * `cloudflare.config.ts` is the one to use, and `wrangler.jsonc` and `wrangler.toml` are the ones
 * still on wrangler. A regular expression is enough, since each file states `name` once.
 *
 * Its domain is read the same way, the first in `domains` or the first route's `pattern`, and
 * the page links to it under the repository's name.
 *
 * So is whether it turns off `workers.dev` and preview URLs, each on unless the config says
 * otherwise. cf's config names them `workersDev` and `previewUrls`, and wrangler's `workers_dev`
 * and `preview_urls`.
 *
 * And what it deploys, the deploy axis in [the rules](../docs/rules.md#axes). A Worker with code
 * of its own, cf's `entrypoint` or wrangler's `main`, is an app, and one without is a static
 * site, whatever builds its files.
 */
export type Worker = {
  file: string;
  name: string;
  domain?: string;
  workersDev: boolean;
  previewUrls: boolean;
  deploys: "static" | "app";
};

const off = (text: string, key: string): boolean =>
  new RegExp(`"?${key}"?\\s*[:=]\\s*false`).test(text);

export function worker(files: Files): Worker | undefined {
  for (const file of ["cloudflare.config.ts", "wrangler.jsonc", "wrangler.toml"]) {
    const text = files[file] ?? "";
    const name = /^\s*"?name"?\s*[:=]\s*"([^"]+)"/m.exec(text)?.[1];
    const domain = /(?:domains"?\s*:\s*\[\s*|"?pattern"?\s*[:=]\s*)"([^"]+)"/.exec(text)?.[1];
    const workersDev = !off(text, "workersDev") && !off(text, "workers_dev");
    const previewUrls = !off(text, "previewUrls") && !off(text, "preview_urls");
    const deploys = /^\s*"?(?:entrypoint|main)"?\s*[:=]/m.test(text) ? "app" : "static";
    if (name) return { file, name, domain, workersDev, previewUrls, deploys };
  }
  return undefined;
}

/** @prose
 * # A package's release
 *
 * The version npm gives a user today, read from npm when the survey runs, so the page shows what
 * people install rather than what's on `main`. A package npm doesn't have yet has no version.
 */
export type Release = { name: string; version?: string } | Error;

async function release(name: string): Promise<Release> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}/latest`);
    if (res.status === 404) return { name };
    if (!res.ok) throw new Error(`npm returned HTTP ${res.status}`);
    const { version } = (await res.json()) as { version: string };
    return { name, version };
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/** @prose
 * # Branch rules
 *
 * GitHub shows a public repository's branch rules to anyone, so the survey reads them without a
 * login, and `github-rules` compares them with [.github/ruleset.json](../reference/.github/ruleset.json). A
 * `GITHUB_TOKEN`, when set, only raises the rate limit.
 */
export type BranchRule = { type: string; parameters?: Record<string, unknown> };

/** @prose
 * # GitHub's rate limit
 *
 * Without a login, GitHub answers 60 requests an hour, and each survey makes a few for every
 * repository, so a handful of runs can use them up. That's not drift. The check says it wasn't
 * made, and doesn't fail `pnpm drift`. `pnpm drift` logs in with `gh` when it can.
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
 * Each check covers one part of the rules, and says what it expects in a line the page shows
 * beside it. The checks run, and the page lists them, in the order of the rules' parts, so
 * the page reads like the rules.
 *
 * A check returns what
 * the repository has, like the version it pins, and what has drifted, which is empty when
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
 * again. A held check shows amber on the page with its reason, and doesn't fail `pnpm drift`.
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
  // The part of the rules it's in, which a page groups it under.
  group: string;
  rule: string;
  // Where the rules state it, for a rule with an id.
  see?: string;
  run: (repo: Repo) => Finding | undefined;
};

/** @prose
 * # Rules with an id
 *
 * A rule with an id is stated in the rules and checked in [rules.ts](rules.ts). Its check here
 * is named by its id, and the line the page shows beside it is the rule's first sentence, as the
 * rules have it, so there's no second wording to keep in step.
 */
const statements = new Map(stated().map((s) => [s.id, s]));

function fromRule(rule: Rule): Check {
  const statement = statements.get(rule.id);
  return {
    name: rule.id,
    group: statement?.part ?? "",
    rule: [rule.wants, /^(.+?\.)(\s|$)/.exec(statement?.text ?? "")?.[1]]
      .filter(Boolean)
      .join(": "),
    see: statement?.see,
    run: (repo) => {
      const finding = rule.check(repo);
      return finding && { ...finding, rule: rule.id };
    },
  };
}

const ruled = (prefix: string): Check[] =>
  RULES.filter((rule) => rule.id.startsWith(prefix)).map(fromRule);

const listed: Check[] = [
  ...ruled("versions-"),
  ...ruled("toolchain-"),
  ...ruled("scripts-"),
  ...ruled("cloudflare-"),
  ...ruled("github-"),
  ...ruled("agents-"),
  ...ruled("docs-"),
  ...ruled("releases-"),
];

const order = parts();
export const CHECKS = listed.toSorted((a, b) => order.indexOf(a.group) - order.indexOf(b.group));

export type Result = {
  repo: string;
  // Set when the repository couldn't be read, and then nothing else is.
  error?: string;
  // One entry per check, in the order of `CHECKS`.
  findings: (Finding | undefined)[];
  scripts: Record<string, string>;
  worker?: Worker;
  // Set for a package.
  release?: Release;
};

function repoOf(files: Files): Repo {
  const pkg = JSON.parse(files["package.json"] ?? "{}") as Pkg;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return { pkg, files, deps, vitePlus: deps["vite-plus"], worker: worker(files) };
}

async function check(repo: string): Promise<Result> {
  const rules = branchRules(repo);
  let files: Files;
  try {
    files = await fromGitHub(repo);
  } catch (error) {
    return { repo, error: `couldn't be read: ${String(error)}`, findings: [], scripts: {} };
  }
  if (!files["package.json"]) return { repo, error: "no package.json", findings: [], scripts: {} };
  const it = repoOf(files);
  const published = it.pkg.private || !it.pkg.name ? undefined : release(it.pkg.name);
  it.rules = await rules;
  if (!it.pkg.private) it.labels = await repoLabels(repo);
  return {
    repo,
    findings: CHECKS.map((c) => hold(repo, c, c.run(it))),
    scripts: it.pkg.scripts ?? {},
    worker: it.worker,
    release: await published,
  };
}

export async function survey(): Promise<Result[]> {
  return Promise.all(REPOS.map((repo) => check(repo)));
}

/** @prose
 * # A folder
 *
 * Checks a folder from disk: a checkout of a listed repository, to see a fix before it's pushed,
 * or one that isn't in `REPOS`, like one `pnpm new` just wrote or a private one.
 *
 * A listed
 * repository's holds apply, found by the folder's name. Branch rules and labels aren't read,
 * since `pnpm align` writes them and `pnpm drift` reads them from GitHub. Its Worker comes back
 * too, so `pnpm drift <folder>` can check its settings and look up its Access.
 */
/** A folder's files, read as the checks read a repository, for `pnpm align`'s fixes. */

export async function checkFolder(dir: string): Promise<{ findings: Finding[]; worker?: Worker }> {
  const repo = basename(dir);
  const it = repoOf(fromDisk(dir));
  const findings = CHECKS.flatMap((c) => hold(repo, c, c.run(it)) ?? []);
  return { findings, worker: it.worker };
}
