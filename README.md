# NexVora PDF Studio

> **NexVora PDF Studio v1.0.0** — a privacy-first PDF design, generation and document-tools workspace that runs entirely in your browser.
> Developed by **Prince AR Abdur Rahman** · Published by **NexVora Lab's Ofc** · © 2026 NexVora Lab's Ofc. All Rights Reserved.
>
> Built on top of the open-source **[pdfme](https://github.com/pdfme/pdfme)** project (MIT License, © HandDot / hand-dot). The pdfme source, license and attribution are preserved unchanged below — see [Attribution](#license-and-attribution).

> ⚠️ **Verification status (read this first).** This customization was written in an environment **without network access**, so `npm install`, the production build, lint, the full TypeScript check, the existing test suites and every browser flow were **not run**. What *was* verified: all new TS/TSX files parse without syntax errors; all 21 library templates pass pdfme's own `checkTemplate` schema validation; the CSV/JSON parsers and the ZIP writer pass unit checks (the ZIP also passes `unzip -t` and Python `zipfile`). Everything else is **untested** — see [Known limitations](#known-limitations) and [Verification checklist](#verification-checklist).

## Features (as implemented in the code)

NexVora lives in `playground/src/studio/` and is served at `/` and `/studio/*`. The original pdfme playground is untouched and still available at `/templates`, `/designer`, `/form-viewer`, `/jsx`, `/md2pdf`, `/workspace`.

| Area | What it does |
| --- | --- |
| **Dashboard** | Welcome, *Create New PDF*, *Import Template* (JSON), recent projects, saved templates, quick tools, category tiles with live counts, search, favorites filter, dark/light toggle. |
| **PDF Designer** | The real `@pdfme/ui` Designer (its own element palette, page list, layers and property panel) inside a NexVora toolbar: Save, Undo, Redo, Duplicate, Delete, Zoom, Page settings (size/orientation/padding/background PDF), Preview, Export PDF, template JSON export/replace, autosave with *Saving / Saved / Save failed* status. |
| **Template library** | 20 ready-made editable PDFme templates + Blank: Invoice, Receipt, Quotation, Purchase Order, Business Letter, Business Report, Certificate, Student ID, Result Sheet, Assignment Cover, School Notice, CV/Resume, Cover Letter, Personal Profile, Application Form, Visiting Card, Membership Card, Event Ticket, QR Menu, Custom ID Card. "Use template" makes your own copy. |
| **Generator** | Fill fields, preview, download real PDFs via `@pdfme/generator`; export/import PDFme template JSON and NexVora project bundles. |
| **Form Builder** | Per-field input type (text, number, date, checkbox, dropdown), required flags, validation, then generate. Settings are stored in project metadata; the template stays standard PDFme. |
| **Bulk generator** | CSV/JSON upload, preview, column→field mapping, filename pattern, output as ZIP / separate downloads / one combined PDF, error report, progress + stop, 5,000-row cap. |
| **PDF tools** | Merge, split, extract/delete/rotate pages, visual reorder, watermark, page numbers, image→PDF, PDF→PNG, metadata viewer/editor, optimize (limited), preview. |
| **QR & Barcode** | QR (text, URL, email, phone, contact vCard, Wi-Fi), Code 128, EAN-13 (check-digit validated), EAN-8, UPC-A, Code 39, ITF-14; PNG download; add QR / Code 128 / EAN-13 into a project template. |
| **Projects** | Create, rename, duplicate, delete, favorite, save-as-template, import/export (single or all), autosave — persisted in IndexedDB (reusing pdfme playground's project store). |
| **Settings** | Language (English / Bangla), theme (dark / light / system), default page size, default font, custom font upload (IndexedDB), autosave, export mode, file-name pattern, privacy info, storage usage & cleanup. |
| **Mobile** | Responsive shell: collapsible sidebar, slide-in drawer, bottom navigation, touch-sized controls, full-screen editor. |

### Privacy

No account, API key, backend, analytics or paid service. Documents are processed on-device; projects/fonts live in IndexedDB, preferences in LocalStorage. The Sentry hook inherited from pdfme only activates if you set `VITE_SENTRY_DSN` (unset by default). The third-party ad script from the upstream playground page was removed. The original pdfme playground routes still reference some Google-hosted fonts (upstream behaviour); NexVora screens use only the bundled font plus fonts you upload.

## Technology stack

TypeScript · React 19 · Vite (vite-plus) · Tailwind CSS 4 (plus a small themed stylesheet `studio.css`) · pdfme (`@pdfme/ui`, `generator`, `schemas`, `common`, `converter`, `manipulator`, `@pdfme/pdf-lib`) · `bwip-js` · `lucide-react` · `react-router-dom` · `react-toastify`. ZIP files are written by a small built-in writer (no JSZip dependency).

**New direct dependencies of `playground/`** (all already part of the monorepo or the pdfme dependency tree): `@pdfme/manipulator` (`file:../packages/manipulator`), `@pdfme/pdf-lib` (`file:../packages/pdf-lib`), `bwip-js` (`^4.11.4`, same range as `@pdfme/schemas`).

## Installation & development

Requires Node 24 (`.nvmrc`) and npm.

```bash
npm install                      # repo root: installs and links workspaces
npm run build                    # builds the @pdfme/* packages (playground consumes their dist/)
cd playground
npm install                      # NOT `npm ci` — package.json gained 3 deps, lockfile must be refreshed
npm run dev                      # generates template assets, starts Vite
```

Open the printed URL (you land on the NexVora dashboard).

## Build & deployment

```bash
cd playground
npm run build                    # outputs playground/dist (client-side only)
npm run preview                  # local check of the production build
```

`playground/vercel.json` already rewrites all paths to `index.html` (needed for `/studio/*` deep links). **Vercel:** root directory `playground`, install command `cd .. && npm install && npm run build && cd playground && npm install`, build command `npm run build`, output `dist`. **GitHub Pages / static hosting:** serve `dist/` with an SPA fallback to `index.html`. No deployment has been performed.

`npm run build` also runs `generate-template-assets`, whose thumbnail step uses Puppeteer (inherited from pdfme); it needs a downloadable Chromium on first install.

## Browser compatibility

Targets current evergreen browsers (Chrome/Edge/Android Chrome, Firefox, Safari); not yet tested on any. Requires IndexedDB, Web Workers and ES2022. Inline PDF preview depends on the browser's built-in PDF viewer; some mobile browsers show a blank frame — use **Download** there.

## Verification checklist

Run after installing (none of these were run by the author of this change):

```bash
npm run typecheck          # repo root
npm run lint && npm run fmt:check
cd playground && npm run lint && npm run build
npm test                   # includes playground/e2e/studioLib.test.ts (new); the upstream e2e/image-snapshot tests assume the old "/" page — see limitations
```

Then walk through: create project from library → edit → refresh (persisted?) → Preview/Export → bulk CSV → each PDF tool → QR add-to-template → theme/language → phone-width layout.

## Known limitations

- **Not built or run** in the authoring environment (no network). Expect to fix a few type or lint errors on first build.
- Editor Undo/Redo/Duplicate/Delete buttons replay the Designer's own keyboard shortcuts (pdfme exposes no public undo API); not verified in a browser. Ctrl+Z / Ctrl+Y / Ctrl+C / Ctrl+V work directly regardless.
- Zoom buttons set the Designer's zoom level; pinch/Ctrl-wheel zoom inside the Designer is independent and the label may differ.
- Left/right editor panels are pdfme Designer's built-in panels (element palette, pages, layers, properties) rather than custom NexVora panels.
- **PDF password protection is not offered** (the bundled PDF library cannot write encrypted files). Encrypted *input* PDFs are rejected with an explanation; NexVora never bypasses security.
- **"Optimize" is not true compression**: it re-saves with object streams and does not recompress images; gains are often small or zero.
- Watermark / page-number text is limited to Latin characters (built-in PDF fonts).
- Bangla UI covers navigation, dashboard and settings only. Bangla *text inside PDFs* needs a Bangla TTF uploaded in Settings → Custom fonts (none is bundled).
- Template totals are plain fields (pdfme has no formulas). Library templates use text/rectangle/line/QR/Code128/table/checkbox/select schemas only.
- Existing upstream e2e tests (`playground/e2e/index.test.ts`) were written for the old home page at `/`; they will need their start URL changed to `/templates` and snapshots may need review.
- Tracked offline use: the app has no service worker, so the first load needs a network; after the files are cached by the browser it works without server calls, but this was not tested.
- Bulk generation holds output in memory (cap ≈ 700 MB / 5,000 rows per run).

## Project structure (NexVora additions)

```
playground/src/studio/
  StudioApp.tsx            routes + providers
  studio.css               NexVora theme (dark/light, glass, responsive)
  components/              Shell, Logo, ProjectCard, FieldEditor, ui (modals, file picker)
  lib/                     brand, i18n, settings, db (fonts), storage (projects),
                           library (templates), pdfIO (generate/ZIP/download),
                           pdfTools, data (CSV/JSON), fields
  pages/                   Dashboard, Projects, Library, Editor, Generate, Forms,
                           Bulk, Tools, Codes, SettingsPage, About
playground/e2e/studioLib.test.ts   new unit tests
```
Edited upstream files: `playground/src/App.tsx` (routes `/` and `/studio/*` to NexVora), `playground/index.html` (title, icons, ad script removed), `playground/package.json` (3 dependencies), `README.md` (this section).

## About the developer

**Prince AR Abdur Rahman** — NexVora Lab's Ofc · WhatsApp 01707424006, 01796951709 · Facebook https://www.facebook.com/share/1BNn32qoJo/ · Instagram https://www.instagram.com/ur___abdur____rahman__ · Gmail prince.ar.abdur.rahman2008@gmail.com

## License and attribution

NexVora PDF Studio's additions are © 2026 NexVora Lab's Ofc. All Rights Reserved., applied on top of pdfme, which is licensed under the **MIT License** (`LICENSE.md`, Copyright (c) 2020 HandDot). The MIT notice must be retained in all copies or substantial portions. Third-party notices: see `NOTICE.md`. Upstream attribution — pdfme by hand-dot and contributors — is kept below.

---

# pdfme

<p align="center">
  <img src="https://raw.githubusercontent.com/pdfme/pdfme/main/website/static/img/demo.gif" width="800" alt="pdfme demo: designing a template in the Designer, viewing its JSON template, and generating a PDF from it" />
</p>

<h4 align="center">
  <a href="https://pdfme.com/">Website</a> |
  <a href="https://playground.pdfme.com/">Playground</a> |
  <a href="https://discord.gg/xWPTJbmgNV">Discord</a>
</h4>

<p align="center">
  <a href="https://github.com/pdfme/pdfme">
    <img src="https://img.shields.io/github/stars/pdfme/pdfme?style=social" alt="Star pdfme on GitHub" />
  </a>
  <a href="https://github.com/pdfme/pdfme/blob/master/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="pdfme is released under the MIT license." />
  </a>
  <a href="https://www.npmjs.com/package/@pdfme/generator">
    <img src="https://img.shields.io/npm/v/@pdfme/generator.svg" alt="Current npm package version." />
  </a>
  <a href="https://npmcharts.com/compare/@pdfme/common?minimal=true">
    <img src="https://img.shields.io/npm/dm/@pdfme/common.svg" alt="Downloads per month on npm." />
  </a>
</p>

<p align="center">
  ⭐ pdfme is open source. If it saves you time, please <a href="https://github.com/pdfme/pdfme">star us on GitHub</a> to help more developers discover it.
</p>

<p align="center">
  TypeScript-based PDF generator and React-based UI. Open source, developed by the community, and completely free to use under the MIT license!
</p>

## Features

| Fast PDF Generator                                                                                    | Easy PDF Template Design                               | Simple JSON Template                                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Works on Node and in the browser. Use templates to generate PDFs—complex operations are not required. | Anyone can easily create templates using the designer. | Templates are JSON data that is easy to understand and work with. |

## Custom Feature Requests

While pdfme is an open-source project released under the MIT License, we are open to considering custom feature additions for a fee.  
**If you are willing to pay, we can evaluate and implement your requested features.**  
Please note that any additional functionality will always be released as open source. If this approach works for you, please [contact us](https://app.pdfme.com/contact).

For a detailed list of supported features, please refer to the [Supported Features](https://pdfme.com/docs/supported-features) page.

## Documentation

For complete documentation on pdfme, please refer to the [Getting Started](https://pdfme.com/docs/getting-started) guide.

For the planned next major release changes, see the [migration guide draft](website/docs/migration-v6.md).

Need interactive help? Use [DeepWiki](https://deepwiki.com/pdfme/pdfme) to ask questions about pdfme's documentation and source code directly.

## CLI Workflow

For agentic workflows, local verification, or JSON-first template iteration, use [`@pdfme/cli`](packages/cli/README.md).

- `pdfme validate`: validate template or unified job JSON before generation
- `pdfme doctor`: diagnose runtime, font, `basePdf`, and output-path issues before `generate`
- `pdfme generate --image --grid`: generate PDFs and inspect layout via rendered page images

## Examples Using pdfme

If you're looking for code examples to get started with pdfme, check out the [pdfme-playground website](https://playground.pdfme.com/) and the [playground source code](https://github.com/pdfme/pdfme/tree/main/playground). Setup instructions can be found in the [DEVELOPMENT.md](DEVELOPMENT.md) file.

## Sponsors

Support this project by becoming a sponsor. Your logo will appear here with a link to your website.

| [![ProgressLab](https://avatars.githubusercontent.com/u/103434180?s=120&v=4)](https://github.com/ProgressLabIT) | [<img src="https://github.com/user-attachments/assets/e5b1bbbe-bcc2-41bd-9d04-fcd886e62105" alt="photoquest_logo" width="150">](https://photoquest.wedding/) | [<img src="https://avatars.githubusercontent.com/u/6552685?s=200&v=4" alt="Famly" width="150">](https://famly.co) | [![New Sponsor](https://user-images.githubusercontent.com/10214025/90518111-e74bbb00-e198-11ea-8f88-c9e3c1aa4b5b.png)](https://github.com/sponsors/pdfme) |
| :-------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------: |
|                                 [ProgressLab](https://github.com/ProgressLabIT)                                 |                                                          [PhotoQuest](https://photoquest.wedding/)                                                           |                                             [Famly](https://famly.co)                                             |                                                     [New Sponsor](https://github.com/sponsors/pdfme)                                                      |

## Contributors

<a href="https://github.com/pdfme/pdfme/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=pdfme/pdfme" />
</a>

## Special Thanks

- [pdf-lib](https://pdf-lib.js.org/): Used for PDF generation.
- [fontkit](https://github.com/foliojs/fontkit): Used for font rendering.
- [PDF.js](https://mozilla.github.io/pdf.js/): Used for PDF viewing.
- [React](https://reactjs.org/): Used in building the UI.
- [form-render](https://xrender.fun/form-render): Used in building the UI.
- [antd](https://ant.design/): Used in building the UI.
- [react-moveable](https://daybrush.com/moveable/), [react-selecto](https://github.com/daybrush/selecto), [@scena/react-guides](https://daybrush.com/guides/): Used in the Designer UI.
- [dnd-kit](https://github.com/clauderic/dnd-kit): Used in the Designer UI.
- [Lucide](https://lucide.dev/): Used in the Designer UI and Schema's icon.

I definitely could not have created pdfme without these libraries. I am grateful to the developers of these projects.

If you want to contribute to pdfme, please refer to the [Development Guide](https://pdfme.com/docs/development-guide).  
We look forward to your contributions!
