#!/bin/bash
set -euo pipefail

# The same on a laptop and in the cloud. pnpm skips the work when the lockfile is up to date.
cd "${CLAUDE_PROJECT_DIR:-.}"

# A failed install must end the script (no "|| true")
pnpm install

# A repository that drives a browser needs Chromium's headless shell, which is all a screenshot or
# a test needs. A cloud image ships the shell at the revision of the pinned Playwright, so the
# install finds it and does nothing, and a laptop downloads it once. The cloud sets
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, so the install overrides it.
if grep -Eq '"(@playwright/test|playwright|playwright-core)"' package.json; then
  # `@playwright/test` and `playwright` have the `playwright` command, `playwright-core` its own.
  bin=playwright
  [ -e node_modules/.bin/playwright ] || bin=playwright-core
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 pnpm exec "$bin" install --only-shell chromium
  browser=", playwright shell ready"
fi

# One line saying what this session has, so a mismatch shows at the start. It never fails the hook.
summary="$(PNPM="$(pnpm -v)" BROWSER="${browser:-}" node -e '
  const pkg = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
  const num = (v) => v.replace(/^[^\d]*/, "").split(".").map(Number);
  const below = (a, b) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };
  const node = process.version.slice(1);
  const notes = [];
  const floor = pkg.engines?.node;
  if (floor && below(num(node), num(floor))) notes.push(`node is below ${floor}`);
  const want = pkg.packageManager?.split("@")[1];
  if (want && want !== process.env.PNPM) notes.push(`pnpm wants ${want}`);
  const note = notes.length ? ` (${notes.join(", ")})` : "";
  console.log(`session: node ${node}, pnpm ${process.env.PNPM}${process.env.BROWSER}${note}`);
' 2>/dev/null)" || summary=""
if [ -n "$summary" ]; then echo "$summary"; fi
