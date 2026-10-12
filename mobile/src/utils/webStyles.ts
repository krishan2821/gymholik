import { Platform } from 'react-native';

/**
 * Injects global responsive and interaction styling for web.
 * - Cursor pointer on pressables ([role="button"], button, links, etc.)
 * - Visible focus ring (2px solid sage #8EB69B) for keyboard users (:focus-visible)
 * - Hover state (slight lift -2px and brighter border) on buttons, cards, and rows strictly for mouse devices
 * - No hover effects on touch devices (@media (hover: hover) and (pointer: fine))
 * - Respects prefers-reduced-motion (@media (prefers-reduced-motion: reduce))
 */
export function injectGlobalWebStyles(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const styleId = 'gymholik-web-responsive-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Full-height dark background container without horizontal scroll */
    html, body, #root {
      background-color: #051F20;
      height: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      overflow-x: hidden;
      width: 100%;
      max-width: 100vw;
    }

    /* 5. Cursor pointer on pressables */
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

    /* 5. Visible focus ring (rounded 2px sage) for keyboard users ONLY */
    :focus-visible {
      outline: 2px solid #8EB69B !important;
      outline-offset: 2px !important;
      border-radius: 6px !important;
    }

    /* Remove square white outline / highlight on mouse focus */
    :focus:not(:focus-visible),
    button:focus:not(:focus-visible),
    [role="button"]:focus:not(:focus-visible),
    [tabindex]:focus:not(:focus-visible),
    a:focus:not(:focus-visible) {
      outline: none !important;
      box-shadow: none !important;
    }

    /* Tab bar items: clean state without square highlight */
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

    /* 5. Hover states (slight lift and brighter border) - MOUSE ONLY, NO TOUCH */
    @media (hover: hover) and (pointer: fine) {
      /* Buttons: slight lift (-2px) and brighter border */
      [data-interactive="button"]:hover:not([disabled]):not([aria-disabled="true"]),
      [role="button"]:not([data-tab-item]):hover:not([disabled]):not([aria-disabled="true"]) {
        transform: translateY(-2px);
        border-color: rgba(218, 241, 222, 0.35) !important;
        box-shadow: 0 4px 14px rgba(142, 182, 155, 0.22);
      }

      /* Tab bar items do not get square card lifts/borders */
      [data-tab-item]:hover {
        transform: none !important;
        border-color: transparent !important;
        box-shadow: none !important;
      }

      [data-tab-item="center"]:hover {
        transform: scale(1.04) !important;
      }

      /* Cards: slight lift (-2px) and brighter border */
      [data-interactive="card"]:hover,
      [data-interactive="card"]:hover > div {
        transform: translateY(-2px);
        border-color: rgba(218, 241, 222, 0.28) !important;
        box-shadow: 0 6px 18px rgba(142, 182, 155, 0.18);
      }

      /* Rows: slight lift (-1px) and brighter border */
      [data-interactive="row"]:hover {
        transform: translateY(-1px);
        border-color: rgba(218, 241, 222, 0.24) !important;
        background-color: rgba(22, 56, 50, 0.5) !important;
      }
    }

    /* 6. Respect prefers-reduced-motion on web */
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
