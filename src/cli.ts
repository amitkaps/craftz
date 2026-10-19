#!/usr/bin/env node
/** @prose
 * # The craftz command
 *
 * What a repository runs, and what an agent reads the rules with. `craftz rules` prints
 * [the rules](../docs/rules.md) from the installed package, so the version that checks a
 * repository is the version it reads, and nothing is fetched. `craftz rules <id>` prints one
 * rule, which is what a finding from `drift` names.
 *
 * It works like `prose rules`, so an agent that knows one knows the other.
 */
import { readFileSync } from "node:fs";
import { RULES_DOC, stated } from "./stated.ts";

const HELP = `Usage: craftz rules [id]

\`craftz rules\` prints every rule, and \`craftz rules <id>\` prints one.`;

const [command, id, ...rest] = process.argv.slice(2);

if (command === "rules" && !rest.length) {
  if (!id) {
    process.stdout.write(readFileSync(RULES_DOC, "utf8"));
  } else {
    const rule = stated().find((s) => s.id === id);
    if (!rule) {
      console.error(`craftz: no rule named ${id}. \`craftz rules\` prints them all.`);
      process.exit(1);
    }
    console.log(`${rule.id}, under ${rule.part}\n\n${rule.text}`);
  }
} else if (command === "-h" || command === "--help") {
  console.log(HELP);
} else {
  console.error(HELP);
  process.exit(1);
}
