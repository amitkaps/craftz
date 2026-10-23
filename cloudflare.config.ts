/** @prose
 * # The Worker
 *
 * What Cloudflare runs for craftz's site: its name, domain and how it serves the files, with the
 * date and addresses `worker()` sets. The site is the docs, the folder `prose build` writes, so it's static, and
 * `craftz deploy` uploads it.
 *
 * Keep the name equal to the Worker connected to this repository in
 * the dashboard. The build and deploy commands are set on the Worker, as
 * [the rules](docs/rules.md#cloudflare) list. The site answers only on its domain, so
 * `workers.dev` and preview URLs are off.
 */
import { defineConfig } from "cf/config";
import { worker } from "./src/cloudflare.ts";

export default defineConfig({
  worker: worker({
    name: "craftz",
    domains: ["craftz.amitkaps.com"],
    assets: {
      // Serve the 404.html prose writes for any missing address.
      notFoundHandling: "404-page",
    },
  }),
});
