/** @prose
 * # Applying the settings
 *
 * One repository's settings outside its files, checked, written and read back. `craftz settings`
 * runs it in a repository, and `pnpm align` runs it for each one it aligns, so both write the
 * same way. The pieces that read and write each setting are in [settings.ts](settings.ts).
 *
 * A write is done when the setting reads back as the rules want it, not when the API took it.
 * So each part is read, written only when it has drifted, then read again. Each line in the
 * report says what happened: `fixed`, `still off`, `failed` or `left`. Each write is
 * idempotent, so a run that stops partway, like GitHub's landing and Cloudflare's not, is
 * finished by running it again.
 */
import { RULES, type Rule } from "./rules.ts";
import type { Pkg } from "./reference.ts";
import { type Repo, type Worker, branchRules, repoLabels } from "./survey.ts";
import {
  hasClassic,
  mergeDrift,
  removeClassic,
  workerDrift,
  writeGitHub,
  writeWorker,
} from "./settings.ts";

// A write answers what it left, like a Worker that isn't connected to its repository yet.
export type Part = { name: string; read: () => Promise<string[]>; write: () => string[] | void };

/** What a repository is, as its settings depend on it: a package has labels, a site a Worker. */
export type Target = {
  repo: string;
  pkg: Pkg;
  site?: Worker;
  // Why the Worker can't be read or written, like `cf` not being logged in.
  cloudflare?: string;
};

// The rules with a fix on GitHub, like `github-rules`, are checked as the survey checks them.
// What GitHub couldn't answer is thrown, so it's reported rather than written over.
async function ruled(repo: string, pkg: Pkg, rule: Rule): Promise<string[]> {
  const rules = await branchRules(repo);
  const labels = pkg.private ? undefined : await repoLabels(repo);
  for (const found of [rules, labels]) if (found instanceof Error) throw found;
  const it: Repo = { pkg, files: {}, deps: {}, rules, labels };
  return rule.check(it)?.drift ?? [];
}

function parts({ repo, pkg, site, cloudflare }: Target): Part[] {
  const merge: Part = {
    name: "the merge settings",
    read: async () => mergeDrift(repo),
    write: () => writeGitHub(repo),
  };
  const github = RULES.flatMap((rule): Part[] => {
    const fix = rule.fix;
    if (fix?.in !== "github") return [];
    return [
      { name: rule.id, read: () => ruled(repo, pkg, rule), write: () => fix.apply(repo, pkg) },
    ];
  });
  const worker: Part[] =
    site && !cloudflare
      ? [
          {
            name: `${site.name}'s build settings`,
            read: async () => workerDrift(site.name),
            write: () => writeWorker(site.name),
          },
        ]
      : [];
  return [merge, ...github, ...worker];
}

const reason = (error: unknown): string =>
  error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error);

// A part that can't be read is reported, not taken as drift, so it never triggers a write.
async function read(part: Part): Promise<string[] | Error> {
  try {
    return await part.read();
  } catch (error) {
    return new Error(`${part.name} couldn't be read: ${reason(error)}`);
  }
}

/** What has drifted, with nothing written. Each line is one setting, or one that couldn't be read. */
export async function checkSettings(target: Target): Promise<string[]> {
  const found = await Promise.all(parts(target).map(read));
  const lines = found.flatMap((it) => (it instanceof Error ? [it.message] : it));
  if (hasClassic(target.repo)) lines.push("classic branch protection is on main");
  if (target.site && target.cloudflare)
    lines.push(`not checked: ${target.site.name}'s build settings, since ${target.cloudflare}`);
  return lines;
}

/** Each part read, written when it has drifted, and read back, in turn. */
export async function settle(all: Part[]): Promise<string[]> {
  const lines: string[] = [];
  for (const part of all) {
    const before = await read(part);
    if (before instanceof Error) {
      lines.push(`failed: ${before.message}`);
      continue;
    }
    if (!before.length) continue;
    try {
      const left = part.write() ?? [];
      if (left.length) {
        lines.push(...left);
        continue;
      }
    } catch (error) {
      lines.push(`failed: ${part.name}: ${reason(error)}`);
    }
    const after = await read(part);
    if (after instanceof Error) {
      lines.push(`failed: ${after.message}`);
      continue;
    }
    lines.push(...before.filter((line) => !after.includes(line)).map((line) => `fixed: ${line}`));
    lines.push(...after.map((line) => `still off: ${line}`));
  }
  return lines;
}

/**
 * Writes each part that has drifted, then reads it back. With `removing`, classic branch
 * protection is removed too. Without it, it's left and reported.
 */
export async function writeSettings(target: Target, removing = false): Promise<string[]> {
  const lines = await settle(parts(target));
  if (hasClassic(target.repo)) {
    if (removing) removeClassic(target.repo);
    lines.push(
      !removing
        ? "left: classic branch protection on main, which craftz settings --yes removes"
        : hasClassic(target.repo)
          ? "still off: classic branch protection is on main"
          : "fixed: classic branch protection is off main",
    );
  }
  if (target.site && target.cloudflare)
    lines.push(`left: ${target.site.name}'s build settings, since ${target.cloudflare}`);
  return lines;
}
