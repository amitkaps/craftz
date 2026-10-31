/** @prose
 * # The versions
 *
 * The rules under [Versions](../../docs/rules.md#pnpm-and-node) and the shared tools: each
 * dependency a repository has is the reference's version, and a pre-release is only one the
 * rules name.
 */
import { CRAFTZ, VERSIONS, readPkg, standard, versionsIn } from "../reference.ts";
import { stated } from "../stated.ts";
import type { Rule } from "../rules.ts";
import { WORKSPACE, drifted, owns, pin, writePkg } from "./shared.ts";

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
 * The packages `versions-beta` names, as code in its line of the rules, so the list is kept
 * in one place. A version is a pre-release when its numbers are followed by a tag, as in
 * `1.0.0-beta.17`, behind a range or not.
 */
export const betas = (): string[] =>
  [
    ...(stated()
      .find((rule) => rule.id === "versions-beta")
      ?.text.matchAll(/`([^`]+)`/g) ?? []),
  ].flatMap((match) => match[1] ?? []);
export const PRERELEASE = /^[\^~<>=]*\d+\.\d+\.\d+-/;

export const node = standard.devEngines?.runtime;
export const vitePlus = VERSIONS["vite-plus"];

const pnpm = standard.packageManager?.replace(/^pnpm@/, "");

export const VERSION_RULES: Rule[] = [
  {
    id: "versions-node",
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
    id: "versions-pnpm",
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
  version("versions-types-node", "@types/node"),
  {
    id: "versions-vite-plus",
    holdable: true,
    check: ({ deps, vitePlus: own }) => {
      if (!own) return { drift: ["not on Vite+"] };
      const drift: string[] = [];
      if (own !== vitePlus) drift.push(`vite-plus is ${own}, not ${vitePlus}`);
      if (deps.vite) drift.push(`depends on vite ${deps.vite} directly`);
      return { value: own, drift };
    },
    // A repository not on Vite+ moves by hand. The override moves with it, in versions-workspace.
    fix: { in: "files", apply: (dir, std) => pin(dir, std, "vite-plus") },
  },
  version("versions-typescript", "typescript"),
  atLeast("versions-prose", "@amitkaps/prose"),
  atLeast("versions-markz", "@amitkaps/markz"),
  // No tool keeps a repository from craftz, so its version can't be held.
  version("versions-craftz", CRAFTZ, false),
  version("versions-cf", "cf"),
  {
    id: "versions-beta",
    check: ({ deps }) => {
      const pre = Object.entries(deps).filter(([, value]) => PRERELEASE.test(value));
      if (!pre.length) return undefined;
      return drifted(
        pre.flatMap(([name, value]) => {
          if (!betas().includes(name)) return [`${name} is on a pre-release, ${value}`];
          return /^\d/.test(value) ? [] : [`${name} is ${value}, not an exact build`];
        }),
      );
    },
  },
  version("versions-wrangler", "wrangler"),
  version("versions-publint", "publint"),
  version("versions-playwright", "@playwright/test"),
  owns("versions-workspace", [WORKSPACE]),
];
