/** @prose
 * # The browser result's test
 *
 * Holds the sentence for the latest `browser` run on `main` to its four states, and to the case where
 * a newer run hides a red one. What it reads from GitHub is tried on a real repository, since a
 * test with GitHub faked says only that the fake agrees.
 */
import { expect, test } from "vite-plus/test";
import { type Run, browserWords, unread } from "../src/browser.ts";

const run = (conclusion: string | null, status = "completed"): Run => ({
  status,
  conclusion,
  head_sha: "0123456789abcdef",
});

test("a run that passed, failed or was cancelled says so, with its commit", () => {
  expect(browserWords([run("success")])).toBe("browser checks passed on main at 0123456");
  expect(browserWords([run("failure")])).toBe(
    "browser checks failed on main at 0123456. Fix them before the next change, or write down why not",
  );
  expect(browserWords([run("timed_out")])).toContain("browser checks failed on main");
  expect(browserWords([run("cancelled")])).toBe(
    "browser checks were cancelled on main at 0123456, so that commit has no result. Run it with gh workflow run browser.yml",
  );
});

test("a run still going, or none yet, says so", () => {
  expect(browserWords([])).toBe("browser checks haven't run on main yet");
  expect(browserWords([run(null, "in_progress"), run("success")])).toBe(
    "browser checks are still running on main",
  );
  expect(browserWords([run(null, "queued")])).toBe("browser checks are still running on main");
});

test("a run going on top of a red one says the red one is there", () => {
  expect(browserWords([run(null, "in_progress"), run("failure")])).toBe(
    "browser checks are still running on main, and the run before it failed",
  );
  expect(browserWords([run(null, "in_progress"), run(null, "in_progress"), run("cancelled")])).toBe(
    "browser checks are still running on main, and the run before it was cancelled",
  );
});

test("a missing workflow or a missing gh says nothing, and any other error is said", () => {
  expect(
    unread(
      "GET repos/o/r/actions/workflows/browser.yml/runs?branch=main: gh: Not Found (HTTP 404)",
    ),
  ).toBeUndefined();
  expect(unread("spawnSync gh ENOENT")).toBeUndefined();
  expect(
    unread(
      "GET repos/o/r/actions/workflows/browser.yml/runs: gh: API rate limit exceeded (HTTP 403)",
    ),
  ).toBe(
    "browser checks weren't read on main. GET repos/o/r/actions/workflows/browser.yml/runs: gh: API rate limit exceeded (HTTP 403)",
  );
});

test("a skipped or failed-to-start run reads as failed", () => {
  expect(browserWords([run("skipped")])).toContain("browser checks failed on main");
  expect(browserWords([run("startup_failure")])).toContain("browser checks failed on main");
});
