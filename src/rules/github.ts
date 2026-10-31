/** @prose
 * # The GitHub rules
 *
 * The rules under [GitHub](../../docs/rules.md#github): the `main` ruleset a repository has, and
 * the CI workflow it runs. The ruleset is read from GitHub, so `pnpm align` writes it directly.
 */
import { type Pkg } from "../reference.ts";
import { rulesetFor, writeRuleset } from "../settings.ts";
import type { Rule } from "../rules.ts";
import type { BranchRule } from "../survey.ts";
import { CI, drifted, owns, unread } from "./shared.ts";

// Each rule in the file has to be there, with the parameters the file sets. Other parameters,
// and rules the file doesn't name, are the repository's own.
function rulesDrift(found: BranchRule[], pkg: Pkg): string[] {
  if (!found.length) return ["main has no branch rules"];
  const drift: string[] = [];
  for (const want of rulesetFor(pkg).rules) {
    const name = want.type.replaceAll("_", " ");
    const have = found.find((rule) => rule.type === want.type);
    if (!have) {
      drift.push(`no ${name} rule`);
      continue;
    }
    for (const [key, value] of Object.entries(want.parameters ?? {})) {
      const got = JSON.stringify(have.parameters?.[key]);
      if (got !== JSON.stringify(value)) {
        drift.push(`${name}: ${key} is ${got}, not ${JSON.stringify(value)}`);
      }
    }
  }
  return drift;
}

export const GITHUB_RULES: Rule[] = [
  {
    id: "github-rules",
    check: ({ rules, pkg }) => {
      if (!rules) return undefined;
      return rules instanceof Error ? unread(rules) : drifted(rulesDrift(rules, pkg));
    },
    fix: { in: "github", apply: writeRuleset },
  },
  {
    ...owns("github-ci", [CI]),
    // Versions move in the reference first, so a repository doesn't take Dependabot's.
    check: (repo) => {
      const finding = owns("github-ci", [CI]).check(repo);
      const dependabot = repo.files[".github/dependabot.yml"] ? ["has a dependabot.yml"] : [];
      return drifted([...(finding?.drift ?? []), ...dependabot]);
    },
  },
];
