/** @prose
 * # A repository's Worker
 *
 * What a repository deploys, read from its Worker config. The survey, the rules and the command
 * all read it here.
 *
 * A repository deploys if it has a Cloudflare config, and the Worker's name is read from it.
 * `cloudflare.config.ts` is the one to use, and `wrangler.jsonc` and `wrangler.toml` are the ones
 * still on wrangler. Each is read for its name, its first domain, whether it turns off
 * `workers.dev` and preview URLs, the folder it serves, and what it deploys. The addresses are
 * on unless the config says otherwise.
 *
 * What it deploys is the deploy axis in [the rules](../docs/rules.md#axes). A Worker with code
 * of its own, cf's `entrypoint` or wrangler's `main`, is an app, and one without is a static
 * site, whatever builds its files.
 *
 * `cloudflare.config.ts` and `wrangler.jsonc` are parsed, as [config.ts](config.ts) reads every
 * config, so a key is found by where it sits. A config that still calls `site()` reads the same,
 * since its one argument is the Worker. Only an app's `wrangler.toml` is read with regular
 * expressions, since nothing installed parses TOML, and it goes when the app moves to cf.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exported, jsonc, literal } from "./config.ts";

/** A repository's Worker, as its config states it. */
export type Worker = {
  file: string;
  name: string;
  domain?: string;
  workersDev: boolean;
  previewUrls: boolean;
  directory?: string;
  deploys: "static" | "app";
};

/** The Worker configs, cf's first, then wrangler's. */
export const CONFIGS = ["cloudflare.config.ts", "wrangler.jsonc", "wrangler.toml"];

type Config = Record<string, unknown> & { assets?: { directory?: unknown } };

const string = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/** cf's `worker`, or a `site()` call's argument, which is the Worker itself. */
function cf(text: string): Config | undefined {
  const value = literal(exported(text)) as Config | undefined;
  return (value?.["worker"] as Config | undefined) ?? value;
}

/** wrangler's TOML, read for the keys it states once each. */
function toml(text: string): Config {
  const value = (key: string): string | undefined =>
    new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m").exec(text)?.[1];
  const off = (key: string): false | undefined =>
    new RegExp(`^${key}\\s*=\\s*false`, "m").test(text) ? false : undefined;
  const pattern = /pattern\s*=\s*"([^"]+)"/.exec(text)?.[1];
  return {
    name: value("name"),
    main: value("main"),
    routes: pattern ? [{ pattern }] : [],
    workers_dev: off("workers_dev"),
    preview_urls: off("preview_urls"),
    assets: { directory: value("directory") },
  };
}

const READ: Record<string, (text: string) => Config | undefined> = {
  "cloudflare.config.ts": cf,
  "wrangler.jsonc": (text) => jsonc(text) as Config | undefined,
  "wrangler.toml": toml,
};

/** The Worker the config files state, by name, or none. */
export function worker(files: Record<string, string | undefined>): Worker | undefined {
  for (const file of CONFIGS) {
    const text = files[file];
    const config = text ? READ[file]!(text) : undefined;
    const name = string(config?.["name"]);
    if (!config || !name) continue;
    const routes = (config["routes"] ?? []) as { pattern?: unknown }[];
    return {
      file,
      name,
      domain: string((config["domains"] as unknown[] | undefined)?.[0] ?? routes[0]?.pattern),
      workersDev: (config["workersDev"] ?? config["workers_dev"]) !== false,
      previewUrls: (config["previewUrls"] ?? config["preview_urls"]) !== false,
      directory: string(config.assets?.directory),
      deploys: config["entrypoint"] || config["main"] ? "app" : "static",
    };
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
