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
import { BETA, RULES } from "../src/rules.ts";
import { parts, stated } from "../src/stated.ts";
import { CRAFTZ, VERSIONS, here, standard } from "../src/reference.ts";
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

test("a rule points to its own id", () => {
  const markdown =
    "## Scripts and Node\n\n- [`scripts-x`]{#scripts-x}: a rule.\n\n```md\n- [`scripts-y`]{#scripts-y}: an example.\n```\n";
  expect(stated(markdown)).toEqual([
    {
      id: "scripts-x",
      text: "a rule.",
      part: "Scripts and Node",
      see: "craftz rules scripts-x",
    },
  ]);
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

test("a build for browsers targets this repository's browsers", () => {
  const rule = RULES.find((r) => r.id === "toolchain-browsers");
  const list = BROWSERS.map((b) => `"${b}"`).join(", ");
  const drift = (vite: string, site = false) =>
    rule?.check({ files: { "vite.config.ts": vite }, worker: site || undefined } as unknown as Repo)
      ?.drift;
  expect(BROWSERS.length).toBeGreaterThan(0);
  expect(drift(`pack: { platform: "node" }`)).toBeUndefined();
  expect(drift(`publicDir: ".prose"`, true)).toBeUndefined();
  expect(drift(`pack: { target: [${list}, "node26"] }`)).toEqual([]);
  expect(drift(`build: { target: [${list}] }`, true)).toEqual([]);
  expect(drift(`plugins: [sveltekit()]`, true)).toEqual(["build.target isn't set"]);
  expect(drift(`pack: { target: ["chrome111"] }`)).toEqual([
    `pack.target is chrome111, not ${BROWSERS.join(" ")}`,
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

test("craftz's version is its own, as a caret range", () => {
  const own = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
    version: string;
  };
  expect(VERSIONS[CRAFTZ]).toBe(`^${own.version}`);
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

  // oxfmt's defaults, with each Markdown paragraph on one line.
  fmt: { proseWrap: "never" },

  // Type-aware lint that also type-checks.
  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
  },

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

test("the fix keeps a config's own keys, and its plugins one to a line", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-trim-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
  writeFileSync(
    join(dir, "vite.config.ts"),
    `import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    cloudflare({ assetsOnly: true }),
  ],

  // Oxfmt.
  fmt: { proseWrap: "never", ignorePatterns: ["dist/**"] },

  // Oxlint.
  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["dist/**"],
  },
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

  // Oxfmt.
  fmt: { ignorePatterns: ["dist/**"] },

  // Oxlint.
  lint: {
    ignorePatterns: ["dist/**"],
  },
});
`);
});

test("a package's CI groups a label's run apart, and the fix writes it", () => {
  const ci = readFileSync(join(here, ".github/workflows/ci.yml"), "utf8");
  const old = ci.replace(
    /^# A new push[\s\S]*?^concurrency:\n.*\n/m,
    "concurrency:\n  group: ci-${{ github.ref }}\n",
  );
  expect(old).not.toBe(ci);
  const dir = mkdtempSync(join(tmpdir(), "craftz-ci-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });
  writeFileSync(join(dir, ".github/workflows/ci.yml"), old);
  const rule = RULES.find((r) => r.id === "releases-files");
  const files = { ".github/workflows/ci.yml": old };
  expect(rule?.check({ pkg: { name: "x" }, files } as unknown as Repo)?.drift).toContain(
    "ci.yml's concurrency isn't craftz's",
  );
  if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
  expect(readFileSync(join(dir, ".github/workflows/ci.yml"), "utf8")).toContain(
    ci.slice(ci.indexOf("concurrency:"), ci.indexOf("permissions:")),
  );
});

test("a prose site names .prose as its folder, and the fix writes it", () => {
  const vite =
    "export default defineConfig({\n  plugins: [craftz(), cloudflare({ assetsOnly: true })],\n});\n";
  const dir = mkdtempSync(join(tmpdir(), "craftz-prose-site-"));
  writeFileSync(join(dir, "vite.config.ts"), vite);
  const rule = RULES.find((r) => r.id === "cloudflare-prose-site");
  const repo = (text: string) =>
    ({
      files: { "vite.config.ts": text, ".gitignore": ".cloudflare\n.wrangler\n" },
      pkg: { scripts: { build: "vp pack", verify: "pnpm prose build && vp build" } },
      worker: { file: "cloudflare.config.ts" },
    }) as unknown as Repo;
  expect(rule?.check(repo(vite))?.drift).toEqual(["vite.config.ts doesn't serve .prose"]);
  if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
  const fixed = readFileSync(join(dir, "vite.config.ts"), "utf8");
  expect(fixed).toContain('  publicDir: ".prose",\n');
  expect(rule?.check(repo(fixed))?.drift).toEqual([]);
});

test("a Worker answers on its domain only, at the runtime's date, and the fixes write both", () => {
  const config = `export default defineConfig({
  worker: {
    name: "x",
    compatibilityDate: "2026-09-09",
    domains: ["x.amitkaps.com"],
    previewUrls: true,
  },
});
`;
  const drift = (text: string) => {
    const files = { "cloudflare.config.ts": text };
    const repo = { files, worker: worker(files) } as unknown as Repo;
    return ["cloudflare-addresses", "cloudflare-date"].flatMap(
      (id) => RULES.find((r) => r.id === id)?.check(repo)?.drift ?? [],
    );
  };
  expect(drift(config)).toEqual([
    "cloudflare.config.ts doesn't turn off workers.dev",
    "cloudflare.config.ts doesn't turn off preview URLs",
    `compatibilityDate is 2026-09-09, not ${COMPATIBILITY_DATE}`,
  ]);
  const dir = mkdtempSync(join(tmpdir(), "craftz-worker-"));
  writeFileSync(join(dir, "cloudflare.config.ts"), config);
  for (const r of RULES)
    if (r.id.startsWith("cloudflare-") && r.fix?.in === "files") r.fix.apply(dir, dir);
  const fixed = readFileSync(join(dir, "cloudflare.config.ts"), "utf8");
  expect(drift(fixed)).toEqual([]);
  expect(fixed).toContain(
    `domains: ["x.amitkaps.com"],\n    workersDev: false,\n    previewUrls: false,`,
  );
  expect(
    drift(config.replace("previewUrls: true,", 'compatibilityFlags: ["nodejs_als"],')),
  ).toContain("sets a Node.js compatibility flag");
});

test("the agents' fix writes craftz over the Standard section it replaces", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-agents-"));
  const old =
    "# AGENTS.md\n\nx\n\n## Standard\n\nOld.\n\n## Prose\n\nOld.\n\n## This repository\n\nOurs.\n";
  writeFileSync(join(dir, "AGENTS.md"), old);
  const rule = RULES.find((r) => r.id === "agents-sections");
  if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
  const text = readFileSync(join(dir, "AGENTS.md"), "utf8");
  const files = { "AGENTS.md": text, "CLAUDE.md": "@AGENTS.md\n" };
  expect(rule?.check({ files } as unknown as Repo)?.drift ?? []).toEqual([]);
  expect(text).not.toContain("## Standard");
  expect(text).toMatch(
    /^# AGENTS\.md\n\nx\n\n## craftz\n[\s\S]*## Prose\n[\s\S]*## This repository\n\nOurs\.\n$/,
  );
});

test("the betas this repository is on are the ones the rules name", () => {
  const deps = { ...standard.dependencies, ...standard.devDependencies };
  const pre = Object.keys(deps).filter((name) => /^\d+\.\d+\.\d+-/.test(deps[name] ?? ""));
  expect(pre.sort()).toEqual([...BETA].sort());
});

test("the old standard's links and name become craftz's", () => {
  const dir = mkdtempSync(join(tmpdir(), "craftz-old-"));
  mkdirSync(join(dir, "docs"));
  const old = `What every repository shares is in [ship's standard](https://ship.amitkaps.com/docs/standard.md#releases), as [ship](https://ship.amitkaps.com) has it.\n`;
  writeFileSync(join(dir, "docs/development.md"), old);
  const rule = RULES.find((r) => r.id === "docs-old-name");
  const files = { "docs/development.md": old, ".github/workflows/ci.yml": "" };
  expect(rule?.check({ files } as unknown as Repo)?.drift).toEqual([
    "docs/development.md names the old standard",
  ]);
  if (rule?.fix?.in === "files") rule.fix.apply(dir, here);
  expect(readFileSync(join(dir, "docs/development.md"), "utf8")).toBe(
    `What every repository shares is in [craftz's rules](https://craftz.amitkaps.com/docs/rules.md#releases), as [craftz](https://craftz.amitkaps.com) has it.\n`,
  );
});
