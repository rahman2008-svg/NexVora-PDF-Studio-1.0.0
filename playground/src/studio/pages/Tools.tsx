import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'react-toastify';
import { ArrowDown, ArrowUp, Download, RotateCw, Trash2 } from 'lucide-react';
import { pdf2img } from '@pdfme/converter';
import { Alert, FilePicker, errMsg } from '../components/ui';
import { downloadBlob, formatBytes, pdfBlob, sanitizeFilename, makeZip, type ZipEntry } from '../lib/pdfIO';
import {
  arrangePages, copyPagesTo, deletePages, imagesToPdf, loadPdf, mergePdfs, numberPdf, optimizePdf, parseRanges,
  pdfToPngs, readInfo, rotatePages, splitPdf, watermarkPdf, writeInfo,
  type LoadedPdf, type NumberPos, type PageItem,
} from '../lib/pdfTools';

type Result = { blob: Blob; name: string; note?: string };
const base = (n: string) => sanitizeFilename(n.replace(/\.pdf$/i, ''), 'document');

/** Shared run wrapper: processing state, error text, result + download button. */
function useRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const run = async (fn: () => Promise<Result>) => {
    setBusy(true); setError(''); setResult(null);
    try { setResult(await fn()); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const ui = (
    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
      {busy && <Alert>Processing… large files can take a few seconds.</Alert>}
      {error && <Alert kind="err">{error}</Alert>}
      {result && (
        <Alert kind="ok">
          <div className="nx-row" style={{ justifyContent: 'space-between' }}>
            <span>Done — {result.name} ({formatBytes(result.blob.size)}){result.note ? ` • ${result.note}` : ''}</span>
            <button className="nx-btn sm primary" onClick={() => downloadBlob(result.blob, result.name)}><Download size={15} /> Download</button>
          </div>
        </Alert>
      )}
    </div>
  );
  return { busy, run, ui, reset: () => { setResult(null); setError(''); } };
}

function usePdf() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [err, setErr] = useState('');
  const pick = async (files: File[]) => {
    try { setPdf(await loadPdf(files[0])); setErr(''); } catch (e) { setPdf(null); setErr(errMsg(e)); }
  };
  const picker = (
    <>
      <FilePicker accept=".pdf,application/pdf" label={pdf ? `Selected: ${pdf.name} — ${pdf.pages} page(s). Click to change.` : 'Select a PDF file'} onFiles={(f) => void pick(f)} maxMB={150} />
      {err && <div style={{ marginTop: 8 }}><Alert kind="err">{err}</Alert></div>}
    </>
  );
  return { pdf, picker };
}

const Field = ({ label, children, id }: { label: string; children: ReactNode; id: string }) => (
  <div className="nx-field"><label htmlFor={id}>{label}</label>{children}</div>
);

/* ---------------- individual tools ---------------- */
function Merge() {
  const [files, setFiles] = useState<LoadedPdf[]>([]);
  const [err, setErr] = useState('');
  const r = useRunner();
  const add = async (list: File[]) => {
    const next: LoadedPdf[] = [];
    try { for (const f of list) next.push(await loadPdf(f)); setFiles((x) => [...x, ...next]); setErr(''); } catch (e) { setErr(errMsg(e)); }
  };
  const move = (i: number, d: number) => setFiles((f) => { const n = [...f]; const j = i + d; if (j < 0 || j >= n.length) return f; [n[i], n[j]] = [n[j], n[i]]; return n; });
  return (
    <>
      <FilePicker accept=".pdf,application/pdf" multiple label="Add PDF files (select several)" onFiles={(f) => void add(f)} />
      {err && <div style={{ marginTop: 8 }}><Alert kind="err">{err}</Alert></div>}
      {files.length > 0 && (
        <ol style={{ margin: '12px 0', paddingLeft: 20, display: 'grid', gap: 6 }}>
          {files.map((f, i) => (
            <li key={i}><span className="nx-row" style={{ display: 'inline-flex' }}>{f.name} <span className="nx-muted">({f.pages} p)</span>
              <button className="nx-btn sm icon" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
              <button className="nx-btn sm icon" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
              <button className="nx-btn sm icon danger" aria-label="Remove" onClick={() => setFiles((x) => x.filter((_, k) => k !== i))}><Trash2 size={14} /></button></span></li>
          ))}
        </ol>
      )}
      <button className="nx-btn primary" disabled={files.length < 2 || r.busy} onClick={() => void r.run(async () => ({ blob: pdfBlob(await mergePdfs(files)), name: 'merged.pdf', note: `${files.reduce((n, f) => n + f.pages, 0)} pages` }))}>Merge {files.length || ''} PDFs</button>
      {files.length === 1 && <span className="nx-muted"> Add at least one more file.</span>}
      {r.ui}
    </>
  );
}

function Split() {
  const { pdf, picker } = usePdf();
  const [mode, setMode] = useState<'each' | 'ranges'>('ranges');
  const [spec, setSpec] = useState('1-2; 3');
  const r = useRunner();
  return (
    <>
      {picker}
      {pdf && (
        <div className="nx-row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <Field id="sp-mode" label="Split mode"><select id="sp-mode" className="nx-select" value={mode} onChange={(e) => setMode(e.target.value as 'each' | 'ranges')}><option value="ranges">By ranges</option><option value="each">Every page separately</option></select></Field>
          {mode === 'ranges' && <Field id="sp-spec" label={`Ranges (separate files with “;”, pages 1–${pdf.pages})`}><input id="sp-spec" className="nx-input" value={spec} onChange={(e) => setSpec(e.target.value)} /></Field>}
          <button className="nx-btn primary" disabled={r.busy} onClick={() => void r.run(async () => {
            const parts = await splitPdf(pdf, mode, spec, base(pdf.name));
            return parts.length === 1
              ? { blob: pdfBlob(parts[0].data), name: parts[0].name }
              : { blob: makeZip(parts), name: `${base(pdf.name)}-split.zip`, note: `${parts.length} PDFs in ZIP` };
          })}>Split</button>
        </div>
      )}
      {r.ui}
    </>
  );
}

function Pages() {
  const { pdf, picker } = usePdf();
  const [op, setOp] = useState<'extract' | 'delete' | 'rotate'>('extract');
  const [spec, setSpec] = useState('1');
  const [deg, setDeg] = useState<90 | 180 | 270>(90);
  const r = useRunner();
  return (
    <>
      {picker}
      {pdf && (
        <div className="nx-row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <Field id="pg-op" label="Operation"><select id="pg-op" className="nx-select" value={op} onChange={(e) => setOp(e.target.value as typeof op)}><option value="extract">Extract pages</option><option value="delete">Delete pages</option><option value="rotate">Rotate pages</option></select></Field>
          <Field id="pg-spec" label={`Pages (1–${pdf.pages}), e.g. 1-3, 5`}><input id="pg-spec" className="nx-input" value={spec} onChange={(e) => setSpec(e.target.value)} /></Field>
          {op === 'rotate' && <Field id="pg-deg" label="Rotate clockwise"><select id="pg-deg" className="nx-select" value={deg} onChange={(e) => setDeg(Number(e.target.value) as 90 | 180 | 270)}><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option></select></Field>}
          <button className="nx-btn primary" disabled={r.busy} onClick={() => void r.run(async () => {
            const idx = parseRanges(spec, pdf.pages);
            const data = op === 'extract' ? await copyPagesTo(pdf.doc, idx) : op === 'delete' ? await deletePages(pdf, idx) : await rotatePages(pdf, idx, deg);
            return { blob: pdfBlob(data), name: `${base(pdf.name)}-${op}.pdf`, note: `${idx.length} page(s) affected` };
          })}>Apply</button>
        </div>
      )}
      {r.ui}
    </>
  );
}

function Reorder() {
  const { pdf, picker } = usePdf();
  const [items, setItems] = useState<PageItem[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const r = useRunner();
  useEffect(() => {
    if (!pdf) return undefined;
    setItems(pdf.doc.getPageIndices().map((index) => ({ index, rotate: 0, selected: true })));
    setThumbs([]);
    let cancelled = false; const urls: string[] = [];
    if (pdf.pages <= 60) {
      pdf2img(pdf.bytes, { scale: 0.3 }).then((imgs) => {
        if (cancelled) return;
        imgs.forEach((b) => urls.push(URL.createObjectURL(new Blob([new Uint8Array(b)], { type: 'image/png' }))));
        setThumbs([...urls]);
      }).catch((e) => console.warn('Thumbnails unavailable', e));
    }
    return () => { cancelled = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [pdf]);
  const move = (i: number, d: number) => setItems((a) => { const n = [...a]; const j = i + d; if (j < 0 || j >= n.length) return a; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const upd = (i: number, p: Partial<PageItem>) => setItems((a) => a.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <>
      {picker}
      {pdf && <p className="nx-muted" style={{ marginTop: 10 }}>Reorder, rotate or remove pages, tick the pages to keep, then export. {pdf.pages > 60 && 'Thumbnails are skipped for documents over 60 pages.'}</p>}
      <div className="nx-grid sm" style={{ marginTop: 8 }}>
        {items.map((it, i) => (
          <div key={it.index} className="nx-card" style={{ padding: 10, opacity: it.selected ? 1 : 0.45 }}>
            <div className="nx-thumb" style={{ aspectRatio: '0.75' }}>
              {thumbs[it.index] ? <img src={thumbs[it.index]} alt={`Page ${it.index + 1}`} style={{ transform: `rotate(${it.rotate}deg)` }} /> : `Page ${it.index + 1}`}
            </div>
            <div className="nx-row" style={{ marginTop: 6, gap: 4 }}>
              <input type="checkbox" aria-label={`Keep page ${it.index + 1}`} style={{ width: 18, height: 18 }} checked={it.selected} onChange={(e) => upd(i, { selected: e.target.checked })} />
              <span className="nx-muted" style={{ flex: 1 }}>#{it.index + 1}</span>
              <button className="nx-btn sm icon" aria-label="Move earlier" onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
              <button className="nx-btn sm icon" aria-label="Move later" onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
              <button className="nx-btn sm icon" aria-label="Rotate 90°" onClick={() => upd(i, { rotate: (it.rotate + 90) % 360 })}><RotateCw size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {pdf && <button className="nx-btn primary" style={{ marginTop: 12 }} disabled={r.busy || !items.some((x) => x.selected)} onClick={() => void r.run(async () => {
        const keep = items.filter((x) => x.selected);
        return { blob: pdfBlob(await arrangePages(pdf, keep)), name: `${base(pdf.name)}-organized.pdf`, note: `${keep.length} of ${items.length} pages` };
      })}>Export arranged PDF</button>}
      {r.ui}
    </>
  );
}

function Watermark() {
  const { pdf, picker } = usePdf();
  const [o, setO] = useState({ text: 'CONFIDENTIAL', size: 60, opacity: 0.25, angle: 45, color: '#8B5CF6', spec: '' });
  const r = useRunner();
  return (
    <>
      {picker}
      {pdf && (
        <div className="nx-grid sm" style={{ marginTop: 12, alignItems: 'end' }}>
          <Field id="wm-t" label="Text (Latin characters)"><input id="wm-t" className="nx-input" value={o.text} onChange={(e) => setO({ ...o, text: e.target.value })} /></Field>
          <Field id="wm-s" label="Font size"><input id="wm-s" className="nx-input" type="number" min={8} max={300} value={o.size} onChange={(e) => setO({ ...o, size: Number(e.target.value) })} /></Field>
          <Field id="wm-o" label="Opacity (0–1)"><input id="wm-o" className="nx-input" type="number" min={0.05} max={1} step={0.05} value={o.opacity} onChange={(e) => setO({ ...o, opacity: Number(e.target.value) })} /></Field>
          <Field id="wm-a" label="Angle (°)"><input id="wm-a" className="nx-input" type="number" min={-180} max={180} value={o.angle} onChange={(e) => setO({ ...o, angle: Number(e.target.value) })} /></Field>
          <Field id="wm-c" label="Colour"><input id="wm-c" className="nx-input" type="color" value={o.color} onChange={(e) => setO({ ...o, color: e.target.value })} /></Field>
          <Field id="wm-p" label="Pages (blank = all)"><input id="wm-p" className="nx-input" value={o.spec} onChange={(e) => setO({ ...o, spec: e.target.value })} /></Field>
          <button className="nx-btn primary" disabled={r.busy} onClick={() => void r.run(async () => {
            const indices = o.spec.trim() ? parseRanges(o.spec, pdf.pages) : pdf.doc.getPageIndices();
            return { blob: pdfBlob(await watermarkPdf(pdf, { ...o, indices })), name: `${base(pdf.name)}-watermarked.pdf` };
          })}>Add watermark</button>
        </div>
      )}
      {r.ui}
    </>
  );
}

function Numbering() {
  const { pdf, picker } = usePdf();
  const [o, setO] = useState({ format: 'Page {n} of {total}', pos: 'bottom-center' as NumberPos, size: 10, margin: 24, start: 1 });
  const r = useRunner();
  return (
    <>
      {picker}
      {pdf && (
        <div className="nx-grid sm" style={{ marginTop: 12, alignItems: 'end' }}>
          <Field id="pn-f" label="Format ({n}, {total})"><input id="pn-f" className="nx-input" value={o.format} onChange={(e) => setO({ ...o, format: e.target.value })} /></Field>
          <Field id="pn-p" label="Position"><select id="pn-p" className="nx-select" value={o.pos} onChange={(e) => setO({ ...o, pos: e.target.value as NumberPos })}>
            {(['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'] as const).map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field id="pn-s" label="Font size"><input id="pn-s" className="nx-input" type="number" min={6} max={48} value={o.size} onChange={(e) => setO({ ...o, size: Number(e.target.value) })} /></Field>
          <Field id="pn-m" label="Margin (pt)"><input id="pn-m" className="nx-input" type="number" min={4} max={200} value={o.margin} onChange={(e) => setO({ ...o, margin: Number(e.target.value) })} /></Field>
          <Field id="pn-st" label="Start at"><input id="pn-st" className="nx-input" type="number" min={0} value={o.start} onChange={(e) => setO({ ...o, start: Number(e.target.value) })} /></Field>
          <button className="nx-btn primary" disabled={r.busy} onClick={() => void r.run(async () => ({ blob: pdfBlob(await numberPdf(pdf, o)), name: `${base(pdf.name)}-numbered.pdf` }))}>Add page numbers</button>
        </div>
      )}
      {r.ui}
    </>
  );
}

function ImagesToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [fit, setFit] = useState<'a4' | 'image'>('a4');
  const [margin, setMargin] = useState(10);
  const r = useRunner();
  const move = (i: number, d: number) => setFiles((f) => { const n = [...f]; const j = i + d; if (j < 0 || j >= n.length) return f; [n[i], n[j]] = [n[j], n[i]]; return n; });
  return (
    <>
      <FilePicker accept="image/*" multiple label="Add images (JPG, PNG, WebP, GIF, BMP…)" onFiles={(f) => setFiles((x) => [...x, ...f])} />
      <ol style={{ margin: '12px 0', paddingLeft: 20, display: 'grid', gap: 6 }}>
        {files.map((f, i) => <li key={i}><span className="nx-row" style={{ display: 'inline-flex' }}>{f.name}
          <button className="nx-btn sm icon" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
          <button className="nx-btn sm icon" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
          <button className="nx-btn sm icon danger" aria-label="Remove" onClick={() => setFiles((x) => x.filter((_, k) => k !== i))}><Trash2 size={14} /></button></span></li>)}
      </ol>
      <div className="nx-row" style={{ alignItems: 'flex-end' }}>
        <Field id="ip-f" label="Page size"><select id="ip-f" className="nx-select" value={fit} onChange={(e) => setFit(e.target.value as 'a4' | 'image')}><option value="a4">A4, fit image with margin</option><option value="image">Page size = image size</option></select></Field>
        {fit === 'a4' && <Field id="ip-m" label="Margin (mm)"><input id="ip-m" className="nx-input" type="number" min={0} max={50} value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></Field>}
        <button className="nx-btn primary" disabled={!files.length || r.busy} onClick={() => void r.run(async () => ({ blob: pdfBlob(await imagesToPdf(files, fit, margin)), name: 'images.pdf', note: `${files.length} page(s)` }))}>Create PDF</button>
      </div>
      {r.ui}
    </>
  );
}

function ToImages() {
  const { pdf, picker } = usePdf();
  const [scale, setScale] = useState(2);
  const r = useRunner();
  return (
    <>
      {picker}
      {pdf && (
        <div className="nx-row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <Field id="ti-s" label="Resolution"><select id="ti-s" className="nx-select" value={scale} onChange={(e) => setScale(Number(e.target.value))}><option value={1}>Standard (1×)</option><option value={2}>High (2×)</option><option value={3}>Very high (3×)</option></select></Field>
          <button className="nx-btn primary" disabled={r.busy || pdf.pages > 150} onClick={() => void r.run(async () => {
            const entries: ZipEntry[] = await pdfToPngs(pdf, scale, base(pdf.name));
            return entries.length === 1 ? { blob: new Blob([new Uint8Array(entries[0].data)], { type: 'image/png' }), name: entries[0].name } : { blob: makeZip(entries), name: `${base(pdf.name)}-images.zip`, note: `${entries.length} PNG images` };
          })}>Export PNG images</button>
          {pdf.pages > 150 && <span className="nx-err">Limit: 150 pages per export.</span>}
        </div>
      )}
      {r.ui}
    </>
  );
}

function Metadata() {
  const { pdf, picker } = usePdf();
  const [m, setM] = useState({ title: '', author: '', subject: '', keywords: '' });
  const r = useRunner();
  const info = pdf ? readInfo(pdf) : null;
  useEffect(() => {
    if (info) setM({ title: info.title ?? '', author: info.author ?? '', subject: info.subject ?? '', keywords: info.keywords ?? '' });
  }, [pdf]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {picker}
      {info && (
        <>
          <div className="nx-table-wrap" style={{ marginTop: 12 }}><table className="nx-table"><tbody>
            {([['Pages', info.pages], ['Page size(s)', info.sizes.join(', ')], ['PDF version', info.version], ['Encrypted', info.encrypted ? 'Yes' : 'No'], ['Creator', info.creator], ['Producer', info.producer], ['Created', info.created?.toLocaleString()], ['Modified', info.modified?.toLocaleString()], ['File size', formatBytes(pdf!.bytes.length)]] as const).map(([k, v]) => <tr key={k}><th>{k}</th><td>{v ?? '—'}</td></tr>)}
          </tbody></table></div>
          <h3 className="nx-h2" style={{ marginTop: 14 }}>Edit metadata</h3>
          <div className="nx-grid sm">
            {(['title', 'author', 'subject', 'keywords'] as const).map((k) => <Field key={k} id={`md-${k}`} label={k[0].toUpperCase() + k.slice(1)}><input id={`md-${k}`} className="nx-input" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} /></Field>)}
          </div>
          <button className="nx-btn primary" style={{ marginTop: 10 }} disabled={r.busy} onClick={() => void r.run(async () => ({ blob: pdfBlob(await writeInfo(pdf!, m)), name: `${base(pdf!.name)}-metadata.pdf` }))}>Save copy with new metadata</button>
        </>
      )}
      {r.ui}
    </>
  );
}

function Optimize() {
  const { pdf, picker } = usePdf();
  const r = useRunner();
  return (
    <>
      <Alert>Genuine but limited: this re-saves the PDF with compressed object streams. It does <strong>not</strong> downsample or recompress images, so scanned or image-heavy PDFs usually shrink very little (or not at all).</Alert>
      <div style={{ marginTop: 10 }}>{picker}</div>
      {pdf && <button className="nx-btn primary" style={{ marginTop: 12 }} disabled={r.busy} onClick={() => void r.run(async () => {
        const out = await optimizePdf(pdf);
        const smaller = out.length < pdf.bytes.length;
        return { blob: pdfBlob(smaller ? out : pdf.bytes), name: `${base(pdf.name)}-optimized.pdf`, note: smaller ? `${formatBytes(pdf.bytes.length)} → ${formatBytes(out.length)}` : 'No size reduction possible — original returned unchanged' };
      })}>Optimize</button>}
      {r.ui}
    </>
  );
}

function Preview() {
  const { pdf, picker } = usePdf();
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!pdf) return undefined;
    const u = URL.createObjectURL(pdfBlob(pdf.bytes)); setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [pdf]);
  return (
    <>
      {picker}
      {url && <iframe title="PDF preview" src={url} style={{ width: '100%', height: '70dvh', border: 0, borderRadius: 12, marginTop: 12, background: '#fff' }} />}
      {url && <p className="nx-muted">Some mobile browsers cannot embed PDFs. Use “Export PNG images” as an alternative.</p>}
    </>
  );
}

const TOOLS: { id: string; label: string; comp: () => ReactNode; blurb: string }[] = [
  { id: 'merge', label: 'Merge', comp: () => <Merge />, blurb: 'Combine several PDFs into one, in the order you choose.' },
  { id: 'split', label: 'Split', comp: () => <Split />, blurb: 'Split a PDF by page ranges or into single pages (ZIP).' },
  { id: 'pages', label: 'Extract / Delete / Rotate', comp: () => <Pages />, blurb: 'Pick pages by range to extract, delete or rotate.' },
  { id: 'reorder', label: 'Reorder pages', comp: () => <Reorder />, blurb: 'Visually reorder, rotate and remove pages.' },
  { id: 'watermark', label: 'Watermark', comp: () => <Watermark />, blurb: 'Stamp diagonal or horizontal text on pages.' },
  { id: 'numbers', label: 'Page numbers', comp: () => <Numbering />, blurb: 'Add page numbers in any corner or centre.' },
  { id: 'img2pdf', label: 'Image → PDF', comp: () => <ImagesToPdf />, blurb: 'Turn images into a PDF, one per page.' },
  { id: 'pdf2img', label: 'PDF → Images', comp: () => <ToImages />, blurb: 'Export every page as PNG (ZIP for multi-page).' },
  { id: 'meta', label: 'Metadata', comp: () => <Metadata />, blurb: 'Inspect document properties and edit title/author/etc.' },
  { id: 'optimize', label: 'Optimize', comp: () => <Optimize />, blurb: 'Re-save with object streams (limited size gains).' },
  { id: 'preview', label: 'Preview', comp: () => <Preview />, blurb: 'View a PDF using your browser’s built-in viewer.' },
];

export default function Tools() {
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tool') ?? 'merge');
  const tool = TOOLS.find((t) => t.id === tab) ?? TOOLS[0];
  useEffect(() => { if (!TOOLS.some((t) => t.id === tab)) toast.warn('Unknown tool'); }, [tab]);
  return (
    <div className="nx-page">
      <h1 className="nx-h1">PDF Tools</h1>
      <p className="nx-sub">All processing happens locally in your browser — your PDFs are never uploaded.</p>
      <div className="nx-tabs" style={{ marginTop: 14 }} role="tablist">
        {TOOLS.map((t) => <button key={t.id} role="tab" aria-selected={t.id === tool.id} className={`nx-chip${t.id === tool.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <div className="nx-card" style={{ marginTop: 12 }}>
        <h2 className="nx-h2">{tool.label}</h2>
        <p className="nx-muted" style={{ marginTop: -6 }}>{tool.blurb}</p>
        <div key={tool.id}>{tool.comp()}</div>
      </div>
      <p className="nx-muted" style={{ marginTop: 14 }}>Not available: password protection / encryption (the bundled PDF library cannot write encrypted files). Encrypted input PDFs are detected and rejected with an explanation.</p>
    </div>
  );
}
