import { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import Header from './components/Header';
import { HeaderSlotProvider } from './components/HeaderSlot';

const StudioApp = lazy(() => import('./studio/StudioApp'));
const Designer = lazy(() => import('./routes/Designer'));
const FormAndViewer = lazy(() => import('./routes/FormAndViewer'));
const Templates = lazy(() => import('./routes/Templates'));
const WorkspaceApp = lazy(() =>
  import('./routes/Templates').then((module) => ({ default: module.WorkspaceApp })),
);
const JsxPlayground = lazy(() => import('./routes/JsxPlayground'));
const Md2Pdf = lazy(() => import('./routes/Md2Pdf'));

export default function App() {
  const { pathname } = useLocation();
  // NexVora PDF Studio owns "/" and "/studio/*". The original pdfme playground routes
  // (/templates, /designer, /form-viewer, /jsx, /md2pdf, /workspace) are untouched.
  if (pathname === '/' || pathname.startsWith('/studio')) {
    return (
      <div className="h-screen overflow-hidden supports-[height:100dvh]:h-dvh">
        <Suspense fallback={<main className="min-h-0 flex-1" />}>
          <StudioApp />
        </Suspense>
        <ToastContainer position="bottom-right" theme="colored" />
      </div>
    );
  }
  return (
    <HeaderSlotProvider>
      <div className="flex h-screen flex-col overflow-hidden supports-[height:100dvh]:h-dvh">
        <Header />
        <Suspense fallback={<main className="min-h-0 flex-1 bg-gray-100" />}>
          <Routes>
            <Route path="/workspace" element={<WorkspaceApp />} />
            <Route path={'/designer'} element={<Designer />} />
            <Route path="/form-viewer" element={<FormAndViewer />} />
            <Route path="/jsx" element={<JsxPlayground />} />
            <Route path="/md2pdf" element={<Md2Pdf />} />
            <Route path="/templates" element={<Templates />} />
          </Routes>
        </Suspense>
        <ToastContainer />
      </div>
    </HeaderSlotProvider>
  );
}
