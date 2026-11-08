import { generate } from '@pdfme/generator';
import { getDefaultFont, getInputFromTemplate, type Font, type Template } from '@pdfme/common';
import { getPlugins } from '../../plugins';
import { listFonts } from './db';
import type { StudioSettings } from './settings';

/** Fonts available offline: bundled default font plus fonts the user uploaded in Settings. */
export const getStudioFonts = async (defaultFont = 'Roboto'): Promise<Font> => {
  const font: Font = { ...getDefaultFont() };
  try {
    for (const f of await listFonts()) {
      font[f.name] = { data: new Uint8Array(f.data), fallback: false };
    }
  } catch (e) {
    console.error('Could not load custom fonts', e);
  }
  if (font[defaultFont]) {
    for (const key of Object.keys(font)) font[key] = { ...font[key], fallback: key === defaultFont };
  }
  return font;
};

export type GenerateArgs = {
  template: Template;
  inputs?: Record<string, string>[];
  settings?: Pick<StudioSettings, 'defaultFont' | 'pdfAuthor'>;
  title?: string;
};

export const generatePdf = async ({
  template,
  inputs,
  settings,
  title,
}: GenerateArgs): Promise<Uint8Array> =>
  generate({
    template,
    inputs: inputs && inputs.length ? inputs : getInputFromTemplate(template),
    options: {
      font: await getStudioFonts(settings?.defaultFont),
      title: title ?? 'NexVora PDF',
      ...(settings?.pdfAuthor ? { author: settings.pdfAuthor } : {}),
    },
    plugins: getPlugins(),
  });

const toPart = (data: Uint8Array) => new Uint8Array(data); // copy so Blob never sees a larger buffer

export const pdfBlob = (data: Uint8Array) => new Blob([toPart(data)], { type: 'application/pdf' });

export const sanitizeFilename = (name: string, fallback = 'document') => {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120);
  return cleaned || fallback;
};

export const withExt = (name: string, ext: string) =>
  name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;

export const applyFilenamePattern = (pattern: string, title: string) =>
  sanitizeFilename(
    (pattern || '{title}')
      .replace(/\{title\}/g, title)
      .replace(/\{date\}/g, new Date().toISOString().slice(0, 10)),
    'document',
  );

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const openBlob = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return Boolean(win);
};

export const deliverPdf = (data: Uint8Array, filename: string, mode: 'download' | 'open') => {
  const blob = pdfBlob(data);
  const name = withExt(sanitizeFilename(filename), 'pdf');
  if (mode === 'open' && openBlob(blob)) return;
  downloadBlob(blob, name);
};

export const downloadJson = (value: unknown, filename: string) =>
  downloadBlob(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
    withExt(sanitizeFilename(filename), 'json'),
  );

export const readFileBuffer = (file: File) => file.arrayBuffer();
export const readFileText = (file: File) => file.text();

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

/* ---------- Minimal ZIP writer (store method, no compression, UTF-8 names) ---------- */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export type ZipEntry = { name: string; data: Uint8Array };

export const makeZip = (entries: ZipEntry[]): Blob => {
  if (entries.length === 0) throw new Error('Nothing to add to the ZIP file.');
  if (entries.length > 65535) throw new Error('A ZIP file can hold at most 65,535 files.');
  const enc = new TextEncoder();
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, toPart(entry.data));

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, dosTime, true);
    c.setUint16(14, dosDate, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, size, true);
    c.setUint32(24, size, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    const record = new Uint8Array(46 + name.length);
    record.set(new Uint8Array(c.buffer), 0);
    record.set(name, 46);
    central.push(record);
    offset += 30 + name.length + size;
  }

  const centralSize = central.reduce((n, r) => n + r.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  parts.push(...central.map(toPart), new Uint8Array(end.buffer));
  return new Blob(parts, { type: 'application/zip' });
};

/** Make file names unique inside one ZIP by appending -2, -3, … */
export const uniqueName = (name: string, used: Set<string>) => {
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase());
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}${ext}`;
    if (!used.has(candidate.toLowerCase())) {
      used.add(candidate.toLowerCase());
      return candidate;
    }
  }
};
