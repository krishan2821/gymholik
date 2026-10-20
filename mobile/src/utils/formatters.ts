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

const istDateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const istTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function parseToISTDate(input?: string | Date | number | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(`${trimmed}T00:00:00+05:30`);
      return isNaN(d.getTime()) ? null : d;
    }
    // Has explicit timezone (Z or +HH:MM or -HH:MM)
    if (/T.*(Z|[+-]\d{2}(?::?\d{2})?)$/i.test(trimmed)) {
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }
    // Datetime without offset, treat as IST
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed)) {
      const d = new Date(`${trimmed.replace(' ', 'T')}+05:30`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Formats any date string or Date object as "12 Oct 2026" strictly in Asia/Kolkata timezone.
 * Never displays raw ISO strings.
 */
export function formatDate(input?: string | Date | number | null): string {
  if (!input) return '—';
  try {
    const d = parseToISTDate(input);
    if (!d) return '—';
    return istDateFormatter.format(d).replace(/,/g, '').trim();
  } catch {
    return '—';
  }
}

/**
 * Formats any time (ISO string or Date) as "9:10 AM" strictly in Asia/Kolkata timezone
 * (12-hour, no leading zero on hour, uppercase AM/PM).
 */
export function formatTime(input?: string | Date | number | null): string {
  if (!input) return '';
  try {
    const d = parseToISTDate(input);
    if (!d) return '';
    return istTimeFormatter.format(d).replace(/\u202f/g, ' ').trim();
  } catch {
    return '';
  }
}

/**
 * Returns today's date in 'YYYY-MM-DD' strictly in Asia/Kolkata timezone.
 */
export function getTodayISTDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Returns yesterday's date in 'YYYY-MM-DD' strictly in Asia/Kolkata timezone.
 */
export function getYesterdayISTDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() - 86400000));
}

/**
 * Returns a future date in 'YYYY-MM-DD' offset by days in Asia/Kolkata timezone.
 */
export function getFutureISTDateString(days: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + days * 86400000));
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
  getTodayISTDateString,
  getYesterdayISTDateString,
  getFutureISTDateString,
  truncateMiddle,
  isPhoneMasked,
};
