/** @prose
 * # The e2e result's test
 *
 * Holds the sentence for the latest `e2e` run on `main` to its four states, and to the case where
 * a newer run hides a red one. What it reads from GitHub is tried on a real repository, since a
 * test with GitHub faked says only that the fake agrees.
 */
import { expect, test } from "vite-plus/test";
import { type Run, e2eWords, unread } from "../src/e2e.ts";

const run = (conclusion: string | null, status = "completed"): Run => ({
  status,
  conclusion,
  head_sha: "0123456789abcdef",
});

test("a run that passed, failed or was cancelled says so, with its commit", () => {
  expect(e2eWords([run("success")])).toBe("e2e passed on main at 0123456");
  expect(e2eWords([run("failure")])).toBe(
    "e2e failed on main at 0123456. Fix it before the next change, or write down why not",
  );
  expect(e2eWords([run("timed_out")])).toContain("e2e failed on main");
  expect(e2eWords([run("cancelled")])).toBe(
    "e2e was cancelled on main at 0123456, so that commit has no result. Run it with gh workflow run e2e.yml",
  );
});

test("a run still going, or none yet, says so", () => {
  expect(e2eWords([])).toBe("e2e hasn't run on main yet");
  expect(e2eWords([run(null, "in_progress"), run("success")])).toBe("e2e is still running on main");
  expect(e2eWords([run(null, "queued")])).toBe("e2e is still running on main");
});

test("a run going on top of a red one says the red one is there", () => {
  expect(e2eWords([run(null, "in_progress"), run("failure")])).toBe(
    "e2e is still running on main, and the run before it failed",
  );
  expect(e2eWords([run(null, "in_progress"), run(null, "in_progress"), run("cancelled")])).toBe(
    "e2e is still running on main, and the run before it was cancelled",
  );
});

test("a missing workflow or a missing gh says nothing, and any other error is said", () => {
  expect(
    unread("GET repos/o/r/actions/workflows/e2e.yml/runs?branch=main: gh: Not Found (HTTP 404)"),
  ).toBeUndefined();
  expect(unread("spawnSync gh ENOENT")).toBeUndefined();
  expect(
    unread("GET repos/o/r/actions/workflows/e2e.yml/runs: gh: API rate limit exceeded (HTTP 403)"),
  ).toBe(
    "e2e on main wasn't read. GET repos/o/r/actions/workflows/e2e.yml/runs: gh: API rate limit exceeded (HTTP 403)",
  );
});

test("a skipped or failed-to-start run reads as failed", () => {
  expect(e2eWords([run("skipped")])).toContain("e2e failed on main");
  expect(e2eWords([run("startup_failure")])).toContain("e2e failed on main");
});
