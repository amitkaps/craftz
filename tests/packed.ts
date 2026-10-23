/** @prose
 * # The packed package
 *
 * Packs craftz once, before the tests run, as `pnpm publish` would, and hands the tarball's path
 * to the tests. A test that installs craftz installs this, so it gets only what the package ships,
 * not the checkout around it. `prepack` builds it first.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

declare module "vite-plus/test" {
  interface ProvidedContext {
    tarball: string;
  }
}

export default function setup({ provide }: { provide: (key: "tarball", value: string) => void }) {
  const dir = mkdtempSync(join(tmpdir(), "craftz-pack-"));
  execFileSync("pnpm", ["pack", "--pack-destination", dir], {
    cwd: resolve(import.meta.dirname, ".."),
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
