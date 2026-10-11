import { KeyboardTypeOptions } from 'react-native';
import { REGISTER, VALIDATION } from '../constants/strings';

export type LegalDocType = 'UDYAM' | 'GSTIN' | 'NIC';

export interface LegalDocConfig {
  type: LegalDocType;
  label: string;
  placeholder: string;
  maxLength: number;
  keyboardType: KeyboardTypeOptions;
  autoCapitalize: 'characters' | 'none';
  autoUppercase: boolean;
  hintText: string;
  errorMessage: string;
  validator: (val?: string | null) => boolean;
}

/**
 * Validation Regex Patterns
 */
export const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const NIC_REGEX = /^\d{4,5}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/**
 * Validator functions
 */
export function validateUdyam(val?: string | null): boolean {
  if (!val) return false;
  return UDYAM_REGEX.test(val.trim());
}

export function validateGstin(val?: string | null): boolean {
  if (!val) return false;
  return GSTIN_REGEX.test(val.trim());
}

export function validateNic(val?: string | null): boolean {
  if (!val) return false;
  return NIC_REGEX.test(val.trim());
}

export function validatePincode(val?: string | null): boolean {
  if (!val) return false;
  return PINCODE_REGEX.test(val.trim());
}

export function validateLegalDoc(type: LegalDocType, val?: string | null): boolean {
  if (!val) return false;
  switch (type) {
    case 'UDYAM':
      return validateUdyam(val);
    case 'GSTIN':
      return validateGstin(val);
    case 'NIC':
      return validateNic(val);
    default:
      return false;
  }
}

/**
 * Per-type configuration for legal document inputs:
 * - label
 * - placeholder
 * - maxLength
 * - keyboardType
 * - auto-uppercase
 * - hintText
 * - validator
 */
export const LEGAL_DOC_CONFIGS: Record<LegalDocType, LegalDocConfig> = {
  UDYAM: {
    type: 'UDYAM',
    label: REGISTER.LEGAL_DOCS.UDYAM.LABEL, // 'Udyam Registration Number'
    placeholder: REGISTER.LEGAL_DOCS.UDYAM.PLACEHOLDER, // 'UDYAM-XX-00-0000000'
    maxLength: 19,
    keyboardType: 'default',
    autoCapitalize: 'characters',
    autoUppercase: true,
    hintText: REGISTER.LEGAL_DOCS.UDYAM.HINT,
    errorMessage: VALIDATION.UDYAM_INVALID,
    validator: validateUdyam,
  },
  GSTIN: {
    type: 'GSTIN',
    label: REGISTER.LEGAL_DOCS.GSTIN.LABEL, // 'GSTIN Number'
    placeholder: REGISTER.LEGAL_DOCS.GSTIN.PLACEHOLDER, // 'e.g. 27AAPFU0939F1ZV'
    maxLength: 15,
    keyboardType: 'default',
    autoCapitalize: 'characters',
    autoUppercase: true,
    hintText: REGISTER.LEGAL_DOCS.GSTIN.HINT,
    errorMessage: VALIDATION.GSTIN_INVALID,
    validator: validateGstin,
  },
  NIC: {
    type: 'NIC',
    label: REGISTER.LEGAL_DOCS.NIC.LABEL, // 'NIC Code Number'
    placeholder: REGISTER.LEGAL_DOCS.NIC.PLACEHOLDER, // 'e.g. 93110'
    maxLength: 5,
    keyboardType: 'number-pad',
    autoCapitalize: 'none',
    autoUppercase: false,
    hintText: REGISTER.LEGAL_DOCS.NIC.HINT,
    errorMessage: VALIDATION.NIC_INVALID,
    validator: validateNic,
  },
};

export interface LegalDocOption {
  label: string;
  value: LegalDocType;
}

export const LEGAL_DOC_OPTIONS: readonly LegalDocOption[] = [
  {
    label: REGISTER.LEGAL_DOCS.UDYAM.LABEL,
    value: 'UDYAM',
  },
  {
    label: REGISTER.LEGAL_DOCS.GSTIN.LABEL,
    value: 'GSTIN',
  },
  {
    label: REGISTER.LEGAL_DOCS.NIC.LABEL,
    value: 'NIC',
  },
] as const;
