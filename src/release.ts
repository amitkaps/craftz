/** @prose
 * # Release
 *
 * Opens the pull request that releases a package, like `pnpm release sitez 0.5.0`. Once CI passes
 * it merges, and the package's release workflow does the rest.
 *
 * It works on GitHub, like [align.ts](align.ts), so it needs `gh` logged in and no checkout of the
 * package. It sets `version` in `package.json` on a branch named `release-X.Y.Z`, then opens a
 * pull request titled `vX.Y.Z`, labelled `internal`, and turns on auto-merge.
 *
 * The pull request's description is the release's summary, which goes above the generated notes.
 * `--notes "…"` gives it, and without that the editor opens for it. Left empty, the release has
 * only the generated notes.
 *
 * The pull request is opened with your login, not by a workflow, since GitHub doesn't run CI on
 * a pull request that a workflow's token opens, and `ci` is required.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OWNER } from "./reference.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--notes");
const given = at === -1 ? undefined : args.splice(at, 2)[1];
const [repo, version] = args;

if (!repo || !version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: pnpm release <repo> <X.Y.Z> [--notes "…"]');
  process.exit(1);
}

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

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
if (pkg.private) fail(`${repo} is private, so it isn't released`);
if (pkg.version === version) fail(`${repo} is already at ${version}`);
if (exists(`${api}/git/ref/tags/${tag}`)) fail(`${repo} already has ${tag}`);

// Only the `version` line changes, so the file keeps its formatting.
const bumped = text.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);

function editor(): string {
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
