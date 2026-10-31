/** @prose
 * # Release
 *
 * `craftz release 0.5.0` opens the pull request that releases the package the folder's `origin`
 * names. Once CI passes it merges, and the package's release workflow does the rest. A package
 * runs it as `pnpm craftz release`, like `pr` and `status`.
 *
 * It releases what's on `main`, whatever branch the folder is on and whatever it has changed. It
 * builds a commit on `origin/main` with git's plumbing, so the folder's branch, index and files
 * stay as they are, and pushes it as `release-X.Y.Z`. It needs `gh` logged in and a folder that
 * can push. That is the same in a laptop's checkout and a Claude Code cloud session, whose proxy
 * refuses the API calls that would make the branch. The commit sets `version` in `package.json`.
 * Then it opens a pull request titled `vX.Y.Z`, labelled `internal`, and turns on auto-merge.
 *
 * The pull request's description is the release's summary, which goes above the generated notes.
 * `--notes "…"` gives it, and without that the editor opens for it. Left empty, the release has
 * only the generated notes. Without a terminal, as under an agent, the editor would wait unseen,
 * so it stops and asks for `--notes`, before anything changes on GitHub.
 *
 * It reads `docs/plan.md` on `main` first, and stops unless the plan's summary names the version
 * and no step in it is ticked. A step is ticked as it merges, and its ticked steps move into
 * "Where it is" before a release ([docs-plan](../docs/rules.md#docs-plan)). So a plan that's
 * ready has nothing ticked, and it names the release. Updating the plan after a release was a
 * step nobody took, so it comes before.
 *
 * The pull request is opened with your login, not by a workflow, since GitHub doesn't run CI on
 * a pull request that a workflow's token opens, and `ci` is required.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { api, autoMerge, createPull } from "./github.ts";
import { OWNER, onMain } from "./reference.ts";
import { origin } from "./survey.ts";
import { temporary } from "./temp.ts";

/** Why the plan isn't ready for this version, or undefined when it is. */
export function unready(plan: string, version: string): string | undefined {
  const body = plan.replace(/^---\n[\s\S]*?\n---\n/, "");
  const summary = body
    .split(/\n\s*\n/)
    .map((it) => it.trim())
    .find((it) => it && !it.startsWith("#"));
  if (!summary?.includes(version)) return `its summary doesn't name ${version}`;
  if (/^\s*- \[x\]/im.test(body)) return "it has a ticked step, which belongs in Where it is";
  return undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** The author of the release commit: the folder's own git identity, or else the login's. */
function author(): NodeJS.ProcessEnv {
  const set = (key: string): boolean => {
    try {
      return !!execFileSync("git", ["config", key], { encoding: "utf8" }).trim();
    } catch {
      return false;
    }
  };
  if (set("user.name") && set("user.email")) return {};
  const { login, id } = api<{ login: string; id: number }>("GET", "user");
  const email = `${id}+${login}@users.noreply.github.com`;
  return {
    GIT_AUTHOR_NAME: login,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: login,
    GIT_COMMITTER_EMAIL: email,
  };
}

/** Opens the pull request that releases the folder's package at a version. */
export function release(dir: string, args: string[]): void {
  const at = args.indexOf("--notes");
  const given = at === -1 ? undefined : args.splice(at, 2)[1];
  const [version, ...extra] = args;

  if (!version || extra.length || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    fail('Give a version: craftz release <X.Y.Z> [--notes "…"]');
  }
  const repo = origin(dir);
  if (!repo) fail(`craftz release: ${dir} has no origin on GitHub under ${OWNER}.`);

  const api = `repos/${OWNER}/${repo}`;
  const tag = `v${version}`;
  const branch = `release-${version}`;
  const exists = (path: string): boolean => {
    try {
      execFileSync("gh", ["api", path], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  };

  const file = onMain(repo, "package.json");
  const text = file.text;
  const pkg = JSON.parse(text) as { private?: boolean; version?: string };

  if (pkg.private) fail(`${repo} is private, so it isn't released`);
  if (pkg.version === version) fail(`${repo} is already at ${version}`);
  if (exists(`${api}/git/ref/tags/${tag}`)) fail(`${repo} already has ${tag}`);

  let plan = "";
  try {
    plan = onMain(repo, "docs/plan.md").text;
  } catch {
    fail(`${repo} has no docs/plan.md on main.`);
  }
  const why = unready(plan, version);
  if (why) {
    fail(
      `${repo}'s plan isn't ready for ${version}: ${why}.\n` +
        `Bring docs/plan.md up to date with pnpm pr, then release once it merges.`,
    );
  }

  // Only the `version` line changes, so the file keeps its formatting.
  const bumped = text.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);

  function editor(): string {
    if (!process.stdin.isTTY)
      fail(`There's no terminal for an editor, so give the summary: --notes "…"`);
    const path = join(temporary("release-"), `${tag}.md`);
    writeFileSync(path, "");
    const edit = process.env["VISUAL"] ?? process.env["EDITOR"] ?? "vi";
    console.log(`Write ${repo} ${tag}'s summary, or leave it empty, then save and close.`);
    execFileSync("sh", ["-c", `${edit} "$1"`, "sh", path], { stdio: "inherit" });
    return readFileSync(path, "utf8").trim();
  }
  const notes = given ?? editor();

  const git = (args: string[], env: NodeJS.ProcessEnv = {}, input?: string): string => {
    try {
      return execFileSync("git", ["-c", "commit.gpgsign=false", ...args], {
        cwd: top,
        encoding: "utf8",
        env: { ...process.env, ...env },
        input,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch (error) {
      const said = String((error as { stderr?: unknown }).stderr ?? error).trim();
      return fail(`git ${args[0]}: ${said.split("\n")[0]}`);
    }
  };
  // The paths below are from the repository's root, wherever the folder is inside it.
  const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: dir,
    encoding: "utf8",
  }).trim();
  git(["fetch", "--quiet", "origin", "main"]);
  const [mode, , blob] = git(["ls-tree", "origin/main", "package.json"]).split(/\s+/);
  if (blob !== file.sha)
    fail(`${repo}'s package.json changed on main while this ran. Run it again.`);

  // A commit built apart from the folder's index, so what the folder has changed stays as it is.
  const apart = { GIT_INDEX_FILE: join(temporary("release-"), "index") };
  const bumpedBlob = git(["hash-object", "-w", "--stdin"], {}, bumped);
  git(["read-tree", "origin/main"], apart);
  git(["update-index", "--cacheinfo", `${mode},${bumpedBlob},package.json`], apart);
  const commit = git(
    ["commit-tree", git(["write-tree"], apart), "-p", "origin/main", "-m", tag],
    author(),
  );
  git(["push", "--quiet", "origin", `${commit}:refs/heads/${branch}`]);

  const where = { cwd: dir, repo: `${OWNER}/${repo}` };
  let made;
  try {
    made = createPull(branch, tag, notes, "internal", where);
    autoMerge(made.number, where);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  console.log(`✓ ${made.url}`);
  console.log(
    "  Once it merges, approve the staged version on npmjs.com, or with npm stage approve.",
  );
}
