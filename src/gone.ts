/** @prose
 * # Merged branches
 *
 * `craftz gone` deletes each local branch that merged. A repository runs it as `pnpm gone`, and
 * it works where no git alias is set, like an agent's machine. `craftz pr` runs it first, so the
 * branches go without anyone remembering to.
 *
 * A branch merged when any of these holds:
 *
 * - **Its branch on GitHub is gone.** GitHub deletes a branch once its pull request merges.
 * - **Its last commit is a merged pull request's last commit.** That catches a branch GitHub kept,
 *   and one that never tracked GitHub's, like `gh pr checkout`'s or one fetched by hand.
 * - **Its last commit is on `main`.** It has nothing `main` lacks.
 *
 * The last two compare commits, so a branch with a commit made after its merge is kept. The
 * merged pull requests come from `gh`, and without it only the other two count.
 *
 * A squash merge puts a new commit on `main`, so git can't tell the branch merged, and it's
 * deleted with `--force`. When the branch you're on is one of them, it switches to `main` and
 * pulls first. `pr` leaves the branch you're on to its own rules ([pr.ts](pr.ts)).
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

/** The branches in `git for-each-ref`'s tab-separated lines, as branch, upstream track,
 *  worktree and last commit, that merged: their upstream is gone, or `merged` says their last
 *  commit is. `main` never is. */
export const goneIn = (refs: string, merged: (commit: string) => boolean = () => false): Gone[] =>
  refs
    .split("\n")
    .map((line) => line.split("\t"))
    .filter(([branch, track, , commit = ""]) => {
      return branch && branch !== "main" && (track === "[gone]" || merged(commit));
    })
    .map(([branch = "", , worktree]) => (worktree ? { branch, worktree } : { branch }));

// The last commits of the merged pull requests, or none without `gh`.
function mergedHeads(): Set<string> {
  try {
    const heads = execFileSync(
      "gh",
      ["pr", "list", "--state", "merged", "--limit", "1000", "--json", "headRefOid"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return new Set((JSON.parse(heads) as { headRefOid: string }[]).map((pr) => pr.headRefOid));
  } catch {
    return new Set();
  }
}

const onMain = (commit: string): boolean => {
  try {
    output("merge-base", "--is-ancestor", commit, "origin/main");
    return true;
  } catch {
    return false;
  }
};

/** Deletes each local branch that merged. With `others`, the branch you're on stays, and a
 *  run that deletes nothing prints nothing. */
export function gone({ others = false } = {}): void {
  run("fetch", "--quiet", "--prune");
  const heads = mergedHeads();
  const current = output("branch", "--show-current");
  const branches = goneIn(
    output(
      "for-each-ref",
      "--format=%(refname:short)%09%(upstream:track)%09%(worktreepath)%09%(objectname)",
      "refs/heads",
    ),
    (commit) => heads.has(commit) || onMain(commit),
  ).filter(({ branch }) => !(others && branch === current));
  if (branches.some(({ branch }) => branch === current)) {
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
  if (!branches.length && !others) console.log("No merged branches to delete.");
}
