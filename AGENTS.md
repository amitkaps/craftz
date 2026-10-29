# AGENTS.md

craftz — one way to build, check, deploy and release.

## craftz

This repository follows [craftz's rules](https://craftz.amitkaps.com/docs/rules.md). Run `pnpm craftz rules` before writing a command or a test, and before changing the toolchain, scripts, versions, CI or deploys. Change those in craftz first, never in one repository alone.

- Before starting a change, run `pnpm gone`. It switches to `main`, pulls, and deletes the branches that merged, so the change starts from what's live.
- Open a pull request with `pnpm pr "<title>"`, and add `--label <label>` in a package. It commits, runs `pnpm run verify`, pushes and turns on auto-merge, so don't run verify first. When verify fails, fix what it found and run `pnpm pr` again. Don't wait for the merge, and add `--wait` to a session's last change. Nobody pushes to `main`.
- `pnpm craftz status` says what's live. `pnpm <tool> help <command>` says what a command does, for the version installed.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs.
- A lesson in `docs/lessons.md` is for what the next change would get wrong without it, so a change that went as planned adds none. Read its group first. When a lesson there says it already, add this case to it, and give the principle a check or a rule.

## Prose

Explanations go in `@prose` comments, and every Markdown file is prose too.

- Run `pnpm prose rules` before your first edit to a `@prose` comment or a `.md` file, and again after the conversation is summarized. Changing code a `@prose` comment explains counts as an edit.
- After writing, run `pnpm prose style <files>` on the files you changed, and take its advice where it reads better.

## Outline

Every file in this repository with its summary, which `pnpm pr` and `pnpm gone` write. Run `pnpm outline` when it's missing.

@outline.md

## This repository

- A rule is worded once, in [docs/rules.md](docs/rules.md), as a list item that opens with its id. Its check and its fix are in [src/rules.ts](src/rules.ts), under the same id. `pnpm craftz rules <id>` prints one.
- [reference/](reference/) holds the files the rules compare against, laid out as a repository has them. Change a file there, not a copy of it elsewhere.
- Never name a private repository in the docs, code, commits or pull requests. This repository is public. Say "a private repository" and describe what it is instead.
