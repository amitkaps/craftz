/** @prose
 * # Notes
 *
 * What `craftz check` says when nothing has drifted but something is worth knowing: a newer
 * craftz than the one a repository installs, and a beta that's graduated. A note never fails the
 * check.
 *
 * Both read npm. When npm can't be reached in a few seconds, there's no note, so CI never fails
 * because npm is down.
 */
import { CRAFTZ, type Pkg } from "./reference.ts";
import { BETA } from "./rules.ts";

/** npm's latest version of a package, or `undefined` when npm doesn't answer. */
export type Latest = (name: string) => Promise<string | undefined>;

const fromNpm: Latest = async (name) => {
  try {
    const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2f")}/latest`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return undefined;
    return ((await res.json()) as { version?: string }).version;
  } catch {
    return undefined;
  }
};

const EXACT = /^\d+\.\d+\.\d+$/;
const numbers = (version: string): number[] => version.split("-")[0]?.split(".").map(Number) ?? [];

// Whether `a` is a later release than `b`, by its numbers.
function later(a: string, b: string): boolean {
  const [x, y] = [numbers(a), numbers(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/** @prose
 * # A newer craftz
 *
 * A repository on an exact craftz hears of a later one, with the command that moves it. One on a
 * tarball or a link, like craftz's own test, has nothing to compare.
 *
 * # A graduated beta
 *
 * A beta that `versions-beta` names has graduated once npm's latest is a release at its major or
 * later. Only craftz's own repository hears of it, since its reference moves the betas, and every
 * other repository follows.
 */
export async function notes(pkg: Pkg, latest: Latest = fromNpm): Promise<string[]> {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const found: string[] = [];
  const own = deps[CRAFTZ];
  if (own && EXACT.test(own)) {
    const newest = await latest(CRAFTZ);
    if (newest && later(newest, own)) {
      found.push(`craftz ${newest} is out, and this is on ${own}: run pnpm craftz upgrade`);
    }
  }
  if (pkg.name === CRAFTZ) {
    for (const name of BETA) {
      const beta = deps[name];
      if (!beta?.includes("-")) continue;
      const newest = await latest(name);
      if (newest && !newest.includes("-") && (numbers(newest)[0] ?? 0) >= (numbers(beta)[0] ?? 0)) {
        found.push(
          `${name} ${newest} is a release of the beta ${beta}, so it can leave versions-beta`,
        );
      }
    }
  }
  return found;
}
