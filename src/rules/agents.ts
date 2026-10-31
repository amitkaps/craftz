/** @prose
 * # The agents rules
 *
 * The rules under [Agents](../../docs/rules.md#agents): the sections of `AGENTS.md` every
 * repository shares with craftz's, and `outline.md` kept out of git.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { here, read } from "../reference.ts";
import type { Rule } from "../rules.ts";
import { drifted } from "./shared.ts";

/** @prose
 * # The agents' instructions
 *
 * A section runs from its `## ` heading to the next. The fix writes this repository's shared
 * sections over a repository's own, or puts them before its first section when they're
 * missing, and leaves the rest of the file alone.
 */
const SECTIONS = ["craftz", "Prose"];
// A section that was shared once, and that the fix removes from a repository that still has it.
const RETIRED = ["Outline"];
const OUTLINE = "outline.md";
// Whether a .gitignore names a root file, as `name` or `/name`.
const ignores = (text: string, name: string): boolean =>
  text.split("\n").some((line) => [name, `/${name}`].includes(line.trim()));
const sectionOf = (heading: string): RegExp =>
  new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m");
const section = (text: string, heading: string): string | undefined =>
  sectionOf(heading).exec(text)?.[1]?.trim();
const agents = read(join(here, "AGENTS.md"));

export const AGENTS_RULES: Rule[] = [
  {
    id: "agents-sections",
    check: ({ files }) => {
      const text = files["AGENTS.md"];
      if (!text) return drifted(["no AGENTS.md"]);
      const drift = SECTIONS.flatMap((heading) => {
        const have = section(text, heading);
        if (!have) return [`no ${heading} section`];
        return have === section(agents, heading)
          ? []
          : [`${heading} section differs from craftz's`];
      });
      for (const heading of RETIRED) {
        if (section(text, heading)) drift.push(`${heading} section, which craftz no longer shares`);
      }
      if (files["CLAUDE.md"]?.trim() !== "@AGENTS.md") drift.push("CLAUDE.md isn't @AGENTS.md");
      return drifted(drift);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const ours = read(join(std, "AGENTS.md"));
        const path = join(dir, "AGENTS.md");
        let text = read(path) || "# AGENTS.md\n";
        let after = -1;
        for (const heading of SECTIONS) {
          const want = sectionOf(heading).exec(ours)?.[0];
          if (!want) continue;
          const block = `${want.trimEnd()}\n\n`;
          const have = sectionOf(heading).exec(text);
          // A missing section goes after the one before it, or before the file's first section.
          const at = have?.index ?? (after >= 0 ? after : text.search(/^## /m));
          const end = have ? at + have[0].length : at;
          text =
            at < 0 ? `${text.trimEnd()}\n\n${block}` : text.slice(0, at) + block + text.slice(end);
          after = (at < 0 ? text.length - block.length : at) + block.length;
        }
        for (const heading of RETIRED) text = text.replace(sectionOf(heading), "");
        writeFileSync(path, `${text.trimEnd()}\n`);
        writeFileSync(join(dir, "CLAUDE.md"), "@AGENTS.md\n");
      },
    },
  },
  {
    id: "agents-outline",
    check: ({ files }) =>
      drifted(
        ignores(files[".gitignore"] ?? "", OUTLINE) ? [] : [`.gitignore doesn't list ${OUTLINE}`],
      ),
    fix: {
      in: "files",
      apply: (dir) => {
        const path = join(dir, ".gitignore");
        const text = read(path);
        if (ignores(text, OUTLINE)) return;
        writeFileSync(
          path,
          `${text.trimEnd()}\n\n# Written by prose outline\n${OUTLINE}\n`.trimStart(),
        );
      },
    },
  },
];
