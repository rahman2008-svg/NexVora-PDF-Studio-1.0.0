import type { Template } from '@pdfme/common';
import type { Category } from './brand';

/* ------------------------------------------------------------------ *
 * Template library. Every template is a real, editable PDFme template
 * (blank base PDF + schemas). Helpers below only build plain schema
 * objects using PDFme's built-in schema types:
 * text, rectangle, line, qrcode, code128, ean13, table, checkbox, select.
 * ------------------------------------------------------------------ */

type S = Record<string, unknown>;
type TextOpts = {
  size?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  color?: string;
  bg?: string;
  lh?: number;
  ro?: boolean;
  spacing?: number;
};

const INK = '#111827';
const MUTED = '#6B7280';
const CYAN = '#0891B2';
const VIOLET = '#6D28D9';
const LIGHT = '#F3F4F6';

const txt = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  o: TextOpts = {},
): S => ({
  name,
  type: 'text',
  content,
  position: { x, y },
  width: w,
  height: h,
  rotate: 0,
  alignment: o.align ?? 'left',
  verticalAlignment: o.valign ?? 'middle',
  fontSize: o.size ?? 11,
  lineHeight: o.lh ?? 1.3,
  characterSpacing: o.spacing ?? 0,
  fontColor: o.color ?? INK,
  backgroundColor: o.bg ?? '',
  opacity: 1,
  readOnly: o.ro ?? false,
});

/** Static label: read-only text that is still freely editable in the Designer. */
const lbl = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  o: TextOpts = {},
) => txt(name, x, y, w, h, content, { color: MUTED, size: 9, ...o, ro: true });

const rect = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  o: { border?: string; bw?: number; radius?: number } = {},
): S => ({
  name,
  type: 'rectangle',
  position: { x, y },
  width: w,
  height: h,
  rotate: 0,
  opacity: 1,
  borderWidth: o.bw ?? 0,
  borderColor: o.border ?? '#000000',
  color,
  radius: o.radius ?? 0,
  readOnly: true,
  content: '',
});

const hr = (name: string, x: number, y: number, w: number, color = '#D1D5DB'): S => ({
  name,
  type: 'line',
  position: { x, y },
  width: w,
  height: 0.3,
  rotate: 0,
  opacity: 1,
  color,
  readOnly: true,
  content: '',
});

const qr = (name: string, x: number, y: number, size: number, content: string): S => ({
  name,
  type: 'qrcode',
  content,
  position: { x, y },
  width: size,
  height: size,
  rotate: 0,
  opacity: 1,
  backgroundColor: '#ffffff',
  barColor: '#000000',
  readOnly: false,
});

const code128 = (name: string, x: number, y: number, w: number, h: number, content: string): S => ({
  name,
  type: 'code128',
  content,
  position: { x, y },
  width: w,
  height: h,
  rotate: 0,
  opacity: 1,
  backgroundColor: '#ffffff',
  barColor: '#000000',
  includetext: true,
  readOnly: false,
});

const checkbox = (name: string, x: number, y: number, content = 'false'): S => ({
  name,
  type: 'checkbox',
  content,
  position: { x, y },
  width: 6,
  height: 6,
  rotate: 0,
  opacity: 1,
  color: '#000000',
  readOnly: false,
});

const select = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  options: string[],
  content: string,
): S => ({ ...txt(name, x, y, w, h, content), type: 'select', options });

const cellStyle = (size: number, extra: Record<string, unknown> = {}) => ({
  fontSize: size,
  characterSpacing: 0,
  alignment: 'left',
  verticalAlignment: 'middle',
  lineHeight: 1,
  fontColor: INK,
  borderColor: '#D1D5DB',
  backgroundColor: '',
  borderWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
  padding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
  ...extra,
});

const table = (
  name: string,
  x: number,
  y: number,
  w: number,
  head: string[],
  rows: string[][],
  widths: number[],
  rightCols: number[] = [],
): S => ({
  name,
  type: 'table',
  position: { x, y },
  width: w,
  height: 8 * (rows.length + 1),
  content: JSON.stringify(rows),
  showHead: true,
  head,
  headWidthPercentages: widths,
  tableStyles: { borderWidth: 0, borderColor: '#D1D5DB' },
  headStyles: cellStyle(9, {
    fontColor: '#FFFFFF',
    backgroundColor: VIOLET,
    borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
  }),
  bodyStyles: cellStyle(9, { alternateBackgroundColor: '#F9FAFB' }),
  columnStyles: {
    alignment: Object.fromEntries(rightCols.map((c) => [String(c), 'right'])),
  },
  readOnly: false,
});

const page = (width: number, height: number, padding: [number, number, number, number]) =>
  ({ width, height, padding }) as const;

const make = (
  size: { width: number; height: number; padding: [number, number, number, number] },
  schemas: S[],
): Template => ({ basePdf: size, schemas: [schemas] }) as unknown as Template;

const A4 = page(210, 297, [10, 10, 10, 10]);

/** Coloured document header band used by most A4 templates. */
const banner = (title: string, sub: string, color = VIOLET): S[] => [
  rect('headerBand', 0, 0, 210, 34, color),
  txt('docTitle', 15, 9, 120, 12, title, { size: 24, color: '#FFFFFF', ro: true }),
  txt('docSubtitle', 15, 21, 120, 7, sub, { size: 10, color: '#E0E7FF', ro: true }),
  txt('companyName', 120, 11, 75, 9, 'Your Company Name', {
    size: 13,
    color: '#FFFFFF',
    align: 'right',
  }),
  txt('companyContact', 120, 20, 75, 8, 'email@company.com | +000 000 000', {
    size: 8,
    color: '#E0E7FF',
    align: 'right',
  }),
];

const party = (labelA: string, labelB: string, y = 42): S[] => [
  lbl('billToLabel', 15, y, 80, 5, labelA, { size: 8 }),
  txt('billToName', 15, y + 5, 85, 7, 'Client Name', { size: 12 }),
  txt('billToAddress', 15, y + 12, 85, 14, 'Street address\nCity, Country', {
    size: 9,
    valign: 'top',
    color: MUTED,
  }),
  lbl('metaLabel', 120, y, 75, 5, labelB, { size: 8, align: 'right' }),
  txt('docNumber', 120, y + 5, 75, 7, 'No. 0001', { size: 12, align: 'right' }),
  txt('docDate', 120, y + 12, 75, 6, '08 Nov 2026', { size: 9, align: 'right', color: MUTED }),
];

const totals = (y: number): S[] => [
  hr('totalsRule', 120, y, 75, '#9CA3AF'),
  lbl('subtotalLabel', 120, y + 2, 35, 6, 'Subtotal', { size: 9 }),
  txt('subtotal', 155, y + 2, 40, 6, '0.00', { size: 10, align: 'right' }),
  lbl('taxLabel', 120, y + 9, 35, 6, 'Tax', { size: 9 }),
  txt('tax', 155, y + 9, 40, 6, '0.00', { size: 10, align: 'right' }),
  rect('grandBand', 120, y + 17, 75, 11, VIOLET, { radius: 1.5 }),
  txt('grandLabel', 123, y + 17, 30, 11, 'TOTAL', { size: 11, color: '#FFFFFF', ro: true }),
  txt('grandTotal', 150, y + 17, 42, 11, '0.00', { size: 13, color: '#FFFFFF', align: 'right' }),
];

const footerNote = (text: string): S[] => [
  hr('footerRule', 15, 275, 180),
  txt('footerNote', 15, 277, 180, 10, text, { size: 8, color: MUTED, align: 'center' }),
];

const itemRows = [
  ['Design service', '2', '150.00', '300.00'],
  ['Development', '1', '450.00', '450.00'],
];
const itemHead = ['Description', 'Qty', 'Unit Price', 'Amount'];

/* ------------------------------ templates ------------------------------ */

export type LibraryEntry = {
  id: string;
  title: string;
  category: Category;
  group: 'Business' | 'Education' | 'Personal' | 'Design';
  description: string;
  accent: string;
  build: () => Template;
};

const invoice = (title: string, sub: string, numLabel: string, extra: S[] = []): Template =>
  make(A4, [
    ...banner(title, sub),
    ...party('BILL TO', numLabel),
    table('items', 15, 80, 180, itemHead, itemRows, [52, 12, 18, 18], [1, 2, 3]),
    ...totals(170),
    lbl('notesLabel', 15, 170, 90, 5, 'NOTES / TERMS', { size: 8 }),
    txt('notes', 15, 176, 95, 28, 'Payment due within 14 days.\nThank you for your business.', {
      size: 9,
      valign: 'top',
      color: MUTED,
    }),
    ...extra,
    ...footerNote('Generated with NexVora PDF Studio'),
  ]);

export const LIBRARY: LibraryEntry[] = [
  {
    id: 'invoice',
    title: 'Invoice',
    category: 'Invoices',
    group: 'Business',
    description: 'Line-item invoice with totals and payment notes.',
    accent: VIOLET,
    build: () => invoice('INVOICE', 'Tax invoice', 'INVOICE NO. / DATE'),
  },
  {
    id: 'receipt',
    title: 'Receipt',
    category: 'Invoices',
    group: 'Business',
    description: 'Payment receipt with method and paid stamp.',
    accent: '#059669',
    build: () =>
      make(A4, [
        ...banner('RECEIPT', 'Payment received', '#059669'),
        ...party('RECEIVED FROM', 'RECEIPT NO. / DATE'),
        table('items', 15, 80, 180, itemHead, itemRows.slice(0, 1), [52, 12, 18, 18], [1, 2, 3]),
        ...totals(150),
        lbl('methodLabel', 15, 150, 60, 5, 'PAYMENT METHOD', { size: 8 }),
        select('method', 15, 156, 60, 8, ['Cash', 'Card', 'Bank transfer', 'Mobile payment'], 'Cash'),
        rect('paidStamp', 15, 175, 40, 14, '', { border: '#059669', bw: 0.8, radius: 2 }),
        txt('paidText', 15, 175, 40, 14, 'PAID', {
          size: 18,
          color: '#059669',
          align: 'center',
          ro: true,
        }),
        ...footerNote('This receipt confirms payment received. Generated with NexVora PDF Studio'),
      ]),
  },
  {
    id: 'quotation',
    title: 'Quotation',
    category: 'Business Documents',
    group: 'Business',
    description: 'Price quotation with validity date and terms.',
    accent: CYAN,
    build: () =>
      invoice('QUOTATION', 'Price estimate', 'QUOTE NO. / DATE', [
        lbl('validLabel', 15, 207, 60, 5, 'VALID UNTIL', { size: 8 }),
        txt('validUntil', 15, 212, 60, 7, '22 Nov 2026', { size: 10 }),
      ]),
  },
  {
    id: 'purchase-order',
    title: 'Purchase Order',
    category: 'Business Documents',
    group: 'Business',
    description: 'Purchase order with vendor, ship-to and items.',
    accent: '#B45309',
    build: () =>
      make(A4, [
        ...banner('PURCHASE ORDER', 'Order to supplier', '#B45309'),
        ...party('VENDOR', 'PO NO. / DATE'),
        lbl('shipLabel', 15, 70, 80, 5, 'SHIP TO', { size: 8 }),
        txt('shipTo', 15, 75, 95, 8, 'Warehouse address', { size: 9, color: MUTED }),
        table('items', 15, 90, 180, itemHead, itemRows, [52, 12, 18, 18], [1, 2, 3]),
        ...totals(175),
        lbl('approvedLabel', 15, 215, 60, 5, 'APPROVED BY', { size: 8 }),
        hr('approvedLine', 15, 232, 60, '#374151'),
        txt('approvedBy', 15, 233, 60, 6, 'Name, title', { size: 9, color: MUTED }),
        ...footerNote('Please quote the PO number on all correspondence.'),
      ]),
  },
  {
    id: 'business-letter',
    title: 'Business Letter',
    category: 'Business Documents',
    group: 'Business',
    description: 'Formal letterhead with recipient, subject and body.',
    accent: VIOLET,
    build: () =>
      make(A4, [
        rect('accentBar', 0, 0, 210, 4, VIOLET),
        txt('senderName', 20, 14, 100, 9, 'Your Company Name', { size: 16, color: VIOLET }),
        txt('senderAddress', 20, 24, 100, 12, 'Street address\nCity, Country', {
          size: 9,
          color: MUTED,
          valign: 'top',
        }),
        txt('letterDate', 130, 14, 60, 7, '08 November 2026', { size: 10, align: 'right' }),
        hr('headRule', 20, 42, 170),
        txt('recipient', 20, 50, 100, 22, 'Recipient Name\nTitle\nCompany\nAddress', {
          size: 10,
          valign: 'top',
        }),
        txt('subject', 20, 80, 170, 8, 'Subject: Letter subject', { size: 12, color: VIOLET }),
        txt('salutation', 20, 94, 120, 7, 'Dear Sir or Madam,', { size: 11 }),
        txt(
          'body',
          20,
          104,
          170,
          110,
          'Write the body of your letter here. Use the Designer to resize this box or add more paragraphs.',
          { size: 11, valign: 'top', lh: 1.5 },
        ),
        txt('closing', 20, 222, 80, 7, 'Sincerely,', { size: 11 }),
        hr('signLine', 20, 246, 55, '#374151'),
        txt('signName', 20, 248, 80, 7, 'Your Name', { size: 11 }),
      ]),
  },
  {
    id: 'business-report',
    title: 'Business Report',
    category: 'Business Documents',
    group: 'Business',
    description: 'Cover block, summary, key metrics table and findings.',
    accent: CYAN,
    build: () =>
      make(A4, [
        rect('coverBand', 0, 0, 210, 60, CYAN),
        txt('reportTitle', 15, 14, 180, 16, 'Quarterly Business Report', { size: 28, color: '#FFFFFF' }),
        txt('reportSub', 15, 32, 180, 8, 'Prepared for the management team', { size: 12, color: '#CFFAFE' }),
        txt('reportMeta', 15, 44, 180, 7, 'Prepared by: Your Name | Q4 2026', { size: 9, color: '#ECFEFF' }),
        lbl('summaryLabel', 15, 70, 60, 5, 'EXECUTIVE SUMMARY', { size: 8 }),
        txt('summary', 15, 76, 180, 36, 'Summarise the period, headline results and the decisions needed.', {
          size: 10.5,
          valign: 'top',
          lh: 1.5,
        }),
        lbl('metricsLabel', 15, 118, 60, 5, 'KEY METRICS', { size: 8 }),
        table(
          'metrics',
          15,
          124,
          180,
          ['Metric', 'Target', 'Actual', 'Status'],
          [
            ['Revenue', '100,000', '112,500', 'On track'],
            ['New customers', '250', '231', 'Behind'],
          ],
          [40, 20, 20, 20],
          [1, 2],
        ),
        lbl('findingsLabel', 15, 160, 60, 5, 'FINDINGS & RECOMMENDATIONS', { size: 8 }),
        txt('findings', 15, 166, 180, 60, '1. First finding\n2. Second finding\n3. Recommendation', {
          size: 10.5,
          valign: 'top',
          lh: 1.6,
        }),
        ...footerNote('Confidential — generated with NexVora PDF Studio'),
      ]),
  },
  {
    id: 'certificate',
    title: 'Certificate',
    category: 'Certificates',
    group: 'Education',
    description: 'Landscape certificate of achievement with signatures.',
    accent: '#B8860B',
    build: () =>
      make(page(297, 210, [0, 0, 0, 0]), [
        rect('outer', 8, 8, 281, 194, '', { border: '#B8860B', bw: 1.6 }),
        rect('inner', 13, 13, 271, 184, '', { border: '#B8860B', bw: 0.4 }),
        txt('heading', 30, 30, 237, 16, 'CERTIFICATE', { size: 40, align: 'center', color: '#92400E', spacing: 4, ro: true }),
        txt('subheading', 30, 50, 237, 9, 'OF ACHIEVEMENT', { size: 14, align: 'center', color: MUTED, spacing: 3, ro: true }),
        lbl('presented', 30, 72, 237, 7, 'This certificate is proudly presented to', { size: 12, align: 'center' }),
        txt('recipientName', 30, 84, 237, 20, 'Recipient Name', { size: 36, align: 'center', color: INK }),
        hr('nameRule', 83, 106, 130, '#B8860B'),
        txt('reason', 45, 112, 207, 22, 'for outstanding performance and dedication in the course of study.', {
          size: 13,
          align: 'center',
          valign: 'top',
          color: '#374151',
          lh: 1.5,
        }),
        txt('certDate', 40, 160, 70, 7, '08 November 2026', { size: 11, align: 'center' }),
        hr('dateLine', 40, 168, 70, '#374151'),
        lbl('dateLabel', 40, 170, 70, 6, 'Date', { size: 9, align: 'center' }),
        txt('signer', 187, 160, 70, 7, 'Authorised Signatory', { size: 11, align: 'center' }),
        hr('signLine', 187, 168, 70, '#374151'),
        lbl('signLabel', 187, 170, 70, 6, 'Signature', { size: 9, align: 'center' }),
        qr('verifyQr', 138, 150, 21, 'https://example.com/verify/0001'),
      ]),
  },
  {
    id: 'student-id-card',
    title: 'Student ID Card',
    category: 'ID Cards',
    group: 'Education',
    description: 'CR80-size landscape ID card with photo box and QR.',
    accent: VIOLET,
    build: () =>
      make(page(85.6, 54, [0, 0, 0, 0]), [
        rect('top', 0, 0, 85.6, 12, VIOLET),
        txt('school', 3, 1.5, 79, 9, 'Your School Name', { size: 11, color: '#FFFFFF', ro: true }),
        rect('photoBox', 4, 15, 20, 26, LIGHT, { border: '#9CA3AF', bw: 0.2 }),
        lbl('photoHint', 4, 25, 20, 6, 'PHOTO', { size: 6, align: 'center' }),
        txt('studentName', 28, 15, 54, 6, 'Student Name', { size: 10 }),
        lbl('idLabel', 28, 22, 14, 4, 'ID', { size: 6 }),
        txt('studentId', 38, 21.5, 44, 5, 'STU-0001', { size: 8 }),
        lbl('classLabel', 28, 27, 14, 4, 'Class', { size: 6 }),
        txt('studentClass', 38, 26.5, 44, 5, 'Grade 10 - A', { size: 8 }),
        lbl('validLabel', 28, 32, 14, 4, 'Valid', { size: 6 }),
        txt('validThru', 38, 31.5, 44, 5, 'Dec 2027', { size: 8 }),
        qr('idQr', 66, 36, 15, 'STU-0001'),
        rect('bottom', 0, 49, 85.6, 5, CYAN),
        txt('cardNote', 3, 49, 60, 5, 'If found, please return to school office', { size: 5.5, color: '#FFFFFF', ro: true }),
      ]),
  },
  {
    id: 'result-sheet',
    title: 'Result Sheet',
    category: 'Education',
    group: 'Education',
    description: 'Student result sheet with subject marks and grade.',
    accent: CYAN,
    build: () =>
      make(A4, [
        ...banner('RESULT SHEET', 'Academic performance report', CYAN),
        lbl('nameLabel', 15, 42, 40, 5, 'STUDENT NAME', { size: 8 }),
        txt('studentName', 15, 47, 90, 7, 'Student Name', { size: 12 }),
        lbl('rollLabel', 120, 42, 40, 5, 'ROLL / CLASS', { size: 8, align: 'right' }),
        txt('rollClass', 120, 47, 75, 7, '23 / Grade 10', { size: 12, align: 'right' }),
        table(
          'marks',
          15,
          65,
          180,
          ['Subject', 'Full Marks', 'Obtained', 'Grade'],
          [
            ['Mathematics', '100', '92', 'A+'],
            ['English', '100', '85', 'A'],
            ['Science', '100', '88', 'A'],
          ],
          [40, 20, 20, 20],
          [1, 2, 3],
        ),
        rect('summaryBand', 15, 125, 180, 16, '#ECFEFF', { radius: 2 }),
        lbl('totalLabel', 20, 127, 40, 5, 'TOTAL', { size: 8 }),
        txt('totalMarks', 20, 132, 40, 7, '265 / 300', { size: 12 }),
        lbl('gpaLabel', 85, 127, 40, 5, 'GPA / RESULT', { size: 8 }),
        txt('gpa', 85, 132, 40, 7, '5.00 — Passed', { size: 12 }),
        hr('principalLine', 135, 175, 60, '#374151'),
        lbl('principalLabel', 135, 177, 60, 5, 'Principal', { size: 9, align: 'center' }),
        ...footerNote('Computer-generated result sheet.'),
      ]),
  },
  {
    id: 'assignment-cover',
    title: 'Assignment Cover',
    category: 'Education',
    group: 'Education',
    description: 'Assignment cover page with course and submission details.',
    accent: VIOLET,
    build: () =>
      make(A4, [
        rect('frame', 12, 12, 186, 273, '', { border: VIOLET, bw: 0.8 }),
        txt('institution', 20, 30, 170, 12, 'Your University / School', { size: 22, align: 'center', color: VIOLET }),
        txt('department', 20, 44, 170, 8, 'Department of ______', { size: 12, align: 'center', color: MUTED }),
        rect('titleBand', 30, 80, 150, 30, LIGHT, { radius: 2 }),
        txt('assignmentTitle', 34, 84, 142, 22, 'Assignment Title', { size: 22, align: 'center' }),
        lbl('courseLabel', 40, 130, 50, 5, 'COURSE', { size: 8 }),
        txt('course', 40, 136, 130, 7, 'Course name and code', { size: 12 }),
        lbl('submittedByLabel', 40, 152, 50, 5, 'SUBMITTED BY', { size: 8 }),
        txt('submittedBy', 40, 158, 130, 14, 'Student name\nRoll / ID', { size: 12, valign: 'top' }),
        lbl('submittedToLabel', 40, 182, 50, 5, 'SUBMITTED TO', { size: 8 }),
        txt('submittedTo', 40, 188, 130, 14, 'Teacher name\nDesignation', { size: 12, valign: 'top' }),
        lbl('dateLabel', 40, 212, 50, 5, 'DATE OF SUBMISSION', { size: 8 }),
        txt('submitDate', 40, 218, 130, 7, '08 November 2026', { size: 12 }),
      ]),
  },
  {
    id: 'school-notice',
    title: 'School Notice',
    category: 'Education',
    group: 'Education',
    description: 'Official notice with reference number, body and signature.',
    accent: '#DC2626',
    build: () =>
      make(A4, [
        rect('topBand', 0, 0, 210, 30, '#7F1D1D'),
        txt('school', 15, 7, 180, 10, 'Your School Name', { size: 20, color: '#FFFFFF', align: 'center', ro: true }),
        txt('schoolAddress', 15, 18, 180, 7, 'Address • Phone • Email', { size: 9, color: '#FECACA', align: 'center' }),
        txt('noticeHeading', 15, 40, 180, 12, 'NOTICE', { size: 26, align: 'center', color: '#7F1D1D', spacing: 3, ro: true }),
        txt('refNo', 15, 58, 90, 6, 'Ref: SCH/2026/001', { size: 10 }),
        txt('noticeDate', 105, 58, 90, 6, 'Date: 08 November 2026', { size: 10, align: 'right' }),
        hr('rule', 15, 66, 180),
        txt('noticeSubject', 15, 72, 180, 9, 'Subject: ______', { size: 13, color: '#7F1D1D' }),
        txt('noticeBody', 15, 86, 180, 110, 'Write the notice text here.', { size: 11.5, valign: 'top', lh: 1.55 }),
        hr('signLine', 140, 225, 55, '#374151'),
        txt('signer', 140, 227, 55, 6, 'Principal', { size: 10, align: 'center' }),
      ]),
  },
  {
    id: 'cv-resume',
    title: 'CV / Resume',
    category: 'Personal Documents',
    group: 'Personal',
    description: 'Two-column resume with skills sidebar and experience.',
    accent: VIOLET,
    build: () =>
      make(A4, [
        rect('sidebar', 0, 0, 68, 297, '#1E1B4B'),
        rect('photo', 14, 14, 40, 40, '#312E81', { radius: 20 }),
        lbl('photoHint', 14, 29, 40, 8, 'PHOTO', { size: 8, align: 'center', color: '#A5B4FC' }),
        lbl('contactLabel', 10, 66, 50, 5, 'CONTACT', { size: 9, color: '#C4B5FD' }),
        txt('contact', 10, 72, 52, 30, 'email@example.com\n+000 000 000\nCity, Country', { size: 9, color: '#E0E7FF', valign: 'top', lh: 1.6 }),
        lbl('skillsLabel', 10, 108, 50, 5, 'SKILLS', { size: 9, color: '#C4B5FD' }),
        txt('skills', 10, 114, 52, 60, 'Skill one\nSkill two\nSkill three', { size: 9.5, color: '#E0E7FF', valign: 'top', lh: 1.7 }),
        txt('fullName', 76, 16, 120, 14, 'Your Full Name', { size: 28, color: '#1E1B4B' }),
        txt('jobTitle', 76, 31, 120, 8, 'Professional Title', { size: 13, color: VIOLET }),
        hr('headRule', 76, 42, 120, VIOLET),
        lbl('profileLabel', 76, 48, 60, 5, 'PROFILE', { size: 9 }),
        txt('profile', 76, 54, 120, 34, 'Two or three sentences that summarise your experience and goals.', { size: 10, valign: 'top', lh: 1.5 }),
        lbl('expLabel', 76, 94, 60, 5, 'EXPERIENCE', { size: 9 }),
        txt('experience', 76, 100, 120, 80, 'Job Title — Company (2022–Present)\n• Key achievement\n• Key achievement\n\nJob Title — Company (2019–2022)\n• Key achievement', { size: 10, valign: 'top', lh: 1.5 }),
        lbl('eduLabel', 76, 186, 60, 5, 'EDUCATION', { size: 9 }),
        txt('education', 76, 192, 120, 40, 'Degree — Institution (Year)', { size: 10, valign: 'top', lh: 1.5 }),
      ]),
  },
  {
    id: 'cover-letter',
    title: 'Cover Letter',
    category: 'Personal Documents',
    group: 'Personal',
    description: 'Job application cover letter with sender block.',
    accent: CYAN,
    build: () =>
      make(A4, [
        txt('senderName', 20, 18, 120, 12, 'Your Full Name', { size: 22, color: CYAN }),
        txt('senderContact', 20, 31, 140, 12, 'email@example.com | +000 000 000 | City, Country', { size: 9, color: MUTED }),
        hr('headRule', 20, 46, 170, CYAN),
        txt('letterDate', 20, 54, 80, 6, '08 November 2026', { size: 10 }),
        txt('hiringManager', 20, 64, 120, 20, 'Hiring Manager\nCompany Name\nAddress', { size: 10, valign: 'top' }),
        txt('salutation', 20, 92, 120, 7, 'Dear Hiring Manager,', { size: 11 }),
        txt('coverBody', 20, 102, 170, 120, 'Introduce yourself, explain why you are a strong fit for the role, and close with a call to action.', { size: 11, valign: 'top', lh: 1.55 }),
        txt('closing', 20, 230, 80, 7, 'Kind regards,', { size: 11 }),
        txt('signName', 20, 240, 80, 8, 'Your Full Name', { size: 12 }),
      ]),
  },
  {
    id: 'personal-profile',
    title: 'Personal Profile',
    category: 'Personal Documents',
    group: 'Personal',
    description: 'One-page personal profile with details and bio.',
    accent: VIOLET,
    build: () =>
      make(A4, [
        rect('band', 0, 0, 210, 60, VIOLET),
        rect('photo', 15, 20, 45, 45, '#EDE9FE', { border: '#FFFFFF', bw: 1.2, radius: 22.5 }),
        txt('profileName', 70, 22, 125, 14, 'Your Name', { size: 26, color: '#FFFFFF' }),
        txt('tagline', 70, 38, 125, 8, 'Short tagline about you', { size: 12, color: '#DDD6FE' }),
        lbl('detailsLabel', 15, 80, 60, 5, 'DETAILS', { size: 9 }),
        table(
          'details',
          15,
          86,
          180,
          ['Field', 'Value'],
          [
            ['Date of birth', '01 Jan 2000'],
            ['Location', 'City, Country'],
            ['Email', 'email@example.com'],
            ['Phone', '+000 000 000'],
          ],
          [30, 70],
        ),
        lbl('bioLabel', 15, 132, 60, 5, 'ABOUT ME', { size: 9 }),
        txt('bio', 15, 138, 180, 60, 'Write a short biography here.', { size: 11, valign: 'top', lh: 1.55 }),
      ]),
  },
  {
    id: 'application-form',
    title: 'Application Form',
    category: 'Forms',
    group: 'Personal',
    description: 'Fillable application form with text, dropdown and checkboxes.',
    accent: CYAN,
    build: () =>
      make(A4, [
        ...banner('APPLICATION FORM', 'Please complete all fields', CYAN),
        lbl('l1', 15, 44, 50, 5, 'FULL NAME', { size: 8 }),
        txt('applicantName', 15, 49, 85, 8, 'Full name', { size: 11, bg: LIGHT }),
        lbl('l2', 110, 44, 50, 5, 'DATE OF BIRTH', { size: 8 }),
        txt('applicantDob', 110, 49, 85, 8, '2000-01-01', { size: 11, bg: LIGHT }),
        lbl('l3', 15, 64, 50, 5, 'EMAIL', { size: 8 }),
        txt('applicantEmail', 15, 69, 85, 8, 'name@example.com', { size: 11, bg: LIGHT }),
        lbl('l4', 110, 64, 50, 5, 'PHONE', { size: 8 }),
        txt('applicantPhone', 110, 69, 85, 8, '+000 000 000', { size: 11, bg: LIGHT }),
        lbl('l5', 15, 84, 50, 5, 'ADDRESS', { size: 8 }),
        txt('applicantAddress', 15, 89, 180, 18, 'Street, city, country', { size: 11, bg: LIGHT, valign: 'top' }),
        lbl('l6', 15, 114, 60, 5, 'APPLYING FOR', { size: 8 }),
        select('position', 15, 119, 85, 8, ['Position A', 'Position B', 'Position C'], 'Position A'),
        lbl('l7', 15, 138, 60, 5, 'DECLARATIONS', { size: 8 }),
        checkbox('agreeTruth', 15, 145),
        lbl('l8', 24, 144.5, 160, 7, 'I confirm the information provided is true.', { size: 10, color: INK }),
        checkbox('agreeTerms', 15, 155),
        lbl('l9', 24, 154.5, 160, 7, 'I accept the terms and conditions.', { size: 10, color: INK }),
        hr('signLine', 130, 205, 65, '#374151'),
        lbl('signLabel', 130, 207, 65, 5, 'Applicant signature', { size: 9, align: 'center' }),
      ]),
  },
  {
    id: 'visiting-card',
    title: 'Visiting Card',
    category: 'Custom Templates',
    group: 'Design',
    description: '90×50 mm business card with contact details and QR.',
    accent: VIOLET,
    build: () =>
      make(page(90, 50, [0, 0, 0, 0]), [
        rect('bg', 0, 0, 90, 50, '#0B1020'),
        rect('accent', 0, 0, 4, 50, CYAN),
        txt('cardName', 10, 8, 55, 8, 'Your Name', { size: 15, color: '#FFFFFF' }),
        txt('cardTitle', 10, 16, 55, 6, 'Job Title', { size: 8.5, color: CYAN }),
        txt('cardCompany', 10, 22, 55, 6, 'Company Name', { size: 8, color: '#C4B5FD' }),
        txt('cardContact', 10, 31, 55, 14, 'email@example.com\n+000 000 000\nwww.example.com', { size: 7, color: '#E5E7EB', valign: 'top', lh: 1.5 }),
        qr('cardQr', 66, 28, 18, 'https://example.com'),
      ]),
  },
  {
    id: 'membership-card',
    title: 'Membership Card',
    category: 'ID Cards',
    group: 'Design',
    description: 'Club / gym membership card with member number barcode.',
    accent: VIOLET,
    build: () =>
      make(page(85.6, 54, [0, 0, 0, 0]), [
        rect('bg', 0, 0, 85.6, 54, VIOLET),
        rect('stripe', 0, 40, 85.6, 14, '#FFFFFF'),
        txt('club', 5, 4, 75, 7, 'Club Name', { size: 13, color: '#FFFFFF', ro: true }),
        txt('memberLabel', 5, 12, 40, 4, 'MEMBER', { size: 6, color: '#DDD6FE', ro: true }),
        txt('memberName', 5, 16, 75, 8, 'Member Name', { size: 12, color: '#FFFFFF' }),
        txt('memberSince', 5, 26, 50, 5, 'Member since 2026', { size: 7.5, color: '#DDD6FE' }),
        txt('memberTier', 5, 32, 50, 5, 'Gold', { size: 8, color: '#FDE68A' }),
        code128('memberBarcode', 8, 41, 70, 11, 'MEM000001'),
      ]),
  },
  {
    id: 'event-ticket',
    title: 'Event Ticket',
    category: 'Custom Templates',
    group: 'Design',
    description: 'Event ticket with seat details and scannable QR code.',
    accent: '#DB2777',
    build: () =>
      make(page(210, 80, [0, 0, 0, 0]), [
        rect('left', 0, 0, 150, 80, '#1F1147'),
        rect('right', 150, 0, 60, 80, '#DB2777'),
        txt('eventName', 12, 10, 130, 14, 'Event Name', { size: 26, color: '#FFFFFF' }),
        txt('eventDate', 12, 28, 130, 7, 'Sat, 12 December 2026 • 7:00 PM', { size: 11, color: '#F9A8D4' }),
        txt('venue', 12, 37, 130, 7, 'Venue name, City', { size: 10, color: '#E9D5FF' }),
        lbl('seatLabel', 12, 54, 30, 5, 'SEAT', { size: 7, color: '#C4B5FD' }),
        txt('seat', 12, 59, 40, 9, 'A-12', { size: 16, color: '#FFFFFF' }),
        lbl('ticketLabel', 60, 54, 30, 5, 'TICKET NO.', { size: 7, color: '#C4B5FD' }),
        txt('ticketNo', 60, 59, 60, 9, 'TKT-000001', { size: 14, color: '#FFFFFF' }),
        qr('ticketQr', 160, 12, 40, 'TKT-000001'),
        lbl('scanHint', 150, 56, 60, 6, 'SCAN AT ENTRY', { size: 7, color: '#FFFFFF', align: 'center' }),
      ]),
  },
  {
    id: 'qr-menu',
    title: 'QR Menu',
    category: 'Custom Templates',
    group: 'Design',
    description: 'A5 table-tent menu card with QR code to your online menu.',
    accent: '#EA580C',
    build: () =>
      make(page(148, 210, [0, 0, 0, 0]), [
        rect('bg', 0, 0, 148, 210, '#FFF7ED'),
        rect('top', 0, 0, 148, 40, '#EA580C'),
        txt('restaurant', 10, 10, 128, 12, 'Restaurant Name', { size: 24, color: '#FFFFFF', align: 'center' }),
        txt('tagline', 10, 24, 128, 7, 'Fresh • Local • Seasonal', { size: 10, color: '#FED7AA', align: 'center' }),
        txt('scanTitle', 10, 55, 128, 10, 'Scan to view our menu', { size: 16, align: 'center', color: '#9A3412' }),
        qr('menuQr', 34, 72, 80, 'https://example.com/menu'),
        txt('menuUrl', 10, 158, 128, 7, 'example.com/menu', { size: 11, align: 'center', color: '#9A3412' }),
        txt('wifiNote', 10, 176, 128, 14, 'Free Wi-Fi: NetworkName\nPassword: ********', { size: 9, align: 'center', color: MUTED, valign: 'top' }),
      ]),
  },
  {
    id: 'custom-id-card',
    title: 'Custom ID Card',
    category: 'ID Cards',
    group: 'Design',
    description: 'Portrait employee / staff ID card with photo and barcode.',
    accent: CYAN,
    build: () =>
      make(page(54, 85.6, [0, 0, 0, 0]), [
        rect('top', 0, 0, 54, 30, CYAN),
        txt('org', 3, 3, 48, 7, 'Organization', { size: 10, color: '#FFFFFF', align: 'center', ro: true }),
        rect('photo', 15, 16, 24, 28, LIGHT, { border: '#FFFFFF', bw: 0.8 }),
        lbl('photoHint', 15, 27, 24, 6, 'PHOTO', { size: 6, align: 'center' }),
        txt('personName', 3, 47, 48, 7, 'Full Name', { size: 11, align: 'center' }),
        txt('role', 3, 54, 48, 5, 'Designation', { size: 8, align: 'center', color: CYAN }),
        txt('personId', 3, 60, 48, 5, 'ID: EMP-0001', { size: 7.5, align: 'center', color: MUTED }),
        code128('idBarcode', 7, 68, 40, 12, 'EMP0001'),
      ]),
  },
  {
    id: 'blank-a4',
    title: 'Blank A4',
    category: 'Custom Templates',
    group: 'Design',
    description: 'Empty A4 page — start designing from scratch.',
    accent: MUTED,
    build: () => make(page(210, 297, [20, 10, 20, 10]), []),
  },
];

export const getLibraryEntry = (id: string) => LIBRARY.find((e) => e.id === id);
export const GROUPS = ['Business', 'Education', 'Personal', 'Design'] as const;
