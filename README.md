# craftz

One way to build, check, deploy and release a repository, as a package each one depends on.

Every repository makes the same choices, like its toolchain, versions, workflows, branch protection and deploys. Made in each one separately, they drift. craftz holds them as rules, checks a repository against the version it installs, and fixes what it can. Moving every repository to a new choice is then a version bump, not a copy into each one.

## What it does

| Command | Does |
| --- | --- |
| [`craftz check`](docs/usage.md#check) | checks the repository against every rule, as part of its `verify` |
| [`craftz fix`](docs/usage.md#fix) | writes every fix that can be automated |
| [`craftz upgrade`](docs/usage.md#upgrade) | moves the repository to the latest craftz, and runs its fix |
| [`craftz settings`](docs/usage.md#settings) | checks and writes what lives outside the files, on GitHub and Cloudflare |
| [`craftz status`](docs/usage.md#status) | reads what's live: CI, pull requests, npm, and a site's latest build and addresses |
| [`craftz deploy`](docs/usage.md#deploy) | deploys a site the way its Worker config says |
| [`craftz pr`](docs/usage.md#pr) | opens a pull request that merges itself once CI passes |
| [`craftz gone`](docs/usage.md#gone) | deletes the local branches that merged |
| [`craftz release`](docs/usage.md#release) | opens the pull request that releases a package |
| [`craftz deps`](docs/usage.md#deps) | says what the install holds, and which dependency brings it |
| [`craftz rules`](docs/usage.md#rules) | prints the rules, or one rule, from the installed version |
| [`craftz help`](docs/usage.md#help) | lists the commands, or prints what one does |
| [`craftz new`](docs/usage.md#new) | starts a repository that already follows the rules |

An agent reads the rules with `craftz rules`, from the version the repository installed, so it never works from a fetched page or an older copy.

It's opinionated, and built for one setup: Vite+, pnpm, Node 26, GitHub and Cloudflare Workers. A repository on that setup gets the same build, checks, pull requests, releases and deploys as every other one.

## Install

```sh
pnpm add -D @amitkaps/craftz
pnpm exec craftz fix
```

The first fix writes the `craftz`, `pr` and `gone` scripts, and the rest of what can be fixed. From then on, `pnpm craftz` runs it.

It needs Node 26.12.1 or newer, the Node it's built and tested on.

## Use

```sh
pnpm craftz check                 # what's out of line
pnpm craftz fix                   # fix what can be fixed
pnpm craftz rules scripts-verify  # what one rule asks, and why
```

To start a repository instead, run `pnpm dlx @amitkaps/craftz new`. To move to a new craftz, add it again at `@latest` and run `pnpm craftz fix`, as [its usage](docs/usage.md#moving-to-a-new-craftz) says.

Read [the docs](docs/README.md) for its design, [the rules](docs/rules.md), [its usage](docs/usage.md), the plan and the lessons.
