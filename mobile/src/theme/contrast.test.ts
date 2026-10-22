import test from 'node:test';
import assert from 'node:assert';
import { PALETTES, Brand, ColorMode, SemanticTokens } from './palette';

export function parseColor(c: string, bgRgb?: [number, number, number]): [number, number, number] {
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b];
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  }
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    let r = parseInt(m[1], 10);
    let g = parseInt(m[2], 10);
    let b = parseInt(m[3], 10);
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (a < 1 && bgRgb) {
      r = Math.round(r * a + bgRgb[0] * (1 - a));
      g = Math.round(g * a + bgRgb[1] * (1 - a));
      b = Math.round(b * a + bgRgb[2] * (1 - a));
    }
    return [r, g, b];
  }
  throw new Error(`Unsupported color format: ${c}`);
}

export function getRelativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(fgRgb: [number, number, number], bgRgb: [number, number, number]): number {
  const l1 = getRelativeLuminance(fgRgb);
  const l2 = getRelativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function calculateContrastRatio(fgStr: string, bgStr: string): number {
  const bg = parseColor(bgStr);
  const fg = parseColor(fgStr, bg);
  return getContrastRatio(fg, bg);
}

interface ContrastResult {
  brand: string;
  mode: string;
  textToken: string;
  bgToken: string;
  ratio: number;
  minRequired: number;
  pass: boolean;
}

test('WCAG contrast test for every text token in all 4 brand and mode palettes', () => {
  const brands: Brand[] = ['cobalt', 'ember'];
  const modes: ColorMode[] = ['dark', 'light'];
  const results: ContrastResult[] = [];

  for (const brand of brands) {
    for (const mode of modes) {
      const p: SemanticTokens = PALETTES[brand][mode];
      const bgRgb = parseColor(p.bg);
      const surfaceRgb = parseColor(p.surface);
      const surfaceRaisedRgb = parseColor(p.surfaceRaised);
      const primaryRgb = parseColor(p.primary);

      const bgTargets: [string, [number, number, number]][] = [
        ['bg', bgRgb],
        ['surface', surfaceRgb],
        ['surfaceRaised', surfaceRaisedRgb],
      ];

      // 1. Text and TextSecondary against bg, surface, surfaceRaised
      for (const [bgName, targetBgRgb] of bgTargets) {
        const textRgb = parseColor(p.text, targetBgRgb);
        const textSecRgb = parseColor(p.textSecondary, targetBgRgb);

        const ratioText = getContrastRatio(textRgb, targetBgRgb);
        results.push({
          brand,
          mode,
          textToken: 'text',
          bgToken: bgName,
          ratio: ratioText,
          minRequired: 4.5,
          pass: ratioText >= 4.5,
        });

        const ratioTextSec = getContrastRatio(textSecRgb, targetBgRgb);
        results.push({
          brand,
          mode,
          textToken: 'textSecondary',
          bgToken: bgName,
          ratio: ratioTextSec,
          minRequired: 4.5,
          pass: ratioTextSec >= 4.5,
        });
      }

      // 2. textOnPrimary on primary
      const textOnPrimaryRgb = parseColor(p.textOnPrimary, primaryRgb);
      const ratioOnPrimary = getContrastRatio(textOnPrimaryRgb, primaryRgb);
      results.push({
        brand,
        mode,
        textToken: 'textOnPrimary',
        bgToken: 'primary',
        ratio: ratioOnPrimary,
        minRequired: 4.5,
        pass: ratioOnPrimary >= 4.5,
      });

      // 3. Status chip texts on chip backgrounds (evaluated over surface)
      const chipTypes: ('Success' | 'Warning' | 'Danger' | 'Info')[] = [
        'Success',
        'Warning',
        'Danger',
        'Info',
      ];
      for (const t of chipTypes) {
        const chipBgStr = (p as any)[`chip${t}Bg`];
        const chipTextStr = (p as any)[`chip${t}Text`];
        const chipBgRgb = parseColor(chipBgStr, surfaceRgb);
        const chipTextRgb = parseColor(chipTextStr, chipBgRgb);

        const ratio = getContrastRatio(chipTextRgb, chipBgRgb);
        results.push({
          brand,
          mode,
          textToken: `chip${t}Text`,
          bgToken: `chip${t}Bg`,
          ratio,
          minRequired: 4.5,
          pass: ratio >= 4.5,
        });
      }

      // 4. Screen-level pairs: primary on primarySoft (chips, avatars, selection pills)
      const softBgRgb = parseColor(p.primarySoft, surfaceRgb);
      const primaryOnSoftRgb = parseColor(p.primary, softBgRgb);
      const ratioPrimaryOnSoft = getContrastRatio(primaryOnSoftRgb, softBgRgb);
      results.push({
        brand,
        mode,
        textToken: 'primary',
        bgToken: 'primarySoft',
        ratio: ratioPrimaryOnSoft,
        minRequired: 4.5,
        pass: ratioPrimaryOnSoft >= 4.5,
      });

      // 5. Screen-level pairs: Status colors directly on surface
      const statusColors: ('success' | 'warning' | 'danger')[] = ['success', 'warning', 'danger'];
      for (const sc of statusColors) {
        const scRgb = parseColor(p[sc], surfaceRgb);
        const ratioSc = getContrastRatio(scRgb, surfaceRgb);
        results.push({
          brand,
          mode,
          textToken: sc,
          bgToken: 'surface',
          ratio: ratioSc,
          minRequired: 4.5,
          pass: ratioSc >= 4.5,
        });
      }
    }
  }

  // Print 4 distinct sections for each brand and mode palette
  const paletteSections: { brand: Brand; mode: ColorMode; title: string }[] = [
    { brand: 'cobalt', mode: 'light', title: 'COBALT LIGHT PALETTE' },
    { brand: 'cobalt', mode: 'dark', title: 'COBALT DARK PALETTE' },
    { brand: 'ember', mode: 'light', title: 'EMBER LIGHT PALETTE' },
    { brand: 'ember', mode: 'dark', title: 'EMBER DARK PALETTE' },
  ];

  for (const sec of paletteSections) {
    const secResults = results.filter((r) => r.brand === sec.brand && r.mode === sec.mode);
    console.log(`\n================================== [SECTION] ${sec.title} ==================================`);
    console.log(
      'Text Token'.padEnd(20) +
        'Background'.padEnd(18) +
        'Ratio'.padEnd(14) +
        'Min Req'.padEnd(12) +
        'Status'
    );
    console.log('-----------------------------------------------------------------------------------------');
    for (const r of secResults) {
      console.log(
        r.textToken.padEnd(20) +
          r.bgToken.padEnd(18) +
          `${r.ratio.toFixed(2)}:1`.padEnd(14) +
          `${r.minRequired.toFixed(1)}:1`.padEnd(12) +
          (r.pass ? 'PASS (>= 4.5:1)' : 'FAIL (< 4.5:1)')
      );
    }
    const allSecPass = secResults.every((r) => r.pass);
    console.log('-----------------------------------------------------------------------------------------');
    console.log(`Summary for ${sec.title}: ${secResults.length}/${secResults.length} tokens passed (All >= 4.5:1: ${allSecPass})`);
    console.log(`=========================================================================================\n`);
  }

  // Verify all pass
  for (const r of results) {
    assert.ok(
      r.pass,
      `Contrast failed for ${r.brand} ${r.mode}: ${r.textToken} on ${r.bgToken} got ${r.ratio.toFixed(2)}:1 (min ${r.minRequired}:1)`
    );
  }
});
