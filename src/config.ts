/** @prose
 * # Reading a config
 *
 * The rules read `vite.config.ts`, `tsconfig.json` and `cloudflare.config.ts` by parsing them,
 * with the oxc parser Vite+ ships. So a value is found by where it sits in the config, not by how
 * the file is laid out. A key in a comment isn't read, and neither is one with the same name under another key.
 *
 * Nothing is run. A config is code, and loading it as Vite does takes about half a second and
 * runs its plugins, where parsing takes a millisecond. So only what's written as a literal is
 * read, and a value the config works out, like a call or a variable, reads as `undefined`.
 *
 * `vite-plus` is required when a config is first parsed, not imported, since loading it takes a
 * quarter of a second, and `pr`, `gone` and `status` read no config. Its own entry is the only
 * one that exports the parser. `oxc-parser` would load faster, but it's another 5 MB in every
 * install, for a parser every repository already has.
 */
import { createRequire } from "node:module";

/** A node of the tree oxc parses, with its place in the text. */
export interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

type Parse = (file: string, text: string) => { program: Node; errors: unknown[] };
let parseSync: Parse | undefined;

/** The program in `text`, or `undefined` where it doesn't parse. */
export function parsed(text: string): Node | undefined {
  parseSync ??= (createRequire(import.meta.url)("vite-plus") as { parseSync: Parse }).parseSync;
  const { program, errors } = parseSync("config.ts", text);
  return errors.length ? undefined : program;
}

const nodes = (value: unknown): Node[] => (Array.isArray(value) ? (value as Node[]) : []);

/** The object a config exports, as in `export default defineConfig({…})` or `{…}`. */
export function exported(text: string): Node | undefined {
  const body = nodes(parsed(text)?.["body"]);
  let value = body.find((node) => node.type === "ExportDefaultDeclaration")?.["declaration"] as
    | Node
    | undefined;
  if (value?.type === "CallExpression") value = nodes(value["arguments"])[0];
  return value?.type === "ObjectExpression" ? value : undefined;
}

const keyOf = (property: Node): unknown => {
  const key = property["key"] as Node;
  return property["computed"] ? undefined : (key["name"] ?? key["value"]);
};

/** The properties an object node holds, by name. A spread or a computed key is passed over. */
export const properties = (object: Node | undefined): Node[] =>
  nodes(object?.["properties"]).filter((it) => it.type === "Property" && keyOf(it) !== undefined);

/** The value at a path of keys in an object node, like `["lint", "options"]`. */
export function at(object: Node | undefined, path: string[]): Node | undefined {
  let node = object;
  for (const key of path) {
    if (node?.type !== "ObjectExpression") return undefined;
    node = properties(node).find((it) => keyOf(it) === key)?.["value"] as Node | undefined;
  }
  return node;
}

/** A node's value, where it's a literal, an array or an object of them, and `undefined` where
 *  it isn't. Inside an array or an object, a value that isn't read is left out. */
export function literal(node: Node | undefined): unknown {
  switch (node?.type) {
    case "Literal": {
      const regex = node["regex"] as { pattern: string; flags: string } | undefined;
      return regex ? new RegExp(regex.pattern, regex.flags) : node["value"];
    }
    case "ArrayExpression":
      return nodes(node["elements"])
        .map(literal)
        .filter((it) => it !== undefined);
    case "ObjectExpression":
      return Object.fromEntries(
        properties(node)
          .map((it) => [keyOf(it), literal(it["value"] as Node)])
          .filter(([, value]) => value !== undefined),
      );
    default:
      return undefined;
  }
}

/** The value at a path of keys in the object a config exports. */
export const valueAt = (text: string, path: string[]): unknown => literal(at(exported(text), path));

/** The call to `name` in a Vite config's own plugins, like `craftz()`. */
export const pluginCall = (vite: string, name: string): Node | undefined =>
  nodes(at(exported(vite), ["plugins"])?.["elements"]).find(
    (it) => it?.type === "CallExpression" && (it["callee"] as Node)["name"] === name,
  );

/** The value of a JSON file that allows comments and trailing commas, like `tsconfig.json`, or
 *  `undefined` where it isn't one. */
export function jsonc(text: string): unknown {
  const object = exported(`export default ${text}`);
  return object ? literal(object) : undefined;
}
