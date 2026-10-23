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
 * from the package. craftz's site is its docs, which `prose build` writes, so `craftz()` serves
 * them as `publicDir`, and `vp build` hands them to Cloudflare's plugin, assets only, for
 * `craftz deploy`. The plugin loads only when Vite runs, as `cloudflare-plugin` asks, so the
 * checks don't wait for it.
 */
import { defineConfig, lazyPlugins } from "vite-plus";
import { BROWSERS } from "./src/browsers.ts";
import { COMPATIBILITY_DATE } from "./src/runtime.ts";
import { craftz } from "./src/index.ts";

export default defineConfig({
  plugins: [
    craftz(),
    lazyPlugins(async () => {
      const { cloudflare } = await import("@cloudflare/vite-plugin");
      return [cloudflare({ assetsOnly: true })];
    }),
  ],

  // The site is the folder `prose build` writes.
  publicDir: ".prose",

  pack: {
    entry: ["src/index.ts", "src/cloudflare.ts", "src/cli.ts"],
    format: ["esm"],
    // Oxc writes the types, so there's no typescript dependency, and fails on an export
    // whose type isn't written out.
    clean: true,
    fixedExtension: false,
    define: { __PINNED__: JSON.stringify({ browsers: BROWSERS, date: COMPATIBILITY_DATE }) },
    // worker()'s types are cf's Worker, written into its .d.ts, since a site has cf but not the
    // package cf takes them from.
    deps: { neverBundle: ["@mdn/browser-compat-data", "cf"], onlyBundle: ["@cloudflare/config"] },
  },

  test: {
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/packed.ts"],
  },
});
