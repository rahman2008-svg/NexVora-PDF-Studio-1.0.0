import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from './lib/settings';
import Shell from './components/Shell';
import './studio.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const Library = lazy(() => import('./pages/Library'));
const Editor = lazy(() => import('./pages/Editor'));
const Generate = lazy(() => import('./pages/Generate'));
const Forms = lazy(() => import('./pages/Forms'));
const Bulk = lazy(() => import('./pages/Bulk'));
const Tools = lazy(() => import('./pages/Tools'));
const Codes = lazy(() => import('./pages/Codes'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const About = lazy(() => import('./pages/About'));

export default function StudioApp() {
  return (
    <SettingsProvider>
      <Shell>
        <Suspense fallback={<div className="nx-page"><p className="nx-muted">Loading…</p></div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/studio" replace />} />
            <Route path="/studio" element={<Dashboard />} />
            <Route path="/studio/projects" element={<Projects />} />
            <Route path="/studio/library" element={<Library />} />
            <Route path="/studio/editor/:id" element={<Editor />} />
            <Route path="/studio/generate" element={<Generate />} />
            <Route path="/studio/forms" element={<Forms />} />
            <Route path="/studio/bulk" element={<Bulk />} />
            <Route path="/studio/tools" element={<Tools />} />
            <Route path="/studio/codes" element={<Codes />} />
            <Route path="/studio/settings" element={<SettingsPage />} />
            <Route path="/studio/about" element={<About />} />
            <Route path="*" element={<Navigate to="/studio" replace />} />
          </Routes>
        </Suspense>
      </Shell>
    </SettingsProvider>
  );
}
