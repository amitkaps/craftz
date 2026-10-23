/** @prose
 * # Editing a repository's files
 *
 * The fixes that edit code a repository writes itself, `vite.config.ts` and `cloudflare.config.ts`,
 * each once, to add craftz's calls, and to take Cloudflare's plugin out. [rules.ts](rules.ts) reads
 * and writes the files, and keeps only the rules. CI and pnpm's settings are craftz's, written
 * whole.
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
 * # A static site's configs
 *
 * `cloudflare-site`'s fix rewrites a cf config as `site()`'s: the Worker that `worker: {…}` or
 * `worker: worker({…})` held becomes `site()`'s argument, without what `site()` sets, and the
 * folder Vite served goes in `assets.directory`. A config that turns an address on, or sets a
 * Node.js flag, comes back unchanged, since `site()` would fail it, and that's settled by hand.
 *
 * `cloudflare-static`'s fix takes Cloudflare's plugin out of `vite.config.ts`, with the
 * `lazyPlugins()` that loaded it, and the `publicDir` that named its folder, which is
 * `cloudflare.config.ts`'s now, unless Vite still builds the site from an `index.html`.
 */

const CF_IMPORT = /^import \{ defineConfig \} from "cf\/config";\n/m;
const SETS = /^[ \t]+(compatibilityDate: "[^"]*"|workersDev: false|previewUrls: false),\n/gm;

/** A Worker config that takes its Worker from `site()`, serving `directory`. */
export function withSite(config: string, directory: string): string {
  const open = /^([ \t]*)worker: (?:worker\()?\{\n/m.exec(config);
  if (
    !open ||
    !CF_IMPORT.test(config) ||
    /workersDev: true|previewUrls: true|nodejs_/.test(config)
  ) {
    return config;
  }
  const [line, indent = ""] = open;
  const close = new RegExp(`\n${indent}\\}\\)?,\n`);
  const rest = config.slice(open.index + line.length);
  const end = close.exec(rest);
  if (!end) return config;
  // The Worker's keys, one level out, as site()'s argument.
  const body = rest
    .slice(0, end.index + 1)
    .replace(SETS, "")
    .replace(new RegExp(`^${indent}`, "gm"), "");
  const folder = `    directory: "${directory}",\n`;
  const opened = /^  assets: \{\n/m;
  const keys = opened.test(body)
    ? body.replace(opened, (assets) => `${assets}${folder}`)
    : `${body}  assets: {\n${folder}  },\n`;
  const after = rest.slice(end.index + end[0].length).replace(/^\}\);\n?/, "");
  const before = config
    .slice(0, open.index)
    .replace(CF_IMPORT, `import { site } from "${CRAFTZ}/cloudflare";\n`)
    .replace(/^import \{ worker \} from "[^"]*";\n/m, "")
    .replace(/^export default defineConfig\(\{\n/m, "export default site({\n");
  return `${before}${keys}});\n${after}`;
}

const LAZY =
  /^[ \t]*lazyPlugins\(async \(\) => \{\n[^]*?@cloudflare\/vite-plugin[^]*?\n[ \t]*\}\),\n/m;
// The publicDir line, with the comment lines just above it.
const PUBLIC_DIR = /(?:^[ \t]*\/\/.*\n)*^[ \t]*publicDir: "[^"]*",\n(?:[ \t]*\n)?/m;

/** A Vite config without Cloudflare's plugin, and without `publicDir` unless Vite builds. */
export function withoutCloudflare(vite: string, builds: boolean): string {
  const without = vite
    .replace(LAZY, "")
    .replace(
      /^import \{ defineConfig, lazyPlugins \} from "vite-plus";$/m,
      'import { defineConfig } from "vite-plus";',
    )
    .replace(/^import \{ cloudflare \} from "@cloudflare\/vite-plugin";\n/m, "")
    .replace(/,?\s*cloudflare\(\{[^}]*\}\)/, "");
  return builds ? without : without.replace(PUBLIC_DIR, "");
}
