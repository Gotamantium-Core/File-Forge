# File Forge

File Forge is a visual, node-based file conversion studio. Build pipelines on a drag-and-drop canvas by wiring inputs, converters, and PDF tools into an output, then run the graph to produce downloadable files. It runs as a React single-page app with a local Express API that performs all image and PDF work.

## Features

- **Visual pipeline editor** — drag nodes from the library or click to add them, connect typed ports, pan/zoom, box-select, duplicate, and delete.
- **Type-safe connections** — ports carry `image`, `pdf`, `doc`, or `any` types. Incompatible links are rejected, single-input ports accept only one connection, and cycles are blocked before a run.
- **Live pipeline execution** — topologically sorts the graph, runs nodes in dependency order, and reports success, failure, skipped, and per-node duration on the canvas and in the inspector.
- **Rich inspector** — shows pipeline overview, node categories, port connectivity, editable parameters, and per-node run results with artifact previews and downloads.
- **Image engine** — upload JPEG, PNG, WebP, GIF, TIFF, AVIF, BMP, HEIF; convert between PNG/JPEG/WebP with quality control; generate image thumbnails; embed images into PDFs.
- **PDF engine** — merge, split, rotate, extract, delete, and reorder pages, all driven by 1-based page expressions (`1`, `3-5`, `1-2, 4`).
- **Image-to-PDF layout control** — choose fit-to-image, A4, or Letter pages; auto/portrait/landscape orientation; contain/cover/stretch fitting; margins in millimetres; and page background colour.
- **Artifact storage** — uploads and generated files are persisted under `data/artifacts/<uuid>/` with metadata, and served through download and thumbnail endpoints.
- **Local persistence** — the graph, project name, node parameters, and attached artifacts are saved to `localStorage` via Zustand, so the canvas survives a refresh.
- **Error handling** — Zod-validated API payloads, per-node error surfaces, and clear messages for invalid page ranges, encrypted PDFs, unsupported images, and oversized uploads.
- **Dark, responsive UI** — Tailwind CSS dark theme with a minimap, canvas controls, searchable node palette, and status bar.

## Node library

| Category | Node | What it does |
| --- | --- | --- |
| Input | **Image Input** | Load one or more images onto the pipeline. |
| Input | **PDF Input** | Load one or more PDFs. |
| Input | **Audio Input** | Load MP3, FLAC, WAV, OGG, M4A, and other audio files. |
| Convert | **Image to PDF** | Lay images onto PDF pages with size, orientation, fit, margin, and background options. |
| Convert | **Convert Image** | Re-encode images to PNG, JPEG, or WebP with optional quality. |
| Audio tools | **Audio Metadata** | Edit tags and optionally embed artwork from the Artwork input. |
| Audio tools | **Batch Metadata** | Apply shared album tags, auto-number tracks in connection order, optionally embed one cover, and output a single ZIP. |
| Audio tools | **Convert Audio** | Re-encode between MP3, FLAC, WAV, OGG, and M4A. |
| PDF tools | **Merge PDFs** | Combine multiple PDFs in connection order. |
| PDF tools | **Split PDF** | Split into fixed-size chunks or custom page-range parts. |
| PDF tools | **Rotate PDF** | Rotate all or selected pages by 90°, 180°, or 270°. |
| PDF tools | **Extract Pages** | Keep only the selected pages. |
| PDF tools | **Delete Pages** | Remove selected pages, keeping the rest in order. |
| PDF tools | **Reorder Pages** | Rearrange pages by listing every page exactly once. |
| Output | **Output** | Collect finished files and expose them for download. |

The **Output** node is optional: if none is present, File Forge falls back to collecting artifacts from terminal nodes (nodes with no outgoing connections).

## Getting started

Requires Node.js 20+ (developed against modern Node with native `fetch` and `tsx`).

```bash
npm install
npm run dev
```

`npm run dev` starts both processes:

- Web app: <http://localhost:5173>
- API: <http://127.0.0.1:3001>

Vite proxies `/api` requests to the API server. Uploaded and generated artifacts are written to `data/artifacts`.

### Production build

```bash
npm run build   # typecheck + Vite build to dist/
npm start       # serve API and dist/ on port 3001
```

When `dist/index.html` exists, the Express server also serves the built SPA, so a single process hosts both the UI and API.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run Vite and the API together with live reload. |
| `npm run dev:web` | Run only the Vite dev server. |
| `npm run dev:api` | Run only the API with `tsx watch`. |
| `npm run build` | Typecheck with `tsc --noEmit`, then build the SPA. |
| `npm start` | Start the API server (serves `dist/` when present). |
| `npm run typecheck` | Typecheck the frontend, server, and shared code. |

## Usage

1. Drag an **Image Input** or **PDF Input** node onto the canvas.
2. Select the node and upload files in the inspector (drag-and-drop or browse).
3. Add conversion or PDF tool nodes and connect outputs to inputs. Matching port colours indicate compatible types.
4. Optionally connect finished files to an **Output** node.
5. Click **Run pipeline**. Progress and results appear on each node and in the inspector.
6. Download individual artifacts from the inspector or output node.

### Canvas shortcuts

| Keys | Action |
| --- | --- |
| `Del` / `Backspace` | Remove the selected node or edge. |
| `Shift` + drag | Box-select multiple nodes. |
| Scroll | Zoom the canvas. |
| Drag canvas | Pan the view. |

### Page expressions

Page-based tools accept a 1-based expression:

- `1` — page 1
- `3-5` — pages 3 through 5
- `1-2, 4` — pages 1, 2, and 4

Rules differ by node:

- **Extract** keeps the order entered and removes duplicates.
- **Delete** rejects removing every page.
- **Rotate (selected)** accepts any valid selection.
- **Reorder** requires every page exactly once (`2-3, 1` becomes pages 2, 3, 1).
- **Split (custom parts)** rejects pages used in more than one part.

## API

The Express API listens on `127.0.0.1:3001` by default (`PORT` overrides it).

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `POST` | `/api/uploads?kind=image\|pdf\|audio\|auto` | Upload up to 20 files (50 MB each) and register them as artifacts. |
| `POST` | `/api/runs` | Execute a pipeline from a JSON graph of nodes and edges. |
| `GET` | `/api/artifacts/:id/download` | Download an artifact with its original filename. |
| `GET` | `/api/artifacts/:id/thumb` | Get a cached PNG thumbnail for an image or audio artifact (embedded cover art). |

Uploads and generated files are stored under `data/artifacts` and excluded from git. Artifact IDs are validated UUIDs before any filesystem access.

## Tech stack

- **Frontend:** React 19, `@xyflow/react` (React Flow), Zustand, Tailwind CSS 4, Vite 7, Lucide icons
- **Backend:** Express 5, Multer, Zod, `pdf-lib`, `sharp`, `ffmpeg-static`, `music-metadata`, `jszip`, `tsx`
- **Language:** TypeScript, with shared node and artifact contracts between `src/`, `server/`, and `shared/`

## Project structure

```
src/        React UI, canvas, nodes, stores, API client
server/     Express API, pipeline executor, image/audio/PDF/storage libraries
shared/     Node specifications, port types, page expression parsing
data/       Uploaded and generated artifacts (gitignored)
dist/       Production build output (gitignored)
```

## Limits and status

- Uploads: up to 20 files per request, 50 MB per file.
- Graph: up to 200 nodes and 1,000 edges per run.
- Image, PDF, audio, and image-to-PDF nodes are fully implemented.
- Audio conversion uses the bundled `ffmpeg-static` binary; metadata writing preserves existing tags and leaves blank fields unchanged.
- Album art is supplied by connecting an image to a metadata node's Artwork input. Embedding works for MP3, FLAC, and M4A; other containers keep text tags only.
- Batch Metadata outputs one ZIP named after the album, or `tracks.zip` when the album is blank.
