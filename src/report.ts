/** @prose
 * # align's report
 *
 * While `pnpm align` runs, each step prints a dot as each repository ends it, and `✗` for one that
 * fails there, which then drops out of the steps after it. The report at the end says what the
 * run did, from the rows the steps fill in.
 *
 * A table gives each step's time for each repository, so a slow one stands out. A time is the
 * step's own work, not the wait for another repository's turn to verify. Each version that moved
 * is one line, with the repositories it moved in, since a release moves most of them alike. Then
 * the files a fix brought, what's left by hand, and what failed, which print `none` when empty,
 * since those are what a run is read for.
 *
 * A repository left by hand or failed gets no pull request, so nothing in it moved, and its
 * versions and files aren't listed. Its own `craftz upgrade` does the fix again, before the steps
 * that are left. What's left for review, the settings and the pull
 * requests print only when there are any. A last line counts the outcomes.
 */

/** The steps every repository takes, in order, as the table's columns. */
export const STEPS = ["clone", "upgrade", "install", "verify"] as const;
export type Step = (typeof STEPS)[number];

/** A version that moved, or a dependency a fix added or removed. */
export type Move = { name: string; from?: string; to?: string };

/** One repository's run, as the steps fill it in. A step's cell is its time, `✗` where it
 *  failed, or `in line` for the verify a repository already in line skips. */
export type Row = {
  repo: string;
  cells: Partial<Record<Step, string>>;
  status?: "verified" | "in line" | "left by hand" | "failed";
  moved: Move[];
  /** Files a fix brought from craftz, or deleted. */
  files: string[];
  /** New majors, left for review. */
  review: string[];
  byHand: string[];
  failed?: string;
  settings: string[];
  pr?: string;
};

export const row = (repo: string): Row => ({
  repo,
  cells: {},
  moved: [],
  files: [],
  review: [],
  byHand: [],
  settings: [],
});

/** A move as one line, as the pull request lists it. */
export function moveLine({ name, from, to }: Move): string {
  return to ? `${name} ${to}, from ${from ?? "nothing"}` : `${name} removed`;
}

const arrow = ({ name, from, to }: Move): string =>
  to ? `${name} ${from ?? "nothing"} → ${to}` : `${name} removed`;

const pad = (lines: [string, string][]): string[] => {
  const width = Math.max(...lines.map(([left]) => left.length));
  return lines.map(([left, right]) => `  ${left.padEnd(width)}   ${right}`.trimEnd());
};

/** Each step's time for each repository, each column as wide as its widest cell. */
export function table(rows: Row[]): string[] {
  const width = Math.max(...rows.map(({ repo }) => repo.length));
  const cells = rows.map((r) => STEPS.map((step) => r.cells[step] ?? ""));
  const widths = STEPS.map((step, i) => Math.max(step.length, ...cells.map((c) => c[i]!.length)));
  const line = (first: string, row: readonly string[]) =>
    `  ${first.padEnd(width)}${row.map((cell, i) => `  ${cell.padStart(widths[i]!)}`).join("")}`;
  return [line("", STEPS), ...rows.map((r, i) => line(r.repo, cells[i]!).trimEnd())];
}

// A section, with one line for each repository's entries, or `none`.
function section(title: string, rows: Row[], of: (row: Row) => string[], always: boolean) {
  const lines = rows.flatMap((row) => of(row).map((entry): [string, string] => [row.repo, entry]));
  if (!lines.length) return always ? [`${title}: none`] : [];
  return [title, ...pad(lines)];
}

/** The report at the end of a run. */
export function report(rows: Row[]): string[] {
  const kept = rows.filter((r) => r.status !== "left by hand" && r.status !== "failed");
  const moved = new Map<string, string[]>();
  for (const { repo, moved: moves } of kept) {
    for (const move of moves) moved.set(arrow(move), [...(moved.get(arrow(move)) ?? []), repo]);
  }
  const count = (status: Row["status"]) => rows.filter((r) => r.status === status).length;
  const left = count("left by hand");
  const failed = count("failed");
  const total = [
    `${count("verified")} verified`,
    `${count("in line")} in line`,
    ...(left ? [`${left} left by hand`] : []),
    `${failed} failed`,
  ];
  const sections = [
    table(rows),
    moved.size
      ? ["Moved", ...pad([...moved].map(([move, repos]) => [move, repos.join(", ")]))]
      : ["Moved: none"],
    section("From craftz", kept, (r) => r.files, true),
    section("Left for review", rows, (r) => r.review, false),
    section("By hand", rows, (r) => r.byHand, true),
    section("Failed", rows, (r) => (r.failed ? [r.failed] : []), true),
    section("Settings", rows, (r) => r.settings, false),
    section("Pull requests", rows, (r) => (r.pr ? [r.pr] : []), false),
    [`${left || failed ? "✗" : "✓"} ${total.join(", ")}`],
  ];
  return sections
    .filter((lines) => lines.length)
    .flatMap((lines, i) => (i ? ["", ...lines] : lines));
}
