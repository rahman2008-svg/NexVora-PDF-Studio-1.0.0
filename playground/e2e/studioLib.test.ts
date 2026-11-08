import { checkTemplate, getInputFromTemplate } from '@pdfme/common';
import { fillTemplate, parseCsv, parseJsonRecords } from '../src/studio/lib/data';
import { LIBRARY } from '../src/studio/lib/library';
import { crc32 } from '../src/studio/lib/pdfIO';

describe('NexVora template library', () => {
  it('ships valid PDFme templates with unique field names', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(20);
    for (const entry of LIBRARY) {
      const template = entry.build();
      expect(() => checkTemplate(template), entry.id).not.toThrow();
      const names = template.schemas[0].map((s) => s.name);
      expect(new Set(names).size, entry.id).toBe(names.length);
      expect(getInputFromTemplate(template)).toHaveLength(1);
    }
  });
});

describe('NexVora data import', () => {
  it('parses quoted CSV with auto-detected delimiter', () => {
    const t = parseCsv('\uFEFFname;city\r\n"Smith, J";"Dhaka ""BD"""\r\nRoy;Rajshahi\r\n');
    expect(t.headers).toEqual(['name', 'city']);
    expect(t.rows[0]).toEqual({ name: 'Smith, J', city: 'Dhaka "BD"' });
    expect(t.rows).toHaveLength(2);
  });
  it('rejects malformed CSV and JSON', () => {
    expect(() => parseCsv('a,b\n"x,1')).toThrow(/Malformed/);
    expect(() => parseCsv('')).toThrow(/empty/);
    expect(() => parseJsonRecords('{bad')).toThrow(/Malformed JSON/);
    expect(() => parseJsonRecords('[1]')).toThrow(/not an object/);
  });
  it('flattens JSON records and fills filename patterns', () => {
    const t = parseJsonRecords('{"data":[{"x":1,"y":null},{"x":"b","z":{"k":1}}]}');
    expect(t.headers).toEqual(['x', 'y', 'z']);
    expect(t.rows[1].z).toBe('{"k":1}');
    expect(fillTemplate('{x}-{index}', { x: 'A' }, 4)).toBe('A-005');
  });
  it('computes CRC32 correctly for ZIP output', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});
