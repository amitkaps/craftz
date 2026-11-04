/** @prose
 * # The next steps' test
 *
 * `pnpm bump` ends by saying what to do. A merged pull request lets the release go ahead, and a
 * new major left for review never blocks it. A failure or a change left by hand does, and a run
 * with `--local` says it pushed nothing.
 */
import { expect, test } from "vite-plus/test";
import { next, row, type Row } from "../src/report.ts";

const made = (changes: Partial<Row>): Row => ({ ...row("craftz"), ...changes });

test("a merged bump lets the release go ahead", () => {
  const lines = next([made({ status: "verified", pr: "https://github.com/a/b/pull/1" })], false);
  expect(lines[0]).toBe("Next");
  expect(lines.join("\n")).toContain("The pull request merged");
  expect(lines.join("\n")).toContain("`pnpm craftz release`");
});

test("a bump that changed nothing says there's no pull request", () => {
  expect(next([made({ status: "in line" })], false).join("\n")).toContain("no pull request");
});

test("a major left for review is a choice, and never blocks the release", () => {
  const text = next(
    [made({ status: "verified", pr: "x", review: ["actions/upload-artifact v7, from v4"] })],
    false,
  ).join("\n");
  expect(text).toContain("Decide each line under Left for review");
  expect(text).toContain("none of it blocks a release");
  expect(text).toContain("`pnpm craftz release`");
});

test("a failure or a change left by hand blocks the release", () => {
  for (const status of ["failed", "left by hand"] as const) {
    const text = next([made({ status })], false).join("\n");
    expect(text).toContain("`pnpm bump` again");
    expect(text).not.toContain("`pnpm craftz release`");
  }
});

test("a local run says it pushed nothing", () => {
  const text = next([made({ status: "verified" })], true).join("\n");
  expect(text).toContain("`--local` pushed nothing");
  expect(text).not.toContain("`pnpm craftz release`");
});
