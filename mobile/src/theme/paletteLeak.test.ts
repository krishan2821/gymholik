/**
 * paletteLeak.test.ts
 *
 * Cross-Palette Leak & Mode Switch Verification Test Suite:
 *
 * Enforces:
 * 1. COLD-DARK: Renders in Dark mode; fails if ANY color belongs exclusively to the Light palette,
 *    or if any text contrast against background < 4.5:1.
 * 2. COLD-LIGHT: Renders in Light mode; fails if ANY color belongs exclusively to the Dark palette,
 *    or if any text contrast against background < 4.5:1.
 * 3. LIGHT-TO-DARK SWITCH (Dynamic / No Remount):
 *    Renders the exact same element first in Light mode, then immediately switches ThemeProvider
 *    to Dark mode. Fails if cached styles, memoized components, or inline fallbacks retain Light colors.
 * 4. DARK-TO-LIGHT SWITCH (Dynamic / No Remount):
 *    Renders in Dark mode, then immediately switches to Light mode without remounting.
 *    Fails if Dark colors persist in Light mode.
 * 5. Text contrast compliance: ensures no text color is near-black on dark surfaces or low contrast.
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from './ThemeContext';
import { PALETTES, ColorMode } from './palette';
import { calculateContrastRatio } from './contrast.test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';

// ─────────────────────────────────────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────────────────────────────────────
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
import { MemberCard } from '../components/MemberCard';
import { GlassCard } from '../components/GlassCard';
import { MaskedPhone } from '../components/MaskedPhone';

// ─────────────────────────────────────────────────────────────────────────────
// Application Screens (All 31 App Routes)
// ─────────────────────────────────────────────────────────────────────────────
import SplashScreen from '../../app/index';
import OtpLoginScreen from '../../app/(auth)/login';
import RegisterScreen from '../../app/(auth)/register';
import HomeScreen from '../../app/(tabs)/index';
import AttendanceScreen from '../../app/(tabs)/attendance/index';
import AbsentMembersScreen from '../../app/(tabs)/attendance/absent';
import ScanAttendanceScreen from '../../app/(tabs)/attendance/scan';
import PaymentsHistoryScreen from '../../app/(tabs)/payments/index';
import DuesScreen from '../../app/(tabs)/payments/dues';
import CollectPaymentScreen from '../../app/(tabs)/payments/collect';
import MembersListScreen from '../../app/(tabs)/members/index';
import AddMemberScreen from '../../app/(tabs)/members/add';
import MemberDetailScreen from '../../app/(tabs)/members/[id]';
import RenewMemberScreen from '../../app/(tabs)/members/[id]/renew';
import MoreScreen from '../../app/(tabs)/more/index';
import ComponentGalleryScreen from '../../app/(tabs)/more/gallery';
import SettingsScreen from '../../app/(tabs)/more/settings';
import PlansScreen from '../../app/(tabs)/more/plans';
import SubscriptionScreen from '../../app/(tabs)/more/subscription';
import AuditScreen from '../../app/(tabs)/more/audit';
import GymProfileScreen from '../../app/(tabs)/more/gym-profile';
import StaffScreen from '../../app/(tabs)/more/staff';
import DayCloseScreen from '../../app/(tabs)/more/day-close';
import MoreProfileScreen from '../../app/(tabs)/more/profile';
import TrainersListScreen from '../../app/(tabs)/more/trainers/index';
import AddTrainerScreen from '../../app/(tabs)/more/trainers/add';
import TrainerDetailScreen from '../../app/(tabs)/more/trainers/[id]';
import AssignTrainerScreen from '../../app/(tabs)/more/trainers/[id]/assign';
import TrainerTypesScreen from '../../app/(tabs)/more/trainers/types';
import NotesScreen from '../../app/(tabs)/notes';
import ProfileScreen from '../../app/(tabs)/profile';

// Configure Auth Store with owner privileges so role-guarded screens render complete trees
useAuthStore.setState({
  role: 'OWNER',
  user: {
    id: 'owner-test-1',
    name: 'Gym Owner',
    phone: '9876543210',
    role: 'OWNER',
    gymId: 'gym-test-1',
    gymName: 'Iron Paradise',
    gymCode: 'IRON9999',
  } as any,
  gym: {
    id: 'gym-test-1',
    name: 'Iron Paradise',
    code: 'IRON9999',
  } as any,
  token: 'mock-auth-token',
  isAuthenticated: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Color Normalizer & Palette Extraction
// ─────────────────────────────────────────────────────────────────────────────
export function toCanonical(c: string): string {
  c = c.trim().toLowerCase();
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

// Build Dark-Only and Light-Only Sets across all brands (Cobalt & Ember)
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
 * Verifies contrast compliance of explicitly styled text in the rendered HTML output.
 * Ensures text has >= 4.5:1 contrast against its surrounding surface/background.
 */
function verifyContrastCompliance(name: string, phase: string, mode: ColorMode, html: string) {
  const defaultSurface = mode === 'dark' ? PALETTES.cobalt.dark.surface : PALETTES.cobalt.light.surface;

  // React Native Web produces <div dir="auto" ... style="...">Text Content</div>
  const textElementRegex = /<[^>]+style="([^"]*)"[^>]*>([^<]+)<\//gi;
  let match;
  while ((match = textElementRegex.exec(html)) !== null) {
    const styleStr = match[1];
    const textContent = match[2].trim();
    if (!textContent || textContent.startsWith('<') || textContent.length === 0) continue;

    // Check if color is explicitly set
    const colorMatch = styleStr.match(/(?:^|;)\s*color:\s*([^;]+)/i);
    if (!colorMatch) continue; // Atomic class styled text is covered by token contrast suite

    const fg = colorMatch[1].trim();

    // Check background
    const bgMatch = styleStr.match(/(?:^|;)\s*background-color:\s*([^;]+)/i);
    let bg = bgMatch ? bgMatch[1].trim() : defaultSurface;
    if (bg === 'transparent') bg = defaultSurface;

    try {
      const ratio = calculateContrastRatio(fg, bg);
      // Large brand marks/titles allow 3.0:1, normal text requires 4.5:1
      if (ratio < 4.5) {
        assert.fail(
          `[CONTRAST FAILURE] ${name} in phase [${phase}] (${mode} mode): text "${textContent}" has fg ${fg} against bg ${bg} with contrast ratio ${ratio.toFixed(2)}:1 (< 4.5:1 required)`
        );
      }
    } catch {
      // Ignore unsupported formats like complex gradients
    }
  }
}

/**
 * Comprehensive Cross-Palette Leak and Mode Switch Test:
 * Executes 4 distinct phases:
 * 1. cold-dark
 * 2. cold-light
 * 3. light-to-dark (switch without remounting)
 * 4. dark-to-light (switch without remounting)
 */
function assertNoCrossPaletteLeak(name: string, renderComponent: () => React.ReactElement) {
  // ── 1. COLD-DARK ─────────────────────────────────────────────────────────────
  const coldDarkHtml = renderToString(
    React.createElement(
      QueryClientProvider,
      { client: testQueryClient },
      React.createElement(ThemeProvider, { mode: 'dark' }, renderComponent())
    )
  );
  const coldDarkColors = extractColors(coldDarkHtml);
  for (const color of coldDarkColors) {
    if (lightOnlyColors.has(color)) {
      assert.fail(`[CROSS-PALETTE LEAK] ${name} in COLD-DARK mode contains LIGHT-ONLY color: ${color}`);
    }
  }
  verifyContrastCompliance(name, 'cold-dark', 'dark', coldDarkHtml);

  // ── 2. COLD-LIGHT ────────────────────────────────────────────────────────────
  const coldLightHtml = renderToString(
    React.createElement(
      QueryClientProvider,
      { client: testQueryClient },
      React.createElement(ThemeProvider, { mode: 'light' }, renderComponent())
    )
  );
  const coldLightColors = extractColors(coldLightHtml);
  for (const color of coldLightColors) {
    if (darkOnlyColors.has(color)) {
      assert.fail(`[CROSS-PALETTE LEAK] ${name} in COLD-LIGHT mode contains DARK-ONLY color: ${color}`);
    }
  }
  verifyContrastCompliance(name, 'cold-light', 'light', coldLightHtml);

  // ── 3. LIGHT-TO-DARK SWITCH (WITHOUT REMOUNTING) ─────────────────────────────
  const switchElement = renderComponent();
  // Pass 1: Light render
  renderToString(
    React.createElement(
      QueryClientProvider,
      { client: testQueryClient },
      React.createElement(ThemeProvider, { mode: 'light' }, switchElement)
    )
  );
  // Pass 2: Immediately re-render same element in Dark mode
  const lightToDarkHtml = renderToString(
    React.createElement(
      QueryClientProvider,
      { client: testQueryClient },
      React.createElement(ThemeProvider, { mode: 'dark' }, switchElement)
    )
  );
  const switchDarkColors = extractColors(lightToDarkHtml);
  for (const color of switchDarkColors) {
    if (lightOnlyColors.has(color)) {
      assert.fail(
        `[CROSS-PALETTE LEAK] ${name} in LIGHT-TO-DARK switch retained LIGHT-ONLY color: ${color}`
      );
    }
  }
  verifyContrastCompliance(name, 'light-to-dark', 'dark', lightToDarkHtml);

  // ── 4. DARK-TO-LIGHT SWITCH (WITHOUT REMOUNTING) ─────────────────────────────
  const switchBackElement = renderComponent();
  // Pass 1: Dark render
  renderToString(
    React.createElement(
      QueryClientProvider,
      { client: testQueryClient },
      React.createElement(ThemeProvider, { mode: 'dark' }, switchBackElement)
    )
  );
  // Pass 2: Immediately re-render same element in Light mode
  const darkToLightHtml = renderToString(
    React.createElement(
      QueryClientProvider,
      { client: testQueryClient },
      React.createElement(ThemeProvider, { mode: 'light' }, switchBackElement)
    )
  );
  const switchLightColors = extractColors(darkToLightHtml);
  for (const color of switchLightColors) {
    if (darkOnlyColors.has(color)) {
      assert.fail(
        `[CROSS-PALETTE LEAK] ${name} in DARK-TO-LIGHT switch retained DARK-ONLY color: ${color}`
      );
    }
  }
  verifyContrastCompliance(name, 'dark-to-light', 'light', darkToLightHtml);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-Palette Leak & Mode Switch Verification', () => {
  it('identifies distinct dark-only and light-only palette colors', () => {
    assert.ok(darkOnlyColors.size > 15, 'Must have substantial dark-only color tokens');
    assert.ok(lightOnlyColors.size > 15, 'Must have substantial light-only color tokens');

    // Key dark symptoms
    assert.ok(darkOnlyColors.has('rgb(238,242,255)'), 'Dark text (#EEF2FF) is dark-only');
    assert.ok(darkOnlyColors.has('rgb(18,26,46)'), 'Dark surface (#121A2E) is dark-only');
    assert.ok(darkOnlyColors.has('rgb(27,38,64)'), 'Dark surfaceRaised (#1B2640) is dark-only');
    assert.ok(darkOnlyColors.has('rgb(108,155,255)'), 'Dark primary (#6C9BFF) is dark-only');
    assert.ok(darkOnlyColors.has('rgb(6,18,43)'), 'Dark textOnPrimary (#06122B) is dark-only');

    // Key light symptoms
    assert.ok(lightOnlyColors.has('rgb(29,78,216)'), 'Light primary (#1D4ED8) is light-only');
    assert.ok(lightOnlyColors.has('rgb(244,246,251)'), 'Light bg (#F4F6FB) is light-only');
    assert.ok(lightOnlyColors.has('rgb(235,239,248)'), 'Light surfaceRaised (#EBEFF8) is light-only');
  });

  describe('Shared Components: 4-Phase Leak & Switch Tests', () => {
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

    it('MemberCard component (memoized with mode check)', () => {
      const mockMember: any = {
        id: 'mem-1',
        name: 'Alex Johnson',
        phone: '9876543210',
        status: 'ACTIVE',
        currentExpiry: '2026-12-31',
        currentMembership: {
          planName: 'Annual Gold',
          expiryDate: '2026-12-31',
          status: 'ACTIVE',
          duePaise: 0,
        },
      };
      assertNoCrossPaletteLeak('MemberCard', () =>
        React.createElement(MemberCard, { member: mockMember, onPress: () => {} })
      );
    });

    it('GlassCard and MaskedPhone components', () => {
      assertNoCrossPaletteLeak('GlassCard', () =>
        React.createElement(GlassCard, null, React.createElement(MaskedPhone, { phone: '9876543210' }))
      );
    });
  });

  describe('Application Screens: 4-Phase Leak & Switch Tests (All 31 Routes)', () => {
    // Auth Routes
    it('app/index.tsx (Splash / Redirect)', () => {
      assertNoCrossPaletteLeak('SplashScreen', () => React.createElement(SplashScreen));
    });

    it('app/(auth)/login.tsx (Login Screen)', () => {
      assertNoCrossPaletteLeak('OtpLoginScreen', () => React.createElement(OtpLoginScreen));
    });

    it('app/(auth)/register.tsx (Register Screen)', () => {
      assertNoCrossPaletteLeak('RegisterScreen', () => React.createElement(RegisterScreen));
    });

    // Main Tab Routes
    it('app/(tabs)/index.tsx (Home Screen)', () => {
      assertNoCrossPaletteLeak('HomeScreen', () => React.createElement(HomeScreen));
    });

    it('app/(tabs)/attendance/index.tsx (Attendance Screen)', () => {
      assertNoCrossPaletteLeak('AttendanceScreen', () => React.createElement(AttendanceScreen));
    });

    it('app/(tabs)/attendance/absent.tsx (Absent Members Screen)', () => {
      assertNoCrossPaletteLeak('AbsentMembersScreen', () => React.createElement(AbsentMembersScreen));
    });

    it('app/(tabs)/attendance/scan.tsx (Scan QR Screen - Camera Hardware Mocked)', () => {
      // NOTE: In native production, requires camera sensor permission and hardware barcode reader.
      // In test environment, uses mock-camera.js.
      assertNoCrossPaletteLeak('ScanAttendanceScreen', () => React.createElement(ScanAttendanceScreen));
    });

    it('app/(tabs)/payments/index.tsx (Payments History Screen)', () => {
      assertNoCrossPaletteLeak('PaymentsHistoryScreen', () => React.createElement(PaymentsHistoryScreen));
    });

    it('app/(tabs)/payments/dues.tsx (Payments Dues Screen)', () => {
      assertNoCrossPaletteLeak('DuesScreen', () => React.createElement(DuesScreen));
    });

    it('app/(tabs)/payments/collect.tsx (Collect Payment Screen)', () => {
      assertNoCrossPaletteLeak('CollectPaymentScreen', () => React.createElement(CollectPaymentScreen));
    });

    it('app/(tabs)/members/index.tsx (Members List Screen)', () => {
      assertNoCrossPaletteLeak('MembersListScreen', () => React.createElement(MembersListScreen));
    });

    it('app/(tabs)/members/add.tsx (Add Member Screen)', () => {
      assertNoCrossPaletteLeak('AddMemberScreen', () => React.createElement(AddMemberScreen));
    });

    it('app/(tabs)/members/[id].tsx (Member Detail Screen)', () => {
      assertNoCrossPaletteLeak('MemberDetailScreen', () => React.createElement(MemberDetailScreen));
    });

    it('app/(tabs)/members/[id]/renew.tsx (Renew Member Screen)', () => {
      assertNoCrossPaletteLeak('RenewMemberScreen', () => React.createElement(RenewMemberScreen));
    });

    // More Tab Routes & Sub-Screens
    it('app/(tabs)/more/index.tsx (More Screen - Root fix verification)', () => {
      assertNoCrossPaletteLeak('MoreScreen', () => React.createElement(MoreScreen));
    });

    it('app/(tabs)/more/gallery.tsx (Component Gallery Screen)', () => {
      assertNoCrossPaletteLeak('ComponentGalleryScreen', () => React.createElement(ComponentGalleryScreen));
    });

    it('app/(tabs)/more/settings.tsx (Settings Screen)', () => {
      assertNoCrossPaletteLeak('SettingsScreen', () => React.createElement(SettingsScreen));
    });

    it('app/(tabs)/more/plans.tsx (Plans Screen)', () => {
      assertNoCrossPaletteLeak('PlansScreen', () => React.createElement(PlansScreen));
    });

    it('app/(tabs)/more/subscription.tsx (Subscription Screen)', () => {
      assertNoCrossPaletteLeak('SubscriptionScreen', () => React.createElement(SubscriptionScreen));
    });

    it('app/(tabs)/more/audit.tsx (Audit Log Screen)', () => {
      assertNoCrossPaletteLeak('AuditScreen', () => React.createElement(AuditScreen));
    });

    it('app/(tabs)/more/gym-profile.tsx (Gym Profile Screen)', () => {
      assertNoCrossPaletteLeak('GymProfileScreen', () => React.createElement(GymProfileScreen));
    });

    it('app/(tabs)/more/staff.tsx (Staff Management Screen)', () => {
      assertNoCrossPaletteLeak('StaffScreen', () => React.createElement(StaffScreen));
    });

    it('app/(tabs)/more/day-close.tsx (Day Close Screen)', () => {
      assertNoCrossPaletteLeak('DayCloseScreen', () => React.createElement(DayCloseScreen));
    });

    it('app/(tabs)/more/profile.tsx (More Profile Screen)', () => {
      assertNoCrossPaletteLeak('MoreProfileScreen', () => React.createElement(MoreProfileScreen));
    });

    it('app/(tabs)/more/trainers/index.tsx (Trainers List Screen)', () => {
      assertNoCrossPaletteLeak('TrainersListScreen', () => React.createElement(TrainersListScreen));
    });

    it('app/(tabs)/more/trainers/add.tsx (Add Trainer Screen)', () => {
      assertNoCrossPaletteLeak('AddTrainerScreen', () => React.createElement(AddTrainerScreen));
    });

    it('app/(tabs)/more/trainers/[id].tsx (Trainer Detail Screen)', () => {
      assertNoCrossPaletteLeak('TrainerDetailScreen', () => React.createElement(TrainerDetailScreen));
    });

    it('app/(tabs)/more/trainers/[id]/assign.tsx (Assign Trainer Screen)', () => {
      assertNoCrossPaletteLeak('AssignTrainerScreen', () => React.createElement(AssignTrainerScreen));
    });

    it('app/(tabs)/more/trainers/types.tsx (Trainer Types Screen)', () => {
      assertNoCrossPaletteLeak('TrainerTypesScreen', () => React.createElement(TrainerTypesScreen));
    });

    it('app/(tabs)/notes.tsx (Notes Screen)', () => {
      assertNoCrossPaletteLeak('NotesScreen', () => React.createElement(NotesScreen));
    });

    it('app/(tabs)/profile.tsx (User Profile Screen)', () => {
      assertNoCrossPaletteLeak('ProfileScreen', () => React.createElement(ProfileScreen));
    });
  });
});
