# Plan

craftz 0.2.0 is on npm, and its docs are live at [craftz.amitkaps.com](https://craftz.amitkaps.com). What each release changed is in its [notes on GitHub](https://github.com/amitkaps/craftz/releases). This plan says what's next, in order, and what works now. [The design](design.md) is the whole of what craftz becomes. Each repository moves to a release in its own pull request, which its own plan tracks.

## Next, in order

1. **The old repository retires.** The one that kept the rules before craftz is archived with its history, and its site redirects to craftz's, for the links outside these repositories. Every `AGENTS.md` links to craftz now.

## Where it is

- **The rules, checked and fixed.** [The rules](rules.md) are worded once, and their checks and fixes are in [src/](../src/), against the files in [reference/](../reference/README.md). `craftz rules`, `check` and `fix` run them from the installed version, and a second `fix` changes nothing.
- **GitHub's settings.** `craftz settings` writes only what has drifted and reads it back, with `--check` to only read. A package's ruleset requires `label` next to `ci`.
- **One toolchain.** `craftz()` sets every repository's `fmt` and `lint`, and fails a config that sets either differently. A static site names its own folder as Vite's `publicDir`, and `craftz()` never guesses one. `craftz deploy` runs cf, or wrangler for an app cf can't build yet.
- **Pull requests.** `pnpm pr` and `pnpm gone` run craftz's commands, in place of the scripts every repository copied. `pr` starts where the title says, and stops when the branch has nothing new for `main`. A package's label is checked by `label.yml`, so a pull request runs `verify` once. `gone` removes a merged branch's worktree.
- **What's live.** `craftz status` reads CI on `main`, the open pull requests, npm's version against `package.json` on `main`, the latest release, and a site's build and addresses, on cf or wrangler.
- **Releases.** The release workflow stages a version on npm and tags it once approved, and each release's notes say what to change when a repository moves. align, new and release run the same rules, and `new` starts a repository that passes them, as craftz-test did.
- **The repositories.** The public ones carry the topic `craftz`, which is how align and drift find them.

## Later

- The beta packages that [`versions-beta`](rules.md#versions-beta) names move to their releases when they graduate, which the sweeps report.
- The app moves to cf when SvelteKit's adapter writes cf's Build Output, and wrangler leaves the catalog with it.
- The app moves to TypeScript 7 when svelte-check's peer range takes it.
- A size budget for packages a browser loads, measured as markz's `pnpm size` does: bundled, minified and gzipped. It waits for a second package that needs one, since a Node tool like craftz pays for its install, not its bundle. Speed stays each package's own, since what it times differs.

## Open questions

- **Where axes meet badly.** A package in a private repository can't publish with provenance, and only `new` says so. A private repository's rulesets need a paid GitHub plan, which this account has. Each could be a check that shows a hold, once a repository is in that position. A private npm package would add a value to the publish axis, and none is needed yet.

- **Browser code Vite doesn't build.** prose's and pagez's page scripts and styles are copied as they're written, so [`toolchain-browsers`](rules.md#toolchain-browsers) doesn't reach them, and nothing stops them using a feature past a floor. A Baseline lint that reads the same list would, once oxlint has one. Until then, check a new feature's support by hand.

  prose's `built` plugin runs oxfmt, which only formats. Lowering syntax is in reach: `vite-plus` exports `transformWithOxc` for JS, and Lightning CSS's `transform({ targets })` does CSS, as a devDependency. But at today's floors there's little to lower, and Oxc's lowering can add `require` of its runtime helpers, which a page script can't load. An API past a floor, like `::highlight()`, can't be lowered at all, so the lint is the part that matters.

- **Keeping the docs fresh.** The docs are checked for their files, not their sections, and that stays. What goes stale is what they say, like `development.md` describing a setting the rules have moved past, and a check can't tell. One cheap signal: the dashboard could show when each doc last changed beside when the code did, so a doc untouched through many changes stands out, without failing anything.
