/** Same currency format as the web app (USD, en-US); other currencies get their ISO code as prefix. */
export function money(value: number, currency = 'USD') {
  // Intl currency formatting is not reliable on every Hermes build, so format by hand.
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const [whole, cents] = abs.toFixed(2).split('.');
  const symbol = currency.toUpperCase() === 'USD' ? '$' : `${currency.toUpperCase()} `;
  return `${sign}${symbol}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

export function timeAgo(value: string | number | Date) {
  const d = new Date(value);
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const digitsOnly = (s: string) => s.replace(/\D/g, '');
