/** @prose
 * # New
 *
 * Starts a repository that follows the rules from its first commit. It writes the folder in the
 * current one, formatted, then installs, writes the outline, makes the first commit and runs
 * `verify`, so what it hands over already passes.
 *
 * The commit comes first, since a prose site builds from one. It formats with oxfmt's own
 * `format`, with the options [ruled.ts](ruled.ts) states, so nothing about the format is copied
 * here.
 *
 * What it starts is two of [the axes](../docs/rules.md#axes): `--package` publishes it to npm, and
 * `--site` deploys a static site to Cloudflare. Either, both or neither, which is scripts run on a
 * laptop. A site alone is Vite's, from an `index.html`, and a package's site is the repository read
 * as prose, since `vp pack` writes Vite's `dist`. An app starts from base instead. The other two
 * axes are flags of their own. `--private` makes the GitHub repository private, which keeps it off
 * craftz's list, and `--internal` puts a site behind Cloudflare Access, which its config then says.
 *
 * It writes only what's the new repository's own: its name and description, its source, the Vite
 * config for what it publishes and deploys. Then it runs every fix in [rules.ts](rules.ts), the
 * same ones `craftz fix` runs. They write the rest: the versions and engines, the shared scripts,
 * CI, the editor settings, pnpm's settings, the shared sections of `AGENTS.md`, a package's release
 * files, and a first version of each doc. So it can't follow the rules any less than `craftz fix`
 * does, and a rule's fix reaches the next repository with no second copy here. What it does write
 * is built from [the reference](../reference/README.md) where it can be, like `.gitignore`, which
 * the reference holds as `gitignore`. The licence is craftz's own. `tsconfig.json` starts as its
 * `include`, and the config without `fmt`, `lint`, a package's publint, types and platform or a
 * site's browsers, since their rules' fixes write the rest.
 * `pnpm test` checks the result against the survey.
 *
 * `--push` also creates the repository on GitHub, pushes the first commit and writes its GitHub
 * settings, as `craftz settings` does. That first push is the only one to `main` the rules allow,
 * since the branch rules aren't on yet. Its settings include the topic `craftz`, so align finds it.
 * What's left is printed at the end: the Worker, Access or npm's setup, which have no API to do
 * them from here.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Shape, fixFiles, listed, shipping } from "./rules.ts";
import { CRAFTZ, OWNER, VERSIONS, here, root } from "./reference.ts";
import { writeSettings } from "./apply.ts";
import { runBlock } from "./edit.ts";
import { writeOutline } from "./gone.ts";
import { RULED } from "./ruled.ts";
import { type FormatConfig, format } from "vite-plus/fmt";

/** What `new` starts: the axes it reads, with the repository's visibility and the site's audience. */
export type Start = Shape & { private: boolean; internal: boolean };

// A file of the reference, and one of craftz's own for what the reference doesn't hold.
const read = (file: string): string => readFileSync(join(here, file), "utf8");
const own = (file: string): string => readFileSync(join(root, file), "utf8");

type Pkg = {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};
const reference = JSON.parse(read("package.json")) as Pkg;

async function packageJson(name: string, shape: Shape, description: string): Promise<string> {
  const npm = (tool: string): string => {
    const version = VERSIONS[tool];
    if (!version) throw new Error(`the reference names no version for ${tool}`);
    return version;
  };
  const ours = (...tools: string[]) =>
    Object.fromEntries(tools.map((tool) => [tool, reference.devDependencies[tool]]));
  const scripts = (...names: string[]) =>
    Object.fromEntries(names.map((script) => [script, reference.scripts[script]]));
  const devDependencies = {
    "@amitkaps/craftz": npm(CRAFTZ),
    "@amitkaps/prose": npm("@amitkaps/prose"),
    ...ours("@types/node", "vite-plus"),
  };

  if (!shape.package) {
    // The reference's site script builds its prose site, which a new site doesn't have.
    const built = shape.site
      ? scripts("dev", "build", "preview", "check", "test", "verify", "ship")
      : scripts("check", "test", "verify");
    return JSON.stringify(
      { name, private: true, description, type: "module", scripts: built, devDependencies },
      null,
      2,
    );
  }
  // A package's build is `vp pack`, so its site is the one `prose build` writes, as markz's is.
  return JSON.stringify(
    {
      name: `@${OWNER}/${name}`,
      version: "0.0.0",
      description,
      ...(shape.site ? { homepage: `https://${name}.amitkaps.com` } : {}),
      license: "MIT",
      repository: { type: "git", url: `git+https://github.com/${OWNER}/${name}.git` },
      type: "module",
      exports: {
        ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
        "./package.json": "./package.json",
      },
      scripts: {
        dev: "vp pack --watch",
        build: "vp pack",
        ...scripts("check", "test", "verify"),
        ...(shape.site ? scripts("site", "ship") : {}),
      },
      devDependencies,
    },
    null,
    2,
  );
}

function tsconfig(shape: Shape): string {
  const include = [
    "src",
    "tests",
    "vite.config.ts",
    ...(shape.site ? ["cloudflare.config.ts"] : []),
  ];
  return JSON.stringify({ include }, null, 2);
}

// Text as the lines of an `@prose` comment, each within 100 characters.
function wrapped(text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + word.length < 97)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

// The scripts `verify` runs side by side: a tool has nothing to build, and a package's site is
// the one `prose build` writes.
const verified = (shape: Shape): string[] => [
  "check",
  "test",
  ...(shape.package || shape.site ? ["build"] : []),
  ...(shape.package && shape.site ? ["site"] : []),
];

function viteConfig(shape: Shape): string {
  const what = listed([
    ...(shape.package ? ["packs the package"] : []),
    ...(shape.site && !shape.package ? ["builds the site"] : []),
    "checks it",
  ]);
  const why = [
    `One Vite+ config ${what}.`,
    "The format and lint are the ones the rules ask every config to write out.",
    ...(shape.package
      ? [
          "`vp pack` writes ESM for Node, with its types from Oxc, and runs publint, which fails the build on a package npm would serve badly.",
        ]
      : []),
    ...(shape.site
      ? [
          shape.package
            ? "The site is the repository read as prose, the folder `prose build` writes, so Vite doesn't build it. [cloudflare.config.ts](cloudflare.config.ts) names it, and `pnpm ship` uploads it, through `craftz deploy`."
            : "Vite builds the site from `index.html` into `dist`, which [cloudflare.config.ts](cloudflare.config.ts) names, and `pnpm ship` uploads it, through `craftz deploy`.",
        ]
      : []),
    ...(shape.package || shape.site
      ? []
      : ["There's nothing to build or serve, so Vite+ is here for its checks and tests."]),
  ];
  const pack = `  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    clean: true,
    fixedExtension: false,
  },
`;
  return `/** @prose
 * # ${shape.package || shape.site ? "The build" : "The checks"}
 *
 * ${wrapped(why.join(" ")).join("\n * ")}
 */
import { defineConfig } from "vite-plus";

export default defineConfig({
${[...(shape.package ? [pack] : []), runBlock(verified(shape))].join("\n")}
  test: {
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
  },
});
`;
}

function agents(name: string, description: string): string {
  // A description in the packages' style, like "markz — small, opinionated Markdown.", names it.
  const intro = description.startsWith(name) ? description : `${name}: ${description}`;
  return `# AGENTS.md

${intro}

## This repository

- Nothing yet beyond the rules. What's particular to ${name} goes here.
`;
}

function readme(name: string, shape: Shape, description: string): string {
  const install = shape.package
    ? `\n## Install\n\n\`\`\`sh\npnpm add @${OWNER}/${name}\n\`\`\`\n\nIt needs Node 26.12.1 or newer, the Node it's built and tested on.\n`
    : "";
  return `# ${name}

${description}
${install}
Read [the docs](docs/README.md) for its design, plan and lessons. It follows [craftz's rules](https://craftz.amitkaps.com/docs/rules.md) for how it ${listed(
    [
      ...(shape.package || shape.site ? ["builds", "checks"] : ["checks"]),
      ...shipping(shape, "releases", "deploys"),
    ],
  )}.
`;
}

function cloudflareConfig(name: string, internal: boolean, directory: string): string {
  const why = internal
    ? `
 *
 * It's internal, so a Cloudflare Access application covers its domain, with a policy that lets
 * in only who it's for.`
    : "";
  return `/** @prose
 * # The Worker
 *
 * What Cloudflare runs: its name, domain and the folder it serves, its compatibility date, and
 * \`workers.dev\` and preview URLs off, so the site answers only on its domain. Keep the name
 * equal to the Worker connected to this repository in the dashboard. The build and deploy
 * commands are set on the Worker, as craftz's rules list.${why}
 */
export default {
  worker: {
    name: "${name}",
    domains: ["${name}.amitkaps.com"],
    assets: { directory: "${directory}" },
  },
};
`;
}

const page = (name: string, description: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <meta name="description" content="${description}" />
  </head>
  <body>
    <h1>${name}</h1>
    <p>${description}</p>
  </body>
</html>
`;

const entry = (name: string, description: string): string => `/** @prose
 * # ${name}
 *
 * ${description}
 */

/** Says hello, as a start to replace. */
export function hello(who: string): string {
  return \`Hello, \${who}.\`;
}
`;

const test = `/** @prose
 * # The first test
 *
 * What the starting function returns, as a test to replace.
 */
import { expect, test } from "vite-plus/test";
import { hello } from "../src/index.ts";

test("says hello", () => {
  expect(hello("world")).toBe("Hello, world.");
});
`;

/** Writes a new repository's files into `dir`, which must not exist. */
export async function write(
  dir: string,
  name: string,
  start: Start,
  description: string,
): Promise<void> {
  if (existsSync(dir)) throw new Error(`${dir} already exists`);
  const files: Record<string, string> = {
    "package.json": `${await packageJson(name, start, description)}\n`,
    "tsconfig.json": `${tsconfig(start)}\n`,
    "vite.config.ts": viteConfig(start),
    "AGENTS.md": agents(name, description),
    "README.md": readme(name, start, description),
    // npm leaves a `.gitignore` out of a package, so the reference holds it without the dot.
    ".gitignore": read("gitignore"),
    // A private repository isn't shared, so it has no licence to share it under.
    ...(start.private ? {} : { LICENSE: own("LICENSE") }),
    "src/index.ts": entry(name, description),
    "tests/index.test.ts": test,
    "src/README.md": "# Source\n\nThe code, with [index.ts](index.ts) as its entry.\n",
    "tests/README.md": "# Tests\n\nThe tests, one file for each part of [the source](../src/).\n",
  };
  if (start.site) {
    const directory = start.package ? ".prose" : "dist";
    files["cloudflare.config.ts"] = cloudflareConfig(name, start.internal, directory);
    if (!start.package) files["index.html"] = page(name, description);
  }
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  fixFiles(dir, here);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  // Formatted as `vp fmt` formats it, with the rules' options, so the repository starts out formatted.
  const fmt = RULED["fmt"] as FormatConfig;
  for (const file of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    const path = join(dir, file);
    if (!/\.(json|ts|md|ya?ml|html)$/.test(file)) continue;
    const text = readFileSync(path, "utf8");
    const { code, errors } = await format(file, text, fmt);
    if (errors.length) throw new Error(`${file} doesn't format: ${errors[0]?.message}`);
    if (code !== text) writeFileSync(path, code);
  }
}

/** Starts a repository from `craftz new`'s arguments, in a folder of the current one. */
export async function start(argv: string[]): Promise<void> {
  const args = [...argv];
  const flag = (name: string): boolean => {
    const at = args.indexOf(name);
    if (at !== -1) args.splice(at, 1);
    return at !== -1;
  };
  const value = (name: string): string | undefined => {
    const at = args.indexOf(name);
    return at === -1 ? undefined : args.splice(at, 2)[1];
  };
  const description = value("--description");
  const push = flag("--push");
  // `--site` names the deploy axis, and `static` is the one site `new` starts.
  const site = value("--site");
  const start: Start = {
    package: flag("--package"),
    site: site !== undefined,
    private: flag("--private"),
    internal: flag("--internal"),
  };
  const [name] = args;
  const problem =
    site === "app"
      ? "An app starts from base, a SvelteKit site on Cloudflare, not from new."
      : site !== undefined && site !== "static"
        ? `--site takes static, not ${site}.`
        : start.internal && !start.site
          ? "--internal is for a site, since it puts the site behind Cloudflare Access."
          : undefined;
  if (!name || !description || !/^[a-z][a-z0-9-]*$/.test(name) || args.length > 1 || problem) {
    console.error(
      [
        'Usage: craftz new <name> [--package] [--site static] [--private] [--internal] --description "What it is, in a sentence." [--push]',
        "With neither --package nor --site, it's scripts run on a laptop.",
        ...(problem ? [problem] : []),
      ].join("\n"),
    );
    process.exit(1);
  }

  const dir = join(process.cwd(), name);
  await write(dir, name, start, description);
  const run = (command: string, ...a: string[]): void => {
    execFileSync(command, a, { cwd: dir, stdio: "inherit" });
  };
  run("pnpm", "install");
  writeOutline(dir);
  run("git", "add", "-A");
  run("git", "commit", "-q", "-m", `Start ${name} from craftz's rules`);
  run("pnpm", "run", "verify");

  if (push) {
    run(
      "gh",
      "repo",
      "create",
      `${OWNER}/${name}`,
      start.private ? "--private" : "--public",
      "--source",
      ".",
      "--push",
      "--description",
      description,
    );
    const settings = await writeSettings({ repo: name, pkg: { private: !start.package } }, true);
    for (const line of settings.filter((it) => !it.startsWith("fixed: "))) console.log(line);
  }

  const left = [
    ...(push
      ? []
      : [`Create ${OWNER}/${name} on GitHub, push main, then run craftz settings in it.`]),
    ...(start.private
      ? [
          `It's private, so craftz doesn't list it. Check it with craftz check and craftz settings --check in it.`,
        ]
      : []),
    ...(start.site
      ? [
          `Connect the Worker "${name}" to the repository, then run craftz settings in it to write its build settings.`,
        ]
      : []),
    ...(start.internal
      ? [
          `Add an Access application for ${name}.amitkaps.com, with a policy that lets in only who it's for.`,
        ]
      : []),
    ...(start.package && start.private
      ? [
          "Its release workflow publishes with provenance, which npm takes only from a public repository. Make the repository public, or take --provenance out of the workflow's copy and say why in its docs.",
        ]
      : []),
    ...(start.package
      ? [
          'Publish the first version by hand, then add the trusted publisher on npmjs.com, as "Setting up a new package" in craftz\'s rules says.',
        ]
      : []),
  ];
  console.log(`\n✓ ${dir}\n\nStill to do:`);
  for (const step of left) console.log(`- ${step}`);
}
