/** @prose
 * # Clearing a run's folders, tested
 *
 * Holds [clear](../src/temp.ts#clearing-what-a-run-left) to removing the folder of a run that
 * has gone, and a kept one a day old, and nothing else. A run still going, a kept folder that is
 * new and a folder of another name stay, and `only` lists without removing. The report says which
 * go and which stay, and why each.
 */
import { expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PREFIX, claimed, clear, report } from "../src/temp.ts";
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
  const why = (name: string) => listed.find((it) => it.folder.endsWith(name));
  expect(why("dead")).toMatchObject({ clears: true, why: "its run has gone" });
  expect(why("old")).toMatchObject({ clears: true, why: "kept, and over a day old" });
  expect(why("alive")).toMatchObject({ clears: false, why: "its run is still going" });
  expect(why("fresh")).toMatchObject({
    clears: false,
    why: "kept, under a day old, so it clears in 24 h",
  });
  expect(listed.some((it) => it.folder.endsWith("something-else"))).toBe(false);
  expect([dead, old].every((it) => existsSync(it))).toBe(true);

  const said = report(listed, true);
  expect(said).toMatch(/^Will clear:\n {2}.*craftz-(dead|old) .*\n {2}.*craftz-(dead|old) /);
  expect(said).toContain("\n\nStays:\n");

  clear(base);
  expect([dead, old].some((it) => existsSync(it))).toBe(false);
  expect([alive, fresh, other].every((it) => existsSync(it))).toBe(true);
});

test("a folder is named craftz-<what>-", () => {
  expect(() => claimed("align-")).toThrow("craftz-<what>-");
  expect(() => claimed("craftz-")).toThrow("craftz-<what>-");
});
