/**
 * All user-facing strings for the Gymholik mobile app.
 *
 * Every string that appears on screen lives here so a Hindi (or any other)
 * translation can be swapped in later by replacing this file with a locale-
 * specific version.
 *
 * Naming convention:
 *   SCREEN_ELEMENT  or  SHARED_ELEMENT
 *
 * Do NOT put internal/dev comments here — only strings the user will read.
 */

// ─── App-wide ─────────────────────────────────────────────────────────────────
export const APP_NAME = 'Gymholik';
export const APP_TAGLINE = 'Manage your gym, all in one place';

// ─── Common actions ───────────────────────────────────────────────────────────
export const COMMON = {
  SAVE: 'Save',
  CANCEL: 'Cancel',
  DONE: 'Done',
  CLOSE: 'Close',
  ADD: 'Add',
  EDIT: 'Edit',
  DELETE: 'Delete',
  RETRY: 'Try again',
  LOADING: 'Loading…',
  SEARCH: 'Search',
  BACK: 'Go back',
  CONFIRM: 'Confirm',
  SHARE: 'Share',
  SUBMIT: 'Submit',
  SELECT: 'Select',
  GRANT_PERMISSION: 'Grant permission',
  OPEN_SETTINGS: 'Open settings',
  GOT_IT: 'Got it',
  YES_DELETE: 'Yes, delete',
  ERROR: 'Error',
  SUCCESS: 'Saved',
} as const;

// ─── Common errors ────────────────────────────────────────────────────────────
export const ERRORS = {
  GENERIC: 'Something went wrong. Please try again.',
  NETWORK: 'Cannot connect to the server. Check your internet connection.',
  PERMISSION_DENIED: 'You do not have permission to view this page.',
  LOAD_FAILED: (screen: string) => `Failed to load ${screen}. Tap to try again.`,
  REASON_REQUIRED: 'A reason is required.',
  SELECT_MEMBER: 'Please select a member first.',
  AMOUNT_ZERO: 'Amount must be greater than zero.',
  AMOUNT_EXCEEDS_DUE: 'Amount cannot be more than the outstanding balance.',
  OVERPAY: 'Cannot pay more than the total fee.',
} as const;

// ─── Common field labels ──────────────────────────────────────────────────────
export const FIELDS = {
  NAME: 'Full name',
  PHONE: 'Mobile number',
  PHONE_PLACEHOLDER: '98765 43210',
  GENDER: 'Gender',
  ADDRESS: 'Address',
  ADDRESS_PLACEHOLDER: 'Optional',
  PAYMENT_MODE: 'Payment mode',
  AMOUNT_PAID: 'Amount paid (₹)',
  AMOUNT_PAID_PLACEHOLDER: 'e.g. 1000',
  NOTES: 'Notes (optional)',
  PLAN: 'Membership plan',
  SELECT_PLAN: 'Select a plan',
  DURATION_DAYS: 'Duration (days)',
  PRICE: 'Price (₹)',
  CITY: 'City',
  CITY_OPTIONAL: 'City (optional)',
} as const;

// ─── Common validation messages ───────────────────────────────────────────────
export const VALIDATION = {
  REQUIRED: (field: string) => `${field} is required`,
  MIN_LENGTH: (field: string, n: number) => `${field} must be at least ${n} characters`,
  MAX_LENGTH: (field: string, n: number) => `${field} is too long (max ${n} characters)`,
  PHONE_INVALID: 'Enter a valid 10-digit mobile number starting with 6–9',
  PHONE_DUPLICATE: 'This mobile number is already registered. Try signing in.',
  TERMS_REQUIRED: 'You must agree to the terms to continue',
  POSITIVE_NUMBER: 'Enter a positive number',
  INTEGER: 'Enter a whole number',
  UDYAM_INVALID: 'Enter a valid Udyam number (e.g. UDYAM-MH-12-0012345)',
  GSTIN_INVALID: 'Enter a valid 15-character GSTIN (e.g. 27AAPFU0939F1ZV)',
  NIC_INVALID: 'NIC code must be 4 or 5 digits',
  PINCODE_INVALID: 'Enter a valid 6-digit Indian PIN code',
  STATE_REQUIRED: 'Please select a state or union territory',
  DISTRICT_REQUIRED: 'Please select or enter a district',
} as const;

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export const TABS = {
  DASHBOARD: 'Dashboard',
  MEMBERS: 'Members',
  ATTENDANCE: 'Attendance',
  PAYMENTS: 'Payments',
  MORE: 'More',
} as const;

// ─── Login (Single-screen OTP) ────────────────────────────────────────────────
export const LOGIN = {
  TITLE: 'Welcome back',
  SUBTITLE: 'Enter your mobile number to continue',
  PHONE_LABEL: 'Mobile number',
  PHONE_PREFIX: '+91',
  PHONE_PLACEHOLDER: '9876543210',
  GET_OTP: 'Get OTP',
  STAFF_HELPER: 'Trainer or staff? Sign in with the number your gym owner added.',
  CHANGE_NUMBER: 'Change number',
  OTP_SECTION_LABEL: 'Enter 6-digit OTP',
  RESEND_OTP: 'Resend OTP',
  RESEND_IN: (formattedTime: string) => `Resend in ${formattedTime}`,
  VERIFY_AND_PROCEED: 'Verify & Proceed',
  DEV_OTP_HINT: 'Dev OTP: 123456',
  OTP_SENT_TOAST: 'OTP sent to your mobile number',
  VERIFY_SUCCESS_TOAST: 'Mobile number verified',
  ERRORS: {
    INVALID_OTP: 'Invalid or expired OTP. Please try again or request a new code.',
    RATE_LIMITED: (retryText?: string) =>
      retryText
        ? `Too many attempts. Please try again in ${retryText}.`
        : 'Too many attempts. Please wait a moment and try again.',
    NETWORK: 'Cannot connect to the server. Please check your internet connection and try again.',
    ACCOUNT_INACTIVE: 'Your account is inactive. Please contact your gym owner',
    SUBSCRIPTION_EXPIRED:
      'Your gym subscription has expired. Please contact your gym owner to renew.',
    GYM_SUSPENDED:
      'This gym account has been suspended. Please contact support for assistance.',
    GENERIC: 'Something went wrong. Please try again.',
  },
} as const;

// ─── Register (OTP-verified Owner Registration) ───────────────────────────────
export const REGISTER = {
  TITLE: 'Create your gym account',
  SUBTITLE: 'Your number is verified. Start your 14-day free trial. No card required.',
  VERIFIED_PHONE_LABEL: 'Verified mobile number',
  VERIFIED_BADGE: 'Verified',
  GYM_NAME_LABEL: 'Gym name',
  GYM_NAME_PLACEHOLDER: 'e.g. FitZone Gym',
  OWNER_NAME_LABEL: 'Your name',
  OWNER_NAME_PLACEHOLDER: 'e.g. Rahul Sharma',
  EMAIL_LABEL: 'Email (optional)',
  EMAIL_PLACEHOLDER: 'e.g. rahul@fitzone.in',
  EMAIL_INVALID: 'Enter a valid email address',
  TERMS_PREFIX: 'I agree to the ',
  TERMS_LINK: 'Terms and Privacy Policy',
  TERMS_REQUIRED: 'You must agree to the Terms and Privacy Policy to continue',
  SUBMIT: 'Start free trial',
  TRAINER_STAFF_NOTE:
    'Trainer or staff? Ask your gym owner to add your number, then sign in again.',
  USE_DIFFERENT_NUMBER: 'Use a different number',
  BACK_CONFIRM_TITLE: 'Cancel registration?',
  BACK_CONFIRM_MESSAGE:
    'Going back will cancel your registration and you will need to verify your mobile number again.',
  BACK_CONFIRM_STAY: 'Continue setup',
  BACK_CONFIRM_LEAVE: 'Go back',
  STEP_OF: (current: number, total: number) => `Step ${current} of ${total}`,
  GYM_TYPE_LABEL: 'Gym type',
  GYM_TYPE_PLACEHOLDER: 'Select gym type',
  GYM_TYPES: {
    COMMERCIAL: 'Commercial Gyms',
    BOUTIQUE_STUDIO: 'Boutique Fitness Studios',
    CROSSFIT_BOX: 'CrossFit Boxes',
    BODYBUILDING_POWERLIFTING: 'Bodybuilding & Powerlifting Gyms',
    PREMIUM_LUXURY: 'Luxury / Premium Gyms',
    WOMEN_ONLY: 'Women-Only Gyms',
    HOME_GYM: 'Home Gyms',
  },
  LEGAL_DOC_SECTION_TITLE: 'Business / Legal verification',
  LEGAL_DOC_TYPE_LABEL: 'Document type (optional)',
  LEGAL_DOC_PLACEHOLDER: 'Select document type',
  LEGAL_DOC_NUMBER_LABEL: 'Document number',
  LEGAL_DOCS: {
    UDYAM: {
      LABEL: 'Udyam Registration Number',
      PLACEHOLDER: 'UDYAM-XX-00-0000000',
      HINT: 'Format: UDYAM-XX-00-0000000 (XX is 2-letter state code)',
    },
    GSTIN: {
      LABEL: 'GSTIN Number',
      PLACEHOLDER: 'e.g. 27AAPFU0939F1ZV',
      HINT: '15-character Goods and Services Tax Identification Number',
    },
    NIC: {
      LABEL: 'NIC Code Number',
      PLACEHOLDER: 'e.g. 93110',
      HINT: '4 or 5-digit National Industrial Classification code',
    },
  },
  ADDRESS: {
    SECTION_TITLE: 'Gym Address',
    LINE1_LABEL: 'Address line 1',
    LINE1_PLACEHOLDER: 'Building, shop number, street name',
    LINE2_LABEL: 'Address line 2 (optional)',
    LINE2_PLACEHOLDER: 'Landmark, floor, area',
    PINCODE_LABEL: 'PIN code',
    PINCODE_PLACEHOLDER: '6-digit PIN code',
    STATE_LABEL: 'State / Union Territory',
    STATE_PLACEHOLDER: 'Select state',
    DISTRICT_LABEL: 'District',
    DISTRICT_PLACEHOLDER: 'Select district',
    LOOKUP_SUGGESTION: (district: string, state: string) => `Auto-filled: ${district}, ${state}`,
  },
  SEARCHABLE_SELECT: {
    SEARCH_PLACEHOLDER: 'Search…',
    NO_RESULTS: 'No results found',
    OTHER_ROW: 'Other',
    OTHER_INPUT_PLACEHOLDER: 'Type custom value…',
    CONFIRM_OTHER: 'Use this',
  },
  DISTRICT_DATASET_MISSING:
    'District dataset file is not available. Please enter your district manually using Other.',
  STEP_1_TITLE: 'Gym details',
  STEP_1_SUBTITLE: 'Tell us about your fitness center',
  STEP_2_TITLE: 'Business registration (optional)',
  STEP_2_SUBTITLE: 'Add your business identity document or skip for now',
  STEP_3_TITLE: 'Gym address',
  STEP_3_SUBTITLE: 'Where is your gym located?',
  GYM_NAME_PLACEHOLDER_NEW: 'Enter Gym Name',
  SKIP_FOR_NOW: 'Skip for now',
  LEGAL_DOC_HELPER_TEXT:
    'You can add this later from Gym profile. We do not verify it yet.',
  ADDRESS_LINE1_PLACEHOLDER: 'Building, shop name or street',
  ADDRESS_LINE2_PLACEHOLDER: 'City and landmark',
  COMPLETE_REGISTRATION_BTN: 'Complete Registration',
  NEXT_BTN: 'Next',
  BACK_BTN: 'Back',
  SESSION_EXPIRED_MSG: 'Your session expired. Please verify your number again',
  PHONE_VERIFIED_LABEL: (phone: string) => `${phone} verified`,
  TRAINER_STAFF_BOTTOM_NOTE:
    'Trainer or staff? Ask your gym owner to add your mobile number, then sign in.',
  WELCOME_SHEET: {
    TITLE: 'Your gym is ready',
    SUBTITLE:
      'Congratulations! Your gym account has been set up with a 14-day free trial.',
    CODE_LABEL: 'YOUR UNIQUE GYM CODE',
    COPY_BTN: 'Copy Code',
    COPIED_TOAST: 'Gym code copied to clipboard',
    DASHBOARD_BTN: 'Go to Dashboard',
  },
  ERRORS: {
    TOKEN_EXPIRED:
      'Your session expired. Please verify your number again.',
    ALREADY_REGISTERED:
      'This mobile number is already registered. Please sign in with your mobile number.',
    NETWORK:
      'Cannot connect to the server. Please check your internet connection and try again.',
    GENERIC: 'Could not complete registration. Please try again.',
  },
} as const;

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const DASHBOARD = {
  GREETING: 'Dashboard',
  ACTIVE_MEMBERS: 'Active members',
  TODAY_CHECKINS: "Today's check-ins",
  NEW_THIS_MONTH: 'New this month',
  EXPIRING_SOON: 'Expiring in 5 days',
  TODAY_COLLECTION: "Today's collection",
  MONTH_COLLECTION: 'This month',
  TOTAL_DUE: 'Total outstanding',
  LOAD_ERROR: 'Failed to load dashboard data.',
} as const;

// ─── Members ──────────────────────────────────────────────────────────────────
export const MEMBERS = {
  SCREEN_TITLE: 'Members',
  SEARCH_PLACEHOLDER: 'Search by name or phone…',
  ADD_MEMBER: 'Add member',
  SECTION_BASIC: 'Basic details',
  SECTION_PLAN: 'Membership plan',
  LABEL_SELECT_PLAN: 'Select plan',
  LABEL_AMOUNT_PAID: 'Amount paid now (₹)',
  DUE_REMAINING: (amt: string) => `Outstanding balance: ₹${amt}`,
  PLAN_EXPIRES: (date: string) => `Expires on: ${date}`,
  PLAN_TOTAL_FEE: (amt: string) => `Total fee: ₹${amt}`,
  SAVE_MEMBER: 'Save member',
  EMPTY: 'No members found.',
  LOAD_ERROR: 'Failed to load members.',
  FILTER_ALL: 'All',
  FILTER_ACTIVE: 'Active',
  FILTER_EXPIRED: 'Expired',
  FILTER_EXPIRING: 'Expiring soon',
  STATUS_ACTIVE: 'Active',
  STATUS_EXPIRED: 'Expired',
  STATUS_EXPIRING: 'Expiring soon',
  DUE_BADGE: (amt: string) => `Owes ₹${amt}`,
} as const;

// ─── Member profile ───────────────────────────────────────────────────────────
export const MEMBER_PROFILE = {
  SCREEN_TITLE: 'Member profile',
  SECTION_PERSONAL: 'Personal details',
  SECTION_MEMBERSHIP: 'Membership',
  SECTION_PAYMENTS: 'Payment history',
  RENEW: 'Renew membership',
  COLLECT: 'Collect payment',
  DELETE: 'Delete member',
  DELETE_CONFIRM_TITLE: 'Delete member?',
  DELETE_CONFIRM_MSG: 'This will permanently delete the member and all their records. This cannot be undone.',
  DELETE_SUCCESS: 'Member deleted.',
  JOINED: (date: string) => `Joined ${date}`,
  PLAN_NAME: (name: string) => `Plan: ${name}`,
  EXPIRY: (date: string) => `Expires ${date}`,
  CHECKIN_COUNT: (n: number) => `${n} check-ins`,
  NO_MEMBERSHIP: 'No active membership.',
  NO_PAYMENTS: 'No payment history.',
  LOAD_ERROR: 'Failed to load member details.',
} as const;

// ─── Renew membership ─────────────────────────────────────────────────────────
export const RENEW = {
  SCREEN_TITLE: 'Renew membership',
  HEADING: (name: string) => `Renew — ${name}`,
  SECTION_PLAN: 'New plan',
  PLAN_STARTS: (date: string) => `Starts on: ${date}`,
  PLAN_EXPIRES: (date: string) => `Expires on: ${date}`,
  PLAN_FEE: (amt: string) => `Total fee: ₹${amt}`,
  DUE_REMAINING: (amt: string) => `Outstanding balance: ₹${amt}`,
  SUBMIT: 'Renew membership',
  ERROR_TITLE: 'Could not renew',
} as const;

// ─── Attendance ───────────────────────────────────────────────────────────────
export const ATTENDANCE = {
  SCREEN_TITLE: 'Attendance',
  SCAN_BTN: 'Scan QR code',
  ABSENT_BTN: 'View absent members',
  TODAY_COUNT: (n: number) => `${n} check-in${n === 1 ? '' : 's'} today`,
  EMPTY: 'No check-ins recorded today.',
  LOAD_ERROR: 'Failed to load attendance.',
  SEARCH_PLACEHOLDER: 'Search to check in (name or phone)…',
  SEARCHING: 'Searching…',
  NO_RESULTS: 'No members found.',
  SUCCESS_BANNER: 'Checked in successfully',
  EXPIRED_BADGE: 'EXPIRED',
  WARNING_TITLE: 'Membership Expired',
  WARNING_DESC: (name: string) => `${name}'s membership has expired.`,
  ALLOW_ANYWAY: 'Allow anyway',
  RENEW_NOW: 'Renew now',
  ALREADY_CHECKED_IN: (name: string) => `${name} has already checked in today.`,
  ALREADY_CHECKED_IN_TITLE: 'Already checked in',
} as const;

// ─── Absent members ───────────────────────────────────────────────────────────
export const ABSENT = {
  SCREEN_TITLE: 'Absent members',
  EMPTY: 'Everyone checked in today!',
  LOAD_ERROR: 'Failed to load absent members.',
  LAST_VISIT: (text: string) => `Last visit: ${text}`,
  NEVER_VISITED: 'Never visited',
  DAYS_AGO: (n: number) => `${n} day${n === 1 ? '' : 's'} ago`,
  WHATSAPP_MSG: (name: string) =>
    `Hi ${name}, we haven't seen you at the gym recently. Hope everything is well! Looking forward to seeing you back. — Gymholik`,
} as const;

// ─── QR Scanner ───────────────────────────────────────────────────────────────
export const SCANNER = {
  CAMERA_TITLE: 'Camera access required',
  CAMERA_DESC: 'Camera access is needed to scan member QR codes at the entrance.',
  AIM_HINT: 'Point the camera at a member\'s QR card',
  CHECKED_IN: 'Checked in',
  CHECK_IN_FAILED: 'Check-in failed. Please try again.',
} as const;

// ─── Payments ─────────────────────────────────────────────────────────────────
export const PAYMENTS = {
  SCREEN_TITLE: 'Payments',
  HEADER_TOTAL: 'Total collected',
  FILTER_TODAY: 'Today',
  FILTER_WEEK: 'This week',
  FILTER_MONTH: 'This month',
  FILTER_ALL_MODE: 'All methods',
  FILTER_CASH: 'Cash',
  FILTER_UPI: 'UPI',
  FILTER_CARD: 'Card',
  EMPTY: 'No payments in this period.',
  LOAD_ERROR: 'Failed to load payments.',
  REVERSE_TITLE: 'Reverse payment',
  REVERSE_PROMPT: 'Enter a reason for reversing this payment:',
  REVERSE_BTN: 'Reverse',
  LOAD_MORE: 'Load more',
} as const;

// ─── Collect payment ──────────────────────────────────────────────────────────
export const COLLECT = {
  SCREEN_TITLE: 'Collect payment',
  SELECT_MEMBER_PLACEHOLDER: 'Search member by name…',
  OUTSTANDING: (amt: string) => `Outstanding balance: ₹${amt}`,
  SUCCESS_TITLE: 'Payment recorded',
  RECEIPT_NO: (no: string) => `Receipt no: ${no}`,
  SHARE_RECEIPT: 'Share receipt',
  COLLECT_ANOTHER: 'Collect another',
  SUBMIT: 'Record payment',
} as const;

// ─── Pending dues ─────────────────────────────────────────────────────────────
export const DUES = {
  SCREEN_TITLE: 'Pending dues',
  HEADER_TOTAL: 'Total outstanding',
  COLLECT_BTN: 'Collect payment',
  WHATSAPP_MSG: (name: string, amt: string) =>
    `Hi ${name}, your membership fee of ₹${amt} is due. Please make the payment at your earliest convenience. — Gymholik`,
  EMPTY: 'No pending dues. All caught up!',
  LOAD_ERROR: 'Failed to load pending dues.',
} as const;

// ─── More / Menu ──────────────────────────────────────────────────────────────
export const MORE = {
  SCREEN_TITLE: 'More',
  SECTION_MANAGE: 'Manage',
  SECTION_ACCOUNT: 'Account',
  MENU_PLANS: 'Membership plans',
  MENU_STAFF: 'Staff',
  MENU_TRAINERS: 'Trainers',
  MENU_AUDIT: 'Audit log',
  MENU_GYM_PROFILE: 'Gym profile',
  MENU_SETTINGS: 'Gym settings',
  MENU_SUBSCRIPTION: 'Subscription',
  MENU_LOGOUT: 'Sign out',
  LOGOUT_CONFIRM_TITLE: 'Sign out?',
  LOGOUT_CONFIRM_MSG: 'You will need to sign in again to access your gym.',
  LOGOUT_BTN: 'Sign out',
  GYM_CODE_LABEL: 'Gym code',
  COPY_CODE: 'Copy',
  SHARE_CODE: 'Share',
  GYM_CODE_COPIED: 'Gym code copied',
  GYM_CODE_SHARE_TEXT: (gymName: string, code: string) =>
    `${gymName} on Gymholik. Gym code: ${code}`,
} as const;

// ─── Gym profile ──────────────────────────────────────────────────────────────
export const GYM_PROFILE = {
  SCREEN_TITLE: 'Gym profile',
  SECTION_DETAILS: 'Gym details',
  SECTION_LEGAL: 'Legal & Business verification',
  SECTION_ADDRESS: 'Gym address',
  GYM_NAME_LABEL: 'Gym name',
  GYM_TYPE_LABEL: 'Gym type',
  GYM_CODE_LABEL: 'Gym code',
  LEGAL_DOC_TYPE_LABEL: 'Document type',
  LEGAL_DOC_NUMBER_LABEL: 'Document number',
  LEGAL_VERIFIED_BADGE: 'Verified',
  LEGAL_UNVERIFIED_BADGE: 'Not verified',
  NO_LEGAL_DOC: 'No business document added',
  SHOW_DOC_NUMBER: 'Show',
  HIDE_DOC_NUMBER: 'Hide',
  EDIT_BTN: 'Edit profile',
  EDIT_MODAL_TITLE: 'Edit Gym Profile',
  SAVE_CHANGES_BTN: 'Save changes',
  CANCEL_BTN: 'Cancel',
  IMMUTABLE_CODE_HINT: 'Gym code cannot be changed',
  LOAD_ERROR: 'Failed to load gym profile.',
  UPDATE_SUCCESS: 'Gym profile updated successfully.',
  COPY_BTN: 'Copy',
  SHARE_BTN: 'Share',
  COPIED_TOAST: 'Gym code copied',
  SHARE_TEXT: (gymName: string, code: string) =>
    `${gymName} on Gymholik. Gym code: ${code}`,
} as const;

// ─── Complete profile banner ──────────────────────────────────────────────────
export const COMPLETE_GYM_PROFILE_BANNER = {
  TITLE: 'Complete your gym profile',
  SUBTITLE: 'Add your gym type and address details to complete setup.',
  ACTION: 'Complete profile',
} as const;


// ─── Manage plans ─────────────────────────────────────────────────────────────
export const PLANS = {
  SCREEN_TITLE: 'Membership plans',
  ADD_BTN: 'Add plan',
  MODAL_ADD_TITLE: 'Add new plan',
  MODAL_EDIT_TITLE: 'Edit plan',
  NAME_LABEL: 'Plan name',
  NAME_PLACEHOLDER: 'e.g. Monthly — Regular',
  DURATION_LABEL: 'Duration (days)',
  DURATION_PLACEHOLDER: 'e.g. 30',
  PRICE_LABEL: 'Price (₹)',
  PRICE_PLACEHOLDER: 'e.g. 1500',
  SAVE_BTN: 'Save plan',
  UPDATE_BTN: 'Update plan',
  CREATE_BTN: 'Create plan',
  EMPTY: 'No plans yet. Add one to get started.',
  LOAD_ERROR: 'Failed to load plans.',
  SAVE_ERROR: 'Could not save the plan. Please try again.',
  PLAN_DETAIL: (days: number, price: string) => `${days} days · ₹${price}`,
} as const;

// ─── Staff management ─────────────────────────────────────────────────────────
export const STAFF = {
  SCREEN_TITLE: 'Staff',
  ADD_BTN: 'Add staff',
  MODAL_TITLE: 'Add staff',
  EDIT_MODAL_TITLE: 'Edit staff',
  NAME_LABEL: 'Name',
  NAME_PLACEHOLDER: 'e.g. Vikram Singh',
  PHONE_LABEL: 'Mobile number',
  PHONE_PREFIX: '+91',
  PHONE_PLACEHOLDER: '9876543210',
  PHONE_ALREADY_REGISTERED: 'This number is already registered',
  SUBMIT: 'Add staff',
  SAVE_CHANGES: 'Save changes',
  STATUS_ACTIVE: 'Active',
  STATUS_INACTIVE: 'Inactive',
  DEACTIVATE_BTN: 'Deactivate',
  REACTIVATE_BTN: 'Reactivate',
  DEACTIVATE_CONFIRM_TITLE: 'Deactivate staff member?',
  DEACTIVATE_CONFIRM_MSG: (name: string) =>
    `${name} will be signed out immediately and will no longer be able to sign in.`,
  REACTIVATE_CONFIRM_TITLE: 'Reactivate staff member?',
  REACTIVATE_CONFIRM_MSG: (name: string) =>
    `${name} will be able to sign in again with their mobile number using an OTP.`,
  PHONE_CHANGE_CONFIRM_TITLE: 'Change mobile number?',
  PHONE_CHANGE_CONFIRM_MSG: (name: string) =>
    `Changing ${name}'s mobile number will sign them out of all active sessions immediately.`,
  SUCCESS_SHEET_TITLE: 'Staff added',
  SUCCESS_SHEET_DESC:
    'Staff added. They can sign in with this mobile number using an OTP.',
  SHARE_WHATSAPP_BTN: 'Share on WhatsApp',
  DONE_BTN: 'Done',
  WHATSAPP_INVITE_MSG: (name: string, gymName: string) =>
    `Hi ${name}, I added you to ${gymName} on Gymholik. Download the app and sign in with this mobile number.`,
  EMPTY: 'No staff added yet.',
  LOAD_ERROR: 'Failed to load staff.',
  ADD_ERROR: 'Could not add staff member. Please try again.',
  UPDATE_ERROR: 'Could not update staff member. Please try again.',
} as const;

// ─── Gym settings ─────────────────────────────────────────────────────────────
export const SETTINGS = {
  SCREEN_TITLE: 'Gym settings',
  SECTION_GENERAL: 'General',
  GYM_NAME_LABEL: 'Gym name',
  CITY_LABEL: 'City',
  SECTION_CHECKIN: 'Check-in rules',
  ALLOW_EXPIRED_LABEL: 'Allow check-in after expiry',
  ALLOW_EXPIRED_DESC: 'Members with an expired plan can still check in.',
  REMINDER_LABEL: 'Expiry reminder (days before)',
  STAFF_FULL_PHONE_LABEL: 'Let front-desk staff see full mobile numbers',
  STAFF_FULL_PHONE_WARNING:
    'Warning: Front-desk staff will see complete unmasked contact numbers.',
  SAVE_BTN: 'Save settings',
  LOAD_ERROR: 'Failed to load settings.',
  SAVE_SUCCESS: 'Settings saved.',
} as const;

// ─── Trainers management ──────────────────────────────────────────────────────
export const TRAINERS = {
  SCREEN_TITLE: 'Trainers',
  ADD_SCREEN_TITLE: 'Add trainer',
  DETAIL_TITLE: 'Trainer Details',
  ASSIGN_MEMBERS_TITLE: 'Assign Members',
  ADD_BTN: 'Add trainer',
  MANAGE_TYPES_BTN: 'Manage Types',
  NAME_LABEL: 'Name',
  NAME_PLACEHOLDER: 'e.g. Arjun Mehta',
  PHONE_LABEL: 'Mobile number',
  PHONE_PREFIX: '+91',
  PHONE_PLACEHOLDER: '9876543210',
  PHONE_ALREADY_REGISTERED: 'This number is already registered',
  TYPES_LABEL: 'Trainer types',
  TYPES_HELPER: 'Select at least one specialty for this trainer.',
  TYPES_REQUIRED_ERROR: 'Select at least one trainer type',
  ADD_NEW_TYPE_LINK: 'Add new type',
  ADD_NEW_TYPE_MODAL_TITLE: 'Add new trainer type',
  ADD_NEW_TYPE_PLACEHOLDER: 'e.g. CrossFit, Zumba, HIIT',
  ASSIGN_MEMBERS_NOW_LABEL: 'Assign members now (optional)',
  ASSIGN_MEMBERS_NOW_BTN: 'Assign members now',
  SELECTED_MEMBERS_COUNT: (count: number) =>
    `${count} member${count === 1 ? '' : 's'} selected`,
  SUCCESS_SHEET_TITLE: 'Trainer added',
  SUCCESS_SHEET_DESC:
    'Trainer added. They can sign in with this mobile number using an OTP.',
  SHARE_WHATSAPP_BTN: 'Share on WhatsApp',
  DONE_BTN: 'Done',
  WHATSAPP_INVITE_MSG: (name: string, gymName: string) =>
    `Hi ${name}, I added you to ${gymName} on Gymholik. Download the app and sign in with this mobile number.`,
  EDIT_DETAILS_BTN: 'Edit details',
  EDIT_NAME_TYPES_TITLE: 'Edit trainer details',
  CHANGE_PHONE_BTN: 'Change mobile number',
  CHANGE_PHONE_MODAL_TITLE: 'Change mobile number',
  CHANGE_PHONE_WARNING:
    'Changing the mobile number will immediately sign this trainer out of all devices.',
  CHANGE_PHONE_CONFIRM_TITLE: 'Change mobile number?',
  CHANGE_PHONE_CONFIRM_MSG: (name: string) =>
    `${name} will be signed out of all active sessions immediately and must sign in with the new number.`,
  SAVE_CHANGES_BTN: 'Save changes',
  DEACTIVATE_BTN: 'Deactivate trainer',
  REACTIVATE_BTN: 'Reactivate trainer',
  DEACTIVATE_CONFIRM_TITLE: 'Deactivate trainer?',
  DEACTIVATE_CONFIRM_MSG: (name: string) =>
    `Deactivating ${name} will sign them out immediately and end all their active member assignments.`,
  REACTIVATE_CONFIRM_TITLE: 'Reactivate trainer?',
  REACTIVATE_CONFIRM_MSG: (name: string) =>
    `Reactivating ${name} will allow them to sign in again with their mobile number.`,
  ADD_TYPE_SHORTCUT: '+ Add new type',
  EDIT_TYPES_BTN: 'Edit specialties',
  ASSIGNED_MEMBERS: 'Assigned Members',
  ASSIGN_MEMBERS_BTN: 'Assign members',
  NO_MEMBERS_ASSIGNED: 'No members assigned to this trainer yet.',
  REMOVE_ASSIGNMENT: 'Remove',
  REMOVE_CONFIRM_TITLE: 'End Assignment?',
  REMOVE_CONFIRM_MSG: (memberName: string) =>
    `Remove ${memberName} from this trainer?`,
  DEACTIVATED_BANNER_TITLE: 'Trainer Deactivated',
  DEACTIVATED_BANNER_MSG:
    'This trainer is inactive. Reassign any members left without a trainer to an active trainer.',
  DEACTIVATED_LIST_BANNER_DESC: (names: string) =>
    `${names} is inactive. Members left without a trainer can be reassigned below.`,
  REASSIGN_BTN: 'Reassign members',
  REASSIGN_MODAL_TITLE: 'Reassign Members',
  REASSIGN_DESC: 'Move members from an inactive or previous trainer to an active trainer.',
  SELECT_SOURCE_TRAINER: 'From Trainer',
  SELECT_TARGET_TRAINER: 'To Trainer',
  REASSIGN_CONFIRM_BTN: 'Confirm Reassignment',
  STATUS_ACTIVE: 'Active',
  STATUS_INACTIVE: 'Inactive',
  ASSIGNED_COUNT_LABEL: (count: number) =>
    `${count} assigned member${count === 1 ? '' : 's'}`,
  LOAD_ERROR: 'Failed to load trainers.',
  EMPTY: 'No trainers added yet.',
} as const;

// ─── Trainer Types ────────────────────────────────────────────────────────────
export const TRAINER_TYPES = {
  SCREEN_TITLE: 'Trainer Types',
  ADD_BTN: 'Add Type',
  MODAL_ADD_TITLE: 'Add Trainer Type',
  MODAL_EDIT_TITLE: 'Edit Trainer Type',
  NAME_LABEL: 'Type Name',
  NAME_PLACEHOLDER: 'e.g. CrossFit Trainer, Yoga Trainer',
  SAVE_BTN: 'Save',
  UPDATE_BTN: 'Update',
  DEACTIVATE_BTN: 'Deactivate',
  DEACTIVATE_CONFIRM_TITLE: 'Deactivate Type?',
  DEACTIVATE_CONFIRM_MSG: (name: string) =>
    `Are you sure you want to deactivate "${name}"?`,
  EMPTY: 'No trainer types found.',
  LOAD_ERROR: 'Failed to load trainer types.',
} as const;

// ─── Assign Members ───────────────────────────────────────────────────────────
export const ASSIGN_MEMBERS = {
  SCREEN_TITLE: 'Assign Members',
  SEARCH_PLACEHOLDER: 'Search member by name or phone…',
  PT_FEE_LABEL: 'Personal Training Fee (₹) - Optional',
  PT_FEE_PLACEHOLDER: 'e.g. 3000',
  SESSIONS_LABEL: 'Total Sessions - Optional',
  SESSIONS_PLACEHOLDER: 'e.g. 12',
  NOTES_LABEL: 'Notes - Optional',
  NOTES_PLACEHOLDER: 'e.g. Weight loss focus, evening slot',
  CONFIRM_TITLE: 'Confirm Assignment',
  CONFIRM_MSG: (count: number, trainerName: string) =>
    `Assign ${count} member${count > 1 ? 's' : ''} to ${trainerName}?`,
  SUBMIT_BTN: (count: number) => `Assign ${count} Member${count > 1 ? 's' : ''}`,
  ALREADY_ASSIGNED_THIS: 'Already assigned to this trainer',
  ALREADY_ASSIGNED_OTHER: (trainerName: string) => `Assigned to ${trainerName}`,
  NO_MEMBERS_FOUND: 'No members match your search.',
} as const;

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const AUDIT_LOGS = {
  SCREEN_TITLE: 'Audit Log',
  EMPTY: 'No audit records found.',
  LOAD_ERROR: 'Failed to load audit logs.',
} as const;

// ─── Subscription ─────────────────────────────────────────────────────────────
export const SUBSCRIPTION = {
  SCREEN_TITLE: 'Subscription',
  PLAN_NAME: 'Gymholik Premium',
  STATUS_LABEL: 'Status',
  VALID_TILL_LABEL: 'Valid until',
  DAYS_LEFT_LABEL: 'Days remaining',
  HOW_TO_RENEW_TITLE: 'How to renew',
  HOW_TO_RENEW_DESC:
    'Scan the UPI QR code below and pay the renewal fee. Then send a payment screenshot to our WhatsApp support to activate your plan.',
  UPI_ID: 'gymholik@upi',
  WHATSAPP_BTN: 'Send screenshot on WhatsApp',
  WHATSAPP_MSG: (gymId: string) =>
    `Hi Gymholik Support, I would like to renew the subscription for Gym ID: ${gymId}`,
} as const;

// ─── Empty / Error states ─────────────────────────────────────────────────────
export const STATES = {
  EMPTY_TITLE: 'Nothing here yet',
  ERROR_TITLE: 'Something went wrong',
  ERROR_RETRY: 'Try again',
} as const;
