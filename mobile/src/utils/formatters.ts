/**
 * Single shared Indian currency and date/time formatters.
 * Formats paise or rupees with Indian grouping (e.g. ₹4,000 and ₹1,25,000) and exactly one rupee sign.
 * Formats dates consistently as "10 Jan 2027" and times as "9:10 AM".
 */

export function formatMoney(paise: number | string | undefined | null = 0): string {
  let numPaise = 0;
  if (typeof paise === 'string') {
    const cleaned = paise.replace(/₹/g, '').replace(/,/g, '').trim();
    numPaise = Number(cleaned);
  } else {
    numPaise = Number(paise);
  }
  if (isNaN(numPaise)) numPaise = 0;
  const rupees = Math.round(numPaise / 100);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

export function formatRupees(rupees: number | string | undefined | null = 0): string {
  let val = 0;
  if (typeof rupees === 'string') {
    const cleaned = rupees.replace(/₹/g, '').replace(/,/g, '').trim();
    val = Number(cleaned);
  } else {
    val = Number(rupees);
  }
  if (isNaN(val)) val = 0;
  const rounded = Math.round(val);
  return `₹${rounded.toLocaleString('en-IN')}`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Formats any date string or Date object as "10 Jan 2027".
 * Never displays raw ISO strings.
 */
export function formatDate(input?: string | Date | null): string {
  if (!input) return '—';
  try {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return '—';

      // Match YYYY-MM-DD directly to prevent timezone skew on date-only strings
      const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(trimmed);
      if (ymdMatch) {
        const y = parseInt(ymdMatch[1], 10);
        const m = parseInt(ymdMatch[2], 10) - 1;
        const d = parseInt(ymdMatch[3], 10);
        if (m >= 0 && m < 12) {
          return `${d} ${MONTH_NAMES[m]} ${y}`;
        }
      }

      const d = new Date(trimmed);
      if (isNaN(d.getTime())) return '—';
      return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }

    if (isNaN(input.getTime())) return '—';
    return `${input.getDate()} ${MONTH_NAMES[input.getMonth()]} ${input.getFullYear()}`;
  } catch {
    return '—';
  }
}

/**
 * Formats any time (ISO string or Date) as "9:10 AM" (12-hour, no leading zero on hour, uppercase AM/PM).
 */
export function formatTime(input?: string | Date | null): string {
  if (!input) return '';
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return '';
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minStr} ${ampm}`;
  } catch {
    return '';
  }
}

/**
 * Truncate long strings (like receipt numbers) in the middle: e.g. "3RGY6XS…00001".
 */
export function truncateMiddle(str?: string | null, maxLength: number = 14): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  const keep = Math.max(1, Math.floor((maxLength - 1) / 2));
  return `${str.slice(0, keep)}…${str.slice(-keep)}`;
}

export function isPhoneMasked(phone?: string | null): boolean {
  if (!phone) return false;
  return phone.toUpperCase().includes('X') || phone.includes('*');
}

export default {
  formatMoney,
  formatRupees,
  formatDate,
  formatTime,
  truncateMiddle,
  isPhoneMasked,
};
