/** @prose
 * # One temporary folder for a run
 *
 * A run points `TMPDIR` at a folder of its own, before any test starts, and removes it when the
 * run ends. Every `tmpdir()` in a test, and every command a test runs, writes inside it.
 *
 * The tests write repositories, installs and tarballs into temporary folders, and none removed
 * its own. Each `verify` left about 300 MB behind, and a few days of pull requests held 31 GB.
 *
 * A run that is stopped can't remove its folder. `verify` stops the tests when `check` fails,
 * while they are still packing, and each such `verify` left a folder. So a folder holds the id of
 * the process that made it, and the next run removes the folders whose process has gone. One
 * with no id is removed once it is an hour old, since an older craftz made it.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PREFIX = "craftz-tests-";
const OWNER = "owner";
const HOUR = 60 * 60 * 1000;

const running = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Removes the run folders in `base` that a run which has gone left, and gives back their names. */
export function sweep(base: string): string[] {
  const removed: string[] = [];
  for (const name of readdirSync(base).filter((it) => it.startsWith(PREFIX))) {
    const folder = join(base, name);
    let gone: boolean;
    try {
      const pid = Number(readFileSync(join(folder, OWNER), "utf8"));
      gone = !running(pid);
    } catch {
      gone = Date.now() - statSync(folder).mtimeMs > HOUR;
    }
    if (!gone) continue;
    rmSync(folder, { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}

export default function setup(): () => void {
  const base = tmpdir();
  sweep(base);
  const dir = mkdtempSync(join(base, PREFIX));
  writeFileSync(join(dir, OWNER), String(process.pid));
  process.env["TMPDIR"] = dir;
  return () => rmSync(dir, { recursive: true, force: true });
}

/** A folder inside the run's own, named by what it's for. */
export const tmp = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix));
