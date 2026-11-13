#!/usr/bin/env node
/** @prose
 * # The craftz command
 *
 * What a repository runs, and what an agent reads the rules with. Every subcommand works from
 * the installed package, so the version that checks a repository is the version it reads, and
 * nothing is fetched but what GitHub says about the repository.
 *
 * Each command is stated once, in [usage](../docs/usage.md), as the list item that opens its
 * section. `craftz help` lists them from there, and `craftz help <command>` prints one's section,
 * so the help can't drift from the docs. A test holds the commands below to the ids there, and `SPECS` says what each takes.
 *
 * `craftz rules` prints [the rules](../docs/rules.md), or one by id, as `prose rules` does, so an
 * agent that knows one knows the other.
 *
 * Each says how it works where it's written. What runs in this file has its own block below.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { type Outcome, type Target, checkSettings, writeSettings } from "./apply.ts";
import { deploy as upload } from "./deploy.ts";
import { deps } from "./deps.ts";
import { gone } from "./gone.ts";
import { clear, report } from "./temp.ts";
import { pr } from "./pr.ts";
import { release } from "./release.ts";
import { browserOnMain } from "./browser.ts";
import { buildLog, browserTook, status, timing, verifyTook } from "./status.ts";
import { CRAFTZ, OWNER, type Pkg, here, isCraftz, read, readPkg } from "./reference.ts";
import { fixFiles } from "./rules.ts";
import { cloudflareLogin, githubLogin, hasClassic } from "./settings.ts";
import { upgrade } from "./upgrade.ts";
import { finding, printOne } from "@amitkaps/markz/rules";
import { craftzRules, help, helpOn, printed, printedPart } from "./stated.ts";
import { notes } from "./notes.ts";
import { type Command, type Parsed, SPECS, parsed } from "./args.ts";
import { type Finding, checkFolder, origin } from "./survey.ts";
import { workerIn } from "./worker.ts";

// Each drift a finding, in markz's line. Drift is a warning, and a held rule's drift ends with
// its reason.
const lines = (f: Finding): string[] =>
  f.drift.map((message) =>
    finding({ tool: "craftz", level: "warning", code: f.rule, message, held: f.held }),
  );

/** @prose
 * # Check and fix
 *
 * `check` prints a folder's warnings, as
 * [the design](../docs/design.md#errors-warnings-and-notes) has them, each in markz's line, and
 * exits 1 on a warning that isn't held.
 *
 * It reads only the folder's files, so it runs in CI with no login, and asks npm nothing.
 * [notes.ts](notes.ts) says why the notes on npm are `status`'s.
 * The lines stay grouped under the folder, since `align` reads them per repository.
 *
 * `fix` writes every fix, the same ones `pnpm align` runs, then checks again. A fix can move
 * versions, so `pnpm install` comes next, then `pnpm run fix` for the format.
 */
async function check(dir: string): Promise<boolean> {
  const { findings } = await checkFolder(dir);
  const drift = findings.filter((f) => !f.held && f.drift.length);
  console.log(drift.length ? `✗ ${dir}` : `✓ ${dir}`);
  for (const line of drift.flatMap(lines)) console.log(`    ${line}`);
  for (const line of findings.filter((f) => f.held).flatMap(lines)) console.log(`    ${line}`);
  const said = findings.flatMap((f) => (f.unchecked ? [`not checked: ${f.unchecked}`] : []));
  for (const message of said)
    console.log(`    ${finding({ tool: "craftz", level: "note", message })}`);
  if (drift.length) console.log("    craftz: `craftz rules <id>` prints the rule an id names");
  return drift.length > 0;
}

// The repository the folder's origin names, which has to be the owner's.
function target(dir: string): Target {
  const repo = origin(dir);
  if (!repo) {
    console.error(`craftz: ${dir} has no origin on GitHub under ${OWNER}.`);
    process.exit(1);
  }
  const pkg = JSON.parse(read(join(dir, "package.json")) || "{}") as Pkg;
  const site = workerIn(dir);
  return { repo, pkg, site, noCloudflare: site && cloudflareLogin() };
}

/** @prose
 * # Deploy
 *
 * Deploys a site that's already built, as its `ship` script, which the Worker's deploy command
 * runs. The tool follows from the Worker config's file, since each tool reads only its own.
 *
 * A static site's `cloudflare.config.ts` is uploaded by craftz itself ([deploy.ts](deploy.ts)),
 * so the site installs no Cloudflare tool. An app's `wrangler.toml` runs `wrangler deploy`, the
 * repository's own dependency, so the version the rules check is the one that deploys.
 */
async function deploy(dir: string): Promise<number> {
  const site = workerIn(dir);
  if (!site) {
    console.error(`craftz deploy: ${dir} has no Worker config, so there's nothing to deploy.`);
    return 1;
  }
  if (site.file === "cloudflare.config.ts") {
    console.log(`craftz deploy: ${site.name}, from ${site.file}`);
    try {
      for (const line of await upload(dir)) console.log(`    ${line}`);
      return 0;
    } catch (error) {
      console.error(`craftz deploy: ${(error as Error).message}`);
      return 1;
    }
  }
  const bin = join(dir, "node_modules", ".bin", "wrangler");
  if (!existsSync(bin)) {
    console.error(
      `craftz deploy: ${site.name} is in ${site.file}, so it needs wrangler installed.`,
    );
    return 1;
  }
  console.log(`craftz deploy: ${site.name}, from ${site.file}, with wrangler deploy`);
  return spawnSync(bin, ["deploy"], { cwd: dir, stdio: "inherit" }).status ?? 1;
}

// Prints what's live for a repository, and returns whether anything has failed.
async function live(dir: string, log: boolean, full: boolean, timed: boolean): Promise<boolean> {
  const { repo, pkg, site } = target(dir);
  const { lines, build, release, summary } = await status(repo, pkg, site);
  const failed = lines.some((line) => !line.ok);
  console.log(failed ? `✗ ${repo}` : `✓ ${repo}`);
  const width = Math.max(...lines.map((line) => line.what.length));
  for (const line of lines) {
    console.log(`    ${line.ok ? "✓" : "✗"} ${line.what.padEnd(width)}  ${line.found}`);
  }
  for (const message of await notes(pkg, undefined, verifyTook(repo), browserTook(repo)))
    console.log(`    ${finding({ tool: "craftz", level: "note", message })}`);
  const browser = browserOnMain({ repo: `${OWNER}/${repo}` });
  if (browser) console.log(`    ${finding({ tool: "craftz", level: "note", message: browser })}`);
  if (full && release) console.log(`\n${release.body.trim()}`);
  else if (summary) console.log(`\n${summary}`);
  if (log && build) console.log(`\n${buildLog(build).join("\n")}`);
  if (timed) console.log(`\n${(await timing(repo)).join("\n")}`);
  return failed;
}

// Moves the folder to the latest craftz, as upgrade.ts says, runs the steps a fix leaves, and
// returns the check's exit code.
async function moveOn(dir: string): Promise<number> {
  const versionOf = (): string | undefined => {
    const pkg = readPkg(dir);
    return pkg.devDependencies?.[CRAFTZ] ?? pkg.dependencies?.[CRAFTZ];
  };
  if (!existsSync(join(dir, "package.json"))) {
    console.error(`craftz upgrade: ${dir} has no package.json.`);
    return 1;
  }
  if (isCraftz(readPkg(dir))) {
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

/** @prose
 * # Settings
 *
 * Writes what the rules set outside the files, on GitHub and on a site's Worker, for the
 * repository the folder's `origin` names, then reads it back. `--check` only reads. Classic
 * branch protection on `main` isn't craftz's, so removing it asks first, or takes `--yes` where
 * there's no one to ask.
 */
async function settings(dir: string, checking: boolean, yes: boolean): Promise<boolean> {
  if (!githubLogin()) {
    console.error("craftz settings needs gh logged in as the owner.");
    process.exit(1);
  }
  const it = target(dir);
  let found: Outcome[];
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
  const off = found.filter((line) => !line.fixed);
  console.log(off.length ? `✗ ${it.repo}` : `✓ ${it.repo}`);
  for (const line of found) console.log(`    ${line.text}`);
  return off.length > 0;
}

// What each command does with what it was given. `Record<Command, …>` makes the compiler hold
// this table to the commands `SPECS` states, so one can't ship without the other.
type Handler = (given: Parsed) => number | void | Promise<number | void>;

const handlers: Record<Command, Handler> = {
  rules: ({ words: [id] }) => {
    if (!id) {
      process.stdout.write(printed());
      return 0;
    }
    const rule = printOne([craftzRules()], id) ?? printedPart(id);
    if (!rule) {
      const message = `no rule or part \`${id}\`, and \`craftz rules\` prints every one`;
      console.error(finding({ tool: "craftz", level: "error", message }));
      return 1;
    }
    process.stdout.write(rule);
    return 0;
  },
  check: async ({ dir }) => ((await check(dir)) ? 1 : 0),
  fix: async ({ dir }) => {
    const changed = fixFiles(dir, here);
    if (!changed.length) console.log("Changed nothing.\n");
    else {
      console.log("Changed:");
      for (const file of changed) console.log(`    ${file}`);
      console.log("Run pnpm install, then pnpm run fix.\n");
    }
    return (await check(dir)) ? 1 : 0;
  },
  upgrade: () => moveOn(process.cwd()),
  settings: async ({ dir, flag }) => ((await settings(dir, flag("check"), flag("yes"))) ? 1 : 0),
  status: async ({ dir, flag }) =>
    (await live(dir, flag("log"), flag("notes"), flag("timing"))) ? 1 : 0,
  deps: ({ dir }) => deps(dir),
  deploy: () => deploy(process.cwd()),
  pr: (given) => pr(given),
  release: (given) => release(process.cwd(), given),
  shot: async (given) => {
    const { shot } = await import("./shot.ts");
    return shot(process.cwd(), given);
  },
  gone: () => gone(),
  clear: ({ flag }) => {
    console.log(report(clear(undefined, flag("list"), flag("all")), flag("list")));
    return 0;
  },
  new: async (given) => {
    // Loaded only here, since it brings the formatter. It's the one command that works outside a
    // repository, as `pnpm dlx @amitkaps/craftz new`.
    const { start } = await import("./new.ts");
    await start(given);
  },
  help: ({ words: [name] }) => {
    const text = name ? helpOn(name) : help();
    if (!text) {
      const message = `no command \`${name}\`, and \`craftz help\` lists every one`;
      console.error(finding({ tool: "craftz", level: "error", message }));
      return 1;
    }
    process.stdout.write(text);
    return 0;
  },
};

const command = process.argv[2];
if (command === "-h" || command === "--help") {
  process.stdout.write(help());
} else if (command !== undefined && Object.hasOwn(SPECS, command)) {
  const done = await handlers[command as Command](
    parsed(command as Command, process.argv.slice(3)),
  );
  if (typeof done === "number") process.exitCode = done;
} else {
  console.error(help());
  process.exit(1);
}
