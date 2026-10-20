/**
 * @fileoverview Favicon Manager Component
 * @description Dynamically updates favicon based on theme (light/dark)
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { useTheme } from '@/contexts';

/**
 * @description FaviconManager component that updates favicon based on theme
 * @returns null (this component doesn't render anything)
 */
export const FaviconManager: React.FC = () => {
  const { isDarkMode } = useTheme();

  /**
   * @description Update favicon based on current theme (inverted for better contrast)
   */
  useEffect(() => {
    const updateFavicon = () => {
      const faviconPath = isDarkMode ? '/favicon_light.ico' : '/favicon_dark.ico';
      
      // Find existing favicon link elements
      const existingFavicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      const existingFavicon32 = document.querySelector('link[rel="icon"][sizes="32x32"]') as HTMLLinkElement;
      const existingFavicon16 = document.querySelector('link[rel="icon"][sizes="16x16"]') as HTMLLinkElement;
      const existingAppleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      
      // Update or create main favicon
      if (existingFavicon) {
        existingFavicon.href = faviconPath;
      } else {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = faviconPath;
        document.head.appendChild(link);
      }
      
      // Update or create 32x32 favicon
      if (existingFavicon32) {
        existingFavicon32.href = faviconPath;
      } else {
        const link32 = document.createElement('link');
        link32.rel = 'icon';
        link32.type = 'image/png';
        link32.sizes = '32x32';
        link32.href = faviconPath;
        document.head.appendChild(link32);
      }
      
      // Update or create 16x16 favicon
      if (existingFavicon16) {
        existingFavicon16.href = faviconPath;
      } else {
        const link16 = document.createElement('link');
        link16.rel = 'icon';
        link16.type = 'image/png';
        link16.sizes = '16x16';
        link16.href = faviconPath;
        document.head.appendChild(link16);
      }
      
      // Update or create apple touch icon
      if (existingAppleTouchIcon) {
        existingAppleTouchIcon.href = faviconPath;
      } else {
        const appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        appleLink.sizes = '180x180';
        appleLink.href = faviconPath;
        document.head.appendChild(appleLink);
      }
    };

    updateFavicon();
  }, [isDarkMode]);

  return null;
};
