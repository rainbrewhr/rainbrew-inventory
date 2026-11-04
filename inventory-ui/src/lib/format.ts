const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const fmtQty = (n: number): string => qty.format(n);
export const fmtDelta = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${qty.format(Math.abs(n))}`;

const dateTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fmtDateTime = (iso: string): string => dateTime.format(new Date(iso));

export function fmtRelative(iso: string, now: number = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days}d ago` : fmtDateTime(iso);
}
