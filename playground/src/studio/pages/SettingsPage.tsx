import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'react-toastify';
import { useSettings, type PageSizeName, type StudioSettings } from '../lib/settings';
import { Alert, ConfirmDialog, errMsg } from '../components/ui';
import { clearFonts, deleteFont, listFonts, putFont, type StoredFont } from '../lib/db';
import { downloadJson, formatBytes } from '../lib/pdfIO';
import { deleteProject, listStudioProjects, toBundle } from '../lib/storage';

const Row = ({ label, id, children, hint }: { label: string; id: string; children: ReactNode; hint?: string }) => (
  <div className="nx-field"><label htmlFor={id}>{label}</label>{children}{hint && <span className="nx-muted">{hint}</span>}</div>
);

export default function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const [fonts, setFonts] = useState<StoredFont[]>([]);
  const [count, setCount] = useState(0);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [confirm, setConfirm] = useState<null | 'projects' | 'fonts' | 'reset'>(null);

  const refresh = useCallback(async () => {
    try { setFonts(await listFonts()); setCount((await listStudioProjects()).length); } catch (e) { toast.error(errMsg(e)); }
    try { const e = await navigator.storage?.estimate?.(); if (e?.usage != null && e.quota != null) setUsage({ used: e.usage, quota: e.quota }); } catch { /* unsupported */ }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const set = <K extends keyof StudioSettings>(k: K, v: StudioSettings[K]) => update({ [k]: v } as Partial<StudioSettings>);

  const addFont = async (file: File) => {
    try {
      if (!/\.(ttf|otf)$/i.test(file.name)) throw new Error('Choose a .ttf or .otf font file.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Font file is larger than 20 MB.');
      const data = await file.arrayBuffer();
      const tag = new TextDecoder('latin1').decode(data.slice(0, 4));
      const ok = tag === 'OTTO' || tag === 'true' || new Uint8Array(data.slice(0, 4)).join() === '0,1,0,0';
      if (!ok) throw new Error('This file does not look like a valid TrueType/OpenType font.');
      const name = file.name.replace(/\.(ttf|otf)$/i, '').replace(/[^\w\- ]+/g, '').trim() || 'CustomFont';
      await putFont({ name, data, size: data.byteLength, addedAt: Date.now() });
      toast.success(`Font “${name}” added. It appears in the Designer font list.`);
      await refresh();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const wipe = async (what: 'projects' | 'fonts' | 'reset') => {
    setConfirm(null);
    try {
      if (what === 'projects') { for (const p of await listStudioProjects()) await deleteProject(p.id); toast.success('All projects deleted'); }
      if (what === 'fonts') { await clearFonts(); toast.success('Custom fonts removed'); }
      if (what === 'reset') { reset(); toast.success('Settings reset'); }
      await refresh();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="nx-page">
      <h1 className="nx-h1">Settings</h1>
      <p className="nx-sub">Saved automatically in this browser (LocalStorage for preferences, IndexedDB for projects and fonts).</p>

      <div className="nx-two" style={{ marginTop: 16 }}>
        <section className="nx-card" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <h2 className="nx-h2">General</h2>
          <Row id="s-lang" label="Language" hint="Bangla covers navigation, dashboard and settings; other screens are English.">
            <select id="s-lang" className="nx-select" value={settings.lang} onChange={(e) => set('lang', e.target.value as 'en' | 'bn')}><option value="en">English</option><option value="bn">বাংলা (Bangla)</option></select></Row>
          <Row id="s-theme" label="Theme"><select id="s-theme" className="nx-select" value={settings.theme} onChange={(e) => set('theme', e.target.value as StudioSettings['theme'])}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></Row>
          <Row id="s-page" label="Default page size (new blank documents)"><select id="s-page" className="nx-select" value={settings.pageSize} onChange={(e) => set('pageSize', e.target.value as PageSizeName)}>{(['A3', 'A4', 'A5', 'A6', 'Letter', 'Legal'] as const).map((p) => <option key={p}>{p}</option>)}</select></Row>
          <Row id="s-font" label="Default font" hint="Used as the fallback font in the Designer and for generated PDFs.">
            <select id="s-font" className="nx-select" value={settings.defaultFont} onChange={(e) => set('defaultFont', e.target.value)}>
              <option>Roboto</option>{fonts.map((f) => <option key={f.name}>{f.name}</option>)}
              {settings.defaultFont !== 'Roboto' && !fonts.some((f) => f.name === settings.defaultFont) && <option>{settings.defaultFont}</option>}
            </select></Row>
        </section>

        <section className="nx-card" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <h2 className="nx-h2">Editor & export</h2>
          <label className="nx-row"><input type="checkbox" style={{ width: 20, height: 20 }} checked={settings.autosave} onChange={(e) => set('autosave', e.target.checked)} /> Autosave while editing</label>
          <Row id="s-delay" label="Autosave delay (seconds)"><input id="s-delay" className="nx-input" type="number" min={1} max={60} disabled={!settings.autosave} value={settings.autosaveDelaySec} onChange={(e) => set('autosaveDelaySec', Math.min(60, Math.max(1, Number(e.target.value) || 3)))} /></Row>
          <Row id="s-exp" label="When exporting a PDF"><select id="s-exp" className="nx-select" value={settings.exportMode} onChange={(e) => set('exportMode', e.target.value as 'download' | 'open')}><option value="download">Download the file</option><option value="open">Open in a new tab</option></select></Row>
          <Row id="s-name" label="File name pattern" hint="Use {title} and {date}."><input id="s-name" className="nx-input" value={settings.filenamePattern} onChange={(e) => set('filenamePattern', e.target.value)} /></Row>
          <Row id="s-auth" label="PDF author metadata (optional)"><input id="s-auth" className="nx-input" value={settings.pdfAuthor} onChange={(e) => set('pdfAuthor', e.target.value)} /></Row>
        </section>

        <section className="nx-card" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <h2 className="nx-h2">Privacy</h2>
          <Alert kind="ok">No account, no tracking code, no uploads. PDFs, templates and data are processed on your device only. The app makes no network requests for your documents.</Alert>
          <label className="nx-row"><input type="checkbox" style={{ width: 20, height: 20 }} checked={settings.confirmDelete} onChange={(e) => set('confirmDelete', e.target.checked)} /> Ask before deleting a project</label>
        </section>

        <section className="nx-card" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <h2 className="nx-h2">Storage management</h2>
          <p className="nx-muted" style={{ margin: 0 }}>{count} project(s) • {fonts.length} custom font(s){usage ? ` • browser storage used: ${formatBytes(usage.used)} of ${formatBytes(usage.quota)}` : ''}</p>
          <div className="nx-row">
            <button className="nx-btn" disabled={!count} onClick={() => void listStudioProjects().then((p) => downloadJson(p.map(toBundle), 'nexvora-projects-backup'))}>Backup all projects</button>
            <button className="nx-btn danger" disabled={!count} onClick={() => setConfirm('projects')}>Delete all projects</button>
          </div>
          <h3 className="nx-lbl" style={{ margin: '6px 0 0' }}>Custom fonts (e.g. a Bangla font such as Noto Sans Bengali)</h3>
          <input type="file" accept=".ttf,.otf" className="nx-input" aria-label="Add font" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addFont(f); }} />
          {fonts.map((f) => (
            <div key={f.name} className="nx-row" style={{ justifyContent: 'space-between' }}>
              <span>{f.name} <span className="nx-muted">({formatBytes(f.size)})</span></span>
              <button className="nx-btn sm danger" onClick={() => void deleteFont(f.name).then(refresh)}>Remove</button>
            </div>
          ))}
          <p className="nx-muted" style={{ margin: 0 }}>The bundled font covers Latin text. For Bangla or other scripts inside PDFs, upload a font that contains those glyphs. Reload open editors after adding fonts.</p>
          <div className="nx-row"><button className="nx-btn danger" disabled={!fonts.length} onClick={() => setConfirm('fonts')}>Remove all fonts</button><button className="nx-btn" onClick={() => setConfirm('reset')}>Reset settings</button></div>
        </section>
      </div>

      {confirm === 'projects' && <ConfirmDialog title="Delete ALL projects?" message="Every project in this browser will be permanently deleted. Back them up first." onClose={() => setConfirm(null)} onConfirm={() => void wipe('projects')} />}
      {confirm === 'fonts' && <ConfirmDialog title="Remove all custom fonts?" message="Templates using these fonts will fall back to the default font." confirmText="Remove" onClose={() => setConfirm(null)} onConfirm={() => void wipe('fonts')} />}
      {confirm === 'reset' && <ConfirmDialog title="Reset settings?" message="Language, theme and all preferences return to defaults. Projects are not affected." confirmText="Reset" onClose={() => setConfirm(null)} onConfirm={() => void wipe('reset')} />}
    </div>
  );
}
