import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Eye, Plus } from 'lucide-react';
import { CATEGORIES } from '../lib/brand';
import { GROUPS, LIBRARY, type LibraryEntry } from '../lib/library';
import { createStudioProject, refreshThumbnail } from '../lib/storage';
import { generatePdf } from '../lib/pdfIO';
import { useSettings } from '../lib/settings';
import { PdfPreviewModal, errMsg } from '../components/ui';

export default function Library() {
  const nav = useNavigate();
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('All');
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<{ data: Uint8Array; name: string } | null>(null);
  const cat = params.get('category') ?? 'All';

  const list = LIBRARY.filter((e) =>
    (group === 'All' || e.group === group) && (cat === 'All' || e.category === cat) &&
    (!q.trim() || `${e.title} ${e.description} ${e.category}`.toLowerCase().includes(q.trim().toLowerCase())));

  const use = async (e: LibraryEntry) => {
    setBusy(e.id);
    try {
      const template = e.build();
      const p = await createStudioProject({ title: e.title, template, category: e.category, sourceTemplateId: e.id });
      void refreshThumbnail(p.id, template);
      nav(`/studio/editor/${encodeURIComponent(p.id)}`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(''); }
  };
  const show = async (e: LibraryEntry) => {
    setBusy(e.id);
    try { setPreview({ data: await generatePdf({ template: e.build(), settings, title: e.title }), name: e.title }); }
    catch (err) { toast.error(`Preview failed: ${errMsg(err)}`); } finally { setBusy(''); }
  };

  return (
    <div className="nx-page">
      <h1 className="nx-h1">Template Library</h1>
      <p className="nx-sub">{LIBRARY.length} editable PDFme templates. “Use template” creates your own copy in this browser — the library itself is never modified.</p>
      <div className="nx-row" style={{ marginTop: 16 }}>
        <input className="nx-input" style={{ flex: '1 1 240px' }} placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search templates" />
        <select className="nx-select" style={{ width: 'auto' }} value={cat} aria-label="Category"
          onChange={(e) => { const n = new URLSearchParams(params); if (e.target.value === 'All') n.delete('category'); else n.set('category', e.target.value); setParams(n); }}>
          <option>All</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="nx-tabs" style={{ marginTop: 10 }}>
        {['All', ...GROUPS].map((g) => <button key={g} className={`nx-chip${group === g ? ' active' : ''}`} onClick={() => setGroup(g)}>{g}</button>)}
      </div>
      <div className="nx-grid" style={{ marginTop: 16 }}>
        {list.map((e) => (
          <div key={e.id} className="nx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="nx-thumb" style={{ background: `linear-gradient(135deg, ${e.accent}, #0B1020)`, color: '#fff', fontWeight: 700, fontSize: 18 }}>{e.title}</div>
            <div>
              <strong>{e.title}</strong> <span className="nx-badge">{e.category}</span>
              <div className="nx-muted" style={{ marginTop: 4 }}>{e.description}</div>
            </div>
            <div className="nx-row" style={{ marginTop: 'auto' }}>
              <button className="nx-btn sm primary" disabled={busy === e.id} onClick={() => void use(e)}><Plus size={15} /> Use template</button>
              <button className="nx-btn sm" disabled={busy === e.id} onClick={() => void show(e)}><Eye size={15} /> Preview</button>
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && <div className="nx-card" style={{ marginTop: 16 }}>No templates match.</div>}
      {preview && <PdfPreviewModal data={preview.data} filename={preview.name} onClose={() => setPreview(null)} />}
    </div>
  );
}
