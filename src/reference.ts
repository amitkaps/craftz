/** @prose
 * # The reference
 *
 * What the other modules read as the rules: the files in [reference/](../reference/), laid out
 * as a repository has them, their owner on GitHub, and its `package.json`, whose versions, engines and scripts
 * are the rules'. `root` is craftz itself, for the tools it runs. It imports nothing of
 * theirs, so any of them can import it.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OWNER = "amitkaps";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const here = join(root, "reference");

export const read = (file: string): string => (existsSync(file) ? readFileSync(file, "utf8") : "");

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
};

export const standard = JSON.parse(read(join(here, "package.json"))) as Pkg;

export const nodeMajor = /\d+/.exec(standard.engines?.node ?? "")?.[0];

/** @prose
 * # The shared versions
 *
 * Every repository that uses one of these tools is on the version this repository names, written
 * the same way, so moving one never leaves two repositories to reconcile.
 *
 * Most come from this repository's own `package.json`. The ones it doesn't use, like wrangler,
 * are named in the `catalog` of its `pnpm-workspace.yaml`, which nothing here installs. npm isn't
 * read. A new release is drift only once this repository moves to it, which `pnpm align` does.
 */
export const TOOLS = [
  "@types/node",
  "typescript",
  "@amitkaps/prose",
  "@amitkaps/markz",
  "cf",
  "@cloudflare/vite-plugin",
  "wrangler",
  "publint",
];

// `name: version` lines under `catalog:`, quoted or not. A regular expression is enough, since
// the block is flat.
export function catalog(workspace: string): Record<string, string> {
  const block = /^catalog:\n((?:[ \t]+.*\n?)*)/m.exec(workspace)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/^\s+"?([^":\s]+)"?:\s*"?([^"\s]+)"?/gm)].map((m) => [m[1], m[2]]),
  );
}

/** The versions a folder names, as this one names the rules': `pnpm align` reads its clone. */
export function versionsIn(dir: string): Record<string, string | undefined> {
  const pkg = JSON.parse(read(join(dir, "package.json")) || "{}") as Pkg;
  return {
    ...catalog(read(join(dir, "pnpm-workspace.yaml"))),
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
}

export const VERSIONS = versionsIn(here);
