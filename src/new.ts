/** @prose
 * # New
 *
 * Starts a repository that follows the rules from its first commit. It writes the folder in the
 * current one, installs, formats, runs `verify` and makes the first commit, so what it hands over
 * already passes.
 *
 * What it starts is two of [the axes](../docs/rules.md#axes): `--package` publishes it to npm,
 * and `--site` deploys a static site to Cloudflare. Either, both or neither, which is scripts run
 * on a laptop. An app starts from base instead. The other two axes are flags of their own.
 * `--private` makes the GitHub repository private and leaves it out of `REPOS`, and `--internal`
 * puts a site behind Cloudflare Access, which its config then says.
 *
 * It writes only what's the new repository's own: its name and description, its source, the
 * Vite config for what it publishes and deploys, and CI. Then it runs every fix in [rules.ts](rules.ts), the same ones
 * `pnpm align` runs. They write the rest: the versions and engines, the shared scripts, the
 * editor settings, the cooldown, the shared sections of `AGENTS.md`, a package's release files,
 * and a first version of each doc. So it can't follow the rules any less than `align` does,
 * and a rule's fix reaches the next repository with no second copy here. What it does write is
 * built from [the reference](../reference/README.md) where it can be, like the strict options
 * from `tsconfig.json`. What the reference doesn't hold, like the `lint` block, comes from
 * craftz's own files. `pnpm test` checks the result against the survey.
 *
 * `--push` also creates the repository on GitHub, pushes the first commit and writes its GitHub
 * settings, as `pnpm align` does. That first push is the only one to `main` the rules allow, since
 * the branch rules aren't on yet. What's left is printed at the end: adding it to `REPOS`, and the Worker,
 * Access or npm's setup, which have no API to do them from here.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BROWSERS } from "./browsers.ts";
import { COMPATIBILITY_DATE } from "./runtime.ts";
import { type Shape, fixFiles, listed, shipping } from "./rules.ts";
import { OWNER, VERSIONS, here, root } from "./reference.ts";
import { writeSettings } from "./apply.ts";

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

// The lint block `toolchain-lint` asks for. craftz's own config gets it from `craftz()`, which a
// new repository can use once craftz is released, and then this block goes.
const lint = `  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
  },`;

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
  const site = shape.site ? ours("@cloudflare/vite-plugin", "cf") : {};
  const devDependencies = {
    "@amitkaps/prose": npm("@amitkaps/prose"),
    ...ours("@types/node", "vite-plus"),
    ...site,
  };

  if (!shape.package) {
    // The reference's verify also builds its prose site, which a new site doesn't have.
    const built = shape.site
      ? {
          ...scripts("dev", "build", "preview", "check", "test"),
          verify: "pnpm check && pnpm prose check && pnpm test && pnpm build",
          ...scripts("ship"),
        }
      : { ...scripts("check", "test"), verify: "pnpm check && pnpm prose check && pnpm test" };
    return JSON.stringify(
      { name, private: true, description, type: "module", scripts: built, devDependencies },
      null,
      2,
    );
  }
  // A package's build is `vp pack`, so its site is built by `vp build` itself, as markz's is.
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
        ...scripts("check"),
        test: "vp test --run",
        verify: `pnpm check && pnpm prose check && pnpm test && pnpm build${shape.site ? " && vp build" : ""}`,
        ...(shape.site ? scripts("ship") : {}),
      },
      devDependencies,
    },
    null,
    2,
  );
}

function workspace(shape: Shape): string {
  const text = read("pnpm-workspace.yaml");
  const blocks = text.split(/\n(?=# @prose\n)/);
  const pick = (key: string): string => {
    const found = blocks.find((b) => b.includes(`\n${key}:`));
    if (!found) throw new Error(`the reference's pnpm-workspace.yaml has no ${key}`);
    return found.trim();
  };
  const header = [
    "# @prose",
    "# # pnpm's settings",
    "#",
    "# pnpm 12 reads project settings from here. It's a settings file, not a workspace, and its",
    "# settings are the rules', from craftz.",
  ].join("\n");
  const parts = [header, ...(shape.site ? [pick("allowBuilds")] : []), pick("overrides")];
  return parts.join("\n\n");
}

function tsconfig(shape: Shape): string {
  const compilerOptions = (JSON.parse(read("tsconfig.json")) as { compilerOptions: object })
    .compilerOptions;
  const include = [
    "src",
    "tests",
    "vite.config.ts",
    ...(shape.site ? ["cloudflare.config.ts"] : []),
  ];
  return JSON.stringify({ compilerOptions, include }, null, 2);
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

function viteConfig(shape: Shape): string {
  const what = listed([
    ...(shape.package ? ["packs the package"] : []),
    ...(shape.site ? ["builds the site"] : []),
    "checks it",
  ]);
  const why = [
    `One Vite+ config ${what}.`,
    ...(shape.package
      ? [
          "`vp pack` writes ESM with its types, and runs publint, which fails the build on a package npm would serve badly.",
        ]
      : []),
    ...(shape.site
      ? [
          "The Cloudflare plugin writes an assets-only Build Output, which `cf deploy --prebuilt` uploads as it is. The Worker itself is in [cloudflare.config.ts](cloudflare.config.ts).",
        ]
      : []),
    ...(shape.package || shape.site
      ? []
      : ["There's nothing to build or serve, so Vite+ is here for its checks and tests."]),
  ];
  const site = `  plugins: [cloudflare({ assetsOnly: true })],

  // The browsers the rules name, from craftz's browser-compat-data.
  build: { target: ${JSON.stringify(BROWSERS).replaceAll(",", ", ")} },
`;
  const pack = `  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    platform: "node",
    // Oxc writes the types, so there's no typescript dependency, and fails on an export
    // whose type isn't written out.
    dts: { generator: "oxc" },
    clean: true,
    fixedExtension: false,
    publint: { strict: true },
  },
`;
  return `/** @prose
 * # ${shape.package || shape.site ? "The build" : "The checks"}
 *
 * ${wrapped(why.join(" ")).join("\n * ")}
 */
import { defineConfig } from "vite-plus";
${shape.site ? `import { cloudflare } from "@cloudflare/vite-plugin";\n` : ""}
export default defineConfig({
${[...(shape.site ? [site] : []), ...(shape.package ? [pack] : [])].join("\n")}${shape.package || shape.site ? "\n" : ""}  // oxfmt's defaults, with each Markdown paragraph on one line.
  fmt: { proseWrap: "never" },

  // Type-aware lint that also type-checks, so \`pnpm check\` needs no separate \`tsc\`.
${lint}

  test: {
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
  },
});
`;
}

// The reference's CI, with a header that fits the new one.
function ci(shape: Shape): string {
  const job = read(".github/workflows/ci.yml").slice(
    read(".github/workflows/ci.yml").indexOf("name: CI"),
  );
  const header = [
    "# @prose",
    "# # CI",
    "#",
    "# Checks every pull request and every push to `main` with `pnpm run verify`.",
    ...(shape.site
      ? ["# Cloudflare runs the same script before each deploy, which its Git integration does."]
      : []),
    ...(shape.package
      ? ["# The release workflow runs the same script before it stages a version."]
      : []),
    ...(shape.package || shape.site
      ? []
      : ["# Nothing deploys or releases: the scripts run on a laptop."]),
    "# The job is named `ci`, the check that branch protection requires.",
  ].join("\n");
  return `${header}\n${job}`;
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
    ? `\n## Install\n\n\`\`\`sh\npnpm add @${OWNER}/${name}\n\`\`\`\n\nIt needs Node 26 or newer, the Node it's built and tested on.\n`
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

function cloudflareConfig(name: string, internal: boolean): string {
  const why = internal
    ? `
 *
 * It's internal, so a Cloudflare Access application covers its domain, with a policy that lets
 * in only who it's for.`
    : "";
  return `/** @prose
 * # The Worker
 *
 * What Cloudflare runs: its name, compatibility date, domain and how it serves the files. Keep
 * the name equal to the Worker connected to this repository in the dashboard. The build and
 * deploy commands are set on the Worker, as craftz's rules list. The site answers only on its
 * domain, so \`workers.dev\` and preview URLs are off.${why}
 */
import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "${name}",
    compatibilityDate: "${COMPATIBILITY_DATE}",
    domains: ["${name}.amitkaps.com"],
    workersDev: false,
    previewUrls: false,
  },
});
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
    "pnpm-workspace.yaml": `${workspace(start)}\n`,
    "tsconfig.json": `${tsconfig(start)}\n`,
    "vite.config.ts": viteConfig(start),
    ".github/workflows/ci.yml": ci(start),
    "AGENTS.md": agents(name, description),
    "README.md": readme(name, start, description),
    ".gitignore": own(".gitignore"),
    // A private repository isn't shared, so it has no licence to share it under.
    ...(start.private ? {} : { LICENSE: own("LICENSE") }),
    "src/index.ts": entry(name, description),
    "tests/index.test.ts": test,
    "src/README.md": "# Source\n\nThe code, with [index.ts](index.ts) as its entry.\n",
    "tests/README.md": "# Tests\n\nThe tests, one file for each part of [the source](../src/).\n",
  };
  if (start.site) {
    files["cloudflare.config.ts"] = cloudflareConfig(name, start.internal);
    files["index.html"] = page(name, description);
  }
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  fixFiles(dir, here);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
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
        'Usage: pnpm new <name> [--package] [--site static] [--private] [--internal] --description "What it is, in a sentence." [--push]',
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
  // oxfmt formats what was written, so the generator needn't copy its rules.
  run("pnpm", "install");
  run("pnpm", "run", "fix");
  run("pnpm", "run", "verify");
  run("git", "init", "-q", "-b", "main");
  run("git", "add", "-A");
  run("git", "commit", "-q", "-m", `Start ${name} from craftz's rules`);

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
    ...(push ? [] : [`Create ${OWNER}/${name} on GitHub, push main, then run pnpm align ${name}.`]),
    start.private
      ? `Leave it out of REPOS, since craftz is public. Check it with pnpm drift ../${name} in craftz.`
      : `Add "${name}" to REPOS in craftz's src/survey.ts, in a pull request there.`,
    ...(start.site
      ? [
          `Connect the Worker "${name}" to the repository, then run pnpm align ${name} to write its build settings.`,
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
