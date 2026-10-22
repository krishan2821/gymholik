import { Platform } from 'react-native';
import { BRAND, PALETTES } from '../theme';

/**
 * Injects global responsive and interaction styling for web.
 * Colours are derived from the active brand/mode palette tokens.
 *
 * - Cursor pointer on pressables
 * - Visible focus ring (2px solid primary) for keyboard users (:focus-visible)
 * - Hover state (slight lift -2px and brighter border) on buttons, cards, rows
 *   for mouse devices only (@media (hover: hover) and (pointer: fine))
 * - Respects prefers-reduced-motion
 */
export function injectGlobalWebStyles(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const styleId = 'gymholik-web-responsive-styles';
  if (document.getElementById(styleId)) return;

  // Use the active brand dark tokens for initial CSS injection
  const t = PALETTES[BRAND].dark;
  const tLight = PALETTES[BRAND].light;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Full-height background without horizontal scroll */
    html, body, #root {
      background-color: ${t.bg};
      height: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      overflow-x: hidden;
      width: 100%;
      max-width: 100vw;
    }

    /* Light-mode overrides via color-scheme */
    @media (prefers-color-scheme: light) {
      html, body, #root {
        background-color: ${tLight.bg};
      }
    }

    /* Cursor pointer on pressables */
    [role="button"],
    button,
    [tabindex="0"],
    a,
    input[type="button"],
    input[type="submit"],
    [data-interactive="button"],
    [data-interactive="card"],
    [data-interactive="row"] {
      cursor: pointer;
    }

    [disabled],
    [aria-disabled="true"] {
      cursor: not-allowed !important;
    }

    /* Visible focus ring for keyboard users ONLY */
    :focus-visible {
      outline: 2px solid ${t.primary} !important;
      outline-offset: 2px !important;
      border-radius: 6px !important;
    }

    /* Remove square highlight on mouse focus */
    :focus:not(:focus-visible),
    button:focus:not(:focus-visible),
    [role="button"]:focus:not(:focus-visible),
    [tabindex]:focus:not(:focus-visible),
    a:focus:not(:focus-visible) {
      outline: none !important;
      box-shadow: none !important;
    }

    /* Tab bar items: clean state */
    [data-tab-item] {
      outline: none !important;
      box-shadow: none !important;
      user-select: none;
    }

    [data-tab-item]:focus:not(:focus-visible) {
      outline: none !important;
      box-shadow: none !important;
    }

    /* Smooth transitions for interactive elements */
    [data-interactive="button"],
    [data-interactive="card"],
    [data-interactive="row"],
    [role="button"]:not([data-tab-item]) {
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
    }

    /* Hover states — MOUSE ONLY */
    @media (hover: hover) and (pointer: fine) {
      [data-interactive="button"]:hover:not([disabled]):not([aria-disabled="true"]),
      [role="button"]:not([data-tab-item]):hover:not([disabled]):not([aria-disabled="true"]) {
        transform: translateY(-2px);
        box-shadow: 0 4px 14px color-mix(in srgb, black 20%, transparent);
      }

      [data-tab-item]:hover {
        transform: none !important;
        border-color: transparent !important;
        box-shadow: none !important;
      }

      [data-tab-item="center"]:hover {
        transform: scale(1.04) !important;
      }

      [data-interactive="card"]:hover,
      [data-interactive="card"]:hover > div {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px color-mix(in srgb, black 18%, transparent);
      }

      [data-interactive="row"]:hover {
        transform: translateY(-1px);
      }
    }

    /* Respect prefers-reduced-motion */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }

      [data-interactive="button"]:hover,
      [data-interactive="card"]:hover,
      [data-interactive="row"]:hover,
      [role="button"]:hover {
        transform: none !important;
      }
    }
  `;

  document.head.appendChild(style);
}

export default injectGlobalWebStyles;
