/** @prose
 * # Release
 *
 * `craftz release 0.5.0` opens the pull request that releases the package the folder's `origin`
 * names. Once CI passes it merges, and the package's release workflow does the rest. A package
 * runs it as `pnpm craftz release`, like `pr` and `status`.
 *
 * It works on GitHub, not in the folder, so it releases what's on `main`, whatever branch the
 * folder is on and whatever it has changed. It needs `gh` logged in. It sets `version` in
 * `package.json` on a branch named `release-X.Y.Z`, then opens a pull request titled `vX.Y.Z`,
 * labelled `internal`, and turns on auto-merge.
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
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OWNER } from "./reference.ts";
import { origin } from "./survey.ts";

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
  const gh = (...a: string[]): string => execFileSync("gh", a, { encoding: "utf8" });
  const exists = (path: string): boolean => {
    try {
      execFileSync("gh", ["api", path], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  };

  const file = JSON.parse(gh("api", `${api}/contents/package.json`)) as {
    sha: string;
    content: string;
  };
  const text = Buffer.from(file.content, "base64").toString("utf8");
  const pkg = JSON.parse(text) as { private?: boolean; version?: string };

  if (pkg.private) fail(`${repo} is private, so it isn't released`);
  if (pkg.version === version) fail(`${repo} is already at ${version}`);
  if (exists(`${api}/git/ref/tags/${tag}`)) fail(`${repo} already has ${tag}`);

  let plan = "";
  try {
    plan = gh("api", `${api}/contents/docs/plan.md`, "-H", "Accept: application/vnd.github.raw");
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
    const path = join(mkdtempSync(join(tmpdir(), "release-")), `${tag}.md`);
    writeFileSync(path, "");
    const edit = process.env["VISUAL"] ?? process.env["EDITOR"] ?? "vi";
    console.log(`Write ${repo} ${tag}'s summary, or leave it empty, then save and close.`);
    execFileSync("sh", ["-c", `${edit} "$1"`, "sh", path], { stdio: "inherit" });
    return readFileSync(path, "utf8").trim();
  }
  const notes = given ?? editor();

  const main = gh("api", `${api}/git/ref/heads/main`, "--jq", ".object.sha").trim();
  gh(
    "api",
    "--method",
    "POST",
    `${api}/git/refs`,
    "-f",
    `ref=refs/heads/${branch}`,
    "-f",
    `sha=${main}`,
  );
  gh(
    "api",
    "--method",
    "PUT",
    `${api}/contents/package.json`,
    "-f",
    `message=${tag}`,
    "-f",
    `content=${Buffer.from(bumped).toString("base64")}`,
    "-f",
    `sha=${file.sha}`,
    "-f",
    `branch=${branch}`,
  );

  const R = `${OWNER}/${repo}`;
  const url = gh(
    "pr",
    "create",
    "-R",
    R,
    "--base",
    "main",
    "--head",
    branch,
    "--title",
    tag,
    "--label",
    "internal",
    "--body",
    notes,
  ).trim();
  gh("pr", "merge", url, "--auto", "--squash");

  console.log(`✓ ${url}`);
  console.log(
    "  Once it merges, approve the staged version on npmjs.com, or with npm stage approve.",
  );
}
