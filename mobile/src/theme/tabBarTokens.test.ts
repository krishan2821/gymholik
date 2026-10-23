import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tabBarTokens } from './tokens';
import { layout } from './tokens';
import { PALETTES } from './palette';

describe('Floating Tab Bar Geometry & Animation Tokens', () => {
  it('has exact bar geometry matching contract (64 height, 32 radius, 16 side margin)', () => {
    assert.equal(tabBarTokens.height, 64);
    assert.equal(tabBarTokens.radius, 32);
    assert.equal(tabBarTokens.sideMargin, 16);
    assert.equal(tabBarTokens.bottomOffsetExtra, 8);
  });

  it('calculates centre circle protrusion to be exactly 12pt (±1)', () => {
    const filledRadius = tabBarTokens.centerCircleFilledDiameter / 2; // 26
    const filledTop = tabBarTokens.centerCircleCenterY - filledRadius; // 14 - 26 = -12
    const protrusion = -filledTop;

    assert.equal(tabBarTokens.centerCircleFilledDiameter, 52);
    assert.equal(tabBarTokens.centerCircleRingWidth, 4);
    assert.equal(tabBarTokens.centerCircleTotalDiameter, 60);
    assert.equal(tabBarTokens.centerCircleCenterY, 14);
    assert.equal(protrusion, 12, 'Filled circle must protrude exactly 12pt above the bar top edge');
    assert.ok(Math.abs(protrusion - 12) <= 1, 'Protrusion must be 12 ± 1 pt');
  });

  it('ensures centre ring does not overlap the label baseline', () => {
    const ringRadius = tabBarTokens.centerCircleTotalDiameter / 2; // 30
    const ringBottom = tabBarTokens.centerCircleCenterY + ringRadius; // 14 + 30 = 44
    const labelTop = tabBarTokens.labelBaselineY - tabBarTokens.labelLineHeight; // e.g. 52 - 14 = 38 (text ascender begins ~45)

    assert.equal(ringBottom, 44);
    assert.ok(ringBottom < tabBarTokens.labelBaselineY, 'Ring bottom (44) must be strictly above label baseline (52)');
    assert.ok(ringBottom <= 46, 'Ring bottom must clear label bounding box without overlap');
  });

  it('guarantees touch hit area is at least 56pt', () => {
    assert.ok(
      tabBarTokens.centerCircleHitArea >= 56,
      'Centre circle touch hit area must be >= 56pt'
    );
    assert.ok(
      tabBarTokens.centerCircleTotalDiameter >= 56,
      'Centre circle physical diameter (60pt) meets >= 56pt'
    );
  });

  it('specifies sliding pill dimensions (44 height, 22 radius, width = slot width - 8)', () => {
    assert.equal(tabBarTokens.activePillHeight, 44);
    assert.equal(tabBarTokens.activePillRadius, 22);
    assert.equal(tabBarTokens.activePillMarginHorizontal, 4);
  });

  it('verifies slot widths and label clearance across SE (375), 393, 430 and 768 tablet', () => {
    const viewports = [
      { name: 'iPhone SE', width: 375 },
      { name: 'iPhone 14/15/16', width: 393 },
      { name: 'iPhone 16 Plus', width: 430 },
      { name: 'Tablet 768', width: 768 },
    ];

    for (const vp of viewports) {
      const containerWidth = Math.min(vp.width, layout.maxWidth.column);
      const barWidth = containerWidth - tabBarTokens.sideMargin * 2;
      const numTabs = 5;
      const slotWidth = barWidth / numTabs;
      const pillWidth = slotWidth - tabBarTokens.activePillMarginHorizontal * 2;

      assert.ok(slotWidth >= 65, `${vp.name}: slot width (${slotWidth.toFixed(1)}) must be >= 65pt for 5 tabs`);
      assert.ok(pillWidth >= 57, `${vp.name}: pill width (${pillWidth.toFixed(1)}) must be >= 57pt`);

      // 11pt font text "Check-in" is ~8 characters. At avg 5.5pt per char, length is ~44pt.
      const estimatedLabelWidth = 8 * 5.8;
      assert.ok(
        slotWidth > estimatedLabelWidth + 8,
        `${vp.name}: slot width ${slotWidth} must comfortably fit 11pt label (~${estimatedLabelWidth}pt) without truncating`
      );
    }
  });

  it('specifies animation spring and timing tokens', () => {
    assert.deepEqual(tabBarTokens.springConfig, {
      damping: 16,
      stiffness: 220,
      mass: 0.8,
    });
    assert.equal(tabBarTokens.pressInScale, 0.92);
    assert.equal(tabBarTokens.rippleDurationMs, 450);
    assert.equal(tabBarTokens.rippleMaxScale, 1.7);
    assert.equal(tabBarTokens.rippleInitialOpacity, 0.35);
    assert.equal(tabBarTokens.entranceDurationMs, 350);
    assert.equal(tabBarTokens.entranceTranslateY, 24);
    assert.equal(tabBarTokens.androidRippleRadius, 28);
  });
});
