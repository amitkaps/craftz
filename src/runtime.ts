/** @prose
 * # The Workers' date
 *
 * The compatibility date every Worker on cf runs at: the build date of the workerd that cf
 * installs, through miniflare. workerd's version carries it, as in `1.20261012.1`. It's the newest
 * date the local runtime knows, so dev and tests run what production does, and it moves only
 * when `pnpm align` moves cf.
 *
 * From 2026-08-04, the date turns on Node.js compatibility, so no Worker sets a flag for it.
 */
import { createRequire } from "node:module";

const fromCf = createRequire(createRequire(import.meta.url).resolve("cf/package.json"));
const fromMiniflare = createRequire(fromCf.resolve("miniflare/package.json"));
const workerd = fromMiniflare("workerd/package.json") as { version: string };

const built = /^\d+\.(\d{4})(\d{2})(\d{2})\./.exec(workerd.version);
if (!built) throw new Error(`workerd ${workerd.version} doesn't carry a date`);

export const COMPATIBILITY_DATE = `${built[1]}-${built[2]}-${built[3]}`;
