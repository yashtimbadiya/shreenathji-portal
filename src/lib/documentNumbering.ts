export function formatDocumentNumber(prefix: string, serial: number, date = new Date()): string {
  const year = String(date.getFullYear());
  const yearPattern = /Y{4}/;
  const serialPattern = /#+/;
  const expandedPrefix = prefix.replace(yearPattern, year);
  const match = expandedPrefix.match(serialPattern);
  if (!match) return `${expandedPrefix}${serial}`;
  return expandedPrefix.replace(serialPattern, String(serial).padStart(match[0].length, '0'));
}

export function getDocumentSerial(
  value: string,
  prefix: string,
  date = new Date(),
): number | null {
  const year = String(date.getFullYear());
  const expandedPrefix = prefix.replace(/Y{4}/, year);
  const match = expandedPrefix.match(/#+/);
  if (!match) return null;
  const start = expandedPrefix.slice(0, match.index);
  const end = expandedPrefix.slice((match.index ?? 0) + match[0].length);
  const pattern = new RegExp(`^${escapeRegExp(start)}(\\d+)${escapeRegExp(end)}$`);
  const serial = value.match(pattern)?.[1];
  return serial ? Number.parseInt(serial, 10) : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}
