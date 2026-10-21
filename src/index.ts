/** @prose
 * # craftz
 *
 * The package's entry is `craftz()`, the Vite plugin a repository puts in its `vite.config.ts`.
 * It sets what [the rules](../docs/rules.md#toolchain-wrap) ask of every Vite+ config, as
 * [ruled.ts](ruled.ts) states it, so a repository's config holds only what's its own.
 *
 * ## A thin plugin
 *
 * A plugin's `config` hook wins over the repository's config without a word, so `craftz()` only
 * fills in what the repository leaves unset. A value the repository sets the same is fine. A
 * value it sets differently fails the config and names the key. So the plugin can't override
 * the repository, and the repository can't drift from the rules through it.
 *
 * Arrays are values, not lists to add to. Vite would join a plugin's array to the config's, so
 * an array the repository sets is compared whole, and one it leaves unset is filled in whole.
 *
 * It needs nothing from Vite at run time, so the package keeps no dependencies.
 *
 * ## A site's config
 *
 * A static site's config follows from [the deploy axis](../docs/rules.md#axes), read from the
 * Worker config beside `vite.config.ts`. A static site is one folder, and it names that folder
 * itself, as `publicDir`: `.prose` for a prose site, `public` for one Sitez builds. A site with
 * an `index.html` is Vite's own build, so it needs no folder. craftz() never guesses the folder,
 * since a site built another way would get the wrong one. What it sets is `build.target`, the
 * rules' [browsers](../docs/rules.md#toolchain-browsers), for whatever Vite bundles. An app's
 * config is its framework's, so it gets neither.
 *
 * The Cloudflare plugin stays in the repository's config. It's the repository's dependency, at
 * the version the rules check, and craftz would otherwise need it as a peer.
 */
import { resolve } from "node:path";
import { BROWSERS } from "./pinned.ts";
import { type Config, RULED } from "./ruled.ts";
import { workerIn } from "./worker.ts";

// What a static site adds to the rules: the browsers, for whatever Vite bundles.
function site(root: string): Config {
  return workerIn(root)?.deploys === "static" ? { build: { target: BROWSERS } } : {};
}

const isObject = (value: unknown): value is Config =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// What's unset in `have`, from `want`, with each conflict named by its path.
function fill(want: Config, have: Config, path: string, conflicts: string[]): Config {
  const added: Config = {};
  for (const [key, value] of Object.entries(want)) {
    const at = path ? `${path}.${key}` : key;
    const theirs = have[key];
    if (theirs === undefined) added[key] = value;
    else if (isObject(value) && isObject(theirs)) {
      const inner = fill(value, theirs, at, conflicts);
      if (Object.keys(inner).length) added[key] = inner;
    } else if (JSON.stringify(theirs) !== JSON.stringify(value)) {
      conflicts.push(
        `${at} is ${JSON.stringify(theirs)}, and the rules set ${JSON.stringify(value)}`,
      );
    }
  }
  return added;
}

/** The Vite plugin that sets what the rules ask of a config, and never overrides one. */
export function craftz(): { name: string; config(config: Config): Config } {
  return {
    name: "craftz",
    config(config) {
      const conflicts: string[] = [];
      const root = resolve(typeof config["root"] === "string" ? config["root"] : ".");
      const added = fill({ ...RULED, ...site(root) }, config, "", conflicts);
      if (conflicts.length) {
        const list = conflicts.map((c) => `  ${c}`).join("\n");
        throw new Error(`craftz() won't override vite.config.ts. Take these out of it:\n${list}`);
      }
      return added;
    },
  };
}
