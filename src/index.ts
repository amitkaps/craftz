/** @prose
 * # craftz
 *
 * The package's entry is `craftz()`, the Vite plugin a repository puts in its `vite.config.ts`.
 * It sets what [the rules](../docs/rules.md#toolchain-wrap) ask of every Vite+ config, so a
 * repository's config holds only what's its own.
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
 * Worker config beside `vite.config.ts`. With an `index.html`, Vite bundles the site's own code,
 * so `build.target` is the rules' [browsers](../docs/rules.md#toolchain-browsers). Without one,
 * the site is the folder `prose build` writes, so `publicDir` is `.prose`. An app's config is its
 * framework's, so it gets neither.
 *
 * The Cloudflare plugin stays in the repository's config. It's the repository's dependency, at
 * the version the rules check, and craftz would otherwise need it as a peer.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { BROWSERS } from "./pinned.ts";
import { workerIn } from "./worker.ts";

type Config = { [key: string]: unknown };

// What the rules set, from `toolchain-wrap` and `toolchain-lint`.
const RULED: Config = {
  fmt: { proseWrap: "never" },
  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
  },
};

// What a static site adds to the rules, from the files at its root.
function site(root: string): Config {
  if (workerIn(root)?.deploys !== "static") return {};
  if (existsSync(join(root, "index.html"))) return { build: { target: BROWSERS } };
  return { publicDir: ".prose" };
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
