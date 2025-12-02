#!/usr/bin/env bash
set -euo pipefail

# Config
NODE_MAJOR=20
MIRROR="https://unofficial-builds.nodejs.org/download/release"
ARCH="linux-armv6l"
INSTALL_BASE="/usr/local"
INSTALL_DIR="${INSTALL_BASE}/nodejs"
BIN_DIR="/usr/local/bin"

# --- Helpers ---------------------------------------------------------------

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command '$1' not found"
}

# --- Pre-flight checks -----------------------------------------------------

# Must be root because we write to /usr/local
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  die "Please run this script as root, e.g.: sudo $0"
fi

require_cmd curl
require_cmd tar
require_cmd sort

ARCH_DETECTED=$(uname -m)
if [[ "$ARCH_DETECTED" != "armv6l" ]]; then
  echo "WARNING: Detected architecture '$ARCH_DETECTED' (expected 'armv6l')."
  echo "         This script is intended for Raspberry Pi 1 / B+ / Zero (ARMv6)."
  echo "         Continuing anyway..."
fi

# --- Find latest 20.x with an ARMv6 tarball -------------------------------

echo "Fetching available Node.js ${NODE_MAJOR}.x releases from:"
echo "  ${MIRROR}/"

VERSIONS_RAW=$(
  curl -fsSL "${MIRROR}/" \
    | grep -o "v${NODE_MAJOR}\.[0-9]\+\.[0-9]\+/" \
    | tr -d '/'
)

if [[ -z "${VERSIONS_RAW}" ]]; then
  die "Could not find any v${NODE_MAJOR}.x versions at ${MIRROR}"
fi

NODE_VERSION=""
NODE_TARBALL_URL=""

echo "Checking for the newest ${NODE_MAJOR}.x release with ${ARCH} tarball..."

# Sort versions in descending order, pick first that has a working ARMv6 tarball
for v in $(echo "${VERSIONS_RAW}" | sort -Vr); do
  url="${MIRROR}/${v}/node-${v}-${ARCH}.tar.xz"
  if curl -fsI "${url}" >/dev/null 2>&1; then
    NODE_VERSION="${v}"
    NODE_TARBALL_URL="${url}"
    break
  fi
done

if [[ -z "${NODE_VERSION}" ]]; then
  die "No Node.js ${NODE_MAJOR}.x release with ${ARCH} tarball found."
fi

echo "Selected Node.js version: ${NODE_VERSION}"
echo "Download URL: ${NODE_TARBALL_URL}"

# --- Download & install ----------------------------------------------------

TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

cd "${TMP_DIR}"

echo "Downloading Node.js ${NODE_VERSION} (${ARCH})..."
curl -fsSL -o "node-${NODE_VERSION}-${ARCH}.tar.xz" "${NODE_TARBALL_URL}"

echo "Extracting..."
tar -xJf "node-${NODE_VERSION}-${ARCH}.tar.xz"

# The tarball contains a directory like node-v20.xx.x-linux-armv6l
EXTRACTED_DIR="node-${NODE_VERSION}-${ARCH}"
if [[ ! -d "${EXTRACTED_DIR}" ]]; then
  # Some tarballs use node-v20.x.x-linux-armv6l naming
  EXTRACTED_DIR="node-${NODE_VERSION}-${ARCH//linux-/}"
fi

# Fallback: auto-detect single directory if name changed
if [[ ! -d "${EXTRACTED_DIR}" ]]; then
  CANDIDATE=$(find . -maxdepth 1 -type d -name "node-v${NODE_VERSION}-*" | head -n1 || true)
  if [[ -n "${CANDIDATE}" ]]; then
    EXTRACTED_DIR="${CANDIDATE#./}"
  fi
fi

[[ -d "${EXTRACTED_DIR}" ]] || die "Could not find extracted Node.js directory"

echo "Installing into ${INSTALL_DIR}/${NODE_VERSION}..."
mkdir -p "${INSTALL_DIR}"
TARGET_DIR="${INSTALL_DIR}/${NODE_VERSION}"
rm -rf "${TARGET_DIR}"
mv "${EXTRACTED_DIR}" "${TARGET_DIR}"

echo "Creating / updating symlinks in ${BIN_DIR}..."
mkdir -p "${BIN_DIR}"

ln -sfn "${TARGET_DIR}/bin/node" "${BIN_DIR}/node"
ln -sfn "${TARGET_DIR}/bin/npm"  "${BIN_DIR}/npm"
if [[ -f "${TARGET_DIR}/bin/npx" ]]; then
  ln -sfn "${TARGET_DIR}/bin/npx" "${BIN_DIR}/npx"
fi

echo
echo "Installation complete."
echo "Node.js binary: ${TARGET_DIR}/bin/node"
echo "Global symlink: $(command -v node || echo "${BIN_DI_
