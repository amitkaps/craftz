/** @prose
 * # One temporary folder for a run
 *
 * The tests write repositories, installs and tarballs into temporary folders, and none removed
 * its own. Each `verify` left about 300 MB behind, and a few days of pull requests held 31 GB.
 * So a run points `TMPDIR` at a folder of its own, before any test starts, and removes it when the
 * run ends. Every `tmpdir()` in a test, and every command a test runs, writes inside it.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default function setup(): () => void {
  const dir = mkdtempSync(join(tmpdir(), "craftz-tests-"));
  process.env["TMPDIR"] = dir;
  return () => rmSync(dir, { recursive: true, force: true });
}

/** A folder inside the run's own, named by what it's for. */
export const tmp = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix));
