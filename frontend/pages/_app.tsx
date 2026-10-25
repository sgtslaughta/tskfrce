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
import 'material-symbols/rounded.css';
import '../src/v2/parent/icons.css';
import '../src/styles/mantine-fixes.css';
import '../src/v2/fridge.css';
import '../src/v2/parent/parent-tokens.css';
import '../src/v2/parent/motion.css';
import '../src/v2/parent/shell.css';
import '../src/v2/parent/layout.css';
import '../src/v2/parent/rail.css';
import '../src/v2/parent/buttons.css';
import '../src/v2/parent/cards.css';
import '../src/v2/parent/typography.css';
import '../src/v2/parent/responsive.css';
import '../src/v2/parent/parent-layout.css';
import '../src/v2/parent/parent-today.css';
import '../src/v2/parent/parent-kids.css';
import '../src/v2/parent/parent-manage.css';
import '../src/v2/parent/parent-devices.css';
import '../src/v2/today/onboarding.css';
import '../src/v2/login/auth.css';
import '../src/v2/controls.css';
import '../src/v2/polish.css';
import '../src/v2/chat/chatDock.css';
import '../src/v2/flair/cards.css';
import '../src/v2/flair/rings.css';
import '../src/v2/flair/names.css';
import '../src/v2/flair/titles.css';
import '../src/v2/manage/manage.css';
import '../src/v2/components/progression.css';
import '../src/v2/kid/award.css';
import '../src/v2/kid/kid-intro.css';
import '../src/v2/components/bell.css';
import '../src/v2/interactions.css';

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

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { fridgeTheme, colorSchemeManager } from '../src/v2/theme';
import { display, body, mono, parent } from '../src/v2/fonts';
import { makeQueryClient } from '../src/v2/queryClient';
import { UnifiedAuthProvider } from '../src/contexts/UnifiedAuthContext'
import { ThemeProvider } from '../src/contexts/ThemeContext'
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
 * @description Inner app component. Legacy ThemeProvider stays for brand colors only; it no longer forces the scheme.
 */
function AppContent({ Component, pageProps }: { Component: any; pageProps: any }) {
  const [queryClient] = React.useState(makeQueryClient);

  // Initialize Bitwarden theme fix
  React.useEffect(() => {
    setBitwardenThemePreference();
    initBitwardenThemeFix();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <style jsx global>{`
        :root {
          --font-display: ${display.style.fontFamily};
          --font-body: ${body.style.fontFamily};
          --font-mono: ${mono.style.fontFamily};
          --font-parent: ${parent.style.fontFamily};
        }
      `}</style>
      <MantineProvider
        theme={fridgeTheme}
        defaultColorScheme="auto"
        colorSchemeManager={colorSchemeManager}
      >
        <FaviconManager />
        <Notifications />
        <UnifiedAuthProvider>
          <Component {...pageProps} />
        </UnifiedAuthProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

/**
 * @description Main App component
 */
export default function App({ Component, pageProps }: { Component: any; pageProps: any }) {
  return (
    <ThemeProvider>
      <AppContent Component={Component} pageProps={pageProps} />
    </ThemeProvider>
  )
}
