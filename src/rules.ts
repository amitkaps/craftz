/** @prose
 * # The rules
 *
 * Each rule in [the rules](../docs/rules.md) that has an id, like `scripts-verify`. The doc
 * states it, as a list item that opens with its id, and says why. Here is only what the words
 * can't do: the check that finds where a repository has drifted from it, and the fix, where one
 * can be automated.
 *
 * It's how markz's grammar names its side rules, and [rules.test.ts](../tests/rules.test.ts)
 * holds the two to the same ids, so a rule can't be stated without a check, or checked without
 * being stated.
 *
 * A check returns `undefined` when its rule doesn't apply, like `scripts-preview` for a package.
 * A fix in `files` edits a clone to match [the reference](../reference/), and `pnpm align` puts it in the
 * repository's pull request. It changes nothing in a clone already in line, so it's safe to run
 * on every one. A fix in `github` is written directly, since there's no file to review. A rule
 * with no fix is fixed by hand, as the rules say.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  CRAFTZ,
  OWNER,
  type Pkg,
  VERSIONS,
  here,
  origin,
  read,
  standard,
  versionsIn,
} from "./reference.ts";
import {
  CI,
  DATE,
  EXCLUDE,
  PLUGIN,
  concurrency,
  servingProse,
  withAddressesOff,
  withCooldown,
  withCraftz,
  withDate,
  withOverride,
  withoutLabel,
} from "./edit.ts";
import { rulesetFor, writeLabels, writeRuleset } from "./settings.ts";
import { BROWSERS, COMPATIBILITY_DATE } from "./pinned.ts";
import { stated } from "./stated.ts";
import type { BranchRule, Finding, Repo } from "./survey.ts";
import { type Worker, workerIn } from "./worker.ts";

export type Fix =
  | { in: "files"; apply: (dir: string, std: string) => void }
  | { in: "github"; apply: (repo: string, pkg: Pkg) => void };

/** @prose
 * # A rule
 *
 * A rule a tool can keep a repository from, like a tool's version or the deploy, is `holdable`.
 * A repository can hold only those, as the rules' [Holds](../docs/rules.md#holds) say.
 */
export type Rule = {
  id: string;
  check: (repo: Repo) => Finding | undefined;
  fix?: Fix;
  holdable?: boolean;
};

const pnpm = standard.packageManager?.replace(/^pnpm@/, "");
const standardScripts = standard.scripts ?? {};

/** The shared script names, in the order the rules list them. */
export const SHARED = [
  "dev",
  "build",
  "preview",
  "check",
  "fix",
  "test",
  "verify",
  "ship",
  "prose",
  "pr",
  "gone",
];
const BUILT = ["dev", "build"];
const REQUIRED = ["check", "fix", "verify", "prose"];
const PNPM_COMMANDS = ["deploy", "publish", "audit", "ci", "pipeline", "pack"];

// Each rule in the file has to be there, with the parameters the file sets. Other parameters,
// and rules the file doesn't name, are the repository's own.
function rulesDrift(found: BranchRule[], pkg: Pkg): string[] {
  if (!found.length) return ["main has no branch rules"];
  const drift: string[] = [];
  for (const want of rulesetFor(pkg).rules) {
    const name = want.type.replaceAll("_", " ");
    const have = found.find((rule) => rule.type === want.type);
    if (!have) {
      drift.push(`no ${name} rule`);
      continue;
    }
    for (const [key, value] of Object.entries(want.parameters ?? {})) {
      const got = JSON.stringify(have.parameters?.[key]);
      if (got !== JSON.stringify(value)) {
        drift.push(`${name}: ${key} is ${got}, not ${JSON.stringify(value)}`);
      }
    }
  }
  return drift;
}

const drifted = (drift: string[]): Finding => ({ drift });

// Whether `craftz()` fills in `build.target`, as it does for a static site. Its src/index.ts
// says why.
const filled = (vite: string, site?: Worker): boolean =>
  PLUGIN.test(vite) && site?.deploys === "static";

// What GitHub couldn't answer. Its rate limit isn't drift: the check says it wasn't made.
export function unread(error: Error): Finding {
  if (error.name === "RateLimit") return { drift: [], unchecked: error.message };
  return drifted([`GitHub couldn't be read: ${error.message}`]);
}

const readPkg = (dir: string): Pkg =>
  JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Pkg;
// A JSON file is written only when its value changes, so one the formatter laid out stays as it
// is, and a second fix changes nothing.
function writeJson(path: string, value: unknown): void {
  const text = JSON.stringify(value, null, 2);
  try {
    if (JSON.stringify(JSON.parse(readFileSync(path, "utf8")), null, 2) === text) return;
  } catch {}
  writeFileSync(path, `${text}\n`);
}
const writePkg = (dir: string, pkg: Pkg): void => writeJson(join(dir, "package.json"), pkg);

// Sets a dependency to the rules' version, in whichever list the repository has it.
function pin(dir: string, std: string, name: string): void {
  const want = versionsIn(std)[name];
  const pkg = readPkg(dir);
  if (!want) return;
  for (const field of ["dependencies", "devDependencies"] as const) {
    const deps = pkg[field];
    if (deps?.[name]) deps[name] = want;
  }
  writePkg(dir, pkg);
}

// craftz in the dev dependencies, and `craftz()` in the Vite config, as edit.ts says.
function useCraftz(dir: string, std: string): void {
  const pkg = readPkg(dir);
  if (ownCraftz(pkg)) return;
  const want = versionsIn(std)[CRAFTZ];
  if (want && !pkg.dependencies?.[CRAFTZ] && !pkg.devDependencies?.[CRAFTZ]) {
    const deps = { ...pkg.devDependencies, [CRAFTZ]: want };
    pkg.devDependencies = Object.fromEntries(
      Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
    );
    writePkg(dir, pkg);
  }
  editFile(join(dir, "vite.config.ts"), withCraftz);
}

/** @prose
 * # A shared version
 *
 * A tool every repository writes as this one does, checked where a repository has it.
 */
const version = (id: string, name: string, holdable = true): Rule => ({
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
 * # The betas
 *
 * The packages `versions-beta` names, as code in its line of the rules, so the list is kept
 * in one place. A version is a pre-release when its numbers are followed by a tag, as in
 * `1.0.0-beta.17`, behind a range or not.
 */
export const BETA = [
  ...(stated()
    .find((rule) => rule.id === "versions-beta")
    ?.text.matchAll(/`([^`]+)`/g) ?? []),
].flatMap((match) => match[1] ?? []);
const PRERELEASE = /^[\^~<>=]*\d+\.\d+\.\d+-/;

const node = standard.devEngines?.runtime;
const vitePlus = VERSIONS["vite-plus"];

/** @prose
 * # The toolchain
 *
 * A repository's `tsconfig.json` extends the one craftz ships, [tsconfig.base.json](../tsconfig.base.json),
 * and says only what to include, so every option is craftz's. It's parsed, with the comments and
 * trailing commas a tsconfig allows taken out. The fix keeps `include` and writes the rest, so a
 * repository's own options and comments go.
 *
 * The lint block is found by a regular expression, since `vite.config.ts` is code, and has no fix.
 *
 * The editor settings are compared one key at a time, and only this repository's keys, since a
 * repository can add its own, like base's for Svelte. Its fix merges this repository's over the
 * repository's own, so an added setting stays.
 */
const TSCONFIG = `${CRAFTZ}/tsconfig.json`;

// A tsconfig without its comments and trailing commas. Strings are kept whole.
const uncommented = (text: string): string =>
  text
    .replace(
      /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
      (_, string?: string) => string ?? "",
    )
    .replace(
      /("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g,
      (_, string?: string, close?: string) => string ?? close ?? "",
    );

type Tsconfig = { extends?: unknown; include?: unknown } & Json;

function tsconfigIn(text: string): Tsconfig | undefined {
  try {
    return JSON.parse(uncommented(text)) as Tsconfig;
  } catch {
    return undefined;
  }
}

const EDITOR = [".vscode/settings.json", ".vscode/extensions.json"];

/** @prose
 * # The browsers
 *
 * The list comes from [browsers.ts](browsers.ts). A build bundles for browsers when it's a
 * package whose pack isn't `platform: "node"`, or a site that isn't a prose site, which is an
 * app. Each target in the config is read, the app's `build.target` or the package's
 * `pack.target`, and the browsers in it have to be the list, with any Node left out.
 */
const TARGET = /\btarget:\s*\[([^\]]*)\]/g;
const targetsIn = (vite: string): string[] =>
  [...vite.matchAll(TARGET)]
    .flatMap((m) => [...(m[1] ?? "").matchAll(/"([^"]+)"/g)])
    .map((m) => m[1] ?? "")
    .filter((target) => !target.startsWith("node"));

// Writes a file's edit, where the file exists and the edit changes it.
function editFile(file: string, edit: (text: string) => string): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  const edited = edit(text);
  if (edited !== text) writeFileSync(file, edited);
}

const NODE_FLAG = /compatibilityFlags:[^\]]*"nodejs_/;

type Json = Record<string, unknown>;
const readJson = (file: string): Json => JSON.parse(readFileSync(file, "utf8")) as Json;
const editor = Object.fromEntries(EDITOR.map((file) => [file, readJson(join(here, file))]));
const recommended = (json: Json): string[] =>
  Array.isArray(json.recommendations) ? (json.recommendations as string[]) : [];

/** @prose
 * # The cooldown
 *
 * pnpm's one-day wait is its default, so a repository keeps it by not setting
 * `minimumReleaseAge`. The fix removes that line and writes this repository's exclusions.
 */

/** @prose
 * # The actions
 *
 * The versions are read from this repository's CI and a package's release workflow. Only the
 * versions are compared, since a repository can add steps of its own, like sitez installing its
 * packed tarball. The fix rewrites each `uses:` line to this repository's version, and removes a
 * `dependabot.yml`, since versions move here first.
 */
const WORKFLOWS = [".github/workflows/ci.yml", ".github/workflows/release.yml"];
const USES = /(uses:\s*)([^@\s]+)@(\S+)/g;
const actionVersions = (text: string): [string, string][] =>
  [...text.matchAll(USES)].map((m) => [m[2] ?? "", m[3] ?? ""]);
const ACTIONS = Object.fromEntries(
  actionVersions(
    read(join(here, WORKFLOWS[0] ?? "")) + read(join(here, "package", WORKFLOWS[1] ?? "")),
  ),
);

/** @prose
 * # The agents' instructions
 *
 * A section runs from its `## ` heading to the next. The fix writes this repository's two
 * sections over a repository's own, or puts them before its first section when they're
 * missing, and leaves the rest of the file alone.
 *
 * The craftz section was called Standard before craftz. The fix renames a repository's Standard
 * section to craftz, so the old section doesn't stay beside the new one.
 */
const SECTIONS = ["craftz", "Prose"];
const sectionOf = (heading: string): RegExp =>
  new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m");
const section = (text: string, heading: string): string | undefined =>
  sectionOf(heading).exec(text)?.[1]?.trim();
const agents = read(join(here, "AGENTS.md"));

/** @prose
 * # The docs
 *
 * Only the files are checked, and that each is in the `nav` of `docs/README.md`, not what's in
 * them. The fix writes a first version of each one that's missing, and adds it to the `nav`.
 *
 * That first version says what goes in each section rather than leaving it empty. A doc already there is left
 * alone, since it's written, not copied. `pnpm new` starts every doc this way. A README that
 * doesn't link to `docs/` is fixed by hand.
 */
export type Shape = { package: boolean; site: boolean };

// What a folder publishes and deploys: a package unless it's private, a site if it has a
// Worker's config, either, both or neither.
function shapeOf(dir: string, pkg: Pkg): Shape {
  const site = ["cloudflare.config.ts", "wrangler.jsonc", "wrangler.toml"];
  return { package: !pkg.private, site: site.some((file) => existsSync(join(dir, file))) };
}

// Words as a list in a sentence, like "build, test, release and deploy".
export const listed = (words: string[]): string =>
  words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : (words[0] ?? "");

// What a shape adds to a list, like "release" and "deploy".
export const shipping = (shape: Shape, release: string, deploy: string): string[] => [
  ...(shape.package ? [release] : []),
  ...(shape.site ? [deploy] : []),
];

function firstDocs(name: string, shape: Shape, description: string): Record<string, string> {
  const built = shape.package || shape.site;
  const rules = "https://craftz.amitkaps.com/docs/rules.md";
  type Page = [file: string, title: string, what: string];
  const usage: Page = ["usage.md", "Usage", "install it, use it, and the snippet for agents."];
  const pages: Page[] = [
    ["design.md", "Design", "what it is, why it's built this way, and what it isn't."],
    ...(shape.package ? [usage] : []),
    ["plan.md", "Plan", "what's next, in order, and what works now."],
    ["lessons.md", "Lessons", "what building it taught, for the next change."],
    [
      "development.md",
      "Development",
      `${listed([...(built ? ["build"] : ["check"]), "test", ...shipping(shape, "release", "deploy")])} it.`,
    ],
  ];
  const files: Record<string, string> = {
    "docs/README.md": `---
nav: [${pages.map(([file]) => file).join(", ")}]
---

# Docs

The writing that spans the code, in reading order.

${pages.map(([file, title, what], i) => `${i + 1}. [${title}](${file}): ${what}`).join("\n")}
`,
    "docs/design.md": `# Design

## What it is

${description}

## Why

Why it's built this way, and the choices that follow from that.

## What it isn't

What it leaves out on purpose, so nobody adds it back.
`,
    "docs/plan.md": `# Plan

What's next, in order, and what works now.

## Next, in order

1. The first thing ${name} does.

## Where it is

- **Started.** It follows [craftz's rules](${rules}).

## Later

## Open questions
`,
    "docs/lessons.md": `# Lessons

What building ${name} taught, for whoever changes it next. Each lesson says what happened and what to do about it.
`,
    "docs/development.md": `# Development

How ${name} is built and changed. What every repository shares, like ${listed([
      "the scripts",
      "CI",
      ...shipping(shape, "releases", "deploys"),
    ])}, is in [craftz's rules](${rules}), and isn't repeated here.

## Build and test

\`\`\`sh
pnpm install${built ? "\npnpm dev" : ""}
pnpm verify    # what CI runs
\`\`\`
`,
  };
  if (shape.package) {
    files["docs/usage.md"] = `# Usage

## Install

\`\`\`sh
pnpm add @${OWNER}/${name}
\`\`\`

It needs Node 26 or newer, the Node it's built and tested on.

## Use

\`\`\`ts
import { hello } from "@${OWNER}/${name}";

hello("world"); // "Hello, world."
\`\`\`

## For agents

What an agent using ${name} should know, as a snippet to copy into its instructions.
`;
  }
  return files;
}

const DOCS = ["design.md", "plan.md", "development.md", "lessons.md"];

/** @prose
 * # The old name
 *
 * The old repository kept the rules as its standard before craftz did, and a repository that
 * moved can still link its site or say "ship's standard".
 *
 * The check reads the files the survey reads, and
 * the fix every Markdown file at the top and in `docs/`, and the Vite config. The headings
 * those links named, like `#releases`, are craftz's too, so a link keeps its place. What only
 * reads like the old name, such as "the standard", is left to do by hand.
 */
const nav = (text: string): string[] =>
  (/^nav:\s*\[([^\]]*)\]/m.exec(text)?.[1] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

/** @prose
 * # Releases
 *
 * A package releases the way every package does, with the files in [package/](../reference/package/README.md)
 * copied in unchanged: the release workflow, the notes' config, and the `label` workflow that
 * checks a pull request has one. CI's `concurrency` is this repository's, word for word.
 *
 * CI had the label check as a step, and ran again when a label changed, so a pull request opened
 * with its label ran `verify` twice. The fix copies the files and takes the step, its triggers
 * and the old `concurrency` out of CI, as [edit.ts](edit.ts) says. One laid out otherwise is
 * left to do by hand, and the check still says so.
 */
const RELEASE_FILES = [
  ".github/workflows/release.yml",
  ".github/workflows/label.yml",
  ".github/release.yml",
];
const labelNames = (
  JSON.parse(read(join(here, ".github", "labels.json"))) as { name: string }[]
).map((label) => label.name);

// Sets a script to the rules', in a repository the rule applies to.
function setScript(dir: string, std: string, name: string, applies: (pkg: Pkg) => boolean): void {
  const pkg = readPkg(dir);
  const want = readPkg(std).scripts?.[name];
  if (!want || !applies(pkg)) return;
  pkg.scripts = { ...pkg.scripts, [name]: want };
  writePkg(dir, pkg);
}
// What every verify runs, as whole steps between `&&`.
const VERIFIED = ["pnpm prose check", "pnpm craftz check"];
const runs = (verify: string, step: string): boolean =>
  verify.split("&&").some((it) => it.trim() === step);

const onVitePlus = (pkg: Pkg): boolean =>
  Boolean(pkg.dependencies?.["vite-plus"] ?? pkg.devDependencies?.["vite-plus"]);

/** @prose
 * # A shared command
 *
 * `pnpm pr` and `pnpm gone` run craftz's commands, so every repository takes the same steps from
 * the version it installs, and `pnpm craftz` runs any of them, as `pnpm prose` runs prose.
 * craftz's own repository runs them from source.
 *
 * `pr` and `gone` were once files each repository copied into `scripts/`, so the fix deletes
 * those copies, and the folder too when nothing of the repository's own is left in it.
 */
const COMMAND_SCRIPTS = ["pr", "gone"];
const ownCraftz = (pkg: Pkg): boolean => pkg.name === CRAFTZ;

function leaveScripts(dir: string): void {
  const folder = join(dir, "scripts");
  for (const name of COMMAND_SCRIPTS) rmSync(join(folder, `${name}.ts`), { force: true });
  if (!existsSync(folder)) return;
  const left = readdirSync(folder);
  const readme = join(folder, "README.md");
  const copied = existsSync(readme) && readFileSync(readme, "utf8").includes("[pr.ts](pr.ts)");
  if (!left.length || (left.length === 1 && copied)) rmSync(folder, { recursive: true });
}

const commandScript = (id: string, name: string): Rule => ({
  id,
  check: ({ pkg, files }) => {
    const drift: string[] = [];
    const own = name === "craftz" ? "node src/cli.ts" : `node src/cli.ts ${name}`;
    const want = ownCraftz(pkg) ? own : standardScripts[name];
    const script = pkg.scripts?.[name];
    if (script !== want)
      drift.push(script ? `${name} is ${script}, not ${want}` : `no ${name} script`);
    const file = `scripts/${name}.ts`;
    if (COMMAND_SCRIPTS.includes(name) && files[file]) {
      drift.push(`has ${file}, which craftz ${name} replaces`);
    }
    return drifted(drift);
  },
  fix: {
    in: "files",
    apply: (dir, std) => {
      leaveScripts(dir);
      setScript(dir, std, name, (pkg) => !ownCraftz(pkg));
    },
  },
});

export const RULES: Rule[] = [
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
    check: ({ files, deps, vitePlus: own }) => {
      if (!own) return { drift: ["not on Vite+"] };
      const drift: string[] = [];
      if (own !== vitePlus) drift.push(`vite-plus is ${own}, not ${vitePlus}`);
      const override = /vite-plus-core@([\w.-]+)/.exec(files["pnpm-workspace.yaml"] ?? "")?.[1];
      if (!override) drift.push("pnpm-workspace.yaml has no vite override");
      else if (override !== vitePlus) {
        drift.push(`pnpm-workspace.yaml points vite at ${override}, not ${vitePlus}`);
      }
      if (deps.vite) drift.push(`depends on vite ${deps.vite} directly`);
      return { value: own, drift };
    },
    // Moves vite-plus and the override together. A repository not on Vite+ moves by hand.
    fix: {
      in: "files",
      apply: (dir, std) => {
        pin(dir, std, "vite-plus");
        const want = versionsIn(std)["vite-plus"];
        if (want) editFile(join(dir, "pnpm-workspace.yaml"), (text) => withOverride(text, want));
      },
    },
  },
  version("versions-typescript", "typescript"),
  version("versions-prose", "@amitkaps/prose"),
  version("versions-markz", "@amitkaps/markz"),
  // No tool keeps a repository from craftz, so its version can't be held.
  version("versions-craftz", CRAFTZ, false),
  version("versions-cf", "cf"),
  version("versions-cf-vite-plugin", "@cloudflare/vite-plugin"),
  {
    id: "versions-beta",
    check: ({ deps }) => {
      const pre = Object.entries(deps).filter(([, value]) => PRERELEASE.test(value));
      if (!pre.length) return undefined;
      return drifted(
        pre.flatMap(([name, value]) => {
          if (!BETA.includes(name)) return [`${name} is on a pre-release, ${value}`];
          return /^\d/.test(value) ? [] : [`${name} is ${value}, not an exact build`];
        }),
      );
    },
  },
  version("versions-wrangler", "wrangler"),
  version("versions-publint", "publint"),
  {
    id: "versions-cooldown",
    check: ({ files }) => {
      const workspace = files["pnpm-workspace.yaml"] ?? "";
      const drift: string[] = [];
      const age = /^minimumReleaseAge:\s*(\S+)/m.exec(workspace)?.[1];
      if (age) drift.push(`sets minimumReleaseAge to ${age}, not pnpm's default`);
      const exclude = EXCLUDE.exec(workspace)?.[0] ?? "";
      const names = [...exclude.matchAll(/-\s*"?([^"\n]+)"?/g)].map((m) => m[1]?.trim());
      if (!names.includes("@amitkaps/*")) drift.push("doesn't exclude @amitkaps/*");
      for (const name of names.filter((n) => n !== "@amitkaps/*")) {
        drift.push(`excludes ${name}`);
      }
      return drifted(drift);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const ours = read(join(std, "pnpm-workspace.yaml"));
        editFile(join(dir, "pnpm-workspace.yaml"), (text) => withCooldown(text, ours));
      },
    },
  },
  {
    id: "toolchain-types",
    holdable: true,
    check: ({ files }) => {
      const tsconfig = files["tsconfig.json"];
      if (!tsconfig) return drifted(["no tsconfig.json"]);
      const parsed = tsconfigIn(tsconfig);
      if (!parsed) return drifted(["tsconfig.json can't be parsed"]);
      const drift = parsed.extends === TSCONFIG ? [] : [`tsconfig.json doesn't extend ${TSCONFIG}`];
      for (const key of Object.keys(parsed).filter((k) => !["extends", "include"].includes(k))) {
        drift.push(`tsconfig.json sets ${key}, which is ${TSCONFIG}'s`);
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
          extends: TSCONFIG,
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
      const vite = files["vite.config.ts"] ?? "";
      if (PLUGIN.test(vite)) return drifted([]);
      const drift: string[] = [];
      if (!/typeAware:\s*true/.test(vite)) drift.push("lint isn't type-aware");
      if (!/typeCheck:\s*true/.test(vite)) drift.push("lint doesn't type-check");
      return drifted(drift);
    },
  },
  {
    id: "toolchain-wrap",
    check: ({ files, vitePlus: own }) => {
      if (!own) return undefined;
      const vite = files["vite.config.ts"] ?? "";
      if (PLUGIN.test(vite)) return drifted([]);
      if (!/\bfmt:\s*\{/.test(vite)) return drifted(["no fmt block"]);
      return drifted(
        /proseWrap:\s*"never"/.test(vite) ? [] : ['fmt doesn\'t set proseWrap: "never"'],
      );
    },
    // A config without craftz() gets it from toolchain-craftz's fix, which sets this.
  },
  {
    id: "toolchain-craftz",
    check: ({ pkg, files, deps, vitePlus: own }) => {
      if (!own) return undefined;
      const drift: string[] = [];
      if (!ownCraftz(pkg) && !deps[CRAFTZ]) drift.push(`doesn't depend on ${CRAFTZ}`);
      if (!PLUGIN.test(files["vite.config.ts"] ?? "")) drift.push("vite.config.ts has no craftz()");
      return drifted(drift);
    },
    fix: { in: "files", apply: (dir, std) => useCraftz(dir, std) },
  },
  {
    id: "toolchain-browsers",
    check: ({ files, worker: site }) => {
      const vite = files["vite.config.ts"] ?? "";
      const pack = /\bpack:\s*\{/.test(vite) && !/platform:\s*"node"/.test(vite);
      // A site Vite bundles from source, unlike one that serves a folder `prose build` wrote.
      const bundled = Boolean(site) && !/publicDir:\s*"\.prose"/.test(vite);
      if (!pack && filled(vite, site)) return { value: BROWSERS.join(" "), drift: [] };
      if (!pack && !bundled) return undefined;
      const have = targetsIn(vite);
      const where = pack ? "pack.target" : "build.target";
      if (!have.length) return drifted([`${where} isn't set`]);
      const value = have.join(" ");
      const same = [...new Set(have)].sort().join(" ") === [...BROWSERS].sort().join(" ");
      return { value, drift: same ? [] : [`${where} is ${value}, not ${BROWSERS.join(" ")}`] };
    },
  },
  {
    id: "toolchain-editor",
    check: ({ files }) =>
      drifted(
        EDITOR.flatMap((file) => {
          const text = files[file];
          if (!text) return [`no ${file}`];
          let have: Json;
          try {
            have = JSON.parse(text) as Json;
          } catch {
            return [`${file} isn't plain JSON`];
          }
          const want = editor[file] ?? {};
          // One line says the file differs, since the fix writes this repository's keys at once.
          const same = file.endsWith("extensions.json")
            ? recommended(want).every((name) => recommended(have).includes(name))
            : Object.keys(want).every(
                (key) => JSON.stringify(have[key]) === JSON.stringify(want[key]),
              );
          return same ? [] : [`${file} differs from craftz's`];
        }),
      ),
    fix: {
      in: "files",
      apply: (dir, std) => {
        for (const file of EDITOR) {
          const ours = readJson(join(std, file));
          const path = join(dir, file);
          const theirs = existsSync(path) ? readJson(path) : {};
          const merged = file.endsWith("extensions.json")
            ? {
                ...theirs,
                recommendations: [...new Set([...recommended(ours), ...recommended(theirs)])],
              }
            : { ...theirs, ...ours };
          mkdirSync(dirname(path), { recursive: true });
          writeJson(path, merged);
        }
      },
    },
  },
  {
    id: "scripts-required",
    check: ({ pkg, worker: site }) => {
      const scripts = pkg.scripts ?? {};
      // A tool, private and with no site, has nothing to serve or build.
      const tool = pkg.private && !site;
      const required = [
        ...(tool ? [] : BUILT),
        ...REQUIRED,
        ...(site ? ["ship"] : []),
        ...(site && pkg.private ? ["preview"] : []),
      ];
      return drifted(required.filter((name) => !scripts[name]).map((name) => `no ${name} script`));
    },
  },
  {
    id: "scripts-check",
    check: ({ pkg, vitePlus }) => {
      const check = pkg.scripts?.check;
      if (!vitePlus || !check) return undefined;
      return drifted(/(^|&& )vp check( &&|$)/.test(check) ? [] : ["check doesn't run vp check"]);
    },
  },
  {
    id: "scripts-fix",
    check: ({ pkg, vitePlus }) => {
      const fix = pkg.scripts?.fix;
      if (!vitePlus || !fix) return undefined;
      return drifted(
        fix === standardScripts.fix ? [] : [`fix is ${fix}, not ${standardScripts.fix}`],
      );
    },
    fix: { in: "files", apply: (dir, std) => setScript(dir, std, "fix", onVitePlus) },
  },
  {
    id: "scripts-one-checker",
    check: ({ pkg, vitePlus }) => {
      if (!vitePlus) return undefined;
      return drifted(
        ["lint", "fmt"]
          .filter((name) => pkg.scripts?.[name])
          .map((name) => `has a ${name} script, which check and fix cover`),
      );
    },
  },
  {
    id: "scripts-verify",
    check: ({ pkg }) => {
      const verify = pkg.scripts?.verify;
      if (!verify) return undefined;
      return drifted(
        VERIFIED.filter((step) => !runs(verify, step)).map((step) => `verify doesn't run ${step}`),
      );
    },
    fix: {
      in: "files",
      // craftz check goes after prose check, and a verify without prose check is fixed by hand.
      apply: (dir) => {
        const pkg = readPkg(dir);
        const verify = pkg.scripts?.verify;
        if (!verify || runs(verify, "pnpm craftz check") || !runs(verify, "pnpm prose check")) {
          return;
        }
        const fixed = verify.replace(
          /(^|&& )pnpm prose check( &&|$)/,
          "$1pnpm prose check && pnpm craftz check$2",
        );
        pkg.scripts = { ...pkg.scripts, verify: fixed };
        writePkg(dir, pkg);
      },
    },
  },
  {
    id: "scripts-prose",
    check: ({ pkg }) => {
      const prose = pkg.scripts?.prose;
      // prose's own repository runs its command line from source.
      if (!prose || pkg.name === "@amitkaps/prose") return undefined;
      return drifted(prose === "prose" ? [] : [`prose is ${prose}, not prose`]);
    },
    fix: {
      in: "files",
      apply: (dir, std) => setScript(dir, std, "prose", (pkg) => pkg.name !== "@amitkaps/prose"),
    },
  },
  {
    id: "scripts-preview",
    check: ({ pkg }) => {
      const preview = pkg.scripts?.preview;
      if (!preview) return undefined;
      if (!pkg.private) return drifted(["has a preview script, which is a site's"]);
      return drifted(
        preview === standardScripts.preview
          ? []
          : [`preview is ${preview}, not ${standardScripts.preview}`],
      );
    },
  },
  {
    id: "scripts-pnpm-names",
    check: ({ pkg }) =>
      drifted(
        PNPM_COMMANDS.filter((name) => pkg.scripts?.[name]).map(
          (name) => `has a ${name} script, which pnpm ${name} never runs`,
        ),
      ),
  },
  commandScript("scripts-pr", "pr"),
  commandScript("scripts-gone", "gone"),
  commandScript("scripts-craftz", "craftz"),
  {
    id: "scripts-ship",
    check: ({ pkg, worker: site }) => {
      const ship = pkg.scripts?.ship;
      // A site without one is scripts-required's, and a folder with no site has nothing to ship.
      if (!site || !ship) return undefined;
      const want = ownCraftz(pkg) ? "node src/cli.ts deploy" : standardScripts.ship;
      return drifted(ship === want ? [] : [`ship is ${ship}, not ${want}`]);
    },
    fix: {
      in: "files",
      apply: (dir, std) => setScript(dir, std, "ship", (pkg) => !ownCraftz(pkg) && !!workerIn(dir)),
    },
  },
  {
    id: "cloudflare-config",
    holdable: true,
    check: ({ worker: site }) => {
      if (!site) return undefined;
      const drift =
        site.file === "cloudflare.config.ts" ? [] : [`still on wrangler (${site.file})`];
      return { value: site.file, drift };
    },
  },
  {
    id: "cloudflare-wrangler",
    check: ({ worker: site }) => {
      if (!site || site.file === "cloudflare.config.ts") return undefined;
      const drift = site.file === "wrangler.toml" ? [] : [`${site.file}, not wrangler.toml`];
      return { value: site.file, drift };
    },
  },
  /** @prose
   * # A prose site on cf
   *
   * A site is a prose site when cf deploys it and `verify` runs `pnpm prose build`.
   *
   * The Vite config is code, so it's read with regular expressions. Its fix names `.prose` on the
   * line after the plugins and adds the folders `.gitignore` leaves out. The rest is fixed by
   * hand. `build` after
   * `prose build` is `pnpm build` in a site, where it's `vp build`, and `vp build` in a
   * package, where `build` is `vp pack`.
   */
  {
    id: "cloudflare-prose-site",
    check: ({ files, pkg, worker: site }) => {
      const verify = pkg.scripts?.verify ?? "";
      if (site?.file !== "cloudflare.config.ts" || !/pnpm prose build/.test(verify)) {
        return undefined;
      }
      const vite = files["vite.config.ts"] ?? "";
      const drift: string[] = [];
      if (!/publicDir:\s*"\.prose"/.test(vite)) drift.push("vite.config.ts doesn't serve .prose");
      if (!/cloudflare\(\{\s*assetsOnly:\s*true\s*\}\)/.test(vite)) {
        drift.push("vite.config.ts doesn't use the Cloudflare plugin with assetsOnly");
      }
      const after = verify.slice(verify.indexOf("pnpm prose build"));
      const build = pkg.scripts?.build === "vp build" ? /&& (pnpm build|vp build)/ : /&& vp build/;
      if (!build.test(after)) drift.push("verify doesn't run vp build after pnpm prose build");
      for (const folder of [".cloudflare", ".wrangler"]) {
        if (!new RegExp(`^/?\\${folder}/?$`, "m").test(files[".gitignore"] ?? "")) {
          drift.push(`.gitignore doesn't ignore ${folder}`);
        }
      }
      return { value: "prose", drift };
    },
    fix: {
      in: "files",
      apply: (dir) => {
        editFile(join(dir, "vite.config.ts"), servingProse);
        const ignore = join(dir, ".gitignore");
        const ignored = read(ignore) ?? "";
        const missing = [".cloudflare", ".wrangler"].filter(
          (folder) => !new RegExp(`^/?\\${folder}/?$`, "m").test(ignored),
        );
        if (!missing.length) return;
        const end = ignored && !ignored.endsWith("\n") ? "\n" : "";
        writeFileSync(ignore, `${ignored}${end}${missing.join("\n")}\n`);
      },
    },
  },
  /** @prose
   * # A Worker's config
   *
   * `cloudflare.config.ts` is code, so it's read and fixed by its lines. The fixes anchor on the
   * lines the rules ask for: the date's own line, and the two addresses go after `domains`.
   * A config laid out otherwise is left alone, and its check still drifts.
   *
   * A site on wrangler, like base, is left out of both. It's held on wrangler, so it moves when
   * it moves to cf.
   */
  {
    id: "cloudflare-addresses",
    check: ({ worker: site }) => {
      if (site?.file !== "cloudflare.config.ts") return undefined;
      const drift: string[] = [];
      if (site.workersDev) drift.push(`${site.file} doesn't turn off workers.dev`);
      if (site.previewUrls) drift.push(`${site.file} doesn't turn off preview URLs`);
      return { value: "domain only", drift };
    },
    fix: {
      in: "files",
      apply: (dir) => editFile(join(dir, "cloudflare.config.ts"), withAddressesOff),
    },
  },
  {
    id: "cloudflare-date",
    check: ({ files, worker: site }) => {
      if (site?.file !== "cloudflare.config.ts") return undefined;
      const config = files[site.file] ?? "";
      const date = DATE.exec(config)?.[1];
      const drift: string[] = [];
      if (date !== COMPATIBILITY_DATE) {
        drift.push(`compatibilityDate is ${date ?? "unset"}, not ${COMPATIBILITY_DATE}`);
      }
      if (NODE_FLAG.test(config)) drift.push("sets a Node.js compatibility flag");
      return { value: date ?? "unset", drift };
    },
    fix: {
      in: "files",
      apply: (dir) =>
        editFile(join(dir, "cloudflare.config.ts"), (config) =>
          withDate(config, COMPATIBILITY_DATE),
        ),
    },
  },
  {
    id: "github-rules",
    check: ({ rules, pkg }) => {
      if (!rules) return undefined;
      return rules instanceof Error ? unread(rules) : drifted(rulesDrift(rules, pkg));
    },
    fix: { in: "github", apply: writeRuleset },
  },
  {
    id: "github-actions",
    check: ({ files }) => {
      const drift: string[] = [];
      for (const file of WORKFLOWS) {
        for (const [action, version] of actionVersions(files[file] ?? "")) {
          const want = ACTIONS[action];
          if (want && version !== want) drift.push(`${action} is ${version}, not ${want}`);
        }
      }
      if (files[".github/dependabot.yml"]) drift.push("has a dependabot.yml");
      return drifted([...new Set(drift)]);
    },
    fix: {
      in: "files",
      apply: (dir) => {
        for (const file of WORKFLOWS) {
          const path = join(dir, file);
          const text = read(path);
          if (!text) continue;
          writeFileSync(
            path,
            text.replace(USES, (line: string, uses: string, action: string) =>
              ACTIONS[action] ? `${uses}${action}@${ACTIONS[action]}` : line,
            ),
          );
        }
        rmSync(join(dir, ".github", "dependabot.yml"), { force: true });
      },
    },
  },
  {
    id: "agents-sections",
    check: ({ files }) => {
      const text = files["AGENTS.md"];
      if (!text) return drifted(["no AGENTS.md"]);
      const drift = SECTIONS.flatMap((heading) => {
        const have = section(text, heading);
        if (!have) return [`no ${heading} section`];
        return have === section(agents, heading)
          ? []
          : [`${heading} section differs from craftz's`];
      });
      if (files["CLAUDE.md"]?.trim() !== "@AGENTS.md") drift.push("CLAUDE.md isn't @AGENTS.md");
      return drifted(drift);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const ours = read(join(std, "AGENTS.md"));
        const path = join(dir, "AGENTS.md");
        let text = read(path) || "# AGENTS.md\n";
        if (!sectionOf("craftz").test(text)) text = text.replace(/^## Standard$/m, "## craftz");
        let after = -1;
        for (const heading of SECTIONS) {
          const want = sectionOf(heading).exec(ours)?.[0];
          if (!want) continue;
          const block = `${want.trimEnd()}\n\n`;
          const have = sectionOf(heading).exec(text);
          // A missing section goes after the one before it, or before the file's first section.
          const at = have?.index ?? (after >= 0 ? after : text.search(/^## /m));
          const end = have ? at + have[0].length : at;
          text =
            at < 0 ? `${text.trimEnd()}\n\n${block}` : text.slice(0, at) + block + text.slice(end);
          after = (at < 0 ? text.length - block.length : at) + block.length;
        }
        writeFileSync(path, `${text.trimEnd()}\n`);
        writeFileSync(join(dir, "CLAUDE.md"), "@AGENTS.md\n");
      },
    },
  },
  {
    id: "docs-files",
    check: ({ pkg, files }) => {
      const want = pkg.private ? DOCS : [...DOCS, "usage.md"];
      const index = files["docs/README.md"];
      const drift = want.filter((name) => !files[`docs/${name}`]).map((name) => `no docs/${name}`);
      if (!index) drift.push("no docs/README.md");
      else {
        const listed = nav(index);
        for (const name of want.filter((n) => files[`docs/${n}`] && !listed.includes(n))) {
          drift.push(`${name} isn't in the nav`);
        }
      }
      if (!/\]\(\.?\/?docs\//.test(files["README.md"] ?? "")) {
        drift.push("README.md doesn't link to docs/");
      }
      return drifted(drift);
    },
    fix: {
      in: "files",
      apply: (dir) => {
        const pkg = readPkg(dir);
        const name = (pkg.name ?? "").replace(/^@[^/]+\//, "");
        const first = firstDocs(name, shapeOf(dir, pkg), pkg.description ?? "");
        const index = join(dir, "docs", "README.md");
        const had = read(index);
        mkdirSync(join(dir, "docs"), { recursive: true });
        for (const [file, text] of Object.entries(first)) {
          if (!existsSync(join(dir, file))) writeFileSync(join(dir, file), text);
        }
        // An index that was there keeps its words, and gains the docs its nav was missing.
        const listed = nav(had);
        const missing = nav(first["docs/README.md"] ?? "").filter((n) => !listed.includes(n));
        if (had && missing.length && /^nav:\s*\[/m.test(had)) {
          const all = [...listed, ...missing].join(", ");
          writeFileSync(index, had.replace(/^nav:\s*\[[^\]]*\]/m, `nav: [${all}]`));
        }
      },
    },
  },
  {
    id: "releases-files",
    check: ({ pkg, files }) => {
      if (pkg.private) return undefined;
      const drift = RELEASE_FILES.flatMap((file) => {
        if (!files[file]) return [`no ${file}`];
        return files[file] === read(join(here, "package", file))
          ? []
          : [`${file} differs from craftz's`];
      });
      const ci = files[CI] ?? "";
      if (/^ {6}- name: Label$/m.test(ci))
        drift.push("ci.yml checks the label, which label.yml does");
      if (/^ {4}types: \[.*\blabeled\b/m.test(ci))
        drift.push("ci.yml runs again when a label changes");
      if (!ci.includes(concurrency)) drift.push("ci.yml's concurrency isn't craftz's");
      return drifted(drift);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        if (readPkg(dir).private) return;
        for (const file of RELEASE_FILES) {
          mkdirSync(dirname(join(dir, file)), { recursive: true });
          writeFileSync(join(dir, file), readFileSync(join(std, "package", file)));
        }
        editFile(join(dir, CI), withoutLabel);
      },
    },
  },
  {
    id: "releases-packing",
    check: ({ pkg, files, deps }) => {
      if (pkg.private) return undefined;
      const drift: string[] = [];
      if (pkg.scripts?.prepack !== "pnpm run build")
        drift.push(`prepack is ${pkg.scripts?.prepack}, not pnpm run build`);
      if (pkg.files?.[0] !== "dist")
        drift.push(`files is ${JSON.stringify(pkg.files)}, not "dist" first`);
      if (pkg.publishConfig?.access !== "public") drift.push("publishConfig.access isn't public");
      if (!deps.publint) drift.push("no publint dev dependency");
      if (!/publint:\s*\{[^}]*strict:\s*true/.test(files["vite.config.ts"] ?? "")) {
        drift.push("pack doesn't run publint with strict: true");
      }
      return drifted(drift);
    },
    // The fields in package.json. The pack block in vite.config.ts is left to do by hand.
    fix: {
      in: "files",
      apply: (dir, std) => {
        const pkg = readPkg(dir);
        if (pkg.private) return;
        pkg.scripts = { ...pkg.scripts, prepack: "pnpm run build" };
        pkg.files = ["dist", ...(pkg.files ?? []).filter((file) => file !== "dist")];
        pkg.publishConfig = { ...pkg.publishConfig, access: "public" };
        const publint = versionsIn(std)["publint"];
        if (publint && !pkg.dependencies?.["publint"]) {
          pkg.devDependencies = { ...pkg.devDependencies, publint };
        }
        writePkg(dir, pkg);
      },
    },
  },
  {
    id: "releases-types",
    check: ({ pkg, files, deps }) => {
      if (pkg.private) return undefined;
      const drift: string[] = [];
      if (!/dts:\s*\{[^}]*generator:\s*"oxc"/.test(files["vite.config.ts"] ?? "")) {
        drift.push('pack doesn\'t write types with generator: "oxc"');
      }
      if (deps.typescript) drift.push("has typescript, which Oxc's types don't need");
      return drifted(drift);
    },
  },
  {
    id: "releases-bundled",
    check: ({ pkg }) => {
      if (pkg.private) return undefined;
      return drifted(
        Object.keys(pkg.dependencies ?? {})
          .filter((name) => name.startsWith("@amitkaps/"))
          .map((name) => `depends on ${name}, rather than bundling it`),
      );
    },
  },
  {
    id: "releases-labels",
    check: ({ pkg, labels }) => {
      if (pkg.private || !labels) return undefined;
      if (labels instanceof Error) return unread(labels);
      return drifted(labelNames.filter((n) => !labels.includes(n)).map((n) => `no ${n} label`));
    },
    fix: {
      in: "github",
      apply: (repo, pkg) => {
        if (!pkg.private) writeLabels(repo);
      },
    },
  },
];

// What's built or installed isn't the repository's, so the fixes never write there.
const SKIP = new Set([".git", "node_modules", "dist"]);

function snapshot(dir: string, top = dir, found = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) snapshot(path, top, found);
    } else if (entry.isFile()) found.set(relative(top, path), readFileSync(path, "utf8"));
  }
  return found;
}

/** @prose
 * # Holds that moved
 *
 * Up to 0.3.0, craftz kept each repository's holds, by its name. They're in each repository's
 * `package.json` now, and the fix writes the ones craftz kept into the repository the folder's
 * `origin` names. Delete this once every repository is on 0.4.0.
 */
const MOVED_HOLDS: Record<string, Record<string, string>> = {
  base: {
    "versions-typescript":
      "svelte-check accepts TypeScript 5 and 6 only. Move when its peer range takes 7.",
    "cloudflare-config":
      "cf can't deploy SvelteKit, since the adapter doesn't write cf's Build Output. Move when it does.",
    "toolchain-types":
      "SvelteKit needs $app/types in types, and checkJs off, or svelte-check reads the Worker wrangler builds. Move when either changes.",
  },
};

function moveHolds(dir: string): void {
  const moved = MOVED_HOLDS[origin(dir) ?? ""];
  const pkg = readPkg(dir);
  if (!moved || pkg.craftz?.hold) return;
  writePkg(dir, { ...pkg, craftz: { ...pkg.craftz, hold: moved } });
}

/** @prose
 * # Fixing the files
 *
 * Every fix in the files is applied, but the held ones, for `craftz fix`, `pnpm align` and `pnpm
 * new`. Each fix writes what the rules want, whatever was there, so a second run changes nothing.
 *
 * It answers the files it changed, added or removed, sorted, from the folder as it was before and
 * after. That's what changed, whichever fix did it, and it's empty when nothing did.
 */
export function fixFiles(dir: string, std: string): string[] {
  const before = snapshot(dir);
  moveHolds(dir);
  const held = readPkg(dir).craftz?.hold ?? {};
  for (const rule of RULES)
    if (rule.fix?.in === "files" && !held[rule.id]) rule.fix.apply(dir, std);
  const after = snapshot(dir);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((file) => before.get(file) !== after.get(file))
    .toSorted();
}

/** Applies every fix that's written on GitHub, for `pnpm align` and `pnpm new --push`. */
export function fixGitHub(repo: string, pkg: Pkg): void {
  for (const rule of RULES) if (rule.fix?.in === "github") rule.fix.apply(repo, pkg);
}
