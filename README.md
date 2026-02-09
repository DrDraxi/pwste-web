# PowerWash Simulator Timelapse Exporter (Web)

A browser-based tool to preview and export PowerWash Simulator game timelapses as JPEG ZIPs or animated GIFs.

## Features

- **Auto-scan** your save folder using the File System Access API (Chrome/Edge)
- **Drag-and-drop** or manual file picker as fallback for other browsers
- **Live preview** with configurable frame delay and end pause
- **Frame subset selection** — choose how many frames to include
- **Export formats:**
  - JPEG ZIP — lossless archive of selected frames
  - GIF — animated GIF (scaled to max 800x600)

## Development

```bash
npm install
npm run dev       # Start Vite dev server
npm run build     # TypeScript check + production build
npm run preview   # Preview the production build locally
```

## Deployment

Automatically deployed to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`. The Vite base path is set to `/pwste-web/`.

## How It Works

The app parses PowerWash Simulator's binary timelapse save files (`.sav`), which contain LZ4 or Zstandard-compressed JPEG frames. It supports both in-progress saves (individual `.sav` files per frame) and completed saves (single concatenated file).

Save files are located at `%appdata%\..\LocalLow\FuturLab` on Windows.
