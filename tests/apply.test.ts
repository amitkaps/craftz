/** @prose
 * # Applying the settings' test
 *
 * Runs the read, write and read-back loop on parts that stand in for GitHub and Cloudflare, so
 * each way a write can end is reported as it happened: fixed, still off, failed or left. A part
 * already in line is never written.
 */
import { expect, test } from "vite-plus/test";
import { type Part, settle } from "../src/apply.ts";

// A setting that holds `drift` until it's written, when it holds `after`.
function part(name: string, drift: string[], after: string[], write?: () => string[]): Part {
  let written = false;
  return {
    name,
    read: async () => (written ? after : drift),
    write: () => {
      const left = write?.() ?? [];
      written = !left.length;
      return left;
    },
  };
}

test("each write is read back and reported as it ended", async () => {
  const writes: string[] = [];
  const lines = await settle(
    [
      part("in line", [], [], () => {
        writes.push("in line");
        return [];
      }),
      part("merge", ["a is off", "b is off"], ["b is off"]),
      part("ruleset", ["no ruleset"], ["no ruleset"], () => {
        throw new Error("HTTP 403\nmore");
      }),
      part("worker", ["no trigger"], [], () => ["left: not connected yet"]),
      {
        name: "labels",
        read: async () => {
          throw new Error("HTTP 500");
        },
        write: () => {
          writes.push("labels");
        },
      },
    ],
    0,
  );
  expect(writes).toEqual([]);
  expect(lines).toEqual([
    "fixed: a is off",
    "still off: b is off",
    "failed: ruleset: HTTP 403",
    "still off: no ruleset",
    "left: not connected yet",
    "failed: labels couldn't be read: HTTP 500",
  ]);
});
