/** @prose
 * # The scripts rules
 *
 * The rules under [Scripts](../../docs/rules.md#scripts): the `package.json` scripts every
 * repository has, what `verify` runs, and the commands that are craftz's own, like `pr` and
 * `gone`.
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Pkg, isCraftz, readPkg, standard, read } from "../reference.ts";
import {} from "../config.ts";
import { allOf, withVerify } from "../edit.ts";
import {} from "../ruled.ts";
import { workerIn } from "../worker.ts";
import type { Rule } from "../rules.ts";
import { writePkg, drifted } from "./shared.ts";

export const standardScripts = standard.scripts ?? {};

export const BUILT = ["dev", "build"];
export const REQUIRED = ["check", "fix", "verify", "prose"];
export const PNPM_COMMANDS = ["deploy", "publish", "audit", "ci", "pipeline", "pack"];
// Sets a script to the rules', in a repository the rule applies to.
export function setScript(
  dir: string,
  std: string,
  name: string,
  applies: (pkg: Pkg) => boolean,
): void {
  const pkg = readPkg(dir);
  const want = readPkg(std).scripts?.[name];
  if (!want || !applies(pkg)) return;
  pkg.scripts = { ...pkg.scripts, [name]: want };
  writePkg(dir, pkg);
}
export const steps = (script: string): string[] => script.split("&&").map((it) => it.trim());
export const PROSE = "@amitkaps/prose";
// What `check` runs after `vp check`. prose's own repository builds its command line before it
// can check, so its prose check is a task of its own.
export const checkedBy = (pkg: Pkg): string[] =>
  pkg.name === PROSE ? ["pnpm craftz check"] : ["pnpm prose check", "pnpm craftz check"];
// The scripts `all` runs, of those the repository has.
export const allFor = (pkg: Pkg): string[] =>
  ["check", "test", "build", "site"].filter((name) => pkg.scripts?.[name]);
// The steps a chained verify ran, in their order, and the script each is in `all`. Those in
// `check` now, and the outline, which `pr` and `gone` write, are dropped. `prose build` is `site`.
export const CHAINED = ["pnpm check", "pnpm test", "pnpm build", "pnpm site"];
export const DROPPED = ["pnpm prose check", "pnpm prose outline", "pnpm craftz check"];

/** @prose
 * # A chained verify
 *
 * A `verify` chained with `&&` ran each step after the last, so a step may need one before it.
 * The fix moves what it can know is safe. It drops the steps `check` runs now, and the outline,
 * and makes `prose build` the `site` script. When every step left is a standard one, in `all`'s
 * order, the chain moves to `all`.
 *
 * Otherwise the chain stays, shorter, and the check names each step that's left. That's a step of
 * the repository's own, or a standard one that ran after a step it may need, like a test that
 * reads the build. Each becomes a task in `vite.config.ts` that waits for what it needs, by hand,
 * since only the repository knows what that is.
 */
export function chain(verify: string): { kept: string[]; own: string[]; late: [string, string][] } {
  const kept = steps(verify)
    .filter((step) => !DROPPED.includes(step))
    .map((step) => (step === "pnpm prose build" ? "pnpm site" : step));
  const own = kept.filter((step) => !CHAINED.includes(step));
  const standard = kept.filter((step) => CHAINED.includes(step));
  const late = standard.flatMap((step, n): [string, string][] => {
    const before = standard.slice(0, n).find((it) => CHAINED.indexOf(it) > CHAINED.indexOf(step));
    return before ? [[step, before]] : [];
  });
  return { kept, own, late };
}

export const onVitePlus = (pkg: Pkg): boolean =>
  Boolean(pkg.dependencies?.["vite-plus"] ?? pkg.devDependencies?.["vite-plus"]);

/** @prose
 * # A shared command
 *
 * `pnpm pr` and `pnpm gone` run craftz's commands, so every repository takes the same steps from
 * the version it installs, and `pnpm craftz` runs any of them, as `pnpm prose` runs prose.
 * craftz's own repository runs them from source.
 *
 * `pr` and `gone` were once files each repository copied into `scripts/`, so the fix deletes
 * those copies, and the folder too when nothing of the repository's own is left in it.
 */
export const COMMAND_SCRIPTS = ["pr", "gone"];

export function leaveScripts(dir: string): void {
  const folder = join(dir, "scripts");
  for (const name of COMMAND_SCRIPTS) rmSync(join(folder, `${name}.ts`), { force: true });
  if (!existsSync(folder)) return;
  const left = readdirSync(folder);
  const readme = join(folder, "README.md");
  const copied = existsSync(readme) && readFileSync(readme, "utf8").includes("[pr.ts](pr.ts)");
  if (!left.length || (left.length === 1 && copied)) rmSync(folder, { recursive: true });
}

export const commandScript = (id: string, name: string): Rule => ({
  id,
  check: ({ pkg, files }) => {
    const drift: string[] = [];
    const own = name === "craftz" ? "node src/cli.ts" : `node src/cli.ts ${name}`;
    const want = isCraftz(pkg) ? own : standardScripts[name];
    const script = pkg.scripts?.[name];
    if (script !== want)
      drift.push(script ? `${name} is ${script}, not ${want}` : `no ${name} script`);
    const file = `scripts/${name}.ts`;
    if (COMMAND_SCRIPTS.includes(name) && files[file]) {
      drift.push(`has ${file}, which craftz ${name} replaces`);
    }
    return drifted(drift);
  },
  fix: {
    in: "files",
    apply: (dir, std) => {
      leaveScripts(dir);
      setScript(dir, std, name, (pkg) => !isCraftz(pkg));
    },
  },
});

export const SCRIPT_RULES: Rule[] = [
  {
    id: "scripts-required",
    check: ({ pkg, worker: site }) => {
      const scripts = pkg.scripts ?? {};
      // A tool, private and with no site, has nothing to serve or build.
      const tool = pkg.private && !site;
      const required = [
        ...(tool ? [] : BUILT),
        ...REQUIRED,
        ...(site ? ["ship"] : []),
        ...(site && pkg.private ? ["preview"] : []),
      ];
      return drifted(required.filter((name) => !scripts[name]).map((name) => `no ${name} script`));
    },
  },
  {
    id: "scripts-check",
    check: ({ pkg, vitePlus }) => {
      const check = pkg.scripts?.check;
      if (!vitePlus || !check) return undefined;
      return drifted(
        ["vp check", ...checkedBy(pkg)]
          .filter((step) => !steps(check).includes(step))
          .map((step) => `check doesn't run ${step}`),
      );
    },
    fix: {
      in: "files",
      // Each missing step but vp check goes last, after a framework's own checker.
      apply: (dir) => {
        const pkg = readPkg(dir);
        const check = pkg.scripts?.check;
        if (!check || !onVitePlus(pkg)) return;
        const missing = checkedBy(pkg).filter((step) => !steps(check).includes(step));
        if (!missing.length) return;
        pkg.scripts = { ...pkg.scripts, check: [check, ...missing].join(" && ") };
        writePkg(dir, pkg);
      },
    },
  },
  {
    id: "scripts-fix",
    check: ({ pkg, vitePlus }) => {
      const fix = pkg.scripts?.fix;
      if (!vitePlus || !fix) return undefined;
      return drifted(
        fix === standardScripts.fix ? [] : [`fix is ${fix}, not ${standardScripts.fix}`],
      );
    },
    fix: { in: "files", apply: (dir, std) => setScript(dir, std, "fix", onVitePlus) },
  },
  {
    id: "scripts-one-checker",
    check: ({ pkg, vitePlus }) => {
      if (!vitePlus) return undefined;
      return drifted(
        ["lint", "fmt"]
          .filter((name) => pkg.scripts?.[name])
          .map((name) => `has a ${name} script, which check and fix cover`),
      );
    },
  },
  {
    id: "scripts-verify",
    check: ({ pkg, files, vitePlus }) => {
      const verify = pkg.scripts?.verify;
      if (!verify || !vitePlus) return undefined;
      const want = standardScripts.verify;
      if (verify !== want) {
        // prose's chain is its own, since its prose check is a task of its own.
        const { own, late } = pkg.name === PROSE ? { own: [], late: [] } : chain(verify);
        return drifted([
          `verify is ${verify}, not ${want}`,
          ...own.map(
            (step) => `${step} needs a task in vite.config.ts that waits for what it needs`,
          ),
          ...late.map(
            ([step, before]) =>
              `${step} runs after ${before}, so it's a task in vite.config.ts if it needs it`,
          ),
        ]);
      }
      const all = allOf(files["vite.config.ts"] ?? "");
      if (!all) return drifted(["vite.config.ts has no all task"]);
      return drifted(
        allFor(pkg)
          .filter((name) => !all.includes(name))
          .map((name) => `all doesn't run ${name}`),
      );
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const pkg = readPkg(dir);
        const verify = pkg.scripts?.verify;
        const want = readPkg(std).scripts?.verify;
        if (!verify || !want || verify === want || !onVitePlus(pkg) || pkg.name === PROSE) return;
        const { kept, own, late } = chain(verify);
        const site: Record<string, string> = steps(verify).includes("pnpm prose build")
          ? { site: standardScripts.site ?? "prose build" }
          : {};
        if (own.length || late.length) {
          pkg.scripts = { ...pkg.scripts, ...site, verify: kept.join(" && ") };
          return writePkg(dir, pkg);
        }
        const file = join(dir, "vite.config.ts");
        const vite = read(file);
        if (!vite) return;
        const edited = withVerify(
          vite,
          kept.map((step) => step.slice(5)),
        );
        if (edited === vite) return;
        writeFileSync(file, edited);
        pkg.scripts = { ...pkg.scripts, ...site, verify: want };
        writePkg(dir, pkg);
      },
    },
  },
  {
    id: "scripts-prose",
    check: ({ pkg }) => {
      const prose = pkg.scripts?.prose;
      // prose's own repository runs its command line from source.
      if (!prose || pkg.name === PROSE) return undefined;
      const outline = pkg.scripts?.outline;
      return drifted([
        ...(prose === "prose" ? [] : [`prose is ${prose}, not prose`]),
        ...(outline === standardScripts.outline
          ? []
          : [`outline is ${outline ?? "missing"}, not ${standardScripts.outline}`]),
      ]);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        for (const name of ["prose", "outline"])
          setScript(dir, std, name, (pkg) => pkg.name !== PROSE);
      },
    },
  },
  {
    id: "scripts-preview",
    check: ({ pkg }) => {
      const preview = pkg.scripts?.preview;
      if (!preview) return undefined;
      if (!pkg.private) return drifted(["has a preview script, which is a site's"]);
      return drifted(
        preview === standardScripts.preview
          ? []
          : [`preview is ${preview}, not ${standardScripts.preview}`],
      );
    },
  },
  {
    id: "scripts-pnpm-names",
    check: ({ pkg }) =>
      drifted(
        PNPM_COMMANDS.filter((name) => pkg.scripts?.[name]).map(
          (name) => `has a ${name} script, which pnpm ${name} never runs`,
        ),
      ),
  },
  commandScript("scripts-pr", "pr"),
  commandScript("scripts-gone", "gone"),
  commandScript("scripts-craftz", "craftz"),
  {
    id: "scripts-ship",
    check: ({ pkg, worker: site }) => {
      const ship = pkg.scripts?.ship;
      // A site without one is scripts-required's, and a folder with no site has nothing to ship.
      if (!site || !ship) return undefined;
      const want = isCraftz(pkg) ? "node src/cli.ts deploy" : standardScripts.ship;
      return drifted(ship === want ? [] : [`ship is ${ship}, not ${want}`]);
    },
    fix: {
      in: "files",
      apply: (dir, std) => setScript(dir, std, "ship", (pkg) => !isCraftz(pkg) && !!workerIn(dir)),
    },
  },
];
