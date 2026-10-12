import test from 'node:test';
import assert from 'node:assert';
import { BREAKPOINTS, resolveBreakpoint } from '../utils/breakpoints';

test('Breakpoints configuration', () => {
  assert.strictEqual(BREAKPOINTS.TABLET, 640);
  assert.strictEqual(BREAKPOINTS.DESKTOP, 1024);
});

test('Breakpoint classification logic', () => {
  // Phone: below 640
  assert.strictEqual(resolveBreakpoint(320).breakpoint, 'phone');
  assert.strictEqual(resolveBreakpoint(320).isPhone, true);
  assert.strictEqual(resolveBreakpoint(390).breakpoint, 'phone');
  assert.strictEqual(resolveBreakpoint(480).breakpoint, 'phone');
  assert.strictEqual(resolveBreakpoint(639).breakpoint, 'phone');
  assert.strictEqual(resolveBreakpoint(639).isPhone, true);

  // Tablet: 640 to 1023
  assert.strictEqual(resolveBreakpoint(640).breakpoint, 'tablet');
  assert.strictEqual(resolveBreakpoint(640).isTablet, true);
  assert.strictEqual(resolveBreakpoint(768).breakpoint, 'tablet');
  assert.strictEqual(resolveBreakpoint(768).isTablet, true);
  assert.strictEqual(resolveBreakpoint(1023).breakpoint, 'tablet');
  assert.strictEqual(resolveBreakpoint(1023).isTablet, true);

  // Desktop: 1024 and above
  assert.strictEqual(resolveBreakpoint(1024).breakpoint, 'desktop');
  assert.strictEqual(resolveBreakpoint(1024).isDesktop, true);
  assert.strictEqual(resolveBreakpoint(1440).breakpoint, 'desktop');
  assert.strictEqual(resolveBreakpoint(1440).isDesktop, true);
  assert.strictEqual(resolveBreakpoint(2560).breakpoint, 'desktop');
  assert.strictEqual(resolveBreakpoint(2560).isDesktop, true);
});
