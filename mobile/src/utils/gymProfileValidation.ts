import { z } from 'zod';
import { GYM_TYPE_OPTIONS } from '../data/gymTypes';
import { validateLegalDoc, validatePincode, LegalDocType } from '../data/legalDocs';
import { isValidState } from '../data/indiaStates';
import { VALIDATION, REGISTER } from '../constants/strings';

export const updateGymProfileSchema = z
  .object({
    name: z
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
    legalIdType: z.string().optional().nullable(),
    legalIdNumber: z.string().trim().optional().nullable(),
    line1: z
      .string()
      .trim()
      .min(5, VALIDATION.MIN_LENGTH('Address line 1', 5))
      .max(120, VALIDATION.MAX_LENGTH('Address line 1', 120)),
    line2: z
      .string()
      .trim()
      .max(120, VALIDATION.MAX_LENGTH('Address line 2', 120))
      .optional()
      .nullable(),
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
  })
  .superRefine((data, ctx) => {
    const hasType = !!data.legalIdType && data.legalIdType.trim().length > 0;
    const hasNumber = !!data.legalIdNumber && data.legalIdNumber.trim().length > 0;

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

export type UpdateGymProfileFormData = z.infer<typeof updateGymProfileSchema>;
