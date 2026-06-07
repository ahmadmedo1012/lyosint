#!/bin/sh
set -e
echo "=== Starting build ==="
date
node --version
pnpm --version
echo "=== Installing dependencies ==="
pnpm install --frozen-lockfile=false
echo "=== Building ==="
pnpm run build
echo "=== Build complete ==="
date