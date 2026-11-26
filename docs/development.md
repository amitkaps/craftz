# Development

How craftz is built and changed. What every repository shares, like the scripts, CI and releases, is in [the rules](rules.md), and isn't repeated here.

## Build and test

```sh
pnpm install
pnpm dev
pnpm verify    # what CI runs
```

`pnpm craftz rules` runs the command from `src/`, with no build, and so does `pnpm new`. `pnpm align` and `pnpm bump` are this repository's own scripts, and run from `src/` too. pnpm runs a script before a command of the same name, so inside this repository `pnpm craftz` is always the source, never an installed copy.

## Changing the rules

A change to how things are done starts here, in [the rules](rules.md) and in [the reference](../reference/README.md). When it can be checked, it's also a rule. That's a list item in the rules that opens with its id as a span, like ``- [`scripts-verify`]{#scripts-verify}: …``, and a check under the same id in [src/rules/](../src/rules/), with a fix when one can be automated. [rules.test.ts](../tests/rules.test.ts) fails if either has an id the other doesn't.

`pnpm craftz check ../markz` runs the rules from source on another checkout, to see what a change asks of it before it's released. What the change taught goes in [the lessons](lessons.md), in the same pull request.

`tools-beta`'s list of betas is read from its line, as each name in backticks, so that line puts nothing else in backticks.

### Writing a rule

[The rules](rules.md) are read by an agent in another repository, in the middle of a task, one part at a time from `craftz rules <part>`. So they're instructions with a little context: what to do, then why, in a sentence.

- **A part** opens with a sentence or two on what it covers and why it's shared. Then come its rules. It ends with **Yours.**, what a repository decides for itself, and **Ruled out.**, each idea with its reason and when to look again.
- **A rule** is a list item that opens with its id. Its first sentence is the instruction, in the present tense and starting lowercase. It names the values it asks for, rather than pointing at a file that holds them. One or two sentences give the reason or the exception. "The fix …" ends it, when there is one.
- **A principle** in Practice is one paragraph of about 100 words or fewer, with no bullets. It opens with what went wrong, in the past tense. Then comes "So" and the instruction, then how far it goes or where it stops. An example goes in only where the instruction is abstract.
- **A rule with no check** is a list item that opens with a bold label instead of an id, and reads the same way.
- **Elsewhere, not here.** How craftz checks or fixes a rule goes in that code's `@prose` or in this page. Why the design is this way, at length, goes in [the design](design.md). What a reference file sets is in that file's `@prose`, and what a command does is in its `--help`. How a rule came about is in its pull request.

The test for a part is to halve it. Keep what an agent does and the one reason for it. Move the rest to one of the places above, or cut it.

## The reference

[reference/](../reference/README.md) holds the files a rule compares with, laid out as a repository has them, like the workflows, the editor settings and the versions. A rule reads its value from there, so it's never written out twice. These files are checked by `prose check` like any other, so their links have to work where they stand.

`pnpm bump` moves the reference's versions, not craftz's own, before a release. It installs the reference in a clone as a project of its own, updates it, then runs craftz's fixes from source against it and opens craftz's pull request. The others take the new versions once they're released, from `pnpm align`. `craftz new` builds a repository from the reference and from craftz's own `LICENSE`. The reference holds `.gitignore` as `gitignore`, since npm leaves a dotted one out of a package, and a test keeps it the same as craftz's own.

## The command

[src/cli.ts](../src/cli.ts) is the `craftz` command, built by `vp pack` into `dist/cli.js`, with the rules' checks and fixes bundled in. The package publishes `dist/`, `docs/rules.md`, which `craftz rules` prints, and `reference/`, which the checks compare with. It has no dependencies, and takes Vite+ as a peer, which only `new` loads.

Two values are worked out from source, the browsers from browser-compat-data and the Workers' date from the workerd the reference's cf depends on, kept in [src/workerd.json](../src/workerd.json). `vp pack` writes them in, as [src/pinned.ts](../src/pinned.ts) says, and leaves browser-compat-data out of the bundle. `pnpm pack` and running `dist/cli.js` from the unpacked tarball shows what a user gets.

## Beta packages

The packages still on a beta are the ones [`tools-beta`](rules.md#tools-beta) names, and `package.json` has their builds. align leaves them alone, since their tags don't say which build goes with which, and `pnpm bump` lists a newer build under `Left for review`, with a newer pnpm or Node, so one isn't missed. One is listed once npm's latest for it is a release at the beta's major or later.

A newer beta is moved by hand too. Pin it in the reference's `package.json`, after reading its `engines`. The next run from source reads the workerd it brings from npm into [src/workerd.json](../src/workerd.json), whose date is the Workers' compatibility date, so commit that with it. To move one to its release, pin the release and take it out of `tools-beta`. A beta never deploys a static site, so check what cf does do. Run `pnpm run verify`, then `pnpm craftz status` and `pnpm craftz settings --check` on a site or two. The tests can't call cf's commands, since they need a login, and a release can rename one. A move also changes the compatibility date, so update craftz's own `cloudflare.config.ts` and the docs that show it. Only base deploys with wrangler, so it's the one place a deploy is worth trying.

## Playwright

[`tools-playwright`](rules.md#tools-playwright) holds `@playwright/test` to the version whose Chromium revision the Claude Code cloud image ships, so a session screenshots with no download. `pnpm bump` leaves it where it is.

To move it, start a cloud session and run `ls /opt/pw-browsers`. It lists the image's `chromium_headless_shell-<revision>`. The Playwright that wants that revision is the one to pin. `pnpm exec playwright install --dry-run chromium` in a clone names the revision a version wants. When the image's revision is behind the newest Playwright, the pin stays behind it. Pin the reference's `package.json`, and the next `pnpm align` moves each repository.

## Repositories

Every public repository that follows these rules has the GitHub topic `craftz`, so `align` moves it. Writing its GitHub settings adds the topic, and archiving it drops the repository from the list. A repository joins one of two ways, and both end the same: listed, protected, and passing `craftz check` and `craftz settings --check`.

### Bringing one in

1. Run `craftz settings` in it, which adds the topic along with the rest of GitHub's settings. Then `craftz upgrade`, which adds craftz and its fixes, and lists what's left by hand.
2. Fix what's left, in the repository's own pull requests. Where a tool can't meet a rule yet, add a hold rather than a workaround.
3. Connect a site's Worker to the repository, in Cloudflare's dashboard.
4. Run `align <repo>`, for the branch rules, a package's labels and the Worker's build settings. A package still needs its trusted publisher on npm.

### Keeping them in line

Each repository checks its own files in CI, with `craftz check` against the craftz it installs, so a pull request can't drift from the rules it names. What needs a login stays on the laptop.

- **`craftz settings --check`** reads one repository's settings on GitHub and its Worker, and `craftz status` what's live.
- **align** brings each repository in line with the reference, from a fresh clone of each `main`. Every shared tool and the editor settings come from the reference, and each repository's own libraries move within their majors. A pull request opens where `verify` passes, with auto-merge on, and lists any new major left for review. GitHub's settings and the Worker's are written directly, since there's no file to review. `align --local` changes nothing, and lists every repository's settings that have drifted.

A change to the rules, like a new check, is a pull request to craftz. It reaches the others in craftz's next release, which `align` moves them to.

### Following it unlisted

A private repository can follow these rules without being listed, since craftz is public and would name it. The list only reads public repositories, so a private one's topic doesn't put it there. Its own `craftz check` and `craftz settings` work as in any repository, and `align <repo>` still writes its settings. Where it can't follow a rule, its own docs say which and why.

### Starting one

`new` starts a repository that already follows these rules, in a folder of the current one.

```sh
new <name> --package --description "What it is, in a sentence." --push
new <name> --package --site static --description "What it is, in a sentence." --push
new <name> --site static --internal --description "What it is, in a sentence." --push
new <name> --private --description "What it is, in a sentence." --push
```

The flags are [the axes](design.md#axes). `--package` publishes it and `--site static` deploys a static site, and with neither, it's scripts run on a laptop. `--private` makes the repository private on GitHub, which keeps it off the list. `--internal` says in a site's config that it's behind Access, and the Access application is the step left to do by hand.

It writes only what's the repository's own: its name and description, its source, its Vite config and strict types, and CI. Each is built from the reference's files rather than a template. Then it runs every rule's fix, the ones `align` runs. They write the rest: the versions and engines, the shared scripts, the editor settings, the cooldown, the shared `AGENTS.md` sections, a package's release files and packing, and a first version of each doc. So a new repository can't follow the rules any less than `align` makes an old one. Then it installs, formats with `fix`, writes the outline, runs `verify` and makes the first commit. `--push` creates the repository on GitHub, pushes that commit and writes its GitHub settings, as `align` does. That first push is the only one to `main` the rules allow, since the rules aren't on yet. Its settings add the topic, so `align` finds it. It prints what's left: the Worker or npm's setup. A SvelteKit app starts from base instead, and is brought in like any other.

`new`'s test generates a package, a static site, a package with a site, scripts in a private repository and an internal site. It checks each against the survey and runs its `verify`, so the generator can't fall behind the rules.

## Release

craftz releases the way every package does, as [the rules](rules.md#releases) set out. A release sends a round of pull requests to every repository, so what comes before it is the work. These steps run in this checkout, in order.

1. Run `pnpm gone`, then `pnpm bump`. It moves the reference to the newest versions and opens craftz's pull request. It ends with a `Next` section, which says what to do with each thing left. `pnpm bump --local` shows the same run with nothing pushed. A release is what's on `main`, so wait for the pull request to merge.
2. Run `pnpm align --candidate`. It packs this checkout and moves every repository to it, locally. What each one leaves by hand is what the release's notes say to do. [The lessons](lessons.md#what-every-repository-changes-for-goes-in-one-release) say why this comes first.
3. Read the trial repository the candidate run names against what the release is for. The run starts it as `pnpm new trial --package --site static` would, with the packed craftz, in its own folder, and runs its `verify`. A rule that's missed is found by the first thing to use it.
4. Ask what the release changes for every repository, and grep the reference for links outside craftz. Anything that changes everywhere goes in before the release, so it doesn't need a second round.
5. Run `pnpm prose style` and fix what it finds, as [the rules](rules.md#releases) say every package does before a release. Do the same in markz, prose and pagez before each of their releases.
6. Update [plan.md](plan.md) so its summary names the version and no step is ticked. `craftz release` stops otherwise.
7. Run `pnpm craftz release X.Y.Z --notes "…"`, with what the candidate run left by hand as the notes. It opens the pull request that bumps `version`, with auto-merge on, so run it only when the release should go.
8. It merges once CI passes, and that is the release. Then approve the staged version on npmjs.com with 2FA.
9. Run `pnpm align`. It takes the release to every repository, and brings the checkouts beside this one to `main`.
