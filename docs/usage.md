# Usage

craftz is used through its commands. Today that's `craftz rules`, to read the rules, and `pnpm drift` in this repository, to check every repository against them. The other commands in [the design](design.md#the-commands) come as [the plan](plan.md) builds them, and this page grows with them.

## Install

```sh
pnpm add -D @amitkaps/craftz
```

It needs Node 26 or newer, the Node it's built and tested on.

## Reading the rules

```sh
pnpm exec craftz rules                 # every rule
pnpm exec craftz rules scripts-verify  # one rule, with the part it's under
```

`craftz rules` prints [the rules](rules.md) from the installed version, so a repository reads the rules it's checked against, and nothing is fetched. A finding names its rule as `see: craftz rules <id>`, so the line to run is the one printed.

## Checking every repository

In a checkout of this repository, after `pnpm install`:

```sh
pnpm drift            # every repository
pnpm drift ../markz   # a folder from disk, to check a fix before it's pushed
```

Each repository gets a line, ✓ or ✗, with what has drifted below it, and each finding names its rule. Held checks are listed with their reason and don't count. A missing login prints one `not checked:` line at the top, and the rest still runs. It exits 1 when anything has drifted.

drift only reads, so it's safe to run any time.

## Logins

The commands use the logins `gh` and `cf` already have, so there's no token to keep. drift runs without them, and reads less.

`gh auth login` logs in to GitHub, as the owner, which drift needs for the merge settings. `pnpm exec cf auth login` logs in to Cloudflare, which it needs for the Workers' build settings. When the login sees more than one account, craftz uses the one named like the GitHub owner, and `CLOUDFLARE_ACCOUNT_ID` overrides it. A `pnpm ship` by hand picks none, so set the variable there.

## For agents

What an agent working in a repository that uses craftz should know, as a snippet to copy into its instructions.

```md
Run `pnpm exec craftz rules` before changing how this repository builds, checks, deploys or releases, and `pnpm exec craftz rules <id>` for the rule a finding names. Don't change the toolchain, scripts, versions or deploys in this repository alone. They come from craftz.
```
