#!/bin/bash

# Debian snapshot timestamp you confirmed exists
TS="20171210T160405Z"
BASE="https://snapshot.debian.org/archive/debian/$TS"

PKG_MAIN="firefox-esr_52.5.2esr-1_armhf.deb"
PKG_URL="$BASE/pool/main/f/firefox-esr/$PKG_MAIN"

echo "=== Firefox ESR 52.5.2 Installer for Raspberry Pi (ARMHF) ==="
echo "Using snapshot timestamp: $TS"
echo

mkdir -p ff52
cd ff52

echo "Downloading Firefox ESR package..."
wget -O "$PKG_MAIN" "$PKG_URL"

echo
echo "Attempting installation..."
sudo dpkg -i "$PKG_MAIN"

# Collect missing dependencies
MISSING=$(sudo dpkg -i "$PKG_MAIN" 2>&1 | grep "dependency problems" -A20 | grep "depends on" | awk '{print $3}')

if [ -z "$MISSING" ]; then
    echo "Firefox ESR installed without needing extra dependencies!"
    exit 0
fi

echo
echo "Missing dependencies detected:"
echo "$MISSING"
echo

echo "Searching snapshot archive for missing packages..."

for dep in $MISSING; do
    echo "Searching for $dep ..."
    SEARCH_URL="$BASE/pool/main/"
    
    # brute-force search using snapshot.debian.org index
    URL=$(wget -qO- "$SEARCH_URL" | grep -i "$dep" | sed -n 's/.*href="\([^"]*'"$dep"'[^"]*\.deb\)".*/\1/p' | head -n 1)

    if [ -z "$URL" ]; then
        echo "❌ Could not find $dep in snapshot archive"
        continue
    fi

    FULL_URL="$BASE/$URL"
    echo "Found: $FULL_URL"
    echo "Downloading..."
    wget -O "$(basename "$URL")" "$FULL_URL"
done

echo
echo "Installing downloaded dependencies..."
sudo dpkg -i *.deb
sudo apt-get -f install -y

echo
echo "=== DONE ==="
echo "You can now try running Firefox ESR using: firefox-esr"
