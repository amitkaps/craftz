# AGENTS.md

craftz — one way to build, check, deploy and release.

## craftz

This repository follows [craftz's rules](https://craftz.amitkaps.com/docs/rules.md), which set how every repository builds, checks, deploys and releases. Run `pnpm craftz rules` before changing any of that. It prints the rules for the version this repository installs, and `pnpm craftz rules <id>` prints one.

- Change the toolchain, scripts, versions or deploys in craftz first, then bring each repository in line. Don't change them in one repository alone.
- Open a pull request with `pnpm pr "<title>"`. It branches from `main`, or adds to the branch's open pull request when given its title, then commits, runs `pnpm run verify`, pushes and turns on auto-merge, and the pull request is squash-merged once CI passes. Don't wait for the merge: start the next change, and its `pnpm pr` waits only if the last hasn't merged. Add `--wait` to the last change of a session, to end on `main`. `pnpm pr` first deletes the local branches that merged, and `pnpm gone` does that alone. Nobody pushes to `main`.
- To see what's live, run `pnpm craftz status`: CI, pull requests, the release and the site. `--notes` adds the release's notes, and `--log` the build's log. Use it rather than reading GitHub, npm or Cloudflare another way.
- In a package, give it one label for the release notes, `pnpm pr "<title>" --label <label>`: `breaking`, `added`, `fixed`, `improved`, `docs`, or `internal` for tests, tooling, site and lessons. CI fails without one.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs.
- A held check is a tool's limit, not a choice. The rules give its reason, so leave it until the reason goes away.

## Prose

Explanations go in `@prose` comments. Run `pnpm prose rules` before writing prose, or changing code a `@prose` comment explains. It prints the rules for the version this repository uses, each with the codes that check it, and `pnpm prose rules <code>` says what one warning asks for. The rules live in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents) and aren't copied here, so every repository writes to the same rules.

After writing prose, run `pnpm prose style <files>` on the files you changed, and take its advice where it reads better. It always passes, so it's advice, not a check.

## This repository

- A rule is worded once, in [docs/rules.md](docs/rules.md), as a list item that opens with its id. Its check and its fix are in [src/rules.ts](src/rules.ts), under the same id. `pnpm craftz rules <id>` prints one.
- [reference/](reference/) holds the files the rules compare against, laid out as a repository has them. Change a file there, not a copy of it elsewhere.
- What a change taught goes in [docs/lessons.md](docs/lessons.md), in the same change.
- Never name a private repository in the docs, code, commits or pull requests. This repository is public. Say "a private repository" and describe what it is instead.
