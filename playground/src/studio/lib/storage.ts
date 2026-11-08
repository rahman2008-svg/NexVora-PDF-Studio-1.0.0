import { checkTemplate, getInputFromTemplate, type Template } from '@pdfme/common';
import {
  deletePlaygroundProject,
  duplicatePlaygroundProject,
  getPlaygroundProject,
  readPlaygroundProjects,
  renamePlaygroundProject,
  savePlaygroundProject,
  setPlaygroundProjectThumbnail,
  type PlaygroundProject,
} from '../../lib/playgroundProjects';
import { generatePdf } from './pdfIO';
import { CATEGORIES } from './brand';

export type FormFieldKind = 'text' | 'number' | 'date' | 'checkbox' | 'select';
export type FormFieldConfig = {
  kind: FormFieldKind;
  required: boolean;
  label?: string;
  options?: string[];
};

export type StudioMeta = {
  favorite: boolean;
  category: string;
  isTemplate: boolean;
  sourceTemplateId?: string;
  formFields: Record<string, FormFieldConfig>;
};

export type StudioProject = PlaygroundProject;

export const getMeta = (p: Pick<PlaygroundProject, 'metadata'>): StudioMeta => {
  const m = (p.metadata ?? {}) as Partial<StudioMeta>;
  return {
    favorite: m.favorite === true,
    category: typeof m.category === 'string' ? m.category : 'Custom Templates',
    isTemplate: m.isTemplate === true,
    sourceTemplateId: typeof m.sourceTemplateId === 'string' ? m.sourceTemplateId : undefined,
    formFields: (m.formFields ?? {}) as Record<string, FormFieldConfig>,
  };
};

export const listStudioProjects = async (): Promise<StudioProject[]> =>
  (await readPlaygroundProjects()).filter((p) => p.kind === 'template');

export const loadStudioProject = (id: string) => getPlaygroundProject(id);

export const createStudioProject = (args: {
  title: string;
  template: Template;
  category?: string;
  isTemplate?: boolean;
  sourceTemplateId?: string;
  inputs?: Record<string, string>[];
}) =>
  savePlaygroundProject({
    kind: 'template',
    title: args.title,
    template: args.template,
    inputs: args.inputs,
    metadata: {
      favorite: false,
      category: args.category ?? 'Custom Templates',
      isTemplate: args.isTemplate ?? false,
      sourceTemplateId: args.sourceTemplateId,
      formFields: {},
    } satisfies StudioMeta,
  });

export const saveStudioTemplate = (project: StudioProject, template: Template) =>
  savePlaygroundProject({
    id: project.id,
    kind: 'template',
    title: project.title,
    template,
    inputs: getInputFromTemplate(template),
    metadata: project.metadata,
  });

export const patchMeta = (project: StudioProject, patch: Partial<StudioMeta>) =>
  savePlaygroundProject({
    id: project.id,
    kind: 'template',
    title: project.title,
    template: project.template,
    inputs: project.inputs,
    metadata: { ...getMeta(project), ...patch },
  });

export const renameProject = renamePlaygroundProject;
export const duplicateProject = duplicatePlaygroundProject;
export const deleteProject = deletePlaygroundProject;

/** Best effort: failure must never block saving. */
export const refreshThumbnail = async (id: string, template: Template) => {
  try {
    const { pdf2img } = await import('@pdfme/converter');
    const pdf = await generatePdf({ template });
    const [img] = await pdf2img(new Uint8Array(pdf).buffer, { range: { end: 1 } });
    if (!img) return;
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(new Blob([new Uint8Array(img)], { type: 'image/png' }));
    });
    await setPlaygroundProjectThumbnail(id, url);
  } catch (e) {
    console.warn('Thumbnail generation skipped', e);
  }
};

/* ---------- import / export ---------- */
export const BUNDLE_FORMAT = 'nexvora-project';

export type ProjectBundle = {
  format: typeof BUNDLE_FORMAT;
  version: 1;
  title: string;
  category: string;
  isTemplate: boolean;
  formFields: Record<string, FormFieldConfig>;
  template: Template;
  inputs: Record<string, string>[];
};

export const toBundle = (p: StudioProject): ProjectBundle => {
  const m = getMeta(p);
  return {
    format: BUNDLE_FORMAT,
    version: 1,
    title: p.title,
    category: m.category,
    isTemplate: m.isTemplate,
    formFields: m.formFields,
    template: p.template,
    inputs: p.inputs,
  };
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Accepts a NexVora bundle, an array of bundles, or a raw PDFme template JSON. */
export const importFromJson = async (text: string, fallbackTitle: string) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not valid JSON: ${(e as Error).message}`);
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (items.length === 0) throw new Error('The file contains no projects.');
  const created: StudioProject[] = [];
  for (const item of items) {
    if (!isObj(item)) throw new Error('Unrecognised file content.');
    if (item.format === BUNDLE_FORMAT && isObj(item.template)) {
      const template = item.template as unknown as Template;
      checkTemplate(template);
      const category =
        typeof item.category === 'string' && item.category ? item.category : 'Custom Templates';
      const project = await createStudioProject({
        title: typeof item.title === 'string' ? item.title : fallbackTitle,
        template,
        category,
        isTemplate: item.isTemplate === true,
        inputs: Array.isArray(item.inputs) ? (item.inputs as Record<string, string>[]) : undefined,
      });
      if (isObj(item.formFields)) {
        created.push(
          await patchMeta(project, { formFields: item.formFields as StudioMeta['formFields'] }),
        );
      } else created.push(project);
    } else if (Array.isArray(item.schemas) && item.basePdf !== undefined) {
      const template = item as unknown as Template;
      checkTemplate(template);
      created.push(await createStudioProject({ title: fallbackTitle, template }));
    } else {
      throw new Error('This JSON is neither a PDFme template nor a NexVora project export.');
    }
  }
  return created;
};

export const isKnownCategory = (c: string) => (CATEGORIES as readonly string[]).includes(c);
