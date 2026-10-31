/** @prose
 * # The GitHub module's test
 *
 * Holds the GitHub module to its pure parts. That's the repository a remote names, whichever host
 * serves it, and a pull request read from REST in the words `gh pr view` used. What it calls on
 * GitHub is tried on the real repository, since a test with GitHub faked says only that the fake
 * agrees.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { pullOf, slugOf } from "../src/github.ts";

test("a remote names its repository by its last two path segments, whoever serves it", () => {
  expect(slugOf("git@github.com:amitkaps/craftz.git")).toBe("amitkaps/craftz");
  expect(slugOf("https://github.com/amitkaps/craftz")).toBe("amitkaps/craftz");
  expect(slugOf("http://local_proxy@127.0.0.1:41234/git/amitkaps/craftz\n")).toBe(
    "amitkaps/craftz",
  );
  expect(slugOf("")).toBeUndefined();
});

const raw = {
  number: 7,
  title: "A change",
  state: "closed" as const,
  merged_at: null as string | null,
  html_url: "https://github.com/amitkaps/craftz/pull/7",
  head: { sha: "abc", ref: "a-change" },
};

test("a closed pull request is merged only when it has a merge time", () => {
  expect(pullOf({ ...raw, state: "open" }).state).toBe("OPEN");
  expect(pullOf(raw).state).toBe("CLOSED");
  expect(pullOf({ ...raw, merged_at: "2026-10-31T03:11:36Z" }).state).toBe("MERGED");
});

test("a pull request's merge state is upper case, and unknown until GitHub has worked it out", () => {
  expect(pullOf({ ...raw, mergeable_state: "behind" }).mergeStateStatus).toBe("BEHIND");
  expect(pullOf(raw).mergeStateStatus).toBe("UNKNOWN");
});

test("what runs in a cloud session stays off GraphQL, which its proxy refuses", () => {
  for (const file of ["pr", "gone", "status", "release"]) {
    const source = readFileSync(new URL(`../src/${file}.ts`, import.meta.url), "utf8");
    expect(source, file).not.toMatch(
      /graphql|"pr",\s*"(view|list|create|merge|edit|close|update-branch)"/,
    );
  }
});
