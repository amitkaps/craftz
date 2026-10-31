/** @prose
 * # Breaking a repository to hold its fixes
 *
 * Holds each rule's fix to its check, so a check can't promise what its fix doesn't do. The tests
 * for [a package with a site](fixes-package.test.ts), [scripts](fixes-scripts.test.ts) and
 * [an internal site](fixes-internal.test.ts) each run `holdFixes` for one shape, in files of
 * their own so they run side by side.
 *
 * A new repository is broken one way at a time, by deleting a file, emptying it, or dropping a
 * key from a JSON file or one of its tables. Then every fix runs, and no rule that has one may
 * still find drift. A few gaps are left by hand on purpose, and each says why in `byHand`.
 */
import { tmp } from "./temp.ts";
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { type Start, write } from "../src/new.ts";
import { here } from "../src/reference.ts";
import { fixFiles, RULES } from "../src/rules.ts";
import { checkFolder } from "../src/survey.ts";

// What a fix leaves to a person: the break, and the rule that's still drifting. A break that
// leaves nothing readable stops the check itself, so it's not drift to fix.
const byHand: [broken: RegExp, rule: string, why: string][] = [
  [/^(delete|empty) README\.md$/, "docs-files", "a README's words are the repository's own"],
  [
    /^(delete|empty) vite\.config\.ts$/,
    "(toolchain|scripts|releases)-",
    "the Vite+ config is code the repository writes itself",
  ],
  [
    /^package\.json drop devDependencies(\.vite-plus)?$/,
    "versions-vite-plus",
    "a repository not on Vite+ moves by hand",
  ],
  [/^(delete|empty) index\.html$/, "cloudflare-static", "a `vp build` script is left by hand"],
];
const unreadable = /^(delete|empty) package\.json$/;

const fixable = new Set(RULES.filter((rule) => rule.fix?.in === "files").map((rule) => rule.id));
const drift = async (dir: string): Promise<[rule: string, text: string][]> =>
  (await checkFolder(dir)).findings.flatMap((finding) =>
    finding.drift.length && !finding.held && finding.rule && fixable.has(finding.rule)
      ? finding.drift.map((text): [string, string] => [finding.rule as string, text])
      : [],
  );

const files = (root: string, dir = root, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files(root, path, found);
    else found.push(relative(root, path));
  }
  return found;
};

const json = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;

/** Breaks a new repository of the shape one way at a time, and answers what no fix closed. */
export async function holdFixes(shape: Start): Promise<string[]> {
  {
    const base = join(tmp("craftz-fixes-"), "example");
    await write(base, "example", shape, "An example, from craftz's test.");
    const started = await drift(base);
    if (started.length) return started.map(([rule, text]) => `new: ${rule}: ${text}`);

    type Break = [label: string, file: string, apply: (dir: string) => void];
    const breaks: Break[] = [];
    for (const file of files(base)) {
      breaks.push([`delete ${file}`, file, (dir) => rmSync(join(dir, file))]);
      breaks.push([`empty ${file}`, file, (dir) => writeFileSync(join(dir, file), "")]);
      if (!file.endsWith(".json")) continue;
      const parsed = json(join(base, file));
      const drop = (path: string[]) => (dir: string) => {
        const doc = json(join(dir, file));
        const holder = path.length > 1 ? doc[path[0] as string] : doc;
        delete holder[path.at(-1) as string];
        writeFileSync(join(dir, file), JSON.stringify(doc, null, 2));
      };
      for (const [key, value] of Object.entries(parsed)) {
        breaks.push([`${file} drop ${key}`, file, drop([key])]);
        if (value && typeof value === "object" && !Array.isArray(value)) {
          for (const inner of Object.keys(value)) {
            breaks.push([`${file} drop ${key}.${inner}`, file, drop([key, inner])]);
          }
        }
      }
    }

    // One folder is broken and put back for each break, from what the new repository wrote, so
    // the copy is only of the files the break and the fixes touched.
    const dir = join(tmp("craftz-fixes-"), "example");
    cpSync(base, dir, { recursive: true });
    const original = new Map(files(base).map((file) => [file, readFileSync(join(base, file))]));
    const restore = (touched: string[]) => {
      for (const file of touched) {
        const was = original.get(file);
        if (was) writeFileSync(join(dir, file), was);
        else rmSync(join(dir, file), { force: true });
      }
    };
    const stuck: string[] = [];
    for (const [label, file, apply] of breaks) {
      apply(dir);
      if (unreadable.test(label)) {
        restore([file]);
        continue;
      }
      const changed = fixFiles(dir, here);
      for (const [rule, text] of await drift(dir)) {
        const kept = byHand.some(
          ([broken, id]) => broken.test(label) && new RegExp(`^${id}`).test(rule),
        );
        if (!kept) stuck.push(`${label}: ${rule}: ${text}`);
      }
      restore([file, ...changed]);
    }
    return stuck;
  }
}
