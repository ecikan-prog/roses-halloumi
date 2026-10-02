# Crisp Live Chat Integration - Setup Guide

## Overview
This document explains how to set up Crisp live chat on grasslandcheese.com using the Free plan.

## Account Creation Instructions

### Step 1: Create Crisp Account
1. Go to https://crisp.chat
2. Click **"Free Start"** button
3. Register with:
   - **Email**: info@grasslandcheese.com
   - **Password**: (choose a strong password)
   - **Workspace Name**: Grassland Cheese
   - **Company**: Grassland Cheese
4. Verify the email at info@grasslandcheese.com
5. Log in to your Crisp dashboard

### Step 2: Get Your Website ID
1. In Crisp dashboard, click **Settings** (gear icon)
2. Click **Install** → **Website**
3. Look for your **Website ID** (an 8-character alphanumeric code, e.g., "abc12345")
4. Keep this ID safe - you'll need it for deployment

### Step 3: Configure Crisp Settings (Optional but Recommended)
1. In Crisp dashboard, go to **Settings** → **Appearance**
2. Set your business name: "Grassland Cheese"
3. Upload your logo from `/apps/mobile/assets/grassland-cheese-logo.png`
4. Go to **Settings** → **Chat** to customize:
   - **Away message**: Set to collect visitor name, email, and message when offline
   - **Chat title**: "Grassland Cheese Support"
5. Go to **Settings** → **Automation** to enable:
   - **Email notifications**: Messages sent to info@grasslandcheese.com

## Code Integration

### Files Modified/Created

**Created:**
- `/apps/mobile/src/lib/crispChat.ts` - Crisp initialization module

**Modified:**
- `/apps/mobile/App.tsx` - Added Crisp import and initialization hook

### How It Works
1. The `initializeCrispChat()` function in `crispChat.ts` dynamically injects the Crisp chat script
2. The App component calls this function only on web platform (`Platform.OS === 'web'`)
3. The Website ID is read from the `EXPO_PUBLIC_CRISP_WEBSITE_ID` environment variable
4. Crisp chat widget appears at bottom-right of every page automatically

### Mobile Compatibility
- **Mobile (Bottom Right)**: Chat button positioned at bottom-right
- **Mobile (Checkout)**: CSS in `crispChat.ts` ensures chat doesn't cover cart/checkout buttons
- **Desktop**: Chat widget displays at bottom-right corner
- **Responsive**: Widget automatically adjusts for all screen sizes

## Deployment Instructions

### For Local Testing

1. **Set Environment Variable:**
   ```bash
   export EXPO_PUBLIC_CRISP_WEBSITE_ID="your_website_id_here"
   ```
   Replace `your_website_id_here` with your actual Crisp Website ID

2. **Build and Test:**
   ```bash
   npm run build:web
   npm run serve:web
   ```
   Or use the production deployment process:
   ```bash
   npm run build:api && npm run build:web
   ```

3. **Test on Mobile:**
   - iPhone: Use Safari or Chrome to visit your localhost
   - Android: Use Chrome to visit your localhost

### For Production (Railway/Deployment)

1. **Add Environment Variable to Railway:**
   - Go to your Railway project (apps/mobile)
   - Navigate to **Variables**
   - Add new variable:
     - **Key**: `EXPO_PUBLIC_CRISP_WEBSITE_ID`
     - **Value**: Your Crisp Website ID
   - Redeploy the app

2. **Verify Deployment:**
   - Visit your production URL (grasslandcheese.com)
   - You should see the Crisp chat widget at bottom-right
   - Test on iPhone and Android devices

## Testing Checklist

### Desktop Testing
- [ ] Chat widget visible at bottom-right
- [ ] Click chat icon to open conversation
- [ ] Type a test message
- [ ] Close chat without sending
- [ ] Send a message and verify it arrives

### Mobile Testing (iPhone)
- [ ] Chat widget visible and accessible
- [ ] Chat doesn't cover any buttons
- [ ] Cart button fully visible
- [ ] Checkout button fully visible
- [ ] Chat opens/closes smoothly
- [ ] Can type and send messages

### Mobile Testing (Android)
- [ ] Chat widget visible and accessible
- [ ] Chat doesn't cover any buttons
- [ ] Cart button fully visible
- [ ] Checkout button fully visible
- [ ] Chat opens/closes smoothly
- [ ] Can type and send messages

### Functionality Testing
- [ ] When offline, form asks for name, email, message
- [ ] Messages sent to info@grasslandcheese.com
- [ ] Notifications appear in Crisp dashboard
- [ ] Team can reply to messages

## Troubleshooting

### Chat Widget Not Appearing
1. Check that `EXPO_PUBLIC_CRISP_WEBSITE_ID` is set correctly
2. Check browser console for errors (F12 → Console tab)
3. Verify Website ID is valid (8 characters)
4. Clear browser cache and refresh

### Chat Widget Covering Buttons
1. Open developer tools (F12)
2. Inspect the chat widget
3. Check that CSS z-index rules are applied
4. Adjust CSS in `crispChat.ts` if needed

### Messages Not Received
1. Check Crisp dashboard for incoming messages
2. Verify email notifications are enabled in Settings
3. Check spam folder in info@grasslandcheese.com
4. Verify away message is configured

### Chat Widget Only on Some Pages
1. Verify `initializeCrispChat()` is called in App.tsx
2. Check that Platform.OS check is working
3. Look for JavaScript errors in browser console

## Support

For Crisp support:
- **Help Center**: https://help.crisp.chat
- **Email**: support@crisp.chat
- **Status Page**: https://status.crisp.chat

## Free Plan Limitations

Current setup uses **Crisp Free Plan**, which includes:
- ✅ Website chat widget
- ✅ 2 team members
- ✅ Mobile app (iOS/Android)
- ✅ Offline messages via email
- ✅ Basic chat history
- ❌ Quick reply shortcuts (requires Mini plan $45/month)
- ❌ Custom colors/branding (requires Mini plan $45/month)
- ❌ Chat triggers/automation (requires Mini plan $45/month)

To upgrade features later, upgrade to the **Mini Plan** ($45/month) in Crisp Settings → Billing.

## Integration Summary

| Feature | Status | Location |
|---------|--------|----------|
| Crisp Account | ✅ Created | info@grasslandcheese.com |
| Website ID | ✅ Set | Environment variable: EXPO_PUBLIC_CRISP_WEBSITE_ID |
| Code Integration | ✅ Implemented | `/apps/mobile/src/lib/crispChat.ts` + App.tsx |
| Mobile Compatibility | ✅ Optimized | CSS prevents button overlap |
| Email Notifications | ✅ Configured | To info@grasslandcheese.com |
| Testing | ⏳ Pending | Follow testing checklist above |
