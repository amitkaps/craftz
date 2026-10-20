/** @prose
 * # Settings
 *
 * What the rules set outside the repositories, where no file in one can hold it: each
 * repository's merge settings, branch rules and labels on GitHub, and each Worker's build settings
 * on Cloudflare. [drift.ts](drift.ts) reads them, and [apply.ts](apply.ts) writes them for
 * `craftz settings`, `align` and `new --push`. Both go through the logins `gh` and `cf` already
 * have, so there's no token to keep.
 *
 * A login that isn't there isn't drift. Each side says what it couldn't do, once, and the rest
 * goes on.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OWNER, here, nodeMajor, root } from "./reference.ts";
import type { Worker } from "./survey.ts";

const json = (file: string): unknown => JSON.parse(readFileSync(join(here, file), "utf8"));

/** @prose
 * # GitHub
 *
 * `gh`'s login is used for both reading and writing. Reading the merge settings needs it, since
 * GitHub shows them only to the owner, and the survey's other GitHub reads use its token for the
 * higher rate limit. Without a login, GitHub answers 60 requests an hour.
 */
export function githubLogin(): string | undefined {
  if (process.env["GITHUB_TOKEN"]) return process.env["GITHUB_TOKEN"];
  try {
    const token = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (token) process.env["GITHUB_TOKEN"] = token;
    return token || undefined;
  } catch {
    return undefined;
  }
}

// gh's own error goes in the thrown one, not on the terminal.
const gh = (...args: string[]): string =>
  execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const merging = json(".github/settings.json") as Record<string, unknown>;
const labels = json(".github/labels.json") as {
  name: string;
  color: string;
  description: string;
}[];

/** The merge settings, compared with [.github/settings.json](../reference/.github/settings.json). */
export function mergeDrift(repo: string): string[] {
  const found = JSON.parse(gh("api", `repos/${OWNER}/${repo}`)) as Record<string, unknown>;
  return Object.entries(merging)
    .filter(([key, want]) => found[key] !== want)
    .map(([key, want]) => `GitHub ${key} is ${String(found[key])}, not ${String(want)}`);
}

/** @prose
 * # Writing GitHub's settings
 *
 * The merge settings come from [.github/settings.json](../reference/.github/settings.json): squash only,
 * branches deleted after merging, and auto-merge on.
 *
 * The branch rules and a package's labels are the fixes of `github-rules` and `releases-labels`,
 * in [rules.ts](rules.ts), written by `writeRuleset` and `writeLabels` below.
 */
export function writeGitHub(repo: string): void {
  gh(
    "api",
    "--method",
    "PATCH",
    `repos/${OWNER}/${repo}`,
    "--input",
    join(here, ".github", "settings.json"),
  );
}

/** @prose
 * # Writing the labels
 *
 * The labels a package's release notes are grouped by, from
 * [.github/labels.json](../reference/.github/labels.json). Each is created, or updated when it exists, and
 * other labels are left alone.
 */
export function writeLabels(repo: string): void {
  for (const { name, color, description } of labels) {
    const repoFlag = ["-R", `${OWNER}/${repo}`];
    gh(
      "label",
      "create",
      name,
      ...repoFlag,
      "--color",
      color,
      "--description",
      description,
      "--force",
    );
  }
}

/** @prose
 * # Writing the branch rules
 *
 * A ruleset named `main`, from [.github/ruleset.json](../reference/.github/ruleset.json), created or
 * replaced, so writing twice changes nothing. Other rulesets are left alone.
 */
export function writeRuleset(repo: string): void {
  const api = `repos/${OWNER}/${repo}`;
  const ruleset = join(here, ".github", "ruleset.json");
  const sets = JSON.parse(gh("api", `${api}/rulesets`)) as { id: number; name: string }[];
  const main = sets.find((set) => set.name === "main");
  if (main) gh("api", "--method", "PUT", `${api}/rulesets/${main.id}`, "--input", ruleset);
  else gh("api", "--method", "POST", `${api}/rulesets`, "--input", ruleset);
}

/** @prose
 * # Classic branch protection
 *
 * The rules are the ruleset, so classic protection on `main` is one set of rules too many. But
 * craftz didn't create it, so `craftz settings` asks before removing it. `align` and `new --push`
 * remove it without asking, since the owner runs them on repositories the rules already own.
 * Without classic protection, GitHub answers 404.
 */
export function hasClassic(repo: string): boolean {
  try {
    gh("api", `repos/${OWNER}/${repo}/branches/main/protection`);
    return true;
  } catch {
    return false;
  }
}

/** Removes classic branch protection from `main`, which does nothing where there's none. */
export function removeClassic(repo: string): void {
  try {
    execFileSync(
      "gh",
      ["api", "--method", "DELETE", `repos/${OWNER}/${repo}/branches/main/protection`],
      { stdio: "ignore" },
    );
  } catch {}
}

/** @prose
 * # Cloudflare
 *
 * `cf`'s login reads and writes the Workers. Nothing is stored, and `CLOUDFLARE_ACCOUNT_ID`, when
 * set, wins.
 *
 * `cf` won't pick an account in a script when the login has several, so the one used is the
 * account named like the GitHub owner, which is where every Worker is, or the only one. The
 * answer is the reason it can't, or nothing when it can.
 */
export function cloudflareLogin(): string | undefined {
  if (!cfBin()) return "cf isn't installed";
  if (process.env["CLOUDFLARE_ACCOUNT_ID"]) return undefined;
  let accounts: { id: string; name: string }[];
  try {
    accounts = cf("accounts", "list") as { id: string; name: string }[];
  } catch {
    return "cf isn't logged in";
  }
  const account = accounts.length === 1 ? accounts[0] : accounts.find((a) => a.name === OWNER);
  if (!account) return `cf has no account named ${OWNER}, so set CLOUDFLARE_ACCOUNT_ID`;
  process.env["CLOUDFLARE_ACCOUNT_ID"] = account.id;
  return undefined;
}

// craftz's own cf, or, where craftz is installed without it, the repository's, which a site has.
// An app on wrangler has neither.
const cfBin = (): string | undefined =>
  [root, process.cwd()].map((dir) => join(dir, "node_modules", ".bin", "cf")).find(existsSync);

export function cf(...args: string[]): unknown {
  const bin = cfBin();
  if (!bin) throw new Error("cf isn't installed");
  const out = execFileSync(bin, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CF_QUIET: "1" },
  });
  return out.trim() ? JSON.parse(out) : undefined;
}

/** @prose
 * # A Worker's build settings
 *
 * The build and deploy commands live on the Worker, not in the repository, since cf's config has
 * no field for them. Every Worker has the same ones, and `NODE_VERSION` set to the Node that
 * `engines` asks for, since Cloudflare's build reads pnpm's version from the repository but not
 * Node's. Previews stay off, as CI already checks every pull request.
 */
const BUILD = {
  build_command: "pnpm run verify",
  deploy_command: "pnpm run ship",
  root_directory: "/",
  build_caching_enabled: true,
};

type Builds = {
  production_settings: Record<string, unknown> & {
    environment_variables?: Record<string, { value?: string }>;
  };
  previews_enabled?: boolean;
};

let workers: { id: string; name: string; subdomain?: { url?: string } }[] | undefined;

/** A Worker's id on Cloudflare, by name, and its `workers.dev` address. */
export function workerTag(name: string): { id: string; dev?: string } | undefined {
  workers ??= cf("workers", "list") as typeof workers;
  const found = workers?.find((w) => w.name === name);
  return found && { id: found.id, dev: found.subdomain?.url };
}

const tag = (name: string): string | undefined => workerTag(name)?.id;

// A Worker that isn't connected to its repository has no build settings, and Cloudflare says so
// with error 12040.
function buildDrift(tagId: string): string[] {
  let builds: Builds;
  try {
    builds = cf("builds", "workers", "get", tagId) as Builds;
  } catch (error) {
    if ((error as Error).message.includes("[12040]")) {
      return ["Worker isn't connected to its repository"];
    }
    throw error;
  }
  const settings = builds.production_settings;
  const drift: string[] = [];
  for (const [key, want] of Object.entries(BUILD)) {
    if (settings[key] !== want)
      drift.push(`Worker ${key} is ${String(settings[key])}, not ${want}`);
  }
  const node = settings.environment_variables?.["NODE_VERSION"]?.value;
  if (node !== nodeMajor) drift.push(`Worker NODE_VERSION is ${node}, not ${nodeMajor}`);
  if (builds.previews_enabled) drift.push("Worker previews are on");
  return drift;
}

export function workerDrift(name: string): string[] {
  const found = tag(name);
  return found ? buildDrift(found) : [`no Worker named ${name} on Cloudflare`];
}

/** @prose
 * # Writing a Worker's build settings
 *
 * Writes only what has drifted, so a Worker that's already right isn't touched. The commands sit
 * on the Worker's build trigger, and its variables beside them. A Worker that isn't connected to
 * its repository yet has no trigger, and connecting it is the one step left to the dashboard.
 *
 * It answers what it left, and nothing when it wrote. Whether the write landed is for reading
 * back, which [apply.ts](apply.ts) does.
 */
export function writeWorker(name: string): string[] {
  const found = tag(name);
  if (!found) return [`left: no Worker named ${name} on Cloudflare`];
  const drift = buildDrift(found);
  if (!drift.length) return [];
  const triggers = cf("builds", "triggers", "list", "--external-script-id", found) as {
    trigger_uuid: string;
  }[];
  const trigger = triggers[0]?.trigger_uuid;
  if (!trigger) return [`left: ${name} isn't connected to its repository yet`];
  cf(
    "builds",
    "triggers",
    "update",
    trigger,
    "--build-command",
    BUILD.build_command,
    "--deploy-command",
    BUILD.deploy_command,
    "--root-directory",
    BUILD.root_directory,
    "--build-caching-enabled",
    String(BUILD.build_caching_enabled),
  );
  const node = { NODE_VERSION: { value: nodeMajor, is_secret: false } };
  cf(
    "builds",
    "triggers",
    "environment-variables",
    "upsert",
    trigger,
    "--body",
    JSON.stringify(node),
  );
  cf("builds", "workers", "update", found, "--previews-enabled", "false");
  return [];
}

/** @prose
 * # Rebuilding a site
 *
 * Starts a Worker's build from `main` through its trigger, the way a push to `main` does. align
 * uses it for a site that reads the other repositories when it's built, so it shows what moved.
 */
export function rebuild(name: string): string {
  const found = tag(name);
  if (!found) return `not rebuilt: no Worker named ${name} on Cloudflare`;
  const triggers = cf("builds", "triggers", "list", "--external-script-id", found) as {
    trigger_uuid: string;
  }[];
  const trigger = triggers[0]?.trigger_uuid;
  if (!trigger) return `not rebuilt: ${name} isn't connected to its repository yet`;
  cf("builds", "create", trigger, "--branch", "main");
  return `rebuilding ${name} from main`;
}

/** @prose
 * # Access
 *
 * A site is internal when an Access application covers its domain, and Access lets in only who
 * its policies name. One with no policy lets nobody in, so it's drift. Any site can be internal,
 * in a public repository or a private one, since the code's visibility and the site's are
 * separate axes.
 *
 * With no application, the site is public. That's said once, not counted as drift, so a site
 * meant to be internal doesn't go public unseen.
 *
 * Access is turned on once per account, in the Zero Trust dashboard, and until it is, the
 * lookup fails and says so. Access isn't written, since who it lets in is a choice for each site.
 */
export function accessDrift(site: Worker): { public: boolean; drift: string[] } {
  if (!site.domain)
    return { public: false, drift: [`${site.name} has no domain for Access to cover`] };
  let apps: { policies?: unknown[] }[];
  try {
    apps = cf("zero-trust", "access", "applications", "list", "--domain", site.domain) as {
      policies?: unknown[];
    }[];
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { public: false, drift: [`Access couldn't be read for ${site.domain}: ${reason}`] };
  }
  if (!apps.length) return { public: true, drift: [] };
  if (!apps.some((app) => app.policies?.length)) {
    return { public: false, drift: [`the Access application for ${site.domain} has no policy`] };
  }
  return { public: false, drift: [] };
}
