/**
 * Crisp Chat Integration
 * 
 * This module initializes Crisp live chat widget on web platform.
 * Crisp website ID should be set in the EXPO_PUBLIC_CRISP_WEBSITE_ID environment variable.
 * 
 * Account created under: info@grasslandcheese.com
 * https://crisp.chat
 */

export function initializeCrispChat(websiteId: string) {
  // Only inject on web platform
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Check if Crisp is already loaded
  if (window.$crisp) {
    return;
  }

  // Initialize Crisp
  window.$crisp = [];
  window.CRISP_WEBSITE_ID = websiteId;

  // Create and inject Crisp script
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = 'https://client.crisp.chat/l.js';

  // Add CSS to prevent chat widget from covering cart/checkout buttons on mobile
  const style = document.createElement('style');
  style.textContent = `
    /* Crisp chat widget positioning adjustments for mobile */
    @media (max-width: 768px) {
      /* Ensure chat button doesn't cover bottom elements */
      .crisp-client {
        z-index: 999;
      }
      
      /* Adjust chat widget margins on small screens */
      .crisp-client iframe {
        margin-bottom: 0;
      }
    }
    
    /* General Crisp styling */
    .crisp-client {
      z-index: 9999 !important;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(script);

  console.log('[Crisp Chat] Initialized with Website ID:', websiteId);
}

// Declare Crisp global types
declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}
