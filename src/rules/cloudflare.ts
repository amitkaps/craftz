/** @prose
 * # The Cloudflare rules
 *
 * The rules under [Cloudflare](../../docs/rules.md#cloudflare): a static site's Worker config,
 * which is `cloudflare.config.ts` and not wrangler's, and nothing of Cloudflare's plugin in a
 * site that is only uploaded.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readPkg } from "../reference.ts";
import { withValues, withoutSite } from "../edit.ts";
import { workerIn } from "../worker.ts";
import type { Rule } from "../rules.ts";
import { unruled, WORKER } from "./toolchain.ts";
import { drifted, editFile, writePkg } from "./shared.ts";

// What deployed a static site through Cloudflare's plugin.
const CLOUDFLARE_TOOLS = ["cf", "@cloudflare/vite-plugin", "wrangler"];
// SvelteKit builds a site from `src/app.html`, where Vite alone builds from `index.html`.
const SVELTEKIT = "@sveltejs/kit";

export const CLOUDFLARE_RULES: Rule[] = [
  {
    id: "cloudflare-config",
    holdable: true,
    check: ({ worker: site }) => {
      if (!site) return undefined;
      const drift =
        site.file === "cloudflare.config.ts" ? [] : [`still on wrangler (${site.file})`];
      return { value: site.file, drift };
    },
  },
  /** @prose
   * # A static site's Worker
   *
   * `cloudflare.config.ts` is written as cf's own, with the Worker under `worker`, and imports
   * nothing. It's parsed as `vite.config.ts` is, and the date and addresses are read where they
   * sit. The fix writes in each one that differs, after rewriting a config that still calls
   * `site()`, as edit.ts does.
   *
   * A site on wrangler, like base, is left out. It's held on wrangler, so it moves when it moves
   * to `cloudflare.config.ts`.
   */
  {
    id: "cloudflare-site",
    check: ({ files, worker: site }) => {
      if (site?.file !== "cloudflare.config.ts") return undefined;
      const text = files[site.file] ?? "";
      const drift = /^export default site\(/m.test(text) ? [`${site.file} calls site()`] : [];
      return drifted([...drift, ...unruled(withoutSite(text), { worker: WORKER })]);
    },
    fix: {
      in: "files",
      apply: (dir) =>
        editFile(join(dir, "cloudflare.config.ts"), (text) =>
          withValues(withoutSite(text), { worker: WORKER }),
        ),
    },
  },
  /** @prose
   * # Nothing of Cloudflare's in a static site
   *
   * A static site's dependencies, Vite config and scripts are read for what deployed it through
   * Cloudflare's plugin.
   *
   * Vite builds a site from its `index.html`, or SvelteKit's static adapter does from
   * `src/app.html`. The fix removes the dependencies and drops ` && vp build` from the scripts of a
   * site that has neither. A script that runs `vp build` another way is left to fix by hand, as is a Vite
   * config that loads the plugin, since every repository has taken it out.
   */
  {
    id: "cloudflare-static",
    check: ({ files, deps, pkg, worker: site }) => {
      if (site?.file !== "cloudflare.config.ts" || site.deploys !== "static") return undefined;
      const drift = CLOUDFLARE_TOOLS.filter((name) => deps[name]).map(
        (name) => `depends on ${name}, which a static site doesn't use`,
      );
      if (files["vite.config.ts"]?.includes("@cloudflare/vite-plugin")) {
        drift.push("vite.config.ts loads Cloudflare's plugin");
      }
      if (!files["index.html"] && !deps[SVELTEKIT]) {
        for (const name of ["verify", "build"]) {
          if (/\bvp build\b/.test(pkg.scripts?.[name] ?? "")) {
            drift.push(`${name} runs vp build, with no index.html or SvelteKit to build`);
          }
        }
      }
      return { value: site.directory, drift };
    },
    fix: {
      in: "files",
      apply: (dir) => {
        if (workerIn(dir)?.deploys !== "static") return;
        const pkg = readPkg(dir);
        const builds =
          existsSync(join(dir, "index.html")) ||
          !!(pkg.dependencies?.[SVELTEKIT] ?? pkg.devDependencies?.[SVELTEKIT]);
        for (const field of ["dependencies", "devDependencies"] as const) {
          for (const name of CLOUDFLARE_TOOLS) {
            if (pkg[field]?.[name]) delete pkg[field][name];
          }
        }
        for (const name of builds ? [] : ["verify", "build"]) {
          const script = pkg.scripts?.[name];
          if (script) pkg.scripts = { ...pkg.scripts, [name]: script.replace(/ && vp build$/, "") };
        }
        writePkg(dir, pkg);
      },
    },
  },
];
