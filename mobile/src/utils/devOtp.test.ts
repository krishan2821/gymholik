import test from 'node:test';
import assert from 'node:assert';
import { shouldRenderDevOtp } from './devOtp';

test('Dev OTP: 123456 chip rendering rule', async (t) => {
  await t.test('renders when __DEV__ is true', () => {
    assert.strictEqual(shouldRenderDevOtp(true), true);
  });

  await t.test('is strictly absent when __DEV__ is false (production)', () => {
    assert.strictEqual(shouldRenderDevOtp(false), false);
  });

  await t.test('handles falsy / undefined safely', () => {
    assert.strictEqual(shouldRenderDevOtp(undefined as any), false);
    assert.strictEqual(shouldRenderDevOtp(null as any), false);
  });
});
