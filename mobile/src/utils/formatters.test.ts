import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatMoney,
  formatRupees,
  formatDate,
  formatTime,
  truncateMiddle,
} from './formatters';
import { COLLECT, MEMBERS, RENEW } from '../constants/strings';

describe('formatters & currency rules', () => {
  it('formats paise with exactly one rupee sign and Indian grouping', () => {
    const cases = [
      { paise: 0, expected: '₹0' },
      { paise: 50000, expected: '₹500' },
      { paise: 100000, expected: '₹1,000' },
      { paise: 400000, expected: '₹4,000' },
      { paise: 1200000, expected: '₹12,000' },
      { paise: 12500000, expected: '₹1,25,000' },
      { paise: 100000000, expected: '₹10,00,000' },
    ];

    for (const { paise, expected } of cases) {
      const res = formatMoney(paise);
      assert.strictEqual(res, expected);
      // Ensure exactly one rupee sign
      const rupeeCount = (res.match(/₹/g) || []).length;
      assert.strictEqual(rupeeCount, 1, `Expected exactly 1 rupee sign in "${res}"`);
    }
  });

  it('formats rupees with exactly one rupee sign and Indian grouping', () => {
    const cases = [
      { rupees: 0, expected: '₹0' },
      { rupees: 500, expected: '₹500' },
      { rupees: 4000, expected: '₹4,000' },
      { rupees: 125000, expected: '₹1,25,000' },
    ];

    for (const { rupees, expected } of cases) {
      const res = formatRupees(rupees);
      assert.strictEqual(res, expected);
      const rupeeCount = (res.match(/₹/g) || []).length;
      assert.strictEqual(rupeeCount, 1, `Expected exactly 1 rupee sign in "${res}"`);
    }
  });

  it('handles string input and cleans existing rupee signs without duplication', () => {
    assert.strictEqual(formatMoney('₹4,00000'), '₹4,000');
    assert.strictEqual(formatRupees('₹1,500'), '₹1,500');
    assert.strictEqual(formatMoney('₹₹0'), '₹0');
  });

  it('ensures strings.ts templates contain exactly one rupee sign when formatMoney is passed', () => {
    const formatted = formatMoney(0); // "₹0"
    const collectAction = COLLECT.ACTION_COLLECT(formatted);
    assert.strictEqual(collectAction, 'Collect ₹0');
    assert.strictEqual((collectAction.match(/₹/g) || []).length, 1);
    assert.doesNotMatch(collectAction, /₹₹/);

    const balanceAfter = COLLECT.BALANCE_AFTER(formatted);
    assert.strictEqual(balanceAfter, 'Balance after this payment: ₹0');
    assert.strictEqual((balanceAfter.match(/₹/g) || []).length, 1);
    assert.doesNotMatch(balanceAfter, /₹₹/);

    const balanceDue = COLLECT.BALANCE_DUE(formatMoney(50000));
    assert.strictEqual(balanceDue, 'Balance due: ₹500');
    assert.strictEqual((balanceDue.match(/₹/g) || []).length, 1);
    assert.doesNotMatch(balanceDue, /₹₹/);

    const outstanding = COLLECT.OUTSTANDING(formatMoney(100000));
    assert.strictEqual(outstanding, 'Outstanding balance: ₹1,000');
    assert.strictEqual((outstanding.match(/₹/g) || []).length, 1);
    assert.doesNotMatch(outstanding, /₹₹/);

    const dueBadge = MEMBERS.DUE_BADGE(formatMoney(400000));
    assert.strictEqual(dueBadge, 'Owes ₹4,000');
    assert.strictEqual((dueBadge.match(/₹/g) || []).length, 1);
    assert.doesNotMatch(dueBadge, /₹₹/);

    const renewFee = RENEW.PLAN_FEE(formatMoney(1200000));
    assert.strictEqual(renewFee, 'Total fee: ₹12,000');
    assert.strictEqual((renewFee.match(/₹/g) || []).length, 1);
    assert.doesNotMatch(renewFee, /₹₹/);
  });

  it('formats dates consistently in IST even on mock UTC device clock (process.env.TZ = "UTC")', () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      assert.strictEqual(formatDate('2026-10-12'), '12 Oct 2026');
      // UTC timestamp for IST midnight (2026-10-11T18:30:00Z -> 12 Oct 2026 IST)
      assert.strictEqual(formatDate('2026-10-11T18:30:00Z'), '12 Oct 2026');
      assert.strictEqual(formatDate('2027-01-10'), '10 Jan 2027');
      assert.strictEqual(formatDate(''), '—');
      assert.strictEqual(formatDate(null), '—');
    } finally {
      process.env.TZ = originalTZ;
    }
  });

  it('formats times consistently as "9:10 AM" in IST on mock UTC device clock (process.env.TZ = "UTC")', () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      // 03:40 UTC is 09:10 IST
      assert.strictEqual(formatTime('2026-10-14T03:40:00Z'), '9:10 AM');
      assert.strictEqual(formatTime('2026-10-14T09:10:00'), '9:10 AM');
      // 08:35 UTC is 14:05 IST
      assert.strictEqual(formatTime('2026-10-14T08:35:00Z'), '2:05 PM');
      // 18:30 UTC is 00:00 IST
      assert.strictEqual(formatTime('2026-10-13T18:30:00Z'), '12:00 AM');
    } finally {
      process.env.TZ = originalTZ;
    }
  });

  it('truncates middle of receipt numbers when longer than max length', () => {
    assert.strictEqual(truncateMiddle('3RGY6XS6-000001', 14), '3RGY6X…000001');
    assert.strictEqual(truncateMiddle('000001', 14), '000001');
  });
});
