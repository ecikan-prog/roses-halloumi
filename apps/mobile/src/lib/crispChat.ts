/**
 * Tawk.to Live Chat Integration
 * 
 * This module initializes Tawk.to live chat widget on web platform.
 * Tawk.to property ID should be set in the EXPO_PUBLIC_TAWK_TO_PROPERTY_ID environment variable.
 * Tawk.to widget ID should be set in the EXPO_PUBLIC_TAWK_TO_WIDGET_ID environment variable (defaults to 'default' if unset).
 * 
 * Account created under: info@grasslandcheese.com
 * https://tawk.to
 */

export function initializeTawkToChat(propertyId: string, widgetId: string = 'default') {
  // Only inject on web platform
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Check if Tawk.to is already loaded
  if (window.Tawk_API) {
    return;
  }

  // Initialize Tawk.to global variables
  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();

  // Create and inject Tawk.to script
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
  script.charset = 'UTF-8';
  script.setAttribute('crossorigin', '');

  // Add CSS to prevent chat widget from covering cart/checkout buttons on mobile
  const style = document.createElement('style');
  style.textContent = `
    /* Tawk.to chat widget positioning adjustments for mobile */
    @media (max-width: 768px) {
      /* Ensure chat button doesn't cover bottom elements */
      .tawk {
        z-index: 999;
      }
      
      /* Adjust chat widget margins on small screens */
      .tawk iframe {
        margin-bottom: 0;
      }
    }
    
    /* General Tawk.to styling */
    .tawk {
      z-index: 9999 !important;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(script);

  console.log('[Tawk.to Chat] Initialized with Property ID:', propertyId, 'Widget ID:', widgetId);
}

// Declare Tawk.to global types
declare global {
  interface Window {
    Tawk_API?: unknown;
    Tawk_LoadStart?: Date;
  }
}
