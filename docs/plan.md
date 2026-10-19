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

Both read the deploy axis from the Worker config. `craftz()` sets a static site's `publicDir` or `build.target`, and `craftz deploy` runs cf or wrangler. craftz's own docs are its site, built by `verify` and deployed by `craftz deploy` from source. A dry run reads every file, and the Worker for craftz.amitkaps.com is still to be created and connected by hand.

## Next, in order

Each step works in one repository before the next starts.

1. **The release cycle.** A hard gate before any real repository moves. First, craftz's site goes live at craftz.amitkaps.com through `craftz deploy`. From a clean checkout, release craftz's first version. Then `craftz new`, writing `craftz()` in place of the `fmt` and `lint` blocks, makes a test repository, which passes its full `verify` and deploys through `craftz deploy`.
2. **The repositories.** Move one real repository, then the rest, with `craftz align`. The files every repository shares word for word, like the `AGENTS.md` sections and the workflows, change here, and their "Standard" section becomes "Rules", pointing at `craftz rules`. `pr` and `gone` become `craftz pr` and `craftz gone`, so no repository copies `scripts/pr.ts` or `scripts/gone.ts`, and both `scripts/` folders here go.
3. **The old repository retires.** The one that kept the rules before craftz is archived with its history, and its site redirects to craftz's, since every `AGENTS.md` links to it until step 2 has moved them.

If craftz doesn't work out, this repository is deleted, and the repositories carry on as they are.

## Later

- The beta packages that [`versions-beta`](rules.md#versions-beta) names move to their releases when they graduate, which the sweeps report.
- The app moves to cf when SvelteKit's adapter writes cf's Build Output, and wrangler leaves the catalog with it.
- The app moves to TypeScript 7 when svelte-check's peer range takes it.

## Open questions

- **Where axes meet badly.** A package in a private repository can't publish with provenance, and only `new` says so. A private repository's rulesets may need a paid GitHub plan. Each could be a check that shows a hold, once a repository is in that position. A private npm package would add a value to the publish axis, and none is needed yet.

- **Browser code Vite doesn't build.** prose's and pagez's page scripts and styles are copied as they're written, so [`toolchain-browsers`](rules.md#toolchain-browsers) doesn't reach them, and nothing stops them using a feature past a floor. A Baseline lint that reads the same list would, once oxlint has one. Until then, check a new feature's support by hand.

  prose's `built` plugin runs oxfmt, which only formats. Lowering syntax is in reach: `vite-plus` exports `transformWithOxc` for JS, and Lightning CSS's `transform({ targets })` does CSS, as a devDependency. But at today's floors there's little to lower, and Oxc's lowering can add `require` of its runtime helpers, which a page script can't load. An API past a floor, like `::highlight()`, can't be lowered at all, so the lint is the part that matters.

- **Keeping the docs fresh.** The docs are checked for their files, not their sections, and that stays. What goes stale is what they say, like `development.md` describing a setting the rules have moved past, and a check can't tell. One cheap signal: the dashboard could show when each doc last changed beside when the code did, so a doc untouched through many changes stands out, without failing anything.
