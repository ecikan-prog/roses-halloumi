# Grassland App Store Review Setup

## Demo Account for App Review

### Apple App Store Review Account
**Email:** `review@grasslandcheese.app` (create in production database before submission)
**Password:** [Generate a strong password and provide to App Review team]
**Contact:** [Your contact number]

### Google Play Review Account
**Email:** `review-android@grasslandcheese.app` (create in production database before submission)
**Password:** [Generate a strong password and provide to App Review team]
**Contact:** [Your contact number]

## Account Creation Instructions

1. **Create Demo Customer in Production Database:**
   ```sql
   INSERT INTO "Customer" (name, email, "passwordHash", contact, type, "accountSource", "createdAt")
   VALUES (
     'App Review',
     'review@grasslandcheese.app',
     '[BCRYPT_HASH_OF_PASSWORD]',
     '[PHONE_NUMBER]',
     'RETAIL',
     'SELF_REGISTERED',
     NOW()
   );
   ```
   - Use the bcrypt hash of your chosen password (use the same hashing as production auth)
   - Include valid contact details

2. **Pre-populate Test Order History (Optional):**
   - Create 2-3 sample orders in the demo customer's account using the admin panel
   - This demonstrates the order history feature without requiring real Stripe transactions

## Testing Checklist for Reviewers

### Core Functionality
- [ ] Sign up new customer account
- [ ] Log in with demo account
- [ ] Browse product catalog (Halloumi cheese)
- [ ] Add products to cart
- [ ] Complete checkout with test Stripe card (4242 4242 4242 4242)
- [ ] View order history
- [ ] Request password reset
- [ ] Delete account (self-service)

### Business Features
- [ ] View company information (About/Our Story)
- [ ] Browse recipes
- [ ] Contact support page
- [ ] Read privacy policy
- [ ] Read terms and conditions
- [ ] Apply for wholesale account
- [ ] View quality/compliance info

### Platform-Specific
**iOS:**
- [ ] All features work on iPad (supportsTablet: true)
- [ ] Portrait orientation enforced
- [ ] App icon displays correctly
- [ ] Splash screen displays correctly

**Android:**
- [ ] Adaptive icon displays correctly
- [ ] Runs on Android 11+ (minSdkVersion 26)
- [ ] Orientation portrait enforced

## Payment Configuration

### Test Credentials (Stripe)
- **Test Mode Enabled:** Yes
- **Test Card:** 4242 4242 4242 4242
- **Expiry:** Any future date
- **CVC:** Any 3 digits

### Payment Methods Supported
1. **PAY_NOW:** Immediate Stripe Checkout (for retail customers)
2. **PAY_30:** 30-day payment terms (for approved wholesale accounts)

**Note:** This is a **physical goods only** app (Halloumi cheese). No digital goods, subscriptions, or in-app purchases. All payments go through Stripe.

## App Store Submission Checklist

### App Information
- [x] Bundle ID: `com.grasslandcheese.app`
- [x] Version: 1.0.0
- [x] Build Number: 1 (iOS)
- [x] Version Code: 1 (Android)
- [x] Category: Shopping
- [x] Content rating: 4+ (G-rated, no mature content)

### Privacy & Compliance
- [x] Privacy Policy: In-app accessible (Account page → Privacy)
- [x] Terms & Conditions: In-app accessible (Account page → Terms)
- [x] Account Deletion: Self-service in Account settings (Danger zone section)
- [x] Data Privacy: Customer data soft-deleted, never permanently removed

### Permissions Requested

**iOS (Info.plist):**
- `NSLocalNetworkUsageDescription`: "This app does not require local network access." (Boilerplate for Expo)
- No camera, microphone, location, contacts, or photo library permissions needed

**Android (AndroidManifest.xml):**
- `android.permission.INTERNET`: For API communication
- `android.permission.READ_EXTERNAL_STORAGE`: For file access (Android 12 and below)
- `android.permission.WRITE_EXTERNAL_STORAGE`: For file access (Android 12 and below)
- `android.permission.SYSTEM_ALERT_WINDOW`: For native dialogs
- `android.permission.VIBRATE`: For haptic feedback (optional, used by Expo)

### No High-Risk Features
- ✅ No crypto/blockchain
- ✅ No loot boxes/gambling mechanics
- ✅ No kids targeting (4+ rating)
- ✅ No adult content
- ✅ No excessive ads
- ✅ No "call spoofing" or phone features
- ✅ No unauthorized account access
- ✅ All payments for physical goods only

## Deployment Details

### iOS Build
- **Xcode Project:** `Grassland.xcodeproj`
- **Workspace:** `Grassland.xcworkspace` (created by CocoaPods during build)
- **Scheme:** `Grassland`
- **Configuration:** Release
- **Signing:** Automatic (via Codemagic + App Store Connect signing)
- **Build System:** Xcode 26.4+

### Android Build
- **App Bundle:** Generated via `./gradlew bundleRelease`
- **Target API Level:** 34+
- **Min SDK Version:** 26 (Android 8.0)
- **Signing:** Play Console key store (configured in Codemagic)
- **Build System:** Gradle 8+

## Backend API

- **Production API:** https://dairy-salesapi-production.up.railway.app
- **Environment Variable:** `EXPO_PUBLIC_API_URL`
- **Protocol:** TRPC over HTTPS
- **Authentication:** ****** (JWT) in Authorization header
- **Fallback:** Web builds on production Railway domain auto-detect production API

## Post-Submission

### After Approval:
1. Monitor crash reports in App Store Connect / Google Play Console
2. Create public release notes documenting initial features
3. Set up App Review contact email for future submissions
4. Enable App Store/Play Console notifications

### Update Process:
1. Update version in `app.json` and `android/app/build.gradle`
2. Increment `buildNumber` (iOS) and `versionCode` (Android)
3. Create new Codemagic build
4. Submit new build to App Store Connect / Google Play Console

## Troubleshooting for Reviewers

**If app won't sign in:**
- Use demo account email: `review@grasslandcheese.app`
- Ensure password is correct
- Check network connectivity (requires HTTPS to production API)

**If Stripe checkout fails:**
- Use test card: 4242 4242 4242 4242
- Use any future expiry date and 3-digit CVC
- Ensure "PAY_NOW" payment term is selected

**If app crashes:**
- Force quit and restart
- Check device has sufficient storage (iOS: 200MB+, Android: 150MB+)
- Minimum iOS 12.0, minimum Android 8.0 required

---

**Last Updated:** 2026-10-02
**Prepared by:** Copilot
**Contact:** [Your team contact]
