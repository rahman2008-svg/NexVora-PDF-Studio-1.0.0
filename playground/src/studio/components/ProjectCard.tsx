import { Copy, Download, Eye, FileText, Pencil, Star, Trash2 } from 'lucide-react';
import { getMeta, type StudioProject } from '../lib/storage';

export type ProjectActions = {
  onOpen: (p: StudioProject) => void;
  onFavorite: (p: StudioProject) => void;
  onRename: (p: StudioProject) => void;
  onDuplicate: (p: StudioProject) => void;
  onDelete: (p: StudioProject) => void;
  onExport: (p: StudioProject) => void;
  onPreview: (p: StudioProject) => void;
};

export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function ProjectCard({ project, actions }: { project: StudioProject; actions: ProjectActions }) {
  const meta = getMeta(project);
  return (
    <div className="nx-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="nx-thumb" onClick={() => actions.onOpen(project)} style={{ cursor: 'pointer' }}>
        {project.thumbnail ? <img src={project.thumbnail} alt={`${project.title} preview`} /> : <FileText size={28} />}
      </div>
      <div>
        <div className="nx-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.title}</strong>
          <button className="nx-btn sm icon" aria-label={meta.favorite ? 'Remove favorite' : 'Add favorite'} aria-pressed={meta.favorite} onClick={() => actions.onFavorite(project)}>
            <Star size={15} fill={meta.favorite ? 'var(--nx-cyan)' : 'none'} color={meta.favorite ? 'var(--nx-cyan)' : 'currentColor'} />
          </button>
        </div>
        <div className="nx-muted">{meta.category}{meta.isTemplate ? ' • Template' : ''}</div>
        <div className="nx-muted" style={{ fontSize: 12 }}>Edited {fmtDate(project.updatedAt)}</div>
      </div>
      <div className="nx-row" style={{ gap: 6 }}>
        <button className="nx-btn sm primary" onClick={() => actions.onOpen(project)}>Open</button>
        <button className="nx-btn sm icon" aria-label="Preview PDF" title="Preview" onClick={() => actions.onPreview(project)}><Eye size={15} /></button>
        <button className="nx-btn sm icon" aria-label="Rename" title="Rename" onClick={() => actions.onRename(project)}><Pencil size={15} /></button>
        <button className="nx-btn sm icon" aria-label="Duplicate" title="Duplicate" onClick={() => actions.onDuplicate(project)}><Copy size={15} /></button>
        <button className="nx-btn sm icon" aria-label="Export JSON" title="Export JSON" onClick={() => actions.onExport(project)}><Download size={15} /></button>
        <button className="nx-btn sm icon danger" aria-label="Delete" title="Delete" onClick={() => actions.onDelete(project)}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}
