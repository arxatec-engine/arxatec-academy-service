const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export const csvCell = (value: string | number | null): string => {
  const raw = value === null ? '' : String(value);
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const writeCsv = (rows: readonly (readonly (string | number | null)[])[]): Buffer =>
  Buffer.from(`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`, 'utf8');
