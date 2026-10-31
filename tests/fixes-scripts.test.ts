/** @prose
 * # The fixes' test for scripts in a private repository
 *
 * Runs [holdFixes](fixes.ts) on a new repository of one shape: scripts in a private repository.
 */
import { expect, test } from "vite-plus/test";
import { holdFixes } from "./fixes.ts";

test("every fix closes what its check finds", async () => {
  expect(await holdFixes({ package: false, site: false, private: true, internal: false })).toEqual(
    [],
  );
}, 120_000);
