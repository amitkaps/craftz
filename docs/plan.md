# Plan

craftz 0.6.0 is on npm, and its docs are live at [craftz.amitkaps.com](https://craftz.amitkaps.com). What each release changed is in its [notes on GitHub](https://github.com/amitkaps/craftz/releases). This plan says what's next, in order, and what works now. [The design](design.md) is the whole of what craftz becomes. Each repository moves to a release in its own pull request, which its own plan tracks.

## Next, in order

- [x] **craftz no longer installs cf.** cf brought workerd and miniflare, 343 MB of a 502 MB install, to read one version number. The Workers' date comes from npm into [src/workerd.json](../src/workerd.json), and cf's commands run a cf on the PATH at the reference's version, or pnpm's fetch of it.
- [x] **`craftz deps`.** It says what a repository's install holds, by direct dependency, and what older installs left on disk.
- [x] **`craftz help` reads usage.** Each command is stated once in [usage](usage.md), with an id, and a test holds cli.ts's commands to them.
- [x] **markz reads the commands.** `commands`, `help` and `helpOn` move from craftz into `@amitkaps/markz/rules`, beside `readRules`, so every tool's help is read the same way. markz states its own commands in its usage with ids, and a test holds its CLI to them.
- [ ] **prose and pagez state their commands.** Each states its commands in its usage with ids, prints `help` with markz's reader, and tests its CLI against the ids.
- [x] **`pr` adds to an open pull request by its title.** From `main`, `pnpm pr "v0.9.0"` started a branch beside markz's release instead of adding to it. A title that's open now takes the change, from any branch.
- [x] **craftz reads its commands with markz.** craftz moves its help to markz's `readCommands` and `printHelp`, and the reference's `AGENTS.md` says `pnpm <tool> help <command>` says what one does. No rule checks a tool's commands, since prose's anchors and each tool's own test already hold them.
- [x] **Release 0.7.0.** It carries `craftz deps`, `craftz help`, `pr` by title and the install without cf. Then `pnpm align` moves every repository.

## Where it is

- **Each repository checks itself.** Its CI runs `craftz check` against the craftz it installs, so nothing checks it from outside. What needs a login stays on the laptop: `craftz settings --check`, `craftz status`, and `pnpm align --local` for every repository at once.
- **Exact versions.** Every shared tool and craftz are pinned exactly, in one list, the reference's `package.json`, so a repository runs what it names. cf is a beta, which no repository installs. craftz reads the compatibility date from the workerd it depends on, and runs it for the Worker's settings. Node's floor is 26.12.1.
- **`craftz upgrade`.** One command moves a repository to the latest craftz and runs that version's fix, and align runs its steps in a clone of each repository.
- **The rules, checked and fixed.** [The rules](rules.md) are worded once, and their checks and fixes are in [src/](../src/), against the files in [reference/](../reference/README.md). `craftz rules`, `check` and `fix` run them from the installed version, and a second `fix` changes nothing. The rules are read with markz's reader, which craftz bundles, and each finding prints in markz's line, as prose's do. Every `verify` runs `pnpm craftz check`, so each pull request is checked against the craftz it installs. craftz checks itself from source, since the version it installs can't hold the rules it's changing. Its tests install the package `pnpm pack` writes, as a repository would, so a file the package leaves out fails a test here. Each rule is yes or no. A repository holds a rule a tool blocks in its own `package.json`, which `check` prints as a warning, and `check` notes a newer craftz and a graduated beta.
- **GitHub's settings.** `craftz settings` writes only what has drifted and reads it back, with `--check` to only read. A package's ruleset requires `label` next to `ci`.
- **One toolchain.** `craftz()` sets every repository's `fmt` and `lint`, and a package's publint, Oxc's types and platform, Node unless it says `craftz({ browser: true })`. It fails a config that sets one differently. `site()` sets a Worker's date and addresses, and a repository's `tsconfig.json` extends the one craftz ships. A static site names its own folder in `cloudflare.config.ts`, and nothing guesses one. `craftz deploy` uploads it, or runs wrangler for an app.
- **Files craftz owns.** CI, pnpm's settings, the editor's and a package's release files are checked word for word against [reference/](../reference/README.md) and written whole, so what a repository adds goes in `verify`. An app adds Svelte's editor settings.
- **Pull requests.** `pnpm pr` and `pnpm gone` run craftz's commands, in place of the scripts every repository copied. `pr` starts where the title says, and stops when the branch has nothing new for `main`. It returns once it's pushed, and a new title waits for the branch's open pull request to merge first. `--wait` merges once the checks pass, updating a branch that fell behind, and says how long CI and the merge took. A package's label is checked by `label.yml`, so a pull request runs `verify` once. `gone` removes a merged branch's worktree, finds a merged branch GitHub kept or never had, and `pr` runs it first.
- **What's installed.** `craftz deps` weighs a repository's install, by direct dependency.
- **The commands, stated once.** Each command opens its section of [usage](usage.md) with an id, and `craftz help` prints from there. A test fails if cli.ts runs a command usage doesn't state, or the other way, and the README links each one.
- **What's live.** `craftz status` reads CI on `main`, the open pull requests, npm's version against `package.json` on `main`, the latest release, and a site's build, addresses and audience, on cf or wrangler. `--timing` says what the last pull requests took, and why slow ones were slow.
- **Releases.** The release workflow stages a version on npm and tags it once approved, and each release's notes say what to change when a repository moves. `pnpm bump` moves the reference's versions before a release. After it, `pnpm align` runs `craftz upgrade` in a clone of each repository, so a change reaches the others only once it's released. `craftz new` starts a repository that passes the rules, from any folder with `pnpm dlx`. `craftz release` opens a package's release from its own folder. align and bump are this repository's own scripts, for whoever keeps the repositories, and the package doesn't ship them.
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
