/** @prose
 * # Merged branches
 *
 * `craftz gone` deletes each local branch whose branch on GitHub is gone. GitHub deletes a branch
 * once its pull request merges, so that's each one that merged. A repository runs it as
 * `pnpm gone`, and it works where no git alias is set, like an agent's machine.
 *
 * A squash merge puts a new commit on `main`, so git can't tell the branch merged, and it's
 * deleted with `--force`. When the branch you're on is one of them, it switches to `main` and
 * pulls first.
 */
import { execFileSync } from "node:child_process";

const run = (...args: string[]): void => {
  execFileSync("git", args, { stdio: "inherit" });
};
const output = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** The branches in `git for-each-ref`'s lines whose upstream is gone. */
export const goneIn = (refs: string): string[] =>
  refs
    .split("\n")
    .filter((line) => line.endsWith(" [gone]"))
    .map((line) => line.slice(0, -" [gone]".length));

/** Deletes each local branch that merged. */
export function gone(): void {
  run("fetch", "--quiet", "--prune");
  const branches = goneIn(
    output("for-each-ref", "--format=%(refname:short) %(upstream:track)", "refs/heads"),
  );
  if (branches.includes(output("branch", "--show-current"))) {
    run("switch", "--quiet", "main");
    run("pull", "--quiet", "--prune");
  }
  for (const branch of branches) run("branch", "--delete", "--force", branch);
  if (!branches.length) console.log("No merged branches to delete.");
}
