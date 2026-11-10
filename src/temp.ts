/** @prose
 * # Temporary folders
 *
 * A command that needs a folder for one run takes it from `temporary`, which removes it when the
 * process exits, as the rules' [A run removes what it writes](../docs/rules.md#a-run-removes-what-it-writes)
 * asks. A run that wants one looked at, like align's clone of a repository that failed, calls
 * `keep` and says where it is itself.
 *
 * A run that fails keeps its folders too, and says where each is, since what failed is often in
 * one, like the notes `release` was given. A test fails a `mkdtemp` anywhere else in `src/`, so a
 * new command can't make a folder that outlives it.
 *
 * # Clearing what a run left
 *
 * A run that is stopped can't remove its folder, and a kept one stays until someone looks. So
 * every folder is named `craftz-<what>-…`, which is how `clear` tells it from any other, and
 * holds the id of the process that made it for as long as that process owns it. `clear` removes
 * a folder whose process has gone, and one that is kept, once it is a day old. It never touches
 * a folder whose process is running, or one with another name. `craftz gone` runs it first, so
 * nobody has to remember to.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** What every folder craftz makes starts with. */
export const PREFIX = "craftz-";
/** The file that says a process still owns its folder. A folder without it is kept. */
const OWNER = "owner";
/** How long a kept folder stays. */
const DAY = 24 * 60 * 60 * 1000;

const made = new Map<string, boolean>();

process.on("exit", (code) => {
  for (const [dir, kept] of made) {
    if (kept) continue;
    if (code) {
      console.error(`Kept ${dir}, since the run failed.`);
      release(dir);
    } else rmSync(dir, { recursive: true, force: true });
  }
});

const release = (dir: string): void => rmSync(join(dir, OWNER), { force: true });

/** Makes `prefix` a folder of the system's temporary one, owned by this process. */
export function claimed(prefix: string): string {
  if (!/^craftz-[a-z]+-$/.test(prefix)) {
    throw new Error(`a temporary folder is named craftz-<what>-, not ${prefix}`);
  }
  const dir = mkdtempSync(join(tmpdir(), prefix));
  writeFileSync(join(dir, OWNER), String(process.pid));
  return dir;
}

/** A new folder in the system's temporary one, named from `prefix`, removed when the process
 *  exits unless it's kept or the run fails. */
export function temporary(prefix: string): string {
  const dir = claimed(prefix);
  made.set(dir, false);
  return dir;
}

/** Keeps a folder `temporary` made once the process exits. */
export function keep(dir: string): void {
  if (made.has(dir)) made.set(dir, true);
  release(dir);
}

const running = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Why a folder is stale, or `undefined` while it is still wanted. */
function staleBecause(folder: string): string | undefined {
  let pid = Number.NaN;
  try {
    pid = Number(readFileSync(join(folder, OWNER), "utf8"));
  } catch {
    // No owner: the folder was kept.
  }
  if (!Number.isNaN(pid)) return running(pid) ? undefined : "its run had gone";
  return Date.now() - statSync(folder).mtimeMs > DAY ? "kept for more than a day" : undefined;
}

const kilobytes = (folder: string): number =>
  Number(/^\d+/.exec(spawnSync("du", ["-sk", folder], { encoding: "utf8" }).stdout)?.[0] ?? 0);

export type Cleared = { folder: string; why: string; kilobytes: number };

/** Removes, or with `only` lists, the stale folders craftz made in `base`. */
export function clear(base = tmpdir(), only = false): Cleared[] {
  const found: Cleared[] = [];
  for (const name of readdirSync(base).filter((it) => it.startsWith(PREFIX))) {
    const folder = join(base, name);
    const why = staleBecause(folder);
    if (!why) continue;
    found.push({ folder, why, kilobytes: kilobytes(folder) });
    if (!only) rmSync(folder, { recursive: true, force: true });
  }
  return found;
}

/** What `clear` did, one line for each folder, and nothing when there was none. */
export function cleared(found: Cleared[], only = false): string[] {
  const size = (kb: number) =>
    kb > 1024 * 1024 ? `${(kb / 1024 / 1024).toFixed(1)} GB` : `${Math.round(kb / 1024)} MB`;
  return found.map(
    ({ folder, why, kilobytes }) =>
      `${only ? "Would clear" : "Cleared"} ${folder}, ${size(kilobytes)}, since ${why}.`,
  );
}
