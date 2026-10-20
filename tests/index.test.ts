/** @prose
 * # The plugin's test
 *
 * Holds `craftz()` to never overriding the repository. Each case merges what the plugin returns
 * into a config, the way Vite does. Unset keys are filled in and the repository's own stay.
 *
 * A value set the same passes, and a value set differently fails, naming each key.
 *
 * Each config has its own folder as its root, since a site's config follows from the files
 * there: a Worker config, and an `index.html` or none.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeConfig } from "vite-plus";
import { expect, test } from "vite-plus/test";
import { craftz } from "../src/index.ts";
import { BROWSERS } from "../src/pinned.ts";

type Config = Record<string, unknown>;

// A folder holding these files, as a config's root.
function folder(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "craftz-plugin-"));
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
}

// The config Vite ends with, without its root.
function resolved(config: Config, root = folder()): Config {
  const at = { ...config, root };
  const { root: _, ...rest } = mergeConfig(at, craftz().config(at)) as Config;
  return rest;
}

const STATIC = `export default defineConfig({
  worker: {
    name: "example",
  },
});
`;
const APP = `export default defineConfig({
  worker: {
    name: "example",
    entrypoint: "src/worker.ts",
  },
});
`;

test("an empty config gets what the rules set", () => {
  expect(resolved({})).toEqual({
    fmt: { proseWrap: "never" },
    lint: {
      plugins: ["typescript", "unicorn", "import"],
      categories: { correctness: "error" },
      options: { typeAware: true, typeCheck: true },
    },
  });
});

test("the repository's own keys stay as they are", () => {
  const config = {
    fmt: { ignorePatterns: ["fixtures/**"] },
    lint: { plugins: ["typescript", "unicorn", "import"], options: { typeAware: true } },
    test: { include: ["tests/**/*.test.ts"] },
  };
  const out = resolved(config);
  expect(out["fmt"]).toEqual({ ignorePatterns: ["fixtures/**"], proseWrap: "never" });
  expect(out["test"]).toEqual({ include: ["tests/**/*.test.ts"] });
  // An array the repository sets isn't joined with the plugin's.
  expect((out["lint"] as Config)["plugins"]).toEqual(["typescript", "unicorn", "import"]);
  expect((out["lint"] as Config)["options"]).toEqual({ typeAware: true, typeCheck: true });
});

test("a value set differently fails, naming each key", () => {
  const config = {
    fmt: { proseWrap: "preserve" },
    lint: { plugins: ["typescript"], options: { typeCheck: false } },
  };
  expect(() => craftz().config({ ...config, root: folder() })).toThrow(
    [
      "craftz() won't override vite.config.ts. Take these out of it:",
      '  fmt.proseWrap is "preserve", and the rules set "never"',
      '  lint.plugins is ["typescript"], and the rules set ["typescript","unicorn","import"]',
      "  lint.options.typeCheck is false, and the rules set true",
    ].join("\n"),
  );
});

test("a static site with an index.html gets the browsers as its build target", () => {
  const root = folder({ "cloudflare.config.ts": STATIC, "index.html": "<!doctype html>" });
  expect(resolved({}, root)["build"]).toEqual({ target: BROWSERS });
  expect(resolved({}, root)["publicDir"]).toBeUndefined();
});

test("a static site without one serves the folder prose writes", () => {
  const root = folder({ "cloudflare.config.ts": STATIC });
  expect(resolved({}, root)["publicDir"]).toBe(".prose");
  expect(resolved({}, root)["build"]).toBeUndefined();
});

test("an app and a folder with no Worker get no site config", () => {
  for (const root of [folder({ "cloudflare.config.ts": APP, "index.html": "" }), folder()]) {
    const out = resolved({}, root);
    expect([out["build"], out["publicDir"]]).toEqual([undefined, undefined]);
  }
});

test("a site's own publicDir is its own, and Vite builds it for the browsers", () => {
  const root = folder({ "cloudflare.config.ts": STATIC });
  const out = resolved({ publicDir: "public" }, root);
  expect(out["publicDir"]).toBe("public");
  expect(out["build"]).toEqual({ target: BROWSERS });
});

test("a site's build target set differently fails", () => {
  const root = folder({ "cloudflare.config.ts": STATIC, "index.html": "" });
  expect(() => craftz().config({ build: { target: ["chrome100"] }, root })).toThrow(
    '  build.target is ["chrome100"]',
  );
});
