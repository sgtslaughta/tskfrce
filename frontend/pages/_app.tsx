/**
 * @fileoverview Next.js App component
 * @description Main application wrapper with Mantine and context providers
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React from 'react';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import '../src/styles/mantine-fixes.css';

// Suppress WebSocket connection errors in console since HTTP notifications work as fallback
if (typeof window !== 'undefined') {
  // Override console.error to suppress WebSocket connection errors
  const originalError = console.error;
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    // Suppress WebSocket connection errors
    if (message.includes("can't establish a connection to the server at ws://") ||
        message.includes("The connection to ws://") ||
        message.includes("was interrupted while the page was loading") ||
        message.includes("Firefox can't establish a connection")) {
      return; // Don't log these errors
    }
    originalError.apply(console, args);
  };

  // Also override console.warn in case some errors are logged as warnings
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    // Suppress WebSocket connection warnings
    if (message.includes("can't establish a connection to the server at ws://") ||
        message.includes("The connection to ws://") ||
        message.includes("was interrupted while the page was loading") ||
        message.includes("Firefox can't establish a connection")) {
      return; // Don't log these warnings
    }
    originalWarn.apply(console, args);
  };

  // Add global error event listener to catch WebSocket errors
  window.addEventListener('error', (event) => {
    const message = event.message || '';
    if (message.includes("can't establish a connection to the server at ws://") ||
        message.includes("The connection to ws://") ||
        message.includes("was interrupted while the page was loading") ||
        message.includes("Firefox can't establish a connection")) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });

  // Add unhandled rejection listener for WebSocket promises
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.toString() || '';
    if (message.includes("can't establish a connection to the server at ws://") ||
        message.includes("The connection to ws://") ||
        message.includes("was interrupted while the page was loading") ||
        message.includes("Firefox can't establish a connection")) {
      event.preventDefault();
      return false;
    }
  });
}

import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { mantineTheme } from '../src/lib/mantine-theme';
import { UnifiedAuthProvider } from '../src/contexts/UnifiedAuthContext'
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext'
import { NotificationProvider } from '../src/contexts/NotificationContext'
import { initBitwardenThemeFix, setBitwardenThemePreference } from '../src/utils/bitwarden-theme-fix'
import { FaviconManager } from '../src/components/ui/FaviconManager'
// Suppress HMR ISR manifest warnings in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = function(...args) {
    const message = args.join(' ');
    
    // Filter out ISR manifest warnings
    if (message.includes('Invalid message: {"action":"isrManifest"')) {
      return;
    }
    
    // Filter out handleStaticIndicator warnings
    if (message.includes('handleStaticIndicator')) {
      return;
    }
    
    // Call original warn for other messages
    originalWarn.apply(console, args);
  };
}

/**
 * @description Inner app component that uses theme context
 */
function AppContent({ Component, pageProps }: { Component: any; pageProps: any }) {
  const { mantineTheme: dynamicTheme, isDarkMode } = useTheme();
  
  // Initialize Bitwarden theme fix
  React.useEffect(() => {
    setBitwardenThemePreference();
    initBitwardenThemeFix();
  }, []);
  
  return (
    <MantineProvider theme={dynamicTheme} forceColorScheme={isDarkMode ? 'dark' : 'light'}>
      <FaviconManager />
      <Notifications />
      <UnifiedAuthProvider>
        <NotificationProvider>
          <Component {...pageProps} />
        </NotificationProvider>
      </UnifiedAuthProvider>
    </MantineProvider>
  );
}

/**
 * @description Main App component
 * @param {Object} props - Component props
 * @param {React.Component} props.Component - The page component
 * @param {Object} props.pageProps - The page props
 * @returns App component
 */
export default function App({ Component, pageProps }: { Component: any; pageProps: any }) {
  return (
    <ThemeProvider>
      <AppContent Component={Component} pageProps={pageProps} />
    </ThemeProvider>
  )
}
