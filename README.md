# craftz

One way every repository builds, checks, deploys and releases, and the repository that shows it working.

## Install

```sh
pnpm add -D @amitkaps/craftz
```

It needs Node 26 or newer, the Node it's built and tested on.

## Use

```sh
pnpm exec craftz rules                 # every rule
pnpm exec craftz rules scripts-verify  # one rule
```

Read [the docs](docs/README.md) for its design, [the rules](docs/rules.md), the plan and the lessons.
