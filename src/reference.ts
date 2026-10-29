/** @prose
 * # The reference
 *
 * The other modules read the rules from here. They're the files in [reference/](../reference/),
 * laid out as a repository has them, and their owner and topic on GitHub. Its `package.json` holds
 * the versions, engines and scripts. `root` is craftz itself, for the tools it runs. It imports nothing of
 * theirs, so any of them can import it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OWNER = "amitkaps";

// The GitHub topic every repository that follows the rules carries.
export const TOPIC = "craftz";

export const CRAFTZ = "@amitkaps/craftz";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const here = join(root, "reference");

export const read = (file: string): string => (existsSync(file) ? readFileSync(file, "utf8") : "");

/** The repository the folder's `origin` names, when it's the owner's on GitHub. */
export function origin(dir: string): string | undefined {
  let url = "";
  try {
    url = execFileSync("git", ["-C", dir, "remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // A folder that isn't a git checkout, or has no `origin`, names no repository.
  }
  return new RegExp(`github\\.com[:/]${OWNER}/([^/]+?)(?:\\.git)?$`).exec(url)?.[1];
}

/** @prose
 * # What's on main
 *
 * A command that judges what's live reads a file as it is on `main` on GitHub, not in the clone,
 * which can be behind ([Read what's live](../docs/rules.md#read-whats-live)). `onMain` is the one
 * way to read one.
 *
 * `status`, `release` and align all read through it, so a new command finds it here. It reads
 * through `gh`, so a private repository reads as a public one does, and a missing file throws.
 */
/** A file as it is on `main` in the owner's `repo` on GitHub: its text, and the `sha` a write to
 *  it names. */
export function onMain(repo: string, path: string): { text: string; sha: string } {
  const file = JSON.parse(
    execFileSync("gh", ["api", `repos/${OWNER}/${repo}/contents/${path}?ref=main`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  ) as { content: string; sha: string };
  return { text: Buffer.from(file.content, "base64").toString("utf8"), sha: file.sha };
}

export type Pkg = {
  name?: string;
  description?: string;
  private?: boolean;
  files?: string[];
  publishConfig?: { access?: string };
  packageManager?: string;
  devEngines?: {
    packageManager?: { name?: string; version?: string; onFail?: string };
    runtime?: { version?: string; onFail?: string };
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: { node?: string };
  // The rules this repository holds, each with its reason, as the rules' Holds say.
  craftz?: { hold?: Record<string, string> };
};

export const standard = JSON.parse(read(join(here, "package.json"))) as Pkg;

export const nodeMajor = /\d+/.exec(standard.engines?.node ?? "")?.[0];

/** @prose
 * # The shared versions
 *
 * Every repository that uses one of these tools is on the version this repository names, written
 * the same way, so moving one never leaves two repositories to reconcile.
 *
 * They're in the reference's `package.json`, each at one exact version, so the version a
 * repository names is the one it installs. npm isn't read. A new release is drift only once the
 * reference moves to it, which `pnpm bump` does.
 */
export const TOOLS = [
  "@types/node",
  "typescript",
  "@amitkaps/prose",
  "@amitkaps/markz",
  "cf",
  "wrangler",
  "publint",
  "@amitkaps/craftz",
];

/** The versions a folder names, as this one names the rules': `pnpm align` reads its clone. */
export function versionsIn(dir: string): Record<string, string | undefined> {
  const pkg = JSON.parse(read(join(dir, "package.json")) || "{}") as Pkg;
  return {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...craftzAt(dirname(dir)),
  };
}

/** @prose
 * # craftz's own version
 *
 * Every other repository depends on craftz at the version whose rules it follows, so the
 * reference is always inside craftz, and that version is the package's own. A release moves it,
 * and with it what `versions-craftz` asks for, so nothing has to be bumped twice.
 */
function craftzAt(dir: string): Record<string, string> {
  const pkg = JSON.parse(read(join(dir, "package.json")) || "{}") as Pkg & { version?: string };
  return pkg.name === CRAFTZ && pkg.version ? { [CRAFTZ]: pkg.version } : {};
}

export const VERSIONS = versionsIn(here);
