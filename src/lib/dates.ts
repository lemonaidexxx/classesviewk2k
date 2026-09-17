import type { Cell, CountValue, DateValue } from './model';

export function text(cell?: Cell): string {
  return (
    cell?.formattedValue ??
    String(
      cell?.effectiveValue?.stringValue ??
        cell?.effectiveValue?.numberValue ??
        cell?.effectiveValue?.boolValue ??
        '',
    )
  );
}
const months = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
function monthNumber(name: string): number {
  return (
    months.findIndex((m) => m === name.toLowerCase() || m.slice(0, 3) === name.toLowerCase()) + 1
  );
}
function dayValue(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? d.toISOString().slice(0, 10)
    : null;
}
export function parseDate(cell: Cell | undefined, ref: string, locale = 'en_US'): DateValue {
  const raw = text(cell),
    s = raw.trim();
  const result = (kind: DateValue['kind'], value: string | null = null): DateValue => ({
    raw,
    cell: ref,
    kind,
    value,
  });
  if (cell?.effectiveValue?.errorValue) return result('invalid');
  if (!s) return result('missing');
  if (/^(TBA|TO BE DETERMINED|TBD)$/i.test(s)) return result('pending');
  const format = cell?.effectiveFormat?.numberFormat;
  const serial = cell?.effectiveValue?.numberValue;
  if (serial !== undefined && format?.type?.startsWith('DATE')) {
    if (!Number.isFinite(serial)) return result('invalid');
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
    if (!Number.isFinite(d.getTime()) || d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100)
      return result('invalid');
    // Respect visible precision even if the underlying serial contains a hidden day.
    const pattern = (format.pattern ?? '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    if (/m/i.test(pattern) && /y/i.test(pattern) && !/d/i.test(pattern))
      return result('month', d.toISOString().slice(0, 7));
    if (!/d/i.test(pattern)) return result('invalid');
    return result('day', d.toISOString().slice(0, 10));
  }
  let m: RegExpMatchArray | null;
  let y = 0,
    mo = 0,
    day = 0;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [y, mo, day] = m.slice(1).map(Number);
  else if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/))) {
    day = +m[1];
    mo = monthNumber(m[2]);
    y = +m[3];
  } else if ((m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/))) {
    mo = monthNumber(m[1]);
    day = +m[2];
    y = +m[3];
  } else if ((m = s.match(/^([A-Za-z]+)\s+(\d{4})$/))) {
    mo = monthNumber(m[1]);
    y = +m[2];
    return mo && y >= 1900 && y <= 2100
      ? result('month', `${y}-${String(mo).padStart(2, '0')}`)
      : result('invalid');
  } else if ((m = s.match(/^(\d{4})-(\d{2})$/))) {
    y = +m[1];
    mo = +m[2];
    return dayValue(y, mo, 1) ? result('month', s) : result('invalid');
  } else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    const a = +m[1],
      b = +m[2];
    // Deliberately reject numeric text that can be read as both day/month and month/day.
    if (a <= 12 && b <= 12 && a !== b) return result('invalid');
    if (locale === 'en_US') {
      mo = a;
      day = b;
    } else if (['en_GB', 'en_AU', 'en_PH'].includes(locale)) {
      day = a;
      mo = b;
    } else return result('invalid');
    y = +m[3];
  } else return result('invalid');
  const value = dayValue(y, mo, day);
  return value ? result('day', value) : result('invalid');
}
export function parseCount(cell: Cell | undefined, ref: string): CountValue {
  const raw = text(cell),
    s = raw.trim();
  if (cell?.effectiveValue?.errorValue) return { raw, cell: ref, value: null, kind: 'invalid' };
  if (!s) return { raw, cell: ref, value: null, kind: 'missing' };
  const numeric = cell?.effectiveValue?.numberValue;
  const value =
    numeric ?? (/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s) ? Number(s.replaceAll(',', '')) : NaN);
  return Number.isSafeInteger(value) && value >= 0
    ? { raw, cell: ref, value, kind: 'valid' }
    : { raw, cell: ref, value: null, kind: 'invalid' };
}
export function dateBounds(date: DateValue): [string, string] | null {
  if (!date.value) return null;
  if (date.kind === 'day') return [date.value, date.value];
  if (date.kind !== 'month') return null;
  const [y, m] = date.value.split('-').map(Number);
  return [`${date.value}-01`, `${date.value}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`];
}
export function reportingDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join('-');
}
export function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
}
export function displayDate(value: DateValue): string {
  if (!value.value) return value.raw.trim() || 'Not recorded';
  const d = new Date(`${value.value}${value.kind === 'month' ? '-01' : ''}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    ...(value.kind === 'day' ? { day: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(d);
}
