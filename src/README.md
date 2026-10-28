# Source

The code that checks every repository against [the rules](../docs/rules.md). [rules.ts](rules.ts) holds each rule's check and fix together, and [stated.ts](stated.ts) reads where the doc states each one. [survey.ts](survey.ts) runs the rules on a folder, and lists the repositories `pnpm align` moves. [config.ts](config.ts) parses the configs the rules read, and [edit.ts](edit.ts) writes to them.

[cli.ts](cli.ts) is the `craftz` command, and [pinned.ts](pinned.ts) holds what it fixes when it's packed. [align.ts](align.ts) runs the fixes in a pull request for each repository, and [report.ts](report.ts) says what its run did, [new.ts](new.ts) starts one, and [release.ts](release.ts) opens a package's release. [deps.ts](deps.ts) says what a repository's install holds. [settings.ts](settings.ts) reads and writes the settings that live on GitHub and Cloudflare, and [apply.ts](apply.ts) writes the drifted ones and reads them back. [reference.ts](reference.ts) reads [the reference](../reference/).

[cloudflare.ts](cloudflare.ts) is `site()`, which a static site's `cloudflare.config.ts` imports, and the package's one entry besides the command.
