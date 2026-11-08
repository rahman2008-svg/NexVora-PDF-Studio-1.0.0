import { PDFDocument, StandardFonts, degrees, rgb } from '@pdfme/pdf-lib';
import { img2pdf, pdf2img } from '@pdfme/converter';
import { makeZip, uniqueName, type ZipEntry } from './pdfIO';

export const MAX_PDF_MB = 150;

export type LoadedPdf = { name: string; bytes: Uint8Array; doc: PDFDocument; pages: number };

const friendly = (name: string, e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  if ((e as { name?: string })?.name === 'EncryptedPDFError' || /encrypt/i.test(msg)) {
    return new Error(
      `"${name}" is encrypted or password-protected. Remove the protection in the program that created it, then try again — NexVora does not bypass PDF security.`,
    );
  }
  return new Error(`"${name}" could not be read as a PDF (${msg}).`);
};

export const loadPdf = async (file: File): Promise<LoadedPdf> => {
  if (file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`"${file.name}" is larger than ${MAX_PDF_MB} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 1024));
  if (!head.includes('%PDF-')) throw new Error(`"${file.name}" is not a valid PDF file (no PDF header found).`);
  try {
    const doc = await PDFDocument.load(bytes);
    return { name: file.name, bytes, doc, pages: doc.getPageCount() };
  } catch (e) {
    throw friendly(file.name, e);
  }
};

/** "1-3, 5, 8-" → zero-based sorted unique indexes. Throws on bad input. */
export const parseRanges = (spec: string, total: number): number[] => {
  const out = new Set<number>();
  const parts = spec.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one page or range, e.g. 1-3, 5.');
  for (const part of parts) {
    const m = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) throw new Error(`“${part}” is not a valid page range.`);
    const a = m[1] ? Number(m[1]) : 1;
    const b = m[2] ? (m[3] ? Number(m[3]) : total) : a;
    if (a < 1 || b < a || b > total) throw new Error(`Range “${part}” is outside 1–${total}.`);
    for (let i = a; i <= b; i += 1) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
};

export const mergePdfs = async (files: LoadedPdf[]) => {
  const out = await PDFDocument.create();
  for (const f of files) {
    const pages = await out.copyPages(f.doc, f.doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
};

export const copyPagesTo = async (src: PDFDocument, indices: number[]) => {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
};

export const splitPdf = async (
  pdf: LoadedPdf,
  mode: 'each' | 'ranges',
  spec: string,
  baseName: string,
): Promise<ZipEntry[]> => {
  const groups: number[][] =
    mode === 'each'
      ? pdf.doc.getPageIndices().map((i) => [i])
      : spec.split(';').map((s) => s.trim()).filter(Boolean).map((s) => parseRanges(s, pdf.pages));
  if (!groups.length) throw new Error('Enter at least one range. Separate output files with “;” e.g. 1-3; 4-6.');
  const used = new Set<string>();
  const out: ZipEntry[] = [];
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i];
    const label = g.length === 1 ? `page-${g[0] + 1}` : `pages-${g[0] + 1}-${g[g.length - 1] + 1}`;
    out.push({ name: uniqueName(`${baseName}-${label}.pdf`, used), data: await copyPagesTo(pdf.doc, g) });
  }
  return out;
};

export const rotatePages = async (pdf: LoadedPdf, indices: number[], delta: 90 | 180 | 270) => {
  const doc = await PDFDocument.load(pdf.bytes);
  for (const i of indices) {
    const p = doc.getPage(i);
    p.setRotation(degrees((p.getRotation().angle + delta) % 360));
  }
  return doc.save();
};

export const deletePages = async (pdf: LoadedPdf, indices: number[]) => {
  if (indices.length >= pdf.pages) throw new Error('You cannot delete every page of the document.');
  const doc = await PDFDocument.load(pdf.bytes);
  [...indices].sort((a, b) => b - a).forEach((i) => doc.removePage(i));
  return doc.save();
};

export type PageItem = { index: number; rotate: number; selected: boolean };

export const arrangePages = async (pdf: LoadedPdf, items: PageItem[]) => {
  if (!items.length) throw new Error('No pages selected.');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(pdf.doc, items.map((i) => i.index));
  copied.forEach((p, k) => {
    if (items[k].rotate) p.setRotation(degrees((p.getRotation().angle + items[k].rotate) % 360));
    out.addPage(p);
  });
  return out.save();
};

const hexToRgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error('Colour must be a 6-digit hex value like #8B5CF6.');
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const textErr = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /WinAnsi|cannot encode/i.test(m)
    ? new Error('This text contains characters the built-in PDF font cannot draw (Latin characters only). Remove them and try again.')
    : (e as Error);
};

export const watermarkPdf = async (
  pdf: LoadedPdf,
  o: { text: string; size: number; opacity: number; angle: number; color: string; indices: number[] },
) => {
  if (!o.text.trim()) throw new Error('Enter the watermark text.');
  const doc = await PDFDocument.load(pdf.bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = hexToRgb(o.color);
  try {
    const tw = font.widthOfTextAtSize(o.text, o.size);
    const th = o.size * 0.7;
    const t = (o.angle * Math.PI) / 180;
    for (const i of o.indices) {
      const page = doc.getPage(i);
      const { width, height } = page.getSize();
      page.drawText(o.text, {
        x: width / 2 - ((tw / 2) * Math.cos(t) - (th / 2) * Math.sin(t)),
        y: height / 2 - ((tw / 2) * Math.sin(t) + (th / 2) * Math.cos(t)),
        size: o.size, font, color, opacity: o.opacity, rotate: degrees(o.angle),
      });
    }
  } catch (e) { throw textErr(e); }
  return doc.save();
};

export type NumberPos = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';

export const numberPdf = async (
  pdf: LoadedPdf,
  o: { format: string; pos: NumberPos; size: number; margin: number; start: number },
) => {
  const doc = await PDFDocument.load(pdf.bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();
  try {
    doc.getPages().forEach((page, i) => {
      const label = o.format.replace(/\{n\}/g, String(i + o.start)).replace(/\{total\}/g, String(total + o.start - 1));
      const w = font.widthOfTextAtSize(label, o.size);
      const { width, height } = page.getSize();
      const x = o.pos.endsWith('left') ? o.margin : o.pos.endsWith('right') ? width - o.margin - w : (width - w) / 2;
      const y = o.pos.startsWith('top') ? height - o.margin - o.size : o.margin;
      page.drawText(label, { x, y, size: o.size, font, color: rgb(0.2, 0.2, 0.2) });
    });
  } catch (e) { throw textErr(e); }
  return doc.save();
};

export type PdfInfo = {
  title?: string; author?: string; subject?: string; keywords?: string; creator?: string; producer?: string;
  created?: Date; modified?: Date; pages: number; sizes: string[]; encrypted: boolean; version: string;
};

export const readInfo = (pdf: LoadedPdf): PdfInfo => {
  const d = pdf.doc;
  const sizes = [...new Set(d.getPages().slice(0, 200).map((p) => {
    const { width, height } = p.getSize();
    return `${(width / 72 * 25.4).toFixed(0)}×${(height / 72 * 25.4).toFixed(0)} mm`;
  }))];
  const head = new TextDecoder('latin1').decode(pdf.bytes.slice(0, 16));
  return {
    title: d.getTitle(), author: d.getAuthor(), subject: d.getSubject(), keywords: d.getKeywords(),
    creator: d.getCreator(), producer: d.getProducer(), created: d.getCreationDate(), modified: d.getModificationDate(),
    pages: pdf.pages, sizes, encrypted: d.isEncrypted, version: /%PDF-(\d\.\d)/.exec(head)?.[1] ?? 'unknown',
  };
};

export const writeInfo = async (pdf: LoadedPdf, m: { title: string; author: string; subject: string; keywords: string }) => {
  const doc = await PDFDocument.load(pdf.bytes);
  doc.setTitle(m.title);
  doc.setAuthor(m.author);
  doc.setSubject(m.subject);
  doc.setKeywords(m.keywords.split(',').map((s) => s.trim()).filter(Boolean));
  doc.setModificationDate(new Date());
  return doc.save();
};

/** Re-serialise with object streams. Does NOT recompress images; gains are usually small. */
export const optimizePdf = async (pdf: LoadedPdf) => {
  const doc = await PDFDocument.load(pdf.bytes);
  return doc.save({ useObjectStreams: true });
};

export const pdfToPngs = async (pdf: LoadedPdf, scale: number, baseName: string): Promise<ZipEntry[]> => {
  const imgs = await pdf2img(pdf.bytes, { scale });
  const pad = String(imgs.length).length;
  return imgs.map((buf, i) => ({ name: `${baseName}-page-${String(i + 1).padStart(pad, '0')}.png`, data: new Uint8Array(buf) }));
};

const toPng = async (file: File): Promise<ArrayBuffer> => {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error(`Could not convert “${file.name}”.`);
  return blob.arrayBuffer();
};

export const imagesToPdf = async (files: File[], fit: 'a4' | 'image', margin: number) => {
  const bufs: ArrayBuffer[] = [];
  for (const f of files) {
    try {
      bufs.push(/image\/(jpeg|png)/.test(f.type) ? await f.arrayBuffer() : await toPng(f));
    } catch (e) {
      throw new Error(`“${f.name}” could not be read as an image (${e instanceof Error ? e.message : e}).`);
    }
  }
  const out = await img2pdf(bufs, fit === 'a4' ? { size: { width: 210, height: 297 }, margin: [margin, margin, margin, margin] } : { scale: 0.75 });
  return new Uint8Array(out);
};

export { makeZip };
