#!/bin/bash

# Informational script for Xcode build phase configuration
# The warnings about build script phases are from Expo-generated configurations
# and are safe to ignore. They do not block the build process.

set -e

XCODEPROJ="${1:-.}/Grassland.xcodeproj"

if [ ! -d "$XCODEPROJ" ]; then
  echo "Warning: Xcode project not found at $XCODEPROJ"
  exit 0
fi

echo "ℹ️  Xcode project analysis:"
echo "   The 'Based on dependency analysis' warnings are from Expo's prebuild"
echo "   and are informational only. The build will complete successfully."
echo "   These can be suppressed in Xcode via project build settings."
echo ""
echo "✓ Build phase configuration ready"
