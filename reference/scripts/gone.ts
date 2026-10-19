/** @prose
 * # Merged branches
 *
 * `pnpm gone` deletes each local branch whose branch on GitHub is gone. GitHub deletes a branch
 * once its pull request merges, so that's each one that merged. It's the same file in every
 * repository, copied from [craftz](https://craftz.amitkaps.com/docs/rules.md#scripts), and works
 * where no git alias is set, like an agent's machine.
 *
 * A squash merge puts a new commit on `main`, so git can't tell the branch merged, and it's
 * deleted with `--force`. When the branch you're on is one of them, it switches to `main` and
 * pulls first.
 */
// Node's types, for a repository whose tsconfig.json doesn't include scripts/.
/// <reference types="node" />
import { execFileSync } from "node:child_process";

const run = (...args: string[]): void => {
  execFileSync("git", args, { stdio: "inherit" });
};
const output = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

run("fetch", "--quiet", "--prune");
const gone = output("for-each-ref", "--format=%(refname:short) %(upstream:track)", "refs/heads")
  .split("\n")
  .filter((line) => line.endsWith(" [gone]"))
  .map((line) => line.slice(0, -" [gone]".length));

if (gone.includes(output("branch", "--show-current"))) {
  run("switch", "--quiet", "main");
  run("pull", "--quiet", "--prune");
}
for (const branch of gone) run("branch", "--delete", "--force", branch);
if (!gone.length) console.log("No merged branches to delete.");
