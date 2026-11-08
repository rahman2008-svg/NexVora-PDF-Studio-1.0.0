import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ClipboardList, FilePlus2, Layers, Plus, QrCode, Search, Upload, Wrench } from 'lucide-react';
import { CATEGORIES } from '../lib/brand';
import { useSettings } from '../lib/settings';
import { useProjects } from '../lib/useProjects';
import { useProjectActions } from '../lib/useProjectActions';
import ProjectCard from '../components/ProjectCard';
import { errMsg } from '../components/ui';
import { createStudioProject, getMeta, importFromJson } from '../lib/storage';
import { LIBRARY } from '../lib/library';
import { PAGE_SIZE_PRESETS } from '@pdfme/common';

export default function Dashboard() {
  const { t, settings } = useSettings();
  const nav = useNavigate();
  const { projects, loading, error, refresh } = useProjects();
  const { actions, dialogs } = useProjectActions(refresh);
  const [q, setQ] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createBlank = async () => {
    try {
      const entry = LIBRARY.find((e) => e.id === 'blank-a4')!;
      const size = PAGE_SIZE_PRESETS[settings.pageSize];
      const template = entry.build();
      template.basePdf = { width: size.width, height: size.height, padding: [20, 10, 20, 10] };
      const p = await createStudioProject({ title: 'Untitled PDF', template, category: 'Custom Templates' });
      nav(`/studio/editor/${encodeURIComponent(p.id)}`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const importFile = async (file: File) => {
    try {
      const created = await importFromJson(await file.text(), file.name.replace(/\.json$/i, ''));
      toast.success(`Imported ${created.length} project${created.length > 1 ? 's' : ''}`);
      await refresh();
      if (created.length === 1) nav(`/studio/editor/${encodeURIComponent(created[0].id)}`);
    } catch (e) { toast.error(`Import failed: ${errMsg(e)}`); }
  };

  const needle = q.trim().toLowerCase();
  const filtered = projects.filter((p) =>
    (!needle || p.title.toLowerCase().includes(needle) || getMeta(p).category.toLowerCase().includes(needle)) &&
    (!onlyFav || getMeta(p).favorite));
  const recent = filtered.slice(0, 6);
  const savedTemplates = filtered.filter((p) => getMeta(p).isTemplate).slice(0, 6);
  const countFor = (c: string) => projects.filter((p) => getMeta(p).category === c).length;
  const libCount = (c: string) => LIBRARY.filter((e) => e.category === c).length;

  const quick = [
    { to: '/studio/bulk', icon: Layers, label: t('bulk') },
    { to: '/studio/tools', icon: Wrench, label: t('utilities') },
    { to: '/studio/codes', icon: QrCode, label: t('codes') },
    { to: '/studio/forms', icon: ClipboardList, label: t('forms') },
    { to: '/studio/generate', icon: FilePlus2, label: t('generate') },
  ];

  return (
    <div className="nx-page">
      <h1 className="nx-h1"><span className="nx-grad-text">{t('welcome')}</span></h1>
      <p className="nx-sub">{t('welcomeSub')}</p>

      <div className="nx-row" style={{ marginTop: 18 }}>
        <button className="nx-btn primary" onClick={() => nav('/studio/library')}><Plus size={17} /> {t('createNew')}</button>
        <button className="nx-btn" onClick={createBlank}>Blank {settings.pageSize}</button>
        <button className="nx-btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> {t('importTemplate')}</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
      </div>

      <div className="nx-row" style={{ marginTop: 18 }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--nx-muted)' }} />
          <input className="nx-input" style={{ paddingLeft: 36 }} placeholder={t('search')} value={q}
            onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
        </div>
        <button className={`nx-chip${onlyFav ? ' active' : ''}`} aria-pressed={onlyFav} onClick={() => setOnlyFav((v) => !v)}>★ {t('favorites')}</button>
      </div>
      {error && <p className="nx-err">Could not read local projects: {error}</p>}

      <section className="nx-section">
        <h2 className="nx-h2">{t('quickTools')}</h2>
        <div className="nx-grid sm">
          {quick.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="nx-card hover" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon size={20} color="var(--nx-cyan)" /> <strong style={{ fontSize: 14 }}>{label}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="nx-section">
        <h2 className="nx-h2">{t('recent')}</h2>
        {loading ? <p className="nx-muted">Loading…</p> : recent.length === 0 ? (
          <div className="nx-card"><p className="nx-sub" style={{ margin: 0 }}>{needle || onlyFav ? 'No projects match your filter.' : t('noProjects')}</p></div>
        ) : (
          <div className="nx-grid">{recent.map((p) => <ProjectCard key={p.id} project={p} actions={actions} />)}</div>
        )}
        {projects.length > 6 && <p style={{ marginTop: 10 }}><Link to="/studio/projects" className="nx-grad-text">View all {projects.length} projects →</Link></p>}
      </section>

      {savedTemplates.length > 0 && (
        <section className="nx-section">
          <h2 className="nx-h2">{t('saved')}</h2>
          <div className="nx-grid">{savedTemplates.map((p) => <ProjectCard key={p.id} project={p} actions={actions} />)}</div>
        </section>
      )}

      <section className="nx-section">
        <h2 className="nx-h2">{t('categories')}</h2>
        <div className="nx-grid sm">
          {CATEGORIES.map((c) => (
            <Link key={c} to={`/studio/library?category=${encodeURIComponent(c)}`} className="nx-card hover">
              <strong style={{ fontSize: 14 }}>{c}</strong>
              <div className="nx-muted">{libCount(c)} library templates • {countFor(c)} yours</div>
            </Link>
          ))}
        </div>
      </section>
      <p className="nx-muted" style={{ marginTop: 24 }}>Language: {settings.lang === 'bn' ? 'বাংলা' : 'English'} • All data stays in this browser.</p>
      {dialogs}
    </div>
  );
}
