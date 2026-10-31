#!/bin/bash
set -euo pipefail

# The same on a laptop and in the cloud. pnpm skips the work when the lockfile is up to date.
cd "${CLAUDE_PROJECT_DIR:-.}"

# A failed install must end the script (no "|| true")
pnpm install
