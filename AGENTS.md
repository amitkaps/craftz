# AGENTS.md

craftz — one way to build, check, deploy and release.

## craftz

This repository follows [craftz's rules](https://craftz.amitkaps.com/docs/rules.md). Before writing a command or a test, or changing the toolchain, scripts, versions, CI or deploys, run `pnpm craftz rules <part>` for the part you touch. Each part prints followed by `practice`, the rules for any change. `pnpm craftz check` names each rule this repository has drifted from, by id. Rules change in craftz, so don't change one here alone. `pnpm craftz upgrade` brings a new release, and `pnpm craftz fix` writes what can be automated. Where a tool blocks a rule, add a hold in `package.json` with its reason, as `pnpm craftz rules holds` says.

Read these before writing code. `pnpm craftz rules practice` says why for each.

- **Write the spec first.** What's right is written as a grammar, a rule or a failing test before the code. Settle a disagreement by fixing the wrong side, never by loosening the check.
- **Draw the boundaries first.** Write down what's out of scope, with reasons, and the limit on each cost, like size or `verify`'s time.
- **Measure before changing.** Time each part, then change the one the measure points to.
- **Don't repeat yourself.** Write each rule, value and step once. Share code when the second copy appears, and make a repeated step a command.
- **One name, one meaning.** Each concept has one name, and a name that gains a second meaning is split.
- **Make the owner a type.** Give a value with one maker a type only that maker returns, so making it anywhere else fails to compile. Pass the whole thing before branding it.
- **Parse, don't match text.** Read a file with its language's parser, never a regular expression over its text.
- **Build only what gets used.** Make the smallest thing that gets read, and watch whether it is.
- **Try it on the real thing.** Run a change where it will run, like the real files, the packed tarball or the other tool itself.
- **Have a way to verify.** Each thing that matters has a check that runs on every change. Build the check first where none exists.
- **Silence is the failure.** A check fails where it can't be sure, and code catches only the error it expects.

The parts are `tools` (Vite+, pnpm, versions, holds), `scripts`, `cloudflare`, `github` (with CI), `releases` and `docs` (with agents). `pnpm craftz rules` prints all of them.

- craftz owns `.github/workflows/ci.yml`, `.vscode/`, `.claude/`, `pnpm-workspace.yaml` and these two sections. `pnpm craftz fix` rewrites them, so don't edit them here.
- Before starting a change, run `pnpm gone`. It switches to `main`, pulls, and deletes the branches that merged, so the change starts from what's live.
- Open a pull request with `pnpm pr "<title>"`, and in a published package add `--label <label>`, one of `breaking`, `added`, `fixed`, `improved`, `docs` or `internal`, with the title as its line in the release notes. It commits, runs `pnpm run verify`, pushes and turns on auto-merge, so don't run verify first. When verify fails, fix what it found and run `pnpm pr` again. Don't wait for the merge, and add `--wait` to a session's last change. Nobody pushes to `main`.
- `pnpm craftz status` says what's live. `pnpm craftz help <command>` says what a command does, for the version installed. So does `--help` after a command or script, as in `pnpm pr --help`. After any other script, never write the word `help`, since it reads as that script's argument.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs. To see a page you built, run `pnpm craftz shot <url> <file.png>` and read the PNG, rather than installing a browser tool.
- When a test fails once and passes on a re-run, it's flaky, and the cause is the bug. Find what the test waits on or shares, and fix that. Never re-run it, retry it or skip it to get a green run.
- A lesson in `docs/lessons.md` is for what the next change would get wrong without it, so a change that went as planned adds none. Before adding one, read the group it belongs under. If a lesson there already says it, add this case to that lesson, and give its principle a check or a rule.

## Prose

Explanations go in `@prose` comments, and every Markdown file is prose too.

- Run `pnpm prose rules` once before your first edit to a `@prose` comment or a `.md` file, and again after the conversation is summarized. A code change counts only when it changes what the comment states, so a rename or a lint fix doesn't.
- After writing prose, run `pnpm prose style <files>` on those files, and take its advice where it reads better, never just to quiet it. It's advice and never fails. `prose check` runs in `verify` and does fail, for example on a folder with no `README.md`.
- `outline.md` is the repository as a tree, each file with its `@prose` summary. `pnpm pr` and `pnpm gone` write it. Before you search for code by what it does, read the part of it for the folder you expect it in.

## This repository

- A rule is worded once, in [docs/rules.md](docs/rules.md), as a list item that opens with its id. Its check and its fix are in [src/rules/](src/rules/), under the same id. `pnpm craftz rules <id>` prints one.
- [reference/](reference/) holds the files the rules compare against, laid out as a repository has them. Change a file there, not a copy of it elsewhere.
- To release craftz, follow the steps in [docs/development.md](docs/development.md#release), in order. Don't start at `craftz release`, since the steps before it are what its notes say.
- Never name a private repository in the docs, code, commits or pull requests. This repository is public. Say "a private repository" and describe what it is instead.
