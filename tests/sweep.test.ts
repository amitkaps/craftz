/** @prose
 * # Clearing a run's folders, tested
 *
 * Holds [clear](../src/temp.ts#clearing-what-a-run-left) to removing the folder of a run that
 * has gone, and a kept one a day old, and nothing else. A run still going, a kept folder that is
 * new and a folder of another name stay, and `only` lists without removing.
 */
import { expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PREFIX, claimed, cleared, clear } from "../src/temp.ts";
import { tmp } from "./temp.ts";

test("a folder goes once its run has gone or it has been kept for a day, and not before", () => {
  const base = tmp("craftz-sweep-");
  const made = (name: string, owner?: number) => {
    const folder = join(base, name);
    mkdirSync(folder);
    if (owner !== undefined) writeFileSync(join(folder, "owner"), String(owner));
    return folder;
  };
  // 2 ** 22 is past the highest process id a laptop hands out.
  const dead = made(`${PREFIX}dead`, 2 ** 22);
  const alive = made(`${PREFIX}alive`, process.pid);
  const fresh = made(`${PREFIX}fresh`);
  const old = made(`${PREFIX}old`);
  const day = new Date(Date.now() - 25 * 60 * 60 * 1000);
  utimesSync(old, day, day);
  const other = made("something-else", 2 ** 22);

  const listed = clear(base, true);
  expect(listed.map((it) => it.why).toSorted()).toEqual([
    "its run had gone",
    "kept for more than a day",
  ]);
  expect(cleared(listed, true)[0]).toMatch(/^Would clear .*craftz-(dead|old), \d+ MB, since /);
  expect([dead, old].every((it) => existsSync(it))).toBe(true);

  expect(clear(base)).toHaveLength(2);
  expect([dead, old].some((it) => existsSync(it))).toBe(false);
  expect([alive, fresh, other].every((it) => existsSync(it))).toBe(true);
});

test("a folder is named craftz-<what>-", () => {
  expect(() => claimed("align-")).toThrow("craftz-<what>-");
  expect(() => claimed("craftz-")).toThrow("craftz-<what>-");
});
