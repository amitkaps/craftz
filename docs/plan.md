# Plan

What's built, and what comes next, in order. [The design](design.md) is the whole of what craftz becomes.

## Where it is

### Started

craftz began as a new repository, not a rename, so the repositories kept working while it proves itself. It was started already following [the rules](rules.md), with its GitHub settings written. The rules are frozen where they were kept before, and every new rule is made here.

### The rules, drift and `craftz rules`

The rules, the survey and the settings checks are in [src/](../src/), and the files they compare with are in [reference/](../reference/README.md). [The rules](rules.md) are craftz's own doc, published in its nav and in the package. `craftz rules [id]` prints them from the installed version, and every finding from `pnpm drift` names its rule as `see: craftz rules <id>`. drift's findings matched the ones from before the move, on every repository and on a clone made to drift.

## Next, in order

Each step works in one repository before the next starts.

1. **One rule, one check, one fix.** Bring `align`, `new` and `release` here, calling the same rules as drift. Then the `craftz` command runs `check` and `fix` in a repository.
2. **`fix` and `settings`.** Make them predictable, as [the design](design.md#settings-never-secrets) says, with a check that only reads and a report of what changed.
3. **`craftz()`.** Keep it thin, with the test that it never overrides the repository.
4. **The release cycle.** A hard gate before any real repository moves. From a clean checkout, release craftz's first version. Then `craftz new` makes a test repository, which passes its full `verify` and deploys through `craftz deploy`.
5. **The repositories.** Move one real repository, then the rest, with `craftz align`. The files every repository shares word for word, like the `AGENTS.md` sections and the workflows, change here, and their "Standard" section becomes "Rules", pointing at `craftz rules`.
6. **The old repository retires.** The one that kept the rules before craftz is archived with its history, and its site redirects to craftz's, since every `AGENTS.md` links to it until step 5 has moved them.

If craftz doesn't work out, this repository is deleted, and the repositories carry on as they are.

## Later

- The beta packages that [`versions-beta`](rules.md#versions-beta) names move to their releases when they graduate, which the sweeps report.
- The app moves to cf when SvelteKit's adapter writes cf's Build Output, and wrangler leaves the catalog with it.
- The app moves to TypeScript 7 when svelte-check's peer range takes it.

## Open questions

- **How Markdown wraps.** Formatting runs at oxfmt's default `proseWrap: "preserve"`, so each writer's line breaks stay as they are. Most repositories put a paragraph on one line, markz hand-wraps at about 100 characters, and nothing flags the mix. The decision is `"never"`, so each paragraph is one line that the editor soft-wraps. Nobody hand-wraps, and a changed paragraph shows in a diff as one line with its changed words highlighted. `"always"` is ruled out, since one added word reflows the rest of the paragraph.

  The blocker was markz's element lines. To plain Markdown, a `{@section}` line with text beneath it is part of the paragraph, so `"never"` joined it in and markz rendered it as text. Blank lines around it keep it apart. markz 0.5.0 warns about a line without them, `prose check` fails on that warning in every `verify`, and every repository has fixed its lines.

  What's left, in order:

  1. **Here:** set `fmt: { proseWrap: "never" }` in the reference. Rewrite [the formatting rule](rules.md#toolchain-vite), which says oxfmt's defaults with an empty `fmt: {}`, and add a lesson.
  2. **markz:** ignore `test/documents/` in `fmt`, so the reformat leaves its fixtures alone.
  3. **`align`:** each repository gets one reformat pull request. `proseWrap` reaches YAML too, so check each repository's YAML in its pull request.

  The cost is a one-time reformat, mainly in markz, and a review comment on a doc that covers a whole paragraph. `@prose` comments stay hand-wrapped at 100, since no oxfmt setting wraps comment text.

- **Browser code Vite doesn't build.** prose's and pagez's page scripts and styles are copied as they're written, so [`toolchain-browsers`](rules.md#toolchain-browsers) doesn't reach them, and nothing stops them using a feature past a floor. A Baseline lint that reads the same list would, once oxlint has one. Until then, check a new feature's support by hand.

  prose's `built` plugin runs oxfmt, which only formats. Lowering syntax is in reach: `vite-plus` exports `transformWithOxc` for JS, and Lightning CSS's `transform({ targets })` does CSS, as a devDependency. But at today's floors there's little to lower, and Oxc's lowering can add `require` of its runtime helpers, which a page script can't load. An API past a floor, like `::highlight()`, can't be lowered at all, so the lint is the part that matters.

- **Keeping the docs fresh.** The docs are checked for their files, not their sections, and that stays. What goes stale is what they say, like `development.md` describing a setting the rules have moved past, and a check can't tell. One cheap signal: the dashboard could show when each doc last changed beside when the code did, so a doc untouched through many changes stands out, without failing anything.
