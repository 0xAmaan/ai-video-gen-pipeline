#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
OUT_DIR="${REPO_ROOT}/public/wasm"
mkdir -p "${OUT_DIR}"

EMCXX=${EMCXX:-${EMXX:-em++}}

SOURCES=(
  "${SCRIPT_DIR}/cpp/core/clip.cpp"
  "${SCRIPT_DIR}/cpp/core/timeline.cpp"
  "${SCRIPT_DIR}/cpp/effects/effects_processor.cpp"
  "${SCRIPT_DIR}/cpp/compositor/compositor.cpp"
  "${SCRIPT_DIR}/cpp/bindings/js_bindings.cpp"
)

"${EMCXX}" "${SOURCES[@]}" \
  -std=c++20 \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ASSERTIONS=1 \
  -s ENVIRONMENT='web,worker' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s SINGLE_FILE=0 \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s EXPORT_NAME='createTimelineModule' \
  -lembind \
  -o "${OUT_DIR}/timeline-engine.js"

cat <<MSG
Built timeline-engine WASM artifacts into public/wasm.
Distribute the companion timeline-engine.wasm along with the JS glue.
MSG
