/** @prose
 * # New
 *
 * Starts a repository that follows the rules from its first commit. It writes the folder in the
 * current one, installs, formats, runs `verify` and makes the first commit, so what it hands over
 * already passes.
 *
 * `pnpm new <name> --package` starts an npm package, `--site` a site on Cloudflare, and `--tool`
 * scripts run on a laptop, with no site or release. `--internal` makes a site or a tool private.
 * Its GitHub repository is private, it isn't added to `REPOS`, and a site turns off `workers.dev`
 * and preview URLs, to sit behind Cloudflare Access.
 *
 * It writes only what's the new repository's own: its name and description, its source, the
 * Vite config for its kind, and CI. Then it runs every fix in [rules.ts](rules.ts), the same ones
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
import { type Kind, fixFiles, fixGitHub } from "./rules.ts";
import { OWNER, VERSIONS, here, root } from "./reference.ts";
import { writeGitHub } from "./settings.ts";

export type { Kind };

// A file of the reference, and one of craftz's own for what the reference doesn't hold.
const read = (file: string): string => readFileSync(join(here, file), "utf8");
const own = (file: string): string => readFileSync(join(root, file), "utf8");

type Pkg = {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};
const reference = JSON.parse(read("package.json")) as Pkg;

// A block of craftz's `vite.config.ts`.
function block(text: string, pattern: RegExp): string {
  const found = pattern.exec(text)?.[0];
  if (!found) throw new Error(`craftz's config has no ${pattern}`);
  return found;
}

async function packageJson(name: string, kind: Kind, description: string): Promise<string> {
  const npm = (tool: string): string => {
    const version = VERSIONS[tool];
    if (!version) throw new Error(`the reference names no version for ${tool}`);
    return version;
  };
  const ours = (...tools: string[]) =>
    Object.fromEntries(tools.map((tool) => [tool, reference.devDependencies[tool]]));
  const scripts = (...names: string[]) =>
    Object.fromEntries(names.map((script) => [script, reference.scripts[script]]));

  if (kind === "site") {
    return JSON.stringify(
      {
        name,
        private: true,
        description,
        type: "module",
        // The reference's verify also builds its prose site, which a new site doesn't have.
        scripts: {
          ...scripts("dev", "build", "preview", "check"),
          verify: "pnpm check && pnpm prose check && pnpm test && pnpm build",
          ...scripts("ship"),
        },
        devDependencies: {
          "@amitkaps/prose": npm("@amitkaps/prose"),
          ...ours("@cloudflare/vite-plugin", "@types/node", "cf", "vite-plus"),
        },
      },
      null,
      2,
    );
  }
  if (kind === "tool") {
    return JSON.stringify(
      {
        name,
        private: true,
        description,
        type: "module",
        scripts: {
          ...scripts("check", "test"),
          verify: "pnpm check && pnpm prose check && pnpm test",
        },
        devDependencies: {
          "@amitkaps/prose": npm("@amitkaps/prose"),
          ...ours("@types/node", "vite-plus"),
        },
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      name: `@${OWNER}/${name}`,
      version: "0.0.0",
      description,
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
        verify: "pnpm check && pnpm prose check && pnpm test && pnpm build",
      },
      devDependencies: {
        "@amitkaps/prose": npm("@amitkaps/prose"),
        ...ours("@types/node", "vite-plus"),
      },
    },
    null,
    2,
  );
}

function workspace(kind: Kind): string {
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
    "# settings are the standard's, from ship.",
  ].join("\n");
  const parts = [header, ...(kind === "site" ? [pick("allowBuilds")] : []), pick("overrides")];
  return parts.join("\n\n");
}

function tsconfig(kind: Kind): string {
  const compilerOptions = (JSON.parse(read("tsconfig.json")) as { compilerOptions: object })
    .compilerOptions;
  const include =
    kind === "site"
      ? ["src", "vite.config.ts", "cloudflare.config.ts"]
      : ["src", "tests", "vite.config.ts"];
  return JSON.stringify({ compilerOptions, include }, null, 2);
}

function viteConfig(kind: Kind): string {
  const lint = block(own("vite.config.ts"), /^ {2}lint: \{[\s\S]*?^ {2}\},$/m);
  if (kind === "site") {
    const browsers = `  build: { target: ${JSON.stringify(BROWSERS).replaceAll(",", ", ")} },`;
    return `/** @prose
 * # The build
 *
 * One Vite+ config builds the site and checks it. The Cloudflare plugin writes an assets-only
 * Build Output, which \`cf deploy --prebuilt\` uploads as it is. The Worker itself is in
 * [cloudflare.config.ts](cloudflare.config.ts).
 */
import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare({ assetsOnly: true })],

  // The browsers the rules name, from craftz's browser-compat-data.
${browsers}

  // oxfmt's defaults, with each Markdown paragraph on one line.
  fmt: { proseWrap: "never" },

  // Type-aware lint that also type-checks, so \`pnpm check\` needs no separate \`tsc\`.
${lint}
});
`;
  }
  if (kind === "tool") {
    return `/** @prose
 * # The checks
 *
 * There's nothing to build or serve, so Vite+ is here for its checks and tests.
 */
import { defineConfig } from "vite-plus";

export default defineConfig({
  // oxfmt's defaults, with each Markdown paragraph on one line.
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
  return `/** @prose
 * # The build
 *
 * One Vite+ config packs the package and checks it. \`vp pack\` writes ESM with its types, and
 * runs publint, which fails the build on a package npm would serve badly.
 */
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
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

  // oxfmt's defaults, with each Markdown paragraph on one line.
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
function ci(kind: Kind): string {
  const job = read(".github/workflows/ci.yml").slice(
    read(".github/workflows/ci.yml").indexOf("name: CI"),
  );
  const header = [
    "# @prose",
    "# # CI",
    "#",
    "# Checks every pull request and every push to `main` with `pnpm run verify`.",
    {
      site: "# Cloudflare runs the same script before each deploy, which its Git integration does.",
      package: "# The release workflow runs the same script before it stages a version.",
      tool: "# Nothing deploys or releases: the scripts run on a laptop.",
    }[kind],
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

- Nothing yet beyond the standard. What's particular to ${name} goes here.
`;
}

function readme(name: string, kind: Kind, description: string): string {
  const install =
    kind === "package"
      ? `\n## Install\n\n\`\`\`sh\npnpm add @${OWNER}/${name}\n\`\`\`\n\nIt needs Node 26 or newer, the Node it's built and tested on.\n`
      : "";
  return `# ${name}

${description}
${install}
Read [the docs](docs/README.md) for its design, plan and lessons. It follows [ship's standard](https://ship.amitkaps.com/docs/standard.md) for how it ${
    { site: "builds, checks and deploys", package: "builds, checks and releases", tool: "checks" }[
      kind
    ]
  }.
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
 * deploy commands are set on the Worker, as ship's standard lists. The site answers only on its
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
  kind: Kind,
  description: string,
  internal = false,
): Promise<void> {
  if (existsSync(dir)) throw new Error(`${dir} already exists`);
  const files: Record<string, string> = {
    "package.json": `${await packageJson(name, kind, description)}\n`,
    "pnpm-workspace.yaml": `${workspace(kind)}\n`,
    "tsconfig.json": `${tsconfig(kind)}\n`,
    "vite.config.ts": viteConfig(kind),
    ".github/workflows/ci.yml": ci(kind),
    "AGENTS.md": agents(name, description),
    "README.md": readme(name, kind, description),
    ".gitignore": own(".gitignore"),
    // An internal repository isn't shared, so it has no licence to share it under.
    ...(internal ? {} : { LICENSE: own("LICENSE") }),
  };
  if (kind === "site") {
    files["cloudflare.config.ts"] = cloudflareConfig(name, internal);
    files["index.html"] = page(name, description);
  } else {
    files["src/index.ts"] = entry(name, description);
    files["tests/index.test.ts"] = test;
    files["src/README.md"] = "# Source\n\nThe code, with [index.ts](index.ts) as its entry.\n";
    files["tests/README.md"] =
      "# Tests\n\nThe tests, one file for each part of [the source](../src/).\n";
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
  const internal = flag("--internal");
  const kind: Kind | undefined = flag("--package")
    ? "package"
    : flag("--site")
      ? "site"
      : flag("--tool")
        ? "tool"
        : undefined;
  const [name] = args;
  // A package is published to npm, so it can't be internal.
  if (
    !name ||
    !kind ||
    !description ||
    !/^[a-z][a-z0-9-]*$/.test(name) ||
    (internal && kind === "package")
  ) {
    console.error(
      'Usage: pnpm new <name> --package|--site|--tool --description "What it is, in a sentence." [--internal] [--push]\n--internal is for a site or a tool, since a package is public on npm.',
    );
    process.exit(1);
  }

  const dir = join(process.cwd(), name);
  await write(dir, name, kind, description, internal);
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
      internal ? "--private" : "--public",
      "--source",
      ".",
      "--push",
      "--description",
      description,
    );
    writeGitHub(name);
    fixGitHub(name, { private: kind !== "package" });
  }

  const left = [
    ...(push ? [] : [`Create ${OWNER}/${name} on GitHub, push main, then run pnpm align ${name}.`]),
    internal
      ? `Leave it out of REPOS, since craftz is public. Check it with pnpm drift ../${name} in craftz.`
      : `Add "${name}" to REPOS in craftz's src/survey.ts, in a pull request there.`,
    ...(kind === "site"
      ? [
          `Connect the Worker "${name}" to the repository, then run pnpm align ${name} to write its build settings.`,
        ]
      : []),
    ...(kind === "site" && internal
      ? [
          `Add an Access application for ${name}.amitkaps.com, with a policy that lets in only who it's for.`,
        ]
      : []),
    ...(kind === "package"
      ? [
          'Publish the first version by hand, then add the trusted publisher on npmjs.com, as "Setting up a new package" in craftz\'s rules says.',
        ]
      : []),
  ];
  console.log(`\n✓ ${dir}\n\nStill to do:`);
  for (const step of left) console.log(`- ${step}`);
}
