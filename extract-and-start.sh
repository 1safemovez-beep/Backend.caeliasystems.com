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

# Start the application
node index.js
