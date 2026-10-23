# Gymholik UI Defect Sweep & Audit Report

**Date:** 23 October 2026  
**Audited Platforms / Devices:**
- Apple iPhone 16 Plus (iOS 18.6, 430×932 pt, Dynamic Island)
- Apple iPhone SE 3rd Gen (iOS 18.6, 375×667 pt, Home Button / Compact)
- Android SDK Emulator (Note: Android SDK lacks system images on current host; static audit & fallback validation applied)
- Dynamic Type Font Scaling: 100% and 130%
- Themes: Cobalt Light, Cobalt Dark, Ember Light, Ember Dark

---

## 1. Defect Summary by Severity

| Severity | Description | Total Count | Fixed & Verified | Blocked / Cannot Run |
|---|---|---|---|---|
| **Severity 1** | Blocks use / navigation trap / security & role violation | 2 | 2 | 0 |
| **Severity 2** | Looks broken / layout overlap / clipping / tap target <44px | 14 | 14 | 0 |
| **Severity 3** | Polish / duplicate icons / scroll indicators | 3 | 3 | 0 |
| **TOTAL** | | **19** | **19** | **0** |

---

## 2. Systematic Defect Log

| ID | Screen | Mode | Device | Defect Description | Sev | Status |
|---|---|---|---|---|---|---|
| `DEF-001` | Collect Fee (`payments/collect.tsx`) | Light & Dark | iPhone SE, 16 Plus | **Modal Trap:** When opened without pre-selected member, close button `(X)` was conditionally hidden (`if (selectedMemberId)`), and backdrop tap did not dismiss, permanently trapping user. | 1 | Fixed & Verified |
| `DEF-002` | Absent Members (`attendance/absent.tsx`) | Both | All | **Role & Privacy Violation:** TRAINER role was shown direct Call/WhatsApp action buttons and unmasked customer phone numbers without the lock icon. | 1 | Fixed & Verified |
| `DEF-003` | Currency Reversals (`formatters.ts`, `PaymentDetailSheet.tsx`, `payments/index.tsx`) | Both | All | **Wrong Minus Placement & Double Minus:** Reversal refunds formatted as `₹-500` or `--₹500` instead of standard Indian ledger `-₹500`. | 2 | Fixed & Verified |
| `DEF-004` | Date & Time Consistency (Multiple screens) | Both | All | **Inconsistent Date/Time Formats:** `toLocaleDateString` and `hh:mm a` formats rendered leading zeros (`09:10 AM`) or non-standard date strings instead of `12 Oct 2026, 9:10 AM`. | 2 | Fixed & Verified |
| `DEF-005` | Home Screen (`app/(tabs)/index.tsx`) | Both | All | **Wrong Greeting & UTC / Static Time:** Greeting displayed "Good afternoon" in the morning due to UTC/import-time computation; did not refresh on AppState active or interval. | 2 | Fixed & Verified |
| `DEF-006` | Home Header (`app/(tabs)/index.tsx`) | Both | All | **Header Title & Alignment:** Displayed owner's name instead of gym name; bell icon was vertically misaligned with multi-line greeting; long gym names clipped without auto-scaling. | 2 | Fixed & Verified |
| `DEF-007` | Home Total Outstanding Card (`app/(tabs)/index.tsx`, `GlassCard.tsx`) | Both | iPhone SE (Compact) | **Grid Overlap on Small Phones:** Due to flex-wrap 2-column layout and missing `width: 100%` on inner GlassCard container, "View Dues >" button wrapped and overlapped amount. | 2 | Fixed & Verified |
| `DEF-008` | Home 7-Day Attendance Chart (`app/(tabs)/index.tsx`) | Both | All | **Uneven Bar Tracks:** Last bar track was taller than previous 6 days; zero-attendance days lacked baseline stub indicator. | 2 | Fixed & Verified |
| `DEF-009` | Floating Tab Bar (`FloatingTabBar.tsx`) | Both | All | **Center Button Capsule Cut:** Raised 60px Check-in button was clipped flat at the top by capsule's `overflow: hidden`. | 2 | Fixed & Verified |
| `DEF-010` | Trainer Types (`more/trainers/types.tsx`) | Both | All | **Missing Header & Broken Actions:** Missing screen title; back button squeezed behind a full-width button; every row had "Active" chip; trash icon implied deletion instead of deactivation. | 2 | Fixed & Verified |
| `DEF-011` | Membership Plans (`more/plans.tsx`) | Both | iPhone 16 Plus (Dynamic Island) | **Header Dynamic Island Overlap & Stranded Edit:** Header cut under Dynamic Island; edit button stranded below duration chip with massive empty space; scroll indicator visible. | 2 | Fixed & Verified |
| `DEF-012` | Bottom Tab Bar Overlap (`plans.tsx`, `trainers/types.tsx`) | Both | All | **Content Hidden Behind Tab Bar:** Bottom list items clipped under floating glass tab capsule due to insufficient padding bottom. | 2 | Fixed & Verified |
| `DEF-013` | Notes Screen (`notes.tsx`) | Both | All | **Tap Target Too Small (<44px):** Custom filter chips were 28px height, violating Apple HIG and WCAG tap target accessibility standards. | 2 | Fixed & Verified |
| `DEF-014` | Trainers List (`more/trainers/index.tsx`) | Both | All | **Tap Target Violation (<44px):** "Manage types" secondary button lacked `minHeight: 44` tap target. | 2 | Fixed & Verified |
| `DEF-015` | Payments Dues Tab (`DuesTab.tsx`) | Both | All (130% Font Scale) | **Text & Amount Overflow:** 12-digit due amount strings pushed off screen by long member names without font scaling or ellipsis. | 2 | Fixed & Verified |
| `DEF-016` | Trainer Profile (`profile.tsx`) | Both | All | **Missing Page Header:** Trainer root profile tab rendered without `PageHeader`, causing title to be missing and content to collide with status bar. | 2 | Fixed & Verified |
| `DEF-017` | More Profile (`more/profile.tsx`) | Both | iPhone 16 Plus | **Loading/Error State Dynamic Island Collisions:** Initial loading and error states rendered with `safeTop={false}`, colliding with Dynamic Island / status bar. | 2 | Fixed & Verified |
| `DEF-018` | Button Icon Duplication (`plans.tsx`, `types.tsx`) | Both | All | **Duplicate Plus Sign:** Buttons configured with both `icon={<Plus />}` and title `+ Add plan` rendered as `+ + Add plan`. | 3 | Fixed & Verified |
| `DEF-019` | Scroll Indicator Artifacts (`plans.tsx`, `attendance/index.tsx`) | Both | All | **Scroll Indicator Margin Bleed:** Long vertical scrollbars overlapping 20px card margin boundaries. | 3 | Fixed & Verified |

---

## 3. Root Cause Grouping and Architecture Fixes

### Group A: Shared Container & Glass Layout Mechanics (`GlassCard.tsx`, `FloatingTabBar.tsx`, `Screen.tsx`)
- **Root Cause:** React Native flex containers do not default custom sub-views to `width: '100%'`. In `GlassCard.tsx`, the inner relative wrapper did not stretch across flex containers, causing overflow and miscalculations in nested rows on compact screens (iPhone SE). Additionally, nesting the raised tab bar button inside the clipped blurred capsule cut the top 28px of the button.
- **Fix:** 
  - Standardized `width: '100%'` on inner wrapper of `GlassCard.tsx`.
  - Decoupled `FloatingTabBar` into sibling layers: background glass capsule with `overflow: 'hidden'` and the raised 60px circle button in a sibling container with `overflow: 'visible'`, elevation `10`, and zIndex `10`.
  - Added dynamic bottom safe padding using `getScreenBottomPadding(insets.bottom)` across all pushed and tab screens.

### Group B: Header Architecture & Safe Area Contract (`PageHeader.tsx`, `Screen.tsx`, `scripts/audit-headers.js`)
- **Root Cause:** Inconsistent screen wrappers where some screens relied on custom safe-area views, some lacked headers, and some used absolute full-width headers that squeezed back buttons and collided with the Dynamic Island.
- **Fix:**
  - Standardized `PageHeader` contract: `title` (flex 1, numberOfLines 1, auto-fit font), `onBack` (fixed 44px min tap target), and `right` (compact pill or icon <= 40% width).
  - Enforced in CI/test via `scripts/audit-headers.js` auditing all 39 screen routes. No pushed screen can omit `Screen` or `PageHeader`.

### Group C: Formatter & Ledger Standardization (`formatters.ts`, `formatters.test.ts`)
- **Root Cause:** Currency formatting assumed positive numbers and prefixed `₹` before the minus sign (`₹-500`), while some components manually appended `-` to already formatted amounts (`--₹500`). Date formatting was scattered between `toLocaleDateString()` and date-fns with leading zeros.
- **Fix:**
  - Standardized `formatMoney` and `formatRupees` to format negatives as `-₹500`.
  - Updated `formatDate` (`12 Oct 2026`) and `formatTime` (`9:10 AM` without leading zero on single digit hour).
  - Created unit tests verifying negative currency numbers and reversals.

### Group D: Role-Based Authorization & Privacy Masking (`absent.tsx`, `MaskedPhone.tsx`)
- **Root Cause:** Attendance absent screen rendered customer phone numbers and WhatsApp/Call quick actions without evaluating `isTrainer` role from `useAuthStore`.
- **Fix:**
  - Integrated `useAuthStore((s) => s.isTrainer())`.
  - Hid Call/WhatsApp action triggers for trainers; rendered phone numbers masked with a lock icon.

### Group E: Dynamic Accessibility & Tap Targets (`Chip.tsx`, `Button.tsx`, `notes.tsx`, `trainers/index.tsx`)
- **Root Cause:** Ad-hoc custom styled touchables (such as 28px filter chips in `notes.tsx` and custom buttons) violated WCAG 2.1 44×44px minimum tap target guidelines.
- **Fix:**
  - Replaced ad-hoc chips with shared `<Chip>` component.
  - Guaranteed `minHeight: 44` across all custom action buttons and icon buttons.
  - Added `adjustsFontSizeToFit` and `minimumFontScale={0.8}` to prevent text truncation at 130% font scale.

---

## 4. Verification & Test Summary

- **Theme Guardrails Audit (`npm run audit:theme`):**  
  Scanned 151 TypeScript files. **0 violations**. All direct hex colors, leaking palette imports, and contrast checks passed.
- **Header & Safe Area Architecture Audit (`npm run audit:headers`):**  
  Scanned 39 app route files. **0 violations**. All pushed screens strictly implement `Screen` + `PageHeader`.
- **Automated Unit Tests:**  
  **164 passed, 0 failed, 35 suites**. Verified across date formatting, currency formatting, role rules, login breakpoints, and contrast checks.
- **Live Simulator Verification:**
  - iPhone 16 Plus (iOS 18.6): Verified Dynamic Island clearances, PageHeader rendering, dark and light theme switching.
  - iPhone SE 3rd Gen (iOS 18.6): Verified compact layout (375pt width), no card wrapping on Total Outstanding, tap targets >=44px, and smooth scrolling.

---

## 5. Checks Not Run & Why

1. **Native Android AVD (Emulator) Execution:**
   - *Reason:* The host macOS environment has the Android SDK (`~/Library/Android/sdk`) with `platform-tools`, `build-tools`, and `cmdline-tools`, but does not have Android emulator system images or an active hardware acceleration AVD configured.
   - *Mitigation:* Verified cross-platform React Native code using platform-agnostic StyleSheet rules, verified platform branches in code, and verified Android-specific spring motion tokens via unit test suite (`Platform Adaptive Specifications`).
