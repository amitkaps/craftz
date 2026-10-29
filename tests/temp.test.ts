/** @prose
 * # Temporary folders
 *
 * Runs [temp.ts](../src/temp.ts) in a process of its own, since it removes its folders when the
 * process exits. A folder is gone after a run that ends well, kept after one that keeps it, and
 * kept, with where it is, after one that fails. No other module in `src/` makes a folder itself.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

const src = join(import.meta.dirname, "..", "src");
const temp = join(src, "temp.ts");

// Runs `body` with `temporary` and `keep` imported, and returns what it printed and its folder.
function runs(body: string): { dir: string; stderr: string; status: number | null } {
  const script = `import { keep, temporary } from ${JSON.stringify(temp)};\nconst dir = temporary("craftz-temp-");\nconsole.log(dir);\n${body}`;
  const result = spawnSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" });
  return { dir: result.stdout.trim(), stderr: result.stderr, status: result.status };
}

test("a folder is removed when the run ends, unless it's kept or the run fails", () => {
  const ended = runs("");
  expect(ended.status).toBe(0);
  expect(existsSync(ended.dir)).toBe(false);

  const kept = runs("keep(dir);");
  expect(existsSync(kept.dir)).toBe(true);
  expect(kept.stderr).toBe("");

  const failed = runs("process.exit(1);");
  expect(existsSync(failed.dir)).toBe(true);
  expect(failed.stderr).toContain(`Kept ${failed.dir}, since the run failed.`);
});

test("only temp.ts makes a temporary folder in src/", () => {
  const makes = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts") && file !== "temp.ts")
    .filter((file) => readFileSync(join(src, file), "utf8").includes("mkdtemp"));
  expect(makes).toEqual([]);
});
