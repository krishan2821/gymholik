import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { BRAND, PALETTES } from '../src/theme';

// Use the dark-mode bg for initial HTML render (before JS loads)
const initBg = PALETTES[BRAND].dark.bg;
const initPrimary = PALETTES[BRAND].dark.primary;

/**
 * Root HTML component for web rendering in Expo Router.
 * Sets the theme-color meta tag and initial background so there is no flash.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Web theme-color follows the app mode (dark default) */}
        <meta name="theme-color" content={initBg} />
        <title>Gymholik: Gym management</title>
        <link rel="icon" type="image/png" href="/assets/favicon.png" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Reset default body styles and fix full height */
              *, *::before, *::after {
                box-sizing: border-box;
              }
              html, body, #root {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                overflow-x: hidden;
                display: flex;
                flex-direction: column;
                background-color: ${initBg};
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }

              /* Visible 2px focus ring for keyboard navigation */
              :focus-visible {
                outline: 2px solid ${initPrimary} !important;
                outline-offset: 2px !important;
              }

              /* Cursor pointer for interactive elements on web */
              [role="button"], button, a, [role="link"], input[type="submit"] {
                cursor: pointer;
              }

              /* Respect prefers-reduced-motion on web */
              @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                  animation-duration: 0.01ms !important;
                  animation-iteration-count: 1 !important;
                  transition-duration: 0.01ms !important;
                  scroll-behavior: auto !important;
                }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
