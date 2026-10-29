/** @prose
 * # Where each rule and command is stated
 *
 * A rule is a list item in [the rules](../docs/rules.md) that opens with its id as a span, like
 * ``- [`scripts-verify`]{#scripts-verify}: text``. Its part is the second-level heading it's
 * under, like Scripts. The doc is the one place a rule is worded, and the code holds only its
 * check and its fix, under the same id.
 *
 * A command is stated the same way, in [usage](../docs/usage.md), with how it's run as the span,
 * like ``- [`craftz deps [dir]`]{#deps}: text``. The id is the command's name. `craftz help`
 * lists each one's span and text, and `craftz help <command>` prints the section it opens, so a
 * command's help is its usage, from the installed version. markz prints both, as it does for
 * every tool that states its commands this way.
 *
 * The doc is read with markz's reader, as every tool built on markz reads its rules, so no
 * pattern here knows its layout and an example in a code block can't state a rule. A link is
 * resolved against the site, so a rule printed outside the repository still leads somewhere.
 * This file reads only the docs, so `craftz rules` and `craftz help` load nothing else.
 *
 * Another repository's lessons link a principle here by the page's address, which prose doesn't
 * check. So the page's anchors are read too, and `docs-lessons` holds each such link to one.
 *
 * The rules doc is parsed when something first asks for a rule, and only once in a run. Parsing
 * it takes about 50 ms, and `gone`, `pr` and `status` never need it, so nothing parses it when a
 * module loads.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { headings, ids, parse, walk } from "@amitkaps/markz";
import {
  type Commands,
  printHelp,
  readCommands,
  readRules,
  type Rules,
} from "@amitkaps/markz/rules";

/** A rule as the doc states it, under its part. */
export type Stated = { id: string; text: string; part: string };

/** The rules doc, which the package ships beside its code. */
export const RULES_DOC = fileURLToPath(new URL("../docs/rules.md", import.meta.url));

/** Where the rules doc is published, which its links resolve against. */
export const SITE = "https://craftz.amitkaps.com/docs/rules.md";

const doc = (): string => readFileSync(RULES_DOC, "utf8");

/** The usage doc, which the package ships beside its code. */
export const USAGE_DOC = fileURLToPath(new URL("../docs/usage.md", import.meta.url));

/** Where the usage doc is published, which its links resolve against. */
export const USAGE_SITE = "https://craftz.amitkaps.com/docs/usage.md";

const usage = (): string => readFileSync(USAGE_DOC, "utf8");

/** craftz's rules, as markz's `printOne` prints them. A finding's code is its rule's id, so
 *  there are no codes of their own. */
export const craftzRules = (markdown = doc()): Rules => ({
  tool: "craftz",
  rules: readRules(markdown, SITE),
  codes: [],
});

type Read = { stated: Stated[]; parts: string[]; anchors: Set<string> };

function read(markdown: string): Read {
  const tree = parse(markdown);
  const outline = headings(tree).filter((h) => h.depth === 2);
  const at = new Map(ids(tree).map(({ id, node }) => [id, tree.start(node)]));
  return {
    stated: readRules(markdown, SITE).map(({ id, text }) => ({
      id,
      text,
      part: outline.findLast((h) => tree.start(h.node) < (at.get(id) ?? 0))?.label ?? "",
    })),
    parts: outline.map((h) => h.label),
    anchors: new Set([...at.keys()]),
  };
}

let shipped: Read | undefined;
const readDoc = (markdown?: string): Read =>
  markdown === undefined ? (shipped ??= read(doc())) : read(markdown);

/** Every rule the doc states, in order, with its part. */
export const stated = (markdown?: string): Stated[] => readDoc(markdown).stated;

/** The doc's parts, its second-level headings, in order. */
export const parts = (markdown?: string): string[] => readDoc(markdown).parts;

/** Every id on the rules page, a rule's or a heading's, which a link's `#` can name. */
export const anchors = (markdown?: string): Set<string> => readDoc(markdown).anchors;

/** The `#` of each link in a doc that leads to the rules page by its published address, as
 *  another repository links it. A relative link is prose's to check. */
export function linkedRules(markdown: string): string[] {
  const tree = parse(markdown);
  const found: string[] = [];
  walk(tree, {
    enter(node) {
      if (tree.type(node) !== "link") return true;
      const [page, fragment] = tree.data(node, "link").destination.split("#");
      if (page === SITE && fragment) found.push(fragment);
      return false;
    },
  });
  return found;
}

/** The whole doc, as `craftz rules` prints it, with each link resolved against the site. */
export function printed(markdown = doc(), site = SITE): string {
  const tree = parse(markdown);
  let out = "";
  let at = 0;
  walk(tree, {
    enter(node) {
      const type = tree.type(node);
      if (type !== "link" && type !== "image") return true;
      const { destination } = tree.data(node, type);
      const source = markdown.slice(tree.start(node), tree.end(node));
      const resolved = new URL(destination, site).href;
      out += markdown.slice(at, tree.start(node));
      out += source.replace(`](${destination}`, `](${resolved}`);
      at = tree.end(node);
      return false;
    },
  });
  return out + markdown.slice(at);
}

/** craftz's commands, each stated in the usage doc, as markz's `printHelp` prints them. */
export const commands = (markdown = usage()): Commands =>
  readCommands("craftz", markdown, USAGE_SITE);

/** The commands, as `craftz help` lists them. */
export const help = (markdown = usage()): string => printHelp(commands(markdown))!;

/** The section of the usage doc that states a command, with its links resolved, or `undefined`
 *  when no command has that name. */
export const helpOn = (name: string, markdown = usage()): string | undefined =>
  printHelp(commands(markdown), name);
