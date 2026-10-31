/** @prose
 * # The cloud setup script's test
 *
 * [The script](../reference/cloud-setup.sh) installs the Node and pnpm the reference names, and
 * reads them from the published reference when it runs. Its own versions are for when that
 * can't be fetched, so a bump that leaves them behind would put a cloud session on old tools.
 * This holds them to the reference's, and holds the reading to the reference's file layout.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vite-plus/test";
import { readJson } from "../src/reference.ts";

const reference = join(import.meta.dirname, "..", "reference");
const script = join(reference, "cloud-setup.sh");
const pkg = readJson<{ engines: { node: string }; packageManager: string }>(
  join(reference, "package.json"),
);
const wanted = `${pkg.engines.node.replace(/^>=/, "")} ${pkg.packageManager.split("@")[1]}`;

const versions = (url: string): string =>
  execFileSync("bash", [script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    env: {
      ...process.env,
      CRAFTZ_SETUP_PRINT: "1",
      CRAFTZ_REFERENCE: url,
      SETUP_NODE: process.execPath,
    },
  })
    .trim()
    .split("\n")
    .at(-1)!;

test("the script is valid bash", () => {
  expect(() => execFileSync("bash", ["-n", script])).not.toThrow();
});

test("the script reads the Node and pnpm from the reference's package.json", () => {
  expect(versions(pathToFileURL(join(reference, "package.json")).href)).toBe(wanted);
});

test("the versions the script falls back on are the reference's", () => {
  expect(versions(pathToFileURL(join(reference, "no-such-file")).href)).toBe(wanted);
});
