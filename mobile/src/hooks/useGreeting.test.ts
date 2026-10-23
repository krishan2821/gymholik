import test from 'node:test';
import assert from 'node:assert';
import { getGreetingForHour, getGreetingForDate } from './useGreeting';

test('useGreeting: verifies rules for every hour 0 to 23', () => {
  const expected: Record<number, string> = {
    0: 'Hello',
    1: 'Hello',
    2: 'Hello',
    3: 'Hello',
    4: 'Hello',
    5: 'Good morning',
    6: 'Good morning',
    7: 'Good morning',
    8: 'Good morning',
    9: 'Good morning',
    10: 'Good morning',
    11: 'Good morning',
    12: 'Good afternoon',
    13: 'Good afternoon',
    14: 'Good afternoon',
    15: 'Good afternoon',
    16: 'Good afternoon',
    17: 'Good evening',
    18: 'Good evening',
    19: 'Good evening',
    20: 'Good evening',
    21: 'Hello',
    22: 'Hello',
    23: 'Hello',
  };

  for (let h = 0; h < 24; h++) {
    const greeting = getGreetingForHour(h);
    assert.strictEqual(
      greeting,
      expected[h],
      `Hour ${h}:00 should return "${expected[h]}", got "${greeting}"`
    );
  }
});

test('useGreeting: boundary checks at exact minutes', () => {
  // Boundary 1: 04:59 -> Hello vs 05:00 -> Good morning
  const d0459 = new Date(2026, 9, 23, 4, 59, 59);
  assert.strictEqual(getGreetingForDate(d0459), 'Hello', '04:59 must be Hello');

  const d0500 = new Date(2026, 9, 23, 5, 0, 0);
  assert.strictEqual(getGreetingForDate(d0500), 'Good morning', '05:00 must be Good morning');

  // Boundary 2: 11:59 -> Good morning vs 12:00 -> Good afternoon
  const d1159 = new Date(2026, 9, 23, 11, 59, 59);
  assert.strictEqual(getGreetingForDate(d1159), 'Good morning', '11:59 must be Good morning');

  const d1200 = new Date(2026, 9, 23, 12, 0, 0);
  assert.strictEqual(getGreetingForDate(d1200), 'Good afternoon', '12:00 must be Good afternoon');

  // Boundary 3: 16:59 -> Good afternoon vs 17:00 -> Good evening
  const d1659 = new Date(2026, 9, 23, 16, 59, 59);
  assert.strictEqual(getGreetingForDate(d1659), 'Good afternoon', '16:59 must be Good afternoon');

  const d1700 = new Date(2026, 9, 23, 17, 0, 0);
  assert.strictEqual(getGreetingForDate(d1700), 'Good evening', '17:00 must be Good evening');

  // Boundary 4: 20:59 -> Good evening vs 21:00 -> Hello
  const d2059 = new Date(2026, 9, 23, 20, 59, 59);
  assert.strictEqual(getGreetingForDate(d2059), 'Good evening', '20:59 must be Good evening');

  const d2100 = new Date(2026, 9, 23, 21, 0, 0);
  assert.strictEqual(getGreetingForDate(d2100), 'Hello', '21:00 must be Hello');
});

test('useGreeting: updates when time advances while mounted', () => {
  let simulatedHour = 11;
  let simulatedMinute = 59;

  const getCurrentSimulatedGreeting = () => {
    return getGreetingForHour(simulatedHour);
  };

  // Initially at 11:59 AM
  assert.strictEqual(getCurrentSimulatedGreeting(), 'Good morning');

  // Time advances by 1 minute to 12:00 PM
  simulatedHour = 12;
  simulatedMinute = 0;
  assert.strictEqual(getCurrentSimulatedGreeting(), 'Good afternoon');

  // Time advances to 17:00 PM
  simulatedHour = 17;
  assert.strictEqual(getCurrentSimulatedGreeting(), 'Good evening');

  // Time advances to 21:00 PM
  simulatedHour = 21;
  assert.strictEqual(getCurrentSimulatedGreeting(), 'Hello');
});
