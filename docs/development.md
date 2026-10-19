# Development

How craftz is built and changed. What every repository shares, like the scripts, CI and releases, is in [the rules](rules.md), and isn't repeated here.

## Build and test

```sh
pnpm install
pnpm dev
pnpm verify    # what CI runs
```

`pnpm craftz rules` runs the command from `src/`, with no build, and `pnpm drift` runs the sweep the same way. pnpm runs a script before a command of the same name, so inside this repository `pnpm craftz` is always the source, never an installed copy.

## Changing the rules

A change to how things are done starts here, in [the rules](rules.md) and in [the reference](../reference/README.md). When it can be checked, it's also a rule. That's a list item in the rules that opens with its id as a span, like ``- [`scripts-verify`]{#scripts-verify}: …``, and a check under the same id in [src/rules.ts](../src/rules.ts), with a fix when one can be automated. [rules.test.ts](../tests/rules.test.ts) fails if either has an id the other doesn't.

`pnpm drift` then lists the repositories to bring in line. What the change taught goes in [the lessons](lessons.md), in the same pull request.

## The reference

[reference/](../reference/README.md) holds the files a rule compares with, laid out as a repository has them, like the workflows, the editor settings and the catalog. A rule reads its value from there, so it's never written out twice. These files are checked by `prose check` like any other, so their links have to work where they stand.

Some of them still name ship, since every repository has them word for word and ship's copies are what they're checked against. They change when the repositories move to craftz.

## The command

[src/cli.ts](../src/cli.ts) is the `craftz` command, built by `vp pack` into `dist/cli.js`. It reads the rules with [src/stated.ts](../src/stated.ts), which stays apart from the checks so the command doesn't bundle them. The package publishes `dist/` and `docs/rules.md`, since `craftz rules` prints that file.

## Beta packages

The packages still on a beta are the ones [`versions-beta`](rules.md#versions-beta) names, and `package.json` has their builds. Sweeps leave them alone, since their tags don't say which build goes with which. One is listed once npm's latest for it is a release at the beta's major or later.

To move one, pin the release in `package.json` and take it out of `versions-beta`. Then run `pnpm run verify` and a deploy from the Git-connected Worker before you rely on it.
