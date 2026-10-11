import { REGISTER } from '../constants/strings';

export type GymTypeCode =
  | 'COMMERCIAL'
  | 'BOUTIQUE_STUDIO'
  | 'CROSSFIT_BOX'
  | 'BODYBUILDING_POWERLIFTING'
  | 'PREMIUM_LUXURY'
  | 'WOMEN_ONLY'
  | 'HOME_GYM';

export interface GymTypeOption {
  readonly label: string;
  readonly value: GymTypeCode;
}

/**
 * Gym type options in exact order and wording specified by product requirements:
 * 1 Commercial Gyms
 * 2 Boutique Fitness Studios
 * 3 CrossFit Boxes
 * 4 Bodybuilding & Powerlifting Gyms
 * 5 Luxury / Premium Gyms
 * 6 Women-Only Gyms
 * 7 Home Gyms
 *
 * Shows the friendly label to users and sends the enum code to the API.
 */
export const GYM_TYPE_OPTIONS: readonly GymTypeOption[] = [
  {
    label: REGISTER.GYM_TYPES.COMMERCIAL, // 'Commercial Gyms'
    value: 'COMMERCIAL',
  },
  {
    label: REGISTER.GYM_TYPES.BOUTIQUE_STUDIO, // 'Boutique Fitness Studios'
    value: 'BOUTIQUE_STUDIO',
  },
  {
    label: REGISTER.GYM_TYPES.CROSSFIT_BOX, // 'CrossFit Boxes'
    value: 'CROSSFIT_BOX',
  },
  {
    label: REGISTER.GYM_TYPES.BODYBUILDING_POWERLIFTING, // 'Bodybuilding & Powerlifting Gyms'
    value: 'BODYBUILDING_POWERLIFTING',
  },
  {
    label: REGISTER.GYM_TYPES.PREMIUM_LUXURY, // 'Luxury / Premium Gyms'
    value: 'PREMIUM_LUXURY',
  },
  {
    label: REGISTER.GYM_TYPES.WOMEN_ONLY, // 'Women-Only Gyms'
    value: 'WOMEN_ONLY',
  },
  {
    label: REGISTER.GYM_TYPES.HOME_GYM, // 'Home Gyms'
    value: 'HOME_GYM',
  },
] as const;

export const GYM_TYPE_LABEL_TO_CODE: Record<string, GymTypeCode> = {
  'Commercial Gyms': 'COMMERCIAL',
  'Boutique Fitness Studios': 'BOUTIQUE_STUDIO',
  'CrossFit Boxes': 'CROSSFIT_BOX',
  'Bodybuilding & Powerlifting Gyms': 'BODYBUILDING_POWERLIFTING',
  'Luxury / Premium Gyms': 'PREMIUM_LUXURY',
  'Women-Only Gyms': 'WOMEN_ONLY',
  'Home Gyms': 'HOME_GYM',
};

export const GYM_TYPE_CODE_TO_LABEL: Record<GymTypeCode, string> = {
  COMMERCIAL: 'Commercial Gyms',
  BOUTIQUE_STUDIO: 'Boutique Fitness Studios',
  CROSSFIT_BOX: 'CrossFit Boxes',
  BODYBUILDING_POWERLIFTING: 'Bodybuilding & Powerlifting Gyms',
  PREMIUM_LUXURY: 'Luxury / Premium Gyms',
  WOMEN_ONLY: 'Women-Only Gyms',
  HOME_GYM: 'Home Gyms',
};

export function getGymTypeLabel(code?: string | null): string {
  if (!code) return '';
  return GYM_TYPE_CODE_TO_LABEL[code as GymTypeCode] || code;
}

export function getGymTypeCode(label?: string | null): GymTypeCode | undefined {
  if (!label) return undefined;
  return GYM_TYPE_LABEL_TO_CODE[label.trim()];
}
