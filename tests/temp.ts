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
 * while they are still packing, and each such `verify` left a folder. So the folder is owned the
 * way a command's is ([temp.ts](../src/temp.ts#clearing-what-a-run-left)), and the next run
 * clears what a run that has gone left.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claimed, clear } from "../src/temp.ts";

export default function setup(): () => void {
  clear();
  const dir = claimed("craftz-tests-");
  process.env["TMPDIR"] = dir;
  return () => rmSync(dir, { recursive: true, force: true });
}

/** A folder inside the run's own, named by what it's for. */
export const tmp = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix));
