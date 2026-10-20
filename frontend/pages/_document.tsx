/**
 * @fileoverview Next.js Document component
 * @description Custom document setup with fonts and meta tags
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { Html, Head, Main, NextScript } from 'next/document'
import { ColorSchemeScript } from '@mantine/core';

/**
 * @description Custom Document component
 * @returns Document component
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <ColorSchemeScript />
        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Meta tags */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="A comprehensive task management system designed to help parents encourage children to complete household tasks through gamification and rewards." />
        
        {/* Favicon - Managed dynamically by FaviconManager component */}
        <link rel="icon" href="/favicon_dark.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon_dark.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon_dark.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon_dark.ico" />
        
        {/* Theme color */}
        <meta name="theme-color" content="#2563eb" />
        
        {/* Suppress WebSocket connection errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress WebSocket connection errors since HTTP notifications work as fallback
              (function() {
                const originalError = console.error;
                console.error = function(...args) {
                  const message = args[0]?.toString() || '';
                  if (message.includes("can't establish a connection to the server at ws://") ||
                      message.includes("The connection to ws://") ||
                      message.includes("was interrupted while the page was loading") ||
                      message.includes("Firefox can't establish a connection")) {
                    return; // Don't log these errors
                  }
                  originalError.apply(console, args);
                };
                
                const originalWarn = console.warn;
                console.warn = function(...args) {
                  const message = args[0]?.toString() || '';
                  if (message.includes("can't establish a connection to the server at ws://") ||
                      message.includes("The connection to ws://") ||
                      message.includes("was interrupted while the page was loading") ||
                      message.includes("Firefox can't establish a connection")) {
                    return; // Don't log these warnings
                  }
                  originalWarn.apply(console, args);
                };
              })();
            `,
          }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
