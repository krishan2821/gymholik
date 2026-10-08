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
  PASSWORD: 'Password',
  CONFIRM_PASSWORD: 'Confirm password',
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
  GYM_CODE: 'Gym code',
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
  PASSWORD_CONFIRM: 'Passwords do not match',
  PASSWORD_MIN: 'Password must be at least 8 characters',
  PASSWORD_NUMBER: 'Password must contain at least one number',
  TERMS_REQUIRED: 'You must agree to the terms to continue',
  POSITIVE_NUMBER: 'Enter a positive number',
  INTEGER: 'Enter a whole number',
} as const;

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export const TABS = {
  DASHBOARD: 'Dashboard',
  MEMBERS: 'Members',
  ATTENDANCE: 'Attendance',
  PAYMENTS: 'Payments',
  MORE: 'More',
} as const;

// ─── Login ────────────────────────────────────────────────────────────────────
export const LOGIN = {
  TITLE: 'Welcome back',
  SUBTITLE: 'Sign in to continue',
  GYM_CODE_LABEL: 'Gym code',
  PHONE_LABEL: 'Mobile number',
  PHONE_HELPER: 'This number is your login ID.',
  FORGOT_PASSWORD: 'Forgot password?',
  SUBMIT: 'Sign In',
  REGISTER_PROMPT: 'New gym?',
  REGISTER_LINK: 'Create an account',
  FORGOT_SHEET_TITLE: 'Forgot password?',
  FORGOT_SHEET_MESSAGE: 'Please contact your gym owner to reset your password.',
  FORGOT_SHEET_NOTE: 'Your gym owner can reset passwords from the admin panel.',
} as const;

// ─── Register ─────────────────────────────────────────────────────────────────
export const REGISTER = {
  TITLE: 'Create your gym account',
  SUBTITLE: 'Start your 14-day free trial. No card required.',
  GYM_NAME_LABEL: 'Gym name',
  GYM_NAME_PLACEHOLDER: 'e.g. FitZone Gym',
  OWNER_NAME_LABEL: 'Your name',
  OWNER_NAME_PLACEHOLDER: 'e.g. Rahul Sharma',
  PHONE_HELPER: 'This number will be your login ID.',
  TERMS: 'I agree to the Terms and Privacy Policy',
  SUBMIT: 'Start free trial',
  LOGIN_PROMPT: 'Already have an account?',
  LOGIN_LINK: 'Sign in',
} as const;

// ─── Super Admin login ────────────────────────────────────────────────────────
export const SUPER_ADMIN_LOGIN = {
  TITLE: 'Super Admin',
  SUBTITLE: 'Restricted access. Authorised personnel only.',
  SUBMIT: 'Sign In',
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
  MENU_SETTINGS: 'Gym settings',
  MENU_SUBSCRIPTION: 'Subscription',
  MENU_CHANGE_PASSWORD: 'Change password',
  MENU_LOGOUT: 'Sign out',
  LOGOUT_CONFIRM_TITLE: 'Sign out?',
  LOGOUT_CONFIRM_MSG: 'You will need to sign in again to access your gym.',
  LOGOUT_BTN: 'Sign out',
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
  MODAL_TITLE: 'Add staff member',
  NAME_LABEL: 'Full name',
  PHONE_LABEL: 'Mobile number',
  PASSWORD_LABEL: 'Temporary password',
  SUBMIT: 'Add staff member',
  REMOVE: 'Remove',
  REMOVE_CONFIRM_TITLE: 'Remove staff member?',
  REMOVE_CONFIRM_MSG: (name: string) => `${name} will no longer be able to sign in.`,
  EMPTY: 'No staff added yet.',
  LOAD_ERROR: 'Failed to load staff.',
  ADD_ERROR: 'Could not add staff member. Please try again.',
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
  DETAIL_TITLE: 'Trainer Details',
  ASSIGN_MEMBERS_TITLE: 'Assign Members',
  MANAGE_TYPES_BTN: 'Manage Types',
  APPROVE_BTN: 'Approve',
  REJECT_BTN: 'Reject',
  DEACTIVATE_BTN: 'Deactivate Trainer',
  DEACTIVATE_CONFIRM_TITLE: 'Deactivate Trainer?',
  DEACTIVATE_CONFIRM_MSG: (name: string) =>
    `Deactivating ${name} will automatically end all their active member assignments.`,
  REJECT_CONFIRM_TITLE: 'Reject Trainer?',
  REJECT_CONFIRM_MSG: (name: string) =>
    `Are you sure you want to reject ${name}'s registration request?`,
  APPROVE_MODAL_TITLE: 'Select Trainer Types',
  APPROVE_MODAL_DESC: 'Select at least one specialty or type for this trainer.',
  APPROVE_CONFIRM_BTN: 'Confirm & Approve',
  ADD_TYPE_SHORTCUT: '+ Add new type',
  EDIT_TYPES_BTN: 'Edit Specialties',
  ASSIGNED_MEMBERS: 'Assigned Members',
  ASSIGN_MEMBERS_BTN: 'Assign Members',
  NO_MEMBERS_ASSIGNED: 'No members assigned to this trainer yet.',
  REMOVE_ASSIGNMENT: 'Remove',
  REMOVE_CONFIRM_TITLE: 'End Assignment?',
  REMOVE_CONFIRM_MSG: (memberName: string) =>
    `Remove ${memberName} from this trainer?`,
  DEACTIVATED_BANNER_TITLE: 'Deactivated Trainer Detected',
  DEACTIVATED_BANNER_MSG:
    'One or more trainers are inactive. Reassign their members to keep them covered.',
  REASSIGN_BTN: 'Reassign Members',
  REASSIGN_MODAL_TITLE: 'Reassign Members',
  REASSIGN_DESC: 'Move all active members from one trainer to another.',
  SELECT_SOURCE_TRAINER: 'From Trainer',
  SELECT_TARGET_TRAINER: 'To Trainer',
  REASSIGN_CONFIRM_BTN: 'Confirm Reassignment',
  STATUS_PENDING: 'Pending',
  STATUS_ACTIVE: 'Active',
  STATUS_INACTIVE: 'Inactive',
  LOAD_ERROR: 'Failed to load trainers.',
  EMPTY: 'No trainers found.',
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

// ─── Change password ──────────────────────────────────────────────────────────
export const CHANGE_PASSWORD = {
  SCREEN_TITLE: 'Change password',
  OLD_PASSWORD: 'Current password',
  NEW_PASSWORD: 'New password',
  CONFIRM_PASSWORD: 'Confirm new password',
  SUBMIT: 'Update password',
  SUCCESS: 'Password updated successfully.',
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
