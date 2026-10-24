# Usage

craftz is used through its commands and its plugin.

Any repository has `craftz rules`, `craftz check`, `craftz fix`, `craftz upgrade`, `craftz settings`, `craftz status`, `craftz deploy`, `craftz pr`, `craftz gone`, `craftz release` and the `craftz()` plugin, and `craftz new` starts one. The last part, [Keeping every repository](#keeping-every-repository), is for whoever keeps them all, from a checkout of craftz.

## Install

```sh
pnpm add -D @amitkaps/craftz
pnpm exec craftz fix
```

It needs Node 26.12.1 or newer, the Node it's built and tested on. The first fix writes the `craftz` script, among the rest, so every command after it is `pnpm craftz <command>`, as `pnpm prose` runs prose.

## Reading the rules

```sh
pnpm craftz rules                 # every rule
pnpm craftz rules scripts-verify  # one rule, with its address
```

`craftz rules` prints [the rules](rules.md) from the installed version, so a repository reads the rules it's checked against, and nothing is fetched. Its links lead to the site, so they work outside the repository. A finding names its rule by id, so `craftz rules <id>` prints the rule it drifted from.

## Checking one repository

```sh
pnpm craftz check          # this folder
pnpm craftz check ../markz # another one, with this folder's craftz
pnpm craftz fix            # write every fix, then check again
```

`craftz check` runs every rule on the folder's files, with the installed version's rules, and prints each drift as a warning, in markz's line, like `craftz: warning: versions-markz: …`. It exits 1 when anything has drifted. It reads no settings and asks GitHub nothing, so it needs no login. A rule the repository [holds](rules.md#holds) prints its warning with `; held:` and its reason, and doesn't fail. A note says what's worth knowing, like a newer craftz, and never fails. It asks npm, and with no answer in a few seconds, there's no note.

`craftz fix` writes every fix that can be automated. It lists each file it changed, then checks again and prints what's left to do by hand. A second run changes nothing. A fix can move versions, so run `pnpm install` next, then `pnpm run fix` for the format.

## The plugin

```ts
import { craftz } from "@amitkaps/craftz";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [craftz()],
});
```

`craftz()` sets the `fmt` and `lint` blocks the rules ask for, so `vite.config.ts` holds only what's the repository's own. It never overrides the config. A key the config leaves unset is filled in, and one it sets differently fails `vp` with the key named, so take that key out. `pnpm craftz rules toolchain-lint` and `toolchain-wrap` say what it sets.

A static site, read from its Worker config, also gets `build.target`, the rules' browsers.

## A site's Worker

```ts
import { site } from "@amitkaps/craftz/cloudflare";

export default site({
  name: "prose",
  domains: ["prose.amitkaps.com"],
  assets: { directory: ".prose" },
});
```

A static site's `cloudflare.config.ts` names its Worker, its domains and the folder it serves, as `assets.directory`: `.prose` for a prose site, and `dist` for one with an `index.html`, which Vite builds. `site()` adds the compatibility date and turns `workers.dev` and preview URLs off. A site installs nothing from Cloudflare, since `craftz deploy` uploads the folder itself.

## Moving to a new craftz

```sh
pnpm craftz upgrade
```

A new craftz brings its rules, and the versions of the tools it was tested with. `craftz upgrade` adds the latest craftz on npm, exactly, and runs that version's `craftz fix`, which writes what changed. Then it installs, writes the format, and checks again, printing what's left by hand. It exits 1 when anything is. Each release's [notes](https://github.com/amitkaps/craftz/releases) say what a repository has to change when it moves. Open the result as its own pull request, which runs `verify` with the new version.

## Deploying a site

```sh
pnpm craftz deploy
```

`craftz deploy` deploys the site the folder has built, and a site's `ship` script runs it, which is the Worker's deploy command. For a `cloudflare.config.ts`, it uploads the folder the config names, sending only the files Cloudflare doesn't have, then writes the Worker's domains and turns its other addresses off. It needs `CLOUDFLARE_API_TOKEN`, which Workers Builds sets, and `CLOUDFLARE_ACCOUNT_ID` where the token reaches more than one account. A `wrangler.toml` runs `wrangler deploy`, which an app is on.

## Pull requests

```sh
pnpm pr "<title>" --label added   # commit, verify, push, and merge once CI passes
pnpm pr "<title>" --wait          # and wait for the merge, then switch to main
pnpm gone                         # delete the branches that merged
```

A repository's `pr` and `gone` scripts run `craftz pr` and `craftz gone`, and every change reaches `main` this way. A package's pull request takes one label for the release notes, and stops without one before anything is committed. A site or a tool takes none. Without `--wait`, start the next change while CI runs, and run `pr` again with its title. If the last pull request hasn't merged yet, `pr` waits for it, then starts the new one from `main`. End a session with `--wait`. `pr` first deletes the local branches that merged. A branch merged when its branch on GitHub is gone, when its last commit is a merged pull request's, or when it's on `main`.

## Releasing a package

```sh
pnpm craftz release 0.5.0 --notes "What this release is about."
```

`craftz release` opens the `v0.5.0` pull request for the package the folder's `origin` names, with `version` set and auto-merge on. It works on GitHub, so it releases what's on `main`, whatever the folder has changed. Without `--notes` it opens your editor for the summary. Once it merges, approve the staged version on npmjs.com. It needs `gh` logged in.

## Writing the settings

```sh
pnpm craftz settings --check  # read them, and write nothing
pnpm craftz settings          # write what has drifted, then read it back
```

`craftz settings` writes what the rules set outside the files, for the repository the folder's `origin` names. That's the merge settings, the `main` ruleset and a package's labels on GitHub, and a site's Worker build settings on Cloudflare. It writes only what has drifted, then reads it back, and lists each setting as `fixed`, `still off`, `failed` or `left`. It exits 1 unless everything is fixed. Running it again finishes what a failed run left.

It needs `gh` logged in as the owner, and `cf` for a site's Worker. Classic branch protection on `main` isn't craftz's, so it asks before removing it. Where there's no one to ask, like in a script, `--yes` removes it.

## What's live

```sh
pnpm craftz status          # CI, pull requests, npm, the release, and the site's build, addresses and audience
pnpm craftz status --notes  # and the latest release's notes
pnpm craftz status --log    # and the latest build's log
```

`craftz status` reads what the repository has out in the world, where `check` reads its files and `settings` its setup. It lists the latest run on `main` of each workflow, the open pull requests, and for a package the version npm serves next to the one in `package.json`, and its latest release on GitHub. The summary that opens the release's notes prints after the lines. For a site, it lists the Worker's latest build, with its outcome, commit and deploy command, whether the domain answers and `workers.dev` doesn't, and whether the site is public or internal, behind Access. Each line is marked `✓` or `✗`, and it exits 1 when any is `✗`. A run or build still going isn't a failure, and neither is a version waiting to be released.

Use it after a merge or a release, to see that CI, the deploy and npm went through. `--notes` prints the release's notes in full. `--log` prints the build's log, which is where a failed deploy says why. It needs `gh` logged in, and cf logged in for a site. A site with no cf of its own, like an app on wrangler, has its builds read by the reference's cf, which pnpm fetches.

## Starting a repository

```sh
pnpm dlx @amitkaps/craftz new example --package --description "What it is, in a sentence."
pnpm dlx @amitkaps/craftz new example --site static --internal --description "…" --push
```

`--package` publishes it to npm, and `--site static` deploys a static site on Cloudflare. Either, both or neither, which is scripts run on a laptop. An app starts from base. `--private` makes the GitHub repository private, and `--internal` puts a site behind Cloudflare Access. [The axes](rules.md#axes) say what each means. new writes `./example` in the folder it's run from, installs, runs `verify` and makes the first commit. `--push` also creates the repository on GitHub and writes its settings. It ends with a list of what's left by hand, like connecting the Worker. It needs nothing installed but Node and pnpm.

## Logins

The commands use the logins `gh` and `cf` already have, so there's no token to keep. `check`, `fix` and `rules` need neither. `settings`, `status`, `pr` and `new --push` need `gh`, and a site's settings and status need `cf`.

`gh auth login` logs in to GitHub, as the owner. `pnpm exec cf auth login` logs in to Cloudflare, for the Workers' build settings. When the login sees more than one account, craftz uses the one named like the GitHub owner, and `CLOUDFLARE_ACCOUNT_ID` overrides it. A `pnpm ship` by hand picks none, so set the variable there.

## Keeping every repository

These are scripts in a checkout of craftz, not commands of the package, after `pnpm install`. They're for whoever keeps the repositories, and a repository needs none of them to follow the rules. align and bump need `gh`, and align writes the Worker settings only with `cf`.

### Aligning every repository

```sh
pnpm align                 # every repository, to the latest craftz
pnpm align markz           # one repository, to the latest craftz
pnpm align markz --local   # the same, but nothing leaves the laptop, and settings are only read
pnpm align --candidate     # every repository, to this checkout, packed, before it's released
```

align clones each repository's `main` into a temporary folder and installs it, runs `craftz upgrade`'s steps, writes the lockfile afresh, then runs `verify`. A fresh lockfile drops what nothing installs any more, and moves the nested packages within pnpm's wait, as the tools move. It opens a pull request with auto-merge on, writes the GitHub and Worker settings, and waits for the merges. Each step runs for every repository before the next starts, and prints a dot to stderr as each one ends it, or `✗` for one that fails. A report follows. It gives each step's time for each repository, and each version that moved and where. Then it lists what's left by hand or failed. Then each merge prints a dot as it lands. A repository whose files and lockfile are already in line gets no pull request, and a failed one keeps its clone and log for a look. Run it after each release.

`--local` stops before the push, so a clone can be read or compared with another run. It reads each repository's settings and lists what has drifted, without writing them.

A step that fails on what's left to do by hand, `fix` or `verify`, doesn't stop the run, so one run lists everything: craftz check's findings and the count of lint and type errors, for each repository.

`--candidate` packs this checkout and moves every repository to it, locally, before a release. What each one leaves by hand is what the release's notes say to do. Run it before `craftz release`.

### Moving the reference

```sh
pnpm bump
```

The reference pins the versions every repository uses, like Vite+, TypeScript and wrangler, so they move only when craftz's reference does. bump moves it to the newest versions pnpm's one-day wait allows, runs craftz's fixes from source against them, and opens craftz's pull request. Run it before a release, so the release carries them, then `pnpm align` takes them to the others.

## For agents

What an agent working in a repository that uses craftz should know, as a snippet to copy into its instructions.

```md
Run `pnpm craftz rules` before changing how this repository builds, checks, deploys or releases, and `pnpm craftz rules <id>` for the rule a finding names. Don't change the toolchain, scripts, versions or deploys in this repository alone. They come from craftz.
```
