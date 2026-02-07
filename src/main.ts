import { setupDragDrop, type FileEntry } from './ui/dragdrop';
import {
  scanSaveDirectory,
  readTimelapseFiles,
  isFileSystemAccessSupported,
  type ScannedTimelapse,
} from './ui/scanner';
import { PreviewPlayer } from './ui/preview';
import { showProgress, hideProgress } from './ui/progress';
import { $, $input, $img, show, hide } from './ui/dom';
import { loadTimelapse, type TimeLapse } from './parse/timelapse';
import { exportJpegsAsZip } from './export/jpeg-export';
import { exportGif } from './export/gif-export';
import { exportMp4 } from './export/mp4-export';

// State
let currentTimelapse: TimeLapse | null = null;
let currentSubset: Uint8Array[] = [];
let player: PreviewPlayer | null = null;
let exporting = false;
let scannedTimelapses: ScannedTimelapse[] = [];

// DOM elements
const mainContent = $('main-content');
const timelapseName = $('timelapse-name');
const frameCounter = $('frame-counter');
const previewImg = $img('preview-image');
const frameSlider = $input('frame-slider');
const frameSliderValue = $('frame-slider-value');
const delayInput = $input('delay-input');
const endPauseInput = $input('end-pause-input');
const btnExportJpeg = $('btn-export-jpeg');
const btnExportGif = $('btn-export-gif');
const btnExportMp4 = $('btn-export-mp4');
const errorDisplay = $('error-display');
const selectorSection = $('selector-section');
const timelapseSelect = $('timelapse-select') as HTMLSelectElement;

// Scan section
const scanSection = $('scan-section');
const btnScan = $('btn-scan');
const btnCopyPath = $('btn-copy-path');
const pathText = $('path-text');

// Fallback section
const btnFallbackToggle = $('btn-fallback-toggle');
const fallbackContent = $('fallback-content');
const dropZone = $('drop-zone');
const folderInput = $input('folder-input');
const fileInput = $input('file-input');

// If File System Access API isn't available, show drag-and-drop directly
if (!isFileSystemAccessSupported()) {
  hide(scanSection);
  show(fallbackContent);
  btnFallbackToggle.textContent = 'Use drag and drop or file picker below';
}

// Frame subset selection - mirrors Java's PowerWashSimTimelapseExporter lines 413-420
function selectFrameSubset(allFrames: Uint8Array[], count: number): Uint8Array[] {
  const total = allFrames.length;
  if (count >= total) return [...allFrames];

  const subset: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      subset.push(allFrames[total - 1]);
    } else {
      subset.push(allFrames[Math.floor((i * total) / count)]);
    }
  }
  return subset;
}

function getDelay(): number {
  return Math.max(10, parseInt(delayInput.value, 10) || 100);
}

function getEndPause(): number {
  return Math.max(10, parseInt(endPauseInput.value, 10) || 1000);
}

function updatePreview(): void {
  if (!currentTimelapse) return;

  const frameCount = parseInt(frameSlider.value, 10);
  currentSubset = selectFrameSubset(currentTimelapse.frames, frameCount);
  frameSliderValue.textContent = String(currentSubset.length);

  if (player) {
    player.setDelay(getDelay());
    player.setEndPause(getEndPause());
    player.setFrames(currentSubset);
  }
}

function showError(msg: string): void {
  errorDisplay.textContent = msg;
  show(errorDisplay);
  setTimeout(() => hide(errorDisplay), 10000);
}

function setExporting(state: boolean): void {
  exporting = state;
  (btnExportJpeg as HTMLButtonElement).disabled = state;
  (btnExportGif as HTMLButtonElement).disabled = state;
  (btnExportMp4 as HTMLButtonElement).disabled = state;
}

function getExportName(): string {
  if (!currentTimelapse) return 'timelapse';
  return currentTimelapse.rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

// Handle loaded files (from scan selection or drag-and-drop)
async function handleFiles(files: FileEntry[], folderName: string): Promise<void> {
  if (files.length === 0) {
    showError('No .sav files found in the selected location.');
    return;
  }

  hide(errorDisplay);
  showProgress('Loading timelapse...', 0);

  try {
    const timelapse = loadTimelapse(files, folderName, (current, total) => {
      if (total > 0) {
        showProgress(
          `Decompressing frame ${current} of ${total}...`,
          (current / total) * 100
        );
      } else {
        showProgress(`Decompressing frame ${current}...`, 0);
      }
    });

    if (timelapse.frames.length === 0) {
      showError('No frames found in the timelapse.');
      hideProgress();
      return;
    }

    currentTimelapse = timelapse;

    // Update UI
    timelapseName.textContent = timelapse.name;
    frameSlider.max = String(timelapse.frames.length);
    frameSlider.value = String(timelapse.frames.length);

    // Set up preview player
    if (player) player.destroy();
    player = new PreviewPlayer(previewImg, (current, total) => {
      frameCounter.textContent = `${current} / ${total}`;
    });

    updatePreview();

    show(mainContent);
    hideProgress();
  } catch (err) {
    hideProgress();
    const message = err instanceof Error ? err.message : String(err);
    showError(`Failed to load timelapse: ${message}`);
    console.error(err);
  }
}

// Populate the dropdown with scan results
function populateSelector(timelapses: ScannedTimelapse[]): void {
  timelapseSelect.innerHTML =
    '<option value="" disabled selected>Select a timelapse...</option>';
  for (let i = 0; i < timelapses.length; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = timelapses[i].displayName;
    timelapseSelect.appendChild(opt);
  }
  show(selectorSection);
}

// When user picks a timelapse from the dropdown, load it
timelapseSelect.addEventListener('change', async () => {
  const idx = parseInt(timelapseSelect.value, 10);
  if (isNaN(idx) || !scannedTimelapses[idx]) return;

  const entry = scannedTimelapses[idx];
  showProgress(`Loading ${entry.displayName}...`, 0);

  try {
    const files = await readTimelapseFiles(entry, (loaded, total) => {
      showProgress(
        `Reading file ${loaded} of ${total}...`,
        (loaded / total) * 50
      );
    });
    await handleFiles(files, entry.folderName);
  } catch (err) {
    hideProgress();
    showError(`Failed to load: ${err instanceof Error ? err.message : err}`);
  }
});

// Scan button
btnScan.addEventListener('click', async () => {
  hide(errorDisplay);
  try {
    showProgress('Scanning for timelapses...', 0);
    scannedTimelapses = await scanSaveDirectory();
    hideProgress();

    if (scannedTimelapses.length > 0) {
      populateSelector(scannedTimelapses);
    } else {
      showError('No timelapses found in that folder. Make sure you selected the FuturLab or PowerWash Simulator folder.');
    }
  } catch (err) {
    hideProgress();
    // User cancelled the picker — not an error
    if (err instanceof DOMException && err.name === 'AbortError') return;
    showError(`Scan failed: ${err instanceof Error ? err.message : err}`);
  }
});

// Copy path button
btnCopyPath.addEventListener('click', async () => {
  const text = pathText.textContent || '';
  try {
    await navigator.clipboard.writeText(text);
    btnCopyPath.textContent = 'Copied!';
    setTimeout(() => { btnCopyPath.textContent = 'Copy'; }, 1500);
  } catch {
    // Fallback: select the text
    const range = document.createRange();
    range.selectNodeContents(pathText);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
});

// Fallback toggle
btnFallbackToggle.addEventListener('click', () => {
  const isHidden = fallbackContent.classList.contains('hidden');
  if (isHidden) {
    show(fallbackContent);
  } else {
    hide(fallbackContent);
  }
});

// Wire up drag-and-drop (fallback)
setupDragDrop(dropZone, folderInput, fileInput, handleFiles);

// Wire up controls
frameSlider.addEventListener('input', () => {
  frameSliderValue.textContent = frameSlider.value;
});

frameSlider.addEventListener('change', () => {
  updatePreview();
});

delayInput.addEventListener('change', () => {
  if (player) player.setDelay(getDelay());
});

endPauseInput.addEventListener('change', () => {
  if (player) player.setEndPause(getEndPause());
});

// Export handlers
btnExportJpeg.addEventListener('click', async () => {
  if (exporting || currentSubset.length === 0) return;
  setExporting(true);
  try {
    await exportJpegsAsZip(currentSubset, getExportName());
  } catch (err) {
    hideProgress();
    showError(`JPEG export failed: ${err instanceof Error ? err.message : err}`);
  }
  setExporting(false);
});

btnExportGif.addEventListener('click', async () => {
  if (exporting || currentSubset.length === 0) return;
  setExporting(true);
  try {
    await exportGif(currentSubset, getExportName(), getDelay(), getEndPause());
  } catch (err) {
    hideProgress();
    showError(`GIF export failed: ${err instanceof Error ? err.message : err}`);
  }
  setExporting(false);
});

btnExportMp4.addEventListener('click', async () => {
  if (exporting || currentSubset.length === 0) return;
  setExporting(true);
  try {
    await exportMp4(currentSubset, getExportName(), getDelay(), getEndPause());
  } catch (err) {
    hideProgress();
    showError(`MP4 export failed: ${err instanceof Error ? err.message : err}`);
  }
  setExporting(false);
});
