# Source

The code that checks every repository against [the standard](../standard/). [rules.ts](rules.ts) holds each rule's check and fix together, [survey.ts](survey.ts) reads each repository and runs them, and [drift.ts](drift.ts) prints what it found. [settings.ts](settings.ts) reads the settings that live on GitHub and Cloudflare, and [reference.ts](reference.ts) reads the standard's own files.

[index.ts](index.ts) is the package's entry, still a placeholder until the `craftz` command takes over.
