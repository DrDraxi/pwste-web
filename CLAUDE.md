# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pwste-web** is a browser-based tool for previewing and exporting PowerWash Simulator game timelapses. It parses binary save files, decompresses JPEG frames, and exports them as JPEG ZIPs or animated GIFs. Built with TypeScript + Vite (no framework — vanilla JS with type-safe DOM utilities).

Deployed to GitHub Pages at `/pwste-web/`.

## Build & Development

```bash
npm run dev       # Vite dev server
npm run build     # tsc + vite build → dist/
npm run preview   # Preview production build locally
```

No test framework is configured. No linter is configured.

## Architecture

### Module Layout (`src/`)

- **`main.ts`** — Entry point. Wires up UI, manages global state (`currentTimelapse`, `currentSubset`, `player`, `exporting`), orchestrates load→preview→export flow.
- **`parse/`** — Binary file parsing and decompression
  - `binary.ts` — Low-level binary reader utilities
  - `lz4.ts` — Custom minimal LZ4 block decompressor
  - `timelapse.ts` — Auto-detects save format (in-progress vs complete), decompresses, returns `TimeLapse { name, rawName, isComplete, frames: Uint8Array[] }`
- **`export/`** — Export format modules (jpeg-export, gif-export). Each takes frames + options and produces a downloadable file.
- **`ui/`** — UI modules: `scanner.ts` (File System Access API directory scanner), `dragdrop.ts` (drag-and-drop + manual picker fallback), `preview.ts` (PreviewPlayer class for frame playback), `progress.ts` (progress bar), `dom.ts` (type-safe DOM helpers)
- **`util/`** — `file-save.ts` (download wrapper), `image.ts` (JPEG↔Blob URL, canvas scaling)

### Data Flow

```
File input (Scanner | DragDrop | Picker)
  → Binary Parser (timelapse.ts)
  → LZ4 or Zstd decompression
  → JPEG frames (Uint8Array[])
  → PreviewPlayer (animated playback)
  → Export module (ZIP | GIF)
  → File download
```

### Binary Save File Formats

**In-progress saves** (individual `.sav` files, sorted by numeric suffix):
`[width:4B][height:4B][uncompSize:4B][compSize:4B][uncompSize:4B][LZ4 data]`

**Complete saves** (`*0-100.sav`):
`[checksum:4B][width:4B][height:4B][uncompSize:8B][compSize:8B][Zstd data]` — first frame skipped (duplicate)

### Key Browser API Dependencies

- File System Access API (`showDirectoryPicker`) — Chrome/Edge primary input method; falls back to drag-and-drop
- Canvas 2D — image scaling for GIF export (max 800x600)

## Conventions

- **Files**: kebab-case. **Functions**: camelCase. **Classes**: PascalCase. **Constants**: SCREAMING_SNAKE_CASE.
- Blob URLs are always cleaned up via `URL.revokeObjectURL`.
- Long operations yield to the event loop periodically and report progress via callbacks.
- Frame subset selection and naming logic mirrors the companion Java desktop application.
- Save file location on Windows: `%appdata%\..\LocalLow\FuturLab`

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`): push to `main` → `npm ci && npm run build` → deploy `dist/` to GitHub Pages. Vite base path is `/pwste-web/`.
