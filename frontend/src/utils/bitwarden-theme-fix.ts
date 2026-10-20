/**
 * @fileoverview Bitwarden Theme Fix Utility
 * @description Intercepts Bitwarden iframe creation to force dark theme
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

/**
 * @description Intercepts and modifies Bitwarden iframe URLs to use dark theme
 */
export function initBitwardenThemeFix(): void {
  // Only run in browser environment
  if (typeof window === 'undefined') return;

  // Observer to watch for Bitwarden iframe creation
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          
          // Check for Bitwarden iframe
          if (element.tagName === 'IFRAME' && element.id === 'bit-notification-bar-iframe') {
            const iframe = element as HTMLIFrameElement;
            
            // Set iframe styles to prevent white box
            iframe.style.setProperty('background', 'transparent', 'important');
            iframe.style.setProperty('color-scheme', 'dark', 'important');
            
            const currentSrc = iframe.src;
            
            // If it has colorScheme=normal, change it to dark
            if (currentSrc && currentSrc.includes('colorScheme=normal')) {
              const newSrc = currentSrc.replace('colorScheme=normal', 'colorScheme=dark');
              iframe.src = newSrc;
            } else if (currentSrc && !currentSrc.includes('colorScheme=')) {
              // If no colorScheme parameter, add dark theme
              const separator = currentSrc.includes('?') ? '&' : '?';
              iframe.src = currentSrc + separator + 'colorScheme=dark';
            }
          }
          
          // Also check child elements
          const bitwardenIframes = element.querySelectorAll('iframe[id*="bit-notification"]');
          bitwardenIframes.forEach((iframe) => {
            const iframeElement = iframe as HTMLIFrameElement;
            
            // Set iframe styles to prevent white box
            iframeElement.style.setProperty('background', 'transparent', 'important');
            iframeElement.style.setProperty('color-scheme', 'dark', 'important');
            
            const currentSrc = iframeElement.src;
            
            if (currentSrc && currentSrc.includes('colorScheme=normal')) {
              const newSrc = currentSrc.replace('colorScheme=normal', 'colorScheme=dark');
              iframeElement.src = newSrc;
            } else if (currentSrc && !currentSrc.includes('colorScheme=')) {
              // If no colorScheme parameter, add dark theme
              const separator = currentSrc.includes('?') ? '&' : '?';
              iframeElement.src = currentSrc + separator + 'colorScheme=dark';
            }
          });
        }
      });
    });
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also check existing iframes on page load
  const checkExistingIframes = () => {
    const existingIframes = document.querySelectorAll('iframe[id*="bit-notification"]');
    existingIframes.forEach((iframe) => {
      const iframeElement = iframe as HTMLIFrameElement;
      
      // Set iframe styles to prevent white box
      iframeElement.style.setProperty('background', 'transparent', 'important');
      iframeElement.style.setProperty('color-scheme', 'dark', 'important');
      
      const currentSrc = iframeElement.src;
      
      if (currentSrc && currentSrc.includes('colorScheme=normal')) {
        const newSrc = currentSrc.replace('colorScheme=normal', 'colorScheme=dark');
        iframeElement.src = newSrc;
      } else if (currentSrc && !currentSrc.includes('colorScheme=')) {
        // If no colorScheme parameter, add dark theme
        const separator = currentSrc.includes('?') ? '&' : '?';
        iframeElement.src = currentSrc + separator + 'colorScheme=dark';
      }
    });
  };

  // Check immediately and after a short delay
  checkExistingIframes();
  setTimeout(checkExistingIframes, 1000);
  
}

/**
 * @description Set up meta tag to signal dark theme preference to extensions
 */
export function setBitwardenThemePreference(): void {
  if (typeof window === 'undefined') return;

  // Add meta tag to signal dark theme preference
  let metaTag = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement;
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.name = 'color-scheme';
    document.head.appendChild(metaTag);
  }
  metaTag.content = 'dark light';

  // Also set it on html element
  document.documentElement.style.setProperty('color-scheme', 'dark light');
  
}