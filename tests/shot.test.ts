/** @prose
 * # The screenshot command's test
 *
 * What `craftz shot` says when it's given too little, or run in a folder with no Playwright. A
 * real screenshot needs a browser, so that's checked by hand on a repository that has one.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { shot } from "../src/shot.ts";

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
