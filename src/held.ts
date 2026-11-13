/** @prose
 * # Tools held by hand
 *
 * `pnpm bump` lists the shared tools it can't move itself that have a newer version. They're
 * pnpm, the Node floor and each beta that [`versions-beta`](../docs/rules.md#versions-beta) names.
 * It lists them in craftz's pull request and doesn't take them, as it does a library's major.
 *
 * Each of these is pinned by hand, because moving one moves every repository at once, and a beta's
 * tags don't say which build goes with which. A person moved them only when they happened to look,
 * and agents kept missing a pnpm or a `cf` build that had been out for a week. Listing them on
 * every bump puts them where the bump is read. `@playwright/test` is left out, since it waits for
 * the Claude Code cloud image on purpose, and a line that can never be acted on is noise.
 *
 * A release under a day old is listed too. pnpm's one-day wait applies to what a person takes, and
 * the line says what npm has. A tool that couldn't be compared is named, and never skipped quietly.
 */
import { type Pkg, isPrerelease, graduated } from "./reference.ts";
import { betas } from "./rules/versions.ts";

/** The tools `pnpm outdated` lists that `pnpm bump` never updates, since `heldTools` lists them. */
export const HELD_BY_HAND = ["node", "pnpm"];

/** The newest version of a tool, or `undefined` when it couldn't be read. `node` is the newest
 *  LTS release from nodejs.org, and any other name is npm's `latest` tag. */
export type Latest = (name: string) => Promise<string | undefined>;

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
};

export const fromRegistries: Latest = async (name) => {
  try {
    if (name === "node") {
      const releases = (await fetchJson("https://nodejs.org/dist/index.json")) as {
        version: string;
        lts: string | false;
      }[];
      return releases.find((it) => it.lts)?.version.replace(/^v/, "");
    }
    return ((await fetchJson(`https://registry.npmjs.org/${name}/latest`)) as { version: string })
      .version;
  } catch {
    return undefined;
  }
};

const numbers = (version: string): number[] =>
  version
    .replace(/^[^\d]*/, "")
    .split(/[.-]/)
    .map(Number);

/** Whether `a` is a later version than `b`, comparing their numbers in order. A tag's number
 *  counts too, so `1.0.0-beta.28` is later than `1.0.0-beta.21`. */
export const later = (a: string, b: string): boolean => {
  const [x, y] = [numbers(a), numbers(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const [p = 0, q = 0] = [x[i], y[i]];
    if (Number.isNaN(p) || Number.isNaN(q)) continue;
    if (p !== q) return p > q;
  }
  return false;
};

/** What `pnpm bump` lists for the reference's `pkg`: pnpm, the Node floor and each beta with a
 *  newer version, like `pnpm 12.18.0, from 12.16.1`, and each tool that couldn't be compared,
 *  with why. */
export async function heldTools(pkg: Pkg, latest: Latest = fromRegistries): Promise<string[]> {
  const found: string[] = [];
  const check = async (name: string, ours: string | undefined, beta = false): Promise<void> => {
    const newest = await latest(name);
    if (ours === undefined)
      found.push(`${name} wasn't checked, since the reference has no version`);
    else if (newest === undefined) found.push(`${name} wasn't checked, since no version was read`);
    // A release of a beta is listed with the libraries' majors.
    else if (beta && graduated(ours, newest)) return;
    else if (later(newest, ours)) found.push(`${name} ${newest}, from ${ours}`);
  };
  await check("pnpm", pkg.devEngines?.packageManager?.version);
  await check("node", pkg.devEngines?.runtime?.version?.replace(/^[^\d]*/, ""));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of betas()) {
    const ours = deps[name];
    if (ours === undefined || isPrerelease(ours)) await check(name, ours, true);
  }
  return found;
}
