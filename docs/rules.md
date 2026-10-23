# Rules

How every repository builds, checks, deploys and releases. There's one way to do each thing. Each repository's `craftz check` lists where it has drifted from these rules, `craftz settings --check` does the same for its settings, and `align` brings every repository back in line. [Usage](usage.md) says how to run them.

The repositories are the owner's public ones with the GitHub topic `craftz`, which [src/survey.ts](../src/survey.ts) finds. Where this page gives a version, the real value is in [the reference](../reference/README.md), and `craftz check` reads it from there.

A rule `craftz check` checks is a list item that opens with its id as a span, like ``[`scripts-verify`]{#scripts-verify}``. An id is lowercase kebab case, its part and then its name, since an id can't hold a dot. Its first sentence is the rule, and the rest says why. `craftz check` prints the id on each line a repository drifted on, and `craftz rules <id>` prints the rule. The check, and the fix where one can be automated, are in [src/rules.ts](../src/rules.ts), under the same id.

## Axes

What a repository must have follows from four axes. Each is read from where it already lives, so none is declared twice, and each varies on its own.

| Axis       | Values               | Read from                                             |
| ---------- | -------------------- | ----------------------------------------------------- |
| publish    | package, or none     | `package.json` isn't `private`                        |
| deploy     | static, app, or none | the Worker config, and whether it has code of its own |
| audience   | public or internal   | Cloudflare Access, for each site                      |
| repository | public or private    | GitHub                                                |

- **Publish.** A package is published to npm, so its audience there is public. A private npm package would be a fifth value, and none is needed yet.
- **Deploy.** A site deploys to a Cloudflare Worker. One whose config names code to run, cf's `entrypoint` or wrangler's `main`, is an [app](#an-app). One without is static, whatever builds its files, like [a prose site](#a-static-site) or a Vite page.
- **Audience.** A site is internal when Cloudflare Access covers its domain, as [Internal sites](#internal-sites) says. Audience applies only to a site.
- **Repository.** Whether the code is public is separate from whether the site is. A private repository can have a public site, and a public repository an internal one.

A package can have a site, like markz and its docs. A repository with neither is scripts run on a laptop. Where two axes meet badly, the pair is allowed, and what's lost is said where it applies. npm takes provenance only from a public repository, so a package in a private one publishes without it.

## Toolchain: Vite+

One `vite.config.ts`, run through `vp`, covers dev, build, format, lint and test. A package builds with `vp pack`, which is part of Vite+, so there's no separate bundler. `defineConfig` comes from `vite-plus`.

Vite+ ships its own build of Vite. Each repository points every `vite` at it with an override in `pnpm-workspace.yaml`, and turns off pnpm's peer checks for `vite`, since that build is an npm alias. Bump `vite-plus` and the override together, in every repository at once. A version that differs between repositories is the drift that makes Vite+ painful.

Formatting runs at oxfmt's defaults, but for one setting.

- [`toolchain-wrap`]{#toolchain-wrap}: `fmt` sets `proseWrap: "never"`, so each Markdown paragraph is one line that the editor soft-wraps. Nobody hand-wraps, and a changed paragraph shows in a diff as one line with its changed words highlighted. `"always"` would reflow the rest of a paragraph when one word is added. `@prose` comments stay hand-wrapped at 100 characters, since no oxfmt setting wraps comment text.

- [`toolchain-lint`]{#toolchain-lint}: lint is type-aware and type-checks too, so `check` covers types without a separate `tsc`.
- [`toolchain-types`]{#toolchain-types}: every `tsconfig.json` extends `@amitkaps/craftz/tsconfig.json` and sets only `include`, the folders its code is in. craftz's tsconfig sets the rest, the same everywhere: ESNext with the DOM's types and Node's, Bundler resolution, no emit, and the strict options. Those are `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules` and `forceConsistentCasingInFileNames`. JavaScript is checked as TypeScript is, with `allowJs` and `checkJs`. `erasableSyntaxOnly` keeps to the TypeScript Node runs as it is, so a `.ts` script needs no build. [The reference's tsconfig.json](../reference/tsconfig.json) is the example.

The lint block in `vite.config.ts`:

```ts
lint: {
  plugins: ["typescript", "unicorn", "import"],
  categories: { correctness: "error" },
  options: { typeAware: true, typeCheck: true },
},
```

`craftz()` in the config's `plugins` sets the `fmt` and `lint` blocks, so a config with it holds neither. It fills in only what the config leaves unset, and fails a config that sets one of them differently, naming the key.

- [`toolchain-craftz`]{#toolchain-craftz}: every repository on Vite+ depends on `@amitkaps/craftz` and puts `craftz()` first in its config's `plugins`, so its format, lint and site build come from the version it installs. craftz's own config imports the plugin from source. The fix adds both. A key the config sets that the plugin sets differently fails the config, and is settled by hand.

### The editor

- [`toolchain-editor`]{#toolchain-editor}: every repository has the reference's [.vscode/settings.json](../reference/.vscode/settings.json), the one Vite+ writes, and its [.vscode/extensions.json](../reference/.vscode/extensions.json), the same content, read as JSON. An app adds [app/](../reference/app/README.md)'s, which format `.svelte` files and recommend Svelte's extension, since every app starts from base. The fix writes both whole.

The settings make oxc the formatter, on save, with its fixes. The extensions recommended are oxc's and Vitest's, by name, rather than Vite+'s extension pack, which only wraps the two and could add more without a change to these rules. The oxc extension then runs the repository's own `vp fmt` and `vp lint`, so the editor formats with the oxfmt Vite+ pins and the `fmt` block in `vite.config.ts`, the same as `check`.

Nothing about oxc goes in VS Code's user settings. A path to oxfmt there, or a config path, overrides every repository's own, and the editor formats differently from `check`.

### Browsers

Code shipped to browsers works in the browsers people use, with a floor for each engine rather than a date. Vite's default, Baseline Widely Available, waits 30 months for every browser and is frozen at each Vite major. But only one engine holds people back that long.

- **Blink**, which is Chrome, Edge, Opera, Samsung Internet and Android's WebView: the oldest Chromium released in the last 12 months. Chrome and Firefox release every two weeks now, so a count of versions shrinks each time they speed up, and a window of time doesn't. Samsung Internet runs on a Chromium about ten months old, which is why the window is a year.
- **Gecko**, which is Firefox: the oldest ESR Mozilla supports. It's the oldest Firefox that still gets fixes.
- **WebKit**, which is Safari and every browser on iOS, in-app browsers too: the newest release of the major two before the current one. An iPhone that a new iOS drops stays on its last major and keeps getting point releases, so that's the oldest Safari in use. Chrome on iOS and an app's WebView run this engine too, so it covers more people than Safari's own share.

- [`toolchain-browsers`]{#toolchain-browsers}: a build that bundles code for browsers targets these browsers. `craftz()` sets them for every static site, and for a package that says `craftz({ browser: true })`, which also packs it for any platform and adds the Node its `engines` names. An app, which Vite bundles from source, sets them in `build.target`. Every other package packs for Node, and sets no `pack.target`.

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
- [`versions-node`]{#versions-node}: `devEngines` asks for the reference's Node with `onFail: error`, and `engines` asks for the same. The wrong Node stops loudly. A package supports the Node it's built and tested on, and nothing older, so CI runs on one Node. Node 26 is the LTS release from October 2026, and the floor is 26.12.1, its October security release, which cf's beta needs too. When the next LTS arrives, every repository moves to it at once, and for a package that's a breaking release.

Bump deliberately, everywhere at once. Being on the latest pnpm doesn't matter. Being on the same one does.

## Other versions

The tools every repository shares are on one version, written the same way, so moving one never leaves two repositories to reconcile. The reference's [package.json](../reference/package.json) has each at an exact version, not a range, so the version a repository names is the one it installs, and nothing moves but through a release of craftz. npm isn't read. A new release is drift only once the reference moves to it, past pnpm's one-day wait. Our own markz and prose may lead the reference, so a package that builds on one can take its release before craftz does.

- [`versions-types-node`]{#versions-types-node}: `@types/node` is the reference's, where a repository has it. It's the major of the Node that `engines` allows, so code can't use newer APIs.
- [`versions-vite-plus`]{#versions-vite-plus}: every repository is on the reference's `vite-plus`, with no direct `vite`. pnpm's settings point `vite` at it, by `versions-workspace`. [Toolchain](#toolchain-vite) says why.
- [`versions-typescript`]{#versions-typescript}: `typescript` is the reference's, where a repository has it.
- [`versions-prose`]{#versions-prose}: `@amitkaps/prose` is an exact version, at least the reference's, where a repository has it.
- [`versions-markz`]{#versions-markz}: `@amitkaps/markz` is an exact version, at least the reference's, where a repository has it.
- [`versions-craftz`]{#versions-craftz}: `@amitkaps/craftz` is at craftz's own version, exactly, so the rules a repository names are the rules it's checked against, and a release of craftz is what moves every repository to them.
- [`versions-cf`]{#versions-cf}: `cf` is the reference's, where a repository deploys with it.
- [`versions-cf-vite-plugin`]{#versions-cf-vite-plugin}: `@cloudflare/vite-plugin` is the reference's, where a repository deploys with cf, at the build that goes with `cf`.
- [`versions-beta`]{#versions-beta}: only `cf` and `@cloudflare/vite-plugin` are on a pre-release, each pinned to an exact build.
- [`versions-wrangler`]{#versions-wrangler}: `wrangler` is the reference's, while a repository is still on it.
- [`versions-publint`]{#versions-publint}: `publint` is the reference's, where a package has it.

A beta's tags don't say which build goes with which, so it's moved by hand. `align` lists one in its pull request once npm's latest is a release, and then it leaves `versions-beta`. [Development](development.md#beta-packages) says how.

A repository's own libraries, like svelte or micromark, are its own to choose. `align` moves them within their major version, and lists a new major in its pull request for review.

`pnpm-workspace.yaml` is a settings file, not a workspace. Every repository has the same three settings: the cooldown, `allowBuilds` and the Vite+ override. `allowBuilds` lets esbuild and workerd run their install scripts, when wrangler or the Cloudflare plugin is installed, and does nothing where neither is.

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
| `check` | format, lint and types: `vp check`, and a framework's own checker |
| `fix` | writes the format and lint fixes: `vp check --fix` |
| `test` | the tests, when there are any |
| `verify` | `check`, `prose check`, `craftz check`, `test` and `build`, then the site if there is one |
| `ship` | uploads what `verify` built: `craftz deploy` |
| `prose` | reads the repository as a document: `prose`, so `pnpm prose build` works |
| `pr` | opens a pull request that merges itself once CI passes |
| `gone` | deletes the local branches that merged |
| `craftz` | runs craftz, so `pnpm craftz rules` works |

- [`scripts-required`]{#scripts-required}: `check`, `fix`, `verify` and `prose` are in every repository, `dev` and `build` in every site and package, and `ship` in every site. A tool has nothing to serve or build, so its `verify` is `check`, `prose check`, `craftz check` and `test`. `test` is there when there are tests.
- [`scripts-check`]{#scripts-check}: on Vite+, `check` runs `vp check`. A framework can add its own steps around it, like SvelteKit's `svelte-kit sync` before and `svelte-check` after.
- [`scripts-fix`]{#scripts-fix}: on Vite+, `fix` is exactly `vp check --fix`.
- [`scripts-one-checker`]{#scripts-one-checker}: on Vite+, there are no `lint` or `fmt` scripts. `check` and `fix` cover both, and a framework adds no second formatter or linter.
- [`scripts-verify`]{#scripts-verify}: `verify` runs `pnpm prose check`, then `pnpm craftz check`. prose check fails on what the text gets wrong, which `prose build` only prints, so a mistake in a doc or a comment stops a merge the way a lint error does. craftz check fails on what has drifted from the rules of the craftz the repository installs, so a pull request can't drift, and one that moves craftz is checked against the release it moves to. Neither needs a login. The fix adds `pnpm craftz check` after `pnpm prose check`.
- [`scripts-prose`]{#scripts-prose}: `prose` is exactly `prose`, so `pnpm prose build` works. prose's own repository runs its command line from source.
- [`scripts-preview`]{#scripts-preview}: `preview` is a site's, the same as the reference's. A package, whose build is `dist/`, has none.
- [`scripts-pr`]{#scripts-pr}: `pr` is `craftz pr`, and there's no `scripts/pr.ts`. `pnpm pr "<title>"` starts a branch when it's on `main`, or on a branch whose pull request merged. On a branch whose pull request is open, it adds to it only when given the same title. It commits, runs `verify`, pushes, opens the pull request and turns on auto-merge. A package's pull request takes `--label <label>`, and stops without one, before anything is committed. `--wait` waits for the merge, updating the branch when another merge leaves it behind `main`, then switches to `main` and pulls. craftz's own repository runs it from source.
- [`scripts-gone`]{#scripts-gone}: `gone` is `craftz gone`, and there's no `scripts/gone.ts`. It deletes each local branch whose branch on GitHub is gone, which is each one that merged, and works where no git alias is set, like an agent's machine. craftz's own repository runs it from source.
- [`scripts-craftz`]{#scripts-craftz}: `craftz` is exactly `craftz`, so `pnpm craftz rules`, `pnpm craftz check` and the rest work, as `pnpm prose` does for prose. craftz's own repository runs it from source.
- [`scripts-ship`]{#scripts-ship}: a site's `ship` is `craftz deploy`, which runs `cf deploy --prebuilt` for a `cloudflare.config.ts`, or `wrangler deploy` for a `wrangler.toml`. The Worker's deploy command is `pnpm run ship`, so how a site deploys moves with craftz, not with each repository. craftz's own repository runs it from source.
- [`scripts-pnpm-names`]{#scripts-pnpm-names}: no script is named `deploy`, `publish`, `audit`, `ci`, `pipeline` or `pack`. Those are pnpm's own commands, and `pnpm <name>` skips a script by one of those names.

Text the repository didn't write, like a test corpus or a fixture that's wrong on purpose, is marked `linguist-vendored` in `.gitattributes`, and `prose check` skips it. Any other script is the repository's own, like a package's `size` or `fuzz`.

`verify` is what CI runs and what Cloudflare runs before each deploy, so the two can't disagree. `ship` never builds.

A lifecycle script, one pnpm runs on its own like `prepare` on install or `prepack` before packing, only does what another step needs first. base's `prepare` generates the types SvelteKit and the Worker need, so a fresh clone type-checks. A package's `prepack` is `pnpm run build`, so a tarball never ships a stale `dist/`. Neither builds a site or deploys.

## Cloudflare

A repository with a site deploys it to a Cloudflare Worker with static assets.

- [`cloudflare-config`]{#cloudflare-config}: a site deploys with `cloudflare.config.ts`, cf's typed config. It holds the Worker's name, domain and asset handling, and `worker()` adds the rest.
- [`cloudflare-worker`]{#cloudflare-worker}: a site's config takes its Worker from `worker()`, which `@amitkaps/craftz/cloudflare` exports, as `vite.config.ts` uses `craftz()`. `worker()` sets the compatibility date to the build date of the workerd that craftz's cf installs, so dev and tests run what production does, and a site moves to a newer date with craftz. It turns off `workers.dev` and preview URLs, so the site answers only on its domain. Nothing uses the other addresses, and each would serve the site outside anything that covers the domain, like Access. A config that sets any of them, or a Node.js compatibility flag, fails, since from 2026-08-04 the date turns on Node.js compatibility itself.
- **Deploys:** the Worker's Git integration (Workers Builds) builds and deploys `main`. There's no deploy step in GitHub Actions, and no API token or secret.
- **The Worker's settings** are the same on every Worker. Cloudflare's config has no field for them, so `align` writes them with `cf`, and `craftz settings --check` reads them. Only connecting the Worker to its repository is left to Cloudflare's dashboard.

```text
Build command      pnpm run verify
Deploy command     pnpm run ship
Root directory     /
NODE_VERSION       26
Build cache        on
Previews           off
```

`verify` fails on a failing check, so a merge that breaks one doesn't deploy. Previews stay off because CI already checks every pull request. If a public repository turns them on, it sets the preview deploy command too: `pnpm exec wrangler versions upload`, or `pnpm exec cf workers versions create --prebuilt`.

### A static site

A static site is one folder, however it's built: by Vite from an `index.html`, by a plugin like Sitez or Pagez, or by `prose build`. cf deploys it through Vite, since cf's config has no field for an assets folder. A site that serves a folder names it as Vite's `publicDir`, and the Cloudflare plugin with `assetsOnly` hands it on. A site with an `index.html` is Vite's own build, so it names no folder. `craftz()` never guesses the folder. A prose site's is `.prose`:

```ts
export default defineConfig({
  publicDir: ".prose",
  plugins: [
    craftz(),
    lazyPlugins(async () => {
      const { cloudflare } = await import("@cloudflare/vite-plugin");
      return [cloudflare({ assetsOnly: true })];
    }),
  ],
});
```

- [`cloudflare-plugin`]{#cloudflare-plugin}: a site's `vite.config.ts` imports Cloudflare's plugin inside Vite+'s `lazyPlugins()`, not at the top. Vite+ loads the config for the format, lint and type checks too, and there the plugin and the workerd it brings took half of `vp check`. `lazyPlugins()` skips it there, and Vite still loads it to build, serve and test.

A site built in several steps, each writing into the same folder, ends with a build of its own that only deploys: the plugin, and the folder as its `publicDir`. With no `index.html`, the plugin builds an empty entry and deletes it, so only the folder's files are deployed.

- [`cloudflare-prose-site`]{#cloudflare-prose-site}: a prose site names `.prose` as Vite's `publicDir` and serves it through the Cloudflare plugin with `assetsOnly`, `verify` builds it after `prose build`, and `.gitignore` leaves out `.cloudflare` and `.wrangler`. The Cloudflare plugin leaves its temporary files in `.wrangler`.

In a site, the build after `prose build` is `pnpm build`, which is `vp build`. In a package, `build` is `vp pack`, so `verify` ends with `vp build` itself. Anything that adds to the site, like markz's Quality page, runs before it. `ship` is `craftz deploy`, which runs `cf deploy --prebuilt` to upload `.cloudflare/output/`.

### An app

A site that needs code on the server starts from base: SvelteKit with `adapter-cloudflare`, which writes a Worker as well as the files. It's kept for when one is needed. cf can't deploy what the adapter writes yet, so base stays on `wrangler.toml` and `wrangler deploy`, held, and its `check` runs `wrangler types` for the Worker's types.

### Internal sites

Any site can be public or internal, in a public repository or a private one. An internal site is one that Cloudflare Access covers, and it's deployed like any other.

- **Access covers its domain.** A Cloudflare Access application on the site's domain, with a policy that lets in only who it's for. Access is turned on once per account, in the Zero Trust dashboard.
- **Its other addresses are off,** as on every site, by `cloudflare-worker`. Access covers the domain, not the Worker, so `workers.dev` or a preview URL would serve the site without a login.

The config says so in its `@prose` comment. With `cf` logged in, `craftz status` looks up Access for the site's domain and says whether it's public or internal, so a site meant to be internal doesn't go public unseen. An application with no policy is marked, since it lets nobody in.

## GitHub

Every `main` takes changes the same way. Work happens on a branch, in a pull request, and `ci` has to pass on a branch that's up to date with `main`. The pull request is squash-merged, so `main` reads as one commit per change, and nobody pushes to it, admins included.

- [`github-rules`]{#github-rules}: `main` has one ruleset, named `main`, from [.github/ruleset.json](../reference/.github/ruleset.json). It requires a pull request with no approvals, since there's one maintainer, and the `ci` check, and a package's the `label` check too. It keeps history linear, and blocks force pushes and deleting the branch. Nobody bypasses it.
- [`github-ci`]{#github-ci}: `.github/workflows/ci.yml` is [the reference's](../reference/.github/workflows/ci.yml), word for word, and there's no Dependabot, since versions move in the reference first. The fix writes it whole. A step a repository adds goes in `verify`, so CI is the same everywhere. A workflow of the repository's own, like markz's fuzz search, is its own.
- **Merge settings:** from [.github/settings.json](../reference/.github/settings.json). Squash is the only merge, a branch is deleted once it's merged, and auto-merge is on. The topic `craftz` goes with them, so `align` finds the repository.

`craftz settings` writes both for one repository, and asks before removing classic branch protection. `align` writes both to every repository or to the ones named, and removes classic protection without asking. `craftz settings --check` reads both. GitHub shows the branch rules to anyone, but the merge settings only to the owner, so it needs `gh`'s login. A check GitHub's rate limit stopped shows as not checked, not as drift.

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
| `docs/plan.md` | its own next steps in order, then what works now, later and open, not other repositories' |
| `docs/development.md` | only what's its own: its extra scripts, its site, beyond these rules |
| `docs/lessons.md` | what building it taught, each lesson what happened and what to do about it |
| `docs/usage.md` | a package's install and use, and a section for agents |

The README is the site's home page when prose builds it, so it reads as one. It says what it is, gives a short example, and lists the commands a user runs, like a package's command. The repository's own scripts, like `dev` and `verify`, are the shared ones, and are left to `development.md`, which links these rules for the shared toolchain, scripts and workflows rather than describing them.

The plan opens with what's next, since that's what it's read for. Its "Where it is" holds one line per thing that works now, rewritten when a release changes it, not a line per release. A release's notes on GitHub already say what it changed, and the plan links to them rather than copying them. A version's steps in Next are tasks, ticked as each one merges. Once it's released, they fold into "Where it is" and leave Next.

A site has no `usage.md`, since the site is what people use, unless it has commands to run. Any other doc is the repository's own, like markz's grammar, and goes in the `nav` too. `development.md` links to these rules for what's shared rather than repeating it. `docs-files`'s fix writes a first version of each one that's missing, and adds it to the `nav`, so `new` starts with all of them.

The docs are published at `/docs/<file>.md`, so a link to one works on GitHub and on the site alike.

- **A package's site is `prose build`,** the repository read as a document, with nothing added to it. Its docs are in the bar, and its code is a page away.
- **A site shows its docs its own way,** read from `docs/`, so GitHub and the site have one set of files. base renders them with SvelteKit, as the starter it is.
- **A page the build fills in is a doc with a section for it.** The doc holds the words and an empty `{@section}` for each table, so prose builds it with its bar and styles. A script fills the sections in the page prose wrote, and a ` ```=html ` block holds its styles.

## Releases

markz, prose, pagez and sitez are packages, published to npm. A package is any repository whose `package.json` isn't private, and every one releases the same way.

- [`releases-files`]{#releases-files}: The release files are [the reference's package/](../reference/package/README.md), copied into the package unchanged: the release workflow, `.github/release.yml`, which groups the notes, and the `label` workflow, which checks a pull request has one. They name no package, so the copies stay identical and the survey checks them word for word. The fix writes them whole.
- [`releases-packing`]{#releases-packing}: A package packs `dist` with publint. `files` is `["dist"]`, followed only by what the package reads as it runs, like craftz's `docs/rules.md`. `prepack` is `pnpm run build`, and `publishConfig.access` is `public`. `craftz()` runs publint inside `vp pack`, strict, so `build` fails on a package npm would serve badly, and there's no separate publint step. The package has `publint` as a dev dependency.
- [`releases-types`]{#releases-types}: Types come from Oxc. `craftz()` sets `dts: { generator: "oxc" }` for a package, so `vp pack` writes the `.d.ts` files without the TypeScript compiler, and fails on an export whose type isn't written out. It's set there, not as `isolatedDeclarations` in `tsconfig.json`, which the editor would apply to tests and config too. A package has no `typescript` dependency, like a site: `vp check` type-checks with tsgolint, which Vite+ installs.
- [`releases-bundled`]{#releases-bundled}: Our own packages are bundled, not depended on. prose and sitez have markz as a dev dependency, and `vp pack` puts it inside `dist/`. So a package's users never install a second markz, and each package releases on its own, in any order. Picking up a new markz takes a release of the package that bundles it.

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

It writes only what's the repository's own: its name and description, its source, its Vite config and strict types, and CI. Each is built from the reference's files rather than a template. Then it runs every rule's fix, the ones `align` runs. They write the rest: the versions and engines, the shared scripts, the editor settings, the cooldown, the shared `AGENTS.md` sections, a package's release files and packing, and a first version of each doc. So a new repository can't follow the rules any less than `align` makes an old one. Then it installs, formats with `fix`, runs `verify` and makes the first commit. `--push` creates the repository on GitHub, pushes that commit and writes its GitHub settings, as `align` does. That first push is the only one to `main` the rules allow, since the rules aren't on yet. Its settings add the topic, so `align` finds it. It prints what's left: the Worker or npm's setup. A SvelteKit app starts from base instead, and is brought in like any other.

`new`'s test generates a package, a static site, a package with a site, scripts in a private repository and an internal site. It checks each against the survey and runs its `verify`, so the generator can't fall behind the rules.
