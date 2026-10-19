/** @prose
 * # The build
 *
 * One Vite+ config packs the package and checks it. `vp pack` writes ESM with its types, and
 * runs publint, which fails the build on a package npm would serve badly.
 *
 * The browsers and the Workers' date are worked out here and written in, as
 * [pinned.ts](src/pinned.ts) says. The packages they come from stay out of the bundle.
 *
 * `craftz()` sets the format and lint the rules ask for, from source, as a repository sets them
 * from the package.
 */
import { defineConfig } from "vite-plus";
import { BROWSERS } from "./src/browsers.ts";
import { COMPATIBILITY_DATE } from "./src/runtime.ts";
import { craftz } from "./src/index.ts";

export default defineConfig({
  plugins: [craftz()],

  pack: {
    entry: ["src/index.ts", "src/cli.ts"],
    format: ["esm"],
    platform: "node",
    // Oxc writes the types, so there's no typescript dependency, and fails on an export
    // whose type isn't written out.
    dts: { generator: "oxc" },
    clean: true,
    fixedExtension: false,
    publint: { strict: true },
    define: { __PINNED__: JSON.stringify({ browsers: BROWSERS, date: COMPATIBILITY_DATE }) },
    deps: { neverBundle: ["@mdn/browser-compat-data", "cf"] },
  },

  test: {
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
  },
});
