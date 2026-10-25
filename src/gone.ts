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
 *
 * # Catching up a checkout
 *
 * `pnpm align` merges in fresh clones, so the checkouts beside craftz are left on an old `main`,
 * or on a branch that merged. Once its pull requests merge, `catchUp` brings each one to `main`,
 * pulled, with its merged branches deleted. A checkout with uncommitted changes is kept as it is,
 * as is one on a branch that hasn't merged, or a `main` with commits GitHub's lacks.
 */
import { execFileSync } from "node:child_process";

const run = (...args: string[]): void => {
  execFileSync("git", args, { stdio: "inherit" });
};
const output = (...args: string[]): string => outputIn(".", ...args);
const outputIn = (dir: string, ...args: string[]): string =>
  execFileSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

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
function mergedHeads(dir = "."): Set<string> {
  try {
    const heads = execFileSync(
      "gh",
      ["pr", "list", "--state", "merged", "--limit", "1000", "--json", "headRefOid"],
      { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return new Set((JSON.parse(heads) as { headRefOid: string }[]).map((pr) => pr.headRefOid));
  } catch {
    return new Set();
  }
}

const onMain = (commit: string, dir = "."): boolean => {
  try {
    outputIn(dir, "merge-base", "--is-ancestor", commit, "origin/main");
    return true;
  } catch {
    return false;
  }
};

// The branches in `dir` that merged, after a fetch.
function mergedIn(dir: string): Gone[] {
  outputIn(dir, "fetch", "--quiet", "--prune");
  const heads = mergedHeads(dir);
  return goneIn(
    outputIn(
      dir,
      "for-each-ref",
      "--format=%(refname:short)%09%(upstream:track)%09%(worktreepath)%09%(objectname)",
      "refs/heads",
    ),
    (commit) => heads.has(commit) || onMain(commit, dir),
  );
}

/** Deletes each local branch that merged. With `others`, the branch you're on stays, and a
 *  run that deletes nothing prints nothing. */
export function gone({ others = false } = {}): void {
  const current = output("branch", "--show-current");
  const branches = mergedIn(".").filter(({ branch }) => !(others && branch === current));
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

/** What `catchUp` does with a checkout: why it's kept as it is, or `undefined` to bring it to
 *  `main`. */
export function keptBecause(changes: string, current: string, merged: Gone[]): string | undefined {
  if (changes) return "kept, with uncommitted changes";
  if (current && current !== "main" && !merged.some(({ branch }) => branch === current)) {
    return `kept, on ${current}, which hasn't merged`;
  }
  return undefined;
}

/** Brings the checkout in `dir` to `main`, pulled, with its merged branches deleted, unless
 *  `keptBecause` keeps it. Says what it did, in a few words. */
export function catchUp(dir: string): string {
  const merged = mergedIn(dir);
  const current = outputIn(dir, "branch", "--show-current");
  const kept = keptBecause(outputIn(dir, "status", "--porcelain"), current, merged);
  if (kept) return kept;
  if (current !== "main") outputIn(dir, "switch", "--quiet", "main");
  try {
    outputIn(dir, "pull", "--quiet", "--ff-only", "--prune");
  } catch {
    return "kept, with commits on main that GitHub's lacks";
  }
  const top = outputIn(dir, "rev-parse", "--show-toplevel");
  let deleted = 0;
  for (const { branch, worktree } of merged) {
    try {
      if (worktree && worktree !== top) outputIn(dir, "worktree", "remove", worktree);
      outputIn(dir, "branch", "--delete", "--force", branch);
      deleted++;
    } catch {
      // A worktree with changes keeps its branch, as `gone` keeps it.
    }
  }
  const branches = deleted === 1 ? "1 merged branch" : `${deleted} merged branches`;
  return deleted ? `on main, pulled, ${branches} deleted` : "on main, pulled";
}
