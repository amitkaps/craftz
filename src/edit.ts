/** @prose
 * # Editing a repository's files
 *
 * The fixes that edit code a repository writes itself, `vite.config.ts` and
 * `cloudflare.config.ts`, each once, to add craftz's call. [rules.ts](rules.ts) reads and writes
 * the files, and keeps only the rules. CI and pnpm's settings are craftz's, written whole.
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

const IMPORT = /^import \{ defineConfig \} from "vite-plus";\n/m;
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
