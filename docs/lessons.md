# Lessons

What building craftz and the repositories' builds, checks and deploys taught, for whoever changes them next. Each lesson says what went wrong and what to do about it. What the code does now is in its `@prose`, and the story is in the pull request. Lessons that belong to one repository stay there.

The first groups follow the principles in [the rules' Practice](rules.md#practice), and each says what holds its principle. craftz's own groups come next, then [Tools](#tools), for what a tool does that its docs don't say. A lesson that repeats one in its group means the principle needs a check, a command or a line in `AGENTS.md`.

## Write the spec first

The rule is [Write the spec first](rules.md#write-the-spec-first). A rule is worded in [the rules](rules.md) before its check is written, and `rules.test.ts` fails a rule without a check, and a check without a rule.

- **"Once the repositories move" is a rule that hasn't been written.** Nothing checked it, so `new` still wrote the old deploy. A sentence about the end state is a rule waiting for its id. A move that renames something ships a rule that finds the old name, and the rule goes once the move is done.

## Measure before changing

The rule is [Measure before changing](rules.md#measure-before-changing). `craftz deps` weighs an install, and `status` notes a `verify` over its budget.

- **A slow test was timed before it was cut.** `verify` took two and a half minutes. Timing each part found MDN's data imported as a module where `require` parses it in a fraction, and five repositories set up one after another. Cutting the test would have hidden both.
- **A test repeated an expensive step for each case.** Five shapes of `new` each ran `verify`, and only two build differently. List what each case runs that the others don't, and run the expensive step only for those.
- **Work at a module's top level runs for every command.** Three constants parsed the rules doc as their modules loaded, so `gone` paid 50 ms for rules it never read. Parse on first use, and profile a command that does nothing.
- **`verify` ran its steps one after another.** `vp run`'s `all` task runs them side by side. A step that writes can't run beside steps that read, and a test that packs couldn't run beside `build`. Read what each step reads and writes on disk before moving it.
- **Splitting a slow test file only helps when a core is idle.** `vp test` already runs a file to a core, so splitting markz's saved 3 of 30 seconds. Time `verify` before and after a split, and keep it only when the time falls. craftz's fixes test did it again: three files saved 5 of 20 seconds, and putting back the files each case touched, not a copy of the repository, took it to 7.
- **A timing test failed on a slower machine.** markz's passed locally and in CI, then stopped a deploy on Cloudflare's. A private repository's CI gets two cores to a public one's four, too. A test that starts the CLI more than once gets its own timeout.
- **A shorter wait looked like a fix for a blocked release.** The block was the version check, not pnpm's wait. Weigh a setting by what it guards before changing it.
- **Vite's default browsers were three years old.** It's a list frozen at each Vite major. MDN's browser-compat-data was a release ahead of caniuse, so the floors come from it. caniuse counts Android Chrome as one version and leaves out in-app browsers, so read it beside a source that counts them.
- **A tool already had the feature the plan waited for.** Vite+'s `lazyPlugins()` skips plugins while it reads a config for `fmt` or `lint`, which halved a site's check. Read a tool's current docs before waiting on it, or before copying a workaround's reason.

## Don't repeat yourself

The rule is [Don't repeat yourself](rules.md#dont-repeat-yourself). A test holds `src/rules.ts` to the rules' ids, and another holds the CLI to usage's. A shared file is written whole from `reference/` and checked word for word, so `craftz check` holds one way in every `verify`. `pr` runs `gone` and `verify` and stops without a label, and `release` stops on a stale plan.

- **A list kept in two places drifted in one.** The `@prose` rules differed across four `AGENTS.md` files, and a check's label disagreed with the rule it checked. `deps` reached the help and usage, but not the README or the design. Each rule and command is a list item with an id in one doc, and a test holds the code to the ids both ways. A doc links the one copy, and says what's allowed and why, never the value.
- **A list in the code fell behind the repositories.** align's list kept a repository after it moved and never gained a new one. GitHub's `craftz` topic is the list, so a repository joins through its settings and leaves by being archived. Search takes a few seconds to see a new topic.
- **A thing done several ways drifted, and the difference read as meaning something.** Five repositories protected `main` four ways, three release workflows had drifted, and plans kept a section per release grew past 2,000 words. Two tools printed findings two ways, and `AGENTS.md` said `pnpm prose rules` next to `pnpm exec craftz rules`. Each now lives here once and is applied or copied everywhere, and every finding takes markz's line.
- **A helper written in each file came out five ways.** `gh` was wrapped in five modules, and one left its error on the terminal while the others threw it. `reference.ts` holds the one `gh` and the one command runner, and a test fails a second `const gh` in `src/`. A helper that two modules need goes where both can import it, before the second copy.
- **A generator and the fixes wrote the same files twice.** `new` writes only what's a repository's own, and runs the fixes for the rest. Its tests run `check` and `verify` on what it writes, so it can't drift from the rules.
- **A second copy of another tool's code goes in that tool.** prose and pagez needed craftz's help printer, so markz has `readCommands` and `printHelp`. The dashboard sized itself with a prose variable that prose renamed, so a page takes prose's tokens and keeps only its own.
- **Dependabot moved what moves from here.** It couldn't move the Vite+ override with Vite+, and every npm pull request it opened was closed. Versions move in the reference first, and `github-ci` drifts on a `dependabot.yml`.
- **The editor formatted with a different oxfmt from `check`.** User settings pointed VS Code at a global oxfmt. Each repository commits the `.vscode/` settings Vite+ writes, so the extension runs the repository's own.
- **A step at a moment nobody notices never ran.** `AGENTS.md` said to run `gone` after a merge, and ten repositories held thirteen merged branches, since an agent moves on first, and a session that auto-compacts never ends. The plan fell two releases behind, and a hold meant to go at 0.4.0 was still there at 0.7.0. `pr` runs `gone` first, `gone` pulls `main`, and `release` stops on a stale plan. A condition for removing code is written next to what it removes, and checked when releasing.
- **What's done by hand twice is a command.** A pull request took five commands, and a wrong label failed once the branch was pushed. A first deploy took two scratch scripts and `curl`, and releasing a package meant switching to craftz's checkout. `pr`, `status` and `release` do these now, from the folder they're run in.
- **A wait in the session held up the next change.** `pr` stopped on a new title while the last pull request was open, so agents sat through CI. `pr` returns once it's pushed, and a new title waits only for a merge that hasn't happened.
- **Agents ran `verify`, then ran it again.** 78 of 306 `pnpm pr` runs came straight after a passing `verify`. When a command takes a step, say so where it's named, and say what's left when the step fails.
- **A pointer to rules fires only at the step it names.** `AGENTS.md` said to read the prose rules before writing prose, so an agent deleting code never read them. Name every step a rule applies to.
- **A rule without a fix waits on every repository.** Every config had the shape a fix moves in a line. Before a rule ships without one, look at what the repositories have. A fix that sets the reference's value changes nothing where it's in line, so it runs everywhere unchecked.

## One name, one meaning

The rule is [One name, one meaning](rules.md#one-name-one-meaning). Four axes describe a repository, each read from one place, and `scripts-prose` holds the `prose` script to one command.

- **A setting that marked a site internal kept a private repository from a public one.** Turning off `workers.dev` said a site was internal, so no site could turn it off otherwise. Every site turns it off now, and Access alone says a site is internal. `private` in `package.json` means "not on npm", and nothing else.
- **Two files with one name read as one thing.** The notes' config at `.github/release.yml` sat beside the release workflow, so it's `.github/notes.yml`. The workflow kept its name, since npm's trusted publisher names it in every package.
- **One script name ran two commands.** `prose . build` built nothing, since prose reads `build` only as its first argument. The script is `prose` alone, and a rule checks it.
- **A type that's a combination of axes breaks on the next one.** "Package, site or tool" couldn't say what a package with a site is. Four axes, each read from its own place, describe every repository. When a repository argues against a rule in its docs, the gap is the rules'.
- **A folder's name isn't its repository.** `check` found holds by the folder's name, and missed them in a worktree, where `settings` read `origin`. A folder is the repository its `origin` names.

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

## Try it on the real thing

The rule is [Try it on the real thing](rules.md#try-it-on-the-real-thing). The tests run the packed command, and `align --candidate` and `--local` run a change on every repository before it's released. `check` runs against the craftz a repository installs, and `status` reads `main` on GitHub.

- **A fix written against the reference missed every real repository.** `toolchain-craftz` took out a block only when it was exactly the plugin's, and every repository had its own `ignorePatterns` in it. The first align found two more bugs no test had, and `--local` on craftz found a fix that dropped `docs/rules.md` from `files`. Write a fix against a real repository's file, and run align on each, craftz too, before a release.
- **A fix has to change nothing the second time.** The first `fix` on a repository in line rewrote JSON with `JSON.stringify`, which undid the formatter. A file is written only when its value changes. Run `fix` twice on each repository's `main` from `git archive`, since a checkout can be behind.
- **A standard is tried in every repository before it's written.** Each tsconfig looked like it had reasons of its own. Setting one in each and running its check showed only SvelteKit's were real.
- **A principle is found across repositories, not in one.** craftz's lessons filed parsing under Vite+ and weighing a tool under timing. markz's, prose's and pagez's showed both in all four. Before writing a principle, read the other repositories' lessons for it.
- **A command that ran from the checkout failed from the package.** `new` read cf, which a package doesn't install, and bundled 9 MB of Vite+. A test that installed craftz from npm couldn't have the version being released. So the tests install this checkout's packed tarball, and a command loads only what it runs.
- **A file craftz writes whole can't be edited to set up a test.** A test's override in `pnpm-workspace.yaml` failed its own `craftz check`. The test puts the file back after the install, since pnpm reads it only then.
- **A new repository is read before it's pushed.** Run `new` without `--push` first. A package's first push changes `package.json`, so its release workflow stops for a package npm doesn't have yet.
- **A copy read as the source was behind it.** npm's `latest` for pnpm pointed at 12.11.2 while 12.13.0 was out, `status` read a clone that hadn't pulled the day pagez's version merged, and an agent fetched a summary of a rule's page. The check compares with the reference, `status` reads `main` on GitHub, and a finding names an id that `craftz rules <id>` prints from the version installed.
- **A check ran other rules than the ones installed.** Sweeps from craftz's checkout found drift no repository could fix yet, and a candidate run's next install brought npm's craftz back. Each `verify` runs the craftz it installs, and align moves a repository to a release and runs that version's fix. When findings read like an older craftz, check which one the clone installed.
- **A read straight after a write can be the old answer.** GitHub answered a read-back from before the write, and a pull request read as behind its own merge for a second. A read-back is tried again before it's reported, and a failed update means asking again.
- **A squash merge hides what it took.** The branch's own commits stay ahead of `main`, so counting them pushed an empty pull request. Whether a branch adds anything is a question about trees. Merge it onto `main`, and see if `main` changes.
- **The branch decided where a pull request went, not its title.** One change merged inside another's pull request, another carried merged commits again, and a title run from `main` started a second branch. The title decides, from any branch.
- **A check runs on what will be committed.** align ran `verify` before staging, so git still listed deleted files. prose builds the last commit too, so a doc is missing until it's committed. Commit, or stage, before checking.
- **A file an agent reads at the start is written at the end.** `outline.md` was written only on the branch, so the next session started from a map without what merged. `gone` and `pr --wait` write it once they're on `main`.

## Have a way to verify

The rule is [Have a way to verify](rules.md#have-a-way-to-verify). Each rule has a check that runs in every repository's `verify`, and a check that moves is held to the findings it had before.

- **A split left links that still resolved.** Moving the rules out of `src/rules.ts` kept the file, so five docs still named it as holding every check, and six empty imports stayed behind. After moving code, search the docs for the old path and the file for what it no longer uses.
- **A moved check is proven by the same findings.** Repositories in line print the same ticks either way, which shows little. Make a clone drift on purpose and compare what both print.
- **Replacing a tool drops what it did on failure.** `craftz deploy` sent each bucket of files once, where cf tries again, and one `10013` from Cloudflare failed a deploy. When a command replaces a tool, list what the tool does on failure too.
- **A version nobody looks at drifts.** Checking versions found prose on Node 24 with no Vite+ override, and two repositories behind on markz. Every shared version is checked.

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

## A run removes what it writes

craftz's own rule, in [Scripts](rules.md#a-run-removes-what-it-writes). A command's folder comes from [src/temp.ts](../src/temp.ts), which removes it when the run ends, and a test fails a folder made anywhere else. `tests/temp.ts` removes the tests' folders.

- **Temporary folders held tens of gigabytes.** align left every clone, 62 GB after 37 runs, and the tests left 31 GB in a few days. macOS's cleanup never took them. A run removes what it wrote, and prints a folder only when it kept something in it.
- **A lockfile keeps what nothing installs any more.** esbuild stayed in four lockfiles after Vite+ moved to Rolldown, and `pnpm dedupe` kept it. align writes the lockfile afresh on every run. After moving toolchains by hand, remove `node_modules` and `pnpm-lock.yaml` before installing.
- **`node_modules` isn't the install.** pnpm keeps each version in `node_modules/.pnpm` until a fresh install, and the lockfile counts builds for other platforms. So craftz's 952 MB was 502 MB installed. `craftz deps` counts only what the tree reaches on disk.
- **Work done in a clone leaves the checkout behind.** After a run, every checkout beside craftz was on an old `main`. align brings each one to `main` once its merges land, and keeps one with work of its own.

## What a repository runs shows in its own files

craftz's own principle. A value a repository reads from craftz changes with no diff in it, and breaks it without craftz. The `toolchain-*` rules write their values into each config, versions are exact, and a hold is in the repository's own `package.json`.

- **A range checks a floor, not a version.** Two repositories could pass `^4.151.0` and run different versions. Each shared tool, and craftz, is exact.
- **What a config read from craftz didn't show in its files.** `craftz()` set `fmt`, `lint` and the pack through Vite's `config` hook, which wins over a repository's config without a word. `site()` filled in a Worker's date. A release changed builds with no diff, and uninstalling craftz broke them. Each config writes its values out.
- **A shared default can't guess what's the repository's to say.** The plugin set every static site's folder to `.prose`, and a site built otherwise lost its folder. The site's `cloudflare.config.ts` names it.
- **A hold kept in craftz cost a release.** Adding one meant changing craftz, releasing it and upgrading the repository. When a check moves into the repository, move what tunes it there too.

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

- **How Markdown wraps was left to each writer.** Turning on `proseWrap: "never"` waited on markz, since the reflow joined a `{@section}` line into the text beneath it. Before changing a formatter setting that reflows text, check what it joins.
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
- **A push after the checks pass can arrive too late.** Auto-merge had merged the pull request, so the follow-up commit went to a branch with no open pull request, and `pnpm pr` with the same title failed. Look at `gh pr view` before pushing again, and open a new pull request from `main` if it merged.
- **Auto-merge can wait minutes after the checks pass.** Pull requests sat 6 to 12 minutes, all green. A wait that sees one ready merges it, and so does `gone`, after an agent polled GitHub by hand. The rules still decide what merges.
- **git won't delete a branch another worktree has checked out.** Not even with `--force`, and the error ended `gone`'s run. `gone` removes the worktree first, without `--force`, so one with changes is kept.
- **A Claude Code cloud session can't use GitHub's GraphQL API.** `pnpm pr` pushes the branch, then fails on GraphQL with no pull request opened. Open it with the GitHub tools or the REST API, then add the label and turn on auto-merge there.

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
