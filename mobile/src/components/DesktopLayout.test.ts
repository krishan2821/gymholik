import test from 'node:test';
import assert from 'node:assert';
import { getBreakpoint, BREAKPOINTS } from '../hooks/breakpoints';
import { layout, theme } from '../theme/theme';
import { getTabsForRole, TABS_BY_ROLE, UserRole } from '../navigation/tabsByRole';
import { isPhoneMasked } from '../utils/formatters';

test('Desktop layout breakpoint rules', () => {
  // Test at 1440px
  assert.strictEqual(getBreakpoint(1440), 'desktop');

  // Test at 1024px (boundary)
  assert.strictEqual(getBreakpoint(1024), 'desktop');

  // Test below 1024 (tablet)
  assert.strictEqual(getBreakpoint(1023), 'tablet');
  assert.strictEqual(getBreakpoint(768), 'tablet');

  // Test below 640 (phone)
  assert.strictEqual(getBreakpoint(639), 'phone');
  assert.strictEqual(getBreakpoint(390), 'phone');
});

test('Desktop layout dimensions and tokens', () => {
  // Left sidebar width is 240px
  assert.strictEqual(layout.sidebarWidth, 240);

  // Content area max width is 1100px
  assert.strictEqual(layout.maxWidth.desktopContent, 1100);

  // Centered modals max width is 560px
  assert.strictEqual(layout.maxWidth.modal, 560);
});

test('Desktop Sidebar role navigation and Check-in primary action', () => {
  // Owner tabs
  const ownerTabs = getTabsForRole('OWNER');
  assert.strictEqual(ownerTabs.length, 5);
  assert.deepStrictEqual(
    ownerTabs.map((t) => t.name),
    ['index', 'members', 'attendance', 'payments', 'more']
  );

  // Check-in is highlighted as primary action
  const ownerCheckIn = ownerTabs.find((t) => t.name === 'attendance');
  assert.ok(ownerCheckIn);
  assert.strictEqual(ownerCheckIn?.isRaisedCenter, true);

  // Staff tabs
  const staffTabs = getTabsForRole('STAFF');
  assert.deepStrictEqual(
    staffTabs.map((t) => t.name),
    ['index', 'members', 'attendance', 'payments', 'more']
  );

  // Trainer tabs: My Members, Check-in, Notes, Profile (NO Home, NO Payments, NO More)
  const trainerTabs = getTabsForRole('TRAINER');
  assert.strictEqual(trainerTabs.length, 4);
  assert.deepStrictEqual(
    trainerTabs.map((t) => t.name),
    ['members', 'attendance', 'notes', 'profile']
  );
  assert.ok(!trainerTabs.some((t) => t.name === 'index'));
  assert.ok(!trainerTabs.some((t) => t.name === 'payments'));
  assert.ok(!trainerTabs.some((t) => t.name === 'more'));

  const trainerCheckIn = trainerTabs.find((t) => t.name === 'attendance');
  assert.ok(trainerCheckIn);
  assert.strictEqual(trainerCheckIn?.isRaisedCenter, true);
});

test('Trainer role phone number masking rule', () => {
  // Unmasked normal phone
  assert.strictEqual(isPhoneMasked('9876543210'), false);

  // Masked phone representations
  assert.strictEqual(isPhoneMasked('98******10'), true);
  assert.strictEqual(isPhoneMasked('+91 ******3210'), true);
  assert.strictEqual(isPhoneMasked('98765*****'), true);
});

test('Desktop table pagination calculations', () => {
  const PAGE_SIZE = 10;
  const calculateTotalPages = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));

  assert.strictEqual(calculateTotalPages(0), 1);
  assert.strictEqual(calculateTotalPages(5), 1);
  assert.strictEqual(calculateTotalPages(10), 1);
  assert.strictEqual(calculateTotalPages(11), 2);
  assert.strictEqual(calculateTotalPages(25), 3);
});

test('Desktop keyboard shortcuts logic', () => {
  // '/' focuses search when not typing in input/textarea
  const shouldFocusSearch = (key: string, activeTag: string) => {
    return key === '/' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA';
  };

  assert.strictEqual(shouldFocusSearch('/', 'BODY'), true);
  assert.strictEqual(shouldFocusSearch('/', 'DIV'), true);
  assert.strictEqual(shouldFocusSearch('/', 'INPUT'), false);
  assert.strictEqual(shouldFocusSearch('/', 'TEXTAREA'), false);
  assert.strictEqual(shouldFocusSearch('a', 'BODY'), false);

  // Esc closes modal
  const shouldCloseModal = (key: string) => key === 'Escape';
  assert.strictEqual(shouldCloseModal('Escape'), true);
  assert.strictEqual(shouldCloseModal('Enter'), false);
});
