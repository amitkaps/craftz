/** @prose
 * # worker()
 *
 * What every Worker sets the same, for a repository's `cloudflare.config.ts`, as `craftz()` is for
 * `vite.config.ts`. The config names its Worker, its domain and how it serves its files, and
 * `worker()` adds the rest:
 *
 * - the compatibility date, which is the build date of the workerd craftz's cf installs, so a
 *   repository moves to a newer date by moving to a newer craftz.
 * - `workersDev` and `previewUrls` off, so the site answers only on its domain.
 *
 * A config that sets any of them, or a Node.js compatibility flag, fails, naming each, so a
 * date can't be left behind when craftz moves on. The date turns on Node.js compatibility
 * itself.
 *
 * It imports only the date, so cf and Cloudflare's plugin load it in a moment. Its types are cf's,
 * which every site installs, so the editor knows a Worker's fields, and says when a config sets
 * one of these.
 */
import type { WorkerConfig } from "cf/config";
import { COMPATIBILITY_DATE } from "./pinned.ts";

const SET = {
  compatibilityDate: COMPATIBILITY_DATE,
  workersDev: false,
  previewUrls: false,
} as const;

type Set = { compatibilityDate: string; workersDev: false; previewUrls: false };

/** A Worker's config, with the date and addresses the rules set. */
export function worker(own: Omit<WorkerConfig, keyof Set>): WorkerConfig & Set {
  const config = own as Record<string, unknown>;
  const set = Object.keys(SET).filter((key) => key in config);
  const flags = Array.isArray(config["compatibilityFlags"]) ? config["compatibilityFlags"] : [];
  if (flags.some((flag) => String(flag).startsWith("nodejs_"))) set.push("a Node.js flag");
  if (set.length) {
    throw new Error(`worker() sets ${set.join(", ")}, so cloudflare.config.ts can't`);
  }
  return { ...own, ...SET };
}
