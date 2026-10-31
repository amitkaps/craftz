#!/bin/bash
# Cloud setup: install Node and pnpm, and make Node the default `node`. Paste this once as the
# environment's setup script. It reads the versions from craftz's reference when it runs, so a
# craftz bump reaches every new environment without pasting it again.
# /opt/node22/bin is already first on PATH, so repoint /opt/node22 at the new Node.
# Always exits 0 so a failed step can't block the session.

# The versions used when the reference can't be fetched. A test holds them to the reference's.
NODE_VERSION="26.13.0"
PNPM_VERSION="12.16.1"
REFERENCE="${CRAFTZ_REFERENCE:-https://raw.githubusercontent.com/amitkaps/craftz/main/reference/package.json}"

# The reference's Node floor and pnpm, read with the Node the environment starts on.
latest="$(curl -fsSL --max-time 20 "$REFERENCE" 2>/dev/null | "${SETUP_NODE:-/opt/node22/bin/node}" -e '
  const p = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log(p.engines.node.replace(/^>=/, ""), p.packageManager.split("@")[1]);
' 2>/dev/null)" || latest=""
if [[ "$latest" =~ ^[0-9]+\.[0-9]+\.[0-9]+\ [0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NODE_VERSION="${latest% *}"
  PNPM_VERSION="${latest#* }"
else
  echo "WARNING: couldn't read craftz's reference; using Node ${NODE_VERSION} and pnpm ${PNPM_VERSION}"
fi

# Stops here, for the test that holds these versions to the reference's.
if [ -n "${CRAFTZ_SETUP_PRINT:-}" ]; then
  echo "${NODE_VERSION} ${PNPM_VERSION}"
  exit 0
fi

install_node() {
  set -euo pipefail
  base="https://nodejs.org/dist/v${NODE_VERSION}"
  file="node-v${NODE_VERSION}-linux-x64.tar.xz"
  tmp="$(mktemp -d)"
  cd "$tmp"

  curl -fsSL "$base/SHASUMS256.txt" -o SHASUMS256.txt
  curl -fsSL "$base/$file" -o "$file"
  grep " $file\$" SHASUMS256.txt | sha256sum -c -

  rm -rf "/opt/node-${NODE_VERSION}"
  mkdir -p "/opt/node-${NODE_VERSION}"
  tar -xJf "$file" -C "/opt/node-${NODE_VERSION}" --strip-components=1

  if [ -d /opt/node22 ] && [ ! -L /opt/node22 ]; then
    mv /opt/node22 /opt/node22.orig
  fi
  ln -sfn "/opt/node-${NODE_VERSION}" /opt/node22

  /opt/node22/bin/node -v
}

( install_node ) || echo "WARNING: Node ${NODE_VERSION} install failed; session continues on Node 22"

# Node 26 ships no corepack, and the swap above removed Node 22's pnpm shim.
(
  set -euo pipefail
  command -v pnpm >/dev/null 2>&1 || /opt/node22/bin/npm install -g "pnpm@${PNPM_VERSION}"
  pnpm -v
) || echo "WARNING: pnpm ${PNPM_VERSION} install failed; pnpm isn't available"

exit 0
