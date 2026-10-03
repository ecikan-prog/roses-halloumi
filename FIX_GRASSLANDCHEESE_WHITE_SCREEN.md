# Fix: grasslandcheese.com White Screen Production Issue

## Problem Summary

The grasslandcheese.com website is displaying a completely blank white page instead of loading the content.

## Root Cause

**The `EXPO_PUBLIC_API_URL` environment variable is missing or incorrectly set in the Railway production deployment for the apps/mobile service.**

### Why This Causes a White Screen

1. **Build-Time Baking**: Expo public environment variables (prefixed with `EXPO_PUBLIC_`) are embedded into the compiled JavaScript bundle at **build time**, not runtime.

2. **App Initialization Error**: When `EXPO_PUBLIC_API_URL` is missing or set to an invalid value, the `trpc.ts` initialization throws an error:
   ```
   Error: Set EXPO_PUBLIC_API_URL to a reachable /trpc endpoint before starting the Expo app.
   ```

3. **React Crash**: This error prevents React from rendering anything, resulting in a blank white screen.

4. **Silent Failure**: The error doesn't appear as an alert or error message - it only shows in the browser's developer console.

### How It Works

In `apps/mobile/src/lib/trpc.ts`, the API URL is determined at app startup:

```typescript
function getApiUrl() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (apiUrl && apiUrl !== 'https://api.example.com/trpc') {
    return apiUrl;  // ✅ Use the configured API URL
  }

  if (Platform.OS === 'web' && !isLocalWebHost() && isProductionRailwayWebHost()) {
    return WEB_PRODUCTION_API_URL;  // ✅ Auto-detect for Railway production domain
  }

  throw new Error('Set EXPO_PUBLIC_API_URL to a reachable /trpc endpoint...');  // ❌ White screen
}
```

**Conditions for the error:**
- `EXPO_PUBLIC_API_URL` is not set OR
- `EXPO_PUBLIC_API_URL` is set to the placeholder `https://api.example.com/trpc` OR
- The app is running on a custom domain (grasslandcheese.com) instead of a Railway production domain

## Solution

### Step 1: Verify the Current Configuration

Check what's currently set in Railway for the apps/mobile service:

1. Go to [Railway Dashboard](https://railway.app)
2. Select your project
3. Click on the **apps-mobile** service (or similar name for the web deployment)
4. Click the **Variables** tab
5. Check if `EXPO_PUBLIC_API_URL` exists
6. If it exists, note its current value

### Step 2: Set the Correct Environment Variable

In Railway Variables for the **apps-mobile** service, set:

```
EXPO_PUBLIC_API_URL=https://dairy-salesapi-production.up.railway.app/trpc
```

**Important notes:**
- The value must be exactly: `https://dairy-salesapi-production.up.railway.app/trpc`
- It must include the `/trpc` suffix
- Do NOT include a trailing slash after `/trpc`
- This is the public API URL, not localhost

### Step 3: Trigger a Redeploy

The environment variable takes effect when the app is **rebuilt and redeployed**. Choose one option:

**Option A: Manual Redeploy (Fastest)**
1. In Railway Dashboard, click the **apps-mobile** service
2. Click the **Deployments** tab
3. Find the most recent deployment
4. Click the **Redeploy** button (↻ icon)
5. Wait for the deployment to complete (status shows ✅ Success)

**Option B: Code Deployment**
1. Push a commit to the main branch (or trigger a deploy)
2. Railway will automatically rebuild and redeploy the service
3. Wait for deployment to complete

### Step 4: Verify the Fix

1. **Wait for Deployment**: Monitor the Railway deployments tab until the service shows "Deployed"
2. **Clear Browser Cache**: Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)
3. **Test the Website**: Visit https://grasslandcheese.com and verify it loads
4. **Check Browser Console**: Open browser dev tools (F12) → Console tab and verify no errors
5. **Test Full Flow**: Test the complete user flow:
   - Homepage loads with hero image
   - Shop page shows products
   - Add product to cart
   - Try to login (or register as new customer)
   - Test checkout flow

### Step 5: Verify API Connectivity

Once the page loads, verify the API is working:

1. Open browser dev tools (F12)
2. Go to **Network** tab
3. Reload the page
4. Look for requests to `https://dairy-salesapi-production.up.railway.app/trpc`
5. Verify requests are returning 200 status (not 404 or 500)

## Troubleshooting

### Problem: Still showing white screen after redeploy

**Possible causes:**

1. **Browser Cache**: Hard refresh or clear cache
   ```bash
   # Chrome/Edge: Ctrl+Shift+R
   # Firefox: Ctrl+Shift+R
   # Safari: Cmd+Shift+R
   ```

2. **Deployment Not Complete**: Check Railway dashboard → apps-mobile → Deployments
   - Status should show ✅ Success
   - Rebuild and deploy should be complete
   - If still running, wait a few more minutes

3. **Wrong Environment Variable Value**: Verify in Railway Variables tab that `EXPO_PUBLIC_API_URL` is set to **exactly**:
   ```
   https://dairy-salesapi-production.up.railway.app/trpc
   ```
   - Not `https://api.example.com/trpc` (placeholder)
   - Not missing `/trpc` suffix
   - Not with trailing slash

4. **API Service Down**: Verify the API service is running
   ```bash
   # Test in terminal:
   curl https://dairy-salesapi-production.up.railway.app/health
   ```
   - Should return `{"status": "ok"}`

### Problem: API shows 404 or connection refused

This means the API endpoint has changed or the Railway API service is not running.

**Fix:**
1. Verify the production API service is running in Railway
2. Get the correct API URL from Railway dashboard:
   - Click **apps-api** service
   - Look for the **Public URL** or domain
3. Update `EXPO_PUBLIC_API_URL` with the correct URL

### Problem: No network requests to API in dev tools

If you see the page loading but NO requests to the API:

1. The app may still be throwing an error early
2. Check browser console for JavaScript errors
3. Verify `EXPO_PUBLIC_API_URL` is available at build time (not just runtime)

**Solution:**
- Ensure `EXPO_PUBLIC_API_URL` is set BEFORE the build step
- Trigger a fresh rebuild via Railway

## Technical Details

### Environment Variable Timeline

When you set `EXPO_PUBLIC_API_URL=https://dairy-salesapi-production.up.railway.app/trpc`:

1. **Build Phase** (Railway nixpacks):
   - Runs: `npm run build:mobile:web`
   - Which runs: `expo export --platform web --output-dir dist`
   - Expo reads `EXPO_PUBLIC_API_URL` and bakes it into the JavaScript bundle
   - Result: Built web assets in `dist/` directory with API URL hardcoded

2. **Start Phase** (Railway container):
   - Runs: `npm run start:mobile:web`
   - Which runs: `node ./serve-web.mjs`
   - Serves the pre-built static files from `dist/`
   - No environment variables needed at runtime (they're already in the bundle)

3. **Browser Loads**:
   - Browser downloads `dist/index.html` and JavaScript bundles
   - App initializes with the hardcoded API URL
   - Makes requests to the API

### Why Custom Domains Need the Variable

The app has special logic for Railway production domains:

```typescript
function isProductionRailwayWebHost() {
  const { hostname } = window.location;
  return hostname.endsWith('.up.railway.app') && hostname.includes('production');
}

// If running on production Railway domain, auto-use WEB_PRODUCTION_API_URL
if (Platform.OS === 'web' && isProductionRailwayWebHost()) {
  return WEB_PRODUCTION_API_URL;  // https://dairy-salesapi-production.up.railway.app/trpc
}
```

But `grasslandcheese.com` is NOT a Railway domain, so the auto-detection fails. This is why you must explicitly set `EXPO_PUBLIC_API_URL`.

## Files Involved

- **Configuration**: Railway Environment Variables for apps-mobile service
- **Build Script**: `apps/mobile/nixpacks.toml` (defines build/start process)
- **App Code**: `apps/mobile/src/lib/trpc.ts` (API URL initialization)
- **Serve Script**: `apps/mobile/serve-web.mjs` (serves the built static files)

## Prevention

To prevent this issue in the future:

1. **Document Required Variables**: Add to Railway service documentation
   ```
   REQUIRED for production web deployment:
   - EXPO_PUBLIC_API_URL=https://dairy-salesapi-production.up.railway.app/trpc
   ```

2. **Add Health Check**: Monitor the API endpoint
   ```bash
   curl https://grasslandcheese.com/  # Should load
   curl https://dairy-salesapi-production.up.railway.app/health  # Should return {"status": "ok"}
   ```

3. **Update Deployment Guide**: Add section to deployment documentation

## References

- Expo Public Environment Variables: https://docs.expo.dev/build-reference/variables/
- Railway Environment Variables: https://docs.railway.app/reference/variables
- This App's API Configuration: `apps/mobile/src/lib/trpc.ts`
- Build Configuration: `apps/mobile/nixpacks.toml`
