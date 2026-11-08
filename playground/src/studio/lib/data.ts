export type DataTable = { headers: string[]; rows: Record<string, string>[] };

export const MAX_ROWS = 5000;

const detectDelimiter = (firstLine: string) => {
  const counts = [',', ';', '\t', '|'].map((d) => [d, firstLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
};

/** RFC 4180-style CSV parser (quoted fields, escaped quotes, CRLF, BOM, auto delimiter). */
export const parseCsv = (input: string): DataTable => {
  const text = input.replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('The CSV file is empty.');
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? '');
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      field = '';
      if (record.some((c) => c.trim() !== '')) records.push(record);
      record = [];
    } else field += ch;
  }
  if (inQuotes) throw new Error('Malformed CSV: a quoted field is never closed.');
  record.push(field);
  if (record.some((c) => c.trim() !== '')) records.push(record);

  if (records.length < 2) throw new Error('The CSV needs a header row and at least one data row.');
  const headers = records[0].map((h, i) => h.trim() || `column_${i + 1}`);
  const seen = new Set<string>();
  const unique = headers.map((h) => {
    let name = h;
    for (let n = 2; seen.has(name); n += 1) name = `${h}_${n}`;
    seen.add(name);
    return name;
  });
  const rows = records.slice(1).map((r) => {
    const row: Record<string, string> = {};
    unique.forEach((h, i) => {
      row[h] = r[i] ?? '';
    });
    return row;
  });
  return { headers: unique, rows };
};

const toStr = (v: unknown): string =>
  v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

/** Accepts an array of objects, `{ data|rows|records: [...] }`, or a single object. */
export const parseJsonRecords = (input: string): DataTable => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.replace(/^\uFEFF/, ''));
  } catch (e) {
    throw new Error(`Malformed JSON: ${(e as Error).message}`);
  }
  let list: unknown = parsed;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const key = ['data', 'rows', 'records', 'items'].find((k) => Array.isArray(obj[k]));
    list = key ? obj[key] : [parsed];
  }
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('JSON must be a non-empty array of objects.');
  }
  const headers: string[] = [];
  const rows = list.map((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Item ${idx + 1} is not an object.`);
    }
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (!headers.includes(k)) headers.push(k);
      row[k] = toStr(v);
    }
    return row;
  });
  for (const row of rows) for (const h of headers) row[h] ??= '';
  return { headers, rows };
};

export const parseDataFile = async (file: File): Promise<DataTable> => {
  const text = await file.text();
  const isJson = /\.json$/i.test(file.name) || file.type === 'application/json';
  const table = isJson ? parseJsonRecords(text) : parseCsv(text);
  if (table.rows.length > MAX_ROWS) {
    throw new Error(
      `This file has ${table.rows.length} rows; the limit is ${MAX_ROWS} per run. Split it and run in batches.`,
    );
  }
  return table;
};

export const fillTemplate = (pattern: string, row: Record<string, string>, index: number) =>
  pattern.replace(/\{([^}]+)\}/g, (_, key: string) =>
    key === 'index' ? String(index + 1).padStart(3, '0') : (row[key.trim()] ?? ''),
  );
