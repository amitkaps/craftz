/** @prose
 * # Deploy
 *
 * Uploads a static site, the folder its `cloudflare.config.ts` names, to its Worker. It's what
 * `cf deploy` does for an assets-only Worker, in the same calls to Cloudflare's API, made with
 * `fetch`. So a static site installs neither cf nor Cloudflare's plugin, and the workerd they
 * bring, a third of a site's install, never runs where nothing needs it.
 *
 * It needs `CLOUDFLARE_API_TOKEN`, which Workers Builds sets for its deploy command. The account
 * is `CLOUDFLARE_ACCOUNT_ID`, or the one the token reaches, named like the GitHub owner when there
 * are several.
 *
 * The steps, each one call or a few:
 *
 * 1. The manifest: each file's path, size and hash. The hash is any 32 hex characters, and this
 *    is the first 32 of SHA-256, as Cloudflare's own example takes it, so Node's crypto does it.
 * 2. The upload session answers which files Cloudflare doesn't already have, in buckets, and
 *    only those are sent, base64-encoded, with the session's token. A bucket is tried up to five
 *    times, as cf tries it, since a site that changes every page sends many.
 *    ([A bucket's tries](#a-buckets-tries) says which failures are tried again.)
 * 3. The Worker is uploaded with no code, only the assets' completion token, how it serves them
 *    and its compatibility date. That deploys it.
 * 4. Its domains are written, replacing any it had, as cf does in a build.
 * 5. `workers.dev` and preview URLs are turned off, as the config says.
 *
 * The config is parsed, not run, as the rules read it ([config.ts](config.ts)), so it imports
 * nothing and installs nothing. A value it works out, rather than writes, isn't read.
 *
 * `_headers` and `_redirects` at the folder's root go with the Worker, not as files, as cf sends
 * them. A `.assetsignore` fails the deploy, since nothing here reads its patterns.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { valueAt } from "./config.ts";
import { OWNER } from "./reference.ts";

// What a static site's `cloudflare.config.ts` writes under `worker`, as cf's config names it.
type Site = {
  name: string;
  domains: string[];
  compatibilityDate: string;
  assets: {
    directory: string;
    notFoundHandling?: string;
    htmlHandling?: string;
  };
};

const API = "https://api.cloudflare.com/client/v4";
// Cloudflare's limit on one file.
const LARGEST = 25 * 1024 * 1024;
const SENT_WITH_WORKER = ["_headers", "_redirects"];

// What a file is served as, by its extension. Text is UTF-8, as cf serves it.
const TYPES: Record<string, string> = {
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  json: "application/json",
  map: "application/json",
  webmanifest: "application/manifest+json",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  xml: "application/xml",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/vnd.microsoft.icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  pdf: "application/pdf",
  wasm: "application/wasm",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** What a file is served as. cf sends `application/null` for what it doesn't know. */
export function contentType(file: string): string {
  const type = TYPES[extname(file).slice(1).toLowerCase()];
  if (!type) return "application/null";
  return type.startsWith("text/") ? `${type}; charset=utf-8` : type;
}

type File = { path: string; hash: string; size: number };

/** Each file in the folder, by its address, with the hash Cloudflare files it under. */
export function manifest(folder: string): File[] {
  if (existsSync(join(folder, ".assetsignore"))) {
    throw new Error(`${folder} has a .assetsignore, which craftz deploy doesn't read`);
  }
  const files: File[] = [];
  for (const name of readdirSync(folder, { recursive: true, encoding: "utf8" }).sort()) {
    const full = join(folder, name);
    const stat = statSync(full);
    if (!stat.isFile() || SENT_WITH_WORKER.includes(name)) continue;
    if (stat.size > LARGEST) throw new Error(`${full} is over Cloudflare's 25 MiB for a file`);
    const content = readFileSync(full).toString("base64") + extname(name).slice(1);
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 32);
    files.push({ path: `/${name.split(sep).join("/")}`, hash, size: stat.size });
  }
  return files;
}

type Fetch = typeof fetch;
type Answer<T> = { success: boolean; errors?: { code: number; message: string }[]; result: T };

type Init = { method?: string; body?: string | FormData; headers?: Record<string, string> };

// A call Cloudflare answered with a failure, with the status and codes that say whose it was.
class Failed extends Error {
  readonly status: number;
  readonly codes: number[];
  constructor(message: string, status: number, codes: number[]) {
    super(message);
    this.status = status;
    this.codes = codes;
  }
}

// One call to Cloudflare's API, with a token, answering its result or failing with its errors.
async function call<T>(api: Fetch, token: string, path: string, init: Init = {}) {
  const response = await api(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
  const answer = (await response.json().catch(() => ({ success: false }))) as Answer<T>;
  if (!answer.success) {
    const errors = answer.errors?.map((e) => `${e.message} [${e.code}]`).join("; ");
    const codes = answer.errors?.map((e) => e.code) ?? [];
    const message = `${init.method ?? "GET"} ${path} failed: ${errors || response.status}`;
    throw new Failed(message, response.status, codes);
  }
  return answer.result;
}

/** @prose
 * # A bucket's tries
 *
 * A bucket that fails on Cloudflare's side is tried again, and one that fails on ours isn't.
 *
 * Cloudflare's side is a 5xx answer, its unknown error `10013`, or a request that never got an
 * answer. markz's deploy once failed on `10013` alone. A failure that says the request was wrong,
 * like a bad token, fails at once, since it would fail the same way again. The pause doubles after
 * each try, from a second, so five tries wait 15 seconds at most.
 */
const TRIES = 5;
const UNKNOWN = 10013;
const ours = (error: unknown): boolean =>
  !(error instanceof Failed) || error.status >= 500 || error.codes.includes(UNKNOWN);

/** Pauses between tries. The test passes one that doesn't wait. */
export type Pause = (ms: number) => Promise<void>;
const pause: Pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function tried<T>(attempt: () => Promise<T>, wait: Pause): Promise<T> {
  for (let tries = 1; ; tries++) {
    try {
      return await attempt();
    } catch (error) {
      if (tries === TRIES || !ours(error)) throw error;
      await wait(1000 * 2 ** (tries - 1));
    }
  }
}

const json = (method: string, body: unknown, headers: Record<string, string> = {}) => ({
  method,
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json", ...headers },
});

// The account the token reaches, the one named like the GitHub owner when there are several.
async function account(api: Fetch, token: string): Promise<string> {
  const set = process.env["CLOUDFLARE_ACCOUNT_ID"];
  if (set) return set;
  const accounts = await call<{ id: string; name: string }[]>(api, token, "/accounts");
  const found = accounts.length === 1 ? accounts[0] : accounts.find((a) => a.name === OWNER);
  if (!found) throw new Error(`the token reaches no account named ${OWNER}`);
  return found.id;
}

/** Uploads the site that `dir`'s `cloudflare.config.ts` names, and says what it did. */
export async function deploy(dir: string, api: Fetch = fetch, wait = pause): Promise<string[]> {
  const token = process.env["CLOUDFLARE_API_TOKEN"];
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN isn't set. Workers Builds sets it.");
  const config = join(dir, "cloudflare.config.ts");
  const { name, domains, assets, compatibilityDate } = (valueAt(readFileSync(config, "utf8"), [
    "worker",
  ]) ?? {}) as Partial<Site>;
  if (!name || !domains || !assets?.directory || !compatibilityDate) {
    throw new Error(
      "cloudflare.config.ts doesn't write out its worker's name, domains, assets.directory and compatibilityDate.",
    );
  }
  const folder = join(dir, assets.directory);
  if (!existsSync(folder)) throw new Error(`${assets.directory} isn't built. verify builds it.`);

  const files = manifest(folder);
  const id = await account(api, token);
  const script = `/accounts/${id}/workers/scripts/${name}`;
  const done: string[] = [];

  const session = await call<{ jwt: string; buckets: string[][] }>(
    api,
    token,
    `${script}/assets-upload-session`,
    json("POST", { manifest: Object.fromEntries(files.map((f) => [f.path, f])) }),
  );
  let completion = session.jwt;
  const byHash = new Map(files.map((f) => [f.hash, f]));
  for (const bucket of session.buckets) {
    const form = new FormData();
    for (const hash of bucket) {
      const file = byHash.get(hash);
      if (!file) throw new Error(`Cloudflare asked for ${hash}, which isn't in the manifest`);
      const content = readFileSync(join(folder, file.path)).toString("base64");
      form.append(hash, new Blob([content], { type: contentType(file.path) }), hash);
    }
    const upload = `/accounts/${id}/workers/assets/upload?base64=true`;
    const uploaded = await tried(
      () => call<{ jwt?: string }>(api, session.jwt, upload, { method: "POST", body: form }),
      wait,
    );
    completion = uploaded.jwt ?? completion;
  }
  const sent = session.buckets.flat().length;
  done.push(`${files.length} files from ${assets.directory}, ${sent} of them new`);

  const extra = Object.fromEntries(
    SENT_WITH_WORKER.filter((file) => existsSync(join(folder, file))).map((file) => [
      file,
      readFileSync(join(folder, file), "utf8"),
    ]),
  );
  const worker = new FormData();
  worker.set(
    "metadata",
    JSON.stringify({
      assets: {
        jwt: completion,
        config: {
          html_handling: assets.htmlHandling,
          not_found_handling: assets.notFoundHandling,
          ...extra,
        },
      },
      compatibility_date: compatibilityDate,
    }),
  );
  await call(api, token, script, { method: "PUT", body: worker });
  done.push(`${name} deployed, at ${compatibilityDate}`);

  await call(
    api,
    token,
    `${script}/domains/records`,
    json("PUT", {
      override_scope: true,
      override_existing_origin: true,
      override_existing_dns_record: true,
      origins: domains.map((hostname) => ({ hostname })),
    }),
  );
  done.push(`on ${domains.join(", ")}`);

  await call(
    api,
    token,
    `${script}/subdomain`,
    json(
      "POST",
      { enabled: false, previews_enabled: false },
      { "Cloudflare-Workers-Script-Api-Date": "2025-08-01" },
    ),
  );
  done.push("workers.dev and preview URLs off");
  return done;
}
