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
 * The branch you're on may have a pull request that's ready but not yet merged, since GitHub's
 * auto-merge can take minutes after the checks pass. So when its checks passed on an up-to-date
 * branch, `gone` merges it first, as `pr`'s wait does ([pr.ts](pr.ts#waiting-for-the-merge)).
 * When they haven't, it says the pull request is still open, so nobody polls GitHub for it. The
 * next `pnpm pr` waits for it.
 *
 * A squash merge puts a new commit on `main`, so git can't tell the branch merged, and it's
 * deleted with `--force`. When the branch you're on is one of them, it switches to `main` and
 * pulls first, and on `main` it pulls too. So `gone` before a change starts it from what's live,
 * and that's when `AGENTS.md` says to run it. A `main` with commits GitHub's lacks is kept as it
 * is. `pr` leaves the branch you're on to its own rules ([pr.ts](pr.ts)).
 *
 * Git won't delete a branch that another worktree has checked out, so that worktree is removed
 * first. One git won't remove, such as one with changes, is kept with its branch, and `gone` goes on.
 *
 * Last, it writes `outline.md` ([the outline](#the-outline)).
 *
 * # Catching up a checkout
 *
 * `pnpm align` merges in fresh clones, so the checkouts beside craftz are left on an old `main`,
 * or on a branch that merged. Once its pull requests merge, `catchUp` brings each one to `main`,
 * pulled, with its merged branches deleted. A checkout with uncommitted changes is kept as it is,
 * as is one on a branch that hasn't merged, or a `main` with commits GitHub's lacks.
 *
 * # The outline
 *
 * `AGENTS.md` imports `outline.md`, which an agent reads when its session starts. The file is
 * ignored by git, and `verify` only checks, so `pnpm outline` writes it, and so does every
 * command that moves a checkout. `pr` writes it before `verify`, and `gone`, `pr --wait` and
 * `catchUp` write it once they're on `main`, with the files that merged.
 * A repository without prose installed has no outline, and is left alone. A failed outline
 * doesn't fail the command, since the branches are already where they should be.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

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

/** Writes `outline.md` in the checkout at `dir` with the prose it installs, if it installs prose. */
export function writeOutline(dir = "."): void {
  const top = outputIn(dir, "rev-parse", "--show-toplevel");
  if (!existsSync(join(top, "node_modules", ".bin", "prose"))) return;
  try {
    execFileSync("pnpm", ["exec", "prose", "outline"], {
      cwd: top,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    console.log("Kept outline.md as it was, since prose outline failed.");
  }
}

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

// Merges the open pull request of `branch` once its checks pass, or says it's still open. Without
// `gh`, or with no pull request, it does nothing.
function mergeReady(branch: string): void {
  const gh = (...args: string[]): string =>
    execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  let pr: { number: number; state: string; mergeStateStatus: string };
  try {
    pr = JSON.parse(
      gh("pr", "view", branch, "--json", "number,state,mergeStateStatus"),
    ) as typeof pr;
  } catch {
    return;
  }
  if (pr.state !== "OPEN") return;
  if (pr.mergeStateStatus === "CLEAN") {
    try {
      gh("pr", "merge", branch, "--squash");
      console.log(`Merged #${pr.number}, whose checks had passed.`);
      return;
    } catch {}
  }
  console.log(`#${pr.number} hasn't merged yet. \`pnpm pr\` with the next title waits for it.`);
}

/** Deletes each local branch that merged, and pulls `main` when it's on it. With `others`, the branch you're on stays, and a
 *  run that deletes nothing prints nothing. */
export function gone({ others = false } = {}): void {
  const current = output("branch", "--show-current");
  if (!others && current !== "main") mergeReady(current);
  const branches = mergedIn(".").filter(({ branch }) => !(others && branch === current));
  if (branches.some(({ branch }) => branch === current)) {
    run("switch", "--quiet", "main");
    run("pull", "--quiet", "--prune");
  } else if (!others && current === "main") {
    try {
      outputIn(".", "pull", "--quiet", "--ff-only", "--prune");
    } catch {
      console.log("Kept main, with commits GitHub's lacks.");
    }
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
  if (!others) writeOutline();
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
  writeOutline(dir);
  const branches = deleted === 1 ? "1 merged branch" : `${deleted} merged branches`;
  return deleted ? `on main, pulled, ${branches} deleted` : "on main, pulled";
}
