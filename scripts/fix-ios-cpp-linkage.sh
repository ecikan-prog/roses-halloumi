#!/bin/bash

# Fix duplicate C++ standard library linkage in CocoaPods
# This script patches the generated Podfile with post_install hook

set -e

PODFILE_PATH="${1:-.}/Podfile"

if [ ! -f "$PODFILE_PATH" ]; then
  echo "Error: Podfile not found at $PODFILE_PATH"
  exit 1
fi

echo "Fixing C++ standard library linkage in Podfile..."

# Backup original
cp "$PODFILE_PATH" "$PODFILE_PATH.bak"

# Create new Podfile with post_install hook
{
  # Include original Podfile content (up to the last line before end or post_install)
  sed '/^post_install/,$d' "$PODFILE_PATH.bak" | sed '/^end[[:space:]]*$/d'
  
  # Add new post_install hook
  cat << 'RUBY_EOF'

post_install do |installer|
  # Fix duplicate C++ standard library linkage
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # Ensure consistent C++ standard library usage
      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
      
      # Remove -lc++ from OTHER_LDFLAGS if present to prevent duplicates
      if config.build_settings['OTHER_LDFLAGS']
        other_ldflags = config.build_settings['OTHER_LDFLAGS']
        if other_ldflags.is_a?(String)
          other_ldflags = other_ldflags.gsub(/-lc\+\+/, '').strip
          config.build_settings['OTHER_LDFLAGS'] = other_ldflags.empty? ? nil : other_ldflags
        elsif other_ldflags.is_a?(Array)
          other_ldflags = other_ldflags.reject { |flag| flag == '-lc++' }
          config.build_settings['OTHER_LDFLAGS'] = other_ldflags.empty? ? nil : other_ldflags
        end
      end
    end
  end
end
RUBY_EOF
} > "$PODFILE_PATH.new"

mv "$PODFILE_PATH.new" "$PODFILE_PATH"

echo "✓ Podfile updated with C++ linkage fixes"
