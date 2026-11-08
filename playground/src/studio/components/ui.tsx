import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, Upload, X } from 'lucide-react';
import { downloadBlob, pdfBlob, withExt, sanitizeFilename } from '../lib/pdfIO';

export function Modal({
  title,
  onClose,
  children,
  narrow,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  narrow?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="nx-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`nx-modal${narrow ? ' narrow' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="nx-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="nx-h2" style={{ margin: 0 }}>{title}</h2>
          <button className="nx-btn sm icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Alert({ kind = 'info', children }: { kind?: 'err' | 'ok' | 'info'; children: ReactNode }) {
  return <div className={`nx-alert ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</div>;
}

/** Text prompt dialog (rename etc.). */
export function PromptDialog({
  title, label, initial, confirmText = 'OK', onSubmit, onClose,
}: {
  title: string; label: string; initial: string; confirmText?: string;
  onSubmit: (value: string) => void; onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Modal title={title} onClose={onClose} narrow>
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }} className="nx-field">
        <label htmlFor="nx-prompt">{label}</label>
        <input id="nx-prompt" className="nx-input" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="nx-row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="button" className="nx-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="nx-btn primary" disabled={!value.trim()}>{confirmText}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmDialog({
  title, message, confirmText = 'Delete', onConfirm, onClose,
}: { title: string; message: string; confirmText?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} narrow>
      <p className="nx-sub" style={{ marginTop: 0 }}>{message}</p>
      <div className="nx-row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="nx-btn" onClick={onClose}>Cancel</button>
        <button className="nx-btn danger" onClick={onConfirm}>{confirmText}</button>
      </div>
    </Modal>
  );
}

/** Blob-backed PDF preview using the browser's native PDF viewer. */
export function PdfPreviewModal({ data, filename, onClose }: { data: Uint8Array; filename: string; onClose: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(pdfBlob(data));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data]);
  return (
    <Modal title="PDF Preview" onClose={onClose}>
      {url && <iframe title="PDF preview" src={url} />}
      <p className="nx-muted">
        If the preview is blank (some mobile browsers cannot embed PDFs), use Download.
      </p>
      <div className="nx-row" style={{ justifyContent: 'flex-end' }}>
        <button className="nx-btn primary" onClick={() => downloadBlob(pdfBlob(data), withExt(sanitizeFilename(filename), 'pdf'))}>
          <Download size={16} /> Download
        </button>
      </div>
    </Modal>
  );
}

/** Click-or-drop file picker with extension/MIME validation and size limit. */
export function FilePicker({
  accept, multiple, label, onFiles, maxMB = 100,
}: {
  accept: string; multiple?: boolean; label: string; maxMB?: number;
  onFiles: (files: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const rules = accept.split(',').map((s) => s.trim().toLowerCase());
  const valid = (f: File) =>
    rules.some((r) => (r.startsWith('.') ? f.name.toLowerCase().endsWith(r) : f.type.toLowerCase().startsWith(r.replace('*', ''))));
  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const bad = files.find((f) => !valid(f));
    if (bad) return setError(`"${bad.name}" is not a supported file type (${accept}).`);
    const big = files.find((f) => f.size > maxMB * 1024 * 1024);
    if (big) return setError(`"${big.name}" is larger than ${maxMB} MB.`);
    const empty = files.find((f) => f.size === 0);
    if (empty) return setError(`"${empty.name}" is empty.`);
    setError('');
    onFiles(files);
  };
  return (
    <div>
      <div
        className="nx-drop" role="button" tabIndex={0}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files); }}
      >
        <Upload size={20} style={{ marginBottom: 4 }} />
        <div>{label}</div>
        <input ref={ref} type="file" hidden accept={accept} multiple={multiple}
          onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
      </div>
      {error && <div className="nx-err" role="alert" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
