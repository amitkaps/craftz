/** @prose
 * # Reading a config's test
 *
 * Holds [config.ts](../src/config.ts) to reading a value by where it sits in the config. A key
 * in a comment, or under another key, isn't the one asked for, and a value the config works out
 * reads as `undefined`, since nothing is run.
 */
import { expect, test } from "vite-plus/test";
import { exported, jsonc, pluginCall, valueAt } from "../src/config.ts";
import { allOf, withVerify } from "../src/edit.ts";

const VITE = `import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [sveltekit(), craftz({ browser: true })],
  // fmt: { proseWrap: "never" },
  test: { fmt: { proseWrap: "never" } },
  build: { target: ["chrome120", "node26"], minify: !dev },
  "lint": { options: { typeAware: true, ...rest } },
  run: { tasks: { all: { command: "true", dependsOn: ["check", "test"] } } },
})
`;

test("a value is read where it sits, and only when it's written out", () => {
  expect(valueAt(VITE, ["fmt"])).toBeUndefined();
  expect(valueAt(VITE, ["test", "fmt", "proseWrap"])).toBe("never");
  expect(valueAt(VITE, ["build"])).toEqual({ target: ["chrome120", "node26"] });
  expect(valueAt(VITE, ["build", "minify"])).toBeUndefined();
  expect(valueAt(VITE, ["lint", "options"])).toEqual({ typeAware: true });
  expect(allOf(VITE)).toEqual(["check", "test"]);
});

test("a plugin is a call in the config's own plugins", () => {
  expect(pluginCall(VITE, "craftz")?.["arguments"]).toHaveLength(1);
  expect(pluginCall(VITE, "cloudflare")).toBeUndefined();
  expect(pluginCall(`export default { lint: { plugins: ["craftz"] } }`, "craftz")).toBeUndefined();
});

test("a config that doesn't parse, or exports no object, reads as nothing", () => {
  expect(exported("export default defineConfig({ fmt: }")).toBeUndefined();
  expect(exported("export default defineConfig(() => ({}))")).toBeUndefined();
  expect(exported("export default site({})")).toBeDefined();
  expect(jsonc(`{\n  // A comment.\n  "include": ["src",],\n}`)).toEqual({ include: ["src"] });
  expect(jsonc("{ not json")).toBeUndefined();
});

test("the run block goes after the last key, with the comma it needs", () => {
  const block = `

  run: {
    cache: false,
    tasks: {
      all: { command: "true", dependsOn: ["check"] },
    },
  },`;
  const bare = `export default defineConfig({\n  test: {}\n});\n`;
  expect(withVerify(bare, ["check"])).toBe(
    `export default defineConfig({\n  test: {},${block}\n});\n`,
  );
  expect(withVerify(VITE, ["check"])).toBe(VITE);
});
