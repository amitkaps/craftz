# Plan

craftz 0.1.2 is on npm, and its docs are live at [craftz.amitkaps.com](https://craftz.amitkaps.com). What each release changed is in its [notes on GitHub](https://github.com/amitkaps/craftz/releases). This plan says what's next, in order, and what works now. [The design](design.md) is the whole of what craftz becomes.

## Next, in order

Each step works in one repository before the next starts.

1. **0.1.2 everywhere.** Each repository bumps craftz, runs `craftz fix`, and rewrites its plan in the same shape, in one pull request.

   - [x] base, markz and sitez.
   - [x] prose, pagez and craftz-test. prose's "Current plan" rule changed to the same shape first, in prose.
   - [x] the private repositories.

2. **0.1.3.** Moving to 0.1.2 turned up these. Each is ticked when its pull request merges, and 0.1.3 goes out once every one is.

   - [x] **`pnpm pr` starts where the title says.** On a branch other than `main`, it pushed into that branch, whatever its pull request. A change went into an open pull request under that one's title, and a branch whose pull request had merged opened a new one carrying the merged commits again. The branch's pull request decides now: the same title adds to it, a merged one starts a new branch from `origin/main`, and anything else stops. Until 0.1.3 is out, switch to `main` before each new change.
   - [ ] **`.wrangler` has a fix.** `cloudflare-prose-site` asks for it in `.gitignore`, but no fix writes it, so markz and sitez added it by hand. Until then, add it by hand.
   - [ ] **The old name's other links.** `docs-old-name` finds `ship.amitkaps.com`, but not a link to the old repository on GitHub, and it reads only the files the survey reads. sitez's `docs/sitez.md` linked the old standard on GitHub, and nothing found it. Its fix also writes fewer files than its check reads, so the old name in `pnpm-workspace.yaml` or `cloudflare.config.ts` is reported and left. A tool's docs said only "ship", which no check can tell from the word. Until then, search each repository by hand as it moves.
   - [ ] **A static site is one folder, however it's built.** A static site's `build` writes one folder, by Vite, prose, or several builds in turn, and the deploy uploads that folder. The aim is `cloudflare.config.ts` for every site, but cf can't deploy a folder on its own yet: as of 1.0.0-beta.19, its config's `assets` names no folder, and `cf deploy --prebuilt` reads only what the Cloudflare plugin writes. So, in order:
     - Try plain `cf deploy`, which hands a build with no Vite plugin to wrangler. If it uploads the folder, a static site needs no plugin.
     - If not, the folder is the plugin's `publicDir`, as `.prose` is now. `craftz()` reads its name rather than guess `.prose`, which gave a site built outside Vite the wrong folder and failed its build.
     - A site neither can deploy stays on `wrangler.toml`, as `cloudflare-wrangler` allows. The rules say which sites that is and why, and `cloudflare-config` doesn't report it as drift. Today only a hold stops that, and a hold names its repository, which a private one can't have.

     Until then, a site with no `index.html` at its root names its `publicDir`, and one built outside Vite stays on `wrangler.toml`.

   - [ ] **`craftz status` reads a build on wrangler.** It reads a site's builds through cf, so on a site with `wrangler.toml` it says cf isn't installed, and a failed deploy goes unseen. Until then, read it with `wrangler deployments list`.
   - [ ] **`pnpm pr` stops when nothing's new.** A second run on a branch whose pull request had just merged pushed it again, and opened a pull request with nothing to merge, which GitHub won't auto-merge. It counts commits ahead of `main`, and a squash merge leaves them looking unmerged. It should compare the branch merged onto `main` with `main`. And `--wait` fails in a worktree, at `git switch main`, since `main` is checked out in another.

3. **The private site moves on Pagez.** It's on craftz 0.1.2, but deploys with `wrangler.toml`. It builds its site with Sitez and its stories with Pagez, in a second Vite build, each into `dist/`. cf deploys only what the Cloudflare plugin writes, so a deploy on cf failed and it went back to wrangler. Once Pagez builds several folders in one build, the site becomes one Pagez build and moves to `cloudflare.config.ts`. Until then, `craftz check` reports `cloudflare-config` there, since a hold would name it.
4. **The old repository retires.** The one that kept the rules before craftz is archived with its history, and its site redirects to craftz's, for the links outside these repositories. Every `AGENTS.md` links to craftz now.

If craftz doesn't work out, this repository is deleted, and the repositories carry on as they are.

## Where it is

- **The rules, checked and fixed.** [The rules](rules.md) are worded once, and their checks and fixes are in [src/](../src/), against the files in [reference/](../reference/README.md). `craftz rules`, `check` and `fix` run them from the installed version, and a second `fix` changes nothing.
- **GitHub's settings.** `craftz settings` writes only what has drifted and reads it back, with `--check` to only read.
- **One toolchain.** `craftz()` sets every repository's `fmt` and `lint`, and fails a config that sets either differently. A site's own `publicDir` stays its own, and `craftz deploy` runs cf or wrangler by the config file it finds.
- **Pull requests.** `pnpm pr` and `pnpm gone` run craftz's commands, in place of the scripts every repository copied. `gone` removes a merged branch's worktree, and a label's CI run no longer cancels the push's.
- **What's live.** `craftz status` reads CI on `main`, the open pull requests, npm's version and the latest release, and a site's build and addresses.
- **Releases.** The release workflow stages a version on npm and tags it once approved, from 0.1.1 on, and 0.1.2's notes say what to change when a repository moves. align, new and release run the same rules, and `new` starts a repository that passes them, as craftz-test did.
- **The repositories.** Every one is on craftz 0.1.2. `docs-old-name` points their links to the old standard at craftz's rules. The public ones carry the topic `craftz`, which is how align and drift find them. One private site waits on Pagez, as Next says.

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
