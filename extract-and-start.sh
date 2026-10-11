#!/bin/bash

# The tracked backend source is bundled in this archive. Extract it into a
# deterministic local directory when it is not already available.
cd "$(dirname "$0")"

APP_DIR="motherboard-backend-2026-10-03"

if [ ! -f "$APP_DIR/src/index.js" ]; then
  if [ ! -f "CAELIA-BACKEND-SAVE.zip" ]; then
    echo "Missing CAELIA-BACKEND-SAVE.zip and $APP_DIR/src/index.js" >&2
    exit 1
  fi
  echo "Extracting CAELIA-BACKEND-SAVE.zip..."
  unzip -q CAELIA-BACKEND-SAVE.zip
fi

exec node --env-file-if-exists=.env "$APP_DIR/src/index.js"
