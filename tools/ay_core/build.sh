#!/bin/sh
set -eu
cd "$(dirname "$0")"
: "${CC:=clang}"
WASM_LD="${WASM_LD:-$(command -v wasm-ld || command -v wasm-ld-18)}"
export_args=""
for name in $(sed -n 's/.* \(ay_[a-z_]*\)(.*/\1/p' ay_core.h); do export_args="$export_args -Wl,--export=$name"; done
# Word splitting is intentional for the controlled export flags above.
"$CC" --target=wasm32 -std=c11 -O3 -nostdlib -fno-builtin -ffp-contract=off -fno-fast-math \
    -Wall -Wextra -Werror -fuse-ld="$WASM_LD" \
    -Wl,--no-entry -Wl,--export-memory -Wl,--initial-memory=2097152 -Wl,--max-memory=2097152 \
    -Wl,-z,stack-size=131072 $export_args ay_core.c -o ay_core.wasm
python3 embed.py
