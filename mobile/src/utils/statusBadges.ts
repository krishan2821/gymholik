export type StatusType =
  | 'active'
  | 'upcoming'
  | 'expiring'
  | 'expired'
  | 'due'
  | 'paid'
  | 'success'
  | 'warning'
  | 'danger'
  | 'error'
  | 'info'
  | 'neutral';

export function getStatusBadgeVariant(status?: string | null): StatusType {
  if (!status) return 'neutral';
  const s = status.toUpperCase();
  if (s.includes('ACTIVE')) return 'active';
  if (s.includes('UPCOMING')) return 'upcoming';
  if (s.includes('EXPIRING')) return 'expiring';
  if (s.includes('EXPIRED')) return 'expired';
  if (s.includes('DUE')) return 'due';
  if (s.includes('PAID')) return 'paid';
  if (s.includes('SUCCESS')) return 'success';
  if (s.includes('DANGER') || s.includes('ERROR') || s.includes('REVERS')) return 'danger';
  if (s.includes('WARN')) return 'warning';
  return 'neutral';
}
