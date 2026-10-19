# AGENTS.md

craftz: One way every repository builds, checks, deploys and releases, and the repository that shows it working.

## Standard

This repository follows the standard at [ship](https://ship.amitkaps.com), which sets how every repository builds, checks and deploys. Read [the standard](https://ship.amitkaps.com/docs/standard.md) before changing any of that.

- Change the toolchain, scripts, versions or deploys in ship first, then bring each repository in line. Don't change them in one repository alone.
- Open a pull request with `pnpm pr "<title>"`. It branches from `main`, commits, runs `pnpm run verify`, pushes and turns on auto-merge, and the pull request is squash-merged once CI passes. Nobody pushes to `main`. After a merge, `pnpm gone` deletes the merged branches.
- In a package, give it one label for the release notes, `pnpm pr "<title>" --label <label>`: `breaking`, `added`, `fixed`, `improved`, `docs`, or `internal` for tests, tooling, site and lessons. CI fails without one.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs.
- A held check on ship's page is a tool's limit, not a choice. Leave it until its reason goes away.

## Prose

Explanations go in `@prose` comments. Run `pnpm prose rules` before writing prose. It prints the rules for the version this repository uses, each with the codes that check it, and `pnpm prose rules <code>` says what one warning asks for. The rules live in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents) and aren't copied here, so every repository writes to the same rules.

After writing prose, run `pnpm prose style <files>` on the files you changed, and take its advice where it reads better. It always passes, so it's advice, not a check.

## This repository

- craftz holds the standard now, and ship's is frozen. A new rule or a change to one is made here, in [standard/](standard/) and its check and fix in [src/rules.ts](src/rules.ts).
- [standard/](standard/) is what the rules compare against, laid out as each repository has its files. Change a file there, not a copy of it elsewhere.
- What a change taught goes in [docs/lessons.md](docs/lessons.md), in the same change.
- Never name a private repository in the docs, code, commits or pull requests. This repository is public. Say "a private repository" and describe what it is instead.
