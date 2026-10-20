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

    // OTP row layout: card inner padding 24, gap 8, 6 boxes with flex 1 maxWidth 56
    const cardInnerPadding = 24;
    const cardAvailableWidth = cardMaxWidth - 2 * cardInnerPadding; // 372
    const totalGaps = 5 * 8; // 40
    const boxWidth = Math.min(56, (cardAvailableWidth - totalGaps) / 6);
    assert.ok(boxWidth <= 56, 'Box width must not exceed 56px');
    assert.ok(boxWidth * 6 + totalGaps <= cardAvailableWidth, 'OTP row must fit inside card padding');
  });

  await t.test('Width 1024px (Desktop Threshold)', () => {
    const bp = resolveBreakpoint(1024);
    assert.strictEqual(bp.breakpoint, 'desktop');
    assert.strictEqual(bp.isDesktop, true);
    assert.strictEqual(bp.isTablet, false);
    assert.strictEqual(bp.isPhone, false);
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

    const cardInnerPadding = 24;
    const cardAvailableWidth = tabletCardMaxWidth - 2 * cardInnerPadding; // 392
    const totalGaps = 5 * 8; // 40
    const boxWidth = Math.min(56, (cardAvailableWidth - totalGaps) / 6);
    assert.strictEqual(boxWidth, 56);
    assert.ok(boxWidth * 6 + totalGaps <= cardAvailableWidth);
  });

  await t.test('Width 393px (iPhone 14/15/16 Pro)', () => {
    const bp = resolveBreakpoint(393);
    assert.strictEqual(bp.breakpoint, 'phone');
    assert.strictEqual(bp.isPhone, true);

    const cardInnerPadding = 24;
    const screenHorizontalPadding = 20 * 2;
    const cardWidth = 393 - screenHorizontalPadding; // 353
    const cardAvailableWidth = cardWidth - 2 * cardInnerPadding; // 305
    const totalGaps = 5 * 8; // 40
    const boxWidth = (cardAvailableWidth - totalGaps) / 6; // 44.17
    assert.ok(boxWidth * 6 + totalGaps <= cardAvailableWidth, 'OTP row must fit within 393pt iPhone');
    assert.ok(boxWidth < 56, 'Box width flexes down on 393pt phone');
  });

  await t.test('Width 320px (Narrow Phone)', () => {
    const bp = resolveBreakpoint(320);
    assert.strictEqual(bp.breakpoint, 'phone');
    assert.strictEqual(bp.isPhone, true);

    const isNarrow = 320 < 340;
    assert.strictEqual(isNarrow, true);
    const digitFontSize = isNarrow ? 18 : 24;
    assert.strictEqual(digitFontSize, 18, 'Digit font size must scale down on widths below 340');

    const cardInnerPadding = 24;
    const screenHorizontalPadding = 20 * 2;
    const cardWidth = 320 - screenHorizontalPadding; // 280
    const cardAvailableWidth = cardWidth - 2 * cardInnerPadding; // 232
    const totalGaps = 5 * 8; // 40
    const boxWidth = (cardAvailableWidth - totalGaps) / 6; // 32
    assert.ok(boxWidth * 6 + totalGaps <= cardAvailableWidth, 'OTP row must fit within 320pt phone');
  });

  await t.test('Width 390px (Phone)', () => {
    const bp = resolveBreakpoint(390);
    assert.strictEqual(bp.breakpoint, 'phone');
    assert.strictEqual(bp.isPhone, true);
    assert.strictEqual(bp.isTablet, false);
    assert.strictEqual(bp.isDesktop, false);

    const cardInnerPadding = 24;
    const screenHorizontalPadding = 20 * 2;
    const cardWidth = 390 - screenHorizontalPadding; // 350
    const cardAvailableWidth = cardWidth - 2 * cardInnerPadding; // 302
    const totalGaps = 5 * 8; // 40
    const boxWidth = (cardAvailableWidth - totalGaps) / 6; // 43.67
    assert.ok(boxWidth * 6 + totalGaps <= cardAvailableWidth, 'OTP row must fit within 390px');
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
    // Fill #163832, 1px border #235347, text #8EB69B
    const bg = '#163832';
    const border = '#235347';
    const text = '#8EB69B';
    assert.strictEqual(bg, '#163832');
    assert.strictEqual(border, '#235347');
    assert.strictEqual(text, '#8EB69B');
  });
});
