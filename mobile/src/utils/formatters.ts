/**
 * Single shared Indian currency formatter.
 * Formats paise or rupees with Indian grouping (e.g. ₹4,000 and ₹1,25,000) and the rupee sign.
 */

export function formatMoney(paise: number | undefined | null = 0): string {
  const rupees = Math.round((Number(paise) || 0) / 100);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

export function formatRupees(rupees: number | undefined | null = 0): string {
  const val = Math.round(Number(rupees) || 0);
  return `₹${val.toLocaleString('en-IN')}`;
}

export function isPhoneMasked(phone?: string | null): boolean {
  if (!phone) return false;
  return phone.toUpperCase().includes('X') || phone.includes('*');
}

export default {
  formatMoney,
  formatRupees,
  isPhoneMasked,
};
