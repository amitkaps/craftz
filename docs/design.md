# Design

craftz is one way to build, check, deploy and release a repository, as a package each one depends on. It's also the repository that shows it working. This page is the design as a whole. [The plan](plan.md) says which parts are built so far, and in what order the rest comes.

## What it is

A package, `@amitkaps/craftz` on npm, that each repository depends on, the way a project depends on Vite+. A repository holds its own code and a few short files that point to craftz. The package holds the rest.

- **The rules.** [The rules](rules.md) say what every repository does the same way and why, each under an id. `craftz rules` prints them from the installed version.
- **The checks and fixes.** Each rule has a check, and a fix where one can be automated. `craftz check` runs them in a repository's `verify`, and `craftz fix` writes the fixes.
- **The reference.** [reference/](../reference/README.md) holds the files a repository is compared with, like the workflows, the editor settings and the pinned versions. A fix copies from there.
- **The settings.** `craftz settings` checks and writes what lives outside the files, like the `main` ruleset, the labels and each Worker's build settings.
- **The plugin and the deploy.** `craftz()` sets the Vite+ config the rules ask for, and `craftz deploy` deploys a site the way its Worker config says.

It's opinionated, and built for one setup: Vite+, pnpm, Node 26, GitHub and Cloudflare Workers. It doesn't try to fit another, since every choice it makes rests on that setup.

It's built with `vp pack` and released like markz and prose. It follows its own rules, so it's also the first repository they're tried on.

## Why

Each repository used to make the same choices on its own, and they drifted. There were four ways of protecting `main`, three copies of one release workflow, and one script name running two commands. A choice made once is paid for once.

Then the choices were kept in one repository and copied into the rest. Every repository held copies, like `pr.ts`, `gone.ts`, the release workflow, CI's Label step, the `fmt` and `lint` config and the editor settings, and that one repository checked and moved them. Each new repository added more copies to keep in line. An agent read the rules by fetching a page, which hands it a summary, not the text.

A package removes both. A repository checks itself against the version it installs, and `craftz rules` prints the rules from that version, with no fetch. A new choice reaches every repository as a version bump, which `craftz align` opens as a pull request in each. A repository that's behind still checks clean against its own version, so nothing breaks before it moves.

## One rule, one check, one fix

Each rule has one implementation. [The rules](rules.md) word it once, as a list item that opens with its id. [src/rules.ts](../src/rules.ts) holds its check and, where it can be automated, its fix, under the same id. A test fails if either has an id the other doesn't. `craftz check` and `craftz fix` run the rules in a repository, and the commands across repositories call the same code, with no second copy of any rule. That's the property to protect as craftz grows.

The files a rule compares with are in [reference/](../reference/README.md), laid out as a repository has them. A version, a strict option or a workflow is read from there, not written out twice, so the rules can't disagree with the example.

craftz owns a repository's conventions and its lifecycle commands. Vite+ and each framework keep their own build and compiler behaviour, and craftz connects them without redoing it.

## The commands

| Command | Does |
| --- | --- |
| `craftz rules [id]` | prints the rules, or one rule, from the installed version |
| `craftz check` | runs every rule in the repository, in its own `verify` |
| `craftz fix` | writes every fix that can be automated |
| `craftz settings` | writes the GitHub and Cloudflare settings, with your login |
| `craftz pr`, `craftz gone` | open a pull request that merges itself, and delete merged branches |
| `craftz deploy` | deploys the way the repository's deploy axis says, run by the `ship` script |
| `craftz release` | opens the pull request that releases a package |
| `craftz new` | starts a repository that already follows the rules |
| `craftz drift` | reports every repository's craftz version, checks and settings |
| `craftz align` | moves each repository that's behind to the latest craftz, in a pull request |
| `craftz()` | a Vite plugin that sets `fmt`, `lint` and a site's config for what it deploys |

`ship` stays the deploy verb, as the `ship` script, so the command and the script don't share a name. pnpm runs a script before a command of the same name, so a command called `ship` would run the deploy.

## Axes

A repository isn't one type. It's four independent axes, as [the rules](rules.md#axes) define them: what it publishes, what it deploys, who the site is for, and who can see the code. Each is read from where it already lives, never declared, and `craftz()` and `craftz deploy` act on them.

| Axis | Read from | Gets |
| --- | --- | --- |
| publish: package | not `private` | `vp pack`, the release workflow, a release-notes label |
| deploy: static | a Worker config with no code of its own | Cloudflare's plugin with `assetsOnly`, `cf deploy --prebuilt` |
| deploy: app | a Worker config with an `entrypoint` or `main` | the adapter, `wrangler types`, and wrangler's deploy while it's held |
| audience: internal | an Access application on the site's domain | its other addresses off, and Access's policy checked |
| repository: private | GitHub | no `LICENSE`, and no place in `REPOS` |

A static site's files can come from anywhere, like `.prose` as `publicDir` or Vite's own pages, and nothing about the deploy changes. The axes don't overlap, so there's nothing to choose between. The deploy axis is the one that could, and the Worker config settles it, since code to run makes it an app. So no repository ever writes its type down.

Some pairs meet badly, and they're allowed, with what's lost said where it applies, rather than a rule forbidding them. A package in a private repository can't have npm's provenance, and `new` says so. A private repository's rulesets may need a paid GitHub plan.

When cf can deploy SvelteKit, only `craftz deploy` changes, and the app needs no change of its own.

## A thin plugin

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

Each repository pins craftz exactly, so an install never moves it, and moving it is a pull request. A release's label says what that pull request asks of a repository.

- **Patch:** nothing changes for a repository. The rules' wording changes, or a check gets a fix, and a repository that passed still passes.
- **Minor:** `craftz fix` makes the change on its own, like a new line in a managed file or a new rule with a fix.
- **Breaking:** a repository needs a change by hand, or the release changes how a repository deploys or what its GitHub or Cloudflare settings are. Those two are breaking even when `craftz fix` could make them, so they're always read before they land.

While craftz is below 1.0, a minor release plays the breaking release's part, as it does for markz and prose.

Every change to the rules is a release, with its 2FA approval. craftz's site shows the latest, and the installed version is what binds a repository. Small changes wait and go out together.

A repository is checked against the version it installs, never craftz's latest. Checking against the latest would fail a pull request that passed `verify` on a laptop. `craftz check` notes a newer release without failing, and moving to it is the repository's own pull request.

## Versions come with craftz

Each craftz release carries the versions of the tools it was tested with, like Vite+, TypeScript, prose and markz, in [the reference](../reference/package.json). `craftz fix` writes them into the repository, so bumping craftz is the one change that moves the rest. A tool's new major is a breaking craftz release.

## Every repository at once

`craftz check` runs only when a repository opens a pull request. A repository nobody is working on can fall behind, and CI can't read GitHub's or Cloudflare's settings without a login. So two sweeps run on the laptop, never in the cloud.

- `craftz drift` reports each repository's craftz version and runs `craftz settings --check`.
- `craftz align` bumps craftz in each repository that's behind, runs `craftz fix` and opens a pull request.

`craftz align` works in a fresh clone of each `main`, never a checkout. Each repository has one branch named `align`, which a later run updates, so running it again never opens a second pull request. It opens a pull request only when `verify` passes, and one that fails leaves its clone and log. It ends with a report, with each repository opened, updated, already in line or failed. Bumping, fixing and opening the pull request are separate steps, each one runnable alone.

It runs from anywhere, like `pnpm dlx @amitkaps/craftz align` in any folder. In each clone it bumps craftz first, then runs the new version's `craftz fix`, so the rules that apply are the ones the repository moves to. It only moves a repository to a released craftz, so a change in this repository reaches nobody until it's released.

The sweeps hold no rules of their own. They find the repositories by looking for the ones that depend on `@amitkaps/craftz`, so a new repository joins when it installs craftz, and `REPOS` goes.

## The dashboard

A dashboard shows every repository without running anything. It only observes, and holds no policy of its own. It shows one row each, with its type, its craftz version and whether that's behind, its CI on `main`, its site and its npm release. Green CI means the repository passes `craftz check` at the version it installs. Settings stay out, since reading them needs a login a site's build doesn't have.

## No cycle

prose depends on craftz, and craftz's site depends on prose. Both are devDependencies, like markz and prose. craftz's package depends on neither, and takes Cloudflare's plugin and Vite+ as peers. A fresh checkout builds from released versions, which a clean clone and install must prove. craftz's first version is published by hand, as every package's is.

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
