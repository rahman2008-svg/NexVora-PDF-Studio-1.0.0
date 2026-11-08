import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft, Copy, Download, Eye, FileJson, FileText, PanelRight, Redo2, Save, Trash2, Undo2, ZoomIn, ZoomOut,
} from 'lucide-react';
import { cloneDeep, checkTemplate, getInputFromTemplate, PAGE_SIZE_PRESETS, type Template } from '@pdfme/common';
import { Designer } from '@pdfme/ui';
import { getPlugins } from '../../plugins';
import { useSettings } from '../lib/settings';
import { applyFilenamePattern, deliverPdf, downloadJson, generatePdf, getStudioFonts } from '../lib/pdfIO';
import {
  getMeta, loadStudioProject, patchMeta, refreshThumbnail, renameProject, saveStudioTemplate, toBundle, type StudioProject,
} from '../lib/storage';
import { Alert, Modal, PdfPreviewModal, errMsg } from '../components/ui';
import { LogoMark } from '../components/Logo';

type Status = 'saved' | 'dirty' | 'saving' | 'failed';
const STATUS_TEXT: Record<Status, string> = { saved: 'Saved', dirty: 'Unsaved changes', saving: 'Saving…', failed: 'Save failed' };

/** Designer shortcuts are bound with hotkeys-js on `document`; the toolbar replays them. */
const press = (key: string, keyCode: number, mods: { ctrl?: boolean } = {}) => {
  const init = { key, keyCode, which: keyCode, ctrlKey: !!mods.ctrl, bubbles: true, cancelable: true } as KeyboardEventInit;
  document.dispatchEvent(new KeyboardEvent('keydown', init));
  document.dispatchEvent(new KeyboardEvent('keyup', init));
};

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export default function Editor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { settings } = useSettings();
  const hostRef = useRef<HTMLDivElement>(null);
  const designer = useRef<Designer | null>(null);
  const projectRef = useRef<StudioProject | null>(null);
  const statusRef = useRef<Status>('saved');
  const applying = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const settingsRef = useRef(settings);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [loadError, setLoadError] = useState('');
  const [status, setStatusState] = useState<Status>('saved');
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [sidebar, setSidebar] = useState(true);
  const [modal, setModal] = useState<null | 'page' | 'template'>(null);
  const [pageTpl, setPageTpl] = useState<Template | null>(null);
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const setStatus = (s: Status) => { statusRef.current = s; setStatusState(s); };

  /* load project */
  useEffect(() => {
    let cancelled = false;
    loadStudioProject(id)
      .then((p) => {
        if (cancelled) return;
        if (!p) return setLoadError('This project was not found in this browser. It may have been deleted.');
        projectRef.current = p;
        setProject(p);
        setTitle(p.title);
      })
      .catch((e) => !cancelled && setLoadError(errMsg(e)));
    return () => { cancelled = true; };
  }, [id]);

  const save = useCallback(async (manual: boolean) => {
    const d = designer.current;
    const p = projectRef.current;
    if (!d || !p) return false;
    window.clearTimeout(timer.current);
    setStatus('saving');
    try {
      const template = d.getTemplate();
      const saved = await saveStudioTemplate(p, template);
      projectRef.current = saved;
      setLastSaved(saved.updatedAt);
      setStatus('saved');
      if (manual) { toast.success('Project saved'); void refreshThumbnail(saved.id, template); }
      return true;
    } catch (e) {
      setStatus('failed');
      toast.error(`Save failed: ${errMsg(e)}`);
      return false;
    }
  }, []);

  /* mount the real PDFme Designer */
  const projectId = project?.id;
  useEffect(() => {
    if (!projectId || !hostRef.current) return undefined;
    let cancelled = false;
    let instance: Designer | null = null;
    const host = hostRef.current;
    void (async () => {
      try {
        const font = await getStudioFonts(settingsRef.current.defaultFont);
        if (cancelled) return;
        instance = new Designer({
          domContainer: host,
          template: cloneDeep(projectRef.current!.template),
          options: {
            font,
            lang: 'en',
            labels: { 'signature.clear': '🗑️' },
            theme: { token: { colorPrimary: '#8B5CF6' } },
            maxZoom: 300,
            zoomLevel: 1,
            sidebarOpen: window.innerWidth >= 900,
          },
          plugins: getPlugins(),
        });
        designer.current = instance;
        setSidebar(window.innerWidth >= 900);
        instance.onSaveTemplate(() => void save(true));
        instance.onChangeTemplate(() => {
          if (applying.current) return;
          setStatus('dirty');
          if (settingsRef.current.autosave) {
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => void save(false), settingsRef.current.autosaveDelaySec * 1000);
          }
        });
      } catch (e) {
        setLoadError(`Could not start the designer: ${errMsg(e)}`);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      const p = projectRef.current;
      if (instance) {
        // Flush unsaved edits so navigating away never loses work.
        if ((statusRef.current === 'dirty' || statusRef.current === 'failed') && p) {
          try {
            void saveStudioTemplate(p, instance.getTemplate()).catch((e) => toast.error(`Could not save latest changes: ${errMsg(e)}`));
          } catch (e) { console.error(e); }
        }
        try { instance.destroy(); } catch (e) { console.warn(e); }
      }
      if (designer.current === instance) designer.current = null;
    };
  }, [projectId, save]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (statusRef.current === 'dirty' || statusRef.current === 'failed') { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const applyTemplate = (t: Template) => {
    const d = designer.current;
    if (!d) return;
    checkTemplate(t);
    applying.current = true;
    try { d.updateTemplate(t); } finally { applying.current = false; }
    setStatus('dirty');
    if (settingsRef.current.autosave) {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(false), settingsRef.current.autosaveDelaySec * 1000);
    }
  };

  const changeZoom = (z: number) => {
    const next = Math.min(3, Math.max(0.3, Math.round(z * 100) / 100));
    setZoom(next);
    designer.current?.updateOptions({ zoomLevel: next });
  };

  const currentTemplate = () => {
    const d = designer.current;
    if (!d) throw new Error('The designer is not ready yet.');
    return d.getTemplate();
  };

  const renderPdf = async () => {
    const p = projectRef.current!;
    const template = currentTemplate();
    return generatePdf({ template, inputs: getInputFromTemplate(template), settings, title: p.title });
  };

  const doPreview = async () => {
    setBusy(true);
    try { setPreview(await renderPdf()); } catch (e) { toast.error(`Preview failed: ${errMsg(e)}`); } finally { setBusy(false); }
  };
  const doExport = async () => {
    setBusy(true);
    try {
      const data = await renderPdf();
      deliverPdf(data, applyFilenamePattern(settings.filenamePattern, projectRef.current!.title), settings.exportMode);
      toast.success('PDF exported');
    } catch (e) { toast.error(`Export failed: ${errMsg(e)}`); } finally { setBusy(false); }
  };

  const commitTitle = async () => {
    const p = projectRef.current;
    if (!p || !title.trim() || title.trim() === p.title) return setTitle(p?.title ?? '');
    try {
      const updated = await renameProject(p.id, title.trim());
      if (updated) { projectRef.current = { ...projectRef.current!, title: updated.title }; setTitle(updated.title); }
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (loadError) {
    return (
      <div className="nx-page">
        <Alert kind="err">{loadError}</Alert>
        <button className="nx-btn" style={{ marginTop: 12 }} onClick={() => nav('/studio/projects')}>Back to projects</button>
      </div>
    );
  }

  const meta = project ? getMeta(project) : null;
  return (
    <div className="nx-editor">
      <div className="nx-toolbar" role="toolbar" aria-label="Editor toolbar">
        <button className="nx-btn sm icon" aria-label="Back to projects" onClick={() => nav('/studio/projects')}><ArrowLeft size={16} /></button>
        <LogoMark size={24} />
        <input className="nx-input" style={{ width: 170, minHeight: 34 }} aria-label="Project title" value={title}
          onChange={(e) => setTitle(e.target.value)} onBlur={() => void commitTitle()}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
        <span className="nx-status" aria-live="polite"><span className={`nx-dot ${status === 'dirty' ? '' : status}`} />{STATUS_TEXT[status]}{status === 'saved' && lastSaved ? ` ${new Date(lastSaved).toLocaleTimeString()}` : ''}</span>
        <span className="sep" />
        <button className="nx-btn sm icon" title="Undo (Ctrl+Z)" aria-label="Undo" onClick={() => press('z', 90, { ctrl: true })}><Undo2 size={15} /></button>
        <button className="nx-btn sm icon" title="Redo (Ctrl+Y)" aria-label="Redo" onClick={() => press('y', 89, { ctrl: true })}><Redo2 size={15} /></button>
        <button className="nx-btn sm icon" title="Duplicate selected" aria-label="Duplicate selected" onClick={() => { press('c', 67, { ctrl: true }); press('v', 86, { ctrl: true }); }}><Copy size={15} /></button>
        <button className="nx-btn sm icon danger" title="Delete selected" aria-label="Delete selected" onClick={() => press('Delete', 46)}><Trash2 size={15} /></button>
        <span className="sep" />
        <button className="nx-btn sm icon" aria-label="Zoom out" onClick={() => changeZoom(zoom - 0.1)}><ZoomOut size={15} /></button>
        <button className="nx-btn sm" aria-label="Reset zoom" onClick={() => changeZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button className="nx-btn sm icon" aria-label="Zoom in" onClick={() => changeZoom(zoom + 0.1)}><ZoomIn size={15} /></button>
        <button className="nx-btn sm" onClick={() => { try { setPageTpl(currentTemplate()); setModal('page'); } catch (e) { toast.error(errMsg(e)); } }}><FileText size={15} /> Page</button>
        <button className="nx-btn sm" onClick={() => setModal('template')}><FileJson size={15} /> Template</button>
        <button className="nx-btn sm icon" aria-label="Toggle properties panel" title="Toggle properties panel"
          onClick={() => { const n = !sidebar; setSidebar(n); designer.current?.updateOptions({ sidebarOpen: n }); }}><PanelRight size={15} /></button>
        <span style={{ flex: 1 }} />
        <button className="nx-btn sm" disabled={busy} onClick={() => void doPreview()}><Eye size={15} /> Preview</button>
        <button className="nx-btn sm" disabled={busy} onClick={() => void doExport()}><Download size={15} /> Export</button>
        <button className="nx-btn sm primary" disabled={status === 'saving'} onClick={() => void save(true)}><Save size={15} /> Save</button>
      </div>
      <div ref={hostRef} className="nx-designer" />
      {preview && <PdfPreviewModal data={preview} filename={project?.title ?? 'document'} onClose={() => setPreview(null)} />}
      {modal === 'page' && pageTpl && <PageSettings template={pageTpl} onApply={(t) => { applyTemplate(t); setModal(null); }} onClose={() => setModal(null)} />}
      {modal === 'template' && project && meta && (
        <Modal title="Template & project" onClose={() => setModal(null)}>
          <div className="nx-field" style={{ gap: 10 }}>
            <p className="nx-muted" style={{ margin: 0 }}>Category: {meta.category}</p>
            <button className="nx-btn" onClick={() => downloadJson(currentTemplate(), `${project.title}.pdfme-template`)}>Export PDFme template JSON (compatible with any PDFme app)</button>
            <button className="nx-btn" onClick={() => downloadJson({ ...toBundle(project), template: currentTemplate() }, `${project.title}.nexvora`)}>Export NexVora project bundle</button>
            <button className="nx-btn" onClick={() => void patchMeta(projectRef.current!, { isTemplate: !getMeta(projectRef.current!).isTemplate }).then((p) => { projectRef.current = p; setProject(p); toast.success(getMeta(p).isTemplate ? 'Saved as template' : 'Removed from saved templates'); }).catch((e) => toast.error(errMsg(e)))}>
              {meta.isTemplate ? 'Remove from Saved Templates' : 'Save as reusable template'}
            </button>
            <label className="nx-lbl" htmlFor="nx-replace">Replace current design with a template JSON file</label>
            <input id="nx-replace" type="file" accept=".json,application/json" className="nx-input"
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (!f) return;
                try {
                  const parsed = JSON.parse(await f.text()) as Record<string, unknown>;
                  const t = (parsed.format === 'nexvora-project' ? parsed.template : parsed) as Template;
                  if (!window.confirm('Replace the current design with this file? You can undo only by reloading a saved version.')) return;
                  applyTemplate(t); setModal(null); toast.success('Template replaced');
                } catch (err) { toast.error(`Import failed: ${errMsg(err)}`); }
              }} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function PageSettings({ template, onApply, onClose }: { template: Template; onApply: (t: Template) => void; onClose: () => void }) {
  const blank = typeof template.basePdf === 'object' && !(template.basePdf instanceof Uint8Array) && !(template.basePdf instanceof ArrayBuffer) && 'width' in (template.basePdf as object);
  const bp = (blank ? template.basePdf : { width: 210, height: 297, padding: [20, 10, 20, 10] }) as { width: number; height: number; padding: [number, number, number, number] };
  const [w, setW] = useState(bp.width);
  const [h, setH] = useState(bp.height);
  const [pad, setPad] = useState<[number, number, number, number]>([...bp.padding] as [number, number, number, number]);
  const [err, setErr] = useState('');
  const preset = (name: string) => {
    const p = PAGE_SIZE_PRESETS[name as keyof typeof PAGE_SIZE_PRESETS];
    if (p) { setW(p.width); setH(p.height); }
  };
  const apply = () => {
    if (!(w >= 20 && w <= 2000 && h >= 20 && h <= 2000)) return setErr('Width and height must be between 20 and 2000 mm.');
    if (pad.some((n) => !(n >= 0) || n * 2 >= Math.min(w, h))) return setErr('Padding values are invalid for this page size.');
    const next = cloneDeep(template);
    next.basePdf = { ...(blank ? (template.basePdf as object) : {}), width: w, height: h, padding: pad } as Template['basePdf'];
    onApply(next);
  };
  return (
    <Modal title="Page settings" onClose={onClose}>
      {!blank && <Alert kind="info">This template uses an uploaded PDF as its background, so its page size comes from that PDF. You can replace the background PDF below, or switch to a blank page.</Alert>}
      <div className="nx-field" style={{ gap: 10, marginTop: 10 }}>
        <label htmlFor="nx-preset">Preset</label>
        <select id="nx-preset" className="nx-select" defaultValue="" onChange={(e) => preset(e.target.value)}>
          <option value="" disabled>Choose a size…</option>
          {Object.keys(PAGE_SIZE_PRESETS).map((k) => <option key={k}>{k}</option>)}
        </select>
        <div className="nx-row">
          <div className="nx-field" style={{ flex: 1 }}><label htmlFor="nx-w">Width (mm)</label><input id="nx-w" className="nx-input" type="number" value={w} onChange={(e) => setW(Number(e.target.value))} /></div>
          <div className="nx-field" style={{ flex: 1 }}><label htmlFor="nx-h">Height (mm)</label><input id="nx-h" className="nx-input" type="number" value={h} onChange={(e) => setH(Number(e.target.value))} /></div>
        </div>
        <div className="nx-row">
          {(['Top', 'Right', 'Bottom', 'Left'] as const).map((l, i) => (
            <div key={l} className="nx-field" style={{ flex: 1, minWidth: 70 }}><label htmlFor={`nx-p${i}`}>{l}</label>
              <input id={`nx-p${i}`} className="nx-input" type="number" value={pad[i]} onChange={(e) => setPad((p) => { const n = [...p] as typeof p; n[i] = Number(e.target.value); return n; })} /></div>
          ))}
        </div>
        <div className="nx-row">
          <button className="nx-btn" onClick={() => { setW(h); setH(w); }}>Swap orientation</button>
          <label className="nx-btn" style={{ cursor: 'pointer' }}>Use PDF as background…
            <input type="file" accept="application/pdf,.pdf" hidden onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
              try { const next = cloneDeep(template); next.basePdf = await readDataUrl(f); onApply(next); }
              catch (er) { setErr(errMsg(er)); }
            }} />
          </label>
        </div>
        {err && <Alert kind="err">{err}</Alert>}
        <div className="nx-row" style={{ justifyContent: 'flex-end' }}>
          <button className="nx-btn" onClick={onClose}>Cancel</button>
          <button className="nx-btn primary" onClick={apply}>{blank ? 'Apply' : 'Switch to blank page'}</button>
        </div>
      </div>
    </Modal>
  );
}
