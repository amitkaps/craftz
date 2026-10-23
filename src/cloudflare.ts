/** @prose
 * # site()
 *
 * A static site's Worker, for a repository's `cloudflare.config.ts`, as `craftz()` is for
 * `vite.config.ts`. The config names its Worker, its domains and the folder it serves, with how
 * it serves it, and `site()` adds the rest:
 *
 * - the compatibility date, which is the build date of the workerd craftz's cf installs, so a
 *   repository moves to a newer date by moving to a newer craftz.
 * - `workersDev` and `previewUrls` off, so the site answers only on its domain.
 *
 * Its types are craftz's own, not cf's, since a static site doesn't install cf. They hold only
 * what a site sets, so a config that sets the date or an address fails the type check. `site()`
 * fails it too, naming each, for a config that isn't type-checked.
 *
 * `craftz deploy` imports the config and uploads the folder ([deploy.ts](deploy.ts)), and the
 * survey reads its name and domain as text ([worker.ts](worker.ts)).
 */
import { COMPATIBILITY_DATE } from "./pinned.ts";

/** What a static site's config names. */
export type Site = {
  name: string;
  domains: string[];
  assets: {
    /** The folder to upload, from the repository's root. */
    directory: string;
    notFoundHandling?: "404-page" | "single-page-application" | "none";
    htmlHandling?: "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | "none";
  };
};

/** What `site()` adds. */
export type Set = { compatibilityDate: string; workersDev: false; previewUrls: false };

const SET: Set = { compatibilityDate: COMPATIBILITY_DATE, workersDev: false, previewUrls: false };

/** A static site's Worker, with the date and addresses the rules set. */
export function site(own: Site): Site & Set {
  const set = Object.keys(SET).filter((key) => key in own);
  if (set.length) throw new Error(`site() sets ${set.join(", ")}, so cloudflare.config.ts can't`);
  return { ...own, ...SET };
}
