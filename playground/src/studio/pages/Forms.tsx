import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Download, Eye, Save } from 'lucide-react';
import { useProjects } from '../lib/useProjects';
import { useSelectedProject } from '../lib/useSelectedProject';
import { useSettings } from '../lib/settings';
import ProjectSelect from '../components/ProjectSelect';
import FieldEditor from '../components/FieldEditor';
import { Alert, PdfPreviewModal, errMsg } from '../components/ui';
import { getTemplateFields, initialValues, resolveKind, validateValues } from '../lib/fields';
import { applyFilenamePattern, deliverPdf, generatePdf } from '../lib/pdfIO';
import { getMeta, patchMeta, type FormFieldConfig, type FormFieldKind } from '../lib/storage';

const KINDS: FormFieldKind[] = ['text', 'number', 'date', 'checkbox', 'select'];

export default function Forms() {
  const { settings } = useSettings();
  const { projects, loading, refresh } = useProjects();
  const { selected, select } = useSelectedProject(projects);
  const [tab, setTab] = useState<'build' | 'fill'>('fill');
  const [cfg, setCfg] = useState<Record<string, FormFieldConfig>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setCfg(getMeta(selected).formFields);
    setValues(initialValues(selected.template, selected.inputs[0]));
    setErrors({});
    setDirty(false);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = selected ? getTemplateFields(selected.template) : [];

  const setField = (name: string, patch: Partial<FormFieldConfig>) => {
    setCfg((c) => ({ ...c, [name]: { kind: 'text', required: false, ...c[name], ...patch } }));
    setDirty(true);
  };

  const saveConfig = async () => {
    if (!selected) return;
    try { await patchMeta(selected, { formFields: cfg }); setDirty(false); toast.success('Form settings saved'); await refresh(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const generate = async (mode: 'preview' | 'download') => {
    if (!selected) return;
    const errs = validateValues(fields, values, cfg);
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error(`${Object.keys(errs).length} field(s) need attention.`);
    setBusy(true);
    try {
      const data = await generatePdf({ template: selected.template, inputs: [values], settings, title: selected.title });
      if (mode === 'preview') setPreview(data);
      else deliverPdf(data, applyFilenamePattern(settings.filenamePattern, selected.title), settings.exportMode);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="nx-page">
      <h1 className="nx-h1">Form Builder</h1>
      <p className="nx-sub">Turn any template into a validated fill-in form. Field types, required flags and dropdown options are saved with the project; the template itself stays standard PDFme.</p>
      <div style={{ marginTop: 16 }}><ProjectSelect projects={projects} value={selected?.id ?? ''} onChange={select} loading={loading} /></div>
      {selected && (
        <>
          <div className="nx-tabs" style={{ marginTop: 14 }}>
            <button className={`nx-chip${tab === 'fill' ? ' active' : ''}`} onClick={() => setTab('fill')}>Fill & generate</button>
            <button className={`nx-chip${tab === 'build' ? ' active' : ''}`} onClick={() => setTab('build')}>Configure fields</button>
          </div>
          {tab === 'build' ? (
            <div className="nx-card" style={{ marginTop: 12 }}>
              {fields.length === 0 ? <p className="nx-muted">No editable fields in this template.</p> : (
                <div className="nx-table-wrap"><table className="nx-table">
                  <thead><tr><th>Field</th><th>Schema</th><th>Input type</th><th>Required</th><th>Label</th><th>Options (comma separated)</th></tr></thead>
                  <tbody>{fields.map((f) => {
                    const c = cfg[f.name];
                    const locked = !['text', 'checkbox', 'select'].includes(f.defaultKind);
                    const kind = resolveKind(f, c);
                    return (
                      <tr key={f.name}>
                        <td>{f.name}</td><td>{f.type}</td>
                        <td>{locked ? <span className="nx-muted">{f.defaultKind}</span> : (
                          <select className="nx-select" style={{ minHeight: 34 }} aria-label={`${f.name} input type`} value={kind as string} onChange={(e) => setField(f.name, { kind: e.target.value as FormFieldKind })}>
                            {KINDS.map((k) => <option key={k}>{k}</option>)}
                          </select>)}</td>
                        <td><input type="checkbox" aria-label={`${f.name} required`} style={{ width: 18, height: 18 }} checked={!!c?.required} onChange={(e) => setField(f.name, { required: e.target.checked })} /></td>
                        <td><input className="nx-input" style={{ minHeight: 34 }} aria-label={`${f.name} label`} value={c?.label ?? ''} placeholder={f.name} onChange={(e) => setField(f.name, { label: e.target.value })} /></td>
                        <td>{kind === 'select' && !(f.options?.length) ? (
                          <input className="nx-input" style={{ minHeight: 34 }} aria-label={`${f.name} options`} value={(c?.options ?? []).join(', ')} onChange={(e) => setField(f.name, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                        ) : <span className="nx-muted">{f.options?.length ? 'from template' : '—'}</span>}</td>
                      </tr>);
                  })}</tbody>
                </table></div>
              )}
              <div className="nx-row" style={{ marginTop: 14 }}>
                <button className="nx-btn primary" disabled={!dirty} onClick={() => void saveConfig()}><Save size={16} /> Save form settings</button>
                {dirty && <span className="nx-muted">Unsaved changes</span>}
              </div>
              <div style={{ marginTop: 12 }}><Alert kind="info">Select-type dropdowns in the template (Select / RadioGroup elements) use their own options. For text fields set to “select”, type the options above.</Alert></div>
            </div>
          ) : (
            <div className="nx-card" style={{ marginTop: 12 }}>
              <FieldEditor fields={fields} values={values} config={cfg} errors={errors} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
              <div className="nx-row" style={{ marginTop: 18 }}>
                <button className="nx-btn" disabled={busy} onClick={() => void generate('preview')}><Eye size={16} /> Preview</button>
                <button className="nx-btn primary" disabled={busy} onClick={() => void generate('download')}><Download size={16} /> Generate PDF</button>
              </div>
            </div>
          )}
        </>
      )}
      {preview && selected && <PdfPreviewModal data={preview} filename={selected.title} onClose={() => setPreview(null)} />}
    </div>
  );
}
