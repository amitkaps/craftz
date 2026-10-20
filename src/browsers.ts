/** @prose
 * # The browsers
 *
 * The browsers the rules' [floors](../docs/rules.md#browsers) name, worked out from MDN's
 * browser-compat-data. The date is the data's own, not today's, so the list moves only when
 * `pnpm align` moves the package, and two runs on one version agree.
 *
 * A release counts once it's out, so a beta or a planned one doesn't. Samsung Internet names
 * the Chromium it runs on as its engine version.
 */
import { createRequire } from "node:module";

type Release = { release_date?: string; status: string; engine_version?: string };

// Read through require, which parses the 15 MB of JSON natively. A JSON import is turned into a
// module first, which cost each test file 12 seconds.
const bcd = createRequire(import.meta.url)("@mdn/browser-compat-data") as {
  browsers: Record<string, { releases: Record<string, Release> }>;
  __meta: { timestamp: string };
};

const OUT = ["retired", "current", "esr"];

function released(browser: string): [string, Release][] {
  const releases = bcd.browsers[browser];
  return Object.entries(releases?.releases ?? {}).filter(
    ([, r]) => r.release_date && r.release_date <= bcd.__meta.timestamp && OUT.includes(r.status),
  );
}

const major = (version: string): number => Number(version.split(".")[0]);

// Blink: the oldest Chromium released in the year before the data's date, or the current
// Samsung Internet's, when that's older.
function blink(): number {
  const year = new Date(bcd.__meta.timestamp);
  year.setFullYear(year.getFullYear() - 1);
  const since = year.toISOString();
  const chrome = released("chrome")
    .filter(([, r]) => (r.release_date ?? "") >= since)
    .map(([version]) => major(version));
  const samsung = released("samsunginternet_android").find(([, r]) => r.status === "current");
  return Math.min(...chrome, major(samsung?.[1].engine_version ?? "Infinity"));
}

// Gecko: the oldest ESR Mozilla supports.
const gecko = (): number =>
  Math.min(
    ...released("firefox")
      .filter(([, r]) => r.status === "esr")
      .map(([v]) => major(v)),
  );

// WebKit: the newest release listed of the major two before the current one.
function webkit(browser: string): string {
  const versions = released(browser).map(([version]) => version);
  const majors = [...new Set(versions.map(major))].sort((a, b) => b - a);
  const floor = versions.filter((v) => major(v) === majors[2]);
  return floor.sort((a, b) => Number.parseFloat(b) - Number.parseFloat(a))[0] ?? "";
}

export const BROWSERS = [
  `chrome${blink()}`,
  `edge${blink()}`,
  `firefox${gecko()}`,
  `safari${webkit("safari")}`,
  `ios${webkit("safari_ios")}`,
];
