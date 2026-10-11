import { create } from 'zustand';
import { GymTypeCode } from '../data/gymTypes';
import { LegalDocType } from '../data/legalDocs';

export interface RegistrationFormData {
  // Step 1: Gym details
  gymName: string;
  gymType: GymTypeCode | '';
  ownerName: string;
  email: string;

  // Step 2: Business registration (optional)
  legalIdType: LegalDocType | '';
  legalIdNumber: string;

  // Step 3: Gym address
  addressLine1: string;
  addressLine2: string;
  state: string;
  district: string;
  pincode: string;
  acceptedTerms: boolean;
}

export interface RegistrationFormStore extends RegistrationFormData {
  currentStep: number; // 1, 2, or 3

  // Actions
  setField: <K extends keyof RegistrationFormData>(field: K, value: RegistrationFormData[K]) => void;
  setStep: (step: number) => void;
  setAddress: (fields: Partial<Pick<RegistrationFormData, 'addressLine1' | 'addressLine2' | 'state' | 'district' | 'pincode'>>) => void;
  clearLegalDoc: () => void;
  resetForm: () => void;
}

const initialFormValues: RegistrationFormData = {
  gymName: '',
  gymType: '',
  ownerName: '',
  email: '',
  legalIdType: '',
  legalIdNumber: '',
  addressLine1: '',
  addressLine2: '',
  state: '',
  district: '',
  pincode: '',
  acceptedTerms: false,
};

/**
 * In-memory Zustand store for multi-step owner registration.
 * Memory-only (NEVER persisted to disk / SecureStore).
 * Preserves values when a token expires and user re-verifies via OTP.
 */
export const useRegistrationFormStore = create<RegistrationFormStore>((set) => ({
  ...initialFormValues,
  currentStep: 1,

  setField: (field, value) =>
    set((state) => ({
      ...state,
      [field]: value,
    })),

  setStep: (step) =>
    set({
      currentStep: Math.min(Math.max(1, step), 3),
    }),

  setAddress: (fields) =>
    set((state) => ({
      ...state,
      ...fields,
    })),

  clearLegalDoc: () =>
    set({
      legalIdType: '',
      legalIdNumber: '',
    }),

  resetForm: () =>
    set({
      ...initialFormValues,
      currentStep: 1,
    }),
}));
