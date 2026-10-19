# Plan

craftz takes over from ship, as [ship's plan](https://ship.amitkaps.com/docs/plan.md#craftz) says. That plan holds the design and the order until ship retires, and then it moves here.

## Where it is

### Started

`pnpm new` in ship wrote this repository, so it follows [ship's standard](https://ship.amitkaps.com/docs/standard.md). ship's standard is frozen while craftz is built, and every new rule goes here.

## Next, in order

1. **One rule, one check, one fix.** Bring ship's rules and standard here, with each rule's check and fix in one place, and drift and align calling them.
2. **`fix` and `settings`.** Make them predictable, with a check that only reads and a report of what changed.
3. **`craftz()`.** A thin Vite plugin that never overrides the repository.
4. **The release cycle.** Release the first version from a clean checkout. Then `craftz new` makes a test repository that passes `verify` and deploys through `craftz deploy`.

## Later

## Open questions
