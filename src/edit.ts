/** @prose
 * # Editing a repository's files
 *
 * The fixes that edit `vite.config.ts` and `cloudflare.config.ts`, code a repository writes
 * itself, to write in the values the rules set, take out `craftz()` and `site()`, and add the task
 * `verify` runs. [rules.ts](rules.ts) reads and writes the files, and keeps only the
 * rules. CI and pnpm's settings are craftz's, written whole.
 *
 * An edit takes a file's text and gives back the fixed text. It finds where to write by parsing
 * the config, as [config.ts](config.ts) does, and writes there, so the rest of the file stays as
 * it was. A config it can't place the edit in comes back unchanged, so its check still drifts.
 *
 * A fix that moves repositories off an old layout is deleted once every repository is past it.
 * The ones that moved a static site off Cloudflare's plugin are gone, and the ones that take out
 * `craftz()` and `site()` go next.
 */
import { type Node, at, exported, literal, parsed, pluginCall, properties } from "./config.ts";
import { type Config, written } from "./ruled.ts";

/** @prose
 * # Leaving craftz()
 *
 * `toolchain-craftz`'s fix takes `craftz()` out of the config's plugins, and its import, since
 * the package no longer exports the plugin. A config whose only plugin it was loses `plugins`
 * too. A config that said `craftz({ browser: true })` gets `pack.platform: "neutral"` first, so
 * `toolchain-browsers` still reads it as a package for browsers.
 */

/** Whether a config calls `craftz()` in its plugins. */
export const usesCraftz = (vite: string): boolean => Boolean(pluginCall(vite, "craftz"));

const IMPORT = /^import \{ craftz \} from "[^"]+";\n/m;

/** A Vite config without `craftz()` or its import, and with what it said written out. */
export function withoutCraftz(vite: string): string {
  const call = pluginCall(vite, "craftz");
  if (!call) return vite;
  const option = literal((call["arguments"] as Node[])[0]) as { browser?: unknown } | undefined;
  const text =
    option?.browser === true ? withValues(vite, { pack: { platform: "neutral" } }) : vite;
  const config = exported(text);
  const plugins = properties(config).find((it) => at(config, ["plugins"]) === it["value"]);
  const elements = (at(config, ["plugins"])?.["elements"] ?? []) as Node[];
  const i = elements.findIndex(
    (it) => it?.type === "CallExpression" && (it["callee"] as Node)["name"] === "craftz",
  );
  const [it, before] = [elements[i], elements[i - 1]];
  if (!it || !plugins) return vite;
  // Up to what follows a node and its comma, so a comment after it stays.
  const past = (node: Node): number => {
    const comma = /^\s*,/.exec(text.slice(node.end))?.[0].length ?? 0;
    return node.end + comma + (/^\s*/.exec(text.slice(node.end + comma))?.[0].length ?? 0);
  };
  const cut: [number, number] =
    elements.length === 1
      ? [plugins.start, past(plugins)]
      : i < elements.length - 1
        ? [it.start, past(it)]
        : [before?.end ?? it.start, it.end];
  return `${text.slice(0, cut[0])}${text.slice(cut[1])}`.replace(IMPORT, "");
}

/** @prose
 * # Leaving site()
 *
 * `cloudflare-site`'s fix rewrites `export default site({…})` as `export default { worker: {…} }`,
 * cf's own layout, and takes out the import, since the package no longer exports `site()`. The
 * Worker's keys stay as they were written, and the check's values are then written in like any
 * other.
 */

const SITE_IMPORT = /^import \{ site \} from "[^"]+";\n/m;

/** A Worker config without `site()`, its object under `worker`. */
export function withoutSite(text: string): string {
  const body = (parsed(text)?.["body"] ?? []) as Node[];
  const call = body.find((node) => node.type === "ExportDefaultDeclaration")?.["declaration"] as
    | Node
    | undefined;
  if (call?.type !== "CallExpression" || (call["callee"] as Node)["name"] !== "site") return text;
  const object = (call["arguments"] as Node[])[0];
  if (!object) return text;
  const own = text.slice(object.start, object.end).replaceAll("\n", "\n  ");
  return `${text.slice(0, call.start)}{\n  worker: ${own},\n}${text.slice(call.end)}`.replace(
    SITE_IMPORT,
    "",
  );
}

/** @prose
 * # The values a config writes out
 *
 * The toolchain's and the releases' fixes write their values into the config, each key at its
 * path, like `lint.options.typeAware`. A key that's there with another value has the value
 * replaced. A missing key goes in the deepest block the path reaches, after its last key, so
 * `fmt: { ignorePatterns }` gains `proseWrap`, and a config with no `lint` gains the whole block.
 *
 * Where the path meets something that isn't an object, like `lint: shared`, the edit stops, and
 * the check still drifts, naming the key to set by hand. The edit writes each value on one line,
 * as `written` spells it, and `vp check --fix` lays it out after.
 */

// The paths to each value in a block, with the value, like `[["fmt", "proseWrap"], "never"]`.
const leaves = (value: unknown, path: string[] = []): [string[], unknown][] =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, it]) => leaves(it, [...path, key]))
    : [[path, value]];

/** Each value in `values` that a config sets otherwise, or not at all, by its path. */
export const unlike = (vite: string, values: Config): [string[], unknown][] =>
  leaves(values).filter(
    ([path, value]) => JSON.stringify(literal(at(exported(vite), path))) !== JSON.stringify(value),
  );

// Adds `key: value` to an object node, after its last key, or as its only one.
function withKey(text: string, object: Node, key: string, value: string, top: boolean): string {
  const last = (object["properties"] as Node[]).at(-1);
  if (!last) return `${text.slice(0, object.start)}{ ${key}: ${value} }${text.slice(object.end)}`;
  const comma = text[last.end] === ",";
  const after = last.end + (comma ? 1 : 0);
  const line = /^\s*/.exec(text.slice(text.lastIndexOf("\n", last.start) + 1, last.start))?.[0];
  const multiline = text.slice(object.start, object.end).includes("\n");
  const gap = multiline ? `${top ? "\n\n" : "\n"}${line}` : " ";
  return `${text.slice(0, after)}${comma ? "" : ","}${gap}${key}: ${value}${comma && multiline ? "," : ""}${text.slice(after)}`;
}

// A config with `value` at `path`, or as it was where the path can't be reached.
function withValue(text: string, path: string[], value: unknown): string {
  let object = exported(text);
  for (const [i, key] of path.entries()) {
    if (object?.type !== "ObjectExpression") return text;
    const node = at(object, [key]);
    if (!node) {
      const rest = path.slice(i + 1).reduceRight<unknown>((it, inner) => ({ [inner]: it }), value);
      return withKey(text, object, key, written(rest), i === 0);
    }
    if (i === path.length - 1) {
      return `${text.slice(0, node.start)}${written(value)}${text.slice(node.end)}`;
    }
    object = node;
  }
  return text;
}

/** A Vite config with each of `values` set at its path, where the path can be reached. */
export const withValues = (vite: string, values: Config): string =>
  unlike(vite, values).reduce((text, [path, value]) => withValue(text, path, value), vite);

/** @prose
 * # Running verify
 *
 * `verify` is `vp run --log grouped all`, and `all` is a task in `vite.config.ts` that runs the
 * repository's scripts side by side, one for each entry in its `dependsOn`.
 *
 * `scripts-verify`'s fix moves a `verify` that chained them with `&&` into that list, and adds
 * the `run` block after the config's last key. A config that already has a `run` block comes
 * back unchanged, so the task is added by hand.
 *
 * The cache is off. A cached step replays its output without running, so a check could pass on
 * files it never read, and `verify` is what CI, `pr` and a release trust.
 */

/** The scripts the config's `all` task depends on, or `undefined` without one. */
export function allOf(vite: string): string[] | undefined {
  const list = literal(at(exported(vite), ["run", "tasks", "all", "dependsOn"]));
  return Array.isArray(list) ? list.filter((it) => typeof it === "string") : undefined;
}

/** The `run` block whose `all` task runs these scripts, as a config's key, indented. */
export const runBlock = (scripts: string[]): string => `  run: {
    cache: false,
    tasks: {
      all: { command: "true", dependsOn: [${scripts.map((it) => JSON.stringify(it)).join(", ")}] },
    },
  },
`;

/** A Vite config whose `all` task runs these scripts, added after its last key. */
export function withVerify(vite: string, scripts: string[]): string {
  const config = exported(vite);
  const last = properties(config).at(-1);
  if (!last || at(config, ["run"])) return vite;
  const comma = vite[last.end] === ",";
  const after = last.end + (comma ? 1 : 0);
  const block = runBlock(scripts).trimEnd();
  return `${vite.slice(0, after)}${comma ? "" : ","}\n\n${block}${vite.slice(after)}`;
}
