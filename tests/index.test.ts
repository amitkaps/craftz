/** @prose
 * # The first test
 *
 * What the starting function returns, as a test to replace.
 */
import { expect, test } from "vite-plus/test";
import { hello } from "../src/index.ts";

test("says hello", () => {
  expect(hello("world")).toBe("Hello, world.");
});
