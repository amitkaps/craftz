/** @prose
 * # The deploy's test
 *
 * Deploys a small site to a stand-in for Cloudflare's API, which answers as Cloudflare does and
 * keeps each call, so the test reads what [deploy.ts](../src/deploy.ts) sent, in order.
 */
import { expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPATIBILITY_DATE } from "../src/runtime.ts";
import { contentType, deploy, manifest } from "../src/deploy.ts";

// The failure markz's deploy hit, and one that says the request was wrong.
const UNKNOWN = { code: 10013, message: "An unknown error has occurred", status: 500 };
const REFUSED = { code: 10000, message: "Authentication error", status: 403 };
const now = async (): Promise<void> => {};

function siteIn(): string {
  const dir = mkdtempSync(join(tmpdir(), "craftz-deploy-"));
  const cloudflare = join(import.meta.dirname, "../src/cloudflare.ts");
  writeFileSync(
    join(dir, "cloudflare.config.ts"),
    `import { site } from ${JSON.stringify(cloudflare)};

export default site({
  name: "x",
  domains: ["x.amitkaps.com"],
  assets: { directory: ".prose", notFoundHandling: "404-page" },
});
`,
  );
  mkdirSync(join(dir, ".prose/docs"), { recursive: true });
  writeFileSync(join(dir, ".prose/index.html"), "<h1>x</h1>");
  writeFileSync(join(dir, ".prose/docs/a.css"), "h1 {}");
  writeFileSync(join(dir, ".prose/_headers"), "/*\n  X-Frame-Options: DENY\n");
  writeFileSync(join(dir, ".prose/_redirects"), "/old /docs/a.css 301\n");
  return dir;
}

type Call = { method: string; path: string; body: unknown };

// Cloudflare's API, which asks for every file in one bucket. The first `failing` uploads fail
// with `failure`.
function cloudflare(calls: Call[], failing = 0, failure = UNKNOWN): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    const path = url.replace("https://api.cloudflare.com/client/v4", "");
    const body = init.body;
    const read =
      typeof body === "string"
        ? JSON.parse(body)
        : body instanceof FormData
          ? Object.fromEntries([...body.keys()].map((key) => [key, body.get(key)]))
          : body;
    calls.push({ method: init.method ?? "GET", path, body: read });
    if (path.includes("/assets/upload") && failing-- > 0) {
      const errors = [{ code: failure.code, message: failure.message }];
      return new Response(JSON.stringify({ success: false, errors }), { status: failure.status });
    }
    const hashes = Object.values(
      (read as { manifest?: Record<string, { hash: string }> }).manifest ?? {},
    ).map((file) => file.hash);
    const result = path.endsWith("/assets-upload-session")
      ? { jwt: "session", buckets: [hashes] }
      : path.includes("/assets/upload")
        ? { jwt: "completion" }
        : {};
    return new Response(JSON.stringify({ success: true, result }));
  }) as typeof fetch;
}

test("a file's type is what Cloudflare serves it as", () => {
  expect(contentType("index.html")).toBe("text/html; charset=utf-8");
  expect(contentType("a.WOFF2")).toBe("font/woff2");
  expect(contentType("LICENSE")).toBe("application/null");
});

test("the manifest has each file by its address, without the Worker's own", () => {
  const files = manifest(join(siteIn(), ".prose"));
  expect(files.map((file) => file.path)).toEqual(["/docs/a.css", "/index.html"]);
  expect(files.every((file) => /^[0-9a-f]{32}$/.test(file.hash))).toBe(true);
});

test("deploy uploads the files, then the Worker, its domains and its addresses", async () => {
  process.env["CLOUDFLARE_API_TOKEN"] = "token";
  process.env["CLOUDFLARE_ACCOUNT_ID"] = "account";
  const calls: Call[] = [];
  const done = await deploy(siteIn(), cloudflare(calls));
  const script = "/accounts/account/workers/scripts/x";
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
    `POST ${script}/assets-upload-session`,
    "POST /accounts/account/workers/assets/upload?base64=true",
    `PUT ${script}`,
    `PUT ${script}/domains/records`,
    `POST ${script}/subdomain`,
  ]);
  const { metadata = "" } = (calls[2]?.body ?? {}) as { metadata?: string };
  expect(JSON.parse(metadata)).toEqual({
    assets: {
      jwt: "completion",
      config: {
        not_found_handling: "404-page",
        _headers: "/*\n  X-Frame-Options: DENY\n",
        _redirects: "/old /docs/a.css 301\n",
      },
    },
    compatibility_date: COMPATIBILITY_DATE,
  });
  expect(calls[3]?.body).toMatchObject({ origins: [{ hostname: "x.amitkaps.com" }] });
  expect(calls[4]?.body).toEqual({ enabled: false, previews_enabled: false });
  expect(done).toEqual([
    "2 files from .prose, 2 of them new",
    `x deployed, at ${COMPATIBILITY_DATE}`,
    "on x.amitkaps.com",
    "workers.dev and preview URLs off",
  ]);
});

test("an upload Cloudflare fails on its side is tried again, up to five times", async () => {
  process.env["CLOUDFLARE_API_TOKEN"] = "token";
  process.env["CLOUDFLARE_ACCOUNT_ID"] = "account";
  const uploads = (calls: Call[]) => calls.filter((call) => call.path.includes("/assets/upload"));
  const twice: Call[] = [];
  const waits: number[] = [];
  await deploy(siteIn(), cloudflare(twice, 2), async (ms) => void waits.push(ms));
  expect(uploads(twice)).toHaveLength(3);
  expect(waits).toEqual([1000, 2000]);

  const always: Call[] = [];
  await expect(deploy(siteIn(), cloudflare(always, 9), now)).rejects.toThrow("[10013]");
  expect(uploads(always)).toHaveLength(5);

  const refused: Call[] = [];
  await expect(deploy(siteIn(), cloudflare(refused, 1, REFUSED), now)).rejects.toThrow("[10000]");
  expect(uploads(refused)).toHaveLength(1);
});
