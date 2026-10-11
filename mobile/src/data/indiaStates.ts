/**
 * Official 36 States and Union Territories of India.
 * Synchronized with backend IndianStates.java.
 */
export const INDIA_STATES = [
  // 28 States
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // 8 Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export type IndiaState = (typeof INDIA_STATES)[number];

export interface StateOption {
  label: string;
  value: string;
}

/**
 * Options array formatted for SearchableSelect components, sorted alphabetically.
 */
export const INDIA_STATE_OPTIONS: readonly StateOption[] = [...INDIA_STATES]
  .sort((a, b) => a.localeCompare(b))
  .map((state) => ({
    label: state,
    value: state,
  }));

const NORMALIZED_STATE_MAP = new Map<string, string>();
INDIA_STATES.forEach((state) => {
  NORMALIZED_STATE_MAP.set(state.trim().toLowerCase(), state);
});

/**
 * Validates whether a given state string matches one of the 36 recognized Indian States or UTs.
 */
export function isValidState(state?: string | null): boolean {
  if (!state) return false;
  return NORMALIZED_STATE_MAP.has(state.trim().toLowerCase());
}

/**
 * Returns canonical title-cased name for the state, or null if invalid.
 */
export function canonicalStateName(state?: string | null): string | null {
  if (!state) return null;
  return NORMALIZED_STATE_MAP.get(state.trim().toLowerCase()) ?? null;
}
