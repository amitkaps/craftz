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
 * markz is bundled, though it's a devDependency, so a repository's install doesn't carry it for
 * the few lines `cli.ts` prints findings with. It's the only dependency the build may take in,
 * so another one bundled by mistake fails the build. Rolldown names a chunk that several others
 * import after one module in it, and the one `cli.ts` and `new.ts` share read as if `gone.ts`
 * were 186 kB. So a shared chunk is named `shared`, and only a chunk loaded by `import()` keeps
 * its module's name.
 *
 * The format, lint and pack are the ones [the rules](docs/rules.md#toolchain-wrap) ask every
 * config to write out. craftz's site is its docs, the folder `prose build` writes, which
 * [cloudflare.config.ts](cloudflare.config.ts) names, so Vite doesn't build it.
 *
 * `verify` runs `all`, as [the rules](docs/rules.md#scripts-verify) say. The tests pack from a
 * build of their own, in a folder of their own, so `build` runs beside them
 * ([packed.ts](tests/packed.ts)).
 */
import { defineConfig } from "vite-plus";
import { BROWSERS } from "./src/browsers.ts";
import { COMPATIBILITY_DATE } from "./src/runtime.ts";

export default defineConfig({
  fmt: { proseWrap: "never" },

  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
  },

  run: {
    cache: false,
    tasks: {
      all: { command: "true", dependsOn: ["check", "test", "build", "site"] },
    },
  },

  pack: {
    entry: ["src/cli.ts"],
    format: ["esm"],
    platform: "node",
    // Oxc writes the types, so there's no typescript dependency, and fails on an export
    // whose type isn't written out.
    dts: { generator: "oxc" },
    publint: { strict: true },
    clean: true,
    fixedExtension: false,
    define: { __PINNED__: JSON.stringify({ browsers: BROWSERS, date: COMPATIBILITY_DATE }) },
    deps: { neverBundle: ["@mdn/browser-compat-data"], onlyBundle: ["@amitkaps/markz"] },
    outputOptions: {
      chunkFileNames: (chunk) => (chunk.isDynamicEntry ? "[name]-[hash].js" : "shared-[hash].js"),
    },
  },

  test: {
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/temp.ts", "tests/packed.ts"],
  },
});
