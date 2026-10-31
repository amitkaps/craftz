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

## The reference

[reference/](../reference/README.md) holds the files a rule compares with, laid out as a repository has them, like the workflows, the editor settings and the versions. A rule reads its value from there, so it's never written out twice. These files are checked by `prose check` like any other, so their links have to work where they stand.

`pnpm bump` moves the reference's versions, not craftz's own, before a release. It installs the reference in a clone as a project of its own, updates it, then runs craftz's fixes from source against it and opens craftz's pull request. The others take the new versions once they're released, from `pnpm align`. `craftz new` builds a repository from the reference and from craftz's own `LICENSE`. The reference holds `.gitignore` as `gitignore`, since npm leaves a dotted one out of a package, and a test keeps it the same as craftz's own.

## The command

[src/cli.ts](../src/cli.ts) is the `craftz` command, built by `vp pack` into `dist/cli.js`, with the rules' checks and fixes bundled in. The package publishes `dist/`, `docs/rules.md`, which `craftz rules` prints, and `reference/`, which the checks compare with. It has no dependencies, and takes Vite+ as a peer, which only `new` loads.

Two values are worked out from source, the browsers from browser-compat-data and the Workers' date from the workerd the reference's cf depends on, kept in [src/workerd.json](../src/workerd.json). `vp pack` writes them in, as [src/pinned.ts](../src/pinned.ts) says, and leaves browser-compat-data out of the bundle. `pnpm pack` and running `dist/cli.js` from the unpacked tarball shows what a user gets.

## Beta packages

The packages still on a beta are the ones [`versions-beta`](rules.md#versions-beta) names, and `package.json` has their builds. align leaves them alone, since their tags don't say which build goes with which. One is listed once npm's latest for it is a release at the beta's major or later.

A newer beta is moved by hand too. Pin it in the reference's `package.json`, after reading its `engines`. The next run from source reads the workerd it brings from npm into [src/workerd.json](../src/workerd.json), whose date is the Workers' compatibility date, so commit that with it. To move one to its release, pin the release and take it out of `versions-beta`. Then run `pnpm run verify` and a deploy from the Git-connected Worker before you rely on it.

## Playwright

[`versions-playwright`](rules.md#versions-playwright) holds `@playwright/test` to the version whose Chromium revision the Claude Code cloud image ships, so a session screenshots with no download. `pnpm bump` leaves it where it is.

To move it, start a cloud session and run `ls /opt/pw-browsers`. It lists the image's `chromium_headless_shell-<revision>`. The Playwright that wants that revision is the one to pin. `pnpm exec playwright install --dry-run chromium` in a clone names the revision a version wants. When the image's revision is behind the newest Playwright, the pin stays behind it. Pin the reference's `package.json`, and the next `pnpm align` moves each repository.
