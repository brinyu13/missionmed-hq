const STRICT_RFC3339_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):([0-5]\d))$/u;

/**
 * Parse RFC 3339 without JavaScript Date's silent calendar rollover.
 * The original string remains the wire value; this helper only proves that
 * its calendar date, clock, fractional precision, and offset are valid.
 */
export function parseStrictRfc3339(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(STRICT_RFC3339_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const offsetHours = match[8] === 'Z' ? 0 : Number(match[10]);
  const offsetMinutes = match[8] === 'Z' ? 0 : Number(match[11]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (
    year < 1
    || month < 1
    || month > 12
    || day < 1
    || day > monthLengths[month - 1]
    || offsetHours > 14
    || (offsetHours === 14 && offsetMinutes !== 0)
  ) return null;

  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export function isStrictRfc3339(value) {
  return parseStrictRfc3339(value) !== null;
}
