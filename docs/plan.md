# Plan

craftz 0.3.0 is on npm, and its docs are live at [craftz.amitkaps.com](https://craftz.amitkaps.com). What each release changed is in its [notes on GitHub](https://github.com/amitkaps/craftz/releases). This plan says what's next, in order, and what works now. [The design](design.md) is the whole of what craftz becomes. Each repository moves to a release in its own pull request, which its own plan tracks.

## Next, in order

Every repository is on 0.3.0. craftz started as a repository that checked the others from a laptop, and these finish thinking of it as a package. Each is its own pull request, and 0.4.0 carries them once there's enough to release.

1. **`craftz upgrade`.** One command moves a repository to the latest craftz. It adds it, runs its fix, installs and formats. align becomes that, in a clone of each repository, then `verify`, a pull request and the settings.
2. **`craftz release` moves into the package.** A package releases from its own folder, like `pr` and `status`, with no checkout of craftz.
3. **drift goes.** Each repository's CI checks its files against the craftz it installs, and what needs a login stays on the laptop. `status` says whether a site is public, `pnpm align --local` reads the settings and changes nothing, and the docs follow. The dashboard leaves the design, since it was drift as a page.

## Where it is

- **Exact versions.** Every shared tool and craftz are pinned exactly, in one list, the reference's `package.json`, so a repository runs what it names.
- **The rules, checked and fixed.** [The rules](rules.md) are worded once, and their checks and fixes are in [src/](../src/), against the files in [reference/](../reference/README.md). `craftz rules`, `check` and `fix` run them from the installed version, and a second `fix` changes nothing. Every `verify` runs `pnpm craftz check`, so each pull request is checked against the craftz it installs. craftz checks itself from source, since the version it installs can't hold the rules it's changing. Its tests install the package `pnpm pack` writes, as a repository would, so a file the package leaves out fails a test here. A hold is found by the repository the folder's `origin` names, so a worktree gets its checkout's holds.
- **GitHub's settings.** `craftz settings` writes only what has drifted and reads it back, with `--check` to only read. A package's ruleset requires `label` next to `ci`.
- **One toolchain.** `craftz()` sets every repository's `fmt` and `lint`, and fails a config that sets either differently. Its values are stated once, and `toolchain-craftz`'s fix reads them to take each out of a config. A static site names its own folder as Vite's `publicDir`, and `craftz()` never guesses one. `craftz deploy` runs cf, or wrangler for an app cf can't build yet.
- **Pull requests.** `pnpm pr` and `pnpm gone` run craftz's commands, in place of the scripts every repository copied. `pr` starts where the title says, and stops when the branch has nothing new for `main`. A package's label is checked by `label.yml`, so a pull request runs `verify` once. `gone` removes a merged branch's worktree.
- **What's live.** `craftz status` reads CI on `main`, the open pull requests, npm's version against `package.json` on `main`, the latest release, and a site's build and addresses, on cf or wrangler.
- **Releases.** The release workflow stages a version on npm and tags it once approved, and each release's notes say what to change when a repository moves. `pnpm bump` moves the reference's versions before a release. After it, `pnpm align` moves each repository to the latest craftz on npm and runs that version's `craftz fix`, so a change reaches the others only once it's released. `craftz new` starts a repository that passes the rules, from any folder with `pnpm dlx`. align, bump, drift and release are this repository's own scripts, for whoever keeps the repositories, and the package doesn't ship them.
- **The repositories.** The public ones carry the topic `craftz`, which is how align and drift find them.

## Later

- The old repository retires. The one that kept the rules before craftz is archived with its history, and its site redirects to craftz's, for the links outside these repositories. Nothing in these repositories links to it, and every `AGENTS.md` links to craftz.
- The beta packages that [`versions-beta`](rules.md#versions-beta) names move to their releases when they graduate, which the sweeps report.
- The app moves to cf when SvelteKit's adapter writes cf's Build Output, and wrangler leaves the reference with it.
- The app moves to TypeScript 7 when svelte-check's peer range takes it.
- A site's `vp check` loads Cloudflare's plugin, though only `vp build` uses it. Vite+ loads the whole config for `fmt` and `lint` too, and the plugin takes a second to import, most of it compiling its 4 MB bundle and miniflare's 6 MB one. So a site checks in about 7 seconds where a package takes under 3, and three sites are most of craftz's test time. A config can't load it only to build, since `vp check` passes it `command: "build"`, as `vp build` does. It waits for Vite+ to tell a check from a build, or for the plugin to load less until it's used.
- Errors, warnings and notes, as [the design](design.md#errors-warnings-and-notes) has them. A hold moves into the repository it holds, as a warning, and only on a rule craftz marks as one a tool can block. `check` notes a newer craftz. It waits for a second repository that needs a hold, since base is the only one, and its two holds are tools' limits.
- `tsconfig.json` extends one the package ships, as `vite.config.ts` uses `craftz()`, so the strict options live in craftz and a repository's file only points at them. `toolchain-types` checks them now, which works since JSON reads cleanly.
- A size budget for packages a browser loads, measured as markz's `pnpm size` does: bundled, minified and gzipped. It waits for a second package that needs one, since a Node tool like craftz pays for its install, not its bundle. Speed stays each package's own, since what it times differs.

## Open questions

- **Where axes meet badly.** A package in a private repository can't publish with provenance, and only `new` says so. A private repository's rulesets need a paid GitHub plan, which this account has. Each could be a check that shows a hold, once a repository is in that position. A private npm package would add a value to the publish axis, and none is needed yet.

- **Browser code Vite doesn't build.** prose's and pagez's page scripts and styles are copied as they're written, so [`toolchain-browsers`](rules.md#toolchain-browsers) doesn't reach them, and nothing stops them using a feature past a floor. A Baseline lint that reads the same list would, once oxlint has one. Until then, check a new feature's support by hand.

  prose's `built` plugin runs oxfmt, which only formats. Lowering syntax is in reach: `vite-plus` exports `transformWithOxc` for JS, and Lightning CSS's `transform({ targets })` does CSS, as a devDependency. But at today's floors there's little to lower, and Oxc's lowering can add `require` of its runtime helpers, which a page script can't load. An API past a floor, like `::highlight()`, can't be lowered at all, so the lint is the part that matters.

- **Keeping the docs fresh.** The docs are checked for their files, not their sections, and that stays. What goes stale is what they say, like `development.md` describing a setting the rules have moved past, and a check can't tell. One cheap signal is when each doc last changed beside when the code did, so a doc untouched through many changes stands out, without failing anything.

- **Editing code by regular expression.** The fixes edit `vite.config.ts`, `cloudflare.config.ts`, CI and `pnpm-workspace.yaml` with regular expressions, which depend on how each file is laid out. Most of the lessons about fixes come from there. Those edits are all in [edit.ts](../src/edit.ts) now, each a function from a file's text to its fixed text, and only where `craftz()` can't do the job. A small parser for the flat YAML, or fewer edits, would remove that kind of fault.
