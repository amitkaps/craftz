# craftz

One way to build, check, deploy and release a repository, as a package each one depends on.

Every repository makes the same choices, like its toolchain, versions, workflows, branch protection and deploys. Made in each one separately, they drift. craftz holds them as rules, checks a repository against the version it installs, and fixes what it can. Moving every repository to a new choice is then a version bump, not a copy into each one.

## What it does

| Command | Does |
| --- | --- |
| `craftz check` | checks the repository against every rule, as part of its `verify` |
| `craftz fix` | writes every fix that can be automated |
| `craftz settings` | checks and writes what lives outside the files, on GitHub and Cloudflare |
| `craftz deploy` | deploys a site the way its Worker config says |
| `craftz pr`, `craftz gone` | open a pull request that merges itself once CI passes, and delete the branches that merged |
| `craftz rules [id]` | prints the rules, or one rule, from the installed version |
| `craftz()` | a Vite plugin that sets `fmt`, `lint` and a site's config, and never overrides the repository's |

An agent reads the rules with `craftz rules`, from the version the repository installed, so it never works from a fetched page or an older copy.

It's opinionated, and built for one setup: Vite+, pnpm, Node 26, GitHub and Cloudflare Workers. A repository on that setup gets the same build, checks, pull requests, releases and deploys as every other one.

## Install

```sh
pnpm add -D @amitkaps/craftz
```

It needs Node 26 or newer, the Node it's built and tested on.

## Use

```sh
pnpm exec craftz check                 # what's out of line
pnpm exec craftz fix                   # fix what can be fixed
pnpm exec craftz rules scripts-verify  # what one rule asks, and why
```

Read [the docs](docs/README.md) for its design, [the rules](docs/rules.md), [its usage](docs/usage.md), the plan and the lessons.
