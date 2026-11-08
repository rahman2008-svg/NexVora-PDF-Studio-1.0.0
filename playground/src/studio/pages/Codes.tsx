import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import bwipjs from 'bwip-js';
import { cloneDeep, getInputFromTemplate } from '@pdfme/common';
import { Download, FilePlus2 } from 'lucide-react';
import { Alert, Modal, errMsg } from '../components/ui';
import { downloadBlob, sanitizeFilename } from '../lib/pdfIO';
import { useProjects } from '../lib/useProjects';
import { saveStudioTemplate, type StudioProject } from '../lib/storage';

type Mode = 'qr' | 'barcode';
type QrKind = 'text' | 'url' | 'email' | 'phone' | 'contact' | 'wifi';
type BarKind = 'code128' | 'ean13' | 'ean8' | 'code39' | 'upca' | 'itf14';

const wifiEsc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
const vEsc = (s: string) => s.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');

const ean13Check = (d12: string) => {
  const sum = [...d12].reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
};

type BarRule = { label: string; hint: string; check: (v: string) => string | null; pdfme?: 'code128' | 'ean13' };
const BAR: Record<BarKind, BarRule> = {
  code128: { label: 'Code 128', hint: 'Any ASCII text', pdfme: 'code128', check: (v) => (/^[\x20-\x7e]+$/.test(v) ? null : 'Use printable ASCII characters only.') },
  ean13: {
    label: 'EAN-13', hint: '12 digits (check digit added) or 13 digits', pdfme: 'ean13',
    check: (v) => {
      if (!/^\d{12,13}$/.test(v)) return 'Enter 12 or 13 digits.';
      return v.length === 13 && ean13Check(v.slice(0, 12)) !== v[12] ? `Invalid check digit — it should be ${ean13Check(v.slice(0, 12))}.` : null;
    },
  },
  ean8: { label: 'EAN-8', hint: '7 or 8 digits', check: (v) => (/^\d{7,8}$/.test(v) ? null : 'Enter 7 or 8 digits.') },
  upca: { label: 'UPC-A', hint: '11 or 12 digits', check: (v) => (/^\d{11,12}$/.test(v) ? null : 'Enter 11 or 12 digits.') },
  code39: { label: 'Code 39', hint: 'A–Z, 0–9, space and - . $ / + %', check: (v) => (/^[A-Z0-9 \-.$/+%]+$/.test(v) ? null : 'Use uppercase letters, digits and - . $ / + % only.') },
  itf14: { label: 'ITF-14', hint: '13 or 14 digits', check: (v) => (/^\d{13,14}$/.test(v) ? null : 'Enter 13 or 14 digits.') },
};

export default function Codes() {
  const nav = useNavigate();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('qr');
  const [qk, setQk] = useState<QrKind>('url');
  const [bk, setBk] = useState<BarKind>('code128');
  const [f, setF] = useState({
    text: 'Hello from NexVora', url: 'https://example.com', email: '', subject: '', body: '', phone: '',
    name: '', org: '', cphone: '', cemail: '', curl: '', ssid: '', pass: '', enc: 'WPA', hidden: false, bar: 'NEXVORA-001',
  });
  const [size, setSize] = useState(4);
  const [fg, setFg] = useState('#000000');
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const payload = useMemo(() => {
    if (mode === 'barcode') return f.bar.trim();
    switch (qk) {
      case 'text': return f.text;
      case 'url': return f.url.trim() && !/^[a-z][a-z0-9+.-]*:/i.test(f.url.trim()) ? `https://${f.url.trim()}` : f.url.trim();
      case 'email': return f.email.trim() ? `mailto:${f.email.trim()}${f.subject || f.body ? `?subject=${encodeURIComponent(f.subject)}&body=${encodeURIComponent(f.body)}` : ''}` : '';
      case 'phone': return f.phone.trim() ? `tel:${f.phone.replace(/[^\d+]/g, '')}` : '';
      case 'contact':
        return f.name.trim() ? ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vEsc(f.name)}`, `N:${vEsc(f.name)};;;;`, f.org && `ORG:${vEsc(f.org)}`, f.cphone && `TEL:${f.cphone}`, f.cemail && `EMAIL:${f.cemail}`, f.curl && `URL:${f.curl}`, 'END:VCARD'].filter(Boolean).join('\n') : '';
      case 'wifi': return f.ssid.trim() ? `WIFI:T:${f.enc === 'nopass' ? 'nopass' : f.enc};S:${wifiEsc(f.ssid)};${f.enc === 'nopass' ? '' : `P:${wifiEsc(f.pass)};`}${f.hidden ? 'H:true;' : ''};` : '';
    }
  }, [mode, qk, f]);

  const validation = useMemo(() => {
    if (!payload) return mode === 'qr' ? 'Fill in the required fields to generate a QR code.' : 'Enter the barcode content.';
    if (mode === 'qr') return payload.length > 1000 ? 'Content is too long for a QR code (max ~1000 characters here).' : null;
    return BAR[bk].check(payload);
  }, [payload, mode, bk]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (validation) { ctx?.clearRect(0, 0, c.width, c.height); setError(validation); return; }
    try {
      const barcolor = fg.replace('#', '');
      if (mode === 'qr') bwipjs.toCanvas(c, { bcid: 'qrcode', text: payload, scale: size, eclevel: 'M', barcolor, backgroundcolor: 'FFFFFF', paddingwidth: 4, paddingheight: 4 });
      else bwipjs.toCanvas(c, { bcid: bk, text: payload, scale: Math.max(2, size - 1), height: 14, includetext: true, textxalign: 'center', barcolor, backgroundcolor: 'FFFFFF', paddingwidth: 6, paddingheight: 6 });
      setError('');
    } catch (e) { ctx?.clearRect(0, 0, c.width, c.height); setError(errMsg(e)); }
  }, [payload, validation, mode, bk, size, fg]);

  const png = () => canvas.current?.toBlob((b) => b ? downloadBlob(b, `${sanitizeFilename(mode === 'qr' ? `qr-${qk}` : bk)}.png`) : toast.error('Could not create image'), 'image/png');
  const ready = !error && !!payload;

  return (
    <div className="nx-page">
      <h1 className="nx-h1">QR & Barcode Generator</h1>
      <p className="nx-sub">Generate codes locally, download them as PNG, or add them straight into one of your PDF templates.</p>
      <div className="nx-tabs" style={{ marginTop: 14 }}>
        <button className={`nx-chip${mode === 'qr' ? ' active' : ''}`} onClick={() => setMode('qr')}>QR code</button>
        <button className={`nx-chip${mode === 'barcode' ? ' active' : ''}`} onClick={() => setMode('barcode')}>Barcode</button>
      </div>
      <div className="nx-two" style={{ marginTop: 12 }}>
        <div className="nx-card" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          {mode === 'qr' ? (
            <>
              <div className="nx-field"><label htmlFor="qk">QR type</label>
                <select id="qk" className="nx-select" value={qk} onChange={(e) => setQk(e.target.value as QrKind)}>
                  <option value="text">Text</option><option value="url">URL</option><option value="email">Email</option><option value="phone">Phone</option><option value="contact">Contact (vCard)</option><option value="wifi">Wi-Fi</option></select></div>
              {qk === 'text' && <div className="nx-field"><label htmlFor="q-t">Text</label><textarea id="q-t" className="nx-textarea" value={f.text} onChange={(e) => set('text', e.target.value)} /></div>}
              {qk === 'url' && <div className="nx-field"><label htmlFor="q-u">Web address</label><input id="q-u" className="nx-input" inputMode="url" value={f.url} onChange={(e) => set('url', e.target.value)} /></div>}
              {qk === 'email' && <>
                <div className="nx-field"><label htmlFor="q-e">Email address</label><input id="q-e" className="nx-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
                <div className="nx-field"><label htmlFor="q-s">Subject (optional)</label><input id="q-s" className="nx-input" value={f.subject} onChange={(e) => set('subject', e.target.value)} /></div>
                <div className="nx-field"><label htmlFor="q-b">Message (optional)</label><textarea id="q-b" className="nx-textarea" value={f.body} onChange={(e) => set('body', e.target.value)} /></div></>}
              {qk === 'phone' && <div className="nx-field"><label htmlFor="q-p">Phone number</label><input id="q-p" className="nx-input" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>}
              {qk === 'contact' && <>
                <div className="nx-field"><label htmlFor="c-n" className="nx-req">Full name</label><input id="c-n" className="nx-input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
                <div className="nx-field"><label htmlFor="c-o">Organization</label><input id="c-o" className="nx-input" value={f.org} onChange={(e) => set('org', e.target.value)} /></div>
                <div className="nx-field"><label htmlFor="c-p">Phone</label><input id="c-p" className="nx-input" value={f.cphone} onChange={(e) => set('cphone', e.target.value)} /></div>
                <div className="nx-field"><label htmlFor="c-e">Email</label><input id="c-e" className="nx-input" value={f.cemail} onChange={(e) => set('cemail', e.target.value)} /></div>
                <div className="nx-field"><label htmlFor="c-u">Website</label><input id="c-u" className="nx-input" value={f.curl} onChange={(e) => set('curl', e.target.value)} /></div></>}
              {qk === 'wifi' && <>
                <div className="nx-field"><label htmlFor="w-s" className="nx-req">Network name (SSID)</label><input id="w-s" className="nx-input" value={f.ssid} onChange={(e) => set('ssid', e.target.value)} /></div>
                <div className="nx-field"><label htmlFor="w-e">Security</label><select id="w-e" className="nx-select" value={f.enc} onChange={(e) => set('enc', e.target.value)}><option>WPA</option><option>WEP</option><option value="nopass">None</option></select></div>
                {f.enc !== 'nopass' && <div className="nx-field"><label htmlFor="w-p">Password</label><input id="w-p" className="nx-input" value={f.pass} onChange={(e) => set('pass', e.target.value)} /></div>}
                <label className="nx-row"><input type="checkbox" style={{ width: 18, height: 18 }} checked={f.hidden} onChange={(e) => set('hidden', e.target.checked)} /> Hidden network</label></>}
            </>
          ) : (
            <>
              <div className="nx-field"><label htmlFor="bk">Barcode type</label>
                <select id="bk" className="nx-select" value={bk} onChange={(e) => setBk(e.target.value as BarKind)}>{(Object.keys(BAR) as BarKind[]).map((k) => <option key={k} value={k}>{BAR[k].label}</option>)}</select></div>
              <div className="nx-field"><label htmlFor="b-c">Content — {BAR[bk].hint}</label><input id="b-c" className="nx-input" value={f.bar} onChange={(e) => set('bar', e.target.value)} /></div>
            </>
          )}
          <div className="nx-row">
            <div className="nx-field" style={{ flex: 1 }}><label htmlFor="sz">Size</label><input id="sz" type="range" min={2} max={10} value={size} onChange={(e) => setSize(Number(e.target.value))} /></div>
            <div className="nx-field"><label htmlFor="fg">Colour</label><input id="fg" type="color" className="nx-input" style={{ padding: 2, width: 60 }} value={fg} onChange={(e) => setFg(e.target.value)} /></div>
          </div>
        </div>
        <div className="nx-card" style={{ display: 'grid', gap: 12, justifyItems: 'center', alignContent: 'start' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 8, maxWidth: '100%', overflow: 'auto', minHeight: 120, display: 'grid', placeItems: 'center' }}>
            <canvas ref={canvas} role="img" aria-label="Generated code preview" style={{ maxWidth: '100%', height: 'auto', opacity: ready ? 1 : 0.25 }} />
          </div>
          {error && <Alert kind={payload ? 'err' : 'info'}>{error}</Alert>}
          <div className="nx-row">
            <button className="nx-btn primary" disabled={!ready} onClick={png}><Download size={16} /> Download PNG</button>
            <button className="nx-btn" disabled={!ready || (mode === 'barcode' && !BAR[bk].pdfme)} onClick={() => setAddOpen(true)}><FilePlus2 size={16} /> Add to PDF template</button>
          </div>
          {mode === 'barcode' && !BAR[bk].pdfme && <p className="nx-muted">PDF templates currently support Code 128 and EAN-13 (plus QR). This type is download-only.</p>}
        </div>
      </div>
      {addOpen && <AddToTemplate payload={payload} type={mode === 'qr' ? 'qrcode' : (BAR[bk].pdfme as string)} onClose={() => setAddOpen(false)} onDone={(id) => nav(`/studio/editor/${encodeURIComponent(id)}`)} />}
    </div>
  );
}

function AddToTemplate({ payload, type, onClose, onDone }: { payload: string; type: string; onClose: () => void; onDone: (id: string) => void }) {
  const { projects, loading } = useProjects();
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async (p: StudioProject) => {
    setBusy(true);
    try {
      const t = cloneDeep(p.template);
      getInputFromTemplate(t); // normalises legacy page layout
      if (t.schemas.length === 0) t.schemas.push([]);
      const page = t.schemas[0] as unknown as Record<string, unknown>[];
      let n = 1; const names = new Set(page.map((s) => String(s.name)));
      while (names.has(`${type}${n}`)) n += 1;
      const isQr = type === 'qrcode';
      page.push({
        name: `${type}${n}`, type, content: type === 'ean13' && payload.length === 13 ? payload : payload,
        position: { x: 15, y: 15 }, width: isQr ? 30 : 60, height: isQr ? 30 : 20, rotate: 0, opacity: 1,
        backgroundColor: '#ffffff', barColor: '#000000', readOnly: false,
        ...(type === 'code128' || type === 'ean13' ? { includetext: true } : {}),
      });
      await saveStudioTemplate(p, t);
      toast.success('Added — adjust its position in the editor');
      onDone(p.id);
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  const sel = projects.find((p) => p.id === id);
  return (
    <Modal title="Add to PDF template" onClose={onClose} narrow>
      {loading ? <p className="nx-muted">Loading…</p> : projects.length === 0 ? <p className="nx-sub">You have no projects yet. Create one from the Templates page first.</p> : (
        <div className="nx-field">
          <label htmlFor="add-p">Project (code is added to page 1 as an editable field)</label>
          <select id="add-p" className="nx-select" value={id} onChange={(e) => setId(e.target.value)}><option value="">— select —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          <div className="nx-row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="nx-btn" onClick={onClose}>Cancel</button>
            <button className="nx-btn primary" disabled={!sel || busy} onClick={() => sel && void add(sel)}>Add & open editor</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
