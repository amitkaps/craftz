/** @prose
 * # A pull request
 *
 * `craftz pr "<title>"` takes what's in the working tree to a pull request that merges itself
 * once CI passes, which is how every change reaches `main`. A repository runs it as `pnpm pr`, so
 * a person and an agent take the same steps everywhere, from the version the repository installs.
 *
 * On `main`, it starts a branch named after the title. It commits what's changed, with the title
 * as the message, writes the outline, runs `verify`, pushes, opens the pull request and turns on
 * auto-merge. `verify` checks and doesn't write, so the outline is written here, for the agent
 * working on the branch.
 * ([Where it starts](#where-it-starts) says what it does on another branch.)
 *
 * A package's pull request takes one label, `--label <label>`, from the ones its
 * `.github/notes.yml` groups the notes by. Without one it stops before anything is committed,
 * as CI would stop after. A site or a tool has no release notes, so it takes none.
 *
 * It first deletes the other local branches that merged, as `craftz gone` does ([gone.ts](gone.ts)).
 *
 * `--body <text>` is the description. `--wait` waits for the merge, then switches to `main`,
 * pulls, and deletes the branch. Without it, `pr` returns once the pull request is open, so the
 * next change can start while CI runs. A session's last change takes `--wait`, to end on `main`.
 * It stops before pushing a branch that has nothing new for `main`, as
 * [Nothing new](#nothing-new) says.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { gone, step, writeOutline } from "./gone.ts";
import { capture } from "./reference.ts";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const output = (command: string, ...args: string[]): string => capture(command, args).trim();

/** The labels CI accepts, read from the notes config the way the label workflow reads them. */
export const labelsIn = (notes: string): string[] =>
  [...notes.matchAll(/labels: \[(\w+)\]|^ +- (\w+)$/gm)].map((m) => m[1] ?? m[2] ?? "");

/** The branch a title starts on `main`. */
export const branchOf = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/, "");

/** @prose
 * # Where it starts
 *
 * The title says which pull request a change is for, so on a branch other than `main`, the
 * branch's pull request decides.
 *
 * - **Open, with the same title:** the change goes into it.
 * - **Open, with another title:** it waits for that pull request to merge, then starts as on a
 *   merged one. Adding the change would merge it under that title. So the next change waits only
 *   when it's ready before the last one merged, and a failed check stops it, with the change kept.
 * - **Merged:** it starts a new branch from `origin/main`, carrying the working tree, so the
 *   merged commits stay behind. A squash merge leaves them looking unmerged, and a new pull
 *   request would carry them again. It stops if the branch has commits made after the merge.
 * - **Closed without merging:** it stops.
 * - **None:** the branch was made by hand, and the change goes on it.
 *
 * Before it starts a branch, or waits for another pull request, it looks for an open pull request
 * with the same title, and the change goes into that one, on its branch. So a change for
 * `craftz release`'s pull request, like markz's CDN link, goes in from `main` with the release's
 * title, `vX.Y.Z`.
 */
export type BranchPr = { number: number; title: string; state: string };
export type Start = { from: "here" | "main" | "origin" | "merge" } | { stop: string };

export function startOn(branch: string, title: string, pr?: BranchPr): Start {
  if (branch === "main") return { from: "main" };
  if (!pr) return { from: "here" };
  const it = `${branch} is #${pr.number}, "${pr.title}"`;
  if (pr.state === "MERGED") return { from: "origin" };
  if (pr.state === "CLOSED") return { stop: `${it}, closed without merging. Switch to main.` };
  if (pr.title === title) return { from: "here" };
  return { from: "merge" };
}

export type OpenPr = { title: string; headRefName: string };

/** The open pull request with exactly this title, of those GitHub's search found. */
export const titled = (prs: OpenPr[], title: string): OpenPr | undefined =>
  prs.find((it) => it.title === title);

/** The arguments with each value joined to its option, as `--body=<text>`, so a body can open with a dash. */
export function joined(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    const value = args[i + 1];
    if (/^--(?:label|body)$/.test(arg) && value !== undefined) {
      out.push(`${arg}=${value}`);
      i++;
    } else out.push(arg);
  }
  return out;
}

/** Opens the pull request for what's in the working tree, and waits for it with `--wait`. */
export async function pr(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: joined(args),
    allowPositionals: true,
    options: {
      label: { type: "string" },
      body: { type: "string", default: "" },
      wait: { type: "boolean", default: false },
    },
  });
  const title = positionals[0];
  if (!title || positionals.length > 1) {
    fail('Give a title: craftz pr "<title>" [--label <label>] [--body <text>] [--wait]');
  }

  const NOTES = ".github/notes.yml";
  const known = existsSync(NOTES) ? labelsIn(readFileSync(NOTES, "utf8")) : [];
  const label = values.label;
  if (known.length && !label) fail(`Label this pull request with one of ${known.join(", ")}.`);
  if (label && !known.includes(label)) {
    fail(
      known.length ? `${label} isn't one of ${known.join(", ")}.` : "Only a package takes a label.",
    );
  }

  // The branches that merged go first, apart from this one, which the steps below decide on.
  gone({ others: true });
  let branch = output("git", "branch", "--show-current");
  let found: (BranchPr & { headRefOid: string; url: string }) | undefined;
  if (branch !== "main") {
    try {
      found = JSON.parse(
        output("gh", "pr", "view", branch, "--json", "number,title,state,headRefOid,url"),
      ) as BranchPr & { headRefOid: string; url: string };
    } catch {
      // A branch with no pull request, or no `gh`, starts as a new one.
    }
  }
  let start = startOn(branch, title, found);
  if ("stop" in start) fail(start.stop);
  if (start.from !== "here") {
    const search = ["--state", "open", "--search", `"${title}" in:title`];
    const into = titled(
      JSON.parse(output("gh", "pr", "list", ...search, "--json", "title,headRefName")) as OpenPr[],
      title,
    );
    if (into) {
      branch = into.headRefName;
      console.log(`"${title}" is open, so the change goes into ${branch}.`);
      step("git", "fetch", "--quiet", "origin", branch);
      let local = true;
      try {
        output("git", "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`);
      } catch {
        local = false;
      }
      if (local) {
        step("git", "switch", "--quiet", branch);
        step("git", "merge", "--quiet", "--ff-only", `origin/${branch}`);
      } else step("git", "switch", "--quiet", "--track", `origin/${branch}`);
      start = { from: "here" };
    }
  }
  if (start.from === "merge" && found) {
    console.log(`Waiting for #${found.number}, "${found.title}", to merge first.`);
    const timing = await landed(branch, found.url);
    console.log(
      `#${found.number} merged${timing && `, ${timing},`} so "${title}" starts from main.`,
    );
    start = { from: "origin" };
  }
  if (start.from === "origin" && found) {
    let after = "0";
    try {
      after = output("git", "rev-list", "--count", `${found.headRefOid}..HEAD`);
    } catch {
      // A merged head git no longer has counts as nothing added after it.
    }
    if (after !== "0") fail(`${branch} has commits made after #${found.number} merged.`);
    step("git", "fetch", "--quiet", "origin", "main");
  }
  if (start.from !== "here") {
    branch = branchOf(title);
    const base = start.from === "origin" ? ["origin/main"] : [];
    step("git", "switch", "--create", branch, ...base);
  }

  if (output("git", "status", "--porcelain")) {
    step("git", "add", "--all");
    step("git", "commit", "--quiet", "--message", title);
  }
  step("git", "fetch", "--quiet", "origin", "main");
  if (!newOnMain()) fail(`${branch} has nothing that isn't on main.`);

  writeOutline();
  const verifying = Date.now();
  step("pnpm", "run", "verify");
  const verified = took(Date.now() - verifying);
  step("git", "push", "--quiet", "--set-upstream", "origin", branch);

  const open = (): string => {
    try {
      return output(
        "gh",
        "pr",
        "view",
        branch,
        "--json",
        "state,url",
        "--jq",
        'select(.state == "OPEN") | .url',
      );
    } catch {
      return "";
    }
  };
  let url = open();
  if (!url) {
    const labels = label ? ["--label", label] : [];
    url = output("gh", "pr", "create", "--title", title, "--body", values.body, ...labels);
  }
  step("gh", "pr", "merge", branch, "--auto", "--squash");
  console.log(`${url}, after verify took ${verified}`);
  if (values.wait) await merged(branch, url);
}

/** @prose
 * # Nothing new
 *
 * A branch has something new when merging it onto `main` changes `main`. Counting its commits
 * ahead of `main` isn't enough, since a squash merge leaves them looking unmerged, and a second
 * run would push them again, into a pull request with nothing to merge. A merge that conflicts
 * has something new.
 */
function newOnMain(): boolean {
  let merged: string;
  try {
    merged =
      output("git", "merge-tree", "--write-tree", "origin/main", "HEAD").split("\n")[0] ?? "";
  } catch {
    return true;
  }
  return merged !== output("git", "rev-parse", "origin/main^{tree}");
}

// The worktree other than this one that has `main` checked out, if there is one.
function mainElsewhere(): string | undefined {
  const here = output("git", "rev-parse", "--show-toplevel");
  const trees = output("git", "worktree", "list", "--porcelain").split("\n\n");
  const main = trees.find((tree) => tree.split("\n").includes("branch refs/heads/main"));
  const path = main?.match(/^worktree (.*)$/m)?.[1];
  return path && path !== here ? path : undefined;
}

/** @prose
 * # Waiting for the merge
 *
 * `--wait` waits this way for the merge, and so does a new title on a branch whose pull request is
 * open.
 *
 * It asks GitHub every ten seconds, and stops at the first check that fails, with the pull request
 * left open to fix and run again. A check counts by its latest run, since adding a label starts
 * a new run that cancels the old one.
 *
 * A pull request that falls behind `main`, because another merged first, has its branch updated,
 * so CI runs again on what it would merge, and it says so, since that's why the wait is longer.
 * `main` requires a branch that's up to date, and auto-merge doesn't update one.
 *
 * A pull request whose checks passed on an up-to-date branch is merged by the wait itself. GitHub's
 * auto-merge took up to twelve minutes after the checks passed, and the rules still decide what
 * merges, so merging it here loosens nothing. Auto-merge stays on for a pull request nobody waits for.
 *
 * Once it merges, it says how long CI took, how many times it ran, and how long the merge came
 * after it passed. That last can be minutes, since GitHub's auto-merge is sometimes slow to act.
 *
 * Then `--wait` switches to `main` and pulls. In a worktree, `main` is checked out in
 * another, so it switches to `origin/main` instead, detached, and the branch goes either way.
 * Last, it writes `outline.md` from what it's on, as `gone` does ([the outline](gone.ts#the-outline)).
 */
/** A check on a pull request's head commit, as `gh pr view` lists it. */
export type Check = {
  name?: string;
  conclusion?: string;
  startedAt?: string;
  completedAt?: string;
};
/** What the wait reads of a pull request. */
export type State = {
  state: string;
  mergeStateStatus: string;
  mergedAt?: string;
  statusCheckRollup: Check[];
};
const FAILED = ["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"];

/** How long a span of time took, in seconds, minutes and seconds, or hours and minutes. */
export function took(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m`;
}

/** What a merge took: the `ci` check's last run, the runs a fall behind added, and the wait after. */
export function timingOf(pr: State, updates = 0): string {
  const runs = pr.statusCheckRollup.filter((check) => check.name === "ci");
  const last = runs.reduce<Check | undefined>(
    (a, b) => ((b.startedAt ?? "") >= (a?.startedAt ?? "") ? b : a),
    undefined,
  );
  const at = (time?: string) => (time ? Date.parse(time) : NaN);
  const ci = at(last?.completedAt) - at(last?.startedAt);
  const passed = Math.max(...pr.statusCheckRollup.map((check) => at(check.completedAt) || 0));
  const after = at(pr.mergedAt) - passed;
  return [
    Number.isNaN(ci) ? "" : `CI took ${took(ci)}`,
    updates ? `ran ${updates + 1} times` : "",
    Number.isNaN(after) || after < 0 ? "" : `merged ${took(after)} after it passed`,
  ]
    .filter(Boolean)
    .join(", ");
}

async function landed(branch: string, url: string): Promise<string> {
  let updates = 0;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const pr = JSON.parse(
      output(
        "gh",
        "pr",
        "view",
        branch,
        "--json",
        "state,mergeStateStatus,mergedAt,statusCheckRollup",
      ),
    ) as State;
    if (pr.state === "MERGED") return timingOf(pr, updates);
    if (pr.state === "CLOSED") fail(`${url} was closed without merging.`);
    if (pr.mergeStateStatus === "BEHIND") {
      try {
        output("gh", "pr", "update-branch", branch);
        updates++;
        console.log(`${url} fell behind main, so its branch is updated and CI runs again.`);
      } catch {
        // A pull request that's merging reads as behind its own merge for a moment, and then
        // there's nothing to update, so a failed update only means asking again.
      }
      continue;
    }
    if (pr.mergeStateStatus === "CLEAN") {
      // Auto-merge can wait minutes after the checks pass.
      try {
        output("gh", "pr", "merge", branch, "--squash");
      } catch {
        // A merge that lost a race only means asking again.
      }
      continue;
    }
    const latest = new Map<string, Check>();
    for (const check of pr.statusCheckRollup) {
      const seen = latest.get(check.name ?? "");
      if ((check.startedAt ?? "") >= (seen?.startedAt ?? "")) latest.set(check.name ?? "", check);
    }
    const failed = [...latest.values()].find((check) => FAILED.includes(check.conclusion ?? ""));
    if (failed) fail(`${failed.name ?? "A check"} failed on ${url}.`);
  }
}

async function merged(branch: string, url: string): Promise<void> {
  const timing = await landed(branch, url);
  console.log(timing ? `Merged, ${timing}.` : "Merged.");
  const elsewhere = mainElsewhere();
  if (elsewhere) {
    step("git", "fetch", "--quiet", "--prune", "origin", "main");
    step("git", "switch", "--quiet", "--detach", "origin/main");
  } else {
    step("git", "switch", "--quiet", "main");
    step("git", "pull", "--quiet", "--prune");
  }
  step("git", "branch", "--quiet", "--delete", "--force", branch);
  writeOutline();
  console.log(
    elsewhere
      ? `Merged, and on origin/main, since main is in ${elsewhere}.`
      : "Merged, and on main.",
  );
}
