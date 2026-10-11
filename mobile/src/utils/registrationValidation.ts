import { z } from 'zod';
import { GYM_TYPE_OPTIONS } from '../data/gymTypes';
import { validateLegalDoc, validatePincode, LegalDocType } from '../data/legalDocs';
import { isValidState } from '../data/indiaStates';
import { VALIDATION, REGISTER } from '../constants/strings';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const step1Schema = z.object({
  gymName: z
    .string()
    .trim()
    .min(2, VALIDATION.MIN_LENGTH(REGISTER.GYM_NAME_LABEL, 2))
    .max(80, VALIDATION.MAX_LENGTH(REGISTER.GYM_NAME_LABEL, 80)),
  gymType: z
    .string()
    .min(1, VALIDATION.REQUIRED(REGISTER.GYM_TYPE_LABEL))
    .refine(
      (val) => GYM_TYPE_OPTIONS.some((opt) => opt.value === val),
      VALIDATION.REQUIRED(REGISTER.GYM_TYPE_LABEL)
    ),
  ownerName: z
    .string()
    .trim()
    .min(2, VALIDATION.MIN_LENGTH(REGISTER.OWNER_NAME_LABEL, 2))
    .max(80, VALIDATION.MAX_LENGTH(REGISTER.OWNER_NAME_LABEL, 80)),
  email: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || (val.length <= 150 && EMAIL_REGEX.test(val)),
      REGISTER.EMAIL_INVALID
    ),
});

export const step2Schema = z
  .object({
    legalIdType: z.string().optional(),
    legalIdNumber: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const hasType = !!data.legalIdType && data.legalIdType.trim().length > 0;
    const hasNumber = !!data.legalIdNumber && data.legalIdNumber.trim().length > 0;

    // Optional: if neither is filled, validation passes
    if (!hasType && !hasNumber) {
      return;
    }

    if (hasType && !hasNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['legalIdNumber'],
        message: 'Document number is required when document type is chosen',
      });
      return;
    }

    if (!hasType && hasNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['legalIdType'],
        message: 'Please select the document type for this number',
      });
      return;
    }

    // Both are present, validate format
    if (hasType && hasNumber) {
      const type = data.legalIdType as LegalDocType;
      const isValid = validateLegalDoc(type, data.legalIdNumber);
      if (!isValid) {
        let msg = 'Invalid document format';
        if (type === 'UDYAM') msg = VALIDATION.UDYAM_INVALID;
        else if (type === 'GSTIN') msg = VALIDATION.GSTIN_INVALID;
        else if (type === 'NIC') msg = VALIDATION.NIC_INVALID;

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['legalIdNumber'],
          message: msg,
        });
      }
    }
  });

export const step3Schema = z.object({
  addressLine1: z
    .string()
    .trim()
    .min(5, VALIDATION.MIN_LENGTH('Address line 1', 5))
    .max(120, VALIDATION.MAX_LENGTH('Address line 1', 120)),
  addressLine2: z
    .string()
    .trim()
    .max(120, VALIDATION.MAX_LENGTH('Address line 2', 120))
    .optional(),
  state: z
    .string()
    .trim()
    .min(1, VALIDATION.STATE_REQUIRED)
    .refine((val) => isValidState(val), VALIDATION.STATE_REQUIRED),
  district: z
    .string()
    .trim()
    .min(1, VALIDATION.DISTRICT_REQUIRED)
    .max(80, VALIDATION.MAX_LENGTH('District', 80)),
  pincode: z
    .string()
    .trim()
    .refine((val) => validatePincode(val), VALIDATION.PINCODE_INVALID),
  acceptedTerms: z
    .boolean()
    .refine((val) => val === true, VALIDATION.TERMS_REQUIRED),
});

/**
 * Maps a field name to the form step it belongs to (1, 2, or 3).
 */
export function getStepForField(field: string): number {
  const normalized = field.toLowerCase();
  if (
    normalized.includes('gymname') ||
    normalized.includes('gymtype') ||
    normalized.includes('ownername') ||
    normalized.includes('email')
  ) {
    return 1;
  }
  if (normalized.includes('legalid') || normalized.includes('document')) {
    return 2;
  }
  if (
    normalized.includes('address') ||
    normalized.includes('line1') ||
    normalized.includes('line2') ||
    normalized.includes('state') ||
    normalized.includes('district') ||
    normalized.includes('pincode') ||
    normalized.includes('term')
  ) {
    return 3;
  }
  return 1;
}

/**
 * Formats 8-character gym code into XXXX-XXXX display format.
 */
export function formatGymCode(code?: string | null): string {
  if (!code) return '';
  const clean = code.trim().toUpperCase();
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return clean;
}
