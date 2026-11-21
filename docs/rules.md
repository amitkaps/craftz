# Rules

How every repository builds, checks, deploys and releases, and the practice its code follows. Each rule is an instruction with its reason. `craftz check` names each rule a repository has drifted from by its id, and `craftz rules <id>` prints that rule.

- **Yours.** Your code, your own libraries, and your own scripts, lint rules, workflows and docs. Each part ends by saying what's yours in it.
- **craftz's.** Whatever a rule names. A rule changes in craftz, never in one repository, so every repository moves together. `craftz fix` writes what can be automated.
- **When a tool blocks a rule,** hold it in `package.json` with the reason, as [Holds](#holds-exceptions) says.

Where a version appears here, the real value is in [the reference](../reference/README.md), and `craftz check` reads it from there.

## Practice

How a repository's code is written, from what its lessons taught. Each principle here was learned in more than one repository before it was written down. There are eleven, for three moments of a change: before the code, while writing it, and after it runs.

A repository's `lessons.md` groups each lesson under the principle it shows, and links it here, so the next lesson of the same kind shows the principle needs a check. A principle with a check has an id under it, and the rest are for an agent to read before writing code.

### Before

What's right, where it stops, and where the cost is now, each settled before the code that changes it.

#### Write the spec first

Code written before what it should do was judged by what it happened to do. So what's right is written first, as a grammar, a rule, a command in usage or a test that fails. The code then meets it, and a test holds the two together. The spec can be wrong too. A disagreement is settled by naming the rule that decides it, and fixing whichever side is wrong, never by loosening the check.

#### Draw the boundaries first

What a thing wasn't going to do was decided late, by whatever got built first. So before the code, write down where it stops. That's what's out of scope, and the limit on each cost a reader or a run pays, like a package's size or `verify`'s time. A ruled-out idea is written down with its reason, so it isn't built again. A limit is measured in every pull request, and over it, the code gets smaller, or the lessons say why it stays over.

#### Measure before changing

A guess at what's slow, big or needed was wrong more often than not. So time each part before changing one, and change the part the measure points to. Timing needs a warm engine, the best of several runs and inputs big enough to measure, since one run on a busy machine can differ by a third.

### During

How the code is written, so it stays one thing and does only what's needed.

#### Don't repeat yourself

A rule, a value, a piece of work or a step done in two places drifts in one, or gets skipped in one. So each is written once, in text, in code and in what's run. craftz is this principle across repositories.

- **In docs,** the rest link to it. A rule or a command that code acts on is a list item with an id, read with markz's reader.
- **In code,** the second place that does the same work calls the first, like making a temporary folder or running a rule. Share it when the second copy appears, not before.
- **In what's run,** a script an agent writes again, or a step a doc asks for, becomes a command in the repository. It goes into the command that's already run at that moment, like `pr` running `gone` and `verify`, since a step nobody is made to notice gets skipped. A command prints what agents would otherwise work out from its output, and never waits on input an agent can't give.

Where it can, a test holds the one place to its users, as craftz's rules, prose's codes and pagez's errors are held by id.

#### One name, one meaning

A name, a flag or a type that meant two things broke on the case where they differed, and two names for one thing read as two things. So each concept has one name, in code and in docs alike, and each name means one concept. Name a thing for what it does, not where it began, so an error, a warning code or a flag reads right without its docs. When a name starts to mean a second thing, split it, rather than teaching its readers the cases.

#### Make the owner a type

A value that two functions could make drifted, and a rule that named its owner caught the copy only after it was written. So where a value has one maker, give it a type that only that maker returns. A `Time` that only `toTime` returns turns a stray `new Date(x)` into a compile error. A literal union or a discriminated union does the same for a fixed set of kinds, at no cost when the code runs.

- **Pass the whole thing before branding it.** A function that took a field's name lost the field's label, so a chart's title and reasons dropped it. Taking the field itself fixed that in a private application, with no brand.
- **A brand fits a value that isn't text.** Names that arrive as spec text can't be branded, so each gets one constant and a rule.
- **A brand holds while the maker has the only cast.** `as Time` passes it, so another `as Time` in the code is a bug, and `no-unsafe-type-assertion` finds the rest. No lint rule yet allows an assertion only inside the function that returns the brand.
- **Parse once where data comes in.** What storage, a URL or an upload hands over goes through a schema that returns the branded type, and the code after it trusts the type. Whether the schema is ArkType or Zod is a repository's choice.
- **Ban an import in the lint.** A repository sets `no-restricted-imports` in its own `lint.rules`, with a message, rather than a test that reads source.

#### Parse, don't match text

A regular expression over a config, a doc or code read keys from comments and missed what was laid out another way. So a file is read with the parser for its language, like oxc for code and config, and markz for Markdown, and a value is found by where it sits. Read only what's written as a literal, and treat the rest as unknown.

#### Build only what gets used

The first views, plugins and channels were most of the work, and few were opened. So build the smallest thing that gets read, and watch whether it is. Weigh a tool by what a repository runs of it, not by what it's for. Improve what every agent already reads, `AGENTS.md`, before adding a channel.

### After

How a change shows it worked, before it lands.

#### Try it on the real thing

A check, a fix or a design that passed on examples failed on a real repository, a real page or the package as it ships. So run a change where it will run before it lands. That means a fix on each repository's files, a command from the packed tarball, a build on the largest site at hand, and a claim about another tool through that tool. Read what it's judged on from the source, at that moment, like `main` on GitHub or a tool's installed types, never a clone or a summary. Choose a new test input for what it reaches that the others don't, not for being one more of the same kind.

#### Have a way to verify

A change that only a person could check was made slowly, and broke what nobody looked at. A change a machine can check is cheap to make, and to make again. So each thing that matters has a check that runs on every change. That's a test against the spec, a limit, or a second implementation run on the same input, like micromark for markz or shiki for prose. A rewrite is checked against what it replaces, with each difference that's meant listed and every other one a bug. Where nothing can check it yet, build the check before the change.

#### Silence is the failure

A warning nobody has to read is never read, and a catch that takes every error hides the one that mattered. So a check fails where it can't be sure, and a tool warns only where a rewrite would help. A run says everything it found and what it didn't check. A check that can't fail isn't a check, so fix it or remove it. Catch only the error you expect, beside the call that throws it. A test that fails and then passes on a re-run is a bug, so its cause is fixed. A re-run or a retry that turns it green catches the error that mattered.

## Tools

Every repository runs one toolchain, Vite+ on pnpm and Node, at the same versions, so a fix made in one works in all.

### Vite+

One `vite.config.ts`, run through `vp`, covers dev, build, format, lint, test and a package's `vp pack`. `defineConfig` comes from `vite-plus`. The `fmt` and `lint` blocks are written out in each config, so a repository's format and lint show in its own files.

- [`tools-fmt`]{#tools-fmt}: `fmt` is oxfmt's defaults with `proseWrap: "never"`, so a changed Markdown paragraph shows as one line in a diff. Wrap `@prose` comments by hand at 100 characters, since no oxfmt setting wraps them.
- [`tools-lint`]{#tools-lint}: `lint` is type-aware and type-checks, with `typescript`, `unicorn` and `import` among its `plugins`, so `check` covers types with no `tsc`. An empty block fails, so an empty `catch` says why in a comment inside it. The fix adds a missing plugin.
- [`tools-tsconfig`]{#tools-tsconfig}: every `tsconfig.json` writes out [the reference's](../reference/tsconfig.json) compiler options, extends nothing, and sets its own `include`. The options are strict, check JavaScript as TypeScript, and keep to `erasableSyntaxOnly`, so Node runs a `.ts` script with no build.
- [`tools-playwright-config`]{#tools-playwright-config}: a `playwright.config.ts` sets `retries: 0`, `use: { trace: "retain-on-failure" }` and `forbidOnly: true`. A flaky test then fails and gets fixed, each failure keeps its trace, and a stray `test.only` fails on a laptop too. The fix writes each value.
- [`tools-craftz-dep`]{#tools-craftz-dep}: every repository on Vite+ depends on `@amitkaps/craftz`, and its config imports nothing from it. The fix adds the dependency, and removes any `craftz()` call and its import.

```ts
lint: {
  plugins: ["typescript", "unicorn", "import"],
  categories: { correctness: "error" },
  options: { typeAware: true, typeCheck: true },
  rules: { "no-empty": "error" },
},
```

**Yours.** Your own lint rules, categories, plugins and ignore patterns, beside the shared ones. A block the config works out, like `lint: shared`, is set by hand.

### The editor

- [`tools-editor`]{#tools-editor}: every repository has the reference's [.vscode/settings.json](../reference/.vscode/settings.json) and [.vscode/extensions.json](../reference/.vscode/extensions.json), and one that depends on Svelte has [svelte/](../reference/svelte/README.md)'s. They make oxc the formatter on save, through the repository's own `vp fmt` and `vp lint`, and recommend oxc's and Vitest's extensions. The fix writes both whole.

Put nothing about oxc in VS Code's user settings. A path there overrides every repository's own, and the editor then formats differently from `check`.

### Browsers

Code shipped to browsers has a floor for each engine, rather than Vite's default of 30 months for every browser.

- **Blink** (Chrome, Edge, Opera, Samsung Internet, Android's WebView): the oldest Chromium released in the last six months.
- **Gecko** (Firefox): the oldest ESR Mozilla supports.
- **WebKit** (Safari, and every browser on iOS): the newest release of the major two before the current one, where an iPhone a new iOS drops stays.

- [`tools-browsers`]{#tools-browsers}: a build that bundles code for browsers targets these floors. A site Vite bundles sets them in `build.target`. A package packs for Node, as `platform: "node"`, with no `pack.target`. One that also runs in browsers packs for `"neutral"`, with a `pack.target` of the browsers and its `engines` Node, and `/^node:/` in `pack.deps.neverBundle`. The fix writes either in.

A target rewrites syntax and adds no polyfills. So check an API newer than a floor yourself, or make sure it fails cleanly. craftz works the floors out from MDN's data, so a craftz release moves them.

### pnpm and Node

`package.json` is the one place for both versions.

```json
"devEngines": {
  "packageManager": { "name": "pnpm", "version": "12.19.0", "onFail": "download" },
  "runtime": { "name": "node", "version": ">=26.13.1", "onFail": "error" }
},
"engines": { "node": ">=26.13.1" },
"packageManager": "pnpm@12.19.0"
```

- [`tools-pnpm`]{#tools-pnpm}: pnpm is pinned exactly, in `devEngines` with `onFail: download` and in `packageManager`, which CI reads. Any pnpm installed globally then runs the pinned one.
- [`tools-node`]{#tools-node}: `devEngines` and `engines` ask for the reference's Node, with `onFail: error`, so the wrong Node stops loudly. A package supports only that Node, so moving to the next LTS is a breaking release.

### Other versions

The shared tools are at the reference's exact versions, so a craftz release is what moves them, and no two repositories differ.

- [`tools-types-node`]{#tools-types-node}: `@types/node` is the reference's, where a repository has it. It's the major of the Node `engines` allows, so code can't use newer APIs.
- [`tools-vite-plus`]{#tools-vite-plus}: `vite-plus` is the reference's, with no direct `vite`. A package that takes it as a peer asks for `^` and the reference's version, the oldest it's tested on.
- [`tools-typescript`]{#tools-typescript}: `typescript` is the reference's, where a repository has it.
- [`tools-prose`]{#tools-prose}: `@amitkaps/prose` is an exact version, at least the reference's, where a repository has it.
- [`tools-markz`]{#tools-markz}: `@amitkaps/markz` is an exact version, at least the reference's, where a repository has it.
- [`tools-craftz`]{#tools-craftz}: `@amitkaps/craftz` is at craftz's own version, exactly, so a repository is checked against the rules it names.
- [`tools-cf`]{#tools-cf}: `cf` is the reference's, where a repository has it. craftz runs it to write the Workers' settings, and it replaces wrangler once it deploys a site that needs a server.
- [`tools-beta`]{#tools-beta}: only `cf` is on a pre-release, pinned to an exact build, and so is a library a repository [ignores](#tools-ignored), since an update must not move a pre-release.
- [`tools-wrangler`]{#tools-wrangler}: `wrangler` is the reference's, while a repository is still on it.
- [`tools-publint`]{#tools-publint}: `publint` is the reference's, where a package has it.
- [`tools-playwright`]{#tools-playwright}: `@playwright/test` is the reference's, where a repository has it. It's the version whose Chromium the Claude Code cloud image ships, so a session screenshots with no download.

**Yours.** Your own libraries, like svelte or micromark. craftz's `align` moves them within their major, and a new major is reviewed in its own pull request.

### pnpm's settings

- [`tools-workspace`]{#tools-workspace}: `pnpm-workspace.yaml` is [the reference's](../reference/pnpm-workspace.yaml), word for word, apart from `ignoreDependencies`. It keeps pnpm's one-day cooldown, which `@amitkaps/*` skips, and lets esbuild and workerd build. Its comments say why. The fix writes it whole.
- [`tools-ignored`]{#tools-ignored}: a library whose latest release your tooling can't use goes under `updateConfig.ignoreDependencies`, so `update`, `outdated` and `align` leave it. It's a dependency at an exact version, since a range lets a fresh install take the release that was left. The comment above it says why, and when to look again.

**Yours.** The `ignoreDependencies` block. A shared tool is held, never ignored, since `craftz upgrade` moves it and not `pnpm update`.

**Ruled out.** A shorter cooldown, or none for the shared tools, since any number of hours is as arbitrary as pnpm's.

### Holds (Exceptions)

When a tool keeps a repository from a rule, hold the rule in `package.json`, with the reason and when to look again. `craftz check` then prints its drift as a warning and passes.

```json
"craftz": {
  "hold": {
    "tools-typescript": "svelte-check accepts TypeScript 5 and 6 only. Move when its peer range takes 7."
  }
}
```

Only rules a tool can block can be held. Those are `cloudflare-config`, `tools-tsconfig`, and each shared tool's version except craftz's own. A hold on any other rule fails `craftz check`.

Hold for what a tool can't do, never for a preference. A hold whose rule stops drifting fails `check` until it's removed. A library no rule names is [ignored](#tools-ignored) instead.

## Scripts

Every repository uses these names, so a script means the same everywhere. Run them with `pnpm run …` in anything automated.

| Script | Does |
| --- | --- |
| `dev` | the dev server, or `vp pack --watch` for a package |
| `build` | the production build |
| `preview` | a site's: serves what `build` wrote, with `vp preview` |
| `check` | format, lint and types with `vp check`, a framework's own checker, then `prose check` and `craftz check` |
| `fix` | writes the format and lint fixes: `vp check --fix` |
| `test` | the tests, when there are any |
| `verify` | `vp run --log grouped all`, which runs `check`, `test`, `build` and `site` side by side |
| `ship` | uploads what `verify` built: `craftz deploy` |
| `prose` | reads the repository as a document: `prose`, so `pnpm prose build` works |
| `outline` | writes `outline.md` for agents: `prose outline` |
| `site` | a package's site, which `vp pack` doesn't build, like `prose build` or `pagez build` |
| `pr` | opens a pull request that merges itself once CI passes |
| `gone` | deletes the local branches that merged |
| `craftz` | runs craftz, so `pnpm craftz rules` works |

- [`scripts-required`]{#scripts-required}: `check`, `fix`, `verify` and `prose` are in every repository, `dev` and `build` in every site and package, and `ship` in every site. A tool's `verify` runs `check` and `test`. `test` is there when there are tests.
- [`scripts-check`]{#scripts-check}: on Vite+, `check` runs `vp check`, then `pnpm prose check` and `pnpm craftz check`, and only reads. A framework adds steps around `vp check`, like SvelteKit's `svelte-kit sync` before and `svelte-check` after. The fix adds a missing step at the end.
- [`scripts-fix`]{#scripts-fix}: on Vite+, `fix` is exactly `vp check --fix`.
- [`scripts-one-checker`]{#scripts-one-checker}: on Vite+, there are no `lint` or `fmt` scripts, and a framework adds no second formatter or linter. `check` and `fix` cover both.
- [`scripts-verify`]{#scripts-verify}: on Vite+, `verify` is exactly `vp run --log grouped all`. `all` is a task in `vite.config.ts` that depends on `check`, and on `tested`, `built` and `site` where there are any, and they run side by side. Only `tested` and `built` are cached. The fix writes the tasks and their caches, and names each step it can't move.
- [`scripts-prose`]{#scripts-prose}: `prose` is exactly `prose`, so `pnpm prose build` works, and `outline` is exactly `prose outline`.
- [`scripts-preview`]{#scripts-preview}: a site's `preview` is the reference's, and a SvelteKit site's starts with [`scripts-sveltekit`](#scripts-sveltekit)'s variable. A package has none.
- [`scripts-pr`]{#scripts-pr}: `pr` is `craftz pr`, with no `scripts/pr.ts`. `pnpm pr --help` says what it does.
- [`scripts-gone`]{#scripts-gone}: `gone` is `craftz gone`, with no `scripts/gone.ts`. It deletes each local branch that merged.
- [`scripts-craftz`]{#scripts-craftz}: `craftz` is exactly `craftz`, so `pnpm craftz rules` works.
- [`scripts-ship`]{#scripts-ship}: a site's `ship` is `craftz deploy`, and the Worker's deploy command is `pnpm run ship`, so how a site deploys moves with craftz.
- [`scripts-sveltekit`]{#scripts-sveltekit}: a SvelteKit repository's `build` and `preview` start with `SVELTEKIT_OUT_DIR=.svelte-kit/build`, and its `test` with `SVELTEKIT_OUT_DIR=.svelte-kit/test`. Its `vite.config.ts` sets `outDir` to `process.env.SVELTEKIT_OUT_DIR ?? ".svelte-kit"`. Each then writes its own types, so `build`, `test` and `check` run side by side. The fix prefixes the scripts, and the config is changed by hand.
- [`scripts-pnpm-names`]{#scripts-pnpm-names}: no script is named `deploy`, `publish`, `audit`, `ci`, `pipeline` or `pack`, since `pnpm <name>` runs pnpm's own command instead.

`verify` is what CI and Cloudflare run, so the two can't disagree, and `ship` never builds. A lifecycle script, like `prepare` or `prepack`, does only what another step needs first. A package's `prepack` is `pnpm run build`, so a tarball never ships a stale `dist/`.

**Yours.** Any other script, like a package's `size` or `fuzz`. A step that needs another first, like a size budget after `build`, is a task of your own with its own `dependsOn`. So is a test that measures time, with `cache: false`.

### A run removes what it writes

A script removes what it wrote when it ends, like a temporary folder or a clone, and says what it kept and where. craftz's own folders are named `craftz-<what>-`, so `craftz clear` removes what a stopped run left.

## Cloudflare

A site deploys to a Cloudflare Worker with static assets, which builds and deploys each merge to `main`.

- [`cloudflare-config`]{#cloudflare-config}: a site deploys with `cloudflare.config.ts`, written as cf's config is, `export default { worker: {…} }`, with no import. It holds the Worker's name, domains and the folder it serves, as `assets.directory`.
- [`cloudflare-site`]{#cloudflare-site}: a static site's Worker sets the compatibility date of the reference's cf, and `workersDev` and `previewUrls` to false, so it answers only on its domain. The fix writes what differs, and turns a `site()` call into cf's config.
- **Deploys.** Workers Builds runs `verify` and then `ship`, with the API token the Worker's build settings name. There's no deploy step in GitHub Actions, and no secret in the repository.
- **The Worker's settings** are the same on every Worker. craftz's `align` writes them, and `craftz settings --check` reads them. Only connecting the Worker to its repository is done in Cloudflare's dashboard.

```text
Build command      pnpm run verify
Deploy command     pnpm run ship
Root directory     /
NODE_VERSION       26
Build cache        on
Previews           off
```

**Ruled out.** Previews, since CI already checks every pull request.

### A static site

A static site is one folder, built by Vite, by a plugin like Sitez or Pagez, or by `prose build`. `craftz deploy` uploads it with Cloudflare's API, so nothing from Cloudflare is installed.

```ts
export default {
  worker: {
    name: "prose",
    domains: ["prose.amitkaps.com"],
    assets: { directory: ".prose" },
    compatibilityDate: "2026-11-17",
    workersDev: false,
    previewUrls: false,
  },
};
```

- [`cloudflare-static`]{#cloudflare-static}: a static site depends on none of cf, `@cloudflare/vite-plugin` and wrangler, and doesn't load Cloudflare's plugin. A site with no `index.html` runs no `vp build` unless SvelteKit builds it. The fix removes them, and the ` && vp build` that ends `verify` or `build`.

A site with an `index.html` serves `dist`, and a SvelteKit app with the static adapter serves `build`. A prose site's `verify` ends with `pnpm prose build`, and anything that adds to the site runs after it.

### An app

A site that needs code on the server starts from base, SvelteKit with `adapter-cloudflare`. It holds `cloudflare-config` and deploys with `wrangler.toml`, since `craftz deploy` uploads only files. Its `check` runs `wrangler types`.

### Internal sites

An internal site is one that Cloudflare Access covers, in a public repository or a private one. Put an Access application on its domain, with a policy that lets in only who it's for, and say so in the config's `@prose`. `craftz status` says whether a site is public or internal, and marks an application with no policy.

## GitHub

Every `main` takes changes the same way. Work happens in a pull request, `ci` passes on a branch up to date with `main`, and the pull request is squash-merged.

- [`github-rules`]{#github-rules}: `main` has one ruleset, named `main`, from [.github/ruleset.json](../reference/.github/ruleset.json). It requires a pull request with no approvals and the `ci` check, and a package's `label` check too. It keeps history linear, blocks force pushes and deletion, and nobody bypasses it.
- [`github-ci`]{#github-ci}: `.github/workflows/ci.yml` is [the reference's](../reference/.github/workflows/ci.yml), word for word, and there's no Dependabot. A step a repository adds goes in `verify`, so CI is the same everywhere. The fix writes it whole.
- [`github-browser`]{#github-browser}: a repository with a `test:browser` script has [the reference's](../reference/.github/workflows/browser.yml) `.github/workflows/browser.yml`, word for word except its `on:` block. The fix keeps the repository's `on:`.
- **Merge settings** are from [.github/settings.json](../reference/.github/settings.json): squash only, branches deleted once merged, auto-merge on and the topic `craftz`. `craftz settings` writes them and the ruleset, and `--check` reads them.

**Yours.** A workflow of your own, like a fuzz search, and `browser.yml`'s `on:` block.

### CI

GitHub Actions runs one job, `ci`, on each pull request. A repository with browser tests adds `browser`, and a package adds `label`.

- **`ci`** installs with a frozen lockfile, restores Vite+'s task cache, and runs `pnpm run verify`. Then it runs `prose style` on the changed lines, as advice that never fails. It doesn't run again on `main`, since the merge is the tree `ci` passed.
- **`label`**, in a package, checks the pull request has one [release-notes label](#release-notes), and runs again when a label changes.
- **`verify` takes 10 seconds or less on CI.** A repository with more to check makes its checks faster, not the target larger. One over passes, `craftz status` notes it, and the lessons say why it stays over. The step stops at 2 minutes and the job at 3.
- **`browser`** runs `pnpm run test:browser` once for each merge to `main`, and by hand with `workflow_dispatch`. A package also calls it from its release, so a browser break stops the release. It installs only Chromium's headless shell, and runs `@playwright/test` at [the reference's version](#tools-playwright). Its target is 2 minutes, and the job stops at 6.
- **A failed `browser` run is fixed before the next change.** `craftz status` and `pnpm gone` say how the latest run on `main` ended. Where it isn't fixed, write down why.

**Ruled out.** `ubuntu-slim`, which runs four times slower. Moving slow tests to a nightly run, since a regression would show a day late. Requiring `browser` before a merge, until a repository's suite is steady under two minutes with no flaky run. Running `browser` on a pull request, since `workflow_dispatch` does that.

## Releases

A package is any repository whose `package.json` isn't private, like markz, prose and pagez, and every one releases the same way.

- [`releases-files`]{#releases-files}: a package has [the reference's package/](../reference/package/README.md) files, unchanged: the release workflow, `.github/notes.yml` and the `label` workflow. The fix writes them whole, and deletes a leftover `.github/release.yml`.
- [`releases-packing`]{#releases-packing}: a package packs `dist` with publint, strict, as `pack.publint: { strict: true }`. `files` is `["dist"]` and what the package reads as it runs, `prepack` is `pnpm run build`, and `publishConfig.access` is `public`. The fix writes the fields.
- [`releases-types`]{#releases-types}: a package's `pack` sets `dts: { generator: "oxc" }`, so `vp pack` writes the `.d.ts` files and fails on an export whose type isn't written out. A package has no `typescript` dependency.
- [`releases-bundled`]{#releases-bundled}: our own packages bundle markz as a dev dependency, rather than depend on it. Each then releases on its own, and taking a new markz takes a release.

To release, run `pnpm craftz release X.Y.Z --notes "…"`, with what to change when upgrading as the notes. It opens a pull request that bumps `version`, with auto-merge on. Merging it is the release. The workflow runs `verify`, stages the tarball on npm, tags the commit and publishes a GitHub Release. The owner then approves the staged version with 2FA, so a merge alone can't reach users.

### Release notes

There's no changelog file. Each pull request carries one label, which files it under a heading in the notes, and its title is its line.

- [`releases-labels`]{#releases-labels}: a package has the labels from [.github/labels.json](../reference/.github/labels.json). craftz's `align` creates them.

| Label      | Heading            | For                                            |
| ---------- | ------------------ | ---------------------------------------------- |
| `breaking` | Breaking           | a change that needs users to update their code |
| `added`    | Added              | a new feature or warning                       |
| `fixed`    | Fixed              | a bug fix users would notice                   |
| `improved` | Faster and smaller | the same behaviour, faster or smaller          |
| `docs`     | Documentation      | documentation readers use                      |
| `internal` | left out           | tests, tooling, site and lessons               |

Write a user-facing title for the package's users. A site or a tool has no release notes, so its pull requests need no label.

### Setting up a new package

`craftz new` writes the release files, and `align <repo>` makes the labels. On npmjs.com, add a trusted publisher for the repository and `release.yml`, with direct publishing and dist-tags unchecked. Publish the first version by hand, from outside the repository, since `npm` refuses to run where `devEngines` names pnpm.

```sh
pnpm pack && cd /tmp && npm login && npm publish ~/code/<repo>/amitkaps-<repo>-<version>.tgz --access public
```

## Docs

Explanations live in `@prose` comments, beside what they explain, and docs that span files live in `docs/`. Every repository has the same docs, so anyone finds the same things in the same places.

- [`docs-files`]{#docs-files}: `docs/` has `design.md`, `plan.md`, `development.md` and `lessons.md`, and a package's has `usage.md`. Each is in the `nav` of `docs/README.md`, and `README.md` links to `docs/`. The fix writes a first version of each one missing.

| File | Holds |
| --- | --- |
| `README.md` | what it is, a short example, the commands a user runs, and a link to `docs/` |
| `docs/README.md` | the docs in reading order: `nav` in its metadata, and a line for each |
| `docs/design.md` | what it is, why it's built this way, and what it isn't |
| `docs/plan.md` | what's next first, in order, then one line for each thing that works now |
| `docs/development.md` | only what's its own, linking these rules for what's shared |
| `docs/lessons.md` | what building it taught, each lesson what went wrong and what to do |
| `docs/usage.md` | a package's install and use, and a section for agents |

- [`docs-plan`]{#docs-plan}: each step in the plan's Next is a task, `- [ ]`, ticked as the pull request that finishes it merges. A ticked step leaves, and what it built goes into "Where it is" or the doc that states it. `craftz release` stops until both are done, and the summary names the version. The fix turns a plain step into a task.
- [`docs-lessons`]{#docs-lessons}: a link from `docs/lessons.md` into these rules names an id or a heading they have. Each group of lessons links the principle in [Practice](#practice) it shows.
- **A lesson** is for what the next change would get wrong without it, in a few sentences. Put it under the principle it shows. If its group already says it, add the case there, and give the principle a check, a command or a line in `AGENTS.md`.

A package's site is `prose build`, the repository read as a document. Docs are published at `/docs/<file>.md`, so a link works on GitHub and the site alike. Text the repository didn't write, like a test corpus, is marked `linguist-vendored` in `.gitattributes`, and `prose check` skips it.

**Yours.** Any other doc, like a grammar, in the `nav` too. A site has no `usage.md` unless it has commands to run.

### Agents

- [`docs-agents`]{#docs-agents}: every `AGENTS.md` opens with [the reference's](../reference/AGENTS.md) two sections, word for word, and `CLAUDE.md` holds only `@AGENTS.md`.
- [`docs-outline`]{#docs-outline}: `.gitignore` lists `outline.md`, which `pnpm outline`, `pr` and `gone` write, so two pull requests don't conflict on it. The fix adds it.
- [`docs-claude`]{#docs-claude}: every repository has the reference's [.claude/settings.json](../reference/.claude/settings.json) and its hooks, [session-start.sh](../reference/.claude/hooks/session-start.sh) and [suggest-clear.sh](../reference/.claude/hooks/suggest-clear.sh), word for word. The fix writes them whole.

The session-start hook installs, adds Chromium where the repository has Playwright, and prints one line on the session's Node, pnpm and browser. A cloud environment's setup is [cloud-setup.sh](../reference/cloud-setup.sh), pasted once. To see a page, run `pnpm craftz shot <url> <file.png>` and read the PNG.

**Yours.** Everything in `AGENTS.md` after the two shared sections.
