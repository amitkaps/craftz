/** @prose
 * # Where each rule is stated
 *
 * A rule is a list item in [the rules](../docs/rules.md) on one line that opens with its id as a
 * span, like ``- [`scripts-verify`]{#scripts-verify}: text``. Its part is the second-level heading
 * it's under, like Scripts. The doc is the one place a rule is worded, and the code holds only
 * its check and its fix, under the same id.
 *
 * Code blocks are skipped, so an example can't state a rule. This file reads only the doc, so
 * `craftz rules` loads nothing else.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** A rule as the doc states it, and the command that prints it. */
export type Stated = { id: string; text: string; part: string; see: string };

/** The rules doc, which the package ships beside its code. */
export const RULES_DOC = fileURLToPath(new URL("../docs/rules.md", import.meta.url));

const doc = (): string => readFileSync(RULES_DOC, "utf8");

// Each line outside a code block, with the part it's under.
function* lines(markdown: string): Generator<{ line: string; part: string }> {
  let part = "";
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    part = /^## (.+)$/.exec(line)?.[1] ?? part;
    yield { line, part };
  }
}

/** Every rule the doc states, in order. */
export function stated(markdown = doc()): Stated[] {
  const found: Stated[] = [];
  for (const { line, part } of lines(markdown)) {
    const rule = /^- \[`([a-z]+-[a-z-]+)`\]\{#\1\}: (.+)$/.exec(line);
    if (rule?.[1] && rule[2]) {
      found.push({ id: rule[1], text: rule[2], part, see: `craftz rules ${rule[1]}` });
    }
  }
  return found;
}

/** The doc's parts, its second-level headings, in order. */
export function parts(markdown = doc()): string[] {
  return [...lines(markdown)].flatMap(({ line }) => /^## (.+)$/.exec(line)?.[1] ?? []);
}
