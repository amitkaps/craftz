# Rules

How every repository builds, checks, deploys and releases, and the practice its code follows. There's one way to do each thing. Each repository's `craftz check` lists where it has drifted from these rules, `craftz settings --check` does the same for its settings, and `align` brings every repository back in line. [Usage](usage.md) says how to run them.

The repositories are the owner's public ones with the GitHub topic `craftz`, which [src/survey.ts](../src/survey.ts) finds. Where this page gives a version, the real value is in [the reference](../reference/README.md), and `craftz check` reads it from there.

A rule `craftz check` checks is a list item that opens with its id as a span, like ``[`scripts-verify`]{#scripts-verify}``. An id is lowercase kebab case, its part and then its name, since an id can't hold a dot. Its first sentence is the rule, and the rest says why. `craftz check` prints the id on each line a repository drifted on, and `craftz rules <id>` prints the rule. The check, and the fix where one can be automated, are in [src/rules/](../src/rules/), under the same id.

## Axes

What a repository must have follows from four axes. Each is read from where it already lives, so none is declared twice, and each varies on its own.

| Axis       | Values               | Read from                                             |
| ---------- | -------------------- | ----------------------------------------------------- |
| publish    | package, or none     | `package.json` isn't `private`                        |
| deploy     | static, app, or none | the Worker config, and whether it has code of its own |
| audience   | public or internal   | Cloudflare Access, for each site                      |
| repository | public or private    | GitHub                                                |

- **Publish.** A package is published to npm, so its audience there is public. A private npm package would be a fifth value, and none is needed yet.
- **Deploy.** A site deploys to a Cloudflare Worker. One whose config names code to run, wrangler's `main`, is an [app](#an-app). One without is static, whatever builds its files, like [a prose site](#a-static-site) or a Vite page.
- **Audience.** A site is internal when Cloudflare Access covers its domain, as [Internal sites](#internal-sites) says. Audience applies only to a site.
- **Repository.** Whether the code is public is separate from whether the site is. A private repository can have a public site, and a public repository an internal one.

A package can have a site, like markz and its docs. A repository with neither is scripts run on a laptop. Where two axes meet badly, the pair is allowed, and what's lost is said where it applies. npm takes provenance only from a public repository, so a package in a private one publishes without it.

## Toolchain: Vite+

One `vite.config.ts`, run through `vp`, covers dev, build, format, lint and test. A package builds with `vp pack`, which is part of Vite+, so there's no separate bundler. `defineConfig` comes from `vite-plus`.

Vite+ ships its own build of Vite. Each repository points every `vite` at it with an override in `pnpm-workspace.yaml`, and turns off pnpm's peer checks for `vite`, since that build is an npm alias. Bump `vite-plus` and the override together, in every repository at once. A version that differs between repositories is the drift that makes Vite+ painful.

Formatting runs at oxfmt's defaults, but for one setting.

- [`toolchain-wrap`]{#toolchain-wrap}: `fmt` sets `proseWrap: "never"`, so each Markdown paragraph is one line that the editor soft-wraps. Nobody hand-wraps, and a changed paragraph shows in a diff as one line with its changed words highlighted. `"always"` would reflow the rest of a paragraph when one word is added. `@prose` comments stay hand-wrapped at 100 characters, since no oxfmt setting wraps comment text.

- [`toolchain-lint`]{#toolchain-lint}: lint is type-aware and type-checks too, so `check` covers types without a separate `tsc`. An empty block fails it, so an empty `catch` says why it takes every error, in a comment inside it, as [Silence is the failure](#silence-is-the-failure) asks.
- [`toolchain-types`]{#toolchain-types}: every `tsconfig.json` writes out the same compiler options, extends nothing, and sets its own `include`, the folders its code is in. The options are ESNext with the DOM's types and Node's, Bundler resolution, no emit, and the strict options. Those are `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules` and `forceConsistentCasingInFileNames`. JavaScript is checked as TypeScript is, with `allowJs` and `checkJs`. `erasableSyntaxOnly` keeps to the TypeScript Node runs as it is, so a `.ts` script needs no build. [The reference's tsconfig.json](../reference/tsconfig.json) is the example.

The lint block in `vite.config.ts`:

```ts
lint: {
  plugins: ["typescript", "unicorn", "import"],
  categories: { correctness: "error" },
  options: { typeAware: true, typeCheck: true },
  rules: { "no-empty": "error" },
},
```

The `fmt` and `lint` blocks are written out in each config, beside the repository's own keys, like `ignorePatterns`. `check` reads each value where it sits and names the ones that differ, and the fix writes them in. A block the config works out, like `lint: shared`, is set by hand. The values were a plugin's, `craftz()`, until they moved into the configs, so a repository's format and lint show in its own files, and don't change with craftz's version unseen.

- [`toolchain-craftz`]{#toolchain-craftz}: every repository on Vite+ depends on `@amitkaps/craftz`, for its commands, and its config imports nothing from it. craftz no longer exports the `craftz()` plugin, so the fix adds the dependency and takes the call and its import out. A config that said `craftz({ browser: true })` packs for `"neutral"` instead.

### The editor

- [`toolchain-editor`]{#toolchain-editor}: every repository has the reference's [.vscode/settings.json](../reference/.vscode/settings.json), the one Vite+ writes, and its [.vscode/extensions.json](../reference/.vscode/extensions.json), the same content, read as JSON. A repository that depends on Svelte adds [svelte/](../reference/svelte/README.md)'s, which format `.svelte` files and recommend Svelte's extension. The fix writes both whole.

The settings make oxc the formatter, on save, with its fixes. The extensions recommended are oxc's and Vitest's, by name, rather than Vite+'s extension pack, which only wraps the two and could add more without a change to these rules. The oxc extension then runs the repository's own `vp fmt` and `vp lint`, so the editor formats with the oxfmt Vite+ pins and the `fmt` block in `vite.config.ts`, the same as `check`.

Nothing about oxc goes in VS Code's user settings. A path to oxfmt there, or a config path, overrides every repository's own, and the editor formats differently from `check`.

### Browsers

Code shipped to browsers works in the browsers people use, with a floor for each engine rather than a date. Vite's default, Baseline Widely Available, waits 30 months for every browser and is frozen at each Vite major. But only one engine holds people back that long.

- **Blink**, which is Chrome, Edge, Opera, Samsung Internet and Android's WebView: the oldest Chromium released in the last 12 months. Chrome and Firefox release every two weeks now, so a count of versions shrinks each time they speed up, and a window of time doesn't. Samsung Internet runs on a Chromium about ten months old, which is why the window is a year.
- **Gecko**, which is Firefox: the oldest ESR Mozilla supports. It's the oldest Firefox that still gets fixes.
- **WebKit**, which is Safari and every browser on iOS, in-app browsers too: the newest release of the major two before the current one. An iPhone that a new iOS drops stays on its last major and keeps getting point releases, so that's the oldest Safari in use. Chrome on iOS and an app's WebView run this engine too, so it covers more people than Safari's own share.

- [`toolchain-browsers`]{#toolchain-browsers}: a build that bundles code for browsers targets these browsers. A site Vite bundles, static or an app, sets them in `build.target`. A package packs for Node, as `platform: "node"`, and sets no `pack.target`. One that runs in browsers too packs for `"neutral"`, and its `pack.target` is the browsers and the Node its `engines` names. Its `pack.deps.neverBundle` holds `/^node:/`, since Rolldown doesn't know Node's own modules on `"neutral"`, and warns on each one it's given. The fix writes either in, and keeps a package that targets a browser on `"neutral"`.

The list is worked out from MDN's browser-compat-data, by [src/browsers.ts](../src/browsers.ts), as of the date of the data. The package is one of craftz's own dependencies, so a craftz release moves it, and the floors move with it, with `craftz check` listing what then needs the new list.

A target only rewrites syntax, like CSS nesting or a regular expression's flags. It adds no polyfills, so it doesn't stop code that calls an API too new for a floor. Something newer than a floor, like `::highlight()` on Firefox's ESR, is fine where it fails cleanly and the page still works. The floor is for what has to work. A prose site's page scripts and styles aren't built by Vite, so the target doesn't reach them.

## pnpm and Node

`package.json` is the one place for both versions.

```json
"devEngines": {
  "packageManager": { "name": "pnpm", "version": "12.15.0", "onFail": "download" },
  "runtime": { "name": "node", "version": ">=26.12.1", "onFail": "error" }
},
"engines": { "node": ">=26.12.1" },
"packageManager": "pnpm@12.15.0"
```

- [`versions-pnpm`]{#versions-pnpm}: pnpm is pinned exactly, with `onFail: download`. Whatever pnpm is installed globally, pnpm fetches and runs the pinned one, so a new pnpm release never breaks a checkout. CI reads `packageManager`, so keep the two equal.
- [`versions-node`]{#versions-node}: `devEngines` asks for the reference's Node with `onFail: error`, and `engines` asks for the same. The wrong Node stops loudly. A package supports the Node it's built and tested on, and nothing older, so CI runs on one Node. Node 26 is the LTS release from October 2026, and the floor is 26.12.1, its October security release, which cf's beta needs too, where craftz works out the compatibility date. When the next LTS arrives, every repository moves to it at once, and for a package that's a breaking release.

Bump deliberately, everywhere at once. Being on the latest pnpm doesn't matter. Being on the same one does.

## Other versions

The tools every repository shares are on one version, written the same way, so moving one never leaves two repositories to reconcile. The reference's [package.json](../reference/package.json) has each at an exact version, not a range, so the version a repository names is the one it installs, and nothing moves but through a release of craftz. npm isn't read. A new release is drift only once the reference moves to it, past pnpm's one-day wait. Our own markz and prose may lead the reference, so a package that builds on one can take its release before craftz does.

- [`versions-types-node`]{#versions-types-node}: `@types/node` is the reference's, where a repository has it. It's the major of the Node that `engines` allows, so code can't use newer APIs.
- [`versions-vite-plus`]{#versions-vite-plus}: every repository is on the reference's `vite-plus`, with no direct `vite`. pnpm's settings point `vite` at it, by `versions-workspace`. [Toolchain](#toolchain-vite) says why.
- [`versions-typescript`]{#versions-typescript}: `typescript` is the reference's, where a repository has it.
- [`versions-prose`]{#versions-prose}: `@amitkaps/prose` is an exact version, at least the reference's, where a repository has it.
- [`versions-markz`]{#versions-markz}: `@amitkaps/markz` is an exact version, at least the reference's, where a repository has it.
- [`versions-craftz`]{#versions-craftz}: `@amitkaps/craftz` is at craftz's own version, exactly, so the rules a repository names are the rules it's checked against, and a release of craftz is what moves every repository to them.
- [`versions-cf`]{#versions-cf}: `cf` is the reference's, where a repository has it. None does, craftz included. craftz runs the reference's version to write the Workers' settings, and reads the compatibility date from the workerd it depends on.
- [`versions-beta`]{#versions-beta}: only `cf` is on a pre-release, pinned to an exact build.
- [`versions-wrangler`]{#versions-wrangler}: `wrangler` is the reference's, while a repository is still on it.
- [`versions-publint`]{#versions-publint}: `publint` is the reference's, where a package has it.

A beta's tags don't say which build goes with which, so it's moved by hand. `align` lists one in its pull request once npm's latest is a release, and then it leaves `versions-beta`. [Development](development.md#beta-packages) says how.

A repository's own libraries, like svelte or micromark, are its own to choose. `align` moves them within their major version, and lists a new major in its pull request for review.

`pnpm-workspace.yaml` is a settings file, not a workspace. Every repository has the same three settings: the cooldown, `allowBuilds` and the Vite+ override. `allowBuilds` lets esbuild and workerd run their install scripts, where wrangler or cf is installed, and does nothing where neither is.

- [`versions-workspace`]{#versions-workspace}: `pnpm-workspace.yaml` is [the reference's](../reference/pnpm-workspace.yaml), word for word, with the override at the repository's own `vite-plus`. The fix writes it whole. A setting a repository wants for itself is a change to these rules.

- **The cooldown.** pnpm's one-day wait on a new version is kept, with only `@amitkaps/*` excluded. A hijacked release can be pulled before it's installed, and our own skip the wait, since each reaches npm only after the owner approves it. The wait guards the libraries and nested packages, hundreds in each lockfile, that `align` moves without review. The shared tools are few, and `pnpm bump` moves them when they're wanted, so a day costs them little. A shorter wait, and leaving the shared tools out of it, are ruled out. Any number of hours is as arbitrary as pnpm's, and the shared tools do the most when they run.

## Holds

When a tool a repository depends on keeps it from a rule, the repository holds the rule, in its own `package.json`, with the reason. The reason says when to look again, like svelte-check accepting TypeScript 7. `craftz check` prints a held rule's drift as a warning, with its reason, and still passes.

```json
"craftz": {
  "hold": {
    "versions-typescript": "svelte-check accepts TypeScript 5 and 6 only. Move when its peer range takes 7."
  }
}
```

Only a rule a tool can block can be held: a tool's version, other than craftz's own, `cloudflare-config` and `toolchain-types`. A hold on any other rule fails `craftz check`.

A hold is for what a tool can't do, never for a preference. The point of one set of rules is that a choice like Vite+ is made once and paid for once, not argued again in each repository. A hold whose check stops drifting fails `craftz check` until it's removed, so none outlives its reason.

## Scripts

Every repository uses these names, and runs them with `pnpm run …` in anything automated.

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

- [`scripts-required`]{#scripts-required}: `check`, `fix`, `verify` and `prose` are in every repository, `dev` and `build` in every site and package, and `ship` in every site. A tool has nothing to serve or build, so its `verify` runs `check` and `test`. `test` is there when there are tests.
- [`scripts-check`]{#scripts-check}: on Vite+, `check` runs `vp check`, then `pnpm prose check` and `pnpm craftz check`. A framework can add its own steps around `vp check`, like SvelteKit's `svelte-kit sync` before and `svelte-check` after. prose check fails on what the text gets wrong, which `prose build` only prints, so a mistake in a doc or a comment stops a merge the way a lint error does. craftz check fails on what has drifted from the rules of the craftz the repository installs, so a pull request can't drift, and one that moves craftz is checked against the release it moves to. Neither needs a login, and neither writes a file, so `check` only reads. prose's own repository builds its command line before it can check itself, so its prose check is a task of its own. The fix adds each missing step at the end.
- [`scripts-fix`]{#scripts-fix}: on Vite+, `fix` is exactly `vp check --fix`.
- [`scripts-one-checker`]{#scripts-one-checker}: on Vite+, there are no `lint` or `fmt` scripts. `check` and `fix` cover both, and a framework adds no second formatter or linter.
- [`scripts-verify`]{#scripts-verify}: on Vite+, `verify` is exactly `vp run --log grouped all`. `all` is a task in `vite.config.ts`, with its cache off, whose `dependsOn` names `check`, and `test`, `build` and `site` where the repository has them. Vite+ runs them side by side, four at a time, and prints each one's output whole. So `verify` takes as long as its slowest script, not all of them, and `package.json` and the config say what it runs. A step that needs another done first, like a size budget after `build`, is a task of the repository's own in the config, with its own `dependsOn`. The fix drops the steps a chained `verify` ran that `check` runs now, and the outline, and makes `prose build` the `site` script. When what's left is `check`, `test`, `build` and `site` in that order, it moves to `all`. Otherwise the check names each step that's left: one of the repository's own, or one that ran after a step it may need. Each is moved by hand, since only the repository knows what a step needs done first.
- [`scripts-prose`]{#scripts-prose}: `prose` is exactly `prose`, so `pnpm prose build` works, and `outline` is exactly `prose outline`. prose's own repository runs its command line from source.
- [`scripts-preview`]{#scripts-preview}: `preview` is a site's, the same as the reference's. A package, whose build is `dist/`, has none.
- [`scripts-pr`]{#scripts-pr}: `pr` is `craftz pr`, and there's no `scripts/pr.ts`. `pnpm pr "<title>"` starts a branch when it's on `main`, or on a branch whose pull request merged. On a branch whose pull request is open, it adds to it when given the same title, and with another it waits for that one to merge and then starts a branch. It commits, runs `verify`, pushes, opens the pull request and turns on auto-merge, then returns, so the next change starts while CI runs. It says how long `verify` took, and a wait says how long CI took and how long the merge came after it. A package's pull request takes `--label <label>`, and stops without one, before anything is committed. `--wait` waits for the merge, updating the branch when another merge leaves it behind `main`, and merging it once its checks pass rather than waiting on auto-merge. Then it switches to `main` and pulls. It talks to GitHub through the REST API, so it runs the same in a Claude Code cloud session, whose proxy refuses GraphQL. A session's last change takes it. craftz's own repository runs it from source.
- [`scripts-gone`]{#scripts-gone}: `gone` is `craftz gone`, and there's no `scripts/gone.ts`. It deletes each local branch that merged: its branch on GitHub is gone, its last commit is a merged pull request's, or it's on `main`. `craftz pr` runs it first. It works where no git alias is set, like an agent's machine. craftz's own repository runs it from source.
- [`scripts-craftz`]{#scripts-craftz}: `craftz` is exactly `craftz`, so `pnpm craftz rules`, `pnpm craftz check` and the rest work, as `pnpm prose` does for prose. craftz's own repository runs it from source.
- [`scripts-ship`]{#scripts-ship}: a site's `ship` is `craftz deploy`, which uploads the folder a `cloudflare.config.ts` names itself, or runs `wrangler deploy` for a `wrangler.toml`. The Worker's deploy command is `pnpm run ship`, so how a site deploys moves with craftz, not with each repository. craftz's own repository runs it from source.
- [`scripts-pnpm-names`]{#scripts-pnpm-names}: no script is named `deploy`, `publish`, `audit`, `ci`, `pipeline` or `pack`. Those are pnpm's own commands, and `pnpm <name>` skips a script by one of those names.

Text the repository didn't write, like a test corpus or a fixture that's wrong on purpose, is marked `linguist-vendored` in `.gitattributes`, and `prose check` skips it. Any other script is the repository's own, like a package's `size` or `fuzz`.

`verify` is what CI runs and what Cloudflare runs before each deploy, so the two can't disagree. `ship` never builds.

A lifecycle script, one pnpm runs on its own like `prepare` on install or `prepack` before packing, only does what another step needs first. base's `prepare` generates the types SvelteKit and the Worker need, so a fresh clone type-checks. A package's `prepack` is `pnpm run build`, so a tarball never ships a stale `dist/`. Neither builds a site or deploys.

### A run removes what it writes

A temporary folder, a clone or a stale lockfile entry outlived the run that made it, and each held tens of gigabytes before anyone looked. So a run removes what it wrote when it ends, and keeps only what it says it kept, and where. Nothing in a repository's files shows it, so it has no id. craftz's own commands take each folder from one module, and a test fails a folder made anywhere else.

## Cloudflare

A repository with a site deploys it to a Cloudflare Worker with static assets.

- [`cloudflare-config`]{#cloudflare-config}: a site deploys with `cloudflare.config.ts`. It's written as cf's config is, `export default { worker: {…} }`, with no import, so the deploy reads nothing from craftz. It holds the Worker's name, domains and the folder it serves, as `assets.directory`. cf has no field for the folder yet, and a site keeps it there until cf does.
- [`cloudflare-site`]{#cloudflare-site}: a static site's Worker writes out its compatibility date, the build date of the workerd that the reference's cf depends on, so a site moves to a newer date with craftz's fix. It sets `workersDev` and `previewUrls` to false, so the site answers only on its domain. Nothing uses the other addresses, and each would serve the site outside anything that covers the domain, like Access. The fix writes in what differs, and turns a config that calls `site()` into cf's.
- **Deploys:** the Worker's Git integration (Workers Builds) builds and deploys `main`. There's no deploy step in GitHub Actions, and no API token or secret: `craftz deploy` uses the API token the Worker's build settings name, which Workers Builds sets for the deploy command. The same token is on every Worker.
- **The Worker's settings** are the same on every Worker. Cloudflare's config has no field for them, so `align` writes them with `cf`, and `craftz settings --check` reads them. Only connecting the Worker to its repository is left to Cloudflare's dashboard.

```text
Build command      pnpm run verify
Deploy command     pnpm run ship
Root directory     /
NODE_VERSION       26
Build cache        on
Previews           off
```

`verify` fails on a failing check, so a merge that breaks one doesn't deploy. Previews stay off because CI already checks every pull request. If a public repository turns them on, it sets the preview deploy command too, which for a static site is a change to `craftz deploy`, and for an app `pnpm exec wrangler versions upload`.

### A static site

A static site is one folder, however it's built: by Vite from an `index.html`, by a plugin like Sitez or Pagez, or by `prose build`. `cloudflare.config.ts` names the folder as `assets.directory`, and `craftz deploy` uploads it, with Cloudflare's API, as `cf deploy` would. Nothing from Cloudflare is installed: cf, Cloudflare's plugin and wrangler bring workerd, which is most of a site's install, and a static site runs no code of its own for it to run. A prose site's config is:

```ts
export default {
  worker: {
    name: "prose",
    domains: ["prose.amitkaps.com"],
    assets: { directory: ".prose" },
    compatibilityDate: "2026-10-19",
    workersDev: false,
    previewUrls: false,
  },
};
```

- [`cloudflare-static`]{#cloudflare-static}: a static site depends on none of cf, `@cloudflare/vite-plugin` and wrangler, and its `vite.config.ts` doesn't load Cloudflare's plugin. A site with no `index.html` doesn't run `vp build` unless SvelteKit builds it, since Vite has nothing else to build. The fix removes them, and the ` && vp build` that ends `verify` or `build`.

A site with an `index.html` is Vite's own build, and serves `dist`. A SvelteKit app that runs only in the browser builds with the static adapter, and serves `build`. A prose site's `verify` ends with `pnpm prose build`, and anything that adds to the site, like markz's Quality page, runs after it. `ship` is `craftz deploy`.

### An app

A site that needs code on the server starts from base: SvelteKit with `adapter-cloudflare`, which writes a Worker as well as the files. It's kept for when one is needed. `craftz deploy` uploads only files, so base stays on `wrangler.toml` and `wrangler deploy`, held, and its `check` runs `wrangler types` for the Worker's types.

### Internal sites

Any site can be public or internal, in a public repository or a private one. An internal site is one that Cloudflare Access covers, and it's deployed like any other.

- **Access covers its domain.** A Cloudflare Access application on the site's domain, with a policy that lets in only who it's for. Access is turned on once per account, in the Zero Trust dashboard.
- **Its other addresses are off,** as on every site, by `cloudflare-site`. Access covers the domain, not the Worker, so `workers.dev` or a preview URL would serve the site without a login.

The config says so in its `@prose` comment. With `cf` logged in, `craftz status` looks up Access for the site's domain and says whether it's public or internal, so a site meant to be internal doesn't go public unseen. An application with no policy is marked, since it lets nobody in.

## GitHub

Every `main` takes changes the same way. Work happens on a branch, in a pull request, and `ci` has to pass on a branch that's up to date with `main`. The pull request is squash-merged, so `main` reads as one commit per change, and nobody pushes to it, admins included.

- [`github-rules`]{#github-rules}: `main` has one ruleset, named `main`, from [.github/ruleset.json](../reference/.github/ruleset.json). It requires a pull request with no approvals, since there's one maintainer, and the `ci` check, and a package's the `label` check too. It keeps history linear, and blocks force pushes and deleting the branch. Nobody bypasses it.
- [`github-ci`]{#github-ci}: `.github/workflows/ci.yml` is [the reference's](../reference/.github/workflows/ci.yml), word for word, and there's no Dependabot, since versions move in the reference first. The fix writes it whole. A step a repository adds goes in `verify`, so CI is the same everywhere. A workflow of the repository's own, like markz's fuzz search, is its own.
- **Merge settings:** from [.github/settings.json](../reference/.github/settings.json). Squash is the only merge, a branch is deleted once it's merged, and auto-merge is on. The topic `craftz` goes with them, so `align` finds the repository.

`craftz settings` writes both for one repository, and asks before removing classic branch protection. `align` writes both to every repository or to the ones named, and removes classic protection without asking. `craftz settings --check` reads both. GitHub shows the branch rules to anyone, but the merge settings only to the owner, so it needs `gh`'s login. A check GitHub's rate limit stopped shows as not checked, not as drift.

## Agents

- [`agents-sections`]{#agents-sections}: every `AGENTS.md` opens with the same two sections as [the reference's](../reference/AGENTS.md), word for word, and `CLAUDE.md` holds only `@AGENTS.md`, so Claude Code reads the same file.
- [`agents-outline`]{#agents-outline}: `.gitignore` lists `outline.md`. `pnpm outline` writes it, and so do `pr`, `gone` and `new`, so a committed copy would conflict between two open pull requests that each change a summary. `verify` only checks, so it doesn't write it. The fix adds it.

"craftz" points at these rules, and says how changes reach `main`. "Prose" says when to run `prose rules`, which prints the rules in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents) as the installed version has them. The rules live there, once, and aren't copied into each repository, since the copies had already started to differ. It names the first edit to a `.md` file or a `@prose` comment, and the first after a summary, since agents skipped the rules when told only "before writing prose". A code change counts as an edit only when it changes what the comment states, so a rename or a lint fix skips the rules. It also says to run `prose style`, which is advice, so it isn't a script or a check, and that `prose check` is the one that fails. A bullet under "Prose" says `outline.md` is there, every file with its summary, and doesn't import it. Across 21 sessions on craftz and visframe, with the outline loaded, left out or named in a bullet, an agent found the same files and never opened it unprompted, so an import cost 6k to 20k tokens in every session for nothing. Each section is short, since every agent loads the file every session. What a command does is in its `help`. The rest of an `AGENTS.md` is the repository's own.

## Docs

Explanations live in `@prose` comments, beside the code or setting they explain, and docs that span files live in `docs/`. Both are written in [markz](https://markz.amitkaps.com)'s Markdown, and `pnpm prose` reads them as one document. `package.json` has no comments, so its scripts are explained in these rules. A hand-written `.html` page ships its comments, so it has no prose.

Every repository has the same docs, so anyone, or any agent, finds the same things in the same places.

- [`docs-files`]{#docs-files}: `docs/` has `design.md`, `plan.md`, `development.md` and `lessons.md`, and a package's has `usage.md`. Each is in the `nav` of `docs/README.md`, and `README.md` links to `docs/`.

| File | Holds |
| --- | --- |
| `README.md` | what it is, how it's used, and a link to `docs/` |
| `docs/README.md` | the docs in reading order: `nav` in its metadata, and a line for each |
| `docs/design.md` | what it is, why it's built this way, and what it isn't |
| `docs/plan.md` | its own next steps in order, then what works now, later and open, not other repositories' |
| `docs/development.md` | only what's its own: its extra scripts, its site, beyond these rules |
| `docs/lessons.md` | what building it taught, each lesson what went wrong and what to do about it |
| `docs/usage.md` | a package's install and use, and a section for agents |

The README is the site's home page when prose builds it, so it reads as one. It says what it is, gives a short example, and lists the commands a user runs, like a package's command. The repository's own scripts, like `dev` and `verify`, are the shared ones, and are left to `development.md`, which links these rules for the shared toolchain, scripts and workflows rather than describing them.

The plan opens with what's next, since that's what it's read for. Its "Where it is" holds one line per thing that works now, rewritten when a release changes it, not a line per release. A release's notes on GitHub already say what it changed, and the plan links to them rather than copying them.

A lesson is for what the next change would get wrong without it, so a change that went as planned adds none. It says what went wrong and what to do, in a few sentences. What the code does now is in its `@prose`, and the story is in the pull request. Lessons are grouped under the principle in [Practice](#practice) each one shows, with headings of the repository's own for the rest, and a tool's facts under its name. A lesson its group already has gets the new case as a sentence, and its principle gets a check, a command or a line in `AGENTS.md`. A lesson is a doc, so one that reverses another rewrites it, and a fact about a tool goes once the tool changes.

- [`docs-lessons`]{#docs-lessons}: a link from `docs/lessons.md` into these rules names an id or a heading they have, in the craftz a repository installs. A group of lessons links the principle in [Practice](#practice) it shows, so a principle renamed here fails where it's linked. prose checks only a relative link, and another repository links this page by its address.

- [`docs-plan`]{#docs-plan}: each step in the plan's Next is a task, `- [ ]`, ticked as the pull request that finishes it merges. Before a release, the ticked steps move into "Where it is" and the summary names the version. `craftz release` stops until both are done, so the plan is current before each release, not after. The fix turns a numbered or plain step into a task.

A site has no `usage.md`, since the site is what people use, unless it has commands to run. Any other doc is the repository's own, like markz's grammar, and goes in the `nav` too. `development.md` links to these rules for what's shared rather than repeating it. `docs-files`'s fix writes a first version of each one that's missing, and adds it to the `nav`, so `new` starts with all of them.

The docs are published at `/docs/<file>.md`, so a link to one works on GitHub and on the site alike.

- **A package's site is `prose build`,** the repository read as a document, with nothing added to it. Its docs are in the bar, and its code is a page away.
- **A site shows its docs its own way,** read from `docs/`, so GitHub and the site have one set of files. base renders them with SvelteKit, as the starter it is.
- **A page the build fills in is a doc with a section for it.** The doc holds the words and an empty `{@section}` for each table, so prose builds it with its bar and styles. A script fills the sections in the page prose wrote, and a ` ```=html ` block holds its styles.

## Releases

markz, prose and pagez are packages, published to npm. A package is any repository whose `package.json` isn't private, and every one releases the same way.

- [`releases-files`]{#releases-files}: The release files are [the reference's package/](../reference/package/README.md), copied into the package unchanged: the release workflow, `.github/notes.yml`, which groups the notes, and the `label` workflow, which checks a pull request has one. The notes' config isn't GitHub's default `.github/release.yml`, which reads as the release workflow, so the workflow passes its path, and the fix deletes a `release.yml` left from before. They name no package, so the copies stay identical and the survey checks them word for word. The fix writes them whole.
- [`releases-packing`]{#releases-packing}: A package packs `dist` with publint. `files` is `["dist"]`, followed only by what the package reads as it runs, like craftz's `docs/rules.md`. `prepack` is `pnpm run build`, and `publishConfig.access` is `public`. `pack.publint` is `{ strict: true }`, so `vp pack` runs publint, strict, and `build` fails on a package npm would serve badly, and there's no separate publint step. The package has `publint` as a dev dependency. The fix writes the fields and the `publint` block.
- [`releases-types`]{#releases-types}: Types come from Oxc. A package's `pack` sets `dts: { generator: "oxc" }`, which the fix writes in, so `vp pack` writes the `.d.ts` files without the TypeScript compiler, and fails on an export whose type isn't written out. It's set there, not as `isolatedDeclarations` in `tsconfig.json`, which the editor would apply to tests and config too. A package has no `typescript` dependency, like a site: `vp check` type-checks with tsgolint, which Vite+ installs.
- [`releases-bundled`]{#releases-bundled}: Our own packages are bundled, not depended on. prose, pagez and craftz have markz as a dev dependency, and `vp pack` puts it inside `dist/`. So a package's users never install a second markz, and each package releases on its own, in any order. Picking up a new markz takes a release of the package that bundles it.

To release, run `craftz release` in the package with its new version.

```sh
pnpm craftz release 0.5.0 --notes "What to change when you upgrade …"
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

A pull request's title is its line in the notes, so a user-facing one is written for the package's users. `label` fails until a package's pull request has exactly one of these labels, and adding one runs it again, so a release's notes are right when it's tagged, not fixed after. A site or a tool has no release notes, so its pull requests need no label.

### Setting up a new package

`new` copies in the reference's `package/` files, through `releases-files`'s fix, and `align <repo>` makes the labels. A package that isn't on npm yet doesn't release on a merge, since npm trusts the workflow only once the package exists. On npmjs.com, add a trusted publisher for the repository and the workflow `release.yml`, with direct publishing and dist-tags left unchecked, so staging is all it can do. npm may not take that before the package exists. Then publish the first version by hand, from a folder outside the repository, since `npm` refuses to run where `devEngines` names pnpm.

```sh
pnpm pack && cd /tmp && npm login && npm publish ~/code/<repo>/amitkaps-<repo>-<version>.tgz --access public
```

The next merge that changes `package.json` finds that version on npm with no tag, so it skips staging and tags it, with a GitHub Release.

## CI

GitHub Actions runs one job, named `ci`, on pull requests and on `main`. It installs with `pnpm install --frozen-lockfile` and runs `pnpm run verify`, and nothing else. What a package adds, like publint or a size budget, runs in `verify`, so CI is the same in every repository. It doesn't check the label, or run again when one changes, so a pull request opened with its label runs `verify` once. In a package, a second workflow, `label`, checks the pull request has one [release-notes label](#release-notes), and runs again when a label changes, without installing anything. The `main` ruleset requires `ci`, and a package's `label` too. Cloudflare's own check on each commit isn't required, since it runs after the merge.

`verify` takes 10 seconds or less on CI, in every repository. `pnpm pr` waits on it, and under 10 seconds the change is still in mind when it's done. It's one budget, measured the same way everywhere. A repository with more to check makes its checks faster, rather than taking a larger budget. A slow `verify` never fails CI, since a runner's time varies from run to run, and the change that crosses the line is rarely the one that made it slow. `craftz status` notes one over the budget, and a repository that stays over says why in its lessons. Moving slow tests out of `verify`, to a nightly run, is ruled out, since CI would then differ by repository, and a regression would show a day late. The job stops at 10 minutes, which is for a job that hangs, not a budget.

## Practice

How a repository's code is written, from what its lessons taught. Each principle here was learned in more than one repository before it was written down. There are ten, for three moments of a change: before the code, while writing it, and after it runs.

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

A warning nobody has to read is never read, and a catch that takes every error hides the one that mattered. So a check fails where it can't be sure, and a tool warns only where a rewrite would help. A run says everything it found and what it didn't check. A check that can't fail isn't a check, so fix it or remove it. Catch only the error you expect, beside the call that throws it.

## Repositories

Every public repository that follows these rules has the GitHub topic `craftz`, so `align` moves it. Writing its GitHub settings adds the topic, and archiving it drops the repository from the list. A repository joins one of two ways, and both end the same: listed, protected, and passing `craftz check` and `craftz settings --check`.

### Bringing one in

1. Run `craftz settings` in it, which adds the topic along with the rest of GitHub's settings. Then `craftz upgrade`, which adds craftz and its fixes, and lists what's left by hand.
2. Fix what's left, in the repository's own pull requests. Where a tool can't meet a rule yet, add a hold rather than a workaround.
3. Connect a site's Worker to the repository, in Cloudflare's dashboard.
4. Run `align <repo>`, for the branch rules, a package's labels and the Worker's build settings. A package still needs its trusted publisher on npm.

### Keeping them in line

Each repository checks its own files in CI, with `craftz check` against the craftz it installs, so a pull request can't drift from the rules it names. What needs a login stays on the laptop.

- **`craftz settings --check`** reads one repository's settings on GitHub and its Worker, and `craftz status` what's live.
- **align** brings each repository in line with the reference, from a fresh clone of each `main`. Every shared tool, the override and the editor settings come from the reference, and each repository's own libraries move within their majors. A pull request opens where `verify` passes, with auto-merge on, and lists any new major left for review. GitHub's settings and the Worker's are written directly, since there's no file to review. `align --local` changes nothing, and lists every repository's settings that have drifted.

A change to the rules, like a new check, is a pull request to craftz. It reaches the others in craftz's next release, which `align` moves them to.

### Following it unlisted

A private repository can follow these rules without being listed, since craftz is public and would name it. The list only reads public repositories, so a private one's topic doesn't put it there. Its own `craftz check` and `craftz settings` work as in any repository, and `align <repo>` still writes its settings. Where it can't follow a rule, its own docs say which and why.

### Starting one

`new` starts a repository that already follows these rules, in the folder next to the current one.

```sh
new <name> --package --description "What it is, in a sentence." --push
new <name> --package --site static --description "What it is, in a sentence." --push
new <name> --site static --internal --description "What it is, in a sentence." --push
new <name> --private --description "What it is, in a sentence." --push
```

The flags are [the axes](#axes). `--package` publishes it and `--site static` deploys a static site, and with neither, it's scripts run on a laptop. `--private` makes the repository private on GitHub, which keeps it off the list. `--internal` says in a site's config that it's behind Access, and the Access application is the step left to do by hand.

It writes only what's the repository's own: its name and description, its source, its Vite config and strict types, and CI. Each is built from the reference's files rather than a template. Then it runs every rule's fix, the ones `align` runs. They write the rest: the versions and engines, the shared scripts, the editor settings, the cooldown, the shared `AGENTS.md` sections, a package's release files and packing, and a first version of each doc. So a new repository can't follow the rules any less than `align` makes an old one. Then it installs, formats with `fix`, writes the outline, runs `verify` and makes the first commit. `--push` creates the repository on GitHub, pushes that commit and writes its GitHub settings, as `align` does. That first push is the only one to `main` the rules allow, since the rules aren't on yet. Its settings add the topic, so `align` finds it. It prints what's left: the Worker or npm's setup. A SvelteKit app starts from base instead, and is brought in like any other.

`new`'s test generates a package, a static site, a package with a site, scripts in a private repository and an internal site. It checks each against the survey and runs its `verify`, so the generator can't fall behind the rules.
