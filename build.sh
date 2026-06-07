#!/bin/sh
set -e
echo "=== Starting build ==="
date
node --version
pnpm --version
echo "=== Installing dependencies (including dev) ==="
pnpm install --frozen-lockfile=false --dev
echo "=== Install done ==="
echo "=== Building ==="
pnpm run build
echo "=== Build complete ==="
date