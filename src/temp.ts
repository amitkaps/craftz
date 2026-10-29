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
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const made = new Map<string, boolean>();

process.on("exit", (code) => {
  for (const [dir, kept] of made) {
    if (kept) continue;
    if (code) console.error(`Kept ${dir}, since the run failed.`);
    else rmSync(dir, { recursive: true, force: true });
  }
});

/** A new folder in the system's temporary one, named from `prefix`, removed when the process
 *  exits unless it's kept or the run fails. */
export function temporary(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.set(dir, false);
  return dir;
}

/** Keeps a folder `temporary` made once the process exits. */
export function keep(dir: string): void {
  if (made.has(dir)) made.set(dir, true);
}
