/**
 * Parse user-entered euro amount (pt-PT friendly) into integer cents, or null if invalid.
 */
export function parseEuroInputToCents(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return 0;
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = t;
  } else if (lastComma > lastDot) {
    normalized = t.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = t.replace(/,/g, '');
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  const cents = Math.round(n * 100);
  if (!Number.isFinite(cents) || cents > 99_999_999) return null;
  return cents;
}

export function formatPriceFromCents(cents: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/** String for form initial value from stored cents (empty when zero). */
export function centsToEuroFormString(cents: number): string {
  if (cents <= 0) return '';
  return (cents / 100).toLocaleString('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
