/** @prose
 * # The browser result on main
 *
 * `craftz status` and `craftz gone` say how the latest `browser` run on `main` ended, so a red one is
 * in front of whoever starts the next change. The workflow runs after a merge, where no pull
 * request shows its result, and a result nobody reads is no check at all.
 *
 * There are four states. The run passed, it failed, it was cancelled, or it is still running or
 * hasn't started. A cancelled run is the one least like a pass, since it says nothing about its
 * commit, so the line says how to run it again. While a run is going, the line also says if the
 * run before it didn't pass, so a newer run never hides a red `main`.
 *
 * A failed or cancelled run is to be fixed before the next change, or the reason it isn't written
 * down. That is [the rule](../docs/rules.md#ci), and the line repeats it where it is read.
 *
 * A repository without the workflow, or without `gh`, says nothing. Any other error is said in a
 * line of its own and never fails the command, since a result that can't be read isn't a pass.
 */
import { type Where, api, repoIn } from "./github.ts";

/** The workflow file a repository's browser checks run from. */
export const BROWSER_WORKFLOW = "browser.yml";

/** How many of the latest runs on `main` are read, enough to find the last one that finished. */
const RUNS = 5;

/** A workflow run, as REST gives it. */
export type Run = { status: string; conclusion: string | null; head_sha: string };

/** What to say of an error from `gh`, or `undefined` when it is an expected one. A repository
 *  with no `browser` workflow answers `HTTP 404`, and a machine without `gh` fails with `ENOENT`. */
export const unread = (message: string): string | undefined =>
  /HTTP 404|ENOENT/.test(message) ? undefined : `browser checks weren't read on main. ${message}`;

const done = (run: Run): boolean => run.status === "completed";
// Anything but a pass or a cancel reads as failed, so a `skipped` or `startup_failure` run, which
// never ran the browser checks, raises the same alarm as a red one.
const ended = (run: Run): string =>
  run.conclusion === "success"
    ? "passed"
    : run.conclusion === "cancelled"
      ? "was cancelled"
      : "failed";

/** The sentence for the runs on `main`, newest first. */
export function browserWords(runs: Run[]): string {
  const [latest, ...older] = runs;
  if (!latest) return "browser checks haven't run on main yet";
  if (!done(latest)) {
    const before = older.find(done);
    const red =
      before && before.conclusion !== "success" ? `, and the run before it ${ended(before)}` : "";
    return `browser checks are still running on main${red}`;
  }
  const at = latest.head_sha.slice(0, 7);
  if (latest.conclusion === "success") return `browser checks passed on main at ${at}`;
  if (latest.conclusion === "cancelled") {
    return `browser checks were cancelled on main at ${at}, so that commit has no result. Run it with gh workflow run ${BROWSER_WORKFLOW}`;
  }
  return `browser checks failed on main at ${at}. Fix them before the next change, or write down why not`;
}

/** How the latest `browser` run on `main` ended, in a sentence. It is `undefined` when the repository
 *  has no `browser` workflow, no GitHub origin or no `gh`. Any other error is said, since a result
 *  that can't be read isn't a pass. */
export function browserOnMain(where: Where = {}): string | undefined {
  let repo = where.repo;
  try {
    repo ??= repoIn(where.cwd);
  } catch {
    // A folder with no origin has no repository on GitHub to ask.
    return undefined;
  }
  try {
    const { workflow_runs } = api<{ workflow_runs: Run[] }>(
      "GET",
      `repos/{repo}/actions/workflows/${BROWSER_WORKFLOW}/runs?branch=main&per_page=${RUNS}`,
      undefined,
      { ...where, repo },
    );
    return browserWords(workflow_runs);
  } catch (error) {
    return unread((error as Error).message);
  }
}
