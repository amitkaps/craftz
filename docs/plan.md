# Plan

craftz 0.1.2 is on npm, and its docs are live at [craftz.amitkaps.com](https://craftz.amitkaps.com). What each release changed is in its [notes on GitHub](https://github.com/amitkaps/craftz/releases). This plan says what's next, in order, and what works now. [The design](design.md) is the whole of what craftz becomes.

## Next, in order

Each step works in one repository before the next starts.

1. **0.1.2 everywhere.** Each repository bumps craftz, runs `craftz fix`, and rewrites its plan in the same shape, in one pull request.

   - [x] base, markz and sitez.
   - [ ] prose, pagez and craftz-test. prose's "Current plan" rule changes to the same shape first, in prose.

2. **0.1.3.** Moving to 0.1.2 turned up these. Each is ticked when its pull request merges, and 0.1.3 goes out once every one is.

   - [x] **`pnpm pr` starts where the title says.** On a branch other than `main`, it pushed into that branch, whatever its pull request. A change went into an open pull request under that one's title, and a branch whose pull request had merged opened a new one carrying the merged commits again. The branch's pull request decides now: the same title adds to it, a merged one starts a new branch from `origin/main`, and anything else stops. Until 0.1.3 is out, switch to `main` before each new change.
   - [ ] **`.wrangler` has a fix.** `cloudflare-prose-site` asks for it in `.gitignore`, but no fix writes it, so markz and sitez added it by hand. Until then, add it by hand.
   - [ ] **The old name's other links.** `docs-old-name` finds `ship.amitkaps.com`, but not a link to the old repository on GitHub, and it reads only the files the survey reads. sitez's `docs/sitez.md` linked the old standard on GitHub, and nothing found it. Until then, search each repository by hand as it moves.

3. **The private site moves on Pagez.** It builds its site with Sitez and its stories with Pagez, in a second Vite build to its own folder. cf uploads one Vite build's output, so the stories would need glue to get there. Once Pagez builds several folders in one build, the site becomes one Pagez build and moves to craftz and `cloudflare.config.ts` together, with no wrangler. Until then, it stays on the old standard, and its work so far is kept on a branch.
4. **The old repository retires.** The one that kept the rules before craftz is archived with its history, and its site redirects to craftz's, since every `AGENTS.md` links to it until step 3 has moved them all.

If craftz doesn't work out, this repository is deleted, and the repositories carry on as they are.

## Where it is

- **The rules, checked and fixed.** [The rules](rules.md) are worded once, and their checks and fixes are in [src/](../src/), against the files in [reference/](../reference/README.md). `craftz rules`, `check` and `fix` run them from the installed version, and a second `fix` changes nothing.
- **GitHub's settings.** `craftz settings` writes only what has drifted and reads it back, with `--check` to only read.
- **One toolchain.** `craftz()` sets every repository's `fmt` and `lint`, and fails a config that sets either differently. A site's own `publicDir` stays its own, and `craftz deploy` runs cf or wrangler by the config file it finds.
- **Pull requests.** `pnpm pr` and `pnpm gone` run craftz's commands, in place of the scripts every repository copied. `gone` removes a merged branch's worktree, and a label's CI run no longer cancels the push's.
- **What's live.** `craftz status` reads CI on `main`, the open pull requests, npm's version and the latest release, and a site's build and addresses.
- **Releases.** The release workflow stages a version on npm and tags it once approved, from 0.1.1 on, and 0.1.2's notes say what to change when a repository moves. align, new and release run the same rules, and `new` starts a repository that passes them, as craftz-test did.
- **The repositories.** base, markz and sitez are on craftz 0.1.2, and prose, pagez, craftz-test and a private repository on 0.1.1. `docs-old-name` points their links to the old standard at craftz's rules. The public ones carry the topic `craftz`, which is how align and drift find them. One private site waits on Pagez, as Next says.

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
