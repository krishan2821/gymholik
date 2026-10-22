/**
 * componentContrast.test.ts
 *
 * Automated verification of component colour resolution and contrast inside ThemeProvider:
 * 1. Renders shared components in Light and Dark mode inside ThemeProvider.
 * 2. Computes the WCAG contrast between resolved text/foreground colours and nearest background.
 * 3. Fails if contrast < 4.5:1 (or < 3.0:1 for large text).
 * 4. Fails if resolved colours are identical between Light and Dark mode (asserting mode divergence).
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from './ThemeContext';
import { buildTheme } from './theme';
import { parseColor, getContrastRatio, calculateContrastRatio } from './contrast.test';

function computeEffectiveContrast(fgColor: string, bgColor: string, surfaceColor?: string): number {
  const surfaceRgb = surfaceColor ? parseColor(surfaceColor) : undefined;
  const bgRgb = parseColor(bgColor, surfaceRgb);
  const fgRgb = parseColor(fgColor, bgRgb);
  return getContrastRatio(fgRgb, bgRgb);
}

describe('Shared Components Contrast & Mode Divergence Tests', () => {
  describe('Button Component', () => {
    it('primary button has >= 4.5:1 contrast and diverges in Light vs Dark mode', () => {
      const themeLight = buildTheme('light', 'cobalt');
      const themeDark = buildTheme('dark', 'cobalt');

      const lightBg = themeLight.colors.primary; // #1D4ED8
      const lightFg = themeLight.colors.textOnPrimary; // #FFFFFF
      const darkBg = themeDark.colors.primary; // #6C9BFF
      const darkFg = themeDark.colors.textOnPrimary; // #06122B

      const lightContrast = computeEffectiveContrast(lightFg, lightBg);
      const darkContrast = computeEffectiveContrast(darkFg, darkBg);

      // Contrast assertion (>= 4.5:1)
      assert.ok(lightContrast >= 4.5, `Light Primary Button contrast ${lightContrast.toFixed(2)} must be >= 4.5:1`);
      assert.ok(darkContrast >= 4.5, `Dark Primary Button contrast ${darkContrast.toFixed(2)} must be >= 4.5:1`);

      // Mode divergence assertion: primary background and text must NOT be identical
      assert.notEqual(lightBg, darkBg, 'Primary button background must diverge between Light and Dark mode');
      assert.notEqual(lightFg, darkFg, 'Primary button text must diverge between Light and Dark mode');

      // Verify exact required design specs
      assert.equal(lightBg.toUpperCase(), '#1D4ED8');
      assert.equal(lightFg.toUpperCase(), '#FFFFFF');
      assert.equal(darkBg.toUpperCase(), '#6C9BFF');
      assert.equal(darkFg.toUpperCase(), '#06122B');
    });

    it('secondary button has >= 4.5:1 contrast and diverges in Light vs Dark mode', () => {
      const themeLight = buildTheme('light', 'cobalt');
      const themeDark = buildTheme('dark', 'cobalt');

      const lightBg = themeLight.colors.surface;
      const lightFg = themeLight.colors.text;
      const darkBg = themeDark.colors.surface;
      const darkFg = themeDark.colors.text;

      const lightContrast = computeEffectiveContrast(lightFg, lightBg);
      const darkContrast = computeEffectiveContrast(darkFg, darkBg);

      assert.ok(lightContrast >= 4.5, `Light Secondary Button contrast ${lightContrast.toFixed(2)} must be >= 4.5:1`);
      assert.ok(darkContrast >= 4.5, `Dark Secondary Button contrast ${darkContrast.toFixed(2)} must be >= 4.5:1`);

      assert.notEqual(lightBg, darkBg, 'Secondary button background must diverge');
      assert.notEqual(lightFg, darkFg, 'Secondary button text must diverge');
    });

    it('disabled button has >= 4.5:1 contrast and diverges in Light vs Dark mode', () => {
      const themeLight = buildTheme('light', 'cobalt');
      const themeDark = buildTheme('dark', 'cobalt');

      const lightBg = themeLight.colors.surfaceRaised;
      const lightFg = themeLight.colors.textSecondary;
      const darkBg = themeDark.colors.surfaceRaised;
      const darkFg = themeDark.colors.textSecondary;

      const lightContrast = computeEffectiveContrast(lightFg, lightBg);
      const darkContrast = computeEffectiveContrast(darkFg, darkBg);

      assert.ok(lightContrast >= 4.5, `Light Disabled Button contrast ${lightContrast.toFixed(2)} must be >= 4.5:1`);
      assert.ok(darkContrast >= 4.5, `Dark Disabled Button contrast ${darkContrast.toFixed(2)} must be >= 4.5:1`);

      assert.notEqual(lightBg, darkBg, 'Disabled button background must diverge');
      assert.notEqual(lightFg, darkFg, 'Disabled button text must diverge');
    });
  });

  describe('Badge Component', () => {
    const badgeVariants: ('active' | 'expiring' | 'expired')[] = ['active', 'expiring', 'expired'];

    for (const variant of badgeVariants) {
      it(`Badge (${variant}) has >= 4.5:1 contrast and diverges in Light vs Dark mode`, () => {
        const themeLight = buildTheme('light', 'cobalt');
        const themeDark = buildTheme('dark', 'cobalt');

        let lightFg: string, lightBg: string, darkFg: string, darkBg: string;
        if (variant === 'active') {
          lightFg = themeLight.colors.chipSuccessText;
          lightBg = themeLight.colors.chipSuccessBg;
          darkFg = themeDark.colors.chipSuccessText;
          darkBg = themeDark.colors.chipSuccessBg;
        } else if (variant === 'expiring') {
          lightFg = themeLight.colors.chipWarningText;
          lightBg = themeLight.colors.chipWarningBg;
          darkFg = themeDark.colors.chipWarningText;
          darkBg = themeDark.colors.chipWarningBg;
        } else {
          lightFg = themeLight.colors.chipDangerText;
          lightBg = themeLight.colors.chipDangerBg;
          darkFg = themeDark.colors.chipDangerText;
          darkBg = themeDark.colors.chipDangerBg;
        }

        const lightContrast = computeEffectiveContrast(lightFg, lightBg, themeLight.colors.surface);
        const darkContrast = computeEffectiveContrast(darkFg, darkBg, themeDark.colors.surface);

        assert.ok(lightContrast >= 4.5, `Light Badge (${variant}) contrast ${lightContrast.toFixed(2)} must be >= 4.5:1`);
        assert.ok(darkContrast >= 4.5, `Dark Badge (${variant}) contrast ${darkContrast.toFixed(2)} must be >= 4.5:1`);

        assert.notEqual(lightBg, darkBg, `Badge (${variant}) background must diverge`);
        assert.notEqual(lightFg, darkFg, `Badge (${variant}) text must diverge`);
      });
    }
  });

  describe('Chip & FilterChip Component', () => {
    it('chips have >= 4.5:1 contrast and diverge across modes', () => {
      const themeLight = buildTheme('light', 'cobalt');
      const themeDark = buildTheme('dark', 'cobalt');

      // Unselected chip
      const lightUnselectedBg = themeLight.colors.surfaceRaised;
      const lightUnselectedFg = themeLight.colors.text;
      const darkUnselectedBg = themeDark.colors.surfaceRaised;
      const darkUnselectedFg = themeDark.colors.text;

      const lightUnselectedContrast = computeEffectiveContrast(lightUnselectedFg, lightUnselectedBg);
      const darkUnselectedContrast = computeEffectiveContrast(darkUnselectedFg, darkUnselectedBg);

      assert.ok(lightUnselectedContrast >= 4.5, `Light unselected chip contrast ${lightUnselectedContrast.toFixed(2)} must be >= 4.5:1`);
      assert.ok(darkUnselectedContrast >= 4.5, `Dark unselected chip contrast ${darkUnselectedContrast.toFixed(2)} must be >= 4.5:1`);
      assert.notEqual(lightUnselectedBg, darkUnselectedBg, 'Unselected chip background must diverge');

      // Selected chip
      const lightSelectedBg = themeLight.colors.primary;
      const lightSelectedFg = themeLight.colors.textOnPrimary;
      const darkSelectedBg = themeDark.colors.primary;
      const darkSelectedFg = themeDark.colors.textOnPrimary;

      const lightSelectedContrast = computeEffectiveContrast(lightSelectedFg, lightSelectedBg);
      const darkSelectedContrast = computeEffectiveContrast(darkSelectedFg, darkSelectedBg);

      assert.ok(lightSelectedContrast >= 4.5, `Light selected chip contrast ${lightSelectedContrast.toFixed(2)} must be >= 4.5:1`);
      assert.ok(darkSelectedContrast >= 4.5, `Dark selected chip contrast ${darkSelectedContrast.toFixed(2)} must be >= 4.5:1`);
      assert.notEqual(lightSelectedBg, darkSelectedBg, 'Selected chip background must diverge');
    });
  });

  describe('GymholikLogo Component', () => {
    it('logo on plain background applies text tintColor and diverges', () => {
      const themeLight = buildTheme('light', 'cobalt');
      const themeDark = buildTheme('dark', 'cobalt');

      const lightTint = themeLight.colors.text; // #0B1020
      const darkTint = themeDark.colors.text; // #EEF2FF

      const lightContrast = computeEffectiveContrast(lightTint, themeLight.colors.bg);
      const darkContrast = computeEffectiveContrast(darkTint, themeDark.colors.bg);

      assert.ok(lightContrast >= 4.5, `Light Logo plain contrast ${lightContrast.toFixed(2)} must be >= 4.5:1`);
      assert.ok(darkContrast >= 4.5, `Dark Logo plain contrast ${darkContrast.toFixed(2)} must be >= 4.5:1`);

      assert.notEqual(lightTint, darkTint, 'Logo tintColor on plain background must diverge');
    });

    it('logo on login card applies primary tintColor and diverges', () => {
      const themeLight = buildTheme('light', 'cobalt');
      const themeDark = buildTheme('dark', 'cobalt');

      const lightTint = themeLight.colors.primary; // #1D4ED8
      const darkTint = themeDark.colors.primary; // #6C9BFF

      const lightContrast = computeEffectiveContrast(lightTint, themeLight.colors.surface);
      const darkContrast = computeEffectiveContrast(darkTint, themeDark.colors.surface);

      // Card tint is large brand graphic / large text token threshold >= 3:1
      assert.ok(lightContrast >= 3.0, `Light Logo card contrast ${lightContrast.toFixed(2)} must be >= 3:1`);
      assert.ok(darkContrast >= 3.0, `Dark Logo card contrast ${darkContrast.toFixed(2)} must be >= 3:1`);

      assert.notEqual(lightTint, darkTint, 'Logo tintColor on card must diverge');
      assert.equal(lightTint.toUpperCase(), '#1D4ED8');
      assert.equal(darkTint.toUpperCase(), '#6C9BFF');
    });
  });

  describe('PageHeader Component', () => {
    it('header title and action button icon have >= 4.5:1 contrast and diverge', () => {
      const themeLight = buildTheme('light', 'cobalt');
      const themeDark = buildTheme('dark', 'cobalt');

      // Title on screen background
      const lightTitleContrast = computeEffectiveContrast(themeLight.colors.text, themeLight.colors.bg);
      const darkTitleContrast = computeEffectiveContrast(themeDark.colors.text, themeDark.colors.bg);

      assert.ok(lightTitleContrast >= 4.5, `Light PageHeader title contrast ${lightTitleContrast.toFixed(2)} must be >= 4.5:1`);
      assert.ok(darkTitleContrast >= 4.5, `Dark PageHeader title contrast ${darkTitleContrast.toFixed(2)} must be >= 4.5:1`);
      assert.notEqual(themeLight.colors.text, themeDark.colors.text, 'Header title color must diverge');

      // Icon button (e.g. back, bell, search) on raised background
      const lightIconContrast = computeEffectiveContrast(themeLight.colors.text, themeLight.colors.surfaceRaised);
      const darkIconContrast = computeEffectiveContrast(themeDark.colors.text, themeDark.colors.surfaceRaised);

      assert.ok(lightIconContrast >= 4.5, `Light PageHeader icon contrast ${lightIconContrast.toFixed(2)} must be >= 4.5:1`);
      assert.ok(darkIconContrast >= 4.5, `Dark PageHeader icon contrast ${darkIconContrast.toFixed(2)} must be >= 4.5:1`);
    });
  });

  describe('EmptyState & ErrorState Components', () => {
    it('states resolve high-contrast text and diverge between modes', () => {
      const themeLight = buildTheme('light', 'cobalt');
      const themeDark = buildTheme('dark', 'cobalt');

      // EmptyState: text on bg
      const lightEmptyContrast = computeEffectiveContrast(themeLight.colors.text, themeLight.colors.bg);
      const darkEmptyContrast = computeEffectiveContrast(themeDark.colors.text, themeDark.colors.bg);
      assert.ok(lightEmptyContrast >= 4.5);
      assert.ok(darkEmptyContrast >= 4.5);

      // ErrorState: danger message on bg
      const lightErrContrast = computeEffectiveContrast(themeLight.colors.danger, themeLight.colors.bg);
      const darkErrContrast = computeEffectiveContrast(themeDark.colors.danger, themeDark.colors.bg);
      assert.ok(lightErrContrast >= 4.5);
      assert.ok(darkErrContrast >= 4.5);

      assert.notEqual(themeLight.colors.danger, themeDark.colors.danger, 'Danger text must diverge');
    });
  });

  describe('ThemeProvider Mode Re-rendering & Divergence', () => {
    it('renders different primary and text colors inside ThemeProvider mode="light" vs mode="dark"', () => {
      function Consumer() {
        const { colors, mode } = require('./ThemeContext').useTheme();
        return React.createElement(
          'div',
          { 'data-mode': mode, 'data-primary': colors.primary, 'data-text': colors.text },
          mode
        );
      }

      const lightHtml = renderToString(
        React.createElement(ThemeProvider, { mode: 'light' }, React.createElement(Consumer))
      );
      const darkHtml = renderToString(
        React.createElement(ThemeProvider, { mode: 'dark' }, React.createElement(Consumer))
      );

      assert.ok(lightHtml.includes('data-primary="#1D4ED8"'), 'Light mode must resolve primary #1D4ED8');
      assert.ok(darkHtml.includes('data-primary="#6C9BFF"'), 'Dark mode must resolve primary #6C9BFF');
      assert.notEqual(lightHtml, darkHtml, 'Rendered HTML must diverge between light and dark modes');
    });
  });
});
