/** @prose
 * # The rules' test
 *
 * Holds [the rules](../docs/rules.md) and [rules.ts](../src/rules.ts) to the same ids, so a rule
 * can't be stated without a check, or checked without being stated. Every check, with an id or
 * not yet, is under one of the doc's parts.
 */
import { expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BROWSERS } from "../src/browsers.ts";
import { COMPATIBILITY_DATE } from "../src/runtime.ts";
import { site } from "../src/cloudflare.ts";
import { BETA, RULES } from "../src/rules.ts";
import { parts, printed, stated } from "../src/stated.ts";
import { CRAFTZ, type Pkg, VERSIONS, here, standard } from "../src/reference.ts";
import { rulesetFor } from "../src/settings.ts";
import { CHECKS, type Repo, worker } from "../src/survey.ts";

const checked = RULES.map((rule) => rule.id);
const statedIds = stated().map((s) => s.id);

test("each rule has one id", () => {
  expect(new Set(checked).size).toBe(checked.length);
  expect(new Set(statedIds).size).toBe(statedIds.length);
});

test("the rules doc states every rule that's checked, and only those", () => {
  expect([...statedIds].sort()).toEqual([...checked].sort());
});

test("a rule is read under its part, with its links resolved, and never from an example", () => {
  const markdown =
    "## Scripts and Node\n\n### Within\n\n- [`scripts-x`]{#scripts-x}: a rule, as [the reference](../reference/README.md) has it.\n\n```md\n- [`scripts-y`]{#scripts-y}: an example.\n```\n";
  expect(stated(markdown)).toEqual([
    {
      id: "scripts-x",
      text: "a rule, as [the reference](https://craftz.amitkaps.com/reference/README.md) has it.",
      part: "Scripts and Node",
    },
  ]);
});

test("the printed doc resolves every relative link against the site", () => {
  expect(printed("See [Holds](#holds) and [the reference](../reference/README.md).\n")).toBe(
    "See [Holds](https://craftz.amitkaps.com/docs/rules.md#holds) and [the reference](https://craftz.amitkaps.com/reference/README.md).\n",
  );
  expect(printed()).not.toMatch(/\]\((?!https?:)/);
});

test("the survey runs every rule", () => {
  const names = new Set(CHECKS.map((check) => check.name));
  expect(checked.filter((id) => !names.has(id))).toEqual([]);
});

test("every check is under a part of the rules", () => {
  const found = parts();
  for (const check of CHECKS) expect(found, check.name).toContain(check.group);
});

test("a part is its second-level heading", () => {
  expect(parts("## Scripts\n\n### The editor\n\n```md\n## An example\n```\n")).toEqual(["Scripts"]);
});

test("only the rules' betas are on a pre-release, each an exact build", () => {
  const rule = RULES.find((r) => r.id === "versions-beta");
  const drift = (deps: Record<string, string>) => rule?.check({ deps } as Repo)?.drift;
  const [beta = ""] = BETA;
  expect(drift({ [beta]: "1.0.0-beta.17" })).toEqual([]);
  expect(drift({ [beta]: "^1.0.0-beta.17" })).toEqual([
    `${beta} is ^1.0.0-beta.17, not an exact build`,
  ]);
  expect(drift({ zod: "4.0.0-beta.1" })).toEqual(["zod is on a pre-release, 4.0.0-beta.1"]);
  expect(drift({ zod: "^4.0.0", vite: "npm:@voidzero-dev/vite-plus-core@1.3.0" })).toBeUndefined();
});

test("our own package is exact and at least the reference's, and its fix only raises", () => {
  const name = "@amitkaps/markz";
  const want = VERSIONS[name] ?? "";
  const ahead = `${Number(want.split(".")[0]) + 1}.0.0`;
  const behind = "0.0.0";
  const rule = RULES.find((r) => r.id === "versions-markz");
  const drift = (value: string) =>
    rule?.check({ deps: { [name]: value } } as unknown as Repo)?.drift;
  expect(drift(want)).toEqual([]);
  expect(drift(ahead)).toEqual([]);
  expect(drift(behind)).toEqual([`${name} is ${behind}, behind ${want}`]);
  expect(drift(`^${want}`)).toEqual([`${name} is ^${want}, not an exact version`]);

  const fixed = (value: string) => {
    const dir = mkdtempSync(join(tmpdir(), "craftz-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ devDependencies: { [name]: value } }),
    );
    if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).devDependencies[name];
  };
  expect(fixed(ahead)).toBe(ahead);
  expect(fixed(behind)).toBe(want);
  expect(fixed(`^${want}`)).toBe(want);
});

test("a build for browsers targets this repository's browsers", () => {
  const rule = RULES.find((r) => r.id === "toolchain-browsers");
  const list = BROWSERS.map((b) => `"${b}"`).join(", ");
  const drift = (vite: string, deploys = false, pkg: Pkg = { private: true }, directory?: string) =>
    rule?.check({
      pkg,
      files: { "vite.config.ts": vite },
      worker: deploys ? { deploys: "app", directory } : undefined,
    } as unknown as Repo)?.drift;
  const pkg: Pkg = {};
  expect(BROWSERS.length).toBeGreaterThan(0);
  expect(
    drift(`plugins: [craftz()], pack: { entry: ["src/index.ts"] }`, false, pkg),
  ).toBeUndefined();
  expect(drift("plugins: [craftz()]", true, { private: true }, ".prose")).toBeUndefined();
  expect(drift(`plugins: [craftz({ browser: true })], pack: {}`, false, pkg)).toEqual([]);
  expect(drift(`pack: { target: [${list}, "node26"] }`, false, pkg)).toEqual([
    "pack.target is set. A package for browsers says craftz({ browser: true })",
  ]);
  expect(drift(`build: { target: [${list}] }`, true)).toEqual([]);
  expect(drift(`plugins: [sveltekit()]`, true)).toEqual(["build.target isn't set"]);
  expect(drift(`build: { target: ["chrome111"] }`, true)).toEqual([
    `build.target is chrome111, not ${BROWSERS.join(" ")}`,
  ]);
});

test("a config with craftz() has the format and lint the rules set", () => {
  const drift = (id: string, vite: string) =>
    RULES.find((r) => r.id === id)?.check({
      files: { "vite.config.ts": vite },
      vitePlus: "1",
    } as unknown as Repo)?.drift;
  for (const id of ["toolchain-wrap", "toolchain-lint"]) {
    expect(drift(id, "plugins: [craftz()],")).toEqual([]);
    expect(drift(id, "plugins: [sveltekit(), craftz()],")).toEqual([]);
    expect(drift(id, "// craftz() isn't used yet")).not.toEqual([]);
  }
});

test("every repository but craftz depends on craftz and uses craftz()", () => {
  const rule = RULES.find((r) => r.id === "toolchain-craftz");
  const drift = (name: string, deps: Record<string, string>, vite: string) =>
    rule?.check({
      pkg: { name },
      deps,
      files: { "vite.config.ts": vite },
      vitePlus: "1",
    } as unknown as Repo)?.drift;
  const used = "plugins: [craftz()],";
  expect(drift("x", { [CRAFTZ]: "^0.1.0" }, used)).toEqual([]);
  expect(drift(CRAFTZ, {}, used)).toEqual([]);
  expect(drift("x", {}, "")).toEqual([
    `doesn't depend on ${CRAFTZ}`,
    "vite.config.ts has no craftz()",
  ]);
});

test("a site ships through craftz deploy", () => {
  const rule = RULES.find((r) => r.id === "scripts-ship");
  const drift = (name: string, ship: string, site = true) =>
    rule?.check({ pkg: { name, scripts: { ship } }, worker: site || undefined } as unknown as Repo)
      ?.drift;
  expect(drift("x", "craftz deploy")).toEqual([]);
  expect(drift(CRAFTZ, "node src/cli.ts deploy")).toEqual([]);
  expect(drift("x", "cf deploy --prebuilt")).toEqual([
    "ship is cf deploy --prebuilt, not craftz deploy",
  ]);
  expect(drift("x", "cf deploy --prebuilt", false)).toBeUndefined();
});

test("craftz's version is its own, exactly", () => {
  const own = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
    version: string;
  };
  expect(VERSIONS[CRAFTZ]).toBe(own.version);
});

test("the fix adds craftz, and takes out the blocks the plugin sets", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-use-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "x", devDependencies: { "vite-plus": "1.3.0" } }),
  );
  writeFileSync(
    join(dir, "vite.config.ts"),
    `import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare({ assetsOnly: true })],

  test: { include: ["tests/**/*.test.ts"] },
});
`,
  );
  const fix = RULES.find((r) => r.id === "toolchain-craftz")?.fix;
  if (fix?.in === "files") fix.apply(dir, here);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    devDependencies: Record<string, string>;
  };
  expect(Object.keys(pkg.devDependencies)).toEqual([CRAFTZ, "vite-plus"]);
  expect(pkg.devDependencies[CRAFTZ]).toBe(VERSIONS[CRAFTZ]);
  expect(readFileSync(join(dir, "vite.config.ts"), "utf8"))
    .toBe(`import { defineConfig } from "vite-plus";
import { craftz } from "@amitkaps/craftz";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [craftz(), cloudflare({ assetsOnly: true })],

  test: { include: ["tests/**/*.test.ts"] },
});
`);
});

test("the fix keeps a config's plugins one to a line", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-lines-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
  writeFileSync(
    join(dir, "vite.config.ts"),
    `import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    cloudflare({ assetsOnly: true }),
  ],
});
`,
  );
  const fix = RULES.find((r) => r.id === "toolchain-craftz")?.fix;
  if (fix?.in === "files") fix.apply(dir, here);
  expect(readFileSync(join(dir, "vite.config.ts"), "utf8"))
    .toBe(`import { defineConfig } from "vite-plus";
import { craftz } from "@amitkaps/craftz";

export default defineConfig({
  plugins: [
    craftz(),
    cloudflare({ assetsOnly: true }),
  ],
});
`);
});

test("the files craftz owns are its own word for word, and the fix writes them whole", () => {
  const read = (file: string) => readFileSync(join(here, file), "utf8");
  const ci = read(".github/workflows/ci.yml");
  const workspace = read("pnpm-workspace.yaml");
  // A Vite+ that's behind keeps its override, so only versions-vite-plus says it's behind.
  const held = workspace.replace(/vite-plus-core@[\w.-]+/, "vite-plus-core@1.0.0");
  const dir = mkdtempSync(join(tmpdir(), "craftz-owned-"));
  const pkg = { name: "x", devDependencies: { "vite-plus": "1.0.0" } };
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });
  writeFileSync(join(dir, ".github/workflows/ci.yml"), ci.replace("name: Verify", "name: Check"));
  writeFileSync(join(dir, "pnpm-workspace.yaml"), workspace);
  const files = () =>
    Object.fromEntries(
      [".github/workflows/ci.yml", "pnpm-workspace.yaml"].map((file) => [
        file,
        readFileSync(join(dir, file), "utf8"),
      ]),
    );
  const repo = () => ({ pkg, files: files(), deps: pkg.devDependencies, vitePlus: "1.0.0" });
  const ids = ["github-ci", "versions-workspace"];
  const rules = RULES.filter((r) => ids.includes(r.id));
  expect(rules.map((rule) => rule.check(repo() as unknown as Repo)?.drift)).toEqual([
    ["pnpm-workspace.yaml differs from craftz's"],
    [".github/workflows/ci.yml differs from craftz's"],
  ]);
  for (const rule of rules) if (rule.fix?.in === "files") rule.fix.apply(dir, here);
  expect(files()).toEqual({ ".github/workflows/ci.yml": ci, "pnpm-workspace.yaml": held });
  expect(rules.map((rule) => rule.check(repo() as unknown as Repo)?.drift)).toEqual([[], []]);
});

test("the editor's settings are compared as JSON, and an app's add Svelte's", () => {
  const settings = ".vscode/settings.json";
  const extensions = ".vscode/extensions.json";
  const read = (file: string) => JSON.parse(readFileSync(join(here, file), "utf8")) as object;
  const rule = RULES.find((r) => r.id === "toolchain-editor");
  const repo = (files: object, deploys?: string) =>
    ({ pkg: {}, files, worker: deploys && { deploys } }) as unknown as Repo;
  // Laid out otherwise, as `vp fmt` can, it's still the reference's.
  const spread = {
    [settings]: JSON.stringify(read(settings), null, 4),
    [extensions]: JSON.stringify(read(extensions), null, 4),
  };
  expect(rule?.check(repo(spread))?.drift).toEqual([]);
  expect(rule?.check(repo(spread, "app"))?.drift).toEqual([
    `${settings} differs from craftz's`,
    `${extensions} differs from craftz's`,
  ]);
  const app = {
    [settings]: JSON.stringify({ ...read(settings), ...read(`app/${settings}`) }),
    [extensions]: JSON.stringify({
      recommendations: ["oxc.oxc-vscode", "vitest.explorer", "svelte.svelte-vscode"],
    }),
  };
  expect(rule?.check(repo(app, "app"))?.drift).toEqual([]);
});

test("verify runs prose outline and craftz check after prose check, and the fix puts them there once", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-verify-"));
  const file = join(dir, "package.json");
  const verify = "pnpm check && pnpm prose check && pnpm test";
  writeFileSync(file, JSON.stringify({ scripts: { verify } }));
  const rule = RULES.find((r) => r.id === "scripts-verify");
  const read = () => JSON.parse(readFileSync(file, "utf8")) as Pkg;
  expect(rule?.check({ pkg: read() } as Repo)?.drift).toEqual([
    "verify doesn't run pnpm prose outline",
    "verify doesn't run pnpm craftz check",
  ]);
  for (let i = 0; i < 2; i++) if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
  expect(read().scripts?.["verify"]).toBe(
    "pnpm check && pnpm prose check && pnpm prose outline && pnpm craftz check && pnpm test",
  );
  expect(rule?.check({ pkg: read() } as Repo)?.drift).toEqual([]);
});

test("verify gains prose outline where it already runs craftz check", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-verify-"));
  const file = join(dir, "package.json");
  writeFileSync(
    file,
    JSON.stringify({ scripts: { verify: "pnpm prose check && pnpm craftz check" } }),
  );
  const rule = RULES.find((r) => r.id === "scripts-verify");
  if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
  const pkg = JSON.parse(readFileSync(file, "utf8")) as Pkg;
  expect(pkg.scripts?.["verify"]).toBe(
    "pnpm prose check && pnpm prose outline && pnpm craftz check",
  );
});

test(".gitignore lists outline.md, and the fix adds it once", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-outline-"));
  const file = join(dir, ".gitignore");
  writeFileSync(file, "node_modules\n");
  const rule = RULES.find((r) => r.id === "agents-outline");
  const check = () =>
    rule?.check({ files: { ".gitignore": readFileSync(file, "utf8") } } as unknown as Repo)?.drift;
  expect(check()).toEqual([".gitignore doesn't list outline.md"]);
  for (let i = 0; i < 2; i++) if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
  expect(readFileSync(file, "utf8")).toBe(
    "node_modules\n\n# Written by prose outline\noutline.md\n",
  );
  expect(check()).toEqual([]);
});

test("the site fix rewrites a cf config as site(), serving Vite's folder, once", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-site-"));
  const file = join(dir, "cloudflare.config.ts");
  const config = (worker: string) => `import { defineConfig } from "cf/config";
import { worker } from "${CRAFTZ}/cloudflare";

export default defineConfig({
  worker: worker({
    name: "x",
    domains: ["x.amitkaps.com"],
    ${worker}
    assets: {
      // Its own 404 page.
      notFoundHandling: "404-page",
    },
  }),
});
`;
  writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { verify: "pnpm check" } }));
  writeFileSync(join(dir, "vite.config.ts"), `export default {\n  publicDir: "site/dist",\n};\n`);
  const fix = RULES.find((r) => r.id === "cloudflare-site")?.fix;
  writeFileSync(file, config('compatibilityDate: "2026-10-12",'));
  for (let i = 0; i < 2; i++) if (fix?.in === "files") fix.apply(dir, here);
  expect(readFileSync(file, "utf8")).toBe(`import { site } from "${CRAFTZ}/cloudflare";

export default site({
  name: "x",
  domains: ["x.amitkaps.com"],
  assets: {
    directory: "site/dist",
    // Its own 404 page.
    notFoundHandling: "404-page",
  },
});
`);
  // An assets object on one line takes the folder in the same object.
  writeFileSync(
    file,
    config('compatibilityDate: "2026-10-12",').replace(
      /assets: \{\n.*\n.*\n {4}\},/,
      'assets: { notFoundHandling: "404-page" },',
    ),
  );
  if (fix?.in === "files") fix.apply(dir, here);
  expect(readFileSync(file, "utf8")).toContain(
    '  assets: { directory: "site/dist", notFoundHandling: "404-page" },\n});',
  );
  // site() would fail a Worker that turns an address on, so that's left by hand.
  const on = config("workersDev: true,");
  writeFileSync(file, on);
  if (fix?.in === "files") fix.apply(dir, here);
  expect(readFileSync(file, "utf8")).toBe(on);
});

test("a site's Worker is site(), which the survey reads with its folder", () => {
  const drift = (text: string) => {
    const files = { "cloudflare.config.ts": text };
    const repo = { files, worker: worker(files) } as unknown as Repo;
    return RULES.find((r) => r.id === "cloudflare-site")?.check(repo)?.drift;
  };
  const old = `import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "x",
  },
});
`;
  expect(drift(old)).toEqual(["cloudflare.config.ts has no site()"]);
  const config = `import { site } from "${CRAFTZ}/cloudflare";

export default site({
  name: "x",
  domains: ["x.amitkaps.com"],
  assets: { directory: ".prose" },
});
`;
  expect(drift(config)).toEqual([]);
  expect(worker({ "cloudflare.config.ts": config })).toMatchObject({
    domain: "x.amitkaps.com",
    workersDev: false,
    previewUrls: false,
    directory: ".prose",
    deploys: "static",
  });
});

test("site() sets the date and addresses, and fails a config that sets them", () => {
  const assets = { directory: "dist" };
  expect(site({ name: "x", domains: [], assets })).toEqual({
    name: "x",
    domains: [],
    assets,
    compatibilityDate: COMPATIBILITY_DATE,
    workersDev: false,
    previewUrls: false,
  });
  expect(() =>
    // The types refuse it too, so it's cast, as a JavaScript config would pass it.
    site({ name: "x", domains: [], assets, workersDev: true } as never),
  ).toThrow("site() sets workersDev, so cloudflare.config.ts can't");
});

test("a static site installs nothing of Cloudflare's, and the fix takes it out, once", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-static-"));
  const config = `import { site } from "${CRAFTZ}/cloudflare";

export default site({
  name: "x",
  domains: [],
  assets: { directory: ".prose" },
});
`;
  writeFileSync(join(dir, "cloudflare.config.ts"), config);
  const pkg = {
    scripts: { build: "vp pack", verify: "pnpm build && pnpm prose build && vp build" },
    devDependencies: { "@cloudflare/vite-plugin": "2.0.0", cf: "1.0.0", "vite-plus": "1.3.0" },
  };
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
  writeFileSync(
    join(dir, "vite.config.ts"),
    `import { defineConfig, lazyPlugins } from "vite-plus";
import { craftz } from "@amitkaps/craftz";

export default defineConfig({
  plugins: [
    craftz(),
    lazyPlugins(async () => {
      const { cloudflare } = await import("@cloudflare/vite-plugin");
      return [cloudflare({ assetsOnly: true })];
    }),
  ],

  // The site is the folder \`prose build\` writes.
  publicDir: ".prose",
});
`,
  );
  const rule = RULES.find((r) => r.id === "cloudflare-static");
  const drift = () => {
    const read = (file: string) => readFileSync(join(dir, file), "utf8");
    const own = JSON.parse(read("package.json")) as Pkg;
    const files = { "vite.config.ts": read("vite.config.ts"), "cloudflare.config.ts": config };
    const repo = { pkg: own, files, deps: own.devDependencies, worker: worker(files) };
    return rule?.check(repo as unknown as Repo)?.drift;
  };
  expect(drift()).toEqual([
    "depends on cf, which a static site doesn't use",
    "depends on @cloudflare/vite-plugin, which a static site doesn't use",
    "vite.config.ts loads Cloudflare's plugin",
    "verify runs vp build, with no index.html to build",
  ]);
  for (let i = 0; i < 2; i++) if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
  expect(readFileSync(join(dir, "vite.config.ts"), "utf8"))
    .toBe(`import { defineConfig } from "vite-plus";
import { craftz } from "@amitkaps/craftz";

export default defineConfig({
  plugins: [
    craftz(),
  ],

});
`);
  expect(drift()).toEqual([]);
});

test("the betas this repository is on are the ones the rules name", () => {
  const deps = { ...standard.dependencies, ...standard.devDependencies };
  const pre = Object.keys(deps).filter((name) => /^\d+\.\d+\.\d+-/.test(deps[name] ?? ""));
  expect(pre.sort()).toEqual([...BETA].sort());
});

test("a package's ruleset requires label next to ci, and others only ci", () => {
  const contexts = (pkg: Pkg) =>
    rulesetFor(pkg)
      .rules.flatMap(
        (rule) => (rule.parameters?.["required_status_checks"] ?? []) as { context: string }[],
      )
      .map((check) => check.context);
  expect(contexts({ name: "x" })).toEqual(["ci", "label"]);
  expect(contexts({ private: true })).toEqual(["ci"]);
});

test("a tsconfig extends craftz's and only says what to include, and the fix writes it so", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-tsconfig-"));
  const file = join(dir, "tsconfig.json");
  const rule = RULES.find((r) => r.id === "toolchain-types");
  const drift = () =>
    rule?.check({ files: { "tsconfig.json": readFileSync(file, "utf8") } } as unknown as Repo)
      ?.drift;
  const shared = `${CRAFTZ}/tsconfig.json`;
  // A tsconfig's comments and trailing commas parse.
  writeFileSync(
    file,
    `{\n  // Its own options.\n  "compilerOptions": { "strict": true, },\n  "include": ["src", "// not a comment"],\n}\n`,
  );
  expect(drift()).toEqual([
    `tsconfig.json doesn't extend ${shared}`,
    `tsconfig.json sets compilerOptions, which is ${shared}'s`,
  ]);
  for (let i = 0; i < 2; i++) if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
    extends: shared,
    include: ["src", "// not a comment"],
  });
  expect(drift()).toEqual([]);
});
