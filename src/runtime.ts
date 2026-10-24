/** @prose
 * # The Workers' date
 *
 * The compatibility date every Worker on cf runs at: the build date of the workerd that the
 * reference's cf depends on, through miniflare. workerd's version carries it, as in
 * `1.20261012.1`. It's the newest date cf's local runtime knows, and it moves only when the
 * reference's cf does.
 *
 * From 2026-08-04, the date turns on Node.js compatibility, so no Worker sets a flag for it.
 *
 * craftz doesn't install cf, since workerd is most of an install and only its version is read
 * here. So npm is asked which workerd the pinned cf brings, and the answer is kept in
 * [workerd.json](workerd.json) with the cf it's for. When the reference's cf moves, by `pnpm bump`
 * or by hand, the first run from source asks again and rewrites the file, which goes in the same
 * change. Until then, nothing reads npm, so `verify` and the tests run offline.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { VERSIONS } from "./reference.ts";

type Pinned = { cf: string; workerd: string };

const file = new URL("workerd.json", import.meta.url);
const cf = VERSIONS["cf"] ?? "";

// The one version of a dependency that a package names, read from npm.
const dependency = (pkg: string, name: string): string =>
  JSON.parse(
    execFileSync("pnpm", ["view", pkg, `dependencies.${name}`, "--json"], { encoding: "utf8" }),
  ) as string;

function pinned(): Pinned {
  const kept = JSON.parse(readFileSync(file, "utf8")) as Pinned;
  if (kept.cf === cf) return kept;
  const miniflare = dependency(`cf@${cf}`, "miniflare");
  const found = { cf, workerd: dependency(`miniflare@${miniflare}`, "workerd") };
  writeFileSync(file, `${JSON.stringify(found, null, 2)}\n`);
  return found;
}

const { workerd } = pinned();
const built = /^\d+\.(\d{4})(\d{2})(\d{2})\./.exec(workerd);
if (!built) throw new Error(`workerd ${workerd} doesn't carry a date`);

export const COMPATIBILITY_DATE = `${built[1]}-${built[2]}-${built[3]}`;
