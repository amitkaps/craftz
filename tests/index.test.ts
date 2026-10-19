/** @prose
 * # The plugin's test
 *
 * Holds `craftz()` to never overriding the repository. Each case merges what the plugin returns
 * into a config, the way Vite does. Unset keys are filled in and the repository's own stay.
 *
 * A value set the same passes, and a value set differently fails, naming each key.
 */
import { mergeConfig } from "vite-plus";
import { expect, test } from "vite-plus/test";
import { craftz } from "../src/index.ts";

type Config = Record<string, unknown>;

const resolved = (config: Config): Config => mergeConfig(config, craftz().config(config)) as Config;

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
  expect(() => craftz().config(config)).toThrow(
    [
      "craftz() won't override vite.config.ts. Take these out of it:",
      '  fmt.proseWrap is "preserve", and the rules set "never"',
      '  lint.plugins is ["typescript"], and the rules set ["typescript","unicorn","import"]',
      "  lint.options.typeCheck is false, and the rules set true",
    ].join("\n"),
  );
});
