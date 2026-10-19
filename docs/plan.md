# Plan

craftz takes over from ship, as [ship's plan](https://ship.amitkaps.com/docs/plan.md#craftz) says. That plan holds the design and the order until ship retires, and then it moves here.

## Where it is

### Started

`pnpm new` in ship wrote this repository, so it follows [ship's standard](https://ship.amitkaps.com/docs/standard.md). ship's standard is frozen while craftz is built, and every new rule goes here.

### The rules and drift

ship's rules, survey and settings are in [src/](../src/), and the files they compare against are in [standard/](../standard/). `pnpm drift` prints what ship's prints, on every repository and on a clone made to drift.

## Next, in order

1. **One rule, one check, one fix.** Bring align and new from ship, so they call the same rules as drift. Then a `craftz` command runs `check`, `fix` and `standard [id]`, reading [standard/](../standard/) from the installed package.
2. **`fix` and `settings`.** Make them predictable, with a check that only reads and a report of what changed.
3. **`craftz()`.** A thin Vite plugin that never overrides the repository.
4. **The release cycle.** Release the first version from a clean checkout. Then `craftz new` makes a test repository that passes `verify` and deploys through `craftz deploy`.

## Later

## Open questions
