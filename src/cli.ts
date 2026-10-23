#!/usr/bin/env node
/** @prose
 * # The craftz command
 *
 * What a repository runs, and what an agent reads the rules with. Every subcommand works from
 * the installed package, so the version that checks a repository is the version it reads, and
 * nothing is fetched but what GitHub says about the repository.
 *
 * `craftz rules` prints [the rules](../docs/rules.md), and `craftz rules <id>` prints one, which
 * is what a finding names. It works like `prose rules`, so an agent that knows one knows the
 * other.
 *
 * `craftz check` runs every rule on a folder's files, the current one unless another is named.
 * It prints its errors, its warnings and its notes, as [the design](../docs/design.md#errors-warnings-and-notes)
 * has them, and exits 1 only on an error. It reads no settings, so it runs in CI with no login.
 * `craftz fix` writes every fix in the files, the same ones `pnpm align` runs,
 * then lists the files it changed, checks again and prints what's left to do by hand. A fix can
 * move versions, so `pnpm install` comes next, then `pnpm run fix` for the format.
 *
 * `craftz upgrade` moves a repository to the latest craftz and runs its fix, as
 * [upgrade.ts](upgrade.ts) says, and runs those next steps itself.
 *
 * `craftz settings` writes what the rules set outside the files, on GitHub and on a site's
 * Worker, for the repository the folder's `origin` names, then reads it back. `--check` only
 * reads. Classic branch protection on `main` isn't craftz's, so removing it asks first, or takes
 * `--yes` where there's no one to ask. It needs `gh` logged in as the owner, and `cf` for a
 * Worker.
 *
 * `craftz status` reads what's live: CI on `main`, the open pull requests, a package's version on
 * npm and its latest release, and a site's latest build and addresses, as [status.ts](status.ts)
 * says. `--log` prints the latest build's log too, and `--notes` the release's notes. It exits 1
 * when anything has failed.
 *
 * `craftz deploy` deploys a site that's already built, as its `ship` script, which the Worker's
 * deploy command runs. What it runs follows from the Worker config's file, since each tool reads
 * only its own. `cloudflare.config.ts` uploads the Build Output with `cf deploy --prebuilt`, and
 * `wrangler.toml` runs `wrangler deploy`, which an app is held on until cf can deploy one. Each
 * tool is the repository's own dependency, so the version the rules check is the one that
 * deploys.
 *
 * `craftz pr` opens a pull request that merges itself, as [pr.ts](pr.ts) says, and `craftz gone`
 * deletes the branches that merged, as [gone.ts](gone.ts) says. A repository runs them as
 * `pnpm pr` and `pnpm gone`. `craftz release` opens the pull request that releases a package, as
 * [release.ts](release.ts) says.
 *
 * `craftz new` starts a repository that already follows the rules, as [new.ts](new.ts) says. It's
 * the one command that works outside a repository, as `pnpm dlx @amitkaps/craftz new`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { type Target, checkSettings, writeSettings } from "./apply.ts";
import { gone } from "./gone.ts";
import { pr } from "./pr.ts";
import { release } from "./release.ts";
import { buildLog, status } from "./status.ts";
import { CRAFTZ, OWNER, type Pkg, here, read } from "./reference.ts";
import { fixFiles } from "./rules.ts";
import { cloudflareLogin, githubLogin, hasClassic } from "./settings.ts";
import { upgrade } from "./upgrade.ts";
import { RULES_DOC, stated } from "./stated.ts";
import { notes } from "./notes.ts";
import { type Finding, checkFolder, origin } from "./survey.ts";
import { workerIn } from "./worker.ts";

const HELP = `Usage: craftz <command>

  rules [id]   prints every rule, or one
  check [dir]  runs every rule on a folder, the current one by default
  fix [dir]    writes every fix, then checks what's left
  upgrade      moves the current folder to the latest craftz, and runs its fix
  settings [dir] [--check] [--yes]
               writes the settings on GitHub and Cloudflare, then reads them back
  status [dir] [--log] [--notes]
               reads what's live: CI, pull requests, npm, the release, the site's build and addresses
  deploy       deploys the site the current folder built, as its ship script
  pr "<title>" [--label <label>] [--body <text>] [--wait]
               opens a pull request that merges itself once CI passes
  gone         deletes the local branches that merged
  release <X.Y.Z> [--notes "<text>"]
               opens the pull request that releases the current folder's package
  new <name> [--package] [--site static] [--private] [--internal] --description "<text>" [--push]
               starts a repository that follows the rules, in a folder of the current one`;

const [command, arg, ...rest] = process.argv.slice(2);

const lines = (f: Finding): string[] => f.drift.map((d) => (f.rule ? `${f.rule}: ${d}` : d));

// Prints a folder's errors, warnings and notes, and returns whether there's an error.
async function check(dir: string): Promise<boolean> {
  const { findings } = await checkFolder(dir);
  const pkg = JSON.parse(read(join(dir, "package.json")) || "{}") as Pkg;
  const sees = new Map(stated().map((s) => [s.id, s.see]));
  const drift = findings.filter((f) => !f.held && f.drift.length);
  console.log(drift.length ? `✗ ${dir}` : `✓ ${dir}`);
  for (const line of drift.flatMap(lines)) console.log(`    ${line}`);
  for (const see of new Set(drift.map((f) => sees.get(f.rule ?? "")))) {
    if (see) console.log(`    see: ${see}`);
  }
  for (const f of findings.filter((f) => f.held)) {
    console.log(`    warning: ${lines(f).join("; ")}\n      held: ${f.held}`);
  }
  for (const note of await notes(pkg)) console.log(`    note: ${note}`);
  for (const f of findings.filter((f) => f.unchecked))
    console.log(`    not checked: ${f.unchecked}`);
  return drift.length > 0;
}

// The repository the folder's origin names, which has to be the owner's.
function target(dir: string): Target {
  const repo = origin(dir);
  if (!repo) {
    console.error(`craftz: ${dir} has no origin on GitHub under ${OWNER}.`);
    process.exit(1);
  }
  const file = (name: string): string =>
    existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : "";
  const pkg = JSON.parse(file("package.json") || "{}") as Pkg;
  const site = workerIn(dir);
  return { repo, pkg, site, noCloudflare: site && cloudflareLogin() };
}

// Deploys the folder's site with the tool its deploy axis names, and returns the exit code.
function deploy(dir: string): number {
  const site = workerIn(dir);
  if (!site) {
    console.error(`craftz deploy: ${dir} has no Worker config, so there's nothing to deploy.`);
    return 1;
  }
  const [tool, ...args] =
    site.file === "cloudflare.config.ts" ? ["cf", "deploy", "--prebuilt"] : ["wrangler", "deploy"];
  const bin = join(dir, "node_modules", ".bin", tool ?? "");
  if (!existsSync(bin)) {
    console.error(`craftz deploy: ${site.name} is in ${site.file}, so it needs ${tool} installed.`);
    return 1;
  }
  console.log(`craftz deploy: ${site.name}, from ${site.file}, with ${tool} ${args.join(" ")}`);
  return spawnSync(bin, args, { cwd: dir, stdio: "inherit" }).status ?? 1;
}

// Prints what's live for a repository, and returns whether anything has failed.
async function live(dir: string, log: boolean, notes: boolean): Promise<boolean> {
  const { repo, pkg, site } = target(dir);
  const { lines, build, release, summary } = await status(repo, pkg, site);
  const failed = lines.some((line) => !line.ok);
  console.log(failed ? `✗ ${repo}` : `✓ ${repo}`);
  const width = Math.max(...lines.map((line) => line.what.length));
  for (const line of lines) {
    console.log(`    ${line.ok ? "✓" : "✗"} ${line.what.padEnd(width)}  ${line.found}`);
  }
  if (notes && release) console.log(`\n${release.body.trim()}`);
  else if (summary) console.log(`\n${summary}`);
  if (log && build) console.log(`\n${buildLog(build).join("\n")}`);
  return failed;
}

// Moves the folder to the latest craftz, says from which version, and returns the check's exit code.
async function moveOn(dir: string): Promise<number> {
  const versionOf = (): string | undefined => {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Pkg;
    return pkg.devDependencies?.[CRAFTZ] ?? pkg.dependencies?.[CRAFTZ];
  };
  if (!existsSync(join(dir, "package.json"))) {
    console.error(`craftz upgrade: ${dir} has no package.json.`);
    return 1;
  }
  if ((JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Pkg).name === CRAFTZ) {
    console.error(
      "craftz upgrade: craftz checks itself from source, and pnpm bump moves its reference.",
    );
    return 1;
  }
  const from = versionOf();
  await upgrade(async (command, ...args) => {
    const { status } = spawnSync(command, args, { cwd: dir, stdio: "inherit" });
    if (status !== 0) throw new Error(`${command} ${args.join(" ")} exited ${status}`);
  });
  const to = versionOf();
  console.log(
    from === to ? `\nAlready on craftz ${to}.` : `\ncraftz ${to}, from ${from ?? "nothing"}.`,
  );
  return spawnSync("pnpm", ["exec", "craftz", "check"], { cwd: dir, stdio: "inherit" }).status ?? 1;
}

async function ask(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

// Prints a repository's settings, and returns whether any is still off.
async function settings(dir: string, checking: boolean, yes: boolean): Promise<boolean> {
  if (!githubLogin()) {
    console.error("craftz settings needs gh logged in as the owner.");
    process.exit(1);
  }
  const it = target(dir);
  let found: string[];
  if (checking) {
    found = await checkSettings(it);
  } else {
    const removing =
      hasClassic(it.repo) &&
      (yes ||
        (process.stdin.isTTY &&
          (await ask(
            `${it.repo} has classic branch protection on main, which craftz didn't create. Remove it?`,
          ))));
    found = await writeSettings(it, removing);
  }
  const off = found.filter((line) => !line.startsWith("fixed: "));
  console.log(off.length ? `✗ ${it.repo}` : `✓ ${it.repo}`);
  for (const line of found) console.log(`    ${line}`);
  return off.length > 0;
}

if (command === "rules" && !rest.length) {
  if (!arg) {
    process.stdout.write(readFileSync(RULES_DOC, "utf8"));
  } else {
    const rule = stated().find((s) => s.id === arg);
    if (!rule) {
      console.error(`craftz: no rule named ${arg}. \`craftz rules\` prints them all.`);
      process.exit(1);
    }
    console.log(`${rule.id}, under ${rule.part}\n\n${rule.text}`);
  }
} else if (command === "check" && !rest.length) {
  process.exitCode = (await check(resolve(arg ?? "."))) ? 1 : 0;
} else if (command === "fix" && !rest.length) {
  const dir = resolve(arg ?? ".");
  const changed = fixFiles(dir, here);
  if (!changed.length) console.log("Changed nothing.\n");
  else {
    console.log("Changed:");
    for (const file of changed) console.log(`    ${file}`);
    console.log("Run pnpm install, then pnpm run fix.\n");
  }
  process.exitCode = (await check(dir)) ? 1 : 0;
} else if (command === "upgrade" && !arg) {
  process.exitCode = await moveOn(process.cwd());
} else if (command === "settings") {
  const flags = [arg, ...rest].filter((it) => it?.startsWith("--"));
  const dirs = [arg, ...rest].filter((it) => it !== undefined && !it.startsWith("--"));
  if (dirs.length > 1 || flags.some((f) => f !== "--check" && f !== "--yes")) {
    console.error(HELP);
    process.exit(1);
  }
  const off = await settings(
    resolve(dirs[0] ?? "."),
    flags.includes("--check"),
    flags.includes("--yes"),
  );
  process.exitCode = off ? 1 : 0;
} else if (command === "status") {
  const flags = [arg, ...rest].filter((it) => it?.startsWith("--"));
  const dirs = [arg, ...rest].filter((it) => it !== undefined && !it.startsWith("--"));
  if (dirs.length > 1 || flags.some((f) => f !== "--log" && f !== "--notes")) {
    console.error(HELP);
    process.exit(1);
  }
  const failed = await live(
    resolve(dirs[0] ?? "."),
    flags.includes("--log"),
    flags.includes("--notes"),
  );
  process.exitCode = failed ? 1 : 0;
} else if (command === "deploy" && !arg) {
  process.exitCode = deploy(process.cwd());
} else if (command === "pr") {
  await pr([arg, ...rest].filter((it) => it !== undefined));
} else if (command === "release") {
  release(
    process.cwd(),
    [arg, ...rest].filter((it) => it !== undefined),
  );
} else if (command === "gone" && !arg) {
  gone();
} else if (command === "new") {
  // Loaded only here, since it brings the formatter.
  const { start } = await import("./new.ts");
  await start([arg, ...rest].filter((it) => it !== undefined));
} else if (command === "-h" || command === "--help") {
  console.log(HELP);
} else {
  console.error(HELP);
  process.exit(1);
}
