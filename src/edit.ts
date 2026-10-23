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
 * a config, like `fmt` and `lint`. It can't add a plugin, name a site's folder or change a file
 * Vite doesn't read, so those stay as edits.
 */
import { USES_WORKER } from "./worker.ts";
import { CRAFTZ } from "./reference.ts";
import { type Config, RULED, written } from "./ruled.ts";

/** @prose
 * # Using craftz
 *
 * `toolchain-craftz`'s fix imports the plugin and puts `craftz()` first in the config's plugins.
 * Then it takes out each key in `fmt` and `lint` that the plugin sets the same way.
 *
 * `craftz()` goes on a line of its own when the plugins are one to a line, so `vp check` passes
 * what it wrote. The blocks keep only the repository's own keys, like `ignorePatterns`, and a
 * block left empty goes with the comments above it. The keys and values are the plugin's own,
 * from [ruled.ts](ruled.ts), so the fix can't take out what the plugin doesn't set. A key that
 * differs stays, and the plugin then fails the config, naming it to settle by hand.
 */

/** A config with `craftz()` in its plugins, which then has what the plugin sets. */
export const PLUGIN = /\bplugins:\s*\[[^\]]*\bcraftz\(\)/;

const IMPORT = /^import \{ defineConfig \} from "vite-plus";\n/m;
// Each key craftz() sets in `fmt` and `lint`, at its value, as a pattern.
const RULED_KEYS = Object.values(RULED).flatMap((block) =>
  Object.entries(block as Config).map(([key, value]) =>
    `${key}: ${written(value)}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ),
);
const EMPTY_BLOCK = /(?:^[ \t]*\/\/.*\n)*^[ \t]*(?:fmt|lint): \{\s*\},?\n(?:[ \t]*\n)?/gm;

// Takes out each key craftz() sets, on a line of its own or inline, then any block left empty.
function trimRuled(text: string): string {
  const trimmed = RULED_KEYS.reduce(
    (t, key) =>
      t
        .replace(new RegExp(String.raw`^[ \t]*${key},?[ \t]*\n`, "m"), "")
        .replace(new RegExp(String.raw`(?<=\{\s*)${key}\s*(?=\})`), "")
        .replace(new RegExp(String.raw`${key},\s*`), "")
        .replace(new RegExp(String.raw`,\s*${key}(?=\s*\})`), ""),
    text,
  );
  return trimmed.replace(EMPTY_BLOCK, "");
}

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

/** A Vite config with `craftz()` first in its plugins, and none of what it sets. */
export function withCraftz(vite: string): string {
  if (PLUGIN.test(vite) || !IMPORT.test(vite)) return vite;
  const used = plugIn(
    vite.replace(IMPORT, (line) => `${line}import { craftz } from "${CRAFTZ}";\n`),
  );
  const plugged = PLUGIN.test(used)
    ? used
    : used.replace(/defineConfig\(\{\n/, "defineConfig({\n  plugins: [craftz()],\n\n");
  return trimRuled(plugged);
}

/** A prose site's Vite config, naming `.prose` as its folder on the line after its plugins. */
export function servingProse(vite: string): string {
  if (/\bpublicDir:/.test(vite)) return vite;
  return vite.replace(
    /^( {2}plugins: \[.*\bcloudflare\(.*\],\n)/m,
    '$1\n  // The site is the folder `prose build` writes.\n  publicDir: ".prose",\n',
  );
}

/** @prose
 * # A Worker's config
 *
 * A config from before `worker()` is wrapped in it. The edit takes out the lines `worker()` sets,
 * finds the Worker's closing brace by counting, and imports the call after the config's last
 * import. It goes once every repository uses `worker()`.
 */

const SETS = /^[ \t]*(?:compatibilityDate|workersDev|previewUrls):.*\n/gm;

/** A Worker's config wrapped in `worker()`, imported from `from`. */
export function withWorker(config: string, from: string): string {
  if (USES_WORKER.test(config)) return config;
  const text = config.replace(SETS, "");
  const open = /\bworker:\s*\{/.exec(text);
  if (!open) return config;
  let depth = 0;
  let close = -1;
  for (let i = open.index + open[0].length - 1; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close < 0) return config;
  const wrapped = `${text.slice(0, open.index)}worker: worker({${text.slice(open.index + open[0].length, close + 1)})${text.slice(close + 1)}`;
  const imports = [...wrapped.matchAll(/^import .*;$/gm)].at(-1);
  const line = `import { worker } from "${from}";`;
  if (!imports) return `${line}\n${wrapped}`;
  const end = imports.index + imports[0].length;
  return `${wrapped.slice(0, end)}\n${line}${wrapped.slice(end)}`;
}
