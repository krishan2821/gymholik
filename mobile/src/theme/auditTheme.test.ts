import test from 'node:test';
import assert from 'node:assert';
// Import auditCode validator from scripts/audit-theme.js
const { auditCode } = require('../../scripts/audit-theme.js');

test('Audit Guard Rail Fixtures: intentionally break each rule and verify detection', () => {
  // Fixture 1: Module-scope StyleSheet.create whose body reads theme / colors / palette
  const fixtureRule1 = `
import React from 'react';
import { StyleSheet, View } from 'react-native';

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: colors.border,
  },
});

export const Card = () => <View style={styles.card} />;
`;
  const violations1 = auditCode(fixtureRule1, 'src/components/Fixture1Card.tsx');
  assert.ok(
    violations1.some((v: any) => v.rule.startsWith('no-static-theme-stylesheet')),
    'Rule 1 must detect module-scope StyleSheet.create referencing theme/colors'
  );

  // Fixture 2: Hex and RGBA color literals outside src/theme
  const fixtureRule2 = `
import React from 'react';
import { View } from 'react-native';

export const Box = () => (
  <View style={{ shadowColor: '#123456', backgroundColor: 'rgba(0, 0, 0, 0.4)' }} />
);
`;
  const violations2 = auditCode(fixtureRule2, 'src/components/Fixture2Box.tsx');
  const hexViolation = violations2.find((v: any) => v.snippet.includes('#123456'));
  const rgbaViolation = violations2.find((v: any) => v.snippet.includes('rgba(0, 0, 0, 0.4)'));
  assert.ok(hexViolation, 'Rule 2 must detect hex literal #123456');
  assert.ok(rgbaViolation, 'Rule 2 must detect rgba literal rgba(0, 0, 0, 0.4)');

  // Fixture 3: Import of a raw palette file outside src/theme
  const fixtureRule3 = `
import React from 'react';
import { cobaltDark } from '../theme/palette';

export const BrandBadge = () => <div style={{ color: cobaltDark.primary }} />;
`;
  const violations3 = auditCode(fixtureRule3, 'src/components/Fixture3Badge.tsx');
  assert.ok(
    violations3.some((v: any) => v.rule.startsWith('no-restricted-imports')),
    'Rule 3 must detect direct import of raw palette outside src/theme'
  );

  // Fixture 4: Appearance.getColorScheme or useColorScheme outside ThemeContext.tsx
  const fixtureRule4 = `
import { Appearance, useColorScheme } from 'react-native';

export function useWrongScheme() {
  const scheme = useColorScheme();
  const current = Appearance.getColorScheme();
  return scheme || current;
}
`;
  const violations4 = auditCode(fixtureRule4, 'src/hooks/useWrongScheme.ts');
  assert.ok(
    violations4.some((v: any) => v.rule.startsWith('centralized-appearance-rule')),
    'Rule 4 must detect useColorScheme or Appearance outside ThemeContext.tsx'
  );

  // Negative Check: Valid component with useStyles and layout-only StyleSheet passes cleanly
  const validFixture = `
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles } from '../theme';

const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});

export const CleanCard = () => {
  const styles = useStyles((theme) => ({
    card: {
      backgroundColor: theme.colors.surface,
    },
  }));
  return <View style={[staticStyles.container, styles.card]} />;
};
`;
  const validViolations = auditCode(validFixture, 'src/components/CleanCard.tsx');
  assert.strictEqual(validViolations.length, 0, 'Clean component using useStyles must produce 0 violations');
});
