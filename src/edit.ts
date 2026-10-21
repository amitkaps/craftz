/** @prose
 * # Editing a repository's files
 *
 * The fixes that edit code or YAML a repository writes itself: `vite.config.ts`,
 * `cloudflare.config.ts`, CI and `pnpm-workspace.yaml`. [rules.ts](rules.ts) reads and writes
 * the files, and keeps only the rules.
 *
 * Each edit is read with regular expressions, which depend on how a file is laid out, so most
 * fixes that missed a real repository missed here. An edit takes a file's text and gives back
 * the fixed text. A file laid out otherwise comes back unchanged, so its check still drifts.
 *
 * An edit belongs here only where `craftz()` can't do the job. The plugin sets what's a value in
 * a config, like `fmt` and `lint`. It can't add a plugin, name a site's folder or change a file
 * Vite doesn't read, so those stay as edits.
 */
import { join } from "node:path";
import { CRAFTZ, here, read } from "./reference.ts";
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
 * `cloudflare.config.ts` is edited by its lines: the date's own line, and the two addresses go
 * after `domains`.
 */

/** The compatibility date's line in a Worker's config, with the date. */
export const DATE = /^\s*compatibilityDate:\s*"([^"]*)"/m;
const DOMAINS = /^(\s*)domains:.*$/m;

/** A Worker's config with both of its other addresses off, after `domains` where it sets neither. */
export function withAddressesOff(config: string): string {
  let out = config;
  for (const key of ["previewUrls", "workersDev"]) {
    const on = new RegExp(`(${key}:\\s*)true`);
    if (on.test(out)) out = out.replace(on, "$1false");
    else if (!new RegExp(`${key}:`).test(out)) {
      out = out.replace(DOMAINS, (line, indent: string) => `${line}\n${indent}${key}: false,`);
    }
  }
  return out;
}

/** A Worker's config at the compatibility date given. */
export const withDate = (config: string, want: string): string =>
  config.replace(DATE, (line, date: string) => line.replace(date, want));

/** @prose
 * # CI
 *
 * CI had the label check as a step, and ran again when a label changed, so a pull request opened
 * with its label ran `verify` twice. The edit takes the step, its triggers and the old
 * `concurrency` out. A CI whose only `@prose` comment was the step's gets the reference's
 * opening comment, so `prose check` still finds one.
 */

/** Where CI's workflow is, in a repository and in the reference. */
export const CI = ".github/workflows/ci.yml";
const LABEL_STEP = /(?:^ {6}#.*\n)*^ {6}- name: Label\n[\s\S]*?\n {10}'\n\n?/m;
const LABEL_TRIGGER = /^ {2}# .*label.*\n(?= {2}pull_request:)|^ {4}types: \[.*\blabeled\b.*\]\n/gm;
const CONCURRENCY = /^(?:# .*\n)*concurrency:\n(?: {2}.*\n)+/m;
const referenceCi = read(join(here, CI));
/** The reference CI's `concurrency`, with its comment, which every CI has word for word. */
export const concurrency = CONCURRENCY.exec(referenceCi)?.[0] ?? "";
const CI_HEADER = /^(?:#.*\n)+/.exec(referenceCi)?.[0] ?? "";

/** CI without the label step and its triggers, which the label workflow has now. */
export function withoutLabel(ci: string): string {
  let text = ci.replace(LABEL_STEP, "").replace(LABEL_TRIGGER, "");
  if (!text.includes(concurrency)) text = text.replace(CONCURRENCY, () => concurrency);
  return text.includes("@prose") ? text : CI_HEADER + text;
}

/** @prose
 * # pnpm's settings
 *
 * `pnpm-workspace.yaml` is flat YAML, edited by its lines: the override that points `vite` at
 * Vite+'s build, and the cooldown's exclusions.
 */

// The override that points `vite` at Vite+'s build, with its version.
const OVERRIDE = /vite-plus-core@[\w.-]+/;

/** pnpm's settings with `vite` pointed at the Vite+ version given. */
export const withOverride = (workspace: string, want: string): string =>
  workspace.replace(OVERRIDE, `vite-plus-core@${want}`);

/** The cooldown's exclusions in pnpm's settings. */
export const EXCLUDE = /^minimumReleaseAgeExclude:\n(?:[ \t]+-.*\n?)*/m;
// The block with the comment above it, for a repository that has neither.
const COMMENTED = /^(?:#.*\n)*minimumReleaseAgeExclude:\n(?:[ \t]+-.*\n?)*/m;

/** pnpm's settings with pnpm's own wait and the reference's exclusions, from `ours`. */
export function withCooldown(workspace: string, ours: string): string {
  const want = EXCLUDE.exec(ours)?.[0];
  const commented = COMMENTED.exec(ours)?.[0] ?? want;
  const text = workspace.replace(/^minimumReleaseAge:.*\n?/m, "");
  if (!want || !commented) return text;
  return EXCLUDE.test(text)
    ? text.replace(EXCLUDE, want)
    : `${text.trimEnd()}\n\n${commented.trimEnd()}\n`;
}
