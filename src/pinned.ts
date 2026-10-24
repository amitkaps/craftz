/** @prose
 * # Fixed when it's packed
 *
 * The browsers and the Workers' date, as the rules use them, written in when the package is
 * built.
 *
 * From source, they're worked out from browser-compat-data and the reference's cf, as
 * [browsers.ts](browsers.ts) and [runtime.ts](runtime.ts) do. The package can't carry
 * browser-compat-data, which alone is megabytes, or read npm each time it runs. So `vp pack` works them out once and writes them in as `__PINNED__`, and the
 * published command uses the values it was built with.
 *
 * That's what the rules want anyway. Both move only when `pnpm bump` moves their packages, so a
 * version of craftz always means one list and one date.
 */
declare const __PINNED__: { browsers: string[]; date: string } | undefined;

const pinned = typeof __PINNED__ === "undefined" ? undefined : __PINNED__;

/** The browsers the rules' floors name, as Vite's `build.target` takes them. */
export const BROWSERS: string[] = pinned?.browsers ?? (await import("./browsers.ts")).BROWSERS;

/** The compatibility date every Worker runs at. */
export const COMPATIBILITY_DATE: string =
  pinned?.date ?? (await import("./runtime.ts")).COMPATIBILITY_DATE;
