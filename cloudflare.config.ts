/** @prose
 * # The Worker
 *
 * What Cloudflare runs for craftz's site: its name, domain, the folder it serves, its date and
 * addresses, written as cf's config is. The site is the docs, the folder `prose build` writes, so
 * it's static, and `craftz deploy` uploads it.
 *
 * Keep the name equal to the Worker connected to this repository in the dashboard. The build and
 * deploy commands are set on the Worker, as [the rules](docs/rules.md#cloudflare) list. The site
 * answers only on its domain, so `workers.dev` and preview URLs are off.
 */
export default {
  worker: {
    name: "craftz",
    domains: ["craftz.amitkaps.com"],
    assets: {
      directory: ".prose",
      // Serve the 404.html prose writes for any missing address.
      notFoundHandling: "404-page",
    },
    compatibilityDate: "2026-10-19",
    workersDev: false,
    previewUrls: false,
  },
};
