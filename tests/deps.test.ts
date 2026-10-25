/** @prose
 * # The install's test
 *
 * `weigh` splits the folders on disk among the direct dependencies, so a made-up tree and its
 * sizes stand in for an install. Each folder counts once, a direct dependency keeps its own, and a
 * folder nothing reaches is left from an older install.
 *
 * A deduped package's dependencies are found where pnpm printed them, as pnpm 12 prints a direct
 * dependency's own under another.
 */
import { expect, test } from "vite-plus/test";
import { type Node, report, weigh } from "../src/deps.ts";

const store = "/r/node_modules/.pnpm";
const at = (folder: string, name: string, dependencies?: Record<string, Node>): Node => ({
  path: `${store}/${folder}/node_modules/${name}`,
  ...(dependencies && { dependencies }),
});
const MB = 1024 * 1024;

test("each folder counts once, under the dependency that brings it", () => {
  const types = at("types@1", "types");
  const direct = {
    big: at("big@1", "big", {
      runtime: at("runtime@1", "runtime"),
      shared: at("shared@1", "shared"),
      types,
      other: at("other-os@1", "other-os"),
    }),
    small: at("small@1", "small", { shared: at("shared@1", "shared") }),
    types,
  };
  const sizes = new Map(
    [
      ["big@1", 2],
      ["runtime@1", 100],
      ["shared@1", 1],
      ["small@1", 1],
      ["types@1", 3],
      ["old@0", 50],
    ].map(([folder, mb]) => [`${store}/${folder}`, (mb as number) * MB]),
  );
  const weight = weigh(direct, sizes);
  expect(weight).toMatchObject({
    packages: 5,
    bytes: 107 * MB,
    shared: { packages: 1, bytes: MB },
    left: { packages: 1, bytes: 50 * MB },
  });
  expect(weight.direct.map((d) => [d.name, d.packages, d.bytes / MB])).toEqual([
    ["big", 2, 102],
    ["types", 1, 3],
    ["small", 1, 1],
  ]);
  expect(report(weight)).toEqual([
    "craftz deps: 5 packages, 107 MB, from 3 direct dependencies",
    "",
    "  big    2 packages  102 MB  runtime 100 MB, big 2.0 MB",
    "  types   1 package  3.0 MB",
    "  small   1 package  1.0 MB",
    "",
    "  shared: 1 package, 1.0 MB",
    "  left from older installs: 1 package, 50 MB, which a fresh pnpm install removes",
  ]);
});

test("a deduped package's dependencies are read from where pnpm printed them", () => {
  const tool = at("tool@1", "tool", { core: at("core@1", "core") });
  const direct = {
    plugin: at("plugin@1", "plugin", { tool }),
    tool: { ...at("tool@1", "tool"), deduped: true },
  };
  const sizes = new Map(
    [
      ["plugin@1", 1],
      ["tool@1", 2],
      ["core@1", 40],
    ].map(([folder, mb]) => [`${store}/${folder}`, (mb as number) * MB]),
  );
  const weight = weigh(direct, sizes);
  expect(weight.direct.map((d) => [d.name, d.packages, d.bytes / MB])).toEqual([
    ["tool", 2, 42],
    ["plugin", 1, 1],
  ]);
  expect(weight.left.packages).toBe(0);
});
