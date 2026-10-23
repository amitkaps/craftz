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
 * Worker config beside `vite.config.ts`. A static site is one folder, and its
 * `cloudflare.config.ts` names it, so `craftz()` sets no folder. What it sets is `build.target`,
 * the rules' [browsers](../docs/rules.md#toolchain-browsers), for whatever Vite bundles. An app's
 * config is its framework's, so it gets neither.
 *
 * ## A package's config
 *
 * A package is one whose `package.json` isn't private, as [the publish axis](../docs/rules.md#axes)
 * has it. `craftz()` sets how it's packed: publint, strict, inside `vp pack`, and declarations
 * from Oxc. A package runs in Node, so it packs for `platform: "node"`. One that runs in browsers
 * too, like markz, says `craftz({ browser: true })`, and packs for `"neutral"`, targeting the
 * rules' browsers and the Node its `engines` asks for. The package names its entries and the rest.

 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BROWSERS } from "./pinned.ts";
import { type Config, RULED } from "./ruled.ts";
import { workerIn } from "./worker.ts";

// What a static site adds to the rules: the browsers, for whatever Vite bundles.
function site(root: string): Config {
  return workerIn(root)?.deploys === "static" ? { build: { target: BROWSERS } } : {};
}

/** What a repository says about itself, where `craftz()` can't read it. */
export type Options = {
  /** A package that runs in browsers as well as in Node. */
  browser?: boolean;
};

type Pkg = { private?: boolean; engines?: { node?: string } };

// What a package adds to the rules: how it's packed, for where it runs.
function pack(root: string, { browser = false }: Options): Config {
  let pkg: Pkg;
  try {
    pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Pkg;
  } catch {
    return {};
  }
  if (pkg.private) return {};
  const floor = /^>=\s*([\d.]+)$/.exec(pkg.engines?.node ?? "")?.[1];
  const node = floor ? [`node${floor}`] : [];
  const where = browser
    ? { platform: "neutral", target: [...BROWSERS, ...node] }
    : { platform: "node" };
  return { pack: { publint: { strict: true }, dts: { generator: "oxc" }, ...where } };
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
export function craftz(options: Options = {}): {
  name: string;
  config(config: Config): Config;
} {
  return {
    name: "craftz",
    config(config) {
      const conflicts: string[] = [];
      const root = resolve(typeof config["root"] === "string" ? config["root"] : ".");
      const added = fill(
        { ...RULED, ...site(root), ...pack(root, options) },
        config,
        "",
        conflicts,
      );
      if (conflicts.length) {
        const list = conflicts.map((c) => `  ${c}`).join("\n");
        throw new Error(`craftz() won't override vite.config.ts. Take these out of it:\n${list}`);
      }
      return added;
    },
  };
}
