# Plan

craftz 0.1.1 is on npm, and its docs are live at [craftz.amitkaps.com](https://craftz.amitkaps.com). What each release changed is in its [notes on GitHub](https://github.com/amitkaps/craftz/releases). This plan says what's next, in order, and what works now. [The design](design.md) is the whole of what craftz becomes.

## Next, in order

Each step works in one repository before the next starts.

1. **0.1.2.** Moving the repositories turned up these small issues. Each is ticked when its pull request merges, and 0.1.2 goes out once every one is. Then every repository moves once more. Each says what to do until then.

   - [ ] **A site's `publicDir` is the repository's.** With `cloudflare.config.ts`, cf uploads Vite's output, and `publicDir` is how a repository puts finished files into it, since the config has no `assets.directory`. `craftz()` sets `.prose` for a static site without an `index.html`, and fails a config that sets anything else. A site Vite builds itself, with its files in `public/`, can't build. `.prose` stays the default, and a repository's own `publicDir` wins. The `fmt` and `lint` rules keep failing on a conflict. Until then, only the waiting private site needs it.
   - [x] **`.wrangler/` is ignored.** A site's build leaves `.wrangler/tmp` behind, and only the app's `.gitignore` named it. craftz's `.gitignore`, which `new` copies, adds it, and `cloudflare-prose-site` asks for it. Until 0.1.2 is out, leave the folder out of a commit.
   - [x] **The plugins fix formats what it writes.** When a config's `plugins` list spanned lines, the `toolchain-craftz` fix left `plugins: [craftz(), ` on a line of its own, which `vp check` fails. It puts `craftz()` on its own line now. Until 0.1.2 is out, run `vp fmt` after the fix.
   - [x] **The plugins fix trims what `craftz()` sets.** A config's own `fmt` and `lint` kept the rules `craftz()` sets, like `proseWrap` and the lint plugins, so each was trimmed by hand to the repository's own keys, like its `ignorePatterns`. The fix takes out each key `craftz()` sets to the same value now. Until 0.1.2 is out, trim by hand.
   - [ ] **`craftz deploy` reads the config file.** It runs cf for a static site and wrangler for an app, chosen by the deploy axis. The file decides which tool can read it, `cloudflare.config.ts` for cf and `wrangler.toml` for wrangler. Every static site is on cf now, so nothing goes wrong yet.
   - [ ] **`craftz status` says when cf isn't there.** The app has wrangler and no cf, so its status reads "cf isn't logged in" and marks the build `✗`. It should say cf isn't installed. Until then, read the app's build in Cloudflare's dashboard.
   - [ ] **The old name goes.** Docs and comments in the moved repositories still say they follow the old repository's standard, and no rule finds it. A rule that does, with its fix, belongs before the old repository retires. Until then, the old site still answers, so the links work.
   - [x] **`gone` removes a merged branch's worktree.** Git won't delete a branch another worktree has checked out, so `gone` failed at it and deleted nothing after. It removes the worktree first now, keeps one with changes, and goes on. Until 0.1.2 is out, run `git worktree remove` before `pnpm gone`.
   - [ ] **`craftz status` shows the latest release.** It prints the tag and the notes' summary paragraph, and `--notes` prints them in full, so an agent finds what each release did where it already looks. Until then, run `gh release view`.
   - [ ] **align's list.** align's repositories still include the old one, which retires, and leave out craftz-test. Until then, name the repositories on the command line.

2. **The private site moves on Pagez.** It builds its site with Sitez and its stories with Pagez, in a second Vite build to its own folder. cf uploads one Vite build's output, so the stories would need glue to get there. Once Pagez builds several folders in one build, the site becomes one Pagez build and moves to craftz and `cloudflare.config.ts` together, with no wrangler. Until then, it stays on the old standard, and its work so far is kept on a branch.
3. **The old repository retires.** The one that kept the rules before craftz is archived with its history, and its site redirects to craftz's, since every `AGENTS.md` links to it until step 2 has moved them all.

If craftz doesn't work out, this repository is deleted, and the repositories carry on as they are.

## Where it is

- **The rules, checked and fixed.** [The rules](rules.md) are worded once, and their checks and fixes are in [src/](../src/), against the files in [reference/](../reference/README.md). `craftz rules`, `check` and `fix` run them from the installed version, and a second `fix` changes nothing.
- **GitHub's settings.** `craftz settings` writes only what has drifted and reads it back, with `--check` to only read.
- **One toolchain.** `craftz()` sets every repository's `fmt` and `lint`, and fails a config that sets either differently. A site's config and `craftz deploy` read the deploy axis, and run cf or wrangler.
- **Pull requests.** `pnpm pr` and `pnpm gone` run craftz's commands, in place of the scripts every repository copied.
- **What's live.** `craftz status` reads CI on `main`, the open pull requests, npm's version, and a site's build and addresses.
- **Releases.** The release workflow stages a version on npm and tags it once approved, from 0.1.1 on. align, new and release run the same rules, and `new` starts a repository that passes them, as craftz-test did.
- **The repositories.** markz, prose, sitez, pagez, the app, craftz-test and a private repository depend on craftz 0.1.1. One private site waits on Pagez, as Next says.

## Later

- The beta packages that [`versions-beta`](rules.md#versions-beta) names move to their releases when they graduate, which the sweeps report.
- The app moves to cf when SvelteKit's adapter writes cf's Build Output, and wrangler leaves the catalog with it.
- The app moves to TypeScript 7 when svelte-check's peer range takes it.

## Open questions

- **Where axes meet badly.** A package in a private repository can't publish with provenance, and only `new` says so. A private repository's rulesets need a paid GitHub plan, which this account has. Each could be a check that shows a hold, once a repository is in that position. A private npm package would add a value to the publish axis, and none is needed yet.

- **Browser code Vite doesn't build.** prose's and pagez's page scripts and styles are copied as they're written, so [`toolchain-browsers`](rules.md#toolchain-browsers) doesn't reach them, and nothing stops them using a feature past a floor. A Baseline lint that reads the same list would, once oxlint has one. Until then, check a new feature's support by hand.

  prose's `built` plugin runs oxfmt, which only formats. Lowering syntax is in reach: `vite-plus` exports `transformWithOxc` for JS, and Lightning CSS's `transform({ targets })` does CSS, as a devDependency. But at today's floors there's little to lower, and Oxc's lowering can add `require` of its runtime helpers, which a page script can't load. An API past a floor, like `::highlight()`, can't be lowered at all, so the lint is the part that matters.

- **Keeping the docs fresh.** The docs are checked for their files, not their sections, and that stays. What goes stale is what they say, like `development.md` describing a setting the rules have moved past, and a check can't tell. One cheap signal: the dashboard could show when each doc last changed beside when the code did, so a doc untouched through many changes stands out, without failing anything.
