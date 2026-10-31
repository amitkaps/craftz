/** @prose
 * # The releases rules
 *
 * The rules under [Releases](../../docs/rules.md#releases): the files a package releases with, how
 * it's packed, its types and bundled code, and the labels its notes are grouped by.
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import { here, read, readPkg, versionsIn } from "../reference.ts";
import { PACKED } from "../ruled.ts";
import { writeLabels } from "../settings.ts";
import type { Rule } from "../rules.ts";
import { rule, unruled } from "./toolchain.ts";
import { RELEASE_FILES, drifted, owns, unread, writePkg } from "./shared.ts";

/** @prose
 * The notes' config was once `.github/release.yml`, GitHub's default path, which read as the
 * release workflow. It's `.github/notes.yml` now, so the fix deletes the old one.
 */
const OLD_NOTES = ".github/release.yml";
const releaseFiles = owns("releases-files", RELEASE_FILES, (pkg) => !pkg.private);
const labelNames = (
  JSON.parse(read(join(here, ".github", "labels.json"))) as { name: string }[]
).map((label) => label.name);

export const RELEASES_RULES: Rule[] = [
  {
    id: "releases-files",
    check: (repo) => {
      const found = releaseFiles.check(repo);
      if (repo.pkg.private || !repo.files[OLD_NOTES]) return found;
      return drifted([...(found?.drift ?? []), `${OLD_NOTES} is left from before notes.yml`]);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        if (releaseFiles.fix?.in === "files") releaseFiles.fix.apply(dir, std);
        if (!readPkg(dir).private) rmSync(join(dir, OLD_NOTES), { force: true });
      },
    },
  },
  {
    id: "releases-packing",
    check: ({ pkg, deps, files }) => {
      if (pkg.private) return undefined;
      const drift: string[] = [];
      if (pkg.scripts?.prepack !== "pnpm run build")
        drift.push(`prepack is ${pkg.scripts?.prepack}, not pnpm run build`);
      if (pkg.files?.[0] !== "dist")
        drift.push(`files is ${JSON.stringify(pkg.files)}, not "dist" first`);
      if (pkg.publishConfig?.access !== "public") drift.push("publishConfig.access isn't public");
      if (!deps.publint) drift.push("no publint dev dependency");
      drift.push(
        ...unruled(files["vite.config.ts"] ?? "", { pack: { publint: PACKED["publint"] } }),
      );
      return drifted(drift);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const pkg = readPkg(dir);
        if (pkg.private) return;
        pkg.scripts = { ...pkg.scripts, prepack: "pnpm run build" };
        pkg.files = ["dist", ...(pkg.files ?? []).filter((file) => file !== "dist")];
        pkg.publishConfig = { ...pkg.publishConfig, access: "public" };
        const publint = versionsIn(std)["publint"];
        if (publint && !pkg.dependencies?.["publint"]) {
          pkg.devDependencies = { ...pkg.devDependencies, publint };
        }
        writePkg(dir, pkg);
        rule(dir, { pack: { publint: PACKED["publint"] } });
      },
    },
  },
  {
    id: "releases-types",
    check: ({ pkg, deps, files }) => {
      if (pkg.private) return undefined;
      return drifted([
        ...(deps.typescript ? ["has typescript, which Oxc's types don't need"] : []),
        ...unruled(files["vite.config.ts"] ?? "", { pack: { dts: PACKED["dts"] } }),
      ]);
    },
    fix: {
      in: "files",
      apply: (dir) => {
        if (!readPkg(dir).private) rule(dir, { pack: { dts: PACKED["dts"] } });
      },
    },
  },
  {
    id: "releases-bundled",
    check: ({ pkg }) => {
      if (pkg.private) return undefined;
      return drifted(
        Object.keys(pkg.dependencies ?? {})
          .filter((name) => name.startsWith("@amitkaps/"))
          .map((name) => `depends on ${name}, rather than bundling it`),
      );
    },
  },
  {
    id: "releases-labels",
    check: ({ pkg, labels }) => {
      if (pkg.private || !labels) return undefined;
      if (labels instanceof Error) return unread(labels);
      return drifted(labelNames.filter((n) => !labels.includes(n)).map((n) => `no ${n} label`));
    },
    fix: {
      in: "github",
      apply: (repo, pkg) => {
        if (!pkg.private) writeLabels(repo);
      },
    },
  },
];
