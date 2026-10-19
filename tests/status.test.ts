/** @prose
 * # The status's test
 *
 * Holds what `craftz status` reads to the lines it prints: the latest run of each workflow, a
 * build that's running or done, and npm's version next to the package's. Reading GitHub, npm and
 * Cloudflare is left to running it.
 */
import { expect, test } from "vite-plus/test";
import { buildIn, npmIn, runsIn } from "../src/status.ts";

const run = (workflowName: string, status: string, conclusion: string, headSha = "abcdef123") => ({
  workflowName,
  status,
  conclusion,
  headSha,
});

test("each workflow's latest run on main, where going isn't failing", () => {
  expect(
    runsIn([
      run("CI", "in_progress", ""),
      run("CI", "completed", "failure"),
      run("release", "completed", "skipped"),
    ]),
  ).toEqual([
    { what: "CI", found: "in_progress on abcdef1", ok: true },
    { what: "release", found: "skipped on abcdef1", ok: true },
  ]);
  expect(runsIn([run("CI", "completed", "failure")])[0]?.ok).toBe(false);
});

test("a build that's done says how, and one that's running isn't a failure", () => {
  const build = (status: string, build_outcome: string | null) => ({
    build_uuid: "x",
    status,
    build_outcome,
    created_on: "2026-10-19T20:49:13.843Z",
    build_trigger_metadata: { commit_hash: "f7b110e85d", deploy_command: "pnpm run ship" },
  });
  expect(buildIn(build("stopped", "success"))).toEqual({
    what: "build",
    found: "success on f7b110e, 2026-10-19 20:49 UTC, deployed with pnpm run ship",
    ok: true,
  });
  expect(buildIn(build("stopped", "failure")).ok).toBe(false);
  expect(buildIn(build("running", null))).toEqual({
    what: "build",
    found: "running on f7b110e, started 2026-10-19 20:49 UTC",
    ok: true,
  });
  expect(buildIn(undefined).ok).toBe(false);
});

test("a version npm doesn't have yet is said, not failed", () => {
  expect(npmIn("0.1.0", "0.1.0").found).toBe("0.1.0, as package.json");
  expect(npmIn("0.1.0", "0.1.1")).toEqual({
    what: "npm",
    found: "0.1.0, and package.json is at 0.1.1, not released yet",
    ok: true,
  });
  expect(npmIn(undefined, "0.0.0").found).toBe("not published");
});
