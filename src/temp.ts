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
 * a folder whose process has gone, and one that is kept, once it is six hours old, or at once with `--all`. It never touches
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
const HOUR = 60 * 60 * 1000;
const KEPT = 6 * HOUR;

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

/** Whether a folder goes, and the reason in words either way. */
function judged(folder: string, all: boolean): { clears: boolean; why: string } {
  let pid = Number.NaN;
  try {
    pid = Number(readFileSync(join(folder, OWNER), "utf8"));
  } catch {
    // No owner: the folder was kept.
  }
  if (!Number.isNaN(pid)) {
    return running(pid)
      ? { clears: false, why: "its run is still going" }
      : { clears: true, why: "its run has gone" };
  }
  if (all) return { clears: true, why: "kept, and --all was given" };
  const left = KEPT - (Date.now() - statSync(folder).mtimeMs);
  return left <= 0
    ? { clears: true, why: "kept, and over 6 hours old" }
    : { clears: false, why: `kept, under 6 hours old, so it clears in ${Math.ceil(left / HOUR)} h` };
}

const kilobytes = (folder: string): number =>
  Number(/^\d+/.exec(spawnSync("du", ["-sk", folder], { encoding: "utf8" }).stdout)?.[0] ?? 0);

export type Found = { folder: string; clears: boolean; why: string; kilobytes: number };

/** Every folder craftz made in `base`, judged, and removed when it clears unless `only`. `all`
 *  clears a kept folder at any age. */
export function clear(base = tmpdir(), only = false, all = false): Found[] {
  const found: Found[] = [];
  for (const name of readdirSync(base).filter((it) => it.startsWith(PREFIX))) {
    const folder = join(base, name);
    const judgment = judged(folder, all);
    found.push({ folder, ...judgment, kilobytes: kilobytes(folder) });
    if (judgment.clears && !only) rmSync(folder, { recursive: true, force: true });
  }
  return found;
}

const size = (kb: number) =>
  kb > 1024 * 1024 ? `${(kb / 1024 / 1024).toFixed(1)} GB` : `${Math.round(kb / 1024)} MB`;

/** A line for each folder that was cleared, and nothing for the rest. */
export const cleared = (found: Found[]): string[] =>
  found
    .filter((it) => it.clears)
    .map((it) => `Cleared ${it.folder}, ${size(it.kilobytes)}, since ${it.why}.`);

/** What `clear` says: the folders that clear, and the folders that stay, each with why. */
export function report(found: Found[], only: boolean): string {
  const line = (it: Found) => `  ${it.folder}  ${size(it.kilobytes)}  ${it.why}`;
  const goes = found.filter((it) => it.clears);
  const stays = found.filter((it) => !it.clears);
  if (!found.length) return "No craftz folders in the temporary folder.";
  return [
    goes.length
      ? `${only ? "Will clear" : "Cleared"}:\n${goes.map(line).join("\n")}`
      : "Nothing to clear.",
    ...(stays.length ? [`Stays:\n${stays.map(line).join("\n")}`] : []),
  ].join("\n\n");
}
