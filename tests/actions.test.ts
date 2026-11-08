/** @prose
 * # The actions' test
 *
 * GitHub is stood in for here. A workflow's actions are read as YAML, from jobs and steps. An action
 * a major behind is listed, one at the latest isn't, and one that can't be compared is named.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { type LatestTag, staleActions, usesIn } from "../src/actions.ts";
import { tmp } from "./temp.ts";

const workflow = `
name: Browser
jobs:
  browser:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - { name: Report, uses: "actions/upload-artifact@v4" }
      - uses: ./.github/actions/setup
      - run: echo uses actions/checkout@v1
  call:
    uses: acme/flows/.github/workflows/ci.yml@v2
`;

const releases =
  (tags: Record<string, string>): LatestTag =>
  (repo) =>
    tags[repo];

function reference(text: string): string {
  const dir = tmp("craftz-actions-");
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(join(dir, ".github", "workflows", "browser.yml"), text);
  return dir;
}

test("uses are read from jobs and steps, however they're written", () => {
  expect(usesIn(workflow)).toEqual([
    "actions/checkout@v7",
    "actions/upload-artifact@v4",
    "./.github/actions/setup",
    "acme/flows/.github/workflows/ci.yml@v2",
  ]);
  expect(usesIn("")).toEqual([]);
});

test("an action a major behind is listed, and one at the latest isn't", () => {
  const latest = releases({
    "actions/checkout": "v7.0.2",
    "actions/upload-artifact": "v7.0.2",
    "acme/flows": "v2.1.0",
  });
  expect(staleActions(reference(workflow), latest)).toEqual([
    "actions/upload-artifact v7, from v4",
  ]);
});

test("an action that can't be compared is named, not skipped", () => {
  const dir = reference(
    "jobs:\n  a:\n    steps:\n      - uses: acme/pinned@0123abc\n      - uses: acme/none@v1\n",
  );
  expect(staleActions(dir, releases({ "acme/pinned": "v3.0.0" }))).toEqual([
    "acme/none wasn't checked, since GitHub gave no release to compare with",
    "acme/pinned@0123abc wasn't checked, as it isn't a major tag",
  ]);
});
