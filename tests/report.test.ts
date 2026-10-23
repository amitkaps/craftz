/** @prose
 * # The report's test
 *
 * A run's rows stand in for one, like the candidate run before 0.6.0, where one repository was
 * in line and the rest moved alike. A version prints once with every repository it moved in, and a
 * repository that's left by hand or failed shows `✗` in its step and is counted.
 */
import { expect, test } from "vite-plus/test";
import { moveLine, report, row, type Row } from "../src/report.ts";

const prose = { name: "@amitkaps/prose", from: "0.8.0", to: "0.9.0" };
const markz = { name: "@amitkaps/markz", from: "0.7.0", to: "0.8.0" };
const times = { clone: "2s", upgrade: "20s", install: "14s" };

test("a version prints once, with every repository it moved in", () => {
  const rows: Row[] = [
    {
      ...row("base"),
      cells: { ...times, verify: "32s" },
      status: "verified",
      moved: [markz, prose],
    },
    { ...row("prose"), cells: { ...times, verify: "in line" }, status: "in line" },
    { ...row("repo"), cells: { ...times, verify: "8s" }, status: "verified", moved: [prose] },
  ];
  expect(report(rows).join("\n")).toBe(
    [
      "         clone  upgrade  install   verify",
      "  base      2s      20s      14s      32s",
      "  prose     2s      20s      14s  in line",
      "  repo      2s      20s      14s       8s",
      "",
      "Moved",
      "  @amitkaps/markz 0.7.0 → 0.8.0   base",
      "  @amitkaps/prose 0.8.0 → 0.9.0   base, repo",
      "",
      "From craftz: none",
      "",
      "By hand: none",
      "",
      "Failed: none",
      "",
      "✓ 2 verified, 1 in line, 0 failed",
    ].join("\n"),
  );
});

test("what's left by hand and what failed are listed and counted", () => {
  const rows: Row[] = [
    {
      ...row("pagez"),
      cells: { ...times, verify: "✗" },
      status: "left by hand",
      moved: [prose],
      files: [".github/workflows/ci.yml from craftz"],
      byHand: ["versions-markz: 0.7.0, not 0.8.0", "Found 2 errors"],
    },
    { ...row("sitez"), cells: { clone: "3s", upgrade: "✗" }, status: "failed", failed: "boom" },
  ];
  expect(report(rows).slice(4).join("\n")).toBe(
    [
      "Moved",
      "  @amitkaps/prose 0.8.0 → 0.9.0   pagez",
      "",
      "From craftz",
      "  pagez   .github/workflows/ci.yml from craftz",
      "",
      "By hand",
      "  pagez   versions-markz: 0.7.0, not 0.8.0",
      "  pagez   Found 2 errors",
      "",
      "Failed",
      "  sitez   boom",
      "",
      "✗ 0 verified, 0 in line, 1 left by hand, 1 failed",
    ].join("\n"),
  );
  expect(report(rows)[2]).toBe("  sitez     3s        ✗");
});

test("a move reads as the pull request lists it", () => {
  expect(moveLine(prose)).toBe("@amitkaps/prose 0.9.0, from 0.8.0");
  expect(moveLine({ name: "esbuild", from: "0.25.0" })).toBe("esbuild removed");
});
