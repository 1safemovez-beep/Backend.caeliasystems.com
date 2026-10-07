#!/bin/bash
# Start the Caelia motherboard backend.
set -e
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo "No .env found — copying .env.example. Set OWNER_TOKEN before use."
  cp .env.example .env
fi
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
node src/index.js
