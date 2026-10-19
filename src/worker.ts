/** @prose
 * # A repository's Worker
 *
 * What a repository deploys, read from its Worker config. The survey, the command and `craftz()`
 * all read it here, and it imports only Node's own modules, so the plugin stays small.
 *
 * A repository deploys if it has a Cloudflare config, and the Worker's name is read from it.
 * `cloudflare.config.ts` is the one to use, and `wrangler.jsonc` and `wrangler.toml` are the ones
 * still on wrangler. A regular expression is enough, since each file states `name` once.
 *
 * Its domain is read the same way, the first in `domains` or the first route's `pattern`, and
 * the page links to it under the repository's name.
 *
 * So is whether it turns off `workers.dev` and preview URLs, each on unless the config says
 * otherwise. cf's config names them `workersDev` and `previewUrls`, and wrangler's `workers_dev`
 * and `preview_urls`.
 *
 * And what it deploys, the deploy axis in [the rules](../docs/rules.md#axes). A Worker with code
 * of its own, cf's `entrypoint` or wrangler's `main`, is an app, and one without is a static
 * site, whatever builds its files.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** A repository's Worker, as its config states it. */
export type Worker = {
  file: string;
  name: string;
  domain?: string;
  workersDev: boolean;
  previewUrls: boolean;
  deploys: "static" | "app";
};

/** The Worker configs, cf's first, then wrangler's. */
export const CONFIGS = ["cloudflare.config.ts", "wrangler.jsonc", "wrangler.toml"];

const off = (text: string, key: string): boolean =>
  new RegExp(`"?${key}"?\\s*[:=]\\s*false`).test(text);

/** The Worker the config files state, by name, or none. */
export function worker(files: Record<string, string | undefined>): Worker | undefined {
  for (const file of CONFIGS) {
    const text = files[file] ?? "";
    const name = /^\s*"?name"?\s*[:=]\s*"([^"]+)"/m.exec(text)?.[1];
    const domain = /(?:domains"?\s*:\s*\[\s*|"?pattern"?\s*[:=]\s*)"([^"]+)"/.exec(text)?.[1];
    const workersDev = !off(text, "workersDev") && !off(text, "workers_dev");
    const previewUrls = !off(text, "previewUrls") && !off(text, "preview_urls");
    const deploys = /^\s*"?(?:entrypoint|main)"?\s*[:=]/m.test(text) ? "app" : "static";
    if (name) return { file, name, domain, workersDev, previewUrls, deploys };
  }
  return undefined;
}

/** The Worker a folder's config states, read from disk. */
export function workerIn(dir: string): Worker | undefined {
  const text = (file: string): string => {
    try {
      return readFileSync(join(dir, file), "utf8");
    } catch {
      return "";
    }
  };
  return worker(Object.fromEntries(CONFIGS.map((file) => [file, text(file)])));
}
