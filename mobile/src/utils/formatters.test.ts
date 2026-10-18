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

  it('formats dates consistently as "10 Jan 2027"', () => {
    assert.strictEqual(formatDate('2027-01-10'), '10 Jan 2027');
    assert.strictEqual(formatDate('2027-10-18T18:30:00.000Z'), '18 Oct 2027');
    assert.strictEqual(formatDate(new Date(2027, 0, 10)), '10 Jan 2027');
    assert.strictEqual(formatDate(''), '—');
    assert.strictEqual(formatDate(null), '—');
  });

  it('formats times consistently as "9:10 AM" with uppercase AM/PM and no leading hour zero', () => {
    const d1 = new Date(2026, 9, 14, 9, 10, 0);
    assert.strictEqual(formatTime(d1), '9:10 AM');

    const d2 = new Date(2026, 9, 14, 14, 5, 0);
    assert.strictEqual(formatTime(d2), '2:05 PM');

    const d3 = new Date(2026, 9, 14, 0, 0, 0);
    assert.strictEqual(formatTime(d3), '12:00 AM');
  });

  it('truncates middle of receipt numbers when longer than max length', () => {
    assert.strictEqual(truncateMiddle('3RGY6XS6-000001', 14), '3RGY6X…000001');
    assert.strictEqual(truncateMiddle('000001', 14), '000001');
  });
});
