#!/bin/bash
# Start the Caelia motherboard backend.
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm ci
fi
exec sh extract-and-start.sh
