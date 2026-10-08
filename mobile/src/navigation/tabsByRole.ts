/**
 * tabsByRole.ts
 *
 * Single source of truth for role-based navigation and tab configuration across Gymholik.
 *
 * Roles:
 * - OWNER (5 tabs): Home, Members, Check-in (raised center button), Payments, More
 * - STAFF (5 tabs): Home, Members, Check-in (raised center button), Payments, More
 * - TRAINER (4 tabs): My Members, Check-in (raised center button, assigned members only), Notes, Profile
 *
 * Forbidden access rules:
 * - OWNER/STAFF: Never see Notes or Profile tabs (or their pushed routes).
 * - TRAINER: Never see Home (dashboard money), Payments, More, Staff, Plans, Settings, Subscription, Audit.
 */

export type UserRole = 'OWNER' | 'STAFF' | 'TRAINER';

export interface TabItemConfig {
  name: string; // Expo Router screen name in (tabs)
  title: string; // User-facing tab label
  href: string | null; // Deep link / navigation target or null to hide
  isRaisedCenter?: boolean;
}

export interface RoleTabsDefinition {
  role: UserRole;
  homeRoute: string;
  allowedTabNames: readonly string[];
  forbiddenRoutes: readonly string[];
  tabs: readonly TabItemConfig[];
}

export const TABS_BY_ROLE: Record<UserRole, RoleTabsDefinition> = {
  OWNER: {
    role: 'OWNER',
    homeRoute: '/(tabs)',
    allowedTabNames: ['index', 'members', 'attendance', 'payments', 'more'],
    forbiddenRoutes: ['notes', 'profile'],
    tabs: [
      { name: 'index', title: 'Home', href: '/(tabs)' },
      { name: 'members', title: 'Members', href: '/(tabs)/members' },
      { name: 'attendance', title: 'Check-in', href: '/(tabs)/attendance', isRaisedCenter: true },
      { name: 'payments', title: 'Payments', href: '/(tabs)/payments' },
      { name: 'more', title: 'More', href: '/(tabs)/more' },
    ],
  },
  STAFF: {
    role: 'STAFF',
    homeRoute: '/(tabs)',
    allowedTabNames: ['index', 'members', 'attendance', 'payments', 'more'],
    forbiddenRoutes: ['notes', 'profile'],
    tabs: [
      { name: 'index', title: 'Home', href: '/(tabs)' },
      { name: 'members', title: 'Members', href: '/(tabs)/members' },
      { name: 'attendance', title: 'Check-in', href: '/(tabs)/attendance', isRaisedCenter: true },
      { name: 'payments', title: 'Payments', href: '/(tabs)/payments' },
      { name: 'more', title: 'More', href: '/(tabs)/more' },
    ],
  },
  TRAINER: {
    role: 'TRAINER',
    homeRoute: '/(tabs)/members',
    allowedTabNames: ['members', 'attendance', 'notes', 'profile'],
    forbiddenRoutes: [
      'index',
      'payments',
      'more',
      'staff',
      'plans',
      'settings',
      'subscription',
      'audit',
    ],
    tabs: [
      { name: 'members', title: 'My Members', href: '/(tabs)/members' },
      { name: 'attendance', title: 'Check-in', href: '/(tabs)/attendance', isRaisedCenter: true },
      { name: 'notes', title: 'Notes', href: '/(tabs)/notes' },
      { name: 'profile', title: 'Profile', href: '/(tabs)/profile' },
    ],
  },
};

/**
 * Normalizes any string to a recognized UserRole, defaulting to OWNER if unknown.
 */
export function normalizeRole(role: string | null | undefined): UserRole {
  if (role === 'TRAINER') return 'TRAINER';
  if (role === 'STAFF') return 'STAFF';
  return 'OWNER';
}

/**
 * Returns the default home landing route for a given user role.
 */
export function getHomeRouteForRole(role: string | null | undefined): string {
  const norm = normalizeRole(role);
  return TABS_BY_ROLE[norm].homeRoute;
}

/**
 * Returns the visible tab items configuration for a role.
 */
export function getTabsForRole(role: string | null | undefined): readonly TabItemConfig[] {
  const norm = normalizeRole(role);
  return TABS_BY_ROLE[norm].tabs;
}

/**
 * Returns whether a tab or route name is allowed for the given role.
 */
export function isRouteAllowedForRole(
  role: string | null | undefined,
  routeName: string
): boolean {
  const norm = normalizeRole(role);
  const def = TABS_BY_ROLE[norm];

  // If in forbidden list, definitely disallowed
  if (def.forbiddenRoutes.includes(routeName)) {
    return false;
  }

  // Must be in allowed tab names
  return def.allowedTabNames.includes(routeName);
}

/**
 * Returns the href for an expo-router tab Screen, or null if hidden for that role.
 */
export function getTabHrefForRole(
  role: string | null | undefined,
  tabName: string
): string | null {
  const norm = normalizeRole(role);
  const def = TABS_BY_ROLE[norm];
  const tabItem = def.tabs.find((t) => t.name === tabName);
  return tabItem ? tabItem.href : null;
}

/**
 * Returns the display title for a tab item based on the role.
 */
export function getTabTitleForRole(
  role: string | null | undefined,
  tabName: string
): string {
  const norm = normalizeRole(role);
  const def = TABS_BY_ROLE[norm];
  const tabItem = def.tabs.find((t) => t.name === tabName);
  if (tabItem) return tabItem.title;
  // Fallbacks
  if (tabName === 'members') return norm === 'TRAINER' ? 'My Members' : 'Members';
  if (tabName === 'attendance') return 'Check-in';
  if (tabName === 'index') return 'Home';
  if (tabName === 'payments') return 'Payments';
  if (tabName === 'more') return 'More';
  if (tabName === 'notes') return 'Notes';
  if (tabName === 'profile') return 'Profile';
  return tabName;
}
