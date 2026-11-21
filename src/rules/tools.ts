/** @prose
 * # The tools rules
 *
 * The rules under [Tools](../../docs/rules.md#tools): the `tsconfig.json` options, the `fmt` and
 * `lint` blocks, the browsers a package or a site targets, and the version of each dependency
 * a repository has. The helpers that read and write the configs are exported, since the releases'
 * and Cloudflare's rules read the same ones.
 *
 * A repository's own libraries are its own to choose. A tool every repository shares is the
 * reference's version, and a pre-release is only one the rules name.
 */
import { join } from "node:path";
import {
  CRAFTZ,
  type Pkg,
  here,
  read,
  readPkg,
  versionsIn,
  VERSIONS,
  standard,
} from "../reference.ts";
import { existsSync } from "node:fs";
import { at, exported, jsonc, literal, valueAt } from "../config.ts";
import { type Worker, workerIn } from "../worker.ts";
import { unlike, withValues } from "../edit.ts";
import { type Config, PLAYWRIGHT, RULED, written } from "../ruled.ts";
import { BROWSERS, COMPATIBILITY_DATE } from "../pinned.ts";
import type { Rule } from "../rules.ts";
import {
  EDITOR,
  type Json,
  drifted,
  editFile,
  owns,
  writeJson,
  writePkg,
  WORKSPACE,
  heldIn,
  pin,
} from "./shared.ts";
import { stated } from "../stated.ts";

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

export const TOOLCHAIN_RULES: Rule[] = [
  {
    id: "tools-tsconfig",
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
        const text = read(path);
        // A missing or empty file starts from the rules' options, and one that can't be read is
        // left to fix by hand.
        const parsed = text.trim() ? tsconfigIn(text) : {};
        if (!parsed) return;
        writeJson(path, {
          compilerOptions: OPTIONS,
          ...(parsed.include ? { include: parsed.include } : {}),
        });
      },
    },
  },
  {
    id: "tools-lint",
    check: ({ files, vitePlus: own }) => {
      // Without Vite+ there's no lint block to read, and tools-vite-plus already says so.
      if (!own) return undefined;
      return drifted(unruled(files["vite.config.ts"] ?? "", { lint: RULED["lint"] }));
    },
    fix: { in: "files", apply: (dir) => rule(dir, { lint: RULED["lint"] }) },
  },
  {
    id: "tools-fmt",
    check: ({ files, vitePlus: own }) => {
      if (!own) return undefined;
      return drifted(unruled(files["vite.config.ts"] ?? "", { fmt: RULED["fmt"] }));
    },
    fix: { in: "files", apply: (dir) => rule(dir, { fmt: RULED["fmt"] }) },
  },
  {
    id: "tools-playwright-config",
    check: ({ files }) => {
      const config = files["playwright.config.ts"];
      return config ? drifted(unruled(config, PLAYWRIGHT)) : undefined;
    },
    fix: {
      in: "files",
      apply: (dir) => {
        if (!existsSync(join(dir, "playwright.config.ts"))) return;
        editFile(join(dir, "playwright.config.ts"), (text) => withValues(text, PLAYWRIGHT));
      },
    },
  },
  {
    id: "tools-browsers",
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
  owns("tools-editor", EDITOR),
];

/** @prose
 * # A shared version
 *
 * A tool every repository writes as this one does, checked where a repository has it.
 */
export const version = (id: string, name: string, holdable = true): Rule => ({
  id,
  holdable,
  check: ({ deps }) => {
    const value = deps[name];
    if (!value) return undefined;
    const want = VERSIONS[name];
    return { value, drift: value === want ? [] : [`${name} is ${value}, not ${want}`] };
  },
  fix: { in: "files", apply: (dir, std) => pin(dir, std, name) },
});

/** @prose
 * # A packed candidate
 *
 * `pnpm align --candidate` installs craftz from a tarball, whose version is a path and not craftz's
 * own, so it sets `CRAFTZ_PACKED` and the rule that names craftz's version reads nothing. A step
 * of a candidate that fails then fails for something else, and says so.
 */
const packed = (rule: Rule): Rule => ({
  ...rule,
  check: (context) => (process.env.CRAFTZ_PACKED ? undefined : rule.check(context)),
});

/** @prose
 * # Our own version
 *
 * A package of ours that another builds on, checked as at least the reference's, so the one
 * that builds on it can move before craftz does. Its fix raises a version that's behind and
 * leaves one that leads, since every fix runs whether its rule drifted or not.
 */
export const atLeast = (id: string, name: string): Rule => ({
  id,
  holdable: true,
  check: ({ deps }) => {
    const value = deps[name];
    if (!value) return undefined;
    const want = VERSIONS[name] ?? "";
    if (!EXACT.test(value)) return { value, drift: [`${name} is ${value}, not an exact version`] };
    return { value, drift: behind(value, want) ? [`${name} is ${value}, behind ${want}`] : [] };
  },
  fix: {
    in: "files",
    apply: (dir, std) => {
      const pkg = readPkg(dir);
      const value = pkg.devDependencies?.[name] ?? pkg.dependencies?.[name];
      const want = versionsIn(std)[name];
      if (value && want && (!EXACT.test(value) || behind(value, want))) pin(dir, std, name);
    },
  },
});
export const EXACT = /^\d+\.\d+\.\d+$/;
export const behind = (value: string, want: string) =>
  value.localeCompare(want, "en", { numeric: true }) < 0;

/** @prose
 * # The betas
 *
 * The packages `tools-beta` names, as code in its line of the rules, so the list is kept
 * in one place. A version is a pre-release when its numbers are followed by a tag, as in
 * `1.0.0-beta.17`, behind a range or not.
 */
export const betas = (): string[] =>
  [
    ...(stated()
      .find((rule) => rule.id === "tools-beta")
      ?.text.matchAll(/`([^`]+)`/g) ?? []),
  ].flatMap((match) => match[1] ?? []);
export const PRERELEASE = /^[\^~<>=]*\d+\.\d+\.\d+-/;

export const node = standard.devEngines?.runtime;
export const vitePlus = VERSIONS["vite-plus"];

const pnpm = standard.packageManager?.replace(/^pnpm@/, "");

export const VERSION_RULES: Rule[] = [
  {
    id: "tools-node",
    holdable: true,
    check: ({ pkg }) => {
      const runtime = pkg.devEngines?.runtime;
      const drift: string[] = [];
      if (runtime?.version !== node?.version) {
        drift.push(`devEngines asks for Node ${runtime?.version}, not ${node?.version}`);
      }
      if (runtime?.onFail !== node?.onFail) {
        drift.push(`devEngines Node onFail is ${runtime?.onFail}, not ${node?.onFail}`);
      }
      if (pkg.engines?.node !== standard.engines?.node) {
        drift.push(`engines asks for Node ${pkg.engines?.node}, not ${standard.engines?.node}`);
      }
      return { value: runtime?.version, drift };
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const want = readPkg(std);
        const pkg = readPkg(dir);
        pkg.devEngines = { ...pkg.devEngines, runtime: want.devEngines?.runtime };
        pkg.engines = { ...pkg.engines, node: want.engines?.node };
        writePkg(dir, pkg);
      },
    },
  },
  {
    id: "tools-pnpm",
    holdable: true,
    check: ({ pkg }) => {
      const drift: string[] = [];
      if (pkg.packageManager !== `pnpm@${pnpm}`) {
        drift.push(`packageManager is ${pkg.packageManager}, not pnpm@${pnpm}`);
      }
      const engine = pkg.devEngines?.packageManager;
      if (engine?.version !== pnpm) {
        drift.push(`devEngines pins pnpm ${engine?.version}, not ${pnpm}`);
      }
      if (engine?.onFail !== "download") {
        drift.push(`devEngines pnpm onFail is ${engine?.onFail}, not download`);
      }
      return { value: pkg.packageManager?.replace(/^pnpm@/, ""), drift };
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const want = readPkg(std);
        const pkg = readPkg(dir);
        pkg.packageManager = want.packageManager;
        pkg.devEngines = { ...pkg.devEngines, packageManager: want.devEngines?.packageManager };
        writePkg(dir, pkg);
      },
    },
  },
  version("tools-types-node", "@types/node"),
  {
    id: "tools-vite-plus",
    holdable: true,
    check: ({ pkg, deps, vitePlus: own }) => {
      if (!own) return { drift: ["not on Vite+"] };
      const drift: string[] = [];
      if (own !== vitePlus) drift.push(`vite-plus is ${own}, not ${vitePlus}`);
      const peer = pkg.peerDependencies?.["vite-plus"];
      if (peer && peer !== `^${vitePlus}`) {
        drift.push(`the peer vite-plus is ${peer}, not ^${vitePlus}`);
      }
      if (deps.vite) drift.push(`depends on vite ${deps.vite} directly`);
      return { value: own, drift };
    },
    // A repository not on Vite+ moves by hand.
    fix: {
      in: "files",
      apply: (dir, std) => {
        pin(dir, std, "vite-plus");
        const pkg = readPkg(dir);
        if (!pkg.peerDependencies?.["vite-plus"]) return;
        pkg.peerDependencies["vite-plus"] = `^${versionsIn(std)["vite-plus"]}`;
        writePkg(dir, pkg);
      },
    },
  },
  version("tools-typescript", "typescript"),
  atLeast("tools-prose", "@amitkaps/prose"),
  atLeast("tools-markz", "@amitkaps/markz"),
  // No tool keeps a repository from craftz, so its version can't be held.
  packed(version("tools-craftz", CRAFTZ, false)),
  version("tools-cf", "cf"),
  {
    id: "tools-beta",
    check: ({ deps, files }) => {
      const pre = Object.entries(deps).filter(([, value]) => PRERELEASE.test(value));
      if (!pre.length) return undefined;
      // A library the repository ignores in pnpm's settings, with its reason, may be on a
      // pre-release. `tools-ignored` holds it to an exact version.
      const text = files[WORKSPACE];
      const ignored = (text ? heldIn(text).held : []).filter((it) => it.reason);
      return drifted(
        pre.flatMap(([name, value]) => {
          const allowed = betas().includes(name) || ignored.some((it) => it.name === name);
          if (!allowed) return [`${name} is on a pre-release, ${value}`];
          return /^\d/.test(value) ? [] : [`${name} is ${value}, not an exact build`];
        }),
      );
    },
  },
  version("tools-wrangler", "wrangler"),
  version("tools-publint", "publint"),
  version("tools-playwright", "@playwright/test"),
  owns("tools-workspace", [WORKSPACE]),
  {
    id: "tools-ignored",
    check: ({ files, deps }) => {
      const text = files[WORKSPACE];
      if (!text) return undefined;
      const { held, odd } = heldIn(text);
      if (!held.length && !odd.length) return undefined;
      return drifted([
        ...odd.map(
          (line) => `${WORKSPACE} has "${line}", which isn't in an ignoreDependencies list`,
        ),
        ...held.flatMap(({ name, reason }) => [
          ...(deps[name] ? [] : [`${name} is ignored, but isn't a dependency`]),
          ...(name in VERSIONS ? [`${name} is a tool craftz moves, so hold its rule instead`] : []),
          ...(reason ? [] : [`${name} is ignored with no reason above it`]),
          ...(/^[\^~]/.test(deps[name] ?? "")
            ? [`${name} is ${deps[name]}, which lets a fresh install take a newer release`]
            : []),
        ]),
      ]);
    },
  },
];
