# Rules

How every repository builds, checks, deploys and releases. There's one way to do each thing. `drift` checks every repository against these rules and lists where each has drifted, and `align` brings them back in line. [Usage](usage.md) says how to run them.

The repositories are the ones in `REPOS`, in [src/survey.ts](../src/survey.ts). Where this page gives a version, the real value is in [the reference](../reference/README.md), and `drift` reads it from there.

A rule `drift` checks is a list item that opens with its id as a span, like ``[`scripts-verify`]{#scripts-verify}``. An id is lowercase kebab case, its part and then its name, since an id can't hold a dot. Its first sentence is the rule, and the rest says why. `drift` prints the id on each line a repository drifted on, and `craftz rules <id>` prints the rule. The check, and the fix where one can be automated, are in [src/rules.ts](../src/rules.ts), under the same id. Some checks don't have an id yet, and they move over part by part.

## Axes

What a repository must have follows from four axes. Each is read from where it already lives, so none is declared twice, and each varies on its own.

| Axis       | Values               | Read from                                             |
| ---------- | -------------------- | ----------------------------------------------------- |
| publish    | package, or none     | `package.json` isn't `private`                        |
| deploy     | static, app, or none | the Worker config, and whether it has code of its own |
| audience   | public or internal   | Cloudflare Access, for each site                      |
| repository | public or private    | GitHub                                                |

- **Publish.** A package is published to npm, so its audience there is public. A private npm package would be a fifth value, and none is needed yet.
- **Deploy.** A site deploys to a Cloudflare Worker. One whose config names code to run, cf's `entrypoint` or wrangler's `main`, is an [app](#an-app). One without is static, whatever builds its files, like [a prose site](#a-prose-site) or a Vite page.
- **Audience.** A site is internal when Cloudflare Access covers its domain, as [Internal sites](#internal-sites) says. Audience applies only to a site.
- **Repository.** Whether the code is public is separate from whether the site is. A private repository can have a public site, and a public repository an internal one.

A package can have a site, like markz and its docs. A repository with neither is scripts run on a laptop. Where two axes meet badly, the pair is allowed, and what's lost is said where it applies. npm takes provenance only from a public repository, so a package in a private one publishes without it.

## Toolchain: Vite+

One `vite.config.ts`, run through `vp`, covers dev, build, format, lint and test. A package builds with `vp pack`, which is part of Vite+, so there's no separate bundler. `defineConfig` comes from `vite-plus`.

Vite+ ships its own build of Vite. Each repository points every `vite` at it with an override in `pnpm-workspace.yaml`, and turns off pnpm's peer checks for `vite`, since that build is an npm alias. Bump `vite-plus` and the override together, in every repository at once. A version that differs between repositories is the drift that makes Vite+ painful.

Formatting runs at oxfmt's defaults, but for one setting.

- [`toolchain-wrap`]{#toolchain-wrap}: `fmt` sets `proseWrap: "never"`, so each Markdown paragraph is one line that the editor soft-wraps. Nobody hand-wraps, and a changed paragraph shows in a diff as one line with its changed words highlighted. `"always"` would reflow the rest of a paragraph when one word is added. `@prose` comments stay hand-wrapped at 100 characters, since no oxfmt setting wraps comment text.

- [`toolchain-lint`]{#toolchain-lint}: lint is type-aware and type-checks too, so `check` covers types without a separate `tsc`.
- [`toolchain-types`]{#toolchain-types}: every `tsconfig.json` turns on the same strict options: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules` and `forceConsistentCasingInFileNames`. [The reference's tsconfig.json](../reference/tsconfig.json) is the example. The rest of a tsconfig, like `include` and `types`, is the repository's own.

The lint block in `vite.config.ts`:

```ts
lint: {
  plugins: ["typescript", "unicorn", "import"],
  categories: { correctness: "error" },
  options: { typeAware: true, typeCheck: true },
},
```

`craftz()` in the config's `plugins` sets the `fmt` and `lint` blocks, so a config with it holds neither. It fills in only what the config leaves unset, and fails a config that sets one of them differently, naming the key.

### The editor

- [`toolchain-editor`]{#toolchain-editor}: every repository has the reference's [.vscode/settings.json](../reference/.vscode/settings.json), the one Vite+ writes, and recommends the extensions its `.vscode/extensions.json` does. A repository can add settings of its own, like base's for Svelte, and `align` keeps them when it writes the reference's.

The settings make oxc the formatter, on save, with its fixes. The extensions recommended are oxc's and Vitest's, by name, rather than Vite+'s extension pack, which only wraps the two and could add more without a change to these rules. The oxc extension then runs the repository's own `vp fmt` and `vp lint`, so the editor formats with the oxfmt Vite+ pins and the `fmt` block in `vite.config.ts`, the same as `check`.

Nothing about oxc goes in VS Code's user settings. A path to oxfmt there, or a config path, overrides every repository's own, and the editor formats differently from `check`.

### Browsers

Code shipped to browsers works in the browsers people use, with a floor for each engine rather than a date. Vite's default, Baseline Widely Available, waits 30 months for every browser and is frozen at each Vite major. But only one engine holds people back that long.

- **Blink**, which is Chrome, Edge, Opera, Samsung Internet and Android's WebView: the oldest Chromium released in the last 12 months. Chrome and Firefox release every two weeks now, so a count of versions shrinks each time they speed up, and a window of time doesn't. Samsung Internet runs on a Chromium about ten months old, which is why the window is a year.
- **Gecko**, which is Firefox: the oldest ESR Mozilla supports. It's the oldest Firefox that still gets fixes.
- **WebKit**, which is Safari and every browser on iOS, in-app browsers too: the newest release of the major two before the current one. An iPhone that a new iOS drops stays on its last major and keeps getting point releases, so that's the oldest Safari in use. Chrome on iOS and an app's WebView run this engine too, so it covers more people than Safari's own share.

- [`toolchain-browsers`]{#toolchain-browsers}: a build that bundles code for browsers targets these browsers, in `build.target` for a site Vite bundles from source and in `pack.target` for a package that isn't `platform: "node"`. `craftz()` sets `build.target` for a static site with an `index.html`. A package that runs in Node too adds its Node to the list.

The list is worked out from MDN's browser-compat-data, by [src/browsers.ts](../src/browsers.ts), as of the date of the data. The package is one of craftz's own dependencies, so a craftz release moves it, and the floors move with it, with `drift` listing what then needs the new list.

A target only rewrites syntax, like CSS nesting or a regular expression's flags. It adds no polyfills, so it doesn't stop code that calls an API too new for a floor. Something newer than a floor, like `::highlight()` on Firefox's ESR, is fine where it fails cleanly and the page still works. The floor is for what has to work. A prose site's page scripts and styles aren't built by Vite, so the target doesn't reach them.

## pnpm and Node

`package.json` is the one place for both versions.

```json
"devEngines": {
  "packageManager": { "name": "pnpm", "version": "12.13.0", "onFail": "download" },
  "runtime": { "name": "node", "version": ">=26", "onFail": "error" }
},
"engines": { "node": ">=26" },
"packageManager": "pnpm@12.13.0"
```

- [`versions-pnpm`]{#versions-pnpm}: pnpm is pinned exactly, with `onFail: download`. Whatever pnpm is installed globally, pnpm fetches and runs the pinned one, so a new pnpm release never breaks a checkout. CI reads `packageManager`, so keep the two equal.
- [`versions-node`]{#versions-node}: `devEngines` asks for the reference's Node with `onFail: error`, and `engines` asks for the same. The wrong Node stops loudly. A package supports the Node it's built and tested on, and nothing older, so CI runs on one Node. Node 26 is the LTS release from October 2026. When the next LTS arrives, every repository moves to it at once, and for a package that's a breaking release.

Bump deliberately, everywhere at once. Being on the latest pnpm doesn't matter. Being on the same one does.

## Other versions

The tools every repository shares are on one version, written the same way, so moving one never leaves two repositories to reconcile. The reference's [package.json](../reference/package.json) has the version, or the `catalog` in its [pnpm-workspace.yaml](../reference/pnpm-workspace.yaml) does for a tool it doesn't install. npm isn't read. A new release is drift only once the reference moves to it, past pnpm's one-day wait.

- [`versions-types-node`]{#versions-types-node}: `@types/node` is the reference's, where a repository has it. It's the major of the Node that `engines` allows, so code can't use newer APIs.
- [`versions-vite-plus`]{#versions-vite-plus}: every repository is on the reference's `vite-plus`, with the override at the same version and no direct `vite`. [Toolchain](#toolchain-vite) says why.
- [`versions-typescript`]{#versions-typescript}: `typescript` is the catalog's, where a repository has it.
- [`versions-prose`]{#versions-prose}: `@amitkaps/prose` is the reference's, where a repository has it.
- [`versions-markz`]{#versions-markz}: `@amitkaps/markz` is the reference's, where a repository has it.
- [`versions-cf`]{#versions-cf}: `cf` is the reference's, where a repository deploys with it.
- [`versions-cf-vite-plugin`]{#versions-cf-vite-plugin}: `@cloudflare/vite-plugin` is the reference's, where a repository deploys with cf, at the build that goes with `cf`.
- [`versions-beta`]{#versions-beta}: only `cf` and `@cloudflare/vite-plugin` are on a pre-release, each pinned to an exact build.
- [`versions-wrangler`]{#versions-wrangler}: `wrangler` is the catalog's, while a repository is still on it.
- [`versions-publint`]{#versions-publint}: `publint` is the catalog's, where a package has it.

A beta's tags don't say which build goes with which, so it's moved by hand. `align` lists one in its pull request once npm's latest is a release, and then it leaves `versions-beta`. [Development](development.md#beta-packages) says how.

A repository's own libraries, like svelte or micromark, are its own to choose. `align` moves them within their major version, and lists a new major in its pull request for review.

`pnpm-workspace.yaml` is a settings file, not a workspace. Every repository has the same three settings: the cooldown, `allowBuilds` and the Vite+ override. `allowBuilds` lets esbuild and workerd run their install scripts, when wrangler or the Cloudflare plugin is installed.

- [`versions-cooldown`]{#versions-cooldown}: pnpm's one-day wait on a new version is kept, with only `@amitkaps/*` excluded. A bad release can be caught before it's installed, and our own skip the wait, since each reaches npm only after the owner approves it.

## Held

When a tool a repository depends on can't support a rule yet, the check is held. `drift` prints it with its reason, and doesn't count it as drift. Each hold says when to look again, like svelte-check accepting TypeScript 7. Holds are listed in [src/survey.ts](../src/survey.ts).

A hold is for what a tool can't do, never for a preference. The point of one set of rules is that a choice like Vite+ is made once and paid for once, not argued again in each repository. A hold whose check stops drifting fails `drift` until it's removed, so none outlives its reason.

## Scripts

Every repository uses these names, and runs them with `pnpm run …` in anything automated.

| Script    | Does                                                                      |
| --------- | ------------------------------------------------------------------------- |
| `dev`     | the dev server, or `vp pack --watch` for a package                        |
| `build`   | the production build                                                      |
| `preview` | a site's: serves what `build` wrote, with `vp preview`                    |
| `check`   | format, lint and types: `vp check`, and a framework's own checker         |
| `fix`     | writes the format and lint fixes: `vp check --fix`                        |
| `test`    | the tests, when there are any                                             |
| `verify`  | `check`, `prose check`, `test` and `build`, then the site if there is one |
| `ship`    | uploads what `verify` built: `cf deploy --prebuilt`, or `wrangler deploy` |
| `prose`   | reads the repository as a document: `prose`, so `pnpm prose build` works  |
| `pr`      | opens a pull request that merges itself once CI passes                    |
| `gone`    | deletes the local branches that merged                                    |

- [`scripts-required`]{#scripts-required}: `check`, `fix`, `verify` and `prose` are in every repository, `dev` and `build` in every site and package, and `ship` in every site. A tool has nothing to serve or build, so its `verify` is `check`, `prose check` and `test`. `test` is there when there are tests.
- [`scripts-check`]{#scripts-check}: on Vite+, `check` runs `vp check`. A framework can add its own steps around it, like SvelteKit's `svelte-kit sync` before and `svelte-check` after.
- [`scripts-fix`]{#scripts-fix}: on Vite+, `fix` is exactly `vp check --fix`.
- [`scripts-one-checker`]{#scripts-one-checker}: on Vite+, there are no `lint` or `fmt` scripts. `check` and `fix` cover both, and a framework adds no second formatter or linter.
- [`scripts-verify`]{#scripts-verify}: `verify` runs `pnpm prose check`. It fails on what the text gets wrong, which `prose build` only prints, so a mistake in a doc or a comment stops a merge the way a lint error does.
- [`scripts-prose`]{#scripts-prose}: `prose` is exactly `prose`, so `pnpm prose build` works. prose's own repository runs its command line from source.
- [`scripts-preview`]{#scripts-preview}: `preview` is a site's, the same as the reference's. A package, whose build is `dist/`, has none.
- [`scripts-pr`]{#scripts-pr}: `pr` is `craftz pr`, and there's no `scripts/pr.ts`. `pnpm pr "<title>"` starts a branch when it's on `main`, commits, runs `verify`, pushes, opens the pull request and turns on auto-merge. A package's pull request takes `--label <label>`, and stops without one, before anything is committed. `--wait` waits for the merge, updating the branch when another merge leaves it behind `main`, then switches to `main` and pulls. craftz's own repository runs it from source.
- [`scripts-gone`]{#scripts-gone}: `gone` is `craftz gone`, and there's no `scripts/gone.ts`. It deletes each local branch whose branch on GitHub is gone, which is each one that merged, and works where no git alias is set, like an agent's machine. craftz's own repository runs it from source.
- [`scripts-pnpm-names`]{#scripts-pnpm-names}: no script is named `deploy`, `publish`, `audit`, `ci`, `pipeline` or `pack`. Those are pnpm's own commands, and `pnpm <name>` skips a script by one of those names.

Text the repository didn't write, like a test corpus or a fixture that's wrong on purpose, is marked `linguist-vendored` in `.gitattributes`, and `prose check` skips it. Any other script is the repository's own, like a package's `size` or `fuzz`.

`verify` is what CI runs and what Cloudflare runs before each deploy, so the two can't disagree. `ship` never builds.

A lifecycle script, one pnpm runs on its own like `prepare` on install or `prepack` before packing, only does what another step needs first. base's `prepare` generates the types SvelteKit and the Worker need, so a fresh clone type-checks. A package's `prepack` is `pnpm run build`, so a tarball never ships a stale `dist/`. Neither builds a site or deploys.

## Cloudflare

A repository with a site deploys it to a Cloudflare Worker with static assets.

- [`cloudflare-config`]{#cloudflare-config}: a site deploys with `cloudflare.config.ts`, cf's typed config. It holds the Worker's name, compatibility date, domain, addresses and asset handling.
- [`cloudflare-addresses`]{#cloudflare-addresses}: a site's config turns off `workers.dev` and preview URLs, so it answers only on its domain. Nothing uses the other addresses, and each would serve the site outside anything that covers the domain, like Access.
- [`cloudflare-date`]{#cloudflare-date}: a site's `compatibilityDate` is the build date of the workerd that the reference's cf installs, and it sets no Node.js compatibility flag. That's the newest date the local runtime knows, so dev and tests run what production does, and from 2026-08-04 the date turns on Node.js compatibility itself.
- [`cloudflare-wrangler`]{#cloudflare-wrangler}: a site cf can't deploy yet keeps `wrangler.toml`, never `wrangler.jsonc`. prose reads comments in TOML but not in JSONC. `cloudflare-addresses` and `cloudflare-date` read `cloudflare.config.ts`, so they apply once a site moves to it.
- **Deploys:** the Worker's Git integration (Workers Builds) builds and deploys `main`. There's no deploy step in GitHub Actions, and no API token or secret.
- **The Worker's settings** are the same on every Worker. Cloudflare's config has no field for them, so `align` writes them with `cf`, and `drift` checks them when `cf` is logged in. Only connecting the Worker to its repository is left to Cloudflare's dashboard.

```text
Build command      pnpm run verify
Deploy command     pnpm run ship
Root directory     /
NODE_VERSION       26
Build cache        on
Previews           off
```

`verify` fails on a failing check, so a merge that breaks one doesn't deploy. Previews stay off because CI already checks every pull request. If a public repository turns them on, it sets the preview deploy command too: `pnpm exec wrangler versions upload`, or `pnpm exec cf workers versions create --prebuilt`.

### A prose site

A site that's the folder `prose build` writes, like a package's, deploys with cf through Vite. cf's config has no field for an assets folder, so Vite hands the folder on.

```ts
export default defineConfig({
  publicDir: ".prose",
  plugins: [cloudflare({ assetsOnly: true })],
});
```

With `craftz()` in the plugins, the `publicDir` line goes, since the plugin sets it for a static site with no `index.html`.

- [`cloudflare-prose-site`]{#cloudflare-prose-site}: a prose site serves `.prose` as Vite's `publicDir` through the Cloudflare plugin with `assetsOnly`, `verify` builds it after `prose build`, and `.gitignore` leaves out `.cloudflare`. With no `index.html` at the root, the plugin builds an empty entry and deletes it, so only the folder's files are deployed.

In a site, the build after `prose build` is `pnpm build`, which is `vp build`. In a package, `build` is `vp pack`, so `verify` ends with `vp build` itself. Anything that adds to the site, like markz's Quality page, runs before it. `ship` is `cf deploy --prebuilt`, which uploads `.cloudflare/output/`. craftz's own `ship` runs `craftz deploy`, which runs the same command, and every site's will once the repositories move to craftz.

### An app

A site that needs code on the server starts from base: SvelteKit with `adapter-cloudflare`, which writes a Worker as well as the files. It's kept for when one is needed. cf can't deploy what the adapter writes yet, so base stays on `wrangler.toml` and `wrangler deploy`, held, and its `check` runs `wrangler types` for the Worker's types.

### Internal sites

Any site can be public or internal, in a public repository or a private one. An internal site is one that Cloudflare Access covers, and it's deployed like any other.

- **Access covers its domain.** A Cloudflare Access application on the site's domain, with a policy that lets in only who it's for. Access is turned on once per account, in the Zero Trust dashboard.
- **Its other addresses are off,** as on every site, by `cloudflare-addresses`. Access covers the domain, not the Worker, so `workers.dev` or a preview URL would serve the site without a login.

The config says so in its `@prose` comment. With `cf` logged in, `drift` looks up Access for every site's domain. An application with no policy has drifted. With no application, the site is public, and drift says so on its own line, without counting it, so a site meant to be internal doesn't go public unseen.

## GitHub

Every `main` takes changes the same way. Work happens on a branch, in a pull request, and `ci` has to pass on a branch that's up to date with `main`. The pull request is squash-merged, so `main` reads as one commit per change, and nobody pushes to it, admins included.

- [`github-rules`]{#github-rules}: `main` has one ruleset, named `main`, from [.github/ruleset.json](../reference/.github/ruleset.json). It requires a pull request with no approvals, since there's one maintainer, and the `ci` check. It keeps history linear, and blocks force pushes and deleting the branch. Nobody bypasses it.
- [`github-actions`]{#github-actions}: every workflow uses the actions at the versions the reference's do, and there's no Dependabot. A repository can add steps of its own, but the versions move in the reference first, like every other version.
- **Merge settings:** from [.github/settings.json](../reference/.github/settings.json). Squash is the only merge, a branch is deleted once it's merged, and auto-merge is on.

`craftz settings` writes both for one repository, and asks before removing classic branch protection. `align` writes both to every repository or to the ones named, and removes classic protection without asking. `drift` checks the rules, which GitHub shows to anyone. Without a login, GitHub answers 60 requests an hour, so `drift` uses `gh`'s login when there is one, and a check the limit stopped shows as not checked, not as drift. With that login, it checks the merge settings too, which only the owner can read.

## Agents

- [`agents-sections`]{#agents-sections}: every `AGENTS.md` opens with the same two sections as [the reference's](../reference/AGENTS.md), word for word, and `CLAUDE.md` holds only `@AGENTS.md`, so Claude Code reads the same file.

"craftz" points at these rules, says to read them with `craftz rules`, and says how changes reach `main`. "Prose" says to run `prose rules`, which prints the rules in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents) as the installed version has them, so an agent reads them without a fetch. The rules live there, once, and aren't copied into each repository, since the copies had already started to differ. It also says to run `prose style` on the files a change touched. That's advice, so it isn't a script or a check. The rest of an `AGENTS.md` is the repository's own.

## Docs

Explanations live in `@prose` comments, beside the code or setting they explain, and docs that span files live in `docs/`. Both are written in [markz](https://markz.amitkaps.com)'s Markdown, and `pnpm prose` reads them as one document. `package.json` has no comments, so its scripts are explained in these rules. A hand-written `.html` page ships its comments, so it has no prose.

Every repository has the same docs, so anyone, or any agent, finds the same things in the same places.

- [`docs-files`]{#docs-files}: `docs/` has `design.md`, `plan.md`, `development.md` and `lessons.md`, and a package's has `usage.md`. Each is in the `nav` of `docs/README.md`, and `README.md` links to `docs/`.

| File | Holds |
| --- | --- |
| `README.md` | what it is, how it's used, and a link to `docs/` |
| `docs/README.md` | the docs in reading order: `nav` in its metadata, and a line for each |
| `docs/design.md` | what it is, why it's built this way, and what it isn't |
| `docs/plan.md` | where it is, and its own next steps, later and open, not other repositories' |
| `docs/development.md` | only what's its own: its extra scripts, its site, beyond these rules |
| `docs/lessons.md` | what building it taught, each lesson what happened and what to do about it |
| `docs/usage.md` | a package's install and use, and a section for agents |

The README is the site's home page when prose builds it, so it reads as one. It says what it is, gives a short example, and lists the commands a user runs, like a package's command. The repository's own scripts, like `dev` and `verify`, are the shared ones, and are left to `development.md`, which links these rules for the shared toolchain, scripts and workflows rather than describing them.

A site has no `usage.md`, since the site is what people use, unless it has commands to run. Any other doc is the repository's own, like markz's grammar, and goes in the `nav` too. `development.md` links to these rules for what's shared rather than repeating it. `docs-files`'s fix writes a first version of each one that's missing, and adds it to the `nav`, so `new` starts with all of them.

The docs are published at `/docs/<file>.md`, so a link to one works on GitHub and on the site alike.

- **A package's site is `prose build`,** the repository read as a document, with nothing added to it. Its docs are in the bar, and its code is a page away.
- **A site shows its docs its own way,** read from `docs/`, so GitHub and the site have one set of files. base renders them with SvelteKit, as the starter it is.
- **A page the build fills in is a doc with a section for it.** The doc holds the words and an empty `{@section}` for each table, so prose builds it with its bar and styles. A script fills the sections in the page prose wrote, and a ` ```=html ` block holds its styles.

## Releases

markz, prose, pagez and sitez are packages, published to npm. A package is any repository whose `package.json` isn't private, and every one releases the same way.

- [`releases-files`]{#releases-files}: The release files are [the reference's package/](../reference/package/README.md), copied into the package unchanged: the release workflow and `.github/release.yml`, which groups the notes. They name no package, so the copies stay identical and the survey checks them word for word. CI has the reference's `Label` step, word for word, and runs again when a label is added or taken off.
- [`releases-packing`]{#releases-packing}: A package packs `dist` with publint. `files` is `["dist"]`, followed only by what the package reads as it runs, like craftz's `docs/rules.md`. `prepack` is `pnpm run build`, and `publishConfig.access` is `public`. publint runs inside `vp pack`, with `pack: { publint: { strict: true } }` and `publint` as a dev dependency, so `build` fails on a package npm would serve badly, and there's no separate publint step.
- [`releases-types`]{#releases-types}: Types come from Oxc. The pack block sets `dts: { generator: "oxc" }`, so `vp pack` writes the `.d.ts` files without the TypeScript compiler, and fails on an export whose type isn't written out. It's set there, not as `isolatedDeclarations` in `tsconfig.json`, which the editor would apply to tests and config too. A package has no `typescript` dependency, like a site: `vp check` type-checks with tsgolint, which Vite+ installs.
- [`releases-bundled`]{#releases-bundled}: Our own packages are bundled, not depended on. prose and sitez have markz as a dev dependency, and `vp pack` puts it inside `dist/`. So a package's users never install a second markz, and each package releases on its own, in any order. Picking up a new markz takes a release of the package that bundles it.

To release, run `release` with the package and its new version.

```sh
release sitez 0.5.0 --notes "What to change when you upgrade …"
```

It opens a pull request that bumps `version`, from a branch named `release-X.Y.Z`, titled `vX.Y.Z` and labelled `internal`, and turns on auto-merge. Its description, down to the first `---` line, is the release's summary, like what to change in a breaking release. Without `--notes`, the editor opens for it.

Merging a new version is the release, and nobody tags by hand. When a merge changes `package.json`, the workflow looks for a `vX.Y.Z` tag for its version. If there isn't one, it runs `pnpm run verify`, packs the tarball and stages it on npm with trusted publishing. It then tags the merged commit and publishes a GitHub Release, with the summary above notes generated from the merged pull requests. If a run fails, rerun it, since a version already on npm is skipped.

You approve the staged version with 2FA, in the **Staged Packages** tab on npmjs.com or with `npm stage approve <id>`. That step stays by hand, so a merge alone can't put a version in front of users. A version with a pre-release part, like `-rc.0`, goes to npm's `next` tag and is marked a pre-release.

### Release notes

There's no changelog file. Each pull request carries one label, which files it under a heading in the notes.

- [`releases-labels`]{#releases-labels}: A package has the labels its release notes are grouped by, from [.github/labels.json](../reference/.github/labels.json). `align` creates them.

| Label      | Heading            | For                                            |
| ---------- | ------------------ | ---------------------------------------------- |
| `breaking` | Breaking           | a change that needs users to update their code |
| `added`    | Added              | a new feature or warning                       |
| `fixed`    | Fixed              | a bug fix users would notice                   |
| `improved` | Faster and smaller | the same behaviour, faster or smaller          |
| `docs`     | Documentation      | documentation readers use                      |
| `internal` | left out           | tests, tooling, site and lessons               |

A pull request's title is its line in the notes, so a user-facing one is written for the package's users. `ci` fails until a package's pull request has exactly one of these labels, and adding one runs it again, so a release's notes are right when it's tagged, not fixed after. A site or a tool has no release notes, so its pull requests need no label.

### Setting up a new package

`new` copies in the reference's `package/` files, through `releases-files`'s fix, and `align <repo>` makes the labels. A package that isn't on npm yet doesn't release on a merge, since npm trusts the workflow only once the package exists. On npmjs.com, add a trusted publisher for the repository and the workflow `release.yml`, with direct publishing and dist-tags left unchecked, so staging is all it can do. npm may not take that before the package exists. Then publish the first version by hand, from a folder outside the repository, since `npm` refuses to run where `devEngines` names pnpm.

```sh
pnpm pack && cd /tmp && npm login && npm publish ~/code/<repo>/amitkaps-<repo>-<version>.tgz --access public
```

The next merge that changes `package.json` finds that version on npm with no tag, so it skips staging and tags it, with a GitHub Release.

## CI

GitHub Actions runs one job, named `ci`, on pull requests and on `main`. It installs with `pnpm install --frozen-lockfile` and runs `pnpm run verify`, plus whatever a package adds, like publint or a size budget. In a package, it first checks the pull request has one [release-notes label](#release-notes), and it runs again when a label changes. The `main` ruleset requires `ci`. Cloudflare's own check on each commit isn't required, since it runs after the merge.

## Repositories

Every repository that follows these rules is in `REPOS`, in [src/survey.ts](../src/survey.ts), so `drift` checks it. A repository joins one of two ways, and both end the same: in `REPOS`, protected, and passing `drift`.

### Bringing one in

1. Add it to `REPOS`, in a pull request to craftz. `drift` then lists everything it's missing.
2. Fix what drift lists, in the repository's own pull requests. Where a tool can't meet a rule yet, add a hold rather than a workaround.
3. Connect a site's Worker to the repository, in Cloudflare's dashboard.
4. Run `align <repo>`, for the branch rules, the merge settings, a package's labels and the Worker's build settings. A package still needs its trusted publisher on npm.

### Keeping them in line

`drift` reads and `align` writes, each for every repository or the ones named.

- **drift** checks every repository's files, from GitHub's `main`, or from a folder named on the command line, to see a fix before it's pushed. With `gh` logged in it checks the merge settings too, and with `cf` the Workers' build settings, and without a login it says what it couldn't check.
- **align** brings each repository in line with the reference, from a fresh clone of each `main`. Every shared tool, the override and the editor settings come from the reference, and each repository's own libraries move within their majors. A pull request opens where `verify` passes, with auto-merge on, and lists any new major left for review. GitHub's settings and the Worker's are written directly, since there's no file to review.

A change to the rules, like a new check, is a pull request to craftz, and the next `align` carries it.

### Following it unlisted

A private repository can follow these rules without joining `REPOS`, since craftz is public and would name it. `drift <folder>` checks it from disk, everything but its branch rules and labels, which `align <repo>` still writes. Where it can't follow a rule, its own docs say which and why.

### Starting one

`new` starts a repository that already follows these rules, in the folder next to the current one.

```sh
new <name> --package --description "What it is, in a sentence." --push
new <name> --package --site static --description "What it is, in a sentence." --push
new <name> --site static --internal --description "What it is, in a sentence." --push
new <name> --private --description "What it is, in a sentence." --push
```

The flags are [the axes](#axes). `--package` publishes it and `--site static` deploys a static site, and with neither, it's scripts run on a laptop. `--private` makes the repository private on GitHub and leaves it out of `REPOS`. `--internal` says in a site's config that it's behind Access, and the Access application is the step left to do by hand.

It writes only what's the repository's own: its name and description, its source, its Vite config and strict types, and CI. Each is built from the reference's files rather than a template. Then it runs every rule's fix, the ones `align` runs. They write the rest: the versions and engines, the shared scripts, the editor settings, the cooldown, the shared `AGENTS.md` sections, a package's release files and packing, and a first version of each doc. So a new repository can't follow the rules any less than `align` makes an old one. Then it installs, formats with `fix`, runs `verify` and makes the first commit. `--push` creates the repository on GitHub, pushes that commit and writes its GitHub settings, as `align` does. That first push is the only one to `main` the rules allow, since the rules aren't on yet. It prints what's left: adding the repository to `REPOS`, and the Worker or npm's setup. A SvelteKit app starts from base instead, and is brought in like any other.

`new`'s test generates a package, a static site, a package with a site, scripts in a private repository and an internal site. It checks each against the survey and runs its `verify`, so the generator can't fall behind the rules.
