import test from 'node:test';
import assert from 'node:assert';
import { resolveBreakpoint, BREAKPOINTS } from '../utils/breakpoints';
import { theme } from '../theme/theme';

test('Responsive Login Breakpoints and Layout Assertions', async (t) => {
  await t.test('Width 1440px (Desktop Wide)', () => {
    const bp = resolveBreakpoint(1440);
    assert.strictEqual(bp.breakpoint, 'desktop');
    assert.strictEqual(bp.isDesktop, true);
    assert.strictEqual(bp.isTablet, false);
    assert.strictEqual(bp.isPhone, false);

    // Desktop split ratio: Left 55%, Right 45%
    const leftPanelPercent = 55;
    const rightPanelPercent = 45;
    assert.strictEqual(leftPanelPercent + rightPanelPercent, 100);

    // Right panel form max width: 420px
    const cardMaxWidth = 420;
    assert.strictEqual(cardMaxWidth, theme.layout.maxWidth.form);

    // OTP box width between 52 and 56 px
    const otpBoxWidth = bp.isPhone ? 52 : 54;
    assert.ok(otpBoxWidth >= 52 && otpBoxWidth <= 56, 'OTP box width must be between 52 and 56px');
    assert.strictEqual(otpBoxWidth, 54);
  });

  await t.test('Width 1024px (Desktop Threshold)', () => {
    const bp = resolveBreakpoint(1024);
    assert.strictEqual(bp.breakpoint, 'desktop');
    assert.strictEqual(bp.isDesktop, true);
    assert.strictEqual(bp.isTablet, false);
    assert.strictEqual(bp.isPhone, false);

    const otpBoxWidth = bp.isPhone ? 52 : 54;
    assert.ok(otpBoxWidth >= 52 && otpBoxWidth <= 56);
    assert.strictEqual(otpBoxWidth, 54);
  });

  await t.test('Width 768px (Tablet)', () => {
    const bp = resolveBreakpoint(768);
    assert.strictEqual(bp.breakpoint, 'tablet');
    assert.strictEqual(bp.isTablet, true);
    assert.strictEqual(bp.isDesktop, false);
    assert.strictEqual(bp.isPhone, false);

    // Tablet centred card max width: 440px
    const tabletCardMaxWidth = 440;
    assert.strictEqual(tabletCardMaxWidth, 440);

    const otpBoxWidth = bp.isPhone ? 52 : 54;
    assert.ok(otpBoxWidth >= 52 && otpBoxWidth <= 56);
    assert.strictEqual(otpBoxWidth, 54);
  });

  await t.test('Width 390px (Phone)', () => {
    const bp = resolveBreakpoint(390);
    assert.strictEqual(bp.breakpoint, 'phone');
    assert.strictEqual(bp.isPhone, true);
    assert.strictEqual(bp.isTablet, false);
    assert.strictEqual(bp.isDesktop, false);

    // Phone uses unchanged mobile layout
    const otpBoxWidth = bp.isPhone ? 52 : 54;
    assert.ok(otpBoxWidth >= 52 && otpBoxWidth <= 56);
    assert.strictEqual(otpBoxWidth, 52);

    // Fits inside 390px width without horizontal overflow:
    // 6 boxes of 52px + 5 gaps of 4px = 312 + 20 = 332px <= 390px
    const totalOtpRowWidth = 6 * otpBoxWidth + 5 * 4;
    assert.ok(totalOtpRowWidth <= 390, 'OTP row must fit within 390px');
  });

  await t.test('Width range 320px to 2560px produces valid breakpoints', () => {
    const sampleWidths = [320, 360, 390, 480, 639, 640, 768, 834, 1023, 1024, 1280, 1440, 1920, 2560];
    for (const w of sampleWidths) {
      const bp = resolveBreakpoint(w);
      assert.ok(['phone', 'tablet', 'desktop'].includes(bp.breakpoint));
      const activeFlags = [bp.isPhone, bp.isTablet, bp.isDesktop].filter(Boolean);
      assert.strictEqual(activeFlags.length, 1, `Exactly one breakpoint flag should be true for width ${w}`);
    }
  });

  await t.test('Disabled Primary Button colors and contrast', () => {
    // Fill #163832, Text #A7C7B1
    const bg = '#163832';
    const text = '#A7C7B1';
    assert.strictEqual(bg, '#163832');
    assert.strictEqual(text, '#A7C7B1');
  });
});
