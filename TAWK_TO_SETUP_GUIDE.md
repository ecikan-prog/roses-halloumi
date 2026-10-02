# Tawk.to Live Chat Integration - Setup Guide

## Overview
This document explains how to set up Tawk.to live chat on grasslandcheese.com using the Free plan with full customization.

## Account Creation Instructions

### Step 1: Create Tawk.to Account
1. Go to https://tawk.to
2. Click **"Start Free"** button
3. Register with:
   - **Email**: info@grasslandcheese.com
   - **Password**: (choose a strong password)
   - **Name**: Teyfik Ayyıldız
   - **Company**: Grassland Cheese
4. Verify the email at info@grasslandcheese.com
5. Log in to your Tawk.to dashboard

### Step 2: Get Your Property ID
1. In Tawk.to dashboard, you'll see your Property ID automatically displayed
   - Format: "PropertyID/1" (e.g., "abc123def456/1")
   - It's visible on the dashboard and in Settings → Install Code
2. Copy this Property ID
3. Keep it safe - you'll need it for deployment

### Step 3: Configure Tawk.to Settings (FREE Features!)
These features are included on the Free plan:

**1. Customize Chat Appearance:**
   - Go to **Admin** → **Appearance**
   - Upload your logo from `/apps/mobile/assets/grassland-cheese-logo.png`
   - Set chat color to Grassland green: `#1f5a3a`
   - Set chat position: Bottom Right
   - Customize chat widget name: "Grassland Cheese Support"

**2. Set Up Quick Reply Buttons (FREE!):**
   - Go to **Admin** → **Canned Responses**
   - Add these quick reply messages:
     - "Hello!"
     - "Could you help me, please?"
     - "I'd like to order halloumi"
     - "I'm interested in wholesale"

**3. Set Up Chat Greeting (FREE!):**
   - Go to **Admin** → **Appearance** → **Greeting Message**
   - Set greeting: "Kia ora! How can we help you today?"
   - Enable for online/offline

**4. Configure Offline Messages (FREE!):**
   - Go to **Admin** → **Offline**
   - Enable: "Pre-chat form"
   - Collect: Name, Email, Message
   - Message: "We're currently offline. Please leave your message below and we'll get back to you soon!"

**5. Set Up Email Notifications (FREE!):**
   - Go to **Admin** → **Email Notifications**
   - Add email: info@grasslandcheese.com
   - Enable all notification options
   - Messages will be sent to both the app and email

**6. Set Up Mobile App Access (FREE!):**
   - Download Tawk.to app on iOS/Android
   - Log in with info@grasslandcheese.com
   - You'll receive push notifications for new messages

## Code Integration

### Files Modified/Created

**Modified:**
- `/apps/mobile/src/lib/crispChat.ts` - Now contains Tawk.to initialization (renamed in future but keeping name for compatibility)
- `/apps/mobile/App.tsx` - Uses Tawk.to instead of Crisp

### How It Works
1. The `initializeTawkToChat()` function in `crispChat.ts` dynamically injects the Tawk.to chat script
2. The App component calls this function only on web platform (`Platform.OS === 'web'`)
3. The Property ID is read from the `EXPO_PUBLIC_TAWK_TO_PROPERTY_ID` environment variable
4. Tawk.to chat widget appears at bottom-right of every page automatically

### Mobile Compatibility
- **Mobile (Bottom Right)**: Chat button positioned at bottom-right
- **Mobile (Checkout)**: CSS in `crispChat.ts` ensures chat doesn't cover cart/checkout buttons
- **Desktop**: Chat widget displays at bottom-right corner
- **Responsive**: Widget automatically adjusts for all screen sizes

## Deployment Instructions

### For Local Testing

1. **Set Environment Variable:**
   ```bash
   export EXPO_PUBLIC_TAWK_TO_PROPERTY_ID="your_property_id_here"
   ```
   Replace `your_property_id_here` with your Property ID from Tawk.to dashboard
   (e.g., "abc123def456")

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
     - **Key**: `EXPO_PUBLIC_TAWK_TO_PROPERTY_ID`
     - **Value**: Your Property ID (just the ID part, e.g., "abc123def456")
   - Redeploy the app

2. **Verify Deployment:**
   - Visit your production URL (grasslandcheese.com)
   - You should see the Tawk.to chat widget at bottom-right
   - Test on iPhone and Android devices

## Testing Checklist

### Desktop Testing
- [ ] Chat widget visible at bottom-right
- [ ] Click chat icon to open conversation
- [ ] Type a test message
- [ ] Close chat without sending
- [ ] Send a message and verify it arrives
- [ ] Verify Grassland green branding is applied
- [ ] Verify logo is displayed

### Mobile Testing (iPhone)
- [ ] Chat widget visible and accessible
- [ ] Chat doesn't cover any buttons
- [ ] Cart button fully visible
- [ ] Checkout button fully visible
- [ ] Chat opens/closes smoothly
- [ ] Can type and send messages
- [ ] Quick reply buttons work

### Mobile Testing (Android)
- [ ] Chat widget visible and accessible
- [ ] Chat doesn't cover any buttons
- [ ] Cart button fully visible
- [ ] Checkout button fully visible
- [ ] Chat opens/closes smoothly
- [ ] Can type and send messages
- [ ] Quick reply buttons work

### Functionality Testing
- [ ] When offline, form asks for name, email, message
- [ ] Messages sent to info@grasslandcheese.com
- [ ] Notifications appear in Tawk.to dashboard AND email
- [ ] Notifications arrive on mobile app
- [ ] Team can reply to messages
- [ ] Quick reply buttons appear in chat
- [ ] Greeting message displays on chat open
- [ ] Chat uses Grassland green (#1f5a3a)
- [ ] Logo displays correctly

## Troubleshooting

### Chat Widget Not Appearing
1. Check that `EXPO_PUBLIC_TAWK_TO_PROPERTY_ID` is set correctly
2. Check browser console for errors (F12 → Console tab)
3. Verify Property ID format (should be like "abc123def456")
4. Clear browser cache and refresh
5. Verify script is being injected: Open Developer Tools and look for tawk.to script in Network tab

### Chat Widget Covering Buttons
1. Open developer tools (F12)
2. Inspect the chat widget
3. Check that CSS z-index rules are applied
4. Adjust CSS in `crispChat.ts` if needed

### Messages Not Received
1. Check Tawk.to dashboard for incoming messages
2. Verify email notifications are enabled in Settings
3. Check spam folder in info@grasslandcheese.com
4. Verify offline message form is configured

### Chat Widget Only on Some Pages
1. Verify `initializeTawkToChat()` is called in App.tsx
2. Check that Platform.OS check is working
3. Look for JavaScript errors in browser console

## Support

For Tawk.to support:
- **Help Center**: https://help.tawk.to
- **Documentation**: https://developer.tawk.to
- **Status Page**: https://status.tawk.to
- **Email**: support@tawk.to

## Free Plan Features

**Tawk.to's Free Plan includes everything:**
- ✅ Unlimited live chat agents
- ✅ Unlimited websites/properties
- ✅ Custom colors & branding (FREE!)
- ✅ Logo upload (FREE!)
- ✅ Quick reply buttons/Canned responses (FREE!)
- ✅ Chat triggers & automation (FREE!)
- ✅ Offline message collection (FREE!)
- ✅ Mobile app (iOS/Android) (FREE!)
- ✅ Email notifications (FREE!)
- ✅ Visitor monitoring
- ✅ Ticketing system
- ✅ Chat history & analytics
- ✅ 24/7 support
- ❌ "Powered by Tawk" branding removal (requires paid plan)

## Integration Summary

| Feature | Status | Location |
|---------|--------|----------|
| Tawk.to Account | ✅ To create | info@grasslandcheese.com |
| Property ID | ✅ Ready | Environment variable: EXPO_PUBLIC_TAWK_TO_PROPERTY_ID |
| Code Integration | ✅ Implemented | `/apps/mobile/src/lib/crispChat.ts` + App.tsx |
| Mobile Compatibility | ✅ Optimized | CSS prevents button overlap |
| Email Notifications | ✅ Configured | To info@grasslandcheese.com |
| Quick Replies | ✅ FREE! | Configure in Tawk.to Settings |
| Custom Colors | ✅ FREE! | Set to Grassland green (#1f5a3a) |
| Logo | ✅ FREE! | Upload in Tawk.to Settings |
| Chat Greeting | ✅ FREE! | "Kia ora! How can we help you today?" |
| Testing | ⏳ Pending | Follow testing checklist above |

## Next Steps

1. ✅ Create Tawk.to account at https://tawk.to with info@grasslandcheese.com
2. ✅ Get Property ID from Tawk.to dashboard
3. ✅ Configure chat appearance, colors, logo, greeting, quick replies
4. 📝 Provide Property ID to be configured
5. 🚀 Add EXPO_PUBLIC_TAWK_TO_PROPERTY_ID to Railway Variables
6. 📱 Redeploy and test on iPhone/Android
7. ✅ Live chat live!
