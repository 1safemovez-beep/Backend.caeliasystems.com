#!/bin/bash

# Extract ZIP files during Docker build
cd /app

if [ -f "CAELIA-BACKEND-SAVE.zip" ]; then
  echo "Extracting CAELIA-BACKEND-SAVE.zip..."
  unzip -q CAELIA-BACKEND-SAVE.zip
  rm CAELIA-BACKEND-SAVE.zip
fi

if [ -f "Caelia_Backend_Core.zip" ]; then
  echo "Extracting Caelia_Backend_Core.zip..."
  unzip -q Caelia_Backend_Core.zip
  rm Caelia_Backend_Core.zip
fi

# The backend archive stores the application in a versioned directory.
APP_ENTRY=$(find /app -type f -path '*/src/index.js' -not -path '*/node_modules/*' -not -path '/app/overrides/*' -print -quit)
if [ -z "$APP_ENTRY" ]; then
  echo "Could not find the backend entry point (*/src/index.js)." >&2
  exit 1
fi

APP_DIR=${APP_ENTRY%/src/index.js}

# Apply the reviewed changes in overrides/ on top of the archived app
# (Caelia brain wiring: chat, teach, health, Discord !ask).
if [ -d /app/overrides ]; then
  echo "Applying overrides to $APP_DIR ..."
  cp -R /app/overrides/. "$APP_DIR/"
fi

exec node "$APP_ENTRY"
