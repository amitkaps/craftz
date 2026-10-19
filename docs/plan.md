# Plan

What's built, and what comes next, in order. [The design](design.md) is the whole of what craftz becomes.

## Where it is

### Started

craftz began as a new repository, not a rename, so the repositories kept working while it proves itself. It was started already following [the rules](rules.md), with its GitHub settings written. The rules are frozen where they were kept before, and every new rule is made here.

### The rules, drift and `craftz rules`

The rules, the survey and the settings checks are in [src/](../src/), and the files they compare with are in [reference/](../reference/README.md). [The rules](rules.md) are craftz's own doc, published in its nav and in the package. `craftz rules [id]` prints them from the installed version, and every finding from `pnpm drift` names its rule as `see: craftz rules <id>`. drift's findings matched the ones from before the move, on every repository and on a clone made to drift.

### align, new and release

`pnpm align`, `pnpm new` and `pnpm release` moved here, calling the same rules as drift. align moves the reference first, then craftz and the others with it, and `--local` keeps a run on the laptop. new builds from the reference, and its test checks four new repositories against the survey.

### `craftz check` and `craftz fix`

The command runs every rule on a folder and writes every fix, from the installed version. The package carries the reference, and the browsers and the Workers' date are written in when it's packed, so it has no dependencies.

### `fix` and `settings`

`craftz fix` lists the files it changed, and a second run changes nothing, on every repository. `craftz settings` writes only what has drifted and reads it back, with `--check` to only read. It asks before removing classic branch protection. align and `new --push` write the settings through the same code.

### `craftz()`

The plugin sets `fmt` and `lint`, and fails a config that sets either differently, with a test that it never overrides one. craftz's own config uses it, and the checks accept it.

### A site's config and `craftz deploy`

Both read the deploy axis from the Worker config. `craftz()` sets a static site's `publicDir` or `build.target`, and `craftz deploy` runs cf or wrangler. craftz's own docs are its site, built by `verify` and deployed by `craftz deploy` from source, and it's live at craftz.amitkaps.com.

### `craftz pr` and `craftz gone`

The scripts every repository copied are craftz's commands now, and `pnpm pr` and `pnpm gone` run them. Their fix deletes the copies, and the `scripts/` folders here and in the reference went. They're in before the first release, so 0.1.0 is the end state, and no repository moves twice.

### 0.1.0, and repositories that depend on craftz

craftz 0.1.0 is on npm. [`toolchain-craftz`](rules.md#toolchain-craftz) asks every other repository to depend on it and use `craftz()`, and its fix writes both. [`versions-craftz`](rules.md#versions-craftz) asks for craftz's own version, so a release moves every repository. `new` writes both too, and its test installs craftz from npm.

### craftz-test

`craftz new` started craftz-test, a package with a static site, with `--push`. It installs craftz from npm, uses `craftz()`, passes its full `verify`, opened its first pull request with `pnpm pr`, and deploys through `craftz deploy` from its Worker's build, to craftz-test.amitkaps.com. It turned up two things, now fixed. A site's `ship` wasn't checked, and the settings `new` wrote read back as still off.

### `craftz status`

What's live, read in one command: CI on `main`, the open pull requests, npm's version, and a site's latest build and addresses, with `--log` for the build's log. `AGENTS.md` points agents at it, so a look at a deploy or a release isn't a script written again.

## Next, in order

Each step works in one repository before the next starts.

1. **The release cycle.** A hard gate before any real repository moves. 0.1.1 goes out through the release workflow, staged and approved, the first release that isn't published by hand.
2. **The repositories.** Move one real repository, then the rest, with `craftz align`. Each one's shared files, like the `AGENTS.md` sections and the workflows, come from craftz's reference and point at craftz, and `craftz fix` writes "craftz" over the old "Standard" section. `craftz fix` points `pr` and `gone` at `craftz pr` and `craftz gone`, and deletes the copied `scripts/pr.ts` and `scripts/gone.ts`.
3. **The old repository retires.** The one that kept the rules before craftz is archived with its history, and its site redirects to craftz's, since every `AGENTS.md` links to it until step 2 has moved them.

If craftz doesn't work out, this repository is deleted, and the repositories carry on as they are.

## Later

- The beta packages that [`versions-beta`](rules.md#versions-beta) names move to their releases when they graduate, which the sweeps report.
- The app moves to cf when SvelteKit's adapter writes cf's Build Output, and wrangler leaves the catalog with it.
- The app moves to TypeScript 7 when svelte-check's peer range takes it.

## Open questions

- **Where axes meet badly.** A package in a private repository can't publish with provenance, and only `new` says so. A private repository's rulesets need a paid GitHub plan, which this account has. Each could be a check that shows a hold, once a repository is in that position. A private npm package would add a value to the publish axis, and none is needed yet.

- **Browser code Vite doesn't build.** prose's and pagez's page scripts and styles are copied as they're written, so [`toolchain-browsers`](rules.md#toolchain-browsers) doesn't reach them, and nothing stops them using a feature past a floor. A Baseline lint that reads the same list would, once oxlint has one. Until then, check a new feature's support by hand.

  prose's `built` plugin runs oxfmt, which only formats. Lowering syntax is in reach: `vite-plus` exports `transformWithOxc` for JS, and Lightning CSS's `transform({ targets })` does CSS, as a devDependency. But at today's floors there's little to lower, and Oxc's lowering can add `require` of its runtime helpers, which a page script can't load. An API past a floor, like `::highlight()`, can't be lowered at all, so the lint is the part that matters.

- **Keeping the docs fresh.** The docs are checked for their files, not their sections, and that stays. What goes stale is what they say, like `development.md` describing a setting the rules have moved past, and a check can't tell. One cheap signal: the dashboard could show when each doc last changed beside when the code did, so a doc untouched through many changes stands out, without failing anything.
