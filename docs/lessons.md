# Lessons

What building craftz and the repositories' builds, checks and deploys taught, for whoever changes them next. Each lesson says what went wrong and what to do about it. What the code does now is in its `@prose`, and the story is in the pull request. Lessons that belong to one repository stay there.

The first groups follow the principles in [the rules' Practice](rules.md#practice), and each says what holds its principle. craftz's own principles come next, then [Tools](#tools), for what a tool does that its docs don't say. A lesson that repeats one in its group means the principle needs a check, a command or a line in `AGENTS.md`.

## State it once

The rule is [State it once](rules.md#state-it-once). A test holds `src/rules.ts` to the rules' ids, and another holds the CLI to usage's. A shared file is written whole from `reference/` and checked word for word.

- **A copy of a rule drifts from it.** The `@prose` rules differed across four `AGENTS.md` files, development docs described settings the rules had moved past, and a table of betas fell behind the code. Link the one copy. A doc says what's allowed and why, never the value.
- **A rule said in words and again in a check's label disagreed.** A rule is stated once, as a list item that opens with its id, and the code has only its check and its fix. A test fails if either has an id the other doesn't.
- **A list of commands drifted across four docs.** `deps` reached the help and usage, but not the README or the design, and `cli.ts`'s summary had grown into a manual that five files repeated. Each command is stated once, in usage, with an id, and a test holds `cli.ts` to the ids both ways.
- **A list in the code fell behind the repositories.** align's list kept a repository after it moved and never gained a new one. GitHub's `craftz` topic is the list, so a repository joins through its settings and leaves by being archived. Search takes a few seconds to see a new topic.
- **A generator and the fixes wrote the same files twice.** `new` writes only what's a repository's own, and runs the fixes for the rest. Its tests run `check` and `verify` on what it writes, so it can't drift from the rules.
- **`reference/` is read as a doc too.** It came over with the old repository's links, its own `AGENTS.md` section and a `package.json` whose fields no rule read. Keep each file there true where it stands, holding only what a rule or `new` reads.
- **A pattern a second tool copies belongs in the library.** prose and pagez needed craftz's help printer, so markz has `readCommands` and `printHelp`. Each tool keeps its own test of how its CLI dispatches.
- **A copy of a tool's layout breaks when the tool moves.** The dashboard sized itself with a prose variable that prose renamed. Keep only what's a page's own, and take the rest from prose's tokens.
- **Dependabot moved what moves from here.** It couldn't move the Vite+ override with Vite+, and every npm pull request it opened was closed. Versions move in the reference first, and `github-ci` drifts on a `dependabot.yml`.
- **A lesson that reverses another leaves the first giving the old advice.** One said a value that moves with craftz belongs in `craftz()`, after three more said why the plugin went. A lesson is a doc, so rewrite the one it reverses, in the same change.

## Try it on the real thing

The rule is [Try it on the real thing](rules.md#try-it-on-the-real-thing). The tests run the packed command, and `align --candidate` and `--local` run a change on every repository before it's released.

- **A fix written against the reference missed every real repository.** `toolchain-craftz` took out a block only when it was exactly the plugin's, and every repository had its own `ignorePatterns` in it. Write a fix against a real repository's file, and run align on one before a release.
- **A fix has to change nothing the second time.** The first `fix` on a repository in line rewrote JSON with `JSON.stringify`, which undid the formatter. A file is written only when its value changes. Run `fix` twice on each repository's `main` from `git archive`, since a checkout can be behind.
- **A command failed to start from the package.** `new` read cf, which a package doesn't install, and bundled 9 MB of Vite+, while it ran fine from the checkout. So the tests install the packed tarball, and a command loads only what it runs.
- **A test can't install the version it's releasing.** It installed craftz from npm, which wouldn't have the version until the release merged. A test of what a release writes installs this checkout's pack.
- **A run on craftz itself found what a read couldn't.** align's first `--local` run found a fix that dropped `docs/rules.md` from `files`, which `craftz rules` reads. Run `--local` on craftz after changing align or a fix.
- **A moved check is proven by the same findings.** Repositories in line print the same ticks either way, which shows little. Make a clone drift on purpose and compare what both print.
- **A standard is tried in every repository before it's written.** Each tsconfig looked like it had reasons of its own. Setting one in each and running its check showed only SvelteKit's were real.
- **Replacing a tool drops what it did on failure.** `craftz deploy` sent each bucket of files once, where cf tries again, and one `10013` from Cloudflare failed a deploy. When a command replaces a tool, list what the tool does on failure too.
- **The first align found two bugs no test had.** Trimming git's output took the space that opens its first line, and markz's timing tests failed when five `verify`s ran at once. Trim only the end of git's output, and run `verify` one repository at a time.
- **A file craftz writes whole can't be edited to set up a test.** A test's override in `pnpm-workspace.yaml` failed its own `craftz check`. The test puts the file back after the install, since pnpm reads it only then.
- **A new repository is read before it's pushed.** Run `new` without `--push` first. A package's first push changes `package.json`, so its release workflow stops for a package npm doesn't have yet.
- **A principle is found across repositories, not in one.** craftz's lessons filed parsing under Vite+ and weighing a tool under timing. markz's, prose's and pagez's showed both in all four. Before writing a principle, read the other repositories' lessons for it.

## Measure before changing

The rule is [Measure before changing](rules.md#measure-before-changing). `craftz deps` weighs an install, and `status` notes a `verify` over its budget.

- **A slow test was timed before it was cut.** `verify` took two and a half minutes. Timing each part found MDN's data imported as a module where `require` parses it in a fraction, and five repositories set up one after another. Cutting the test would have hidden both.
- **A test repeated an expensive step for each case.** Five shapes of `new` each ran `verify`, and only two build differently. List what each case runs that the others don't, and run the expensive step only for those.
- **Work at a module's top level runs for every command.** Three constants parsed the rules doc as their modules loaded, so `gone` paid 50 ms for rules it never read. Parse on first use, and profile a command that does nothing.
- **`verify` ran its steps one after another.** `vp run`'s `all` task runs them side by side. A step that writes can't run beside steps that read, and a test that packs couldn't run beside `build`. Read what each step reads and writes on disk before moving it.
- **Splitting a slow test file only helps when a core is idle.** `vp test` already runs a file to a core, so splitting markz's saved 3 of 30 seconds. Time `verify` before and after a split, and keep it only when the time falls.
- **A timing test failed on a slower machine.** markz's passed locally and in CI, then stopped a deploy on Cloudflare's. A private repository's CI gets two cores to a public one's four, too. A test that starts the CLI more than once gets its own timeout.
- **A shorter wait looked like a fix for a blocked release.** The block was the version check, not pnpm's wait. Weigh a setting by what it guards before changing it.
- **Vite's default browsers were three years old.** It's a list frozen at each Vite major. MDN's browser-compat-data was a release ahead of caniuse, so the floors come from it. caniuse counts Android Chrome as one version and leaves out in-app browsers, so read it beside a source that counts them.
- **A tool already had the feature the plan waited for.** Vite+'s `lazyPlugins()` skips plugins while it reads a config for `fmt` or `lint`, which halved a site's check. Read a tool's current docs before waiting on it, or before copying a workaround's reason.

## Silence is the failure

The rule is [Silence is the failure](rules.md#silence-is-the-failure). Each finding names one rule, and a run says what it left by hand. Nothing holds a catch to it yet.

- **One catch hid five drifts behind a wrong reason.** A check said a private repository's settings weren't read, since it "isn't on GitHub". Cloudflare's 404 had been taken for GitHub's, dropping four merge settings with it. Catch only the error you expect, beside the call that throws it.
- **align stopped at the first failure, so a run showed one problem per repository.** A step that fails on what's left by hand leaves it in the list and goes on, so one run says everything.
- **The report listed moves no pull request made.** Five repositories left by hand were listed as moved, and stayed on the old version. A report says what reached a repository.
- **GitHub's rate limit looked like drift.** Logged out, 60 requests an hour turned every rule red. Use `gh`'s login, and say a check the limit stopped wasn't made.
- **A required check that skips or cancels says the wrong thing.** A cancelled label run blocked a merge, and a skipped `ci` would have counted as passing. Read what a check judges when it runs, not from the event that started it, and ask what a required check reports when it could skip.
- **One check for several rules can't say which one drifted.** Packing, types and bundling shared one label. Each is a rule now, so a finding names the one that drifted.
- **A report that adds up can still be wrong.** `craftz deps` read pagez as 7 packages, since pnpm prints a package's dependencies once and marks it `deduped` after. A line saying each dependency is one package was the sign.
- **A run waited an hour on a pull request that couldn't merge.** A conflict never fails a check, so align's wait sat until someone closed it. A conflict ends a wait.
- **A warning everyone learned to skip is noise.** Rolldown printed `UNRESOLVED_IMPORT` for every `node:` import in markz's browser build, though the build was right. Say what the tool should do, here with `pack.deps.neverBundle`, so the warning goes.
- **A run prints what it's for, not what it did in order.** align printed a line per repository per step, and the versions it moved were spread across them. Each step finishes for every repository before the next, and the report groups each version with where it moved.

## Parse, don't match text

The rule is [Parse, don't match text](rules.md#parse-dont-match-text). [config.ts](../src/config.ts) reads configs with oxc's parser, and the rules read docs with markz's.

- **A config read by its lines found keys that weren't there.** A key in a comment counted, any `target: [...]` read as `build.target`, and a fix placed its block by the file's last line. Parse with the `parseSync` Vite+ exports, and read only what's written as a literal. Loading the config as Vite does runs its plugins, and takes up to a second.
- **A fix that edits a file by its lines depends on its layout.** CI's Label step was edited in place, so a workflow laid out otherwise was left to drift. A file every repository has the same is written whole, and a repository's own config is edited through its parse.

## Build only what gets used

The rule is [Build only what gets used](rules.md#build-only-what-gets-used). `craftz deps` says what an install holds, by direct dependency.

- **A static site installed a runtime it never ran.** cf, Cloudflare's plugin and wrangler each bring workerd, 133 MB of a site's 373 MB. Their deploy of a folder is five calls to Cloudflare's API, which `craftz deploy` makes with `fetch`. Weigh a tool by what the repository runs of it.
- **craftz installed cf for one version number.** cf was 343 MB of a 502 MB install, to read workerd's version. npm says which workerd cf depends on, so [src/workerd.json](../src/workerd.json) keeps it, and the install fell to 162 MB.
- **What a command needs is decided when it's packed.** The browsers and the Workers' date change only when `pnpm bump` moves their packages, so `vp pack` writes them in, and the packages stay out.
- **A plugin only the build uses was loaded by every check.** Vite+ loads the whole config for `fmt` and `lint`, so a site's check imported miniflare. Wrap any plugin only a build or a test needs in `lazyPlugins()`.
- **An app that ran only in the browser deployed a Worker.** A private repository started from base for a backend it hadn't built, so every request rendered a page the browser ran anyway. Start a site on the deploy it needs now, and move to an app when there's server code.
- **A tool that does more than the job brings more than it needs.** Void deploys a folder in one command, on 304 packages, a database toolkit and its own state. It was tried at 1.1.11 and left, since Vite and craftz already do the job.
- **What every agent reads is `AGENTS.md`.** prose shipped its rules as an agent skill, which took an approval in each workspace and a fallback for agents without skills. One line in `AGENTS.md` does the same.

## A run removes what it writes

The rule is [A run removes what it writes](rules.md#a-run-removes-what-it-writes). `tests/temp.ts` removes the tests' folders, and align removes the clones it doesn't keep.

- **Temporary folders held tens of gigabytes.** align left every clone, 62 GB after 37 runs, and the tests left 31 GB in a few days. macOS's cleanup never took them. A run removes what it wrote, and prints a folder only when it kept something in it.
- **A lockfile keeps what nothing installs any more.** esbuild stayed in four lockfiles after Vite+ moved to Rolldown, and `pnpm dedupe` kept it. align writes the lockfile afresh on every run. After moving toolchains by hand, remove `node_modules` and `pnpm-lock.yaml` before installing.
- **`node_modules` isn't the install.** pnpm keeps each version in `node_modules/.pnpm` until a fresh install, and the lockfile counts builds for other platforms. So craftz's 952 MB was 502 MB installed. `craftz deps` counts only what the tree reaches on disk.

## Read what's live

The rule is [Read what's live](rules.md#read-whats-live). `check` runs against the craftz a repository installs, `status` reads `main` on GitHub, and `pr` decides by title and by trees.

- **A registry's tag runs behind its releases.** npm's `latest` for pnpm pointed at 12.11.2 while 12.13.0 was out. The survey also called a version drift that pnpm's one-day wait wouldn't install yet. The check compares with the reference, which `pnpm bump` moves with pnpm.
- **A candidate run checked the release, not the candidate.** The fix pinned craftz to its own version, and the next install brought npm's back, so every clone ran the old rules. When findings read like an older craftz, check which one the clone installed.
- **A read straight after a write can be the old answer.** GitHub answered a read-back from before the write, and a pull request read as behind its own merge for a second. A read-back is tried again before it's reported, and a failed update means asking again.
- **A squash merge hides what it took.** The branch's own commits stay ahead of `main`, so counting them pushed an empty pull request. Whether a branch adds anything is a question about trees. Merge it onto `main`, and see if `main` changes.
- **The branch decided where a pull request went, not its title.** One change merged inside another's pull request, another carried merged commits again, and a title run from `main` started a second branch. The title decides, from any branch.
- **A version read from the clone looked released.** `status` showed pagez's npm version as current the day a new one merged, since the clone hadn't pulled. It reads `package.json` on `main` now.
- **A check runs on what will be committed.** align ran `verify` before staging, so git still listed deleted files. prose builds the last commit too, so a doc is missing until it's committed. Commit, or stage, before checking.
- **A repository is checked against the craftz it installs.** Sweeps from craftz's checkout checked rules not yet released, and found drift no repository could fix. Each `verify` runs `craftz check`, align moves each repository to a release and runs that version's fix, and `pnpm bump` moves the reference before it.
- **A finding points at a command, not a page.** An agent fetched a rule's page and got a summary of it. A finding names the rule's id, and `craftz rules <id>` prints it from the version installed.
- **A file an agent reads at the start is written at the end.** `outline.md` was written only on the branch, so the next session started from a map without what merged. `gone` and `pr --wait` write it once they're on `main`.
- **Work done in a clone leaves the checkout behind.** After a run, every checkout beside craftz was on an old `main`. align brings each one to `main` once its merges land, and keeps one with work of its own.

## A step nobody runs becomes a command

The rule is [A step nobody runs becomes a command](rules.md#a-step-nobody-runs-becomes-a-command). `AGENTS.md` names `pr` and `gone`, `pr` runs `gone` and `verify` and stops without a label, and `release` stops on a stale plan.

- **A step after a merge never ran.** `AGENTS.md` said to run `gone` after a merge, and an agent moves on before one. Ten repositories held thirteen merged branches. `pr` runs `gone` first, and `gone` also finds a branch by its last commit.
- **An agent runs a step tied to a moment, not to a session.** A session that auto-compacts never ends, so a step at its end never ran. `AGENTS.md` says to run `gone` before a change, and `gone` pulls `main`.
- **A wait in the session held up the next change.** `pr` stopped on a new title while the last pull request was open, so agents sat through CI. `pr` returns once it's pushed, and a new title waits only for a merge that hasn't happened.
- **Agents ran `verify`, then ran it again.** 78 of 306 `pnpm pr` runs came straight after a passing `verify`. When a command takes a step, say so where it's named, and say what's left when the step fails.
- **A step taken by hand went wrong.** A pull request took five commands, and a wrong label failed once the branch was pushed. A branch named `v0.4.0` made a tag's push ambiguous. `pr` checks the label before it commits, and the release workflow tags the merged commit.
- **What gets checked by hand twice is a command.** A first deploy took two scratch scripts and `curl` to see, and each move to a new tool took six pull requests by hand. `status` and align do them now. When a scratch script is written a second time, make it a command.
- **A command a package runs goes in the package.** Releasing a package meant switching to craftz's checkout. `craftz release` reads the package from the folder's `origin`, like `pr` and `status`.
- **An editor under an agent waits where nobody sees it.** `craftz release` opened `vi` for the notes, and an agent's run sat with no output. A command an agent runs never waits on input it can't give.
- **A pointer to rules fires only at the step it names.** `AGENTS.md` said to read the prose rules before writing prose, so an agent deleting code never read them. Name every step a rule applies to.
- **The plan fell two releases behind.** Folding a release's steps into the plan was a step after the release, and nobody took it. `craftz release` stops until the plan is current.
- **A condition for removing code is checked when releasing.** A hold's prose said to delete it once every repository was on 0.4.0, and it was still there at 0.7.0. Write the condition next to what it removes.
- **A lesson named a private repository.** It reached a commit and a pull request, and GitHub keeps the old text. `AGENTS.md` says never to name one.

## One way in every repository

craftz's own principle. Where each repository did a thing its own way, the ways drifted apart and nothing flagged it. `craftz check` holds one way, in every `verify`.

- **Five repositories protected `main` four ways, and three release workflows had drifted.** A ruleset is one JSON document, and the workflow names no package, so each lives here and is applied or copied everywhere.
- **The editor formatted with a different oxfmt from `check`.** User settings pointed VS Code at a global oxfmt. Each repository commits the `.vscode/` settings Vite+ writes, so the extension runs the repository's own.
- **How Markdown wraps was left to each writer.** Turning on `proseWrap: "never"` waited on markz, since the reflow joined a `{@section}` line into the text beneath it. Before changing a formatter setting that reflows text, check what it joins.
- **Each repository kept its plan its own way.** The plans with a section per release grew past 2,000 words, while prose's, a line per thing, stayed short. A plan opens with what's next, says what works now, and tracks only its own repository.
- **Two tools printed findings two ways.** An agent reading both learned two formats. Every finding takes markz's line, and align picks out what's left by hand by its prefix.
- **A command reads the same way everywhere, or the difference reads as meaning something.** `AGENTS.md` said `pnpm prose rules` next to `pnpm exec craftz rules`. A `craftz` script makes it `pnpm craftz rules`.

## One meaning for each name

craftz's own principle, until prose's rules have it. A name, a flag or a type that means two things breaks on the case where they differ.

- **A setting that marked a site internal kept a private repository from a public one.** Turning off `workers.dev` said a site was internal, so no site could turn it off otherwise. Every site turns it off now, and Access alone says a site is internal. `private` in `package.json` means "not on npm", and nothing else.
- **Two files with one name read as one thing.** The notes' config at `.github/release.yml` sat beside the release workflow, so it's `.github/notes.yml`. The workflow kept its name, since npm's trusted publisher names it in every package.
- **One script name ran two commands.** `prose . build` built nothing, since prose reads `build` only as its first argument. The script is `prose` alone, and a rule checks it.
- **A type that's a combination of axes breaks on the next one.** "Package, site or tool" couldn't say what a package with a site is. Four axes, each read from its own place, describe every repository. When a repository argues against a rule in its docs, the gap is the rules'.
- **A folder's name isn't its repository.** `check` found holds by the folder's name, and missed them in a worktree, where `settings` read `origin`. A folder is the repository its `origin` names.

## What a repository runs shows in its own files

craftz's own principle. A value a repository reads from craftz changes with no diff in it, and breaks it without craftz. The `toolchain-*` rules write their values into each config, versions are exact, and a hold is in the repository's own `package.json`.

- **A range checks a floor, not a version.** Two repositories could pass `^4.151.0` and run different versions. Each shared tool, and craftz, is exact.
- **What a config read from craftz didn't show in its files.** `craftz()` set `fmt`, `lint` and the pack through Vite's `config` hook, which wins over a repository's config without a word. `site()` filled in a Worker's date. A release changed builds with no diff, and uninstalling craftz broke them. Each config writes its values out.
- **A shared default can't guess what's the repository's to say.** The plugin set every static site's folder to `.prose`, and a site built otherwise lost its folder. The site's `cloudflare.config.ts` names it.
- **A hold kept in craftz cost a release.** Adding one meant changing craftz, releasing it and upgrading the repository. When a check moves into the repository, move what tunes it there too.

## A rule ships with its check and its fix

craftz's own principle. A rule stated without a check, or a check without a fix, waits on every repository to notice. `rules.test.ts` fails a rule without a check, and a check without a rule.

- **A version nobody looks at drifts.** Checking versions found prose on Node 24 with no Vite+ override, and two repositories behind on markz. Every shared version is checked.
- **"Once the repositories move" is a rule that hasn't been written.** Nothing checked it, so `new` still wrote the old deploy. A sentence about the end state is a rule waiting for its id. A move that renames something ships a rule that finds the old name, and the rule goes once the move is done.
- **A rule without a fix waits on every repository.** Every config had the shape a fix moves in a line. Before a rule ships without one, look at what the repositories have. A fix that sets the reference's value changes nothing where it's in line, so it runs everywhere unchecked.
- **Edits to code a repository writes are kept apart from the rules.** Spread through the rules, they couldn't be read together. They're in [edit.ts](../src/edit.ts), as text to text, tested without a folder.

## What every repository changes for goes in one release

craftz's own principle. Each release sends every repository a round of pull requests. `align --candidate` shows what the next one asks, before it ships.

- **"Equal to the reference" made a package wait for the one it builds on.** prose needed markz's next release before craftz had it. Our own packages are at least the reference's, still exact.
- **What every repository changes for goes in before the release.** `pr` and `gone` were to become commands after the move, which would have meant a second round. A shared file that changes changes for everyone at once. Before a release, ask what the next one would change everywhere, and grep the reference for links outside craftz.
- **A rule that's missed is found by the next thing to use it.** 0.1.0 had no rule that a repository depends on craftz. Before a release, start a repository with `new`, and read what it writes against what the release is for.
- **A release's notes come from a run, not a plan.** 0.4.0's notes listed what the plan expected, and align then failed six sites on a rule without a fix. What a candidate run leaves by hand is what the notes say.

{#tools}

## Tools

What each tool does that its docs don't say.

### pnpm

- **An exact pin with `onFail: error` breaks on every pnpm release.** A newer global pnpm refused with `ERR_PNPM_BAD_PM_VERSION`. `onFail: download` fetches and runs the pinned version.
- **pnpm 12.13.0 needs its install script.** Its `pnpm` file is a placeholder for the native binary. Install the global pnpm from its GitHub release, as mise's default source does, not from npm.
- **A list of exceptions to the wait needed an edit on every release.** pnpm rewrote `minimumReleaseAgeExclude` in a form `vp check` rejects. `@amitkaps/*` is a pattern pnpm keeps.
- **Below 1.0, a minor counts as a major.** `update` listed markz 0.7.0 for review rather than taking it, so `bump` takes our own packages at any version.
- **A hand pin inside the wait is let in, not refused.** `pnpm install` adds it to `minimumReleaseAgeExclude`, which fails the settings check. Check `pnpm view <name> time` before pinning a beta, and restore `pnpm-lock.yaml` from `main` if one went in too soon.
- **A frozen install checks the wait where `pnpm install` didn't.** Run `pnpm install --frozen-lockfile` locally before pushing a change to pnpm's settings.
- **Some script names never run.** `deploy`, `audit`, `publish` and `ci` are pnpm's own commands, so the deploy script is `ship`.
- **`npx` refuses to run where `devEngines` names pnpm.** Use `pnpm exec` for an installed tool, and `pnpm dlx` for one that isn't.
- **`pnpm add` doesn't run a repository's `prepare`.** A clone that started with it never generated base's Worker types. A fresh clone installs first.

### Vite+ and TypeScript

- **`vp check` is the whole check.** Type-aware lint with `typeCheck: true` reports compiler errors too, so there's no `tsc`, and `vp check --fix` writes the fixes.
- **A framework needs steps around `vp check`.** SvelteKit's types come from `svelte-kit sync` and `wrangler types` first, and oxlint doesn't type-check `.svelte` files, so `svelte-check` runs after.
- **`isolatedDeclarations` in `tsconfig.json` reaches tests and config too.** `dts: { generator: "oxc" }` in the pack applies it only to what's packed, and a missing type still fails the pack.

### Cloudflare

- **An internal site leaks through `workers.dev`.** Access covers a domain, not a Worker, so its `workers.dev` address and preview URLs serve anyone. Every site turns both off.
- **A dependency can ask for more Node than the floor.** cf beta.20 needs Node 26.12.0. Read a new version's `engines` when moving it, and move the floor with it.
- **The Vite plugin's `beta` tag isn't the build to take.** Take the newest build past the wait that depends on the same `@cloudflare/config` as cf, read with `pnpm view <package>@<version> dependencies`.
- **The Git integration deploys whether or not CI passed.** A build command of `pnpm run verify` fails first.
- **Reconnecting a repository resets the Worker's build settings.** The integration reads pnpm's version but not Node's, so `NODE_VERSION` is set too. Run `craftz settings` after any reconnect.
- **cf has no command to rename a Worker, but the dashboard does.** Rename it there first, then in the config, since a new name in the config deploys a new Worker.
- **A domain set only in the dashboard can be dropped by a deploy.** Change one in the dashboard and the config together.
- **cf needs `CLOUDFLARE_ACCOUNT_ID` when the login has several accounts.** craftz picks the account named like the GitHub owner, and a `pnpm ship` by hand needs it set.
- **cf can't deploy SvelteKit yet.** The adapter doesn't write cf's Build Output, so an app stays on wrangler, with `wrangler.toml`.
- **A package's prose site can't build before the first commit.** `prose build` publishes a commit, so `new` commits before `verify`.
- **A tool a repository doesn't have is fetched, not missing.** `status` said cf wasn't installed in the app on wrangler. When a command needs a tool only to read, it brings its own with pnpm.

### GitHub

- **Search without a login leaves out private repositories.** Three with the topic stayed two releases behind. align searches as `gh`.
- **GitHub shows anyone a public repository's branch rules, but not its merge settings.** So `craftz settings --check` runs on a laptop, not in CI.
- **Auto-merge doesn't update a branch that falls behind.** `main` requires an up-to-date branch, so the second of two pull requests sat blocked. A wait updates it. Turning the rule off would let two changes that pass alone break `main` together.
- **Auto-merge can wait minutes after the checks pass.** Pull requests sat 6 to 12 minutes, all green. A wait that sees one ready merges it, and so does `gone`, after an agent polled GitHub by hand. The rules still decide what merges.
- **git won't delete a branch another worktree has checked out.** Not even with `--force`, and the error ended `gone`'s run. `gone` removes the worktree first, without `--force`, so one with changes is kept.

### npm

- **A summary in an annotated tag can't be reviewed.** It's the description of the pull request that bumps the version, and the workflow reads it from the merged commit.
- **pnpm won't run on a Node older than `devEngines`.** Testing an older Node meant switching after the install, so `engines` asks for the Node a package is built on.
- **Bundling our own packages removes the release order.** A package with markz as a dev dependency puts it in `dist/`, so it releases at any time.

### prose

- **A doc outside `docs/` is left out of the site's nav.** The rules first sat in `reference/`, beside the files they describe. They're `docs/rules.md`, and `reference/` holds only files a repository has.
- **prose's check warned only on text wrong on purpose.** Mark test corpora and fixtures `linguist-vendored`, which prose skips.
- **A section's id can't be a heading's.** A page a script fills after `prose build` is a doc with an empty `{@section}`, and markz warns `duplicate-id` when its id is a heading's too.
- **A hand-written `.html` page ships its comments.** Vite doesn't strip them, so such a page carries no prose.

### Node

- **An option's value can open with a dash.** `parseArgs` read `--body "- a list"` as a second option. `pr` joins each value to its option before parsing.
