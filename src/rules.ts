/** @prose
 * # The rules
 *
 * Each rule in [the rules](../docs/rules.md) that has an id, like `scripts-verify`. The doc
 * states it, as a list item that opens with its id, and says why. Here is only what the words
 * can't do: the check that finds where a repository has drifted from it, and the fix, where one
 * can be automated.
 *
 * It's how markz's grammar names its side rules, and [rules.test.ts](../tests/rules.test.ts)
 * holds the two to the same ids, so a rule can't be stated without a check, or checked without
 * being stated.
 *
 * A check returns `undefined` when its rule doesn't apply, like `scripts-preview` for a package. A
 * fix in `files` edits a clone to match [the reference](../reference/), and `pnpm align` puts it in
 * the repository's pull request. It changes nothing in a clone already in line, so it's safe to run
 * on every one. A fix in `github` is written directly, since there's no file to review. A rule with
 * no fix is fixed by hand, as the rules say.
 *
 * The table is split by the part of the rules each id starts with, one module for each in
 * [rules/](rules/), and this module joins them in the doc's order. What more than one of them
 * writes with is in [rules/shared.ts](rules/shared.ts).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { type Pkg, readPkg } from "./reference.ts";
import {} from "./config.ts";
import {} from "./edit.ts";
import {} from "./ruled.ts";
import {} from "./settings.ts";
import {} from "./pinned.ts";
import {} from "./stated.ts";
import { AGENTS_RULES } from "./rules/agents.ts";
import { CLOUDFLARE_RULES } from "./rules/cloudflare.ts";
import { DOCS_RULES } from "./rules/docs.ts";
import { GITHUB_RULES } from "./rules/github.ts";
import { RELEASES_RULES } from "./rules/releases.ts";
import { SCRIPT_RULES } from "./rules/scripts.ts";
import { TOOLCHAIN_RULES } from "./rules/toolchain.ts";
import { VERSION_RULES } from "./rules/versions.ts";
import type { Finding, Repo } from "./survey.ts";
import {} from "./worker.ts";
import {} from "./rules/shared.ts";

export { type Shape, listed, shipping } from "./rules/docs.ts";
export { betas } from "./rules/versions.ts";

export type Fix =
  | { in: "files"; apply: (dir: string, std: string) => void }
  | { in: "github"; apply: (repo: string, pkg: Pkg) => void };

/** @prose
 * # A rule
 *
 * A rule a tool can keep a repository from, like a tool's version or the deploy, is `holdable`.
 * A repository can hold only those, as the rules' [Holds](../docs/rules.md#holds) say.
 */
export type Rule = {
  id: string;
  check: (repo: Repo) => Finding | undefined;
  fix?: Fix;
  holdable?: boolean;
};

export const RULES: Rule[] = [
  ...VERSION_RULES,
  ...TOOLCHAIN_RULES,
  ...SCRIPT_RULES,
  ...CLOUDFLARE_RULES,
  ...GITHUB_RULES,
  ...AGENTS_RULES,
  ...DOCS_RULES,
  ...RELEASES_RULES,
];

// What's built or installed isn't the repository's, so the fixes never write there.
const SKIP = new Set([".git", "node_modules", "dist"]);

function snapshot(dir: string, top = dir, found = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) snapshot(path, top, found);
    } else if (entry.isFile()) found.set(relative(top, path), readFileSync(path, "utf8"));
  }
  return found;
}

/** @prose
 * # Fixing the files
 *
 * Every fix in the files is applied, but the held ones, for `craftz fix`, `pnpm align` and `pnpm
 * new`. Each fix writes what the rules want, whatever was there, so a second run changes nothing.
 *
 * It answers the files it changed, added or removed, sorted, from the folder as it was before and
 * after. That's what changed, whichever fix did it, and it's empty when nothing did.
 */
export function fixFiles(dir: string, std: string): string[] {
  const before = snapshot(dir);
  const held = readPkg(dir).craftz?.hold ?? {};
  for (const rule of RULES)
    if (rule.fix?.in === "files" && !held[rule.id]) rule.fix.apply(dir, std);
  const after = snapshot(dir);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((file) => before.get(file) !== after.get(file))
    .toSorted();
}
