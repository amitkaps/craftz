/** @prose
 * # The toolchain rules
 *
 * The rules under [Toolchain: Vite+](../../docs/rules.md#toolchain-vite): the `tsconfig.json`
 * options, the `fmt` and `lint` blocks, and the browsers a package or a site targets. The
 * helpers that read and write them are exported, since the releases' and Cloudflare's rules
 * read the same configs.
 */
import { join } from "node:path";
import { CRAFTZ, type Pkg, here, isCraftz, read, readPkg, versionsIn } from "../reference.ts";
import { existsSync } from "node:fs";
import { at, exported, jsonc, literal, valueAt } from "../config.ts";
import { type Worker, workerIn } from "../worker.ts";
import { unlike, withValues, withoutCraftz, usesCraftz } from "../edit.ts";
import { type Config, RULED, written } from "../ruled.ts";
import { BROWSERS, COMPATIBILITY_DATE } from "../pinned.ts";
import type { Rule } from "../rules.ts";
import { EDITOR, type Json, drifted, editFile, owns, writeJson, writePkg } from "./shared.ts";

/** @prose
 * # The toolchain
 *
 * A repository's `tsconfig.json` writes out the compiler options of
 * [the reference's](../../reference/tsconfig.json), and its own `include`. It extends nothing.
 *
 * So the editor and `vp check` read the options from the file, and the types work without craftz
 * installed. It's parsed as [config.ts](../config.ts) parses a config, which takes the comments
 * and trailing commas a tsconfig allows. Each option is compared, so the check names the ones
 * that differ. The fix keeps `include` and writes the rest, so a repository's own options and
 * comments go.
 *
 * The `fmt` and `lint` blocks are read from the parsed `vite.config.ts` too, a value at a time
 * from [ruled.ts](../ruled.ts), and the fix writes each one that differs, as edit.ts does. A
 * package's `pack` is read the same way, by the releases' rules.
 */
export const OPTIONS = (JSON.parse(read(join(here, "tsconfig.json"))) as { compilerOptions: Json })
  .compilerOptions;

export type Tsconfig = { compilerOptions?: Json; include?: unknown } & Json;

export function tsconfigIn(text: string): Tsconfig | undefined {
  const parsed = jsonc(text);
  return parsed && typeof parsed === "object" ? (parsed as Tsconfig) : undefined;
}

// What a config sets otherwise than `values`, a value at a time.
export const unruled = (vite: string, values: Config): string[] =>
  unlike(vite, values).map(([path, want]) => {
    const have = literal(at(exported(vite), path));
    const key = path.join(".");
    return have === undefined
      ? `${key} isn't ${written(want)}`
      : `${key} is ${written(have)}, not ${written(want)}`;
  });

// Writes values into the Vite config, where edit.ts can place them.
export const rule = (dir: string, values: Config): void =>
  editFile(join(dir, "vite.config.ts"), (vite) => withValues(vite, values));

// What every Worker's `cloudflare.config.ts` sets: the date cf's runtime knows, and only its domain.
export const WORKER = {
  compatibilityDate: COMPATIBILITY_DATE,
  workersDev: false,
  previewUrls: false,
};

/** @prose
 * # The browsers
 *
 * The list comes from [browsers.ts](../browsers.ts). A package runs in Node, with `platform: "node"`
 * and no `pack.target`. One that runs in browsers too packs for `"neutral"`, and targets the list
 * and the Node its `engines` asks for. A package is read as one for browsers when it packs for
 * `"neutral"` or targets a browser, so the fix keeps it there.
 *
 * On `"neutral"`, Rolldown doesn't know Node's own modules, so it warns on each `node:` import,
 * like a command's `node:fs`, and leaves it external anyway. So a package for browsers lists
 * `/^node:/` in `pack.deps.neverBundle`, and the warning goes. The fix adds it to what's there.
 * A list that holds something the parser can't read, like a variable, is left to fix by hand.
 *
 * A site Vite bundles sets the list in `build.target`, a static site or an app. The browsers in
 * it have to be the list, with any Node left out, since an app's config is its framework's.
 */
// The browsers in a target, without Node.
export const targetsIn = (target: unknown): string[] =>
  (Array.isArray(target) ? target : [target])
    .filter((it): it is string => typeof it === "string")
    .filter((it) => !it.startsWith("node"));

// What a package's `pack` sets for where it runs.
export function packFor(pkg: Pkg, vite: string): Config {
  const browser =
    valueAt(vite, ["pack", "platform"]) === "neutral" ||
    targetsIn(valueAt(vite, ["pack", "target"])).length > 0;
  if (!browser) return { platform: "node" };
  const floor = /^>=\s*([\d.]+)$/.exec(pkg.engines?.node ?? "")?.[1];
  return { platform: "neutral", target: [...BROWSERS, ...(floor ? [`node${floor}`] : [])] };
}

// Node's own modules, which a package for browsers leaves out of its bundle.
export const NODE = /^node:/;
export const NEVER = ["pack", "deps", "neverBundle"];

// Whether `pack.deps.neverBundle` holds `NODE`.
export const holdsNode = (vite: string): boolean => {
  const have = valueAt(vite, NEVER);
  return Array.isArray(have) && have.some((it) => String(it) === String(NODE));
};

// `pack.deps.neverBundle` with `NODE` added, or nothing where the list can't be read whole.
export function withNode(vite: string): unknown[] | undefined {
  const node = at(exported(vite), NEVER);
  const have = node ? literal(node) : [];
  const elements = (node?.["elements"] as unknown[] | undefined) ?? [];
  return Array.isArray(have) && have.length === elements.length ? [...have, NODE] : undefined;
}

// The browsers a site Vite bundles has in `build.target`, unlike the list, or nothing.
export function siteDrift(vite: string, site?: Worker): string[] {
  // A site Vite bundles from source, unlike one that serves a folder `prose build` wrote.
  if (!site || site.directory === ".prose") return [];
  const have = targetsIn(valueAt(vite, ["build", "target"]));
  if (!have.length) return ["build.target isn't set"];
  const same = [...new Set(have)].sort().join(" ") === [...BROWSERS].sort().join(" ");
  return same ? [] : [`build.target is ${have.join(" ")}, not ${BROWSERS.join(" ")}`];
}

// craftz in the dev dependencies, and no `craftz()` in the Vite config, as edit.ts says.
export function useCraftz(dir: string, std: string): void {
  const pkg = readPkg(dir);
  const want = isCraftz(pkg) ? undefined : versionsIn(std)[CRAFTZ];
  if (want && !pkg.dependencies?.[CRAFTZ] && !pkg.devDependencies?.[CRAFTZ]) {
    const deps = { ...pkg.devDependencies, [CRAFTZ]: want };
    pkg.devDependencies = Object.fromEntries(
      Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
    );
    writePkg(dir, pkg);
  }
  editFile(join(dir, "vite.config.ts"), withoutCraftz);
}

export const TOOLCHAIN_RULES: Rule[] = [
  {
    id: "toolchain-types",
    holdable: true,
    check: ({ files }) => {
      const tsconfig = files["tsconfig.json"];
      if (!tsconfig) return drifted(["no tsconfig.json"]);
      const parsed = tsconfigIn(tsconfig);
      if (!parsed) return drifted(["tsconfig.json can't be parsed"]);
      const drift = Object.keys(parsed)
        .filter((key) => !["compilerOptions", "include"].includes(key))
        .map((key) => `tsconfig.json sets ${key}`);
      const own = parsed.compilerOptions ?? {};
      for (const [key, want] of Object.entries(OPTIONS)) {
        if (JSON.stringify(own[key]) !== JSON.stringify(want)) {
          drift.push(
            `compilerOptions.${key} is ${JSON.stringify(own[key])}, not ${JSON.stringify(want)}`,
          );
        }
      }
      for (const key of Object.keys(own).filter((key) => !(key in OPTIONS))) {
        drift.push(`compilerOptions sets ${key}, which the rules don't`);
      }
      return drifted(drift);
    },
    fix: {
      in: "files",
      apply: (dir) => {
        const path = join(dir, "tsconfig.json");
        const parsed = tsconfigIn(read(path));
        if (!parsed) return;
        writeJson(path, {
          compilerOptions: OPTIONS,
          ...(parsed.include ? { include: parsed.include } : {}),
        });
      },
    },
  },
  {
    id: "toolchain-lint",
    check: ({ files, vitePlus: own }) => {
      // Without Vite+ there's no lint block to read, and versions-vite-plus already says so.
      if (!own) return undefined;
      return drifted(unruled(files["vite.config.ts"] ?? "", { lint: RULED["lint"] }));
    },
    fix: { in: "files", apply: (dir) => rule(dir, { lint: RULED["lint"] }) },
  },
  {
    id: "toolchain-wrap",
    check: ({ files, vitePlus: own }) => {
      if (!own) return undefined;
      return drifted(unruled(files["vite.config.ts"] ?? "", { fmt: RULED["fmt"] }));
    },
    fix: { in: "files", apply: (dir) => rule(dir, { fmt: RULED["fmt"] }) },
  },
  {
    id: "toolchain-craftz",
    check: ({ pkg, files, deps, vitePlus: own }) => {
      if (!own) return undefined;
      const drift: string[] = [];
      if (!isCraftz(pkg) && !deps[CRAFTZ]) drift.push(`doesn't depend on ${CRAFTZ}`);
      if (usesCraftz(files["vite.config.ts"] ?? "")) drift.push("vite.config.ts calls craftz()");
      return drifted(drift);
    },
    fix: { in: "files", apply: (dir, std) => useCraftz(dir, std) },
  },
  {
    id: "toolchain-browsers",
    check: ({ pkg, files, worker: site }) => {
      const vite = files["vite.config.ts"] ?? "";
      const drift = siteDrift(vite, site);
      if (!pkg.private) {
        const pack = packFor(pkg, vite);
        drift.push(...unruled(vite, { pack }));
        if (!pack["target"] && at(exported(vite), ["pack", "target"])) {
          drift.push("pack.target is set, for a package that runs in Node");
        }
        if (pack["platform"] === "neutral" && !holdsNode(vite)) {
          drift.push(`${NEVER.join(".")} doesn't hold ${String(NODE)}`);
        }
      } else if (!site || site.directory === ".prose") return undefined;
      return { value: BROWSERS.join(" "), drift };
    },
    fix: {
      in: "files",
      apply: (dir) => {
        const pkg = readPkg(dir);
        const vite = existsSync(join(dir, "vite.config.ts"))
          ? read(join(dir, "vite.config.ts"))
          : "";
        if (!pkg.private) {
          const pack = packFor(pkg, vite);
          const never =
            pack["platform"] === "neutral" && !holdsNode(vite) ? withNode(vite) : undefined;
          rule(dir, { pack: never ? { ...pack, deps: { neverBundle: never } } : pack });
        }
        if (siteDrift(vite, workerIn(dir)).length) rule(dir, { build: { target: BROWSERS } });
      },
    },
  },
  owns("toolchain-editor", EDITOR),
  owns("toolchain-editor", EDITOR),
];
