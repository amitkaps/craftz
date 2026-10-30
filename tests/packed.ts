/** @prose
 * # The packed package
 *
 * Packs craftz once, before the tests run, as `pnpm publish` would, and hands the tarball's path
 * to the tests. A test that installs craftz installs this, so it gets only what the package ships,
 * not the checkout around it.
 *
 * It builds into a folder of its own, not `dist/`, since `verify` runs `build` beside the tests,
 * and two builds into one folder clean each other's files. The folder holds what `files` names,
 * with `package.json` and what npm always ships, and packs without `prepack`, which would build into `dist/` again.
 * publint runs in `build`, on `dist/`, so it's off here.
 */
import { tmp } from "./temp.ts";
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

declare module "vite-plus/test" {
  interface ProvidedContext {
    tarball: string;
  }
}

export default function setup({ provide }: { provide: (key: "tarball", value: string) => void }) {
  const root = resolve(import.meta.dirname, "..");
  const staged = tmp("craftz-staged-");
  const { files = [] } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    files?: string[];
  };
  for (const file of [
    "package.json",
    "README.md",
    "LICENSE",
    ...files.filter((it) => it !== "dist"),
  ])
    cpSync(join(root, file), join(staged, file), { recursive: true });
  execFileSync("pnpm", ["exec", "vp", "pack", "--out-dir", join(staged, "dist"), "--no-publint"], {
    cwd: root,
    stdio: "pipe",
  });
  const dir = tmp("craftz-pack-");
  execFileSync("pnpm", ["pack", "--ignore-scripts", "--pack-destination", dir], {
    cwd: staged,
    stdio: "pipe",
  });
  provide("tarball", join(dir, readdirSync(dir)[0] ?? ""));
}

/**
 * Points a repository's craftz at the tarball, in its pnpm settings, leaving `package.json` as it
 * is. It gives back a function that puts the settings back, for after the install, since they're
 * craftz's and `craftz check` reads them word for word.
 */
export function usePacked(dir: string, tarball: string): () => void {
  const settings = join(dir, "pnpm-workspace.yaml");
  const text = readFileSync(settings, "utf8");
  const override = `  "@amitkaps/craftz": "file:${tarball}"`;
  writeFileSync(settings, text.replace(/^overrides:\n/m, `$&${override}\n`));
  return () => writeFileSync(settings, text);
}
