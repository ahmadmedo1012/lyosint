#!/bin/sh
set -e
echo "Starting build at $(date)"
node --version
pnpm --version
pnpm install --frozen-lockfile=false
echo "Install done at $(date)"
pnpm run build
echo "Build done at $(date)"
