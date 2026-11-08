import type { FormFieldConfig } from '../lib/storage';
import { resolveKind, resolveOptions, type TemplateField } from '../lib/fields';

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export default function FieldEditor({
  fields, values, config = {}, errors = {}, onChange,
}: {
  fields: TemplateField[];
  values: Record<string, string>;
  config?: Record<string, FormFieldConfig>;
  errors?: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  if (fields.length === 0) {
    return <p className="nx-muted">This template has no editable fields. Open it in the editor and add fields (any element that is not marked read-only).</p>;
  }
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
      {fields.map((f) => {
        const cfg = config[f.name];
        const kind = resolveKind(f, cfg);
        const id = `nx-f-${f.name}`;
        const v = values[f.name] ?? '';
        const err = errors[f.name];
        const label = cfg?.label || f.name;
        let control;
        if (kind === 'checkbox') {
          const on = v === 'true' || v === 'Yes';
          control = (
            <label className="nx-row" style={{ gap: 10, minHeight: 42 }}>
              <input id={id} type="checkbox" style={{ width: 20, height: 20 }} checked={on}
                onChange={(e) => onChange(f.name, f.type === 'checkbox' ? String(e.target.checked) : e.target.checked ? 'Yes' : 'No')} />
              <span>{on ? 'Checked' : 'Unchecked'}</span>
            </label>
          );
        } else if (kind === 'select') {
          const opts = resolveOptions(f, cfg);
          control = (
            <select id={id} className="nx-select" value={v} onChange={(e) => onChange(f.name, e.target.value)}>
              {!opts.includes(v) && <option value={v}>{v || '— choose —'}</option>}
              {opts.map((o) => <option key={o}>{o}</option>)}
            </select>
          );
        } else if (kind === 'date' && !['date', 'dateTime', 'time'].includes(f.type)) {
          control = <input id={id} className="nx-input" type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''} onChange={(e) => onChange(f.name, e.target.value)} />;
        } else if (kind === 'number') {
          control = <input id={id} className="nx-input" type="number" inputMode="decimal" value={v} onChange={(e) => onChange(f.name, e.target.value)} />;
        } else if (kind === 'json') {
          control = <textarea id={id} className="nx-textarea" spellCheck={false} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} value={v} onChange={(e) => onChange(f.name, e.target.value)} />;
        } else if (kind === 'image') {
          control = (
            <div className="nx-row">
              {v.startsWith('data:image') && <img src={v} alt="" style={{ height: 44, borderRadius: 8, background: '#fff' }} />}
              <input id={id} type="file" accept="image/png,image/jpeg" className="nx-input"
                onChange={async (e) => { const file = e.target.files?.[0]; if (file) onChange(f.name, await readDataUrl(file)); }} />
            </div>
          );
        } else if (kind === 'unsupported') {
          control = <span className="nx-muted">Edit this {f.type} field in the Designer (not supported in forms).</span>;
        } else {
          const multi = v.includes('\n') || v.length > 60;
          control = multi
            ? <textarea id={id} className="nx-textarea" value={v} onChange={(e) => onChange(f.name, e.target.value)} />
            : <input id={id} className="nx-input" value={v} placeholder={f.format} onChange={(e) => onChange(f.name, e.target.value)} />;
        }
        return (
          <div key={f.name} className="nx-field">
            <label htmlFor={id} className={cfg?.required ? 'nx-req' : ''}>{label} <span style={{ opacity: 0.6 }}>({f.type})</span></label>
            {control}
            {err && <span className="nx-err" role="alert">{err}</span>}
          </div>
        );
      })}
    </div>
  );
}
