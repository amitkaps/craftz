/** @prose
 * # Screenshots
 *
 * `craftz shot <url> <file.png>` saves a page as a PNG, so an agent sees what it built. It uses
 * the repository's own `@playwright/test`, the version [the rules](../docs/rules.md#versions-playwright)
 * hold to the Chromium the cloud image ships, so it downloads nothing. It's the one way to look
 * at a page, so an agent doesn't install a browser tool of its own.
 *
 * A page that renders in the browser is still blank at `load`, so the picture waits for two more
 * things. The network going quiet covers a page still fetching its data. Something drawn covers a
 * page that renders with no network, where a quiet network says nothing. The first is capped and
 * passes when it runs out, since a page that polls never goes quiet. Text alone can't replace it,
 * since a page's first text arrives long before the rest.
 *
 * A page with nothing drawn still gets its picture, and the command fails, saying so. A blank PNG
 * and a passing exit would tell an agent the page worked.
 *
 * It doesn't scroll, so content a page renders only on scrolling stays out of the picture.
 *
 * craftz doesn't depend on Playwright. It loads the one the repository has, and says so when
 * there is none.
 */
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const QUIET_MS = 10_000;
const DRAWN_MS = 5_000;
const DRAWN = `document.body.innerText.trim() || document.querySelector("img, svg, canvas, video")`;

type Playwright = {
  chromium: {
    launch(): Promise<{
      newPage(options: { viewport: { width: number; height: number } }): Promise<{
        goto(url: string): Promise<unknown>;
        waitForLoadState(state: "networkidle", options: { timeout: number }): Promise<void>;
        waitForFunction(
          expression: string,
          arg: undefined,
          options: { timeout: number },
        ): Promise<unknown>;
        screenshot(options: { path: string; fullPage: boolean }): Promise<unknown>;
      }>;
      close(): Promise<void>;
    }>;
  };
};

/** Saves the page at a URL as a PNG, 1280 pixels wide unless `--width` says otherwise. */
export async function shot(dir: string, args: string[]): Promise<number> {
  const at = args.indexOf("--width");
  const width = at === -1 ? 1280 : Number(args.splice(at, 2)[1]);
  const [url, file, ...extra] = args;
  if (!url || !file || extra.length || !Number.isInteger(width) || width < 1) {
    console.error("Give a page and a file: craftz shot <url> <file.png> [--width <pixels>]");
    return 1;
  }

  let found: string;
  try {
    found = createRequire(join(dir, "package.json")).resolve("@playwright/test");
  } catch {
    console.error(
      "craftz shot: this folder has no @playwright/test. Add it at the reference's version.",
    );
    return 1;
  }
  const loaded = (await import(pathToFileURL(found).href)) as Playwright & { default?: Playwright };
  const { chromium } = loaded.chromium ? loaded : (loaded.default as Playwright);

  const browser = await chromium.launch().catch((error: unknown) => {
    const first = String(error instanceof Error ? error.message : error).split("\n")[0];
    console.error(`craftz shot: ${first}`);
    console.error("Install the browser with: pnpm exec playwright install --only-shell chromium");
    return undefined;
  });
  if (!browser) return 1;
  let drawn = true;
  try {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(url);
    await page.waitForLoadState("networkidle", { timeout: QUIET_MS }).catch(() => {});
    drawn = await page.waitForFunction(DRAWN, undefined, { timeout: DRAWN_MS }).then(
      () => true,
      () => false,
    );
    await page.screenshot({ path: resolve(dir, file), fullPage: true });
  } finally {
    await browser.close();
  }
  console.log(resolve(dir, file));
  if (!drawn) {
    console.error(`craftz shot: the page has nothing drawn after ${DRAWN_MS / 1000}s: ${url}`);
    return 1;
  }
  return 0;
}
