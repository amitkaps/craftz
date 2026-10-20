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
 *
 * Git won't delete a branch that another worktree has checked out, so that worktree is removed
 * first. One git won't remove, such as one with changes, is kept with its branch, and `gone` goes on.
 */
import { execFileSync } from "node:child_process";

const run = (...args: string[]): void => {
  execFileSync("git", args, { stdio: "inherit" });
};
const output = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** A merged branch, and the worktree that has it checked out, if one does. */
export interface Gone {
  branch: string;
  worktree?: string;
}

/** The branches in `git for-each-ref`'s tab-separated lines whose upstream is gone. */
export const goneIn = (refs: string): Gone[] =>
  refs
    .split("\n")
    .map((line) => line.split("\t"))
    .filter(([, track]) => track === "[gone]")
    .map(([branch = "", , worktree]) => (worktree ? { branch, worktree } : { branch }));

/** Deletes each local branch that merged. */
export function gone(): void {
  run("fetch", "--quiet", "--prune");
  const branches = goneIn(
    output(
      "for-each-ref",
      "--format=%(refname:short)%09%(upstream:track)%09%(worktreepath)",
      "refs/heads",
    ),
  );
  if (branches.some(({ branch }) => branch === output("branch", "--show-current"))) {
    run("switch", "--quiet", "main");
    run("pull", "--quiet", "--prune");
  }
  const top = output("rev-parse", "--show-toplevel");
  for (const { branch, worktree } of branches) {
    if (worktree && worktree !== top) {
      try {
        run("worktree", "remove", worktree);
      } catch {
        console.log(`Kept ${branch}, with its worktree at ${worktree}.`);
        continue;
      }
    }
    run("branch", "--delete", "--force", branch);
  }
  if (!branches.length) console.log("No merged branches to delete.");
}
