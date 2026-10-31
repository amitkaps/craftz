/** @prose
 * # The fixes' test for a package with a site
 *
 * Runs [holdFixes](fixes.ts) on a new repository of one shape: a package with a site.
 */
import { expect, test } from "vite-plus/test";
import { holdFixes } from "./fixes.ts";

test("every fix closes what its check finds", async () => {
  expect(await holdFixes({ package: true, site: true, private: false, internal: false })).toEqual(
    [],
  );
}, 120_000);
