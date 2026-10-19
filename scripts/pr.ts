/** @prose
 * # A pull request
 *
 * `pnpm pr "<title>"` takes what's in the working tree to a pull request that merges itself once
 * CI passes, which is how every change reaches `main`. It's the same file in every repository,
 * copied from [craftz](https://craftz.amitkaps.com/docs/rules.md#scripts), so a person and an
 * agent take the same steps everywhere.
 *
 * On `main`, it starts a branch named after the title. It commits what's changed, with the title
 * as the message, runs `verify`, pushes, opens the pull request and turns on auto-merge. A branch
 * whose pull request is open already gets the push, and the pull request keeps its title.
 *
 * A package's pull request takes one label, `--label <label>`, from the ones its
 * `.github/release.yml` groups the notes by. Without one it stops before anything is committed,
 * as CI would stop after. A site or a tool has no release notes, so it takes none.
 *
 * `--body <text>` is the description. `--wait` waits for the merge, then switches to `main`,
 * pulls, and deletes the branch.
 */
// Node's types, for a repository whose tsconfig.json doesn't include scripts/.
/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    label: { type: "string" },
    body: { type: "string", default: "" },
    wait: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const run = (command: string, ...args: string[]): void => {
  execFileSync(command, args, { stdio: "inherit" });
};
const output = (command: string, ...args: string[]): string =>
  execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const title = positionals[0];
if (!title) fail('Give a title: pnpm pr "<title>" [--label <label>] [--body <text>] [--wait]');

// The labels CI accepts, read from the notes config the way its Label step reads them.
const NOTES = ".github/release.yml";
const known = existsSync(NOTES)
  ? [...readFileSync(NOTES, "utf8").matchAll(/labels: \[(\w+)\]|^ +- (\w+)$/gm)].map(
      (m) => m[1] ?? m[2] ?? "",
    )
  : [];
const label = values.label;
if (known.length && !label) fail(`Label this pull request with one of ${known.join(", ")}.`);
if (label && !known.includes(label)) {
  fail(
    known.length ? `${label} isn't one of ${known.join(", ")}.` : "Only a package takes a label.",
  );
}

let branch = output("git", "branch", "--show-current");
if (branch === "main") {
  branch = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/, "");
  run("git", "switch", "--create", branch);
}

if (output("git", "status", "--porcelain")) {
  run("git", "add", "--all");
  run("git", "commit", "--quiet", "--message", title);
}
run("git", "fetch", "--quiet", "origin", "main");
if (output("git", "rev-list", "--count", "origin/main..HEAD") === "0") {
  fail(`${branch} has nothing that isn't on main.`);
}

run("pnpm", "run", "verify");
run("git", "push", "--quiet", "--set-upstream", "origin", branch);

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
run("gh", "pr", "merge", branch, "--auto", "--squash");
console.log(url);

/** @prose
 * # Waiting for the merge
 *
 * Asks GitHub every ten seconds, and stops at the first check that fails, with the pull request
 * left open to fix and run again. A check counts by its latest run, since adding a label starts
 * a new run that cancels the old one.
 *
 * A pull request that falls behind `main`, because another merged first, has its branch updated,
 * so CI runs again on what it would merge. `main` requires a branch that's up to date, and
 * auto-merge doesn't update one.
 */
type Check = { name?: string; conclusion?: string; startedAt?: string };
type State = { state: string; mergeStateStatus: string; statusCheckRollup: Check[] };
const FAILED = ["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"];

if (values.wait) {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const pr = JSON.parse(
      output("gh", "pr", "view", branch, "--json", "state,mergeStateStatus,statusCheckRollup"),
    ) as State;
    if (pr.state === "MERGED") break;
    if (pr.state === "CLOSED") fail(`${url} was closed without merging.`);
    if (pr.mergeStateStatus === "BEHIND") {
      // A pull request that's merging reads as behind its own merge for a moment, and then there's
      // nothing to update, so a failed update only means asking again.
      try {
        run("gh", "pr", "update-branch", branch);
      } catch {}
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
  run("git", "switch", "--quiet", "main");
  run("git", "pull", "--quiet", "--prune");
  run("git", "branch", "--quiet", "--delete", "--force", branch);
  console.log("Merged, and on main.");
}
