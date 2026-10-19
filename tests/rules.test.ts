/** @prose
 * # The rules' test
 *
 * Holds [the rules](../docs/rules.md) and [rules.ts](../src/rules.ts) to the same ids, so a rule
 * can't be stated without a check, or checked without being stated. Every check, with an id or
 * not yet, is under one of the doc's parts.
 */
import { expect, test } from "vite-plus/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BROWSERS } from "../src/browsers.ts";
import { COMPATIBILITY_DATE } from "../src/runtime.ts";
import { BETA, RULES } from "../src/rules.ts";
import { parts, stated } from "../src/stated.ts";
import { standard } from "../src/reference.ts";
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

test("the betas this repository is on are the ones the rules name", () => {
  const deps = { ...standard.dependencies, ...standard.devDependencies };
  const pre = Object.keys(deps).filter((name) => /^\d+\.\d+\.\d+-/.test(deps[name] ?? ""));
  expect(pre.sort()).toEqual([...BETA].sort());
});
