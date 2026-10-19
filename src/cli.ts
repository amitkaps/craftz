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
 * It prints what has drifted and exits 1, like `pnpm drift ../markz` does for one folder, with
 * no settings read. `craftz fix` writes every fix in the files, the same ones `pnpm align` runs,
 * then lists the files it changed, checks again and prints what's left to do by hand. A fix can
 * move versions, so `pnpm install` comes next, then `pnpm run fix` for the format.
 *
 * `craftz settings` writes what the rules set outside the files, on GitHub and on a site's
 * Worker, for the repository the folder's `origin` names, then reads it back. `--check` only
 * reads. Classic branch protection on `main` isn't craftz's, so removing it asks first, or takes
 * `--yes` where there's no one to ask. It needs `gh` logged in as the owner, and `cf` for a
 * Worker.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { type Target, checkSettings, writeSettings } from "./apply.ts";
import { OWNER, type Pkg, here } from "./reference.ts";
import { fixFiles } from "./rules.ts";
import { cloudflareLogin, githubLogin, hasClassic } from "./settings.ts";
import { RULES_DOC, stated } from "./stated.ts";
import { type Finding, HELD, checkFolder, worker } from "./survey.ts";

const HELP = `Usage: craftz <command>

  rules [id]   prints every rule, or one
  check [dir]  runs every rule on a folder, the current one by default
  fix [dir]    writes every fix, then checks what's left
  settings [dir] [--check] [--yes]
               writes the settings on GitHub and Cloudflare, then reads them back`;

const [command, arg, ...rest] = process.argv.slice(2);

const lines = (f: Finding): string[] => f.drift.map((d) => (f.rule ? `${f.rule}: ${d}` : d));

// Prints a folder's findings, and returns whether anything has drifted.
async function check(dir: string): Promise<boolean> {
  const { findings } = await checkFolder(dir);
  const sees = new Map(stated().map((s) => [s.id, s.see]));
  const drift = findings.filter((f) => !f.held && f.drift.length);
  console.log(drift.length ? `✗ ${dir}` : `✓ ${dir}`);
  for (const line of drift.flatMap(lines)) console.log(`    ${line}`);
  for (const see of new Set(drift.map((f) => sees.get(f.rule ?? "")))) {
    if (see) console.log(`    see: ${see}`);
  }
  for (const f of findings.filter((f) => f.held)) {
    console.log(`    held: ${lines(f).join("; ")}\n      ${f.held}`);
  }
  for (const f of findings.filter((f) => f.unchecked))
    console.log(`    not checked: ${f.unchecked}`);
  return drift.length > 0;
}

// The repository the folder's origin names, which has to be the owner's.
function target(dir: string): Target {
  let origin = "";
  try {
    origin = execFileSync("git", ["-C", dir, "remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {}
  const repo = new RegExp(`github\\.com[:/]${OWNER}/([^/]+?)(?:\\.git)?$`).exec(origin)?.[1];
  if (!repo) {
    console.error(`craftz: ${dir} has no origin on GitHub under ${OWNER}.`);
    process.exit(1);
  }
  const file = (name: string): string =>
    existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : "";
  const pkg = JSON.parse(file("package.json") || "{}") as Pkg;
  const site = worker(
    Object.fromEntries(
      ["cloudflare.config.ts", "wrangler.jsonc", "wrangler.toml"].map((f) => [f, file(f)]),
    ),
  );
  return { repo, pkg, site, cloudflare: site && cloudflareLogin() };
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
  const changed = fixFiles(dir, here, HELD[basename(dir)]);
  if (!changed.length) console.log("Changed nothing.\n");
  else {
    console.log("Changed:");
    for (const file of changed) console.log(`    ${file}`);
    console.log("Run pnpm install, then pnpm run fix.\n");
  }
  process.exitCode = (await check(dir)) ? 1 : 0;
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
} else if (command === "-h" || command === "--help") {
  console.log(HELP);
} else {
  console.error(HELP);
  process.exit(1);
}
