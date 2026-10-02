# iOS Build Configuration Fixes

This directory contains scripts to fix iOS build issues in the Grassland Cheese app.

## Problem Statement

The iOS build was failing with two types of issues:

1. **Duplicate C++ Standard Library Linkage**: The linker error `ld: ignoring duplicate libraries: '-lc++'` occurred because multiple CocoaPods dependencies were specifying C++ standard library linkage flags.

2. **Xcode Build Script Phase Warnings**: Build script phases were configured to always run and produced warnings about missing "Based on dependency analysis" configuration.

## Solution Overview

### 1. Fix C++ Standard Library Linkage (`fix-ios-cpp-linkage.sh`)

This script modifies the generated `Podfile` to:
- Add a `post_install` hook that normalizes C++ standard library configuration across all pods
- Remove duplicate `-lc++` flags from `OTHER_LDFLAGS`
- Set consistent C++ library usage to `libc++` (the default for modern iOS)
- Target problematic pods like `hermes-engine` and `RCT-Folly` to ensure they don't add conflicting flags

**How it works:**
1. Creates a backup of the original Podfile
2. Parses the Podfile to preserve existing configuration
3. Adds/updates the `post_install` hook with proper C++ linkage fixes
4. Ensures all targets use `CLANG_CXX_LIBRARY = 'libc++'`

### 2. Fix CocoaPods State (`codemagic.yaml`)

The build process now:
1. Runs `pod deintegrate` before `pod install` to ensure a clean state
2. This removes any stale pod artifacts that might be causing linker conflicts

### 3. Build Script Phase Configuration (`fix-ios-build-phases.sh`)

The build script phase warnings are informational and come from Expo's prebuild process. These warnings:
- Do **not** prevent the build from succeeding
- Are expected in Expo-generated Xcode projects
- Can be safely ignored in CI/CD pipelines

## Integration with CI/CD (codemagic.yaml)

The updated workflow now includes:

```yaml
- name: Prebuild iOS
  script: cd apps/mobile && npx expo prebuild --platform ios --clean

- name: Fix CocoaPods configuration
  script: cd apps/mobile/ios && bash ../../scripts/fix-ios-cpp-linkage.sh

- name: Clean CocoaPods state
  script: cd apps/mobile/ios && pod deintegrate || true

- name: Install CocoaPods
  script: cd apps/mobile/ios && pod install --repo-update

- name: Fix Xcode build phases
  script: cd apps/mobile/ios && bash ../../scripts/fix-ios-build-phases.sh "$(ls -d *.xcodeproj | head -1)"

- name: Set up code signing
  script: cd apps/mobile/ios && xcode-project use-profiles
```

## Technical Details

### C++ Standard Library Configuration

Modern iOS development requires a single, consistent C++ standard library:
- Xcode defaults to `libc++` (LLVM's C++ library)
- Mixing `-lc++` and `-lstdc++` or multiple `-lc++` flags causes linker conflicts
- The `post_install` hook ensures all pods use the same library

### Hermes Engine Considerations

React Native Hermes is a popular JavaScript engine that includes C++ components. The fix specifically handles:
- `hermes-engine`: The Hermes runtime pod
- `RCT-Folly`: Facebook's C++ utility library used by React Native
- `Boost`: Additional C++ dependencies

These pods are checked to ensure they don't add conflicting C++ linkage flags.

## Troubleshooting

If the build still fails with duplicate library errors:

1. **Check the Podfile** after running the fix script:
   ```bash
   cat apps/mobile/ios/Podfile | grep -A 20 "post_install"
   ```

2. **Verify CocoaPods is clean**:
   ```bash
   cd apps/mobile/ios
   pod deintegrate
   rm Podfile.lock
   pod install --repo-update
   ```

3. **Check individual pod specifications**:
   ```bash
   pod spec cat hermes-engine
   ```

4. **Xcode Build Settings**: Verify that C++ library settings are consistent in Xcode's build settings editor (Product → Scheme → Edit Scheme → Build Settings).

## References

- [CocoaPods Post-Install Hooks](https://guides.cocoapods.org/plugins/using-plugins.html)
- [React Native Linking iOS](https://reactnative.dev/docs/linking-libraries-ios)
- [Xcode Build Settings Reference](https://developer.apple.com/documentation/xcode/build-settings-reference)
- [Hermes JavaScript Engine](https://hermesengine.dev/)
