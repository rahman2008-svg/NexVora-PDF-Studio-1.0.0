import { cloneDeep, getInputFromTemplate, type Template } from '@pdfme/common';
import type { FormFieldConfig, FormFieldKind } from './storage';

export type TemplateField = {
  name: string;
  type: string;
  content: string;
  options?: string[];
  format?: string;
  /** How the value is edited by default for this PDFme schema type. */
  defaultKind: FormFieldKind | 'json' | 'image' | 'unsupported';
};

const JSON_TYPES = ['table', 'multiVariableText', 'list'];
const UNSUPPORTED = ['signature', 'svg'];

/** Editable (non read-only) fields of a template, in document order. */
export const getTemplateFields = (template: Template): TemplateField[] => {
  const t = cloneDeep(template);
  getInputFromTemplate(t); // migrates legacy schema layout in place
  const seen = new Set<string>();
  const out: TemplateField[] = [];
  for (const page of t.schemas) {
    for (const s of page as unknown as Record<string, unknown>[]) {
      const name = String(s.name ?? '');
      if (!name || s.readOnly || seen.has(name)) continue;
      seen.add(name);
      const type = String(s.type ?? 'text');
      let defaultKind: TemplateField['defaultKind'] = 'text';
      if (type === 'checkbox') defaultKind = 'checkbox';
      else if (type === 'select' || type === 'radioGroup') defaultKind = 'select';
      else if (JSON_TYPES.includes(type)) defaultKind = 'json';
      else if (type === 'image') defaultKind = 'image';
      else if (UNSUPPORTED.includes(type)) defaultKind = 'unsupported';
      out.push({
        name,
        type,
        content: typeof s.content === 'string' ? s.content : '',
        options: Array.isArray(s.options) ? (s.options as string[]) : undefined,
        format: typeof s.format === 'string' ? s.format : undefined,
        defaultKind,
      });
    }
  }
  return out;
};

export const resolveKind = (f: TemplateField, cfg?: FormFieldConfig) =>
  cfg?.kind && (f.defaultKind === 'text' || f.defaultKind === 'checkbox' || f.defaultKind === 'select')
    ? cfg.kind
    : f.defaultKind;

export const resolveOptions = (f: TemplateField, cfg?: FormFieldConfig) =>
  f.options && f.options.length ? f.options : (cfg?.options ?? []);

export const initialValues = (template: Template, saved?: Record<string, string>) => {
  const base = getInputFromTemplate(cloneDeep(template))[0] ?? {};
  return { ...base, ...(saved ?? {}) };
};

/** Validate against field config; returns map name → message. */
export const validateValues = (
  fields: TemplateField[],
  values: Record<string, string>,
  config: Record<string, FormFieldConfig>,
) => {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const cfg = config[f.name];
    const kind = resolveKind(f, cfg);
    const v = values[f.name] ?? '';
    if (cfg?.required && kind !== 'checkbox' && !v.trim()) errors[f.name] = 'This field is required.';
    else if (cfg?.required && kind === 'checkbox' && v !== 'true' && v !== 'Yes') errors[f.name] = 'This box must be ticked.';
    else if (v && kind === 'number' && !Number.isFinite(Number(v))) errors[f.name] = 'Enter a valid number.';
    else if (v && kind === 'select') {
      const opts = resolveOptions(f, cfg);
      if (opts.length && !opts.includes(v)) errors[f.name] = 'Choose one of the listed options.';
    } else if (v && kind === 'json') {
      try {
        const parsed: unknown = JSON.parse(v);
        if (f.type === 'table' && !(Array.isArray(parsed) && parsed.every(Array.isArray))) {
          errors[f.name] = 'Table data must be a JSON array of rows, e.g. [["a","b"]].';
        }
      } catch {
        errors[f.name] = 'Invalid JSON.';
      }
    }
  }
  return errors;
};
