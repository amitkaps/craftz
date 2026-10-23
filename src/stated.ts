/** @prose
 * # Where each rule is stated
 *
 * A rule is a list item in [the rules](../docs/rules.md) that opens with its id as a span, like
 * ``- [`scripts-verify`]{#scripts-verify}: text``. Its part is the second-level heading it's
 * under, like Scripts. The doc is the one place a rule is worded, and the code holds only its
 * check and its fix, under the same id.
 *
 * The doc is read with markz's reader, as every tool built on markz reads its rules, so no
 * pattern here knows its layout and an example in a code block can't state a rule. A link is
 * resolved against the site, so a rule printed outside the repository still leads somewhere.
 * This file reads only the doc, so `craftz rules` loads nothing else.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { headings, ids, parse, walk } from "@amitkaps/markz";
import { readRules, type Rules } from "@amitkaps/markz/rules";

/** A rule as the doc states it, under its part. */
export type Stated = { id: string; text: string; part: string };

/** The rules doc, which the package ships beside its code. */
export const RULES_DOC = fileURLToPath(new URL("../docs/rules.md", import.meta.url));

/** Where the rules doc is published, which its links resolve against. */
export const SITE = "https://craftz.amitkaps.com/docs/rules.md";

const doc = (): string => readFileSync(RULES_DOC, "utf8");

/** craftz's rules, as markz's `printOne` prints them. A finding's code is its rule's id, so
 *  there are no codes of their own. */
export const craftzRules = (markdown = doc()): Rules => ({
  tool: "craftz",
  rules: readRules(markdown, SITE),
  codes: [],
});

/** Every rule the doc states, in order, with its part. */
export function stated(markdown = doc()): Stated[] {
  const tree = parse(markdown);
  const outline = headings(tree).filter((h) => h.depth === 2);
  const at = new Map(ids(tree).map(({ id, node }) => [id, tree.start(node)]));
  return readRules(markdown, SITE).map(({ id, text }) => ({
    id,
    text,
    part: outline.findLast((h) => tree.start(h.node) < (at.get(id) ?? 0))?.label ?? "",
  }));
}

/** The doc's parts, its second-level headings, in order. */
export function parts(markdown = doc()): string[] {
  return headings(parse(markdown))
    .filter((h) => h.depth === 2)
    .map((h) => h.label);
}

/** The whole doc, as `craftz rules` prints it, with each link resolved against the site. */
export function printed(markdown = doc()): string {
  const tree = parse(markdown);
  let out = "";
  let at = 0;
  walk(tree, {
    enter(node) {
      const type = tree.type(node);
      if (type !== "link" && type !== "image") return true;
      const { destination } = tree.data(node, type);
      const source = markdown.slice(tree.start(node), tree.end(node));
      const resolved = new URL(destination, SITE).href;
      out += markdown.slice(at, tree.start(node));
      out += source.replace(`](${destination}`, `](${resolved}`);
      at = tree.end(node);
      return false;
    },
  });
  return out + markdown.slice(at);
}
