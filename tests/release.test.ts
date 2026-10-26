/** @prose
 * # The release's test
 *
 * A release starts from a current plan. Its summary names the version, and no step is ticked,
 * since a finished step has left Next. Reading the plan from GitHub is left to running it.
 */
import { expect, test } from "vite-plus/test";
import { unready } from "../src/release.ts";

const plan = (summary: string, next = "- **A step.** Still to do."): string =>
  `# Plan\n\n${summary}\n\n## Next, in order\n\n${next}\n`;

test("a plan that names the version and ticks nothing is ready", () => {
  expect(unready(plan("craftz 0.9.0 is on npm."), "0.9.0")).toBeUndefined();
});

test("a plan that names another version isn't", () => {
  expect(unready(plan("craftz 0.8.0 is on npm."), "0.9.0")).toBe("its summary doesn't name 0.9.0");
  expect(unready(plan("craftz is on npm.", "- 0.9.0 comes next."), "0.9.0")).toBe(
    "its summary doesn't name 0.9.0",
  );
});

test("a ticked step isn't ready", () => {
  expect(unready(plan("0.9.0 is on npm.", "- [x] **Done.** Merged."), "0.9.0")).toBe(
    "it has a ticked step, which belongs in Where it is",
  );
});

test("the summary is read after the metadata", () => {
  expect(unready(`---\ntitle: Plan\n---\n${plan("0.9.0 is on npm.")}`, "0.9.0")).toBeUndefined();
});
