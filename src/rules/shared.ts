/** @prose
 * # What the rule groups share
 *
 * The helpers more than one group of [the rules](../rules.ts) writes with: reading and writing
 * `package.json`, pinning a version, editing a file only when the edit changes it, and the files
 * craftz owns word for word. A helper only one group uses stays in that group's module.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Pkg, here, read, readJson, readPkg, versionsIn } from "../reference.ts";
import type { Finding, Repo } from "../survey.ts";
import type { Rule } from "../rules.ts";

export const drifted = (drift: string[]): Finding => ({ drift });

// What GitHub couldn't answer. Its rate limit isn't drift: the check says it wasn't made.
export function unread(error: Error): Finding {
  if (error.name === "RateLimit") return { drift: [], unchecked: error.message };
  return drifted([`GitHub couldn't be read: ${error.message}`]);
}

// A JSON file is written only when its value changes, so one the formatter laid out stays as it
// is, and a second fix changes nothing.
export function writeJson(path: string, value: unknown): void {
  const text = JSON.stringify(value, null, 2);
  try {
    if (JSON.stringify(JSON.parse(readFileSync(path, "utf8")), null, 2) === text) return;
  } catch {
    // A file that's missing or isn't JSON is written whole.
  }
  writeFileSync(path, `${text}\n`);
}
export const writePkg = (dir: string, pkg: Pkg): void => writeJson(join(dir, "package.json"), pkg);

// Sets a dependency to the rules' version, in whichever list the repository has it.
export function pin(dir: string, std: string, name: string): void {
  const want = versionsIn(std)[name];
  const pkg = readPkg(dir);
  if (!want) return;
  for (const field of ["dependencies", "devDependencies"] as const) {
    const deps = pkg[field];
    if (deps?.[name]) deps[name] = want;
  }
  writePkg(dir, pkg);
}

// Writes a file's edit, where the file exists and the edit changes it.
export function editFile(file: string, edit: (text: string) => string): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  const edited = edit(text);
  if (edited !== text) writeFileSync(file, edited);
}

export type Json = Record<string, unknown>;
export const recommended = (json: Json): string[] =>
  Array.isArray(json.recommendations) ? (json.recommendations as string[]) : [];

/** @prose
 * # Files craftz owns
 *
 * CI, pnpm's settings and the editor's are the same in every repository, so each is the
 * reference's, word for word, and the fix writes it whole. What a repository adds goes
 * elsewhere, a step in `verify` and a setting in its own config, so no fix edits one by its lines.
 *
 * Two follow from the repository's axes. pnpm's override points `vite` at the Vite+ the
 * repository installs, so a Vite+ that's behind drifts once, in `versions-vite-plus`. A
 * repository that depends on Svelte adds its editor settings, from
 * [svelte/](../reference/svelte/README.md), whether it deploys an app or a static site. The
 * editor's files are compared as JSON, since `vp fmt` lays them out.
 */
export type Axes = { vitePlus?: string; svelte: boolean };

export const axesOf = (repo: Repo): Axes => ({
  vitePlus: repo.vitePlus,
  svelte: !!repo.deps?.["svelte"],
});

export function axesIn(dir: string): Axes {
  const pkg = readPkg(dir);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return { vitePlus: deps["vite-plus"], svelte: !!deps["svelte"] };
}

// A file craftz owns, as the reference in `std` writes it for a repository with these axes.
export function owned(file: string, axes: Axes, std: string): string {
  if (RELEASE_FILES.includes(file)) return read(join(std, "package", file));
  const text = read(join(std, file));
  if (file === WORKSPACE) {
    const own = axes.vitePlus;
    return own ? text.replace(/vite-plus-core@[\w.-]+/, `vite-plus-core@${own}`) : text;
  }
  if (!EDITOR.includes(file) || !axes.svelte) return text;
  const ours = JSON.parse(text) as Json;
  const adds = readJson<Json>(join(std, "svelte", file));
  const merged = file.endsWith("extensions.json")
    ? { recommendations: [...recommended(ours), ...recommended(adds)] }
    : { ...ours, ...adds };
  return `${JSON.stringify(merged, null, 2)}\n`;
}

export function same(file: string, have: string, want: string): boolean {
  if (!file.endsWith(".json")) return have === want;
  try {
    return JSON.stringify(JSON.parse(have)) === JSON.stringify(JSON.parse(want));
  } catch {
    return false;
  }
}

// A rule that each of `files` is craftz's, where `applies` says the repository has them.
export function owns(
  id: string,
  files: string[],
  applies: (pkg: Pkg) => boolean = () => true,
): Rule {
  return {
    id,
    check: (repo) => {
      if (!applies(repo.pkg)) return undefined;
      const axes = axesOf(repo);
      return drifted(
        files.flatMap((file) => {
          const have = repo.files[file];
          if (!have) return [`no ${file}`];
          return same(file, have, owned(file, axes, here)) ? [] : [`${file} differs from craftz's`];
        }),
      );
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        if (!applies(readPkg(dir))) return;
        const axes = axesIn(dir);
        for (const file of files) {
          const path = join(dir, file);
          const want = owned(file, axes, std);
          if (existsSync(path) && same(file, read(path), want)) continue;
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, want);
        }
      },
    },
  };
}

export const WORKSPACE = "pnpm-workspace.yaml";
export const CI = ".github/workflows/ci.yml";

export const EDITOR = [".vscode/settings.json", ".vscode/extensions.json"];

/** @prose
 * # Releases
 *
 * A package releases the way every package does, with the files in
 * [package/](../reference/package/README.md) copied in unchanged: the release workflow, the notes'
 * config, and the `label` workflow that checks a pull request has one.
 */
export const RELEASE_FILES = [
  ".github/workflows/release.yml",
  ".github/workflows/label.yml",
  ".github/notes.yml",
];
