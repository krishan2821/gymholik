import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canUseGlassRule, springConfigs } from './platformRules';
import { getStatusBadgeVariant } from './statusBadges';
import { getTabsForRole } from '../navigation/tabsByRole';
import { getPalette } from '../theme/theme';
import { calculateContrastRatio } from '../theme/contrast.test';

describe('Platform Adaptive Specifications', () => {
  describe('GlassSurface & Platform Detection Rules', () => {
    it('allows glass only on iOS 26 when reduceTransparency is false', () => {
      assert.equal(
        canUseGlassRule({ platformOS: 'ios', osVersion: 26, reduceTransparency: false }),
        true
      );
      assert.equal(
        canUseGlassRule({ platformOverride: 'ios26', reduceTransparency: false }),
        true
      );
    });

    it('strictly denies glass on Android', () => {
      assert.equal(
        canUseGlassRule({ platformOS: 'android', osVersion: 34, reduceTransparency: false }),
        false
      );
      assert.equal(
        canUseGlassRule({ platformOverride: 'android', reduceTransparency: false }),
        false
      );
      assert.equal(
        canUseGlassRule({ platformOverride: 'android', reduceTransparency: true }),
        false
      );
    });

    it('strictly denies glass on older iOS (< 26)', () => {
      assert.equal(
        canUseGlassRule({ platformOS: 'ios', osVersion: 18, reduceTransparency: false }),
        false
      );
      assert.equal(
        canUseGlassRule({ platformOverride: 'ios', reduceTransparency: false }),
        false
      );
    });

    it('strictly denies glass on Web', () => {
      assert.equal(
        canUseGlassRule({ platformOS: 'web', reduceTransparency: false }),
        false
      );
      assert.equal(
        canUseGlassRule({ platformOverride: 'web', reduceTransparency: false }),
        false
      );
    });

    it('degrades glass to solid fallback when reduceTransparency is true', () => {
      assert.equal(
        canUseGlassRule({ platformOS: 'ios', osVersion: 26, reduceTransparency: true }),
        false
      );
      assert.equal(
        canUseGlassRule({ platformOverride: 'ios26', reduceTransparency: true }),
        false
      );
    });
  });

  describe('Spring Motion Configurations', () => {
    it('provides livelier springs on Android than iOS', () => {
      assert.ok(
        springConfigs.android.tension > springConfigs.ios.tension,
        'Android spring tension should be higher for livelier motion'
      );
      assert.ok(
        springConfigs.android.bounciness > springConfigs.ios.bounciness,
        'Android spring bounciness should be livelier'
      );
    });
  });

  describe('Status Badges Semantic Mapping', () => {
    it('correctly maps all 6 required status strings to non-neutral variants', () => {
      assert.equal(getStatusBadgeVariant('Active'), 'active');
      assert.equal(getStatusBadgeVariant('Upcoming'), 'upcoming');
      assert.equal(getStatusBadgeVariant('Expiring'), 'expiring');
      assert.equal(getStatusBadgeVariant('Expired'), 'expired');
      assert.equal(getStatusBadgeVariant('Due'), 'due');
      assert.equal(getStatusBadgeVariant('Paid'), 'paid');
    });
  });

  describe('Tab Bar Item Limits by Role', () => {
    it('Owner tab count does not exceed 5', () => {
      const tabs = getTabsForRole('OWNER');
      assert.ok(tabs.length <= 5, `Expected <= 5 tabs, got ${tabs.length}`);
    });

    it('Staff tab count does not exceed 5', () => {
      const tabs = getTabsForRole('STAFF');
      assert.ok(tabs.length <= 5, `Expected <= 5 tabs, got ${tabs.length}`);
    });

    it('Trainer tab count does not exceed 4', () => {
      const tabs = getTabsForRole('TRAINER');
      assert.ok(tabs.length <= 4, `Expected <= 4 tabs, got ${tabs.length}`);
    });
  });

  describe('Disabled Button Contrast Ratio (>= 4.5:1 across all 4 modes)', () => {
    const brands = ['cobalt', 'ember'] as const;
    const modes = ['dark', 'light'] as const;

    for (const brand of brands) {
      for (const mode of modes) {
        it(`${brand} ${mode}: disabled button textSecondary vs surfaceRaised >= 4.5:1`, () => {
          const pal = getPalette(brand, mode);
          const ratio = calculateContrastRatio(pal.textSecondary, pal.surfaceRaised);
          assert.ok(
            ratio >= 4.5,
            `Disabled button contrast ${ratio.toFixed(2)}:1 below 4.5:1 in ${brand} ${mode}`
          );
        });
      }
    }
  });
});
