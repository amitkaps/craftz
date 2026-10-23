/** @prose
 * # Editing a repository's files
 *
 * The fixes that edit code a repository writes itself, `vite.config.ts` and
 * `cloudflare.config.ts`, each once, to add craftz's call, and to load Cloudflare's plugin only
 * when Vite runs. [rules.ts](rules.ts) reads and writes the files, and keeps only the rules. CI
 * and pnpm's settings are craftz's, written whole.
 *
 * Each edit is read with regular expressions, which depend on how a file is laid out, so most
 * fixes that missed a real repository missed here. An edit takes a file's text and gives back
 * the fixed text. A file laid out otherwise comes back unchanged, so its check still drifts.
 *
 * An edit belongs here only where `craftz()` can't do the job. The plugin sets what's a value in
 * a config, like `fmt` and `lint`, but it can't add itself, so that stays an edit. A fix that moved
 * repositories off an old layout is deleted once every repository is past it.
 */
import { CRAFTZ } from "./reference.ts";

/** @prose
 * # Using craftz
 *
 * `toolchain-craftz`'s fix imports the plugin and puts `craftz()` first in the config's plugins,
 * on a line of its own when the plugins are one to a line, so `vp check` passes what it wrote. A
 * key the config sets that the plugin sets differently stays, and the plugin then fails the
 * config, naming it to settle by hand.
 */

/** A config with `craftz()` in its plugins, which then has what the plugin sets. */
export const PLUGIN = /\bplugins:\s*\[[^\]]*\bcraftz\(/;

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
  if (PLUGIN.test(vite) || !IMPORT.test(vite)) return vite;
  const used = plugIn(
    vite.replace(IMPORT, (line) => `${line}import { craftz } from "${CRAFTZ}";\n`),
  );
  return PLUGIN.test(used)
    ? used
    : used.replace(/defineConfig\(\{\n/, "defineConfig({\n  plugins: [craftz()],\n\n");
}

/** @prose
 * # Loading Cloudflare's plugin
 *
 * `cloudflare-plugin`'s fix moves Cloudflare's plugin into Vite+'s `lazyPlugins()`, imported
 * inside it, so the format, lint and type checks read the config without loading the plugin and
 * the workerd it brings. Vite still loads it to build, serve and test.
 *
 * It rewrites a config whose plugins are on one line, as `craftz new` wrote them, one to a line,
 * as the format writes a list that holds a function.
 */

const STATIC = /^import \{ cloudflare \} from "@cloudflare\/vite-plugin";\n/m;

/** A list's items, split at the commas outside brackets. */
function items(list: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const char = list[i] ?? "";
    if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth--;
    else if (char === "," && depth === 0) {
      found.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  return [...found, list.slice(start).trim()].filter(Boolean);
}

/** A Vite config that loads Cloudflare's plugin in `lazyPlugins()`. */
export function withLazyCloudflare(vite: string): string {
  const line = /^([ \t]*)plugins: \[(.*\bcloudflare\(.*)\],$/m.exec(vite);
  if (!STATIC.test(vite) || !IMPORT.test(vite) || !line) return vite;
  const [whole, indent = "", list = ""] = line;
  const inner = `${indent}  `;
  const plugins = items(list).map((item) =>
    item.startsWith("cloudflare(")
      ? [
          `${inner}lazyPlugins(async () => {`,
          `${inner}  const { cloudflare } = await import("@cloudflare/vite-plugin");`,
          `${inner}  return [${item}];`,
          `${inner}}),`,
        ].join("\n")
      : `${inner}${item},`,
  );
  return vite
    .replace(STATIC, "")
    .replace(IMPORT, 'import { defineConfig, lazyPlugins } from "vite-plus";\n')
    .replace(whole, [`${indent}plugins: [`, ...plugins, `${indent}],`].join("\n"));
}
