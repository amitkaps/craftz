/** @prose
 * # The notes' test
 *
 * A note comes from what npm says, so npm is stood in for here. A newer craftz is noted with the
 * command that moves it, and a graduated beta only in craftz's own repository. When npm doesn't
 * answer, there's no note.
 */
import { expect, test } from "vite-plus/test";
import { type Latest, notes } from "../src/notes.ts";
import { CRAFTZ } from "../src/reference.ts";

const npm =
  (versions: Record<string, string>): Latest =>
  async (name) =>
    versions[name];

test("a newer craftz is noted", async () => {
  const pkg = { devDependencies: { [CRAFTZ]: "0.3.0" } };
  expect(await notes(pkg, npm({ [CRAFTZ]: "0.4.0" }))).toEqual([
    "craftz 0.4.0 is out, and this is on 0.3.0: run pnpm craftz upgrade",
  ]);
  expect(await notes(pkg, npm({ [CRAFTZ]: "0.3.0" }))).toEqual([]);
  expect(await notes({ devDependencies: { [CRAFTZ]: "file:craftz.tgz" } }, npm({}))).toEqual([]);
});

test("no answer from npm is no note", async () => {
  expect(await notes({ devDependencies: { [CRAFTZ]: "0.3.0" } }, async () => undefined)).toEqual(
    [],
  );
});

test("a graduated beta is noted only in craftz", async () => {
  const deps = { cf: "1.0.0-beta.20" };
  const graduated = npm({ cf: "1.0.0" });
  expect(await notes({ name: CRAFTZ, devDependencies: deps }, graduated)).toEqual([
    "cf 1.0.0 is a release of the beta 1.0.0-beta.20, so it can leave versions-beta",
  ]);
  expect(await notes({ name: "example", devDependencies: deps }, graduated)).toEqual([]);
  expect(
    await notes({ name: CRAFTZ, devDependencies: deps }, npm({ cf: "1.0.0-beta.21" })),
  ).toEqual([]);
});
