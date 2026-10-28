# Plan

craftz 0.10.0 is on npm, and its docs are live at [craftz.amitkaps.com](https://craftz.amitkaps.com). What each release changed is in its [notes on GitHub](https://github.com/amitkaps/craftz/releases). This plan says what's next, in order, and what works now. [The design](design.md) is the whole of what craftz becomes.

This is a package's plan, of what craftz itself does next. Each repository moves to a release in its own pull request, which its own plan tracks, so this plan never lists those moves.

## Next, in order

Nothing is queued.

## Where it is

- **Each repository checks itself.** Its CI runs `craftz check` against the craftz it installs, so nothing checks it from outside. What needs a login stays on the laptop: `craftz settings --check`, `craftz status`, and `pnpm align --local` for every repository at once.
- **Exact versions.** Every shared tool and craftz are pinned exactly, in one list, the reference's `package.json`, so a repository runs what it names. cf is a beta, which no repository installs. craftz reads the compatibility date from the workerd it depends on, and runs it for the Worker's settings. Node's floor is 26.12.1.
- **`craftz upgrade`.** One command moves a repository to the latest craftz and runs that version's fix, and align runs its steps in a clone of each repository.
- **The rules, checked and fixed.** [The rules](rules.md) are worded once, and their checks and fixes are in [src/](../src/), against the files in [reference/](../reference/README.md). `craftz rules`, `check` and `fix` run them from the installed version, and a second `fix` changes nothing. The rules are read with markz's reader, which craftz bundles, and each finding prints in markz's line, as prose's do. Every `verify` runs `pnpm craftz check`, so each pull request is checked against the craftz it installs. craftz checks itself from source, since the version it installs can't hold the rules it's changing. Its tests install the package `pnpm pack` writes, as a repository would, so a file the package leaves out fails a test here. Each rule is yes or no. A repository holds a rule a tool blocks in its own `package.json`, which `check` prints as a warning, and `check` notes a newer craftz and a graduated beta.
- **GitHub's settings.** `craftz settings` writes only what has drifted and reads it back, with `--check` to only read. A package's ruleset requires `label` next to `ci`.
- **One toolchain.** `craftz()` sets every repository's `fmt` and `lint`, and a package's publint, Oxc's types and platform, Node unless it says `craftz({ browser: true })`. It fails a config that sets one differently. `site()` sets a Worker's date and addresses, and a repository's `tsconfig.json` extends the one craftz ships. A static site names its own folder in `cloudflare.config.ts`, and nothing guesses one. `craftz deploy` uploads it, or runs wrangler for an app, and tries a bucket again when Cloudflare fails on its side.
- **Files craftz owns.** CI, pnpm's settings, the editor's and a package's release files are checked word for word against [reference/](../reference/README.md) and written whole, so what a repository adds goes in `verify`. An app adds Svelte's editor settings.
- **Pull requests.** `pnpm pr` and `pnpm gone` run craftz's commands, in place of the scripts every repository copied. `pr` starts where the title says, and stops when the branch has nothing new for `main`. It returns once it's pushed, and a new title waits for the branch's open pull request to merge first. `--wait` merges once the checks pass, updating a branch that fell behind, and says how long CI and the merge took. A package's label is checked by `label.yml`, so a pull request runs `verify` once. `gone` removes a merged branch's worktree, finds a merged branch GitHub kept or never had, and ends on `main`, pulled. `pr` runs it first. `gone` and `--wait` write `outline.md` once they're on `main`, where prose is installed.
- **What agents read.** Every repository's `AGENTS.md` opens with the same sections, craftz, Prose and Outline, word for word from the [reference](../reference/AGENTS.md). They say when to read the rules, to run `pnpm gone` before a change, that `pnpm pr` runs `verify` so it isn't run first, and import `outline.md`, which git ignores. `verify` writes it on the branch, and `gone` and `pr --wait` write it again on `main`.
- **What's installed.** `craftz deps` weighs a repository's install, by direct dependency.
- **The commands, stated once.** Each command opens its section of [usage](usage.md) with an id, and `craftz help` prints from there with markz's reader, as prose's and pagez's help do. A test fails if cli.ts runs a command usage doesn't state, or the other way, and the README links each one.
- **What's live.** `craftz status` reads CI on `main`, the open pull requests, npm's version against `package.json` on `main`, the latest release, and a site's build, addresses and audience, on cf or wrangler. `--timing` says what the last pull requests took, and why slow ones were slow.
- **Releases.** The release workflow stages a version on npm and tags it once approved, and each release's notes say what to change when a repository moves. `pnpm bump` moves the reference's versions before a release. After it, `pnpm align` runs `craftz upgrade` in a clone of each repository, so a change reaches the others only once it's released, and brings each checkout to `main` once its merges land. `craftz new` starts a repository that passes the rules, from any folder with `pnpm dlx`. `craftz release` opens a package's release from its own folder, once the plan's summary names the version and no step is ticked. Without a terminal, it asks for `--notes`. The notes are grouped by `.github/notes.yml`. Every plan's steps are tasks, ticked as each merges, which [`docs-plan`](rules.md#docs-plan) checks, and its fix turns a numbered step into one. align and bump are this repository's own scripts, for whoever keeps the repositories, and the package doesn't ship them.
- **The repositories.** The public ones carry the topic `craftz`, which is how align finds them. The one that kept the rules before craftz is deleted, with its site, since craftz holds its rules and lessons.

## Later

- The beta packages that [`versions-beta`](rules.md#versions-beta) names move to their releases when they graduate, which align reports.
- The app moves to cf when SvelteKit's adapter writes cf's Build Output, and wrangler leaves the reference with it.
- The app moves to TypeScript 7 when svelte-check's peer range takes it.
- A size budget for packages a browser loads, measured as markz's `pnpm size` does: bundled, minified and gzipped. It waits for a second package that needs one, since a Node tool like craftz pays for its install, not its bundle. Speed stays each package's own, since what it times differs.

## Open questions

- **Where axes meet badly.** A package in a private repository can't publish with provenance, and only `new` says so. A private repository's rulesets need a paid GitHub plan, which this account has. Each could be a warning, once a repository is in that position and warnings exist. A private npm package would add a value to the publish axis, and none is needed yet.

- **Browser code Vite doesn't build.** prose's and pagez's page scripts and styles are copied as they're written, so [`toolchain-browsers`](rules.md#toolchain-browsers) doesn't reach them, and nothing stops them using a feature past a floor. A Baseline lint that reads the same list would, once oxlint has one. Until then, check a new feature's support by hand.

  prose's `built` plugin runs oxfmt, which only formats. Lowering syntax is in reach: `vite-plus` exports `transformWithOxc` for JS, and Lightning CSS's `transform({ targets })` does CSS, as a devDependency. But at today's floors there's little to lower, and Oxc's lowering can add `require` of its runtime helpers, which a page script can't load. An API past a floor, like `::highlight()`, can't be lowered at all, so the lint is the part that matters.

- **Keeping the docs fresh.** The docs are checked for their files, not their sections, and that stays. What goes stale is what they say, like `development.md` describing a setting the rules have moved past, and a check can't tell. One cheap signal is when each doc last changed beside when the code did, so a doc untouched through many changes stands out, without failing anything. That's a note, so it can come in any release after 0.4.0, since a new note breaks nothing.
