/** @prose
 * # The docs rules
 *
 * The rules under [Docs](../../docs/rules.md#docs): the files every repository's `docs/` has,
 * that each is in the `nav`, and the shape of the lessons and the plan. `pnpm new` writes the
 * first version of each from the same text.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OWNER, type Pkg, read, readPkg } from "../reference.ts";
import type { Rule } from "../rules.ts";
import { anchors, linkedRules } from "../stated.ts";
import { drifted } from "./shared.ts";

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

export const DOCS_RULES: Rule[] = [
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
          if (!read(join(dir, file))) writeFileSync(join(dir, file), text);
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
];
