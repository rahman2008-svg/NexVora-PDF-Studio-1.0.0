import { Link } from 'react-router-dom';
import type { StudioProject } from '../lib/storage';

export default function ProjectSelect({
  projects, value, onChange, loading,
}: { projects: StudioProject[]; value: string; onChange: (id: string) => void; loading: boolean }) {
  if (!loading && projects.length === 0) {
    return <div className="nx-card">No projects yet. <Link to="/studio/library" className="nx-grad-text">Pick a template</Link> first.</div>;
  }
  return (
    <div className="nx-field" style={{ maxWidth: 420 }}>
      <label htmlFor="nx-project">Template / project</label>
      <select id="nx-project" className="nx-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select a project —</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
    </div>
  );
}
