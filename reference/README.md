# Reference

The files every repository is compared with, laid out as a repository has them. Each rule's check in [src/rules.ts](../src/rules.ts) reads them, and its fix copies from them, so there's one copy of each. [The rules](../docs/rules.md) say why each one is there.

The root holds what every repository has, like the editor settings, CI and the shared sections of `AGENTS.md`. [package/](package/) holds what only a package adds. `package.json` and `pnpm-workspace.yaml` name the versions every repository is held to. `package.json` holds only what the rules and `craftz new` read: the shared tools, the engines and the shared scripts.
