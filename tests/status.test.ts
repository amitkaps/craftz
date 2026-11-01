/** @prose
 * # The status's test
 *
 * Holds what `craftz status` reads to the lines it prints: the latest run of each workflow, a
 * build that's running or done, and npm's version next to the package's. Reading GitHub, npm and
 * Cloudflare is left to running it.
 */
import { expect, test } from "vite-plus/test";
import { buildIn, npmIn, releaseIn, runsIn, slowestIn, stepsIn, timingIn } from "../src/status.ts";

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
  expect(npmIn("0.1.0", "0.1.0").found).toBe("0.1.0, as package.json on main");
  expect(npmIn("0.1.0", "0.1.1")).toEqual({
    what: "npm",
    found: "0.1.0, and package.json on main is at 0.1.1, not released yet",
    ok: true,
  });
  expect(npmIn(undefined, "0.0.0").found).toBe("not published");
});

test("a release's line is its tag, and its summary is the paragraph above GitHub's notes", () => {
  const release = {
    tagName: "v0.1.1",
    publishedAt: "2026-10-19T21:34:30Z",
    body: "What it did.\n\n<!-- generated -->\n\n## What's Changed\n* a",
  };
  expect(releaseIn(release)).toEqual({
    line: { what: "GitHub release", found: "v0.1.1, 2026-10-19 21:34 UTC", ok: true },
    summary: "What it did.",
  });
  expect(releaseIn({ ...release, body: "## What's Changed\n* a" }).summary).toBeUndefined();
  expect(releaseIn(undefined).line.found).toBe("none yet");
});

test("timing gives the spread, and the first reason each slow pull request fits", () => {
  const t = (minute: number) => new Date(Date.UTC(2026, 9, 24, 12, minute)).toISOString();
  const pr = (number: number, open: number, merge: number, commits: [number, number][] = []) => ({
    number,
    createdAt: t(open),
    mergedAt: t(merge),
    commits: [[open, 1] as [number, number], ...commits].map(([m, parents]) => ({
      oid: `c${number}-${m}`,
      committedDate: t(m),
      parents,
    })),
  });
  const run = (number: number, start: number, end: number, conclusion = "success") => ({
    workflowName: "CI",
    headSha: `c${number}-${start}`,
    conclusion,
    startedAt: t(start),
    updatedAt: t(end),
  });
  const lines = timingIn(
    [
      pr(1, 0, 2),
      pr(2, 10, 20),
      pr(3, 30, 40, [[35, 2]]),
      pr(4, 50, 58, [[55, 1]]),
      pr(5, 60, 70),
      pr(6, 100, 400),
    ],
    [run(1, 0, 1), run(2, 10, 11, "failure"), run(5, 60, 61), run(6, 100, 399)],
  );
  expect(lines.slice(4)).toEqual([
    "    over 5m         #2 10m 0s, a check failed",
    "                    #3 10m 0s, fell behind main, and CI ran again",
    "                    #4 8m 0s, work was added after it opened",
    "                    #5 10m 0s, merged 9m 0s after its checks passed",
    "                    #6 5h 0m, left open a while",
  ]);
  expect(lines[3]).toBe("    beside another  0 of 6");
  expect(timingIn([], [])).toEqual(["No merged pull requests to time."]);
});

test("the slowest step in verify is the last group its log prints", () => {
  // Lines as GitHub stamps them, from a CI run of craftz's verify, colours and all.
  const log = [
    "2026-10-29T15:21:00.6439714Z ##[group]Run pnpm run verify",
    "2026-10-29T15:21:03.0225602Z \x1b[1m── [@amitkaps/craftz#site] ──\x1b[0m",
    "2026-10-29T15:21:03.0899096Z ── [@amitkaps/craftz#build] ──",
    "2026-10-29T15:21:05.5441141Z ── [@amitkaps/craftz#check] ──",
    "2026-10-29T15:21:11.5358288Z ── [@amitkaps/craftz#test] ──",
    "2026-10-29T15:21:11.5376465Z [@amitkaps/craftz#all] $ true ⊘ cache disabled",
    "2026-10-29T15:21:11.6000000Z ── [@amitkaps/craftz#all] ──",
  ].join("\n");
  expect(slowestIn(log, "2026-10-29T15:21:00Z")).toEqual({ step: "test", at: 12 });
  expect(slowestIn("no groups here", "2026-10-29T15:21:00Z")).toBeUndefined();
});

test("each step's median over passing runs, and the slowest, leaving out GitHub's own steps", () => {
  const step = (name: string, from: number, to: number) => ({
    name,
    started_at: new Date(from * 1000).toISOString(),
    completed_at: new Date(to * 1000).toISOString(),
  });
  const run = (install: number, verify: number) => ({
    workflow: "CI",
    steps: [
      step("Set up job", 0, 2),
      step("Install", 2, 2 + install),
      step("Verify", 10, 10 + verify),
    ],
  });
  expect(stepsIn([run(3, 20), run(5, 30), run(4, 25)])).toEqual([
    "Steps, the median of each over recent runs that passed:",
    "    CI              Install 4s, Verify 25s",
    "                    slowest: Verify",
  ]);
  expect(stepsIn([])).toEqual([]);
});
