import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ConfirmDialog, PdfPreviewModal, PromptDialog, errMsg } from '../components/ui';
import type { ProjectActions } from '../components/ProjectCard';
import { useSettings } from './settings';
import { downloadJson, generatePdf, sanitizeFilename } from './pdfIO';
import {
  deleteProject, duplicateProject, getMeta, patchMeta, renameProject, toBundle, type StudioProject,
} from './storage';

/** Shared project actions + their dialogs, used by Dashboard and Projects. */
export function useProjectActions(refresh: () => Promise<void>) {
  const nav = useNavigate();
  const { settings } = useSettings();
  const [renaming, setRenaming] = useState<StudioProject | null>(null);
  const [deleting, setDeleting] = useState<StudioProject | null>(null);
  const [preview, setPreview] = useState<{ data: Uint8Array; name: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const doDelete = (p: StudioProject) => run(() => deleteProject(p.id), `Deleted “${p.title}”`);

  const actions: ProjectActions = {
    onOpen: (p) => nav(`/studio/editor/${encodeURIComponent(p.id)}`),
    onFavorite: (p) => void run(() => patchMeta(p, { favorite: !getMeta(p).favorite })),
    onRename: setRenaming,
    onDuplicate: (p) => void run(() => duplicateProject(p.id), 'Project duplicated'),
    onDelete: (p) => (settings.confirmDelete ? setDeleting(p) : void doDelete(p)),
    onExport: (p) => downloadJson(toBundle(p), sanitizeFilename(p.title)),
    onPreview: (p) =>
      void generatePdf({ template: p.template, inputs: p.inputs, settings, title: p.title })
        .then((data) => setPreview({ data, name: p.title }))
        .catch((e) => toast.error(errMsg(e))),
  };

  const dialogs = (
    <>
      {renaming && (
        <PromptDialog title="Rename project" label="Project name" initial={renaming.title} confirmText="Rename"
          onClose={() => setRenaming(null)}
          onSubmit={(v) => { const p = renaming; setRenaming(null); void run(() => renameProject(p.id, v), 'Renamed'); }} />
      )}
      {deleting && (
        <ConfirmDialog title="Delete project?" message={`“${deleting.title}” will be permanently removed from this browser. Export it first if you want a backup.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => { const p = deleting; setDeleting(null); void doDelete(p); }} />
      )}
      {preview && <PdfPreviewModal data={preview.data} filename={preview.name} onClose={() => setPreview(null)} />}
    </>
  );
  return { actions, dialogs };
}
