#!/usr/bin/env node
/** @prose
 * # The craftz command
 *
 * What a repository runs, and what an agent reads the rules with. Every subcommand works from
 * the installed package, so the version that checks a repository is the version it reads, and
 * nothing is fetched but what GitHub says about the repository.
 *
 * `craftz rules` prints [the rules](../docs/rules.md), and `craftz rules <id>` prints one, which
 * is what a finding names. It works like `prose rules`, so an agent that knows one knows the
 * other.
 *
 * `craftz check` runs every rule on a folder's files, the current one unless another is named.
 * It prints what has drifted and exits 1, like `pnpm drift ../markz` does for one folder, with
 * no settings read. `craftz fix` writes every fix in the files, the same ones `pnpm align` runs,
 * then checks again and prints what's left to do by hand. A fix can move versions, so
 * `pnpm install` comes next, then `pnpm run fix` for the format.
 */
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { here } from "./reference.ts";
import { fixFiles } from "./rules.ts";
import { RULES_DOC, stated } from "./stated.ts";
import { type Finding, HELD, checkFolder } from "./survey.ts";

const HELP = `Usage: craftz <command>

  rules [id]   prints every rule, or one
  check [dir]  runs every rule on a folder, the current one by default
  fix [dir]    writes every fix, then checks what's left`;

const [command, arg, ...rest] = process.argv.slice(2);

const lines = (f: Finding): string[] => f.drift.map((d) => (f.rule ? `${f.rule}: ${d}` : d));

// Prints a folder's findings, and returns whether anything has drifted.
async function check(dir: string): Promise<boolean> {
  const { findings } = await checkFolder(dir);
  const sees = new Map(stated().map((s) => [s.id, s.see]));
  const drift = findings.filter((f) => !f.held && f.drift.length);
  console.log(drift.length ? `✗ ${dir}` : `✓ ${dir}`);
  for (const line of drift.flatMap(lines)) console.log(`    ${line}`);
  for (const see of new Set(drift.map((f) => sees.get(f.rule ?? "")))) {
    if (see) console.log(`    see: ${see}`);
  }
  for (const f of findings.filter((f) => f.held)) {
    console.log(`    held: ${lines(f).join("; ")}\n      ${f.held}`);
  }
  for (const f of findings.filter((f) => f.unchecked))
    console.log(`    not checked: ${f.unchecked}`);
  return drift.length > 0;
}

if (command === "rules" && !rest.length) {
  if (!arg) {
    process.stdout.write(readFileSync(RULES_DOC, "utf8"));
  } else {
    const rule = stated().find((s) => s.id === arg);
    if (!rule) {
      console.error(`craftz: no rule named ${arg}. \`craftz rules\` prints them all.`);
      process.exit(1);
    }
    console.log(`${rule.id}, under ${rule.part}\n\n${rule.text}`);
  }
} else if (command === "check" && !rest.length) {
  process.exitCode = (await check(resolve(arg ?? "."))) ? 1 : 0;
} else if (command === "fix" && !rest.length) {
  const dir = resolve(arg ?? ".");
  fixFiles(dir, here, HELD[basename(dir)]);
  console.log("Fixed what can be. Run pnpm install, then pnpm run fix.\n");
  process.exitCode = (await check(dir)) ? 1 : 0;
} else if (command === "-h" || command === "--help") {
  console.log(HELP);
} else {
  console.error(HELP);
  process.exit(1);
}
