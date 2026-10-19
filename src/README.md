# Source

The code that checks every repository against [the rules](../docs/rules.md). [rules.ts](rules.ts) holds each rule's check and fix together, and [stated.ts](stated.ts) reads where the doc states each one. [survey.ts](survey.ts) reads each repository and runs the rules, and [drift.ts](drift.ts) prints what it found.

[cli.ts](cli.ts) is the `craftz` command, and [pinned.ts](pinned.ts) holds what it fixes when it's packed. [align.ts](align.ts) runs the fixes in a pull request for each repository, [new.ts](new.ts) starts one, and [release.ts](release.ts) releases a package. [settings.ts](settings.ts) reads the settings that live on GitHub and Cloudflare, and [reference.ts](reference.ts) reads [the reference](../reference/).

[cli.ts](cli.ts) is the `craftz` command. [index.ts](index.ts) is the package's entry, still a placeholder.
