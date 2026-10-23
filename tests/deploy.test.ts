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

// Cloudflare's API, which asks for every file in one bucket.
function cloudflare(calls: Call[]): typeof fetch {
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
