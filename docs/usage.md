# Usage

craftz is used through its commands and its plugin.

Any repository has `craftz rules`, `craftz check`, `craftz fix`, `craftz settings`, `craftz deploy` and the `craftz()` plugin. This repository adds four scripts: `pnpm drift` checks every repository, `pnpm align` brings them in line, `pnpm new` starts one and `pnpm release` releases a package. The other commands in [the design](design.md#the-commands) come as [the plan](plan.md) builds them, and this page grows with them.

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

## Checking one repository

```sh
pnpm exec craftz check          # this folder
pnpm exec craftz check ../markz # another one
pnpm exec craftz fix            # write every fix, then check again
```

`craftz check` runs every rule on the folder's files, with the installed version's rules, and prints what has drifted, each with its `see:` line. It exits 1 when anything has. It reads no settings, so it needs no login. It only asks GitHub whether the repository is private, under the folder's name.

`craftz fix` writes every fix that can be automated, the same ones `pnpm align` runs. It lists each file it changed, then checks again and prints what's left to do by hand. A second run changes nothing. A fix can move versions, so run `pnpm install` next, then `pnpm run fix` for the format.

## The plugin

```ts
import { craftz } from "@amitkaps/craftz";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [craftz()],
});
```

`craftz()` sets the `fmt` and `lint` blocks the rules ask for, so `vite.config.ts` holds only what's the repository's own. It never overrides the config. A key the config leaves unset is filled in, and one it sets differently fails `vp` with the key named, so take that key out.

A static site gets its config too, read from its Worker config. With an `index.html`, `build.target` is the rules' browsers. Without one, the site is the folder `prose build` writes, and `publicDir` is `.prose`. The Cloudflare plugin stays in the config, since it's the repository's own dependency.

```ts
import { cloudflare } from "@cloudflare/vite-plugin";
import { craftz } from "@amitkaps/craftz";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [craftz(), cloudflare({ assetsOnly: true })],
});
```

## Deploying a site

```sh
pnpm exec craftz deploy
```

`craftz deploy` deploys the site the folder has built, and a site's `ship` script runs it, which is the Worker's deploy command. A static site uploads its Build Output with `cf deploy --prebuilt`. An app runs `wrangler deploy`, until cf can deploy one. To see what would go up without uploading it, run `pnpm exec cf deploy --prebuilt --dry-run` after the build.

## Writing the settings

```sh
pnpm exec craftz settings --check  # read them, and write nothing
pnpm exec craftz settings          # write what has drifted, then read it back
```

`craftz settings` writes what the rules set outside the files, for the repository the folder's `origin` names. That's the merge settings, the `main` ruleset and a package's labels on GitHub, and a site's Worker build settings on Cloudflare. It writes only what has drifted, then reads it back, and lists each setting as `fixed`, `still off`, `failed` or `left`. It exits 1 unless everything is fixed. Running it again finishes what a failed run left.

It needs `gh` logged in as the owner, and `cf` for a site's Worker. Classic branch protection on `main` isn't craftz's, so it asks before removing it. Where there's no one to ask, like in a script, `--yes` removes it.

## Checking every repository

In a checkout of this repository, after `pnpm install`:

```sh
pnpm drift            # every repository
pnpm drift ../markz   # a folder from disk, to check a fix before it's pushed
```

Each repository gets a line, ✓ or ✗, with what has drifted below it, and each finding names its rule. Held checks are listed with their reason and don't count. A missing login prints one `not checked:` line at the top, and the rest still runs. It exits 1 when anything has drifted.

drift only reads, so it's safe to run any time.

## Aligning every repository

```sh
pnpm align                 # craftz first, then every repository
pnpm align markz           # one repository, against this checkout's reference
pnpm align markz --local   # the same, but nothing leaves the laptop
```

align clones each repository's `main` into a temporary folder, runs every fix, installs and runs `verify`. It opens a pull request with auto-merge on, writes the GitHub and Worker settings, and waits for the merges. When craftz is in the run, it goes first and moves [the reference](../reference/README.md) to the newest versions, so the others take them in the same run. A repository already in line gets no pull request, and a failed one keeps its clone and log for a look.

`--local` stops before the push, so a clone can be read or compared with another run. It writes no settings either.

## Starting a repository

```sh
pnpm new example --package --description "What it is, in a sentence."
pnpm new example --site static --internal --description "…" --push
```

`--package` publishes it to npm, and `--site static` deploys a static site on Cloudflare. Either, both or neither, which is scripts run on a laptop. An app starts from base. `--private` makes the GitHub repository private, and `--internal` puts a site behind Cloudflare Access. [The axes](rules.md#axes) say what each means. new writes `./example` in the folder it's run from, installs, runs `verify` and makes the first commit. `--push` also creates the repository on GitHub and writes its settings. It ends with a list of what's left by hand, like connecting the Worker.

## Releasing a package

```sh
pnpm release sitez 0.5.0 --notes "What this release is about."
```

release opens the `v0.5.0` pull request on GitHub, with `version` set and auto-merge on, so no checkout is needed. Without `--notes` it opens your editor for the summary. Once it merges, approve the staged version on npmjs.com.

## Logins

The commands use the logins `gh` and `cf` already have, so there's no token to keep. drift runs without them, and reads less. align, release and `new --push` need `gh`, and align writes the Worker settings only with `cf`.

`gh auth login` logs in to GitHub, as the owner, which drift needs for the merge settings. `pnpm exec cf auth login` logs in to Cloudflare, which it needs for the Workers' build settings. When the login sees more than one account, craftz uses the one named like the GitHub owner, and `CLOUDFLARE_ACCOUNT_ID` overrides it. A `pnpm ship` by hand picks none, so set the variable there.

## For agents

What an agent working in a repository that uses craftz should know, as a snippet to copy into its instructions.

```md
Run `pnpm exec craftz rules` before changing how this repository builds, checks, deploys or releases, and `pnpm exec craftz rules <id>` for the rule a finding names. Don't change the toolchain, scripts, versions or deploys in this repository alone. They come from craftz.
```
