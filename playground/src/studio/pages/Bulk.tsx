import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Download } from 'lucide-react';
import { useProjects } from '../lib/useProjects';
import { useSelectedProject } from '../lib/useSelectedProject';
import { useSettings } from '../lib/settings';
import ProjectSelect from '../components/ProjectSelect';
import { Alert, FilePicker, errMsg } from '../components/ui';
import { fillTemplate, parseDataFile, type DataTable } from '../lib/data';
import { getTemplateFields, initialValues } from '../lib/fields';
import {
  deliverPdf, downloadBlob, generatePdf, makeZip, pdfBlob, sanitizeFilename, uniqueName, withExt, type ZipEntry,
} from '../lib/pdfIO';

type Mode = 'zip' | 'separate' | 'combined';
const MAX_TOTAL_BYTES = 700 * 1024 * 1024;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export default function Bulk() {
  const { settings } = useSettings();
  const { projects, loading } = useProjects();
  const { selected, select } = useSelectedProject(projects);
  const [table, setTable] = useState<DataTable | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [pattern, setPattern] = useState('{index}');
  const [mode, setMode] = useState<Mode>('zip');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<string[]>([]);
  const cancel = useRef(false);

  const fields = selected ? getTemplateFields(selected.template) : [];

  // auto-map by case-insensitive name whenever the data or template changes
  useEffect(() => {
    if (!table || !selected) return;
    const next: Record<string, string> = {};
    for (const f of fields) {
      const hit = table.headers.find((h) => h.toLowerCase() === f.name.toLowerCase());
      if (hit) next[f.name] = hit;
    }
    setMapping(next);
    setPattern((p) => (p === '{index}' && table.headers[0] ? `${selected.title}-{index}` : p));
  }, [table, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async (files: File[]) => {
    setError(''); setReport([]);
    try { setTable(await parseDataFile(files[0])); setFileName(files[0].name); }
    catch (e) { setTable(null); setError(errMsg(e)); }
  };

  const mappedCount = Object.keys(mapping).length;
  const missingByField = table
    ? Object.fromEntries(Object.entries(mapping).map(([f, col]) => [f, table.rows.filter((r) => !(r[col] ?? '').trim()).length]))
    : {};

  const run = async () => {
    if (!selected || !table) return;
    if (mappedCount === 0) return setError('Map at least one template field to a data column.');
    setError(''); setReport([]); setRunning(true); setProgress(0); cancel.current = false;
    const defaults = initialValues(selected.template);
    const rows = table.rows;
    const used = new Set<string>();
    const zipEntries: ZipEntry[] = [];
    const problems: string[] = [];
    const inputsForCombined: Record<string, string>[] = [];
    let bytes = 0;
    let ok = 0;
    try {
      for (let i = 0; i < rows.length; i += 1) {
        if (cancel.current) { problems.push('Stopped by user.'); break; }
        const row = rows[i];
        const input: Record<string, string> = { ...defaults };
        for (const [fieldName, col] of Object.entries(mapping)) input[fieldName] = row[col] ?? '';
        try {
          if (mode === 'combined') { inputsForCombined.push(input); ok += 1; }
          else {
            const data = await generatePdf({ template: selected.template, inputs: [input], settings, title: selected.title });
            bytes += data.length;
            if (bytes > MAX_TOTAL_BYTES) throw new Error('Output is too large for browser memory. Process fewer rows per run.');
            const name = uniqueName(withExt(sanitizeFilename(fillTemplate(pattern, row, i), `document-${i + 1}`), 'pdf'), used);
            if (mode === 'zip') zipEntries.push({ name, data });
            else { deliverPdf(data, name, 'download'); await new Promise((r) => setTimeout(r, 350)); }
            ok += 1;
          }
        } catch (e) { problems.push(`Row ${i + 1}: ${errMsg(e)}`); if (/too large/.test(errMsg(e))) break; }
        setProgress(Math.round(((i + 1) / rows.length) * 100));
        if (i % 3 === 2) await tick();
      }
      if (ok > 0) {
        if (mode === 'zip') {
          if (problems.length) zipEntries.push({ name: '_report.txt', data: new TextEncoder().encode(problems.join('\n')) });
          downloadBlob(makeZip(zipEntries), `${sanitizeFilename(selected.title)}-bulk.zip`);
        } else if (mode === 'combined') {
          const data = await generatePdf({ template: selected.template, inputs: inputsForCombined, settings, title: selected.title });
          downloadBlob(pdfBlob(data), `${sanitizeFilename(selected.title)}-combined.pdf`);
        }
        toast.success(`Generated ${ok} of ${rows.length} PDF${rows.length > 1 ? 's' : ''}`);
      } else toast.error('No PDFs could be generated.');
    } catch (e) { setError(errMsg(e)); } finally { setReport(problems); setRunning(false); }
  };

  return (
    <div className="nx-page">
      <h1 className="nx-h1">Bulk PDF Generator</h1>
      <p className="nx-sub">Upload a CSV or JSON file, map columns to template fields, and generate one PDF per row — as a ZIP, as separate downloads, or as one combined PDF. Everything runs in your browser.</p>
      <div style={{ marginTop: 16 }}><ProjectSelect projects={projects} value={selected?.id ?? ''} onChange={select} loading={loading} /></div>

      {selected && (
        <div className="nx-card" style={{ marginTop: 16 }}>
          <h2 className="nx-h2">1. Data file</h2>
          <FilePicker accept=".csv,.json,text/csv,application/json" label="Click or drop a CSV / JSON file" onFiles={(f) => void load(f)} />
          <p className="nx-muted" style={{ marginTop: 8 }}>CSV: first row = headers; comma, semicolon, tab or pipe separated. JSON: an array of flat objects. Limit 5,000 rows per run.</p>
          {error && <div style={{ marginTop: 10 }}><Alert kind="err">{error}</Alert></div>}
        </div>
      )}

      {selected && table && (
        <>
          <div className="nx-card" style={{ marginTop: 16 }}>
            <h2 className="nx-h2">2. Preview — {fileName} ({table.rows.length} rows, {table.headers.length} columns)</h2>
            <div className="nx-table-wrap" style={{ maxHeight: 260 }}><table className="nx-table">
              <thead><tr><th>#</th>{table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{table.rows.slice(0, 10).map((r, i) => <tr key={i}><td>{i + 1}</td>{table.headers.map((h) => <td key={h} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r[h]}</td>)}</tr>)}</tbody>
            </table></div>
            {table.rows.length > 10 && <p className="nx-muted">Showing first 10 rows.</p>}
          </div>

          <div className="nx-card" style={{ marginTop: 16 }}>
            <h2 className="nx-h2">3. Map columns to template fields</h2>
            {fields.length === 0 ? <Alert kind="err">This template has no editable fields. Add fields in the Designer first.</Alert> : (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                {fields.map((f) => (
                  <div key={f.name} className="nx-field">
                    <label htmlFor={`m-${f.name}`}>{f.name} <span style={{ opacity: .6 }}>({f.type})</span></label>
                    <select id={`m-${f.name}`} className="nx-select" value={mapping[f.name] ?? ''}
                      onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value) n[f.name] = e.target.value; else delete n[f.name]; return n; })}>
                      <option value="">— keep template default —</option>
                      {table.headers.map((h) => <option key={h}>{h}</option>)}
                    </select>
                    {missingByField[f.name] > 0 && <span className="nx-err">{missingByField[f.name]} row(s) have an empty value</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="nx-card" style={{ marginTop: 16 }}>
            <h2 className="nx-h2">4. Output</h2>
            <div className="nx-row" style={{ alignItems: 'flex-end' }}>
              <div className="nx-field" style={{ flex: '1 1 260px' }}>
                <label htmlFor="nx-pattern">File name pattern (use {'{Column}'} and {'{index}'})</label>
                <input id="nx-pattern" className="nx-input" value={pattern} onChange={(e) => setPattern(e.target.value)} />
                <span className="nx-muted">Example: {table.rows[0] ? fillTemplate(pattern, table.rows[0], 0) : ''}.pdf</span>
              </div>
              <div className="nx-field">
                <label htmlFor="nx-mode">Delivery</label>
                <select id="nx-mode" className="nx-select" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                  <option value="zip">ZIP of individual PDFs</option>
                  <option value="separate">Separate downloads (browser may ask permission)</option>
                  <option value="combined">One combined PDF</option>
                </select>
              </div>
              <button className="nx-btn primary" disabled={running || fields.length === 0} onClick={() => void run()}><Download size={16} /> Generate {table.rows.length} PDF{table.rows.length > 1 ? 's' : ''}</button>
              {running && <button className="nx-btn" onClick={() => { cancel.current = true; }}>Stop</button>}
            </div>
            {(running || progress > 0) && <div className="nx-progress" style={{ marginTop: 14 }} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${progress}%` }} /></div>}
            {report.length > 0 && <div style={{ marginTop: 12 }}><Alert kind="err"><strong>{report.length} issue(s):</strong><ul style={{ margin: '6px 0 0 18px' }}>{report.slice(0, 20).map((r, i) => <li key={i}>{r}</li>)}</ul>{report.length > 20 && <div>…and {report.length - 20} more (see _report.txt in the ZIP).</div>}</Alert></div>}
          </div>
        </>
      )}
    </div>
  );
}
