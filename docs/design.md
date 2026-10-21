# Design

craftz is one way to build, check, deploy and release a repository, as a package each one depends on. It's also the repository that shows it working. This page is the design as a whole. [The plan](plan.md) says which parts are built so far, and in what order the rest comes.

## What it is

A package, `@amitkaps/craftz` on npm, that each repository depends on, the way a project depends on Vite+. A repository holds its own code and a few short files that point to craftz. The package holds the rest.

- **The rules.** [The rules](rules.md) say what every repository does the same way and why, each under an id. `craftz rules` prints them from the installed version.
- **The checks and fixes.** Each rule has a check, and a fix where one can be automated. `craftz check` runs them in a repository's `verify`, and `craftz fix` writes the fixes.
- **The reference.** [reference/](../reference/README.md) holds the files a repository is compared with, like the workflows, the editor settings and the pinned versions. A fix copies from there.
- **The settings.** `craftz settings` checks and writes what lives outside the files, like the `main` ruleset, the labels and each Worker's build settings.
- **The plugin and the deploy.** `craftz()` sets the Vite+ config the rules ask for, and `craftz deploy` deploys a site the way its Worker config says.
- **The start.** `craftz new` writes a repository that passes the rules from its first commit, from any folder, as `pnpm dlx @amitkaps/craftz new`.

It's opinionated, and built for one setup: Vite+, pnpm, Node 26, GitHub and Cloudflare Workers. It doesn't try to fit another, since every choice it makes rests on that setup.

It's built with `vp pack` and released like markz and prose. It follows its own rules, so it's also the first repository they're tried on.

## Why

Each repository used to make the same choices on its own, and they drifted. There were four ways of protecting `main`, three copies of one release workflow, and one script name running two commands. A choice made once is paid for once.

Then the choices were kept in one repository and copied into the rest. Every repository held copies, like `pr.ts`, `gone.ts`, the release workflow, CI's Label step, the `fmt` and `lint` config and the editor settings, and that one repository checked and moved them. Each new repository added more copies to keep in line. An agent read the rules by fetching a page, which hands it a summary, not the text.

A package removes both. A repository checks itself against the version it installs, and `craftz rules` prints the rules from that version, with no fetch. A new choice reaches every repository as a version bump, which each takes in a pull request of its own. A repository that's behind still checks clean against its own version, so nothing breaks before it moves.

## One rule, one check, one fix

Each rule has one implementation. [The rules](rules.md) word it once, as a list item that opens with its id. [src/rules.ts](../src/rules.ts) holds its check and, where it can be automated, its fix, under the same id. A test fails if either has an id the other doesn't. `craftz check` and `craftz fix` run the rules in a repository, and align calls the same code in each clone, with no second copy of any rule. A fix that edits a repository's own code, like `vite.config.ts` or CI, does it through [src/edit.ts](../src/edit.ts), which reads the file by its lines. That's the property to protect as craftz grows.

The files a rule compares with are in [reference/](../reference/README.md), laid out as a repository has them. A version, a strict option or a workflow is read from there, not written out twice, so the rules can't disagree with the example.

craftz owns a repository's conventions and its lifecycle commands. Vite+ and each framework keep their own build and compiler behaviour, and craftz connects them without redoing it.

## The commands

| Command | Does |
| --- | --- |
| `craftz rules [id]` | prints the rules, or one rule, from the installed version |
| `craftz check` | runs every rule in the repository, in its own `verify` |
| `craftz fix` | writes every fix that can be automated |
| `craftz upgrade` | moves the repository to the latest craftz, and runs its fix |
| `craftz settings` | writes the GitHub and Cloudflare settings, with your login |
| `craftz status` | reads what's live: CI, pull requests, npm, and a site's build and addresses |
| `craftz pr`, `craftz gone` | open a pull request that merges itself, and delete merged branches |
| `craftz release` | opens the pull request that releases a package |
| `craftz deploy` | deploys the way the repository's deploy axis says, run by the `ship` script |
| `craftz new` | starts a repository that already follows the rules |
| `craftz()` | a Vite plugin that sets `fmt`, `lint` and a site's config for what it deploys |

Each command acts on one repository, the one it's installed in, except `new`, which starts one. What acts on every repository at once isn't in the package, as [Every repository at once](#every-repository-at-once) says.

`ship` stays the deploy verb, as the `ship` script, so the command and the script don't share a name. pnpm runs a script before a command of the same name, so a command called `ship` would run the deploy.

## Axes

A repository isn't one type. It's four independent axes, as [the rules](rules.md#axes) define them: what it publishes, what it deploys, who the site is for, and who can see the code. Each is read from where it already lives, never declared, and `craftz()` and `craftz deploy` act on them.

| Axis | Read from | Gets |
| --- | --- | --- |
| publish: package | not `private` | `vp pack`, the release workflow, a release-notes label |
| deploy: static | a Worker config with no code of its own | Cloudflare's plugin with `assetsOnly`, `cf deploy --prebuilt` |
| deploy: app | a Worker config with an `entrypoint` or `main` | the adapter, `wrangler types`, and wrangler's deploy while it's held |
| audience: internal | an Access application on the site's domain | its other addresses off, and Access's policy checked |
| repository: private | GitHub | no `LICENSE`, and off craftz's list |

A static site's files can come from anywhere, like `.prose` as `publicDir` or Vite's own pages, and nothing about the deploy changes. The axes don't overlap, so there's nothing to choose between. The deploy axis is the one that could, and the Worker config settles it, since code to run makes it an app. So no repository ever writes its type down.

Some pairs meet badly, and they're allowed, with what's lost said where it applies, rather than a rule forbidding them. A package in a private repository can't have npm's provenance, and `new` says so. A private repository's rulesets need a paid GitHub plan, which this account has.

When cf can deploy SvelteKit, only `craftz deploy` changes, and the app needs no change of its own.

## A thin plugin

`vite.config.ts` is code, so a value in it can only be read and edited by its lines, which break when a file is laid out otherwise. So the values every config shares, `fmt` and `lint`, aren't in the file. `craftz()` sets them, from the installed version, and the check only looks for `craftz()`. Vite+ holds a config to them each time it loads it, in the editor as well as in `verify`, and a new craftz changes them with no edit to the file. `tsconfig.json` is JSON, which reads cleanly, so its options are checked where they are.

A fix edits a config only where the plugin can't do the job: adding a plugin, like `craftz()` itself, naming a site's folder, or changing a file Vite doesn't read.

`craftz()` fills in only what the repository leaves unset, or fails and names the conflict, and a test holds it to that. It has to, since a plugin's `config` hook wins over the repository's own `vite.config.ts` without a word. With `proseWrap: "preserve"` in the config and `"never"` from a plugin, oxfmt used the plugin's.

## Files that stay in the repository

GitHub reads workflows and `.github/release.yml` from the repository, and the editor reads `.vscode/`. These stay as files, but short ones whose steps call craftz's commands, so they rarely change. craftz manages them, and each repository checks its own against the version it installs. `craftz check` compares them with the installed version's, and `craftz fix` writes them.

They aren't reusable workflows, which would version separately from the package. The release workflow keeps npm's trusted publishing as it is.

## Fixes you can predict

`craftz fix` is deterministic, so running it twice changes nothing the second time. It lists each file it changed and each problem it couldn't fix.

## Settings, never secrets

`craftz settings` writes the `main` ruleset, the merge settings, the labels and each Worker's build settings. It uses the logins `gh` and `cf` already have, so craftz holds no token. The workflows need none either, since npm trusts the release workflow and Cloudflare builds through its GitHub app. A site's own secrets, like an app's API key, belong to that site, and craftz never reads or writes them.

It writes remote state, so it's held to more than a file fix.

- `craftz settings --check` only reads.
- It writes only what the rules own, like the ruleset named `main` and the release labels, and leaves the rest alone.
- It asks before deleting anything it didn't create, like classic branch protection.
- After writing, it reads the settings back. Done means the settings now match, not that the API took the write.
- When one write fails partway, like GitHub's landing and Cloudflare's not, it lists what changed and what's still off. Each write is idempotent, so running it again finishes the job.

## Releases

Each repository names craftz at an exact version, as it does every shared tool, so an install never moves it, and moving it is a pull request. A release's label says what that pull request asks of a repository.

- **Patch:** nothing changes for a repository. The rules' wording changes, or a check gets a fix, and a repository that passed still passes.
- **Minor:** `craftz fix` makes the change on its own, like a new line in a managed file or a new rule with a fix.
- **Breaking:** a repository needs a change by hand, or the release changes how a repository deploys or what its GitHub or Cloudflare settings are. Those two are breaking even when `craftz fix` could make them, so they're always read before they land.

While craftz is below 1.0, a minor release plays the breaking release's part, as it does for markz and prose.

Every change to the rules is a release, with its 2FA approval. craftz's site shows the latest, and the installed version is what binds a repository. Small changes wait and go out together.

A repository is checked against the version it installs, never craftz's latest. Checking against the latest would fail a pull request that passed `verify` on a laptop. `craftz check` notes a newer release, as a note that never fails, and moving to it is the repository's own pull request.

## Errors, warnings and notes

A finding is one of three, and craftz sets which for each rule.

- **An error** fails `craftz check`, so it fails `verify` and the pull request. Most rules are errors.
- **A warning** prints on every run and doesn't fail. A held rule is a warning.
- **A note** says something worth knowing with nothing drifted, like a newer craftz or a beta that's graduated.

A repository can't turn a rule off, and can't make a rule an error or a note. It can hold a rule, which makes that rule's error a warning, and only a rule craftz marks as one a tool can block, like a tool's version or the deploy. The hold lives in the repository it holds, with its reason and when to look again, so adding or dropping one is that repository's own pull request. A hold whose rule stops drifting is an error until it's taken out, so none outlives its reason.

Where a rule has two right answers, like an app deploying with wrangler while cf can't build it, the rule says so and its check takes either. That's not a hold, since neither answer is drift.

## Versions come with craftz

Each craftz release carries the versions of the tools it was tested with, like Vite+, TypeScript, prose and markz, in [the reference](../reference/package.json). `craftz upgrade` adds the latest craftz and runs its `craftz fix`, which writes them into the repository, so moving craftz is the one change that moves the rest. A tool's new major is a breaking craftz release.

## Every repository at once

Each repository checks its own files in CI, with `craftz check` against the craftz it installs, so nothing needs to check them from outside. What's left is moving every repository to a new craftz, and its settings, which CI can't read or write without a login. So two scripts run on the laptop, never in the cloud. They're in this repository, not commands of the package, since they serve whoever keeps the repositories, and a repository needs neither to follow the rules.

- `pnpm align` runs `craftz upgrade` in each repository, opens a pull request and writes the settings.
- `pnpm bump` moves the reference to the newest versions, in craftz's own pull request, before a release.

align works in a fresh clone of each `main`, never a checkout. Each repository has one branch named `align`, which a later run updates, so running it again never opens a second pull request. It opens a pull request only when `verify` passes, and one that fails leaves its clone and log. It ends with a report, with each repository opened, updated, already in line or failed. `--local` stops before the push and only reads the settings, so a run can be read before anything leaves the laptop.

In each clone it takes `craftz upgrade`'s steps, so the new version's `craftz fix` runs, and the rules that apply are the ones the repository moves to. It only moves a repository to a released craftz, so a change in this repository reaches nobody until it's released.

align holds no rules of its own. It finds the repositories by the GitHub topic `craftz`, which writing a repository's settings adds. So a new repository joins when its settings are written and leaves when it's archived, and no list in craftz needs a pull request. The list reads only public repositories, so craftz never names a private one.

## No cycle

prose depends on craftz, and craftz's site depends on prose. Both are devDependencies, like markz and prose. craftz's package depends on neither. It takes Vite+ as a peer, since `new` formats with it, and a repository has it already. Cloudflare's plugin is the repository's own, which its config imports. A fresh checkout builds from released versions, which a clean clone and install must prove. craftz's first version is published by hand, as every package's is.

## What it isn't

- **Not an app framework.** Vite+ and each framework keep their own build, and craftz connects them.
- **Not a template.** Nothing is copied and left to drift. `craftz new` builds from the reference, and `craftz check` keeps checking afterwards.
- **Not a monorepo.** Each repository stays its own, with its own releases. More are coming, like a browser, and each keeps its own.
- **Not a place for preference.** A repository can't opt out of a rule. When a tool can't support one yet, the check is held, with a reason and a condition for looking again.

Ruled out:

- **Installing from GitHub.** Node won't strip types from a file in `node_modules`, so craftz would commit its built JS. npm builds on release instead.
- **Copies checked from one place.** That's how the rules were kept before craftz, and the checking is the admin this removes.
- **A GitHub organization.** The repositories stay on the account.
- **Using Void.** Its shape is borrowed, like reading the type from the project, and the framework isn't. Void runs apps, while craftz keeps repositories.
- **A command named `ship`.** It would share its name with the deploy script.
