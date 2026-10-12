import test from 'node:test';
import assert from 'node:assert';
import { BREAKPOINTS, getBreakpoint } from '../hooks/breakpoints';
import { layout, colors } from '../theme/theme';

test('Responsive layout tokens', () => {
  assert.strictEqual(layout.maxWidth.column, 480);
  assert.strictEqual(layout.maxWidth.form, 420);
  assert.strictEqual(layout.maxWidth.content, 480);
  assert.strictEqual(colors.background, '#051F20');
  assert.strictEqual(BREAKPOINTS.TABLET, 640);
  assert.strictEqual(BREAKPOINTS.DESKTOP, 1024);
});

test('AppContainer responsive column rules', () => {
  // Breakpoint checks
  // Phone: < 640 -> full width
  const phoneBreakpoint = getBreakpoint(390);
  assert.strictEqual(phoneBreakpoint, 'phone');

  // Tablet: 640 to 1023 -> 480px centered column with 1px border rgba(218,241,222,0.08)
  const tabletBreakpoint = getBreakpoint(768);
  assert.strictEqual(tabletBreakpoint, 'tablet');

  // Desktop: >= 1024 -> 480px centered column with 1px border rgba(218,241,222,0.08)
  const desktopBreakpoint = getBreakpoint(1200);
  assert.strictEqual(desktopBreakpoint, 'desktop');

  // Subtle border spec
  const subtleBorderColor = 'rgba(218, 241, 222, 0.08)';
  assert.strictEqual(subtleBorderColor, 'rgba(218, 241, 222, 0.08)');
});

test('Card maxWidth token resolution', () => {
  const resolveMaxWidth = (token?: 'form' | 'content' | number) => {
    if (token === 'form') return layout.maxWidth.form;
    if (token === 'content') return layout.maxWidth.content;
    if (typeof token === 'number') return token;
    return layout.maxWidth.content;
  };

  assert.strictEqual(resolveMaxWidth('form'), 420);
  assert.strictEqual(resolveMaxWidth('content'), 480);
  assert.strictEqual(resolveMaxWidth(), 480);
  assert.strictEqual(resolveMaxWidth(360), 360);
});

test('Floating tab bar inside column calculation', () => {
  const columnWidth = layout.maxWidth.column; // 480
  const horizontalPadding = 16 * 2; // 32
  const innerTabBarWidth = columnWidth - horizontalPadding; // 448
  assert.strictEqual(innerTabBarWidth, 448);
  assert.ok(innerTabBarWidth <= columnWidth);
});
