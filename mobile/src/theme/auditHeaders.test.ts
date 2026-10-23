import test from 'node:test';
import assert from 'node:assert';

// Import audit validator from scripts/audit-headers.js
const { auditHeadersCode } = require('../../scripts/audit-headers.js');

test('Header Guard Rail: enforces Rule 1, 2, and 3 with intentional breaking fixtures', () => {
  // Fixture 1a: Layout missing headerShown: false
  const layoutMissingHeaderShown = `
import React from 'react';
import { Stack } from 'expo-router';

export default function BrokenLayout() {
  return (
    <Stack screenOptions={{ animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
`;
  const violations1a = auditHeadersCode(layoutMissingHeaderShown, 'app/(tabs)/test/_layout.tsx');
  assert.ok(
    violations1a.some((v: any) => v.rule.includes('Rule 1') && v.snippet.includes('Missing headerShown: false')),
    'Rule 1 must fail when layout does not configure headerShown: false'
  );

  // Fixture 1b: Layout explicitly setting headerShown: true
  const layoutWithHeaderShownTrue = `
import React from 'react';
import { Stack } from 'expo-router';

export default function NativeHeaderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: true, title: 'Native Title' }} />
    </Stack>
  );
}
`;
  const violations1b = auditHeadersCode(layoutWithHeaderShownTrue, 'app/(tabs)/test/_layout.tsx');
  assert.ok(
    violations1b.some((v: any) => v.rule.includes('Rule 1') && v.snippet.includes('headerShown: true')),
    'Rule 1 must fail when layout sets headerShown: true'
  );

  // Fixture 2a: Screen configuring <Stack.Screen> directly
  const screenWithStackScreen = `
import React from 'react';
import { Stack } from 'expo-router';
import { Screen } from '../../../src/components/Screen';

export default function ScreenConfiguringNative() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Screen Title' }} />
    </Screen>
  );
}
`;
  const violations2a = auditHeadersCode(screenWithStackScreen, 'app/(tabs)/more/broken-screen.tsx');
  assert.ok(
    violations2a.some((v: any) => v.rule.includes('Rule 2') && v.snippet.includes('<Stack.Screen')),
    'Rule 2 must fail when a screen file renders <Stack.Screen>'
  );

  // Fixture 2b: Screen configuring native headers via setOptions
  const screenWithSetOptions = `
import React, { useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { Screen } from '../../../src/components/Screen';

export default function ScreenWithSetOptions() {
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({ headerTitle: 'Custom' });
  }, [navigation]);

  return <Screen />;
}
`;
  const violations2b = auditHeadersCode(screenWithSetOptions, 'app/(tabs)/more/broken-options.tsx');
  assert.ok(
    violations2b.some((v: any) => v.rule.includes('Rule 2') && v.snippet.includes('setOptions')),
    'Rule 2 must fail when a screen configures native headers via setOptions'
  );

  // Fixture 3: Screen missing <Screen> wrapper
  const screenMissingScreen = `
import React from 'react';
import { View, Text } from 'react-native';
import { PageHeader } from '../../../src/components/PageHeader';

export default function NakedScreen() {
  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="Naked" />
      <Text>Missing Screen</Text>
    </View>
  );
}
`;
  const violations3 = auditHeadersCode(screenMissingScreen, 'app/(tabs)/more/naked.tsx');
  assert.ok(
    violations3.some((v: any) => v.rule.includes('Rule 3') && v.snippet.includes('Missing <Screen>')),
    'Rule 3 must fail when a screen file does not render <Screen>'
  );

  // Fixture 4: Valid screen conforms to all rules
  const validScreen = `
import React from 'react';
import { Screen } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';

export default function ValidScreen() {
  return (
    <Screen safeTop={true} scrollable>
      <PageHeader title="Valid" showBack />
    </Screen>
  );
}
`;
  const violations4 = auditHeadersCode(validScreen, 'app/(tabs)/more/valid.tsx');
  assert.strictEqual(violations4.length, 0, 'Conforming screen must have 0 violations');

  // Fixture 5: Valid layout conforms to all rules
  const validLayout = `
import React from 'react';
import { Stack } from 'expo-router';

export default function ValidLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
`;
  const violations5 = auditHeadersCode(validLayout, 'app/(tabs)/more/_layout.tsx');
  assert.strictEqual(violations5.length, 0, 'Conforming layout must have 0 violations');

  // Fixture 6: Pushed screen missing <PageHeader> fails Rule 4
  const pushedScreenMissingHeader = `
import React from 'react';
import { View, Text } from 'react-native';
import { Screen } from '../../../src/components/Screen';

export default function MissingHeaderScreen() {
  return (
    <Screen safeTop={true}>
      <Text>No header</Text>
    </Screen>
  );
}
`;
  const violations6 = auditHeadersCode(pushedScreenMissingHeader, 'app/(tabs)/more/trainers/broken.tsx');
  assert.ok(
    violations6.some((v: any) => v.rule.includes('Rule 4') && v.snippet.includes('Missing <PageHeader>')),
    'Rule 4 must fail when a pushed screen under more/* does not render PageHeader'
  );

  // Fixture 7: PageHeader right slot Button without fullWidth={false} fails Rule 5
  const headerWithFullWidthButton = `
import React from 'react';
import { Screen } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { Button } from '../../../src/components/Button';

export default function BloatedHeaderScreen() {
  return (
    <Screen safeTop={true}>
      <PageHeader
        title="Trainer Types"
        rightAction={<Button title="Add Type" onPress={() => {}} />}
      />
    </Screen>
  );
}
`;
  const violations7 = auditHeadersCode(headerWithFullWidthButton, 'app/(tabs)/more/trainers/bloated.tsx');
  assert.ok(
    violations7.some((v: any) => v.rule.includes('Rule 5') && v.rule.includes('fullWidth={false}')),
    'Rule 5 must fail when PageHeader right action Button omits fullWidth={false}'
  );

  // Fixture 8: PageHeader right slot with width > 40% or flex: 1 fails Rule 5
  const headerWithOversizedRightSlot = `
import React from 'react';
import { View } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';

export default function OversizedHeaderScreen() {
  return (
    <Screen safeTop={true}>
      <PageHeader
        title="Trainer Types"
        rightAction={<View style={{ width: '80%' }} />}
      />
    </Screen>
  );
}
`;
  const violations8 = auditHeadersCode(headerWithOversizedRightSlot, 'app/(tabs)/more/oversized.tsx');
  assert.ok(
    violations8.some((v: any) => v.rule.includes('Rule 5') && v.rule.includes('40%')),
    'Rule 5 must fail when PageHeader right slot exceeds 40% width'
  );
});

test('PageHeader title contract: title is never hidden and right action is capped at 40%', () => {
  // Read PageHeader.tsx source to verify structural constraints
  const fs = require('fs');
  const path = require('path');
  const pageHeaderPath = path.resolve(__dirname, '../components/PageHeader.tsx');
  const content = fs.readFileSync(pageHeaderPath, 'utf8');

  // 1. Title must take flex 1 and numberOfLines 1
  assert.ok(
    content.includes('numberOfLines={1}'),
    'PageHeader title Text must have numberOfLines={1}'
  );
  assert.ok(
    /titleWrap:\s*\{[^}]*flex:\s*1/.test(content),
    'titleWrap in PageHeader must have flex: 1'
  );

  // 2. Back button must have flexShrink: 0 and 44x44 size
  assert.ok(
    /backButton:\s*\{[^}]*width:\s*44/.test(content) &&
    /backButton:\s*\{[^}]*height:\s*44/.test(content) &&
    /backButton:\s*\{[^}]*flexShrink:\s*0/.test(content),
    'backButton must be 44x44 with flexShrink: 0'
  );

  // 3. rightAction must have maxWidth: '40%' and flexShrink: 0
  assert.ok(
    /rightAction:\s*\{[^}]*maxWidth:\s*'40%'/.test(content) &&
    /rightAction:\s*\{[^}]*flexShrink:\s*0/.test(content),
    'rightAction must enforce maxWidth: 40% and flexShrink: 0'
  );
});
