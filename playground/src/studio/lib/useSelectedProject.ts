import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { StudioProject } from './storage';

/** Selected project id lives in ?project= so pages are linkable and survive refresh. */
export function useSelectedProject(projects: StudioProject[]) {
  const [params, setParams] = useSearchParams();
  const [sel, setSel] = useState<StudioProject | null>(null);
  const id = params.get('project') ?? '';
  useEffect(() => {
    setSel(projects.find((p) => p.id === id) ?? null);
  }, [projects, id]);
  const select = (pid: string) => {
    const n = new URLSearchParams(params);
    if (pid) n.set('project', pid); else n.delete('project');
    setParams(n, { replace: true });
  };
  return { selected: sel, select };
}
