/** @prose
 * # Sweeping a run's folders, tested
 *
 * Holds [temp.ts](temp.ts) to removing the folder of a run that has gone, and only that one. A
 * run still going, a folder with no owner that is new and a folder of another name stay.
 */
import { expect, test } from "vite-plus/test";
import { mkdirSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sweep, tmp } from "./temp.ts";

test("a run's folder is removed once the run that made it has gone, and not before", () => {
  const base = tmp("craftz-sweep-");
  const made = (name: string, owner?: number) => {
    const folder = join(base, name);
    mkdirSync(folder);
    if (owner !== undefined) writeFileSync(join(folder, "owner"), String(owner));
    return folder;
  };
  // 2 ** 22 is past the highest process id a laptop hands out.
  const dead = made("craftz-tests-dead", 2 ** 22);
  const alive = made("craftz-tests-alive", process.pid);
  const fresh = made("craftz-tests-fresh");
  const old = made("craftz-tests-old");
  const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
  utimesSync(old, day, day);
  const other = made("something-else", 2 ** 22);

  expect(sweep(base).toSorted()).toEqual(["craftz-tests-dead", "craftz-tests-old"]);
  expect([dead, old].some((it) => existsSync(it))).toBe(false);
  expect([alive, fresh, other].every((it) => existsSync(it))).toBe(true);
});
