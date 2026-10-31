#!/bin/bash
set -euo pipefail

# The same on a laptop and in the cloud. pnpm skips the work when the lockfile is up to date.
cd "${CLAUDE_PROJECT_DIR:-.}"

# A failed install must end the script (no "|| true")
pnpm install

# A repository whose tests drive a browser needs its Chromium once. The cloud sets
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, so the install overrides it. It installs the revision the
# repository's own Playwright expects, which an environment's setup script can't know, and it
# does nothing when that revision is there.
if grep -Eq '"(@playwright/test|playwright|playwright-core)"' package.json; then
  # `@playwright/test` and `playwright` have the `playwright` command, `playwright-core` its own.
  bin=playwright
  [ -e node_modules/.bin/playwright ] || bin=playwright-core
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 pnpm exec "$bin" install chromium
fi
