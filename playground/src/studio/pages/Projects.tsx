import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Download, Upload } from 'lucide-react';
import { CATEGORIES } from '../lib/brand';
import { useProjects } from '../lib/useProjects';
import { useProjectActions } from '../lib/useProjectActions';
import ProjectCard from '../components/ProjectCard';
import { errMsg } from '../components/ui';
import { downloadJson } from '../lib/pdfIO';
import { getMeta, importFromJson, patchMeta, toBundle } from '../lib/storage';
import { useNavigate } from 'react-router-dom';

export default function Projects() {
  const nav = useNavigate();
  const { projects, loading, error, refresh } = useProjects();
  const { actions, dialogs } = useProjectActions(refresh);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [view, setView] = useState<'all' | 'fav' | 'tpl'>('all');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const fileRef = useRef<HTMLInputElement>(null);

  const importFiles = async (files: FileList | null) => {
    if (!files) return;
    let n = 0;
    for (const f of Array.from(files)) {
      try { n += (await importFromJson(await f.text(), f.name.replace(/\.json$/i, ''))).length; }
      catch (e) { toast.error(`${f.name}: ${errMsg(e)}`); }
    }
    if (n) { toast.success(`Imported ${n} project${n > 1 ? 's' : ''}`); await refresh(); }
  };

  const list = projects
    .filter((p) => {
      const m = getMeta(p);
      return (!q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())) &&
        (cat === 'All' || m.category === cat) &&
        (view === 'all' || (view === 'fav' ? m.favorite : m.isTemplate));
    })
    .sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title) : b.updatedAt - a.updatedAt));

  return (
    <div className="nx-page">
      <div className="nx-row" style={{ justifyContent: 'space-between' }}>
        <h1 className="nx-h1">Projects</h1>
        <div className="nx-row">
          <button className="nx-btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Import</button>
          <button className="nx-btn" disabled={!projects.length} onClick={() => downloadJson(projects.map(toBundle), 'nexvora-projects-backup')}><Download size={16} /> Export all</button>
          <button className="nx-btn primary" onClick={() => nav('/studio/library')}>New</button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden
        onChange={(e) => { void importFiles(e.target.files); e.target.value = ''; }} />
      <p className="nx-sub">Stored in your browser (IndexedDB). Export a backup regularly — clearing browser data deletes projects.</p>

      <div className="nx-row" style={{ marginTop: 16 }}>
        <input className="nx-input" style={{ flex: '1 1 220px' }} placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
        <select className="nx-select" style={{ width: 'auto' }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option>All</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="nx-select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')} aria-label="Sort">
          <option value="recent">Recently edited</option><option value="name">Name</option>
        </select>
      </div>
      <div className="nx-tabs" style={{ marginTop: 10 }}>
        {([['all', 'All'], ['fav', '★ Favorites'], ['tpl', 'Saved templates']] as const).map(([k, l]) => (
          <button key={k} className={`nx-chip${view === k ? ' active' : ''}`} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>

      {error && <p className="nx-err">Could not read local projects: {error}</p>}
      <div style={{ marginTop: 16 }}>
        {loading ? <p className="nx-muted">Loading…</p> : list.length === 0 ? (
          <div className="nx-card"><p className="nx-sub" style={{ margin: 0 }}>No projects found.</p></div>
        ) : (
          <>
            <p className="nx-muted">{list.length} project{list.length > 1 ? 's' : ''}</p>
            <div className="nx-grid">
              {list.map((p) => (
                <div key={p.id}>
                  <ProjectCard project={p} actions={actions} />
                  <button className="nx-chip" style={{ marginTop: 6 }} onClick={() => void patchMeta(p, { isTemplate: !getMeta(p).isTemplate }).then(refresh).catch((e) => toast.error(errMsg(e)))}>
                    {getMeta(p).isTemplate ? '✓ Saved as template' : 'Save as template'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {dialogs}
    </div>
  );
}
