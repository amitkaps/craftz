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
 * A check returns `undefined` when its rule doesn't apply, like `scripts-preview` for a package. A
 * fix in `files` edits a clone to match [the reference](../reference/), and `pnpm align` puts it in
 * the repository's pull request. It changes nothing in a clone already in line, so it's safe to run
 * on every one. A fix in `github` is written directly, since there's no file to review. A rule with
 * no fix is fixed by hand, as the rules say.
 *
 * The table is split by the part of the rules each id starts with, one module for each in
 * [rules/](rules/), and this module joins them in the doc's order. What more than one of them
 * writes with is in [rules/shared.ts](rules/shared.ts).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  isCraftz,
  OWNER,
  type Pkg,
  here,
  read,
  readPkg,
  standard,
  versionsIn,
} from "./reference.ts";
import {} from "./config.ts";
import { allOf, withValues, withVerify, withoutSite } from "./edit.ts";
import { PACKED } from "./ruled.ts";
import { rulesetFor, writeLabels, writeRuleset } from "./settings.ts";
import {} from "./pinned.ts";
import { anchors, linkedRules } from "./stated.ts";
import { TOOLCHAIN_RULES, unruled, rule, WORKER } from "./rules/toolchain.ts";
import { VERSION_RULES } from "./rules/versions.ts";
import type { BranchRule, Finding, Repo } from "./survey.ts";
import { workerIn } from "./worker.ts";
import { CI, unread, RELEASE_FILES, drifted, editFile, owns, writePkg } from "./rules/shared.ts";

export { betas } from "./rules/versions.ts";

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

const standardScripts = standard.scripts ?? {};

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

/** @prose
 * # The agents' instructions
 *
 * A section runs from its `## ` heading to the next. The fix writes this repository's shared
 * sections over a repository's own, or puts them before its first section when they're
 * missing, and leaves the rest of the file alone.
 */
const SECTIONS = ["craftz", "Prose", "Outline"];
const OUTLINE = "outline.md";
// Whether a .gitignore names a root file, as `name` or `/name`.
const ignores = (text: string, name: string): boolean =>
  text.split("\n").some((line) => [name, `/${name}`].includes(line.trim()));
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
 * That first version says what goes in each section rather than leaving it empty. A doc already
 * there is left alone, since it's written, not copied. `pnpm new` starts every doc this way. A
 * README that doesn't link to `docs/` is fixed by hand.
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

- [ ] The first thing ${name} does.

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

It needs Node 26.12.1 or newer, the Node it's built and tested on.

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

/** The plan's Next section: from its heading to the next, or undefined when it has none. */
const nextOf = (plan: string): RegExpExecArray | null =>
  /^## Next[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(plan);

/** A step in Next that isn't a task, at the start of a line, as `1. ` or `- `. */
const UNTICKED = /^(?:\d+\.|[-*])(?! \[[ x]\] ) +/gm;

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
 * The notes' config was once `.github/release.yml`, GitHub's default path, which read as the
 * release workflow. It's `.github/notes.yml` now, so the fix deletes the old one.
 */
const OLD_NOTES = ".github/release.yml";
const releaseFiles = owns("releases-files", RELEASE_FILES, (pkg) => !pkg.private);
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
const steps = (script: string): string[] => script.split("&&").map((it) => it.trim());
const PROSE = "@amitkaps/prose";
// What `check` runs after `vp check`. prose's own repository builds its command line before it
// can check, so its prose check is a task of its own.
const checkedBy = (pkg: Pkg): string[] =>
  pkg.name === PROSE ? ["pnpm craftz check"] : ["pnpm prose check", "pnpm craftz check"];
// The scripts `all` runs, of those the repository has.
const allFor = (pkg: Pkg): string[] =>
  ["check", "test", "build", "site"].filter((name) => pkg.scripts?.[name]);
// The steps a chained verify ran, in their order, and the script each is in `all`. Those in
// `check` now, and the outline, which `pr` and `gone` write, are dropped. `prose build` is `site`.
const CHAINED = ["pnpm check", "pnpm test", "pnpm build", "pnpm site"];
const DROPPED = ["pnpm prose check", "pnpm prose outline", "pnpm craftz check"];

/** @prose
 * # A chained verify
 *
 * A `verify` chained with `&&` ran each step after the last, so a step may need one before it.
 * The fix moves what it can know is safe. It drops the steps `check` runs now, and the outline,
 * and makes `prose build` the `site` script. When every step left is a standard one, in `all`'s
 * order, the chain moves to `all`.
 *
 * Otherwise the chain stays, shorter, and the check names each step that's left. That's a step of
 * the repository's own, or a standard one that ran after a step it may need, like a test that
 * reads the build. Each becomes a task in `vite.config.ts` that waits for what it needs, by hand,
 * since only the repository knows what that is.
 */
function chain(verify: string): { kept: string[]; own: string[]; late: [string, string][] } {
  const kept = steps(verify)
    .filter((step) => !DROPPED.includes(step))
    .map((step) => (step === "pnpm prose build" ? "pnpm site" : step));
  const own = kept.filter((step) => !CHAINED.includes(step));
  const standard = kept.filter((step) => CHAINED.includes(step));
  const late = standard.flatMap((step, n): [string, string][] => {
    const before = standard.slice(0, n).find((it) => CHAINED.indexOf(it) > CHAINED.indexOf(step));
    return before ? [[step, before]] : [];
  });
  return { kept, own, late };
}

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
    const want = isCraftz(pkg) ? own : standardScripts[name];
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
      setScript(dir, std, name, (pkg) => !isCraftz(pkg));
    },
  },
});

// What deployed a static site through Cloudflare's plugin.
const CLOUDFLARE_TOOLS = ["cf", "@cloudflare/vite-plugin", "wrangler"];
// SvelteKit builds a site from `src/app.html`, where Vite alone builds from `index.html`.
const SVELTEKIT = "@sveltejs/kit";

export const RULES: Rule[] = [
  ...VERSION_RULES,
  ...TOOLCHAIN_RULES,
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
      return drifted(
        ["vp check", ...checkedBy(pkg)]
          .filter((step) => !steps(check).includes(step))
          .map((step) => `check doesn't run ${step}`),
      );
    },
    fix: {
      in: "files",
      // Each missing step but vp check goes last, after a framework's own checker.
      apply: (dir) => {
        const pkg = readPkg(dir);
        const check = pkg.scripts?.check;
        if (!check || !onVitePlus(pkg)) return;
        const missing = checkedBy(pkg).filter((step) => !steps(check).includes(step));
        if (!missing.length) return;
        pkg.scripts = { ...pkg.scripts, check: [check, ...missing].join(" && ") };
        writePkg(dir, pkg);
      },
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
    check: ({ pkg, files, vitePlus }) => {
      const verify = pkg.scripts?.verify;
      if (!verify || !vitePlus) return undefined;
      const want = standardScripts.verify;
      if (verify !== want) {
        // prose's chain is its own, since its prose check is a task of its own.
        const { own, late } = pkg.name === PROSE ? { own: [], late: [] } : chain(verify);
        return drifted([
          `verify is ${verify}, not ${want}`,
          ...own.map(
            (step) => `${step} needs a task in vite.config.ts that waits for what it needs`,
          ),
          ...late.map(
            ([step, before]) =>
              `${step} runs after ${before}, so it's a task in vite.config.ts if it needs it`,
          ),
        ]);
      }
      const all = allOf(files["vite.config.ts"] ?? "");
      if (!all) return drifted(["vite.config.ts has no all task"]);
      return drifted(
        allFor(pkg)
          .filter((name) => !all.includes(name))
          .map((name) => `all doesn't run ${name}`),
      );
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const pkg = readPkg(dir);
        const verify = pkg.scripts?.verify;
        const want = readPkg(std).scripts?.verify;
        if (!verify || !want || verify === want || !onVitePlus(pkg) || pkg.name === PROSE) return;
        const { kept, own, late } = chain(verify);
        const site: Record<string, string> = steps(verify).includes("pnpm prose build")
          ? { site: standardScripts.site ?? "prose build" }
          : {};
        if (own.length || late.length) {
          pkg.scripts = { ...pkg.scripts, ...site, verify: kept.join(" && ") };
          return writePkg(dir, pkg);
        }
        const file = join(dir, "vite.config.ts");
        const vite = read(file);
        if (!vite) return;
        const edited = withVerify(
          vite,
          kept.map((step) => step.slice(5)),
        );
        if (edited === vite) return;
        writeFileSync(file, edited);
        pkg.scripts = { ...pkg.scripts, ...site, verify: want };
        writePkg(dir, pkg);
      },
    },
  },
  {
    id: "scripts-prose",
    check: ({ pkg }) => {
      const prose = pkg.scripts?.prose;
      // prose's own repository runs its command line from source.
      if (!prose || pkg.name === PROSE) return undefined;
      const outline = pkg.scripts?.outline;
      return drifted([
        ...(prose === "prose" ? [] : [`prose is ${prose}, not prose`]),
        ...(outline === standardScripts.outline
          ? []
          : [`outline is ${outline ?? "missing"}, not ${standardScripts.outline}`]),
      ]);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        for (const name of ["prose", "outline"])
          setScript(dir, std, name, (pkg) => pkg.name !== PROSE);
      },
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
      const want = isCraftz(pkg) ? "node src/cli.ts deploy" : standardScripts.ship;
      return drifted(ship === want ? [] : [`ship is ${ship}, not ${want}`]);
    },
    fix: {
      in: "files",
      apply: (dir, std) => setScript(dir, std, "ship", (pkg) => !isCraftz(pkg) && !!workerIn(dir)),
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
  /** @prose
   * # A static site's Worker
   *
   * `cloudflare.config.ts` is written as cf's own, with the Worker under `worker`, and imports
   * nothing. It's parsed as `vite.config.ts` is, and the date and addresses are read where they
   * sit. The fix writes in each one that differs, after rewriting a config that still calls
   * `site()`, as edit.ts does.
   *
   * A site on wrangler, like base, is left out. It's held on wrangler, so it moves when it moves
   * to `cloudflare.config.ts`.
   */
  {
    id: "cloudflare-site",
    check: ({ files, worker: site }) => {
      if (site?.file !== "cloudflare.config.ts") return undefined;
      const text = files[site.file] ?? "";
      const drift = /^export default site\(/m.test(text) ? [`${site.file} calls site()`] : [];
      return drifted([...drift, ...unruled(withoutSite(text), { worker: WORKER })]);
    },
    fix: {
      in: "files",
      apply: (dir) =>
        editFile(join(dir, "cloudflare.config.ts"), (text) =>
          withValues(withoutSite(text), { worker: WORKER }),
        ),
    },
  },
  /** @prose
   * # Nothing of Cloudflare's in a static site
   *
   * A static site's dependencies, Vite config and scripts are read for what deployed it through
   * Cloudflare's plugin.
   *
   * Vite builds a site from its `index.html`, or SvelteKit's static adapter does from
   * `src/app.html`. The fix removes the dependencies and drops ` && vp build` from the scripts of a
   * site that has neither. A script that runs `vp build` another way is left to fix by hand, as is a Vite
   * config that loads the plugin, since every repository has taken it out.
   */
  {
    id: "cloudflare-static",
    check: ({ files, deps, pkg, worker: site }) => {
      if (site?.file !== "cloudflare.config.ts" || site.deploys !== "static") return undefined;
      const drift = CLOUDFLARE_TOOLS.filter((name) => deps[name]).map(
        (name) => `depends on ${name}, which a static site doesn't use`,
      );
      if (files["vite.config.ts"]?.includes("@cloudflare/vite-plugin")) {
        drift.push("vite.config.ts loads Cloudflare's plugin");
      }
      if (!files["index.html"] && !deps[SVELTEKIT]) {
        for (const name of ["verify", "build"]) {
          if (/\bvp build\b/.test(pkg.scripts?.[name] ?? "")) {
            drift.push(`${name} runs vp build, with no index.html or SvelteKit to build`);
          }
        }
      }
      return { value: site.directory, drift };
    },
    fix: {
      in: "files",
      apply: (dir) => {
        if (workerIn(dir)?.deploys !== "static") return;
        const pkg = readPkg(dir);
        const builds =
          existsSync(join(dir, "index.html")) ||
          !!(pkg.dependencies?.[SVELTEKIT] ?? pkg.devDependencies?.[SVELTEKIT]);
        for (const field of ["dependencies", "devDependencies"] as const) {
          for (const name of CLOUDFLARE_TOOLS) {
            if (pkg[field]?.[name]) delete pkg[field][name];
          }
        }
        for (const name of builds ? [] : ["verify", "build"]) {
          const script = pkg.scripts?.[name];
          if (script) pkg.scripts = { ...pkg.scripts, [name]: script.replace(/ && vp build$/, "") };
        }
        writePkg(dir, pkg);
      },
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
    ...owns("github-ci", [CI]),
    // Versions move in the reference first, so a repository doesn't take Dependabot's.
    check: (repo) => {
      const finding = owns("github-ci", [CI]).check(repo);
      const dependabot = repo.files[".github/dependabot.yml"] ? ["has a dependabot.yml"] : [];
      return drifted([...(finding?.drift ?? []), ...dependabot]);
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
    id: "agents-outline",
    check: ({ files }) =>
      drifted(
        ignores(files[".gitignore"] ?? "", OUTLINE) ? [] : [`.gitignore doesn't list ${OUTLINE}`],
      ),
    fix: {
      in: "files",
      apply: (dir) => {
        const path = join(dir, ".gitignore");
        const text = read(path);
        if (ignores(text, OUTLINE)) return;
        writeFileSync(
          path,
          `${text.trimEnd()}\n\n# Written by prose outline\n${OUTLINE}\n`.trimStart(),
        );
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
    id: "docs-lessons",
    check: ({ files }) => {
      const known = anchors();
      return drifted(
        linkedRules(files["docs/lessons.md"] ?? "")
          .filter((id) => !known.has(id))
          .map((id) => `docs/lessons.md links rules.md#${id}, which these rules don't have`),
      );
    },
  },
  {
    id: "docs-plan",
    check: ({ files }) => {
      const next = nextOf(files["docs/plan.md"] ?? "")?.[1] ?? "";
      const steps = next.match(UNTICKED)?.length ?? 0;
      return drifted(
        steps
          ? [
              `docs/plan.md has ${steps} ${steps === 1 ? "step" : "steps"} in Next that aren't - [ ] tasks`,
            ]
          : [],
      );
    },
    fix: {
      in: "files",
      apply: (dir) => {
        const path = join(dir, "docs", "plan.md");
        const plan = read(path);
        const next = nextOf(plan);
        if (!next) return;
        const at = next.index + next[0].length - (next[1] ?? "").length;
        const steps = (next[1] ?? "").replace(UNTICKED, "- [ ] ");
        writeFileSync(path, plan.slice(0, at) + steps + plan.slice(at + (next[1] ?? "").length));
      },
    },
  },
  {
    id: "releases-files",
    check: (repo) => {
      const found = releaseFiles.check(repo);
      if (repo.pkg.private || !repo.files[OLD_NOTES]) return found;
      return drifted([...(found?.drift ?? []), `${OLD_NOTES} is left from before notes.yml`]);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        if (releaseFiles.fix?.in === "files") releaseFiles.fix.apply(dir, std);
        if (!readPkg(dir).private) rmSync(join(dir, OLD_NOTES), { force: true });
      },
    },
  },
  {
    id: "releases-packing",
    check: ({ pkg, deps, files }) => {
      if (pkg.private) return undefined;
      const drift: string[] = [];
      if (pkg.scripts?.prepack !== "pnpm run build")
        drift.push(`prepack is ${pkg.scripts?.prepack}, not pnpm run build`);
      if (pkg.files?.[0] !== "dist")
        drift.push(`files is ${JSON.stringify(pkg.files)}, not "dist" first`);
      if (pkg.publishConfig?.access !== "public") drift.push("publishConfig.access isn't public");
      if (!deps.publint) drift.push("no publint dev dependency");
      drift.push(
        ...unruled(files["vite.config.ts"] ?? "", { pack: { publint: PACKED["publint"] } }),
      );
      return drifted(drift);
    },
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
        rule(dir, { pack: { publint: PACKED["publint"] } });
      },
    },
  },
  {
    id: "releases-types",
    check: ({ pkg, deps, files }) => {
      if (pkg.private) return undefined;
      return drifted([
        ...(deps.typescript ? ["has typescript, which Oxc's types don't need"] : []),
        ...unruled(files["vite.config.ts"] ?? "", { pack: { dts: PACKED["dts"] } }),
      ]);
    },
    fix: {
      in: "files",
      apply: (dir) => {
        if (!readPkg(dir).private) rule(dir, { pack: { dts: PACKED["dts"] } });
      },
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
  const held = readPkg(dir).craftz?.hold ?? {};
  for (const rule of RULES)
    if (rule.fix?.in === "files" && !held[rule.id]) rule.fix.apply(dir, std);
  const after = snapshot(dir);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((file) => before.get(file) !== after.get(file))
    .toSorted();
}
