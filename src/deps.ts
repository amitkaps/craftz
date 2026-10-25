/** @prose
 * # What's installed
 *
 * `craftz deps` says what a repository's install holds: how many packages, how big, and which
 * direct dependency brings each. It reads what's on disk, after `pnpm install`, so a package built
 * for another platform isn't counted, and a binary an install script fetches is.
 *
 * Each package counts once. A direct dependency's own package is its own, and a package two of
 * them bring is listed as shared, so the lines add up to the total. A walk stops at another
 * direct dependency, which has its own line. Each line names its three biggest packages, which is
 * where a smaller install starts.
 *
 * pnpm prints each package's dependencies once in its tree. Where it meets the package again, it
 * marks it `deduped`, with none, so a deduped package's dependencies are read from where they were
 * printed. That can be under another direct dependency, even for a direct dependency's own line.
 *
 * pnpm keeps a version in `node_modules/.pnpm` after nothing needs it, until the next fresh
 * install. Those are listed apart, since they're on disk but not in the install. craftz read
 * 952 MB on disk when its install was 502 MB.
 *
 * It's a report, not a check, so it never fails on a size.
 */
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";

/** A package in `pnpm ls --json`'s tree. A package already printed is `deduped`, without its
 *  dependencies. */
export type Node = {
  version?: string;
  path?: string;
  deduped?: boolean;
  dependencies?: Record<string, Node>;
};

type Part = { packages: number; bytes: number };

/** One direct dependency's share of the install. */
export type Weighed = Part & { name: string; heaviest: { name: string; bytes: number }[] };

/** What an install holds, by direct dependency. */
export type Weight = Part & { direct: Weighed[]; shared: Part; left: Part };

// The folder pnpm keeps a package in, which holds its files and links to its dependencies.
const folderOf = (path = ""): string | undefined =>
  /^(.*\/node_modules\/\.pnpm\/[^/]+)\//.exec(path)?.[1];

/** Splits the folders on disk, with their sizes, among the direct dependencies that bring them. */
export function weigh(direct: Record<string, Node>, sizes: Map<string, number>): Weight {
  // pnpm prints a package's dependencies once, wherever it meets it first, which can be under
  // another direct dependency, even for a direct dependency's own line.
  const printed = new Map<string, Record<string, Node>>();
  const gather = (nodes: Record<string, Node>): void => {
    for (const node of Object.values(nodes)) {
      if (node.deduped || !node.dependencies || !node.path) continue;
      if (!printed.has(node.path)) printed.set(node.path, node.dependencies);
      gather(node.dependencies);
    }
  };
  gather(direct);
  const names = new Map<string, string>();
  const tops = new Map<string, string>();
  for (const [name, node] of Object.entries(direct)) {
    const folder = folderOf(node.path);
    if (folder && sizes.has(folder)) tops.set(folder, name);
  }
  const owners = new Map<string, Set<string>>();
  for (const [top, node] of Object.entries(direct)) {
    const walk = (name: string, at: Node): void => {
      const folder = folderOf(at.path);
      if (!folder || !sizes.has(folder)) return;
      const other = tops.get(folder);
      if (other && other !== top) return;
      const seen = owners.get(folder) ?? new Set();
      if (seen.has(top)) return;
      owners.set(folder, seen.add(top));
      names.set(folder, name);
      const children = at.deduped ? printed.get(at.path ?? "") : at.dependencies;
      for (const [dep, child] of Object.entries(children ?? {})) walk(dep, child);
    };
    walk(top, node);
  }
  const part = (folders: string[]): Part => ({
    packages: folders.length,
    bytes: folders.reduce((sum, f) => sum + (sizes.get(f) ?? 0), 0),
  });
  const installed = [...owners.keys()];
  const of = (top: string) =>
    installed.filter((f) => owners.get(f)?.size === 1 && owners.get(f)?.has(top));
  return {
    ...part(installed),
    direct: Object.keys(direct)
      .map((name) => {
        const own = of(name);
        const heaviest = own
          .map((f) => ({ name: names.get(f) ?? f, bytes: sizes.get(f) ?? 0 }))
          .sort((a, b) => b.bytes - a.bytes)
          .slice(0, 3);
        return { name, ...part(own), heaviest };
      })
      .sort((a, b) => b.bytes - a.bytes),
    shared: part(installed.filter((f) => (owners.get(f)?.size ?? 0) > 1)),
    left: part([...sizes.keys()].filter((f) => !owners.has(f))),
  };
}

// The bytes of a folder's own files. Links to other packages are their own folders.
function bytesIn(dir: string): number {
  let sum = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sum += bytesIn(path);
    else if (entry.isFile()) sum += lstatSync(path).size;
  }
  return sum;
}

const size = (bytes: number): string => {
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return "<1 MB";
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
};

const count = (n: number): string => `${n} ${n === 1 ? "package" : "packages"}`;

/** The lines `craftz deps` prints for a weighed install. */
export function report(weight: Weight): string[] {
  const widest = (texts: string[]): number => Math.max(...texts.map((t) => t.length));
  const names = widest(weight.direct.map((d) => d.name));
  const counts = widest(weight.direct.map((d) => count(d.packages)));
  const sizes = widest(weight.direct.map((d) => size(d.bytes)));
  const lines = [
    `craftz deps: ${count(weight.packages)}, ${size(weight.bytes)}, from ${weight.direct.length} direct dependencies`,
    "",
    ...weight.direct.map((d) => {
      const heavy = d.packages > 1 ? d.heaviest.map((h) => `${h.name} ${size(h.bytes)}`) : [];
      const columns = [
        d.name.padEnd(names),
        count(d.packages).padStart(counts),
        size(d.bytes).padStart(sizes),
      ];
      return `  ${[...columns, heavy.join(", ")].join("  ").trimEnd()}`;
    }),
  ];
  if (weight.shared.packages || weight.left.packages) lines.push("");
  if (weight.shared.packages) {
    lines.push(`  shared: ${count(weight.shared.packages)}, ${size(weight.shared.bytes)}`);
  }
  if (weight.left.packages) {
    lines.push(
      `  left from older installs: ${count(weight.left.packages)}, ${size(weight.left.bytes)}, which a fresh pnpm install removes`,
    );
  }
  return lines;
}

/** Weighs the install in `dir`, and says what it holds. */
export function deps(dir: string): number {
  if (!existsSync(join(dir, "node_modules", ".pnpm"))) {
    console.error(`craftz deps: ${dir} has no pnpm install, so run pnpm install first`);
    return 1;
  }
  // pnpm's tree names real paths, as on macOS, where /tmp is /private/tmp.
  const store = realpathSync(join(dir, "node_modules", ".pnpm"));
  const [tree] = JSON.parse(
    execFileSync("pnpm", ["ls", "--depth", "Infinity", "--json"], {
      cwd: dir,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    }),
  ) as { dependencies?: Record<string, Node>; devDependencies?: Record<string, Node> }[];
  const sizes = new Map(
    readdirSync(store, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
      .map((entry) => [join(store, entry.name), bytesIn(join(store, entry.name))]),
  );
  const weight = weigh({ ...tree?.dependencies, ...tree?.devDependencies }, sizes);
  console.log(report(weight).join("\n"));
  return 0;
}
