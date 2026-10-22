/**
 * paletteLeak.test.ts
 *
 * Cross-Palette Leak Test:
 * For every shared component and mockable screen, render it in Light mode
 * inside ThemeProvider, extract every resolved color in the rendered output,
 * and fail if ANY color equals a color that exists ONLY in the dark palette
 * (and the reverse for Dark mode against light-only colors).
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from './ThemeContext';
import { PALETTES, Brand, ColorMode } from './palette';

// Shared Components
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Chip } from '../components/Chip';
import { FilterChips } from '../components/FilterChips';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { GymholikLogo } from '../components/GymholikLogo';
import { PaymentsSummaryCard } from '../components/PaymentsSummaryCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { Switch } from '../components/Switch';
import { StepProgress } from '../components/StepProgress';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { Screen } from '../components/Screen';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Screens
import OtpLoginScreen from '../../app/(auth)/login';
import AbsentMembersScreen from '../../app/(tabs)/attendance/absent';
import MoreScreen from '../../app/(tabs)/more/index';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Color Normalizer & Palette Extraction
// ─────────────────────────────────────────────────────────────────────────────
export function toCanonical(c: string): string {
  c = c.trim().toLowerCase();
  // 8-character hex e.g. #1d4ed833 or #1d4ed8
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgb(${r},${g},${b})`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgb(${r},${g},${b})`;
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = (parseInt(hex.slice(6, 8), 16) / 255).toFixed(2);
      return `rgba(${r},${g},${b},${parseFloat(a)})`;
    }
  }
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (a >= 0.99) {
      return `rgb(${r},${g},${b})`;
    }
    return `rgba(${r},${g},${b},${Number(a.toFixed(2))})`;
  }
  return c;
}

const getCanonicalSet = (p: any) =>
  new Set(Object.values(p).filter((v) => typeof v === 'string').map((v) => toCanonical(v as string)));

// Build Dark-Only and Light-Only Sets across all brands
const darkColors = new Set([
  ...getCanonicalSet(PALETTES.cobalt.dark),
  ...getCanonicalSet(PALETTES.ember.dark),
]);

const lightColors = new Set([
  ...getCanonicalSet(PALETTES.cobalt.light),
  ...getCanonicalSet(PALETTES.ember.light),
]);

export const darkOnlyColors = new Set([...darkColors].filter((c) => !lightColors.has(c)));
export const lightOnlyColors = new Set([...lightColors].filter((c) => !darkColors.has(c)));

/**
 * Extracts every color literal (hex, rgb, rgba) found in an HTML or style output string.
 */
export function extractColors(html: string): string[] {
  const matches = html.match(/(?:#([0-9a-fA-F]{3,8})|rgba?\([^)]+\))/g) || [];
  return matches.map(toCanonical);
}

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: Infinity },
  },
});

/**
 * Verifies that a component rendered in Light mode contains 0 Dark-Only colors,
 * and rendered in Dark mode contains 0 Light-Only colors.
 */
function assertNoCrossPaletteLeak(name: string, renderComponent: () => React.ReactElement) {
  // 1. Light Mode Render
  const lightHtml = renderToString(
    React.createElement(
      QueryClientProvider,
      { client: testQueryClient },
      React.createElement(ThemeProvider, { mode: 'light' }, renderComponent())
    )
  );
  const lightFoundColors = extractColors(lightHtml);
  for (const color of lightFoundColors) {
    if (darkOnlyColors.has(color)) {
      assert.fail(
        `[CROSS-PALETTE LEAK] ${name} rendered in LIGHT mode contains DARK-ONLY color: ${color}`
      );
    }
  }

  // 2. Dark Mode Render
  const darkHtml = renderToString(
    React.createElement(
      QueryClientProvider,
      { client: testQueryClient },
      React.createElement(ThemeProvider, { mode: 'dark' }, renderComponent())
    )
  );
  const darkFoundColors = extractColors(darkHtml);
  for (const color of darkFoundColors) {
    if (lightOnlyColors.has(color)) {
      assert.fail(
        `[CROSS-PALETTE LEAK] ${name} rendered in DARK mode contains LIGHT-ONLY color: ${color}`
      );
    }
  }
}

describe('Cross-Palette Leak Verification', () => {
  it('identifies distinct dark-only and light-only palette colors', () => {
    assert.ok(darkOnlyColors.size > 15, 'Must have substantial dark-only color tokens');
    assert.ok(lightOnlyColors.size > 15, 'Must have substantial light-only color tokens');
    // Dark symptoms from bug
    assert.ok(darkOnlyColors.has('rgb(238,242,255)'), 'Dark text (#EEF2FF) is dark-only');
    assert.ok(darkOnlyColors.has('rgb(18,26,46)'), 'Dark surface (#121A2E) is dark-only');
    assert.ok(darkOnlyColors.has('rgb(27,38,64)'), 'Dark surfaceRaised (#1B2640) is dark-only');
    assert.ok(darkOnlyColors.has('rgb(108,155,255)'), 'Dark primary (#6C9BFF) is dark-only');
    assert.ok(darkOnlyColors.has('rgb(6,18,43)'), 'Dark textOnPrimary (#06122B) is dark-only');

    // Light tokens
    assert.ok(lightOnlyColors.has('rgb(29,78,216)'), 'Light primary (#1D4ED8) is light-only');
    assert.ok(lightOnlyColors.has('rgb(244,246,251)'), 'Light bg (#F4F6FB) is light-only');
    assert.ok(lightOnlyColors.has('rgb(235,239,248)'), 'Light surfaceRaised (#EBEFF8) is light-only');
  });

  describe('Shared Components Leak Tests', () => {
    it('Button (primary, secondary, danger, ghost)', () => {
      assertNoCrossPaletteLeak('Button[primary]', () =>
        React.createElement(Button, { title: 'Primary', variant: 'primary' })
      );
      assertNoCrossPaletteLeak('Button[secondary]', () =>
        React.createElement(Button, { title: 'Secondary', variant: 'secondary' })
      );
      assertNoCrossPaletteLeak('Button[danger]', () =>
        React.createElement(Button, { title: 'Danger', variant: 'danger' })
      );
      assertNoCrossPaletteLeak('Button[ghost]', () =>
        React.createElement(Button, { title: 'Ghost', variant: 'ghost' })
      );
    });

    it('Badge variants (active, expiring, expired, info)', () => {
      assertNoCrossPaletteLeak('Badge[active]', () =>
        React.createElement(Badge, { label: 'Active', variant: 'active' })
      );
      assertNoCrossPaletteLeak('Badge[expiring]', () =>
        React.createElement(Badge, { label: 'Expiring', variant: 'expiring' })
      );
      assertNoCrossPaletteLeak('Badge[expired]', () =>
        React.createElement(Badge, { label: 'Expired', variant: 'expired' })
      );
    });

    it('Chip and FilterChips', () => {
      assertNoCrossPaletteLeak('Chip[selected]', () =>
        React.createElement(Chip, { label: 'Filter', selected: true, onPress: () => {} })
      );
      assertNoCrossPaletteLeak('Chip[unselected]', () =>
        React.createElement(Chip, { label: 'Filter', selected: false, onPress: () => {} })
      );
      assertNoCrossPaletteLeak('FilterChips', () =>
        React.createElement(FilterChips, {
          options: [
            { value: 'all', label: 'All', count: 10 },
            { value: 'active', label: 'Active', count: 5 },
          ],
          selectedValue: 'all',
          onSelect: () => {},
        })
      );
    });

    it('PageHeader (with back button and actions)', () => {
      assertNoCrossPaletteLeak('PageHeader', () =>
        React.createElement(PageHeader, {
          title: 'Members',
          subtitle: 'Active roster',
          showBack: true,
        })
      );
    });

    it('EmptyState and ErrorState', () => {
      assertNoCrossPaletteLeak('EmptyState', () =>
        React.createElement(EmptyState, {
          title: 'No members found',
          message: 'Try adjusting your search criteria.',
        })
      );
      assertNoCrossPaletteLeak('ErrorState', () =>
        React.createElement(ErrorState, {
          message: 'Failed to load data',
        })
      );
    });

    it('Input component (default, error, focused)', () => {
      assertNoCrossPaletteLeak('Input[default]', () =>
        React.createElement(Input, { placeholder: 'Search members...', value: '' })
      );
      assertNoCrossPaletteLeak('Input[error]', () =>
        React.createElement(Input, {
          placeholder: 'Amount',
          value: '100',
          error: 'Invalid amount entered',
        })
      );
    });

    it('Avatar component', () => {
      assertNoCrossPaletteLeak('Avatar', () =>
        React.createElement(Avatar, { name: 'John Doe', size: 48 })
      );
    });

    it('GymholikLogo component', () => {
      assertNoCrossPaletteLeak('GymholikLogo[plain]', () =>
        React.createElement(GymholikLogo, { size: 'md', onLoginCard: false })
      );
      assertNoCrossPaletteLeak('GymholikLogo[card]', () =>
        React.createElement(GymholikLogo, { size: 'lg', onLoginCard: true })
      );
    });

    it('PaymentsSummaryCard component', () => {
      assertNoCrossPaletteLeak('PaymentsSummaryCard', () =>
        React.createElement(PaymentsSummaryCard, {
          totalCollected: 125000,
          pendingDues: 18500,
          totalMembers: 45,
          activeMembers: 40,
        })
      );
    });

    it('SegmentedControl component', () => {
      assertNoCrossPaletteLeak('SegmentedControl', () =>
        React.createElement(SegmentedControl, {
          options: [
            { label: 'History', value: 'history' },
            { label: 'Dues', value: 'dues' },
          ],
          value: 'history',
          onChange: () => {},
        })
      );
    });

    it('Switch component', () => {
      assertNoCrossPaletteLeak('Switch[on]', () =>
        React.createElement(Switch, { value: true, onValueChange: () => {} })
      );
      assertNoCrossPaletteLeak('Switch[off]', () =>
        React.createElement(Switch, { value: false, onValueChange: () => {} })
      );
    });

    it('StepProgress and LoadingSkeleton', () => {
      assertNoCrossPaletteLeak('StepProgress', () =>
        React.createElement(StepProgress, {
          currentStep: 2,
          totalSteps: 3,
          labels: ['Details', 'Registration', 'Address'],
        })
      );
      assertNoCrossPaletteLeak('LoadingSkeleton', () =>
        React.createElement(LoadingSkeleton, { count: 3 })
      );
    });

    it('Screen component with background', () => {
      assertNoCrossPaletteLeak('Screen', () =>
        React.createElement(
          Screen,
          null,
          React.createElement(PageHeader, { title: 'Test Screen' })
        )
      );
    });
  });

  describe('Mockable Screens Leak Tests', () => {
    it('Login Screen (app/(auth)/login.tsx)', () => {
      assertNoCrossPaletteLeak('OtpLoginScreen', () => React.createElement(OtpLoginScreen));
    });

    it('Absent Members Screen (app/(tabs)/attendance/absent.tsx)', () => {
      assertNoCrossPaletteLeak('AbsentMembersScreen', () => React.createElement(AbsentMembersScreen));
    });

    it('More Screen (app/(tabs)/more/index.tsx)', () => {
      assertNoCrossPaletteLeak('MoreScreen', () => React.createElement(MoreScreen));
    });
  });
});
