# Reference

The files every repository is compared with, laid out as a repository has them. Each rule's check in [src/rules.ts](../src/rules.ts) reads them, and its fix copies from them, so there's one copy of each. [The rules](../docs/rules.md) say why each one is there.

The root holds what every repository has, like the editor settings, CI and the shared sections of `AGENTS.md`. `pnpm pr` and `pnpm gone` run craftz's own [scripts/](../scripts/README.md), which aren't copied here. [package/](package/) holds what only a package adds. `package.json` and `pnpm-workspace.yaml` name the versions every repository is held to.

Some of these files still point at ship, since every repository has them word for word. They change when the repositories move to craftz.
