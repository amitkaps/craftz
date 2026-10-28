/** @prose
 * # Editing a repository's files
 *
 * The fixes that edit `vite.config.ts`, code a repository writes itself, to add `craftz()` and
 * the task `verify` runs. [rules.ts](rules.ts) reads and writes the files, and keeps only the
 * rules. CI and pnpm's settings are craftz's, written whole.
 *
 * An edit takes a file's text and gives back the fixed text. It finds where to write by parsing
 * the config, as [config.ts](config.ts) does, and writes there, so the rest of the file stays as
 * it was. A config it can't place the edit in comes back unchanged, so its check still drifts.
 * Adding `craftz()` still finds the plugins by their lines, and goes when the plugin does.
 *
 * An edit belongs here only where `craftz()` can't do the job. The plugin sets what's a value in
 * a config, like `fmt` and `lint`, but it can't add itself, so that stays an edit. A fix that moved
 * repositories off an old layout is deleted once every repository is past it, like the ones that
 * moved a static site off Cloudflare's plugin and onto `site()`.
 */
import { at, exported, literal, pluginCall, properties } from "./config.ts";
import { CRAFTZ } from "./reference.ts";

/** @prose
 * # Using craftz
 *
 * `toolchain-craftz`'s fix imports the plugin and puts `craftz()` first in the config's plugins,
 * on a line of its own when the plugins are one to a line, so `vp check` passes what it wrote. A
 * key the config sets that the plugin sets differently stays, and the plugin then fails the
 * config, naming it to settle by hand.
 */

/** Whether a config has `craftz()` in its plugins, and so has what the plugin sets. */
export const usesCraftz = (vite: string): boolean => Boolean(pluginCall(vite, "craftz"));

const IMPORT = /^import \{ defineConfig(?:, lazyPlugins)? \} from "vite-plus";\n/m;
// Puts craftz() first in Vite's plugins, on a line of its own when they're one to a line.
// Oxlint's plugins are names in quotes, so they're passed over.
const plugIn = (text: string): string =>
  text.replace(/\bplugins:\s*\[(?!\s*")(\s*\])?(\n[ \t]*)?/, (_, empty?: string, line?: string) =>
    empty
      ? "plugins: [craftz()]"
      : line
        ? `plugins: [${line}craftz(),${line}`
        : "plugins: [craftz(), ",
  );

/** A Vite config with `craftz()` first in its plugins. */
export function withCraftz(vite: string): string {
  if (usesCraftz(vite) || !IMPORT.test(vite)) return vite;
  const used = plugIn(
    vite.replace(IMPORT, (line) => `${line}import { craftz } from "${CRAFTZ}";\n`),
  );
  return usesCraftz(used)
    ? used
    : used.replace(/defineConfig\(\{\n/, "defineConfig({\n  plugins: [craftz()],\n\n");
}

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
