export interface DateRange {
  start: string;
  end: string;
}

export function localToday(now = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function formatIsoToPtBr(value: string): string {
  if (!isValidIsoDate(value)) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function parsePtBrDateStrict(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const numericYear = Number(year);
  if (numericYear < 2000 || numericYear > 2100) return null;
  const iso = `${year}-${month}-${day}`;
  return isValidIsoDate(iso) ? iso : null;
}

export function addDays(value: string, amount: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function monthRange(year: number, month: number): DateRange {
  const start = toIso(year, month, 1);
  return { start, end: addDays(toIso(year, month + 1, 1), -1) };
}

export function validateRange(range: DateRange): string | null {
  if (!isValidIsoDate(range.start) || !isValidIsoDate(range.end)) return 'Informe datas válidas.';
  if (range.start > range.end) return 'A data final deve ser igual ou posterior à inicial.';
  const [startYear, startMonth, startDay] = range.start.split('-').map(Number);
  const [endYear, endMonth, endDay] = range.end.split('-').map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return days > 366 ? 'O período máximo é de 366 dias.' : null;
}
