/** @prose
 * # The screenshot command's test
 *
 * What `craftz shot` says when it's given too little or run in a folder with no Playwright, and
 * what it waits for before the picture. A folder holds a stand-in Playwright that writes down each
 * call, since a real screenshot needs a browser, and that's checked by hand on a repository with one.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { shot } from "../src/shot.ts";

/** A folder whose Playwright logs each page call to `calls.txt`, and fails the calls it's told to. */
function fakePlaywright(fails: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), "shot-"));
  const pkg = join(dir, "node_modules/@playwright/test");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "package.json"), '{"name":"@playwright/test","main":"index.js"}');
  writeFileSync(
    join(pkg, "index.js"),
    `const { appendFileSync } = require("node:fs");
const fails = ${JSON.stringify(fails)};
const call = (name) => async () => {
  appendFileSync(${JSON.stringify(join(dir, "calls.txt"))}, name + "\\n");
  if (fails.includes(name)) throw new Error("Timeout exceeded");
};
const page = {
  goto: call("goto"),
  waitForLoadState: call("idle"),
  waitForFunction: call("drawn"),
  screenshot: call("screenshot"),
};
exports.chromium = { launch: async () => ({ newPage: async () => page, close: async () => {} }) };
`,
  );
  return dir;
}

const calls = (dir: string) => readFileSync(join(dir, "calls.txt"), "utf8").trim().split("\n");

test("it waits for the network and for something drawn before the picture", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const dir = fakePlaywright();
  expect(await shot(dir, ["http://x", "a.png"])).toBe(0);
  expect(calls(dir)).toEqual(["goto", "idle", "drawn", "screenshot"]);
  log.mockRestore();
});

test("a network that never goes quiet still gets its picture", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const dir = fakePlaywright(["idle"]);
  expect(await shot(dir, ["http://x", "a.png"])).toBe(0);
  expect(calls(dir)).toEqual(["goto", "idle", "drawn", "screenshot"]);
  log.mockRestore();
});

test("a page with nothing drawn saves its picture and fails, saying so", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const dir = fakePlaywright(["drawn"]);
  expect(await shot(dir, ["http://x", "a.png"])).toBe(1);
  expect(calls(dir)).toContain("screenshot");
  expect(error.mock.calls[0]?.[0]).toContain("nothing drawn");
  log.mockRestore();
  error.mockRestore();
});

test("it asks for a page and a file", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await shot(tmpdir(), ["http://x"])).toBe(1);
  expect(await shot(tmpdir(), ["http://x", "a.png", "--width", "0"])).toBe(1);
  expect(error.mock.calls[0]?.[0]).toContain("craftz shot <url> <file.png>");
  error.mockRestore();
});

test("it says so in a folder with no Playwright", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const dir = mkdtempSync(join(tmpdir(), "shot-"));
  expect(await shot(dir, ["http://x", "a.png"])).toBe(1);
  expect(error.mock.calls[0]?.[0]).toContain("no @playwright/test");
  error.mockRestore();
});
