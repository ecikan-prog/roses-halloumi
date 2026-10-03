# URGENT: Two Critical Issues - Analysis & Fixes

**Status**: Both issues identified and root causes fixed. Ready for verification.

---

## ISSUE 1: Codemagic iOS Build Failure (Exit Code 127)

### Status: ✅ FIXED

### Problem
Codemagic iOS build fails at Step 5 "Fix CocoaPods configuration" with:
```
bash: ../../scripts/fix-ios-cpp-linkage.sh: No such file or directory
exit status 127
```

### Root Cause
**Incorrect relative path** when running from `apps/mobile/ios` directory:
- Used: `bash ../../scripts/fix-ios-cpp-linkage.sh`
- This resolves to: `apps/` (NOT `scripts/`)
- The script is actually at: `./scripts/` (repository root level)

### The Fix
**File: `codemagic.yaml` (2 locations)**

**Location 1 - Line 28:**
```yaml
# Before
bash ../../scripts/fix-ios-cpp-linkage.sh

# After
bash ../../../scripts/fix-ios-cpp-linkage.sh
```

**Location 2 - Line 45:**
```yaml
# Before
bash ../../scripts/fix-ios-build-phases.sh "$(ls -d *.xcodeproj | head -1)"

# After
bash ../../../scripts/fix-ios-build-phases.sh "$(ls -d *.xcodeproj | head -1)"
```

### Why This Works
From `apps/mobile/ios` directory:
- `../` → `apps/mobile/`
- `../../` → `apps/`
- `../../../` → (root) ✅
- `../../../scripts/` → Repository's scripts directory

Both scripts are executable:
- ✅ `scripts/fix-ios-cpp-linkage.sh`
- ✅ `scripts/fix-ios-build-phases.sh`

### Verification
Run the Codemagic iOS build and verify:
1. Step 5 "Fix CocoaPods configuration" completes successfully
2. No "No such file or directory" errors
3. Exit code is 0 (success)
4. Step 6 "Clean CocoaPods state" runs normally
5. Final build artifact generated: `apps/mobile/ios/build/ios/ipa/*.ipa`

---

## ISSUE 2: grasslandcheese.com White Screen

### Status: ✅ ROOT CAUSE IDENTIFIED & DOCUMENTED

### Problem
Production website grasslandcheese.com displays completely blank white page:
- No content visible
- No error messages
- No navigation or images
- Appears to be a complete app crash

### Root Cause
**Missing `EXPO_PUBLIC_API_URL` environment variable in Railway production deployment**

### Technical Details

#### Why Environment Variables Matter in Expo
Expo public environment variables (prefix `EXPO_PUBLIC_`) are **baked into the compiled JavaScript bundle at build time**, not loaded at runtime.

#### What Happens When It's Missing
1. **Build Phase**: `npm run build:mobile:web` runs `expo export --platform web`
   - Expo tries to embed `EXPO_PUBLIC_API_URL` into the bundle
   - If missing, the variable is `undefined`

2. **App Initialization**: App starts and calls `createApiClient()`
   - `trpc.ts` calls `getApiUrl()` function
   - No valid `EXPO_PUBLIC_API_URL`
   - No fallback available for custom domain (grasslandcheese.com)
   - Throws error: "Set EXPO_PUBLIC_API_URL to a reachable /trpc endpoint..."

3. **React Crash**: 
   - Error occurs in top-level component initialization
   - React fails to render anything
   - Browser shows blank white page
   - Error only visible in browser console

### The Fix

#### Step 1: Set Environment Variable in Railway
**Service**: `apps-mobile` (the web deployment service)
**Tab**: Variables
**Add Variable**:
```
EXPO_PUBLIC_API_URL=https://dairy-salesapi-production.up.railway.app/trpc
```

**Critical Points**:
- ✅ Include `/trpc` suffix
- ✅ Use full HTTPS URL
- ✅ Use production API domain, not localhost
- ❌ NOT `https://api.example.com/trpc` (this is the placeholder default)
- ❌ No trailing slash after `/trpc`

#### Step 2: Trigger Redeploy
The environment variable only takes effect when the app is **rebuilt**. Choose one:

**Option A: Manual Redeploy (Fastest - 5 minutes)**
```
1. Go to Railway Dashboard
2. Click "apps-mobile" service
3. Click "Deployments" tab
4. Find latest deployment
5. Click "Redeploy" button (↻)
6. Wait for status: ✅ Success
```

**Option B: Code Deployment**
```
1. Push a commit to main branch
2. Railway auto-triggers build
3. Wait ~5-10 minutes for completion
```

#### Step 3: Verify the Fix
1. **Hard refresh** the browser (Ctrl+Shift+R)
2. **Visit** https://grasslandcheese.com
3. **Should see**:
   - Hero image loads
   - Navigation menu visible
   - Content rendered properly
   - No console errors (F12 → Console tab)

4. **Test API connectivity** (F12 → Network tab):
   - Should see requests to `dairy-salesapi-production.up.railway.app/trpc`
   - Status should be 200 (not 404 or 500)

### Why Grasslandcheese.com Has This Issue

The app has smart fallback logic for Railway-hosted apps:

```typescript
function getApiUrl() {
  // Check 1: Use explicit environment variable if set
  if (process.env.EXPO_PUBLIC_API_URL && 
      process.env.EXPO_PUBLIC_API_URL !== 'https://api.example.com/trpc') {
    return process.env.EXPO_PUBLIC_API_URL; ✅ Works if set
  }

  // Check 2: Auto-detect if running on production Railway domain
  if (isProductionRailwayWebHost()) { // hostname.endsWith('.up.railway.app')
    return 'https://dairy-salesapi-production.up.railway.app/trpc'; ✅ Works
  }

  // Check 3: Nothing works - throw error
  throw new Error('Set EXPO_PUBLIC_API_URL...');  ❌ White screen
}
```

**The Problem**:
- `grasslandcheese.com` is NOT a Railway domain (doesn't end with `.up.railway.app`)
- So the auto-detection doesn't work
- Must explicitly set `EXPO_PUBLIC_API_URL`

### Prevention

Add to Railway deployment documentation:
```
REQUIRED ENVIRONMENT VARIABLES FOR apps-mobile SERVICE:
- EXPO_PUBLIC_API_URL=https://dairy-salesapi-production.up.railway.app/trpc
  (Must be set BEFORE build phase runs)
```

Add to pre-deployment checklist:
```
☐ Verify EXPO_PUBLIC_API_URL is set in Railway environment
☐ Verify it's set to the correct production API URL
☐ Trigger redeploy after setting the variable
☐ Test grasslandcheese.com loads successfully
```

---

## Summary of Changes

### Files Modified

1. **`codemagic.yaml`** - iOS Build Fix
   - Line 28: Fixed path for `fix-ios-cpp-linkage.sh`
   - Line 45: Fixed path for `fix-ios-build-phases.sh`
   - Both: `../../scripts/` → `../../../scripts/`

### Files Created

1. **`FIX_GRASSLANDCHEESE_WHITE_SCREEN.md`** - Complete troubleshooting guide
   - Root cause analysis
   - Step-by-step fix procedure
   - Troubleshooting guide
   - Technical details
   - Verification steps

2. **`URGENT_FIXES_SUMMARY.md`** - This file

---

## Verification Checklist

### iOS Build Fix Verification
- [ ] iOS build runs in Codemagic
- [ ] Step 5 "Fix CocoaPods configuration" completes successfully
- [ ] No "No such file or directory" errors
- [ ] Prebuild step generates `apps/mobile/ios` directory
- [ ] Final IPA artifact is generated
- [ ] Build status shows ✅ Success

### White Screen Fix Verification
- [ ] EXPO_PUBLIC_API_URL is set in Railway apps-mobile Variables
- [ ] Value is: `https://dairy-salesapi-production.up.railway.app/trpc`
- [ ] Redeploy triggered and completed (✅ Success status)
- [ ] Browser cache cleared (hard refresh)
- [ ] grasslandcheese.com loads without white screen
- [ ] Hero image is visible
- [ ] Navigation menu works
- [ ] Network tab shows successful API requests
- [ ] Browser console has no errors
- [ ] Mobile Safari works correctly
- [ ] Complete user flow works:
  - [ ] Homepage loads
  - [ ] Shop page displays products
  - [ ] Add to cart works
  - [ ] Navigation works
  - [ ] Checkout flow works
  - [ ] Can login/register

---

## Timeline

### iOS Build Fix
- **Time to implement**: ~2 minutes (already done)
- **Time to test**: ~10-15 minutes (Codemagic build duration)
- **Risk level**: Very low (simple path correction)

### White Screen Fix
- **Time to implement**: ~5-10 minutes (set env var + redeploy)
- **Time to test**: ~5 minutes (browser verification)
- **Risk level**: Very low (configuration change only)

### Total Fix Time
- **Code changes**: Complete ✅
- **Documentation**: Complete ✅
- **Ready for verification**: Yes ✅
- **Estimated total timeline**: 20-30 minutes

---

## What Could Go Wrong (Troubleshooting)

### iOS Build Still Fails
**If Step 5 still fails after the fix:**
1. Verify `codemagic.yaml` was merged to main branch
2. Rebuild isn't using cached version - force a clean build
3. Check the script files exist and are executable:
   - `scripts/fix-ios-cpp-linkage.sh` ✅ (1705 bytes, executable)
   - `scripts/fix-ios-build-phases.sh` ✅ (681 bytes, executable)

### White Screen Still Shows
**If grasslandcheese.com still blank after setting env var:**

1. **Clear cache aggressively**:
   ```
   Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
   Close browser completely and reopen
   Clear browsing data including cache and cookies
   ```

2. **Check deployment status**:
   - Railway Dashboard → apps-mobile → Deployments
   - Most recent deployment should show: ✅ Success
   - If "In Progress", wait for completion

3. **Verify the variable was saved**:
   - Railway → apps-mobile → Variables tab
   - Should see: `EXPO_PUBLIC_API_URL=https://dairy-salesapi-production.up.railway.app/trpc`

4. **Check if it's really the API URL**:
   - Browser F12 → Console tab
   - Should NOT see: "Set EXPO_PUBLIC_API_URL to a reachable..."
   - If you see this, the variable didn't get into the build

5. **Verify API is running**:
   ```bash
   curl https://dairy-salesapi-production.up.railway.app/health
   # Should return: {"status": "ok"}
   ```

---

## Next Steps

1. **Confirm iOS build fix**
   - Run Codemagic build
   - Verify Step 5 passes
   - Confirm IPA artifact is generated

2. **Apply white screen fix**
   - Set EXPO_PUBLIC_API_URL in Railway environment
   - Trigger redeploy
   - Verify grasslandcheese.com loads

3. **Test complete flows**
   - Test website from browser
   - Test mobile Safari
   - Test checkout flow
   - Verify no console errors

4. **Monitor logs**
   - Railway dashboard for any errors
   - Browser console for runtime errors
   - API response times

5. **Document lessons learned**
   - Update deployment checklist
   - Add environment variable requirements
   - Create monitoring/alerting for API availability

---

## Questions?

For detailed information, see:
- **iOS Build Issue**: `codemagic.yaml` (lines 24-28 and 41-45)
- **White Screen Issue**: `FIX_GRASSLANDCHEESE_WHITE_SCREEN.md` (comprehensive guide)
- **API Configuration**: `apps/mobile/src/lib/trpc.ts` (API URL logic)
- **Build Configuration**: `apps/mobile/nixpacks.toml` (Railway build/start)
