/** @prose
 * # The build
 *
 * One Vite+ config packs the package and checks it. `vp pack` writes ESM with its types, and
 * runs publint, which fails the build on a package npm would serve badly.
 *
 * The browsers and the Workers' date are worked out here and written in, as
 * [pinned.ts](src/pinned.ts) says. browser-compat-data, where the browsers come from, stays out
 * of the bundle.
 *
 * `craftz()` sets the format and lint the rules ask for, from source, as a repository sets them
 * from the package. craftz's site is its docs, the folder `prose build` writes, which
 * [cloudflare.config.ts](cloudflare.config.ts) names, so Vite doesn't build it.
 *
 * `verify` runs `all`, as [the rules](docs/rules.md#scripts-verify) say, without `build`. The
 * tests pack the package, which builds it, and a second build beside them broke the pack.
 */
import { defineConfig } from "vite-plus";
import { BROWSERS } from "./src/browsers.ts";
import { COMPATIBILITY_DATE } from "./src/runtime.ts";
import { craftz } from "./src/index.ts";

export default defineConfig({
  plugins: [craftz()],

  run: {
    cache: false,
    tasks: {
      all: { command: "true", dependsOn: ["check", "test", "site"] },
    },
  },

  pack: {
    entry: ["src/index.ts", "src/cloudflare.ts", "src/cli.ts"],
    format: ["esm"],
    // Oxc writes the types, so there's no typescript dependency, and fails on an export
    // whose type isn't written out.
    clean: true,
    fixedExtension: false,
    define: { __PINNED__: JSON.stringify({ browsers: BROWSERS, date: COMPATIBILITY_DATE }) },
    deps: { neverBundle: ["@mdn/browser-compat-data"] },
  },

  test: {
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/packed.ts"],
  },
});
