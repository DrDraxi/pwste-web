import type { FileEntry } from './dragdrop';

export interface ScannedTimelapse {
  folderName: string;
  displayName: string;
  isComplete: boolean;
  handle: FileSystemDirectoryHandle;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function';
}

/**
 * Open a directory picker and recursively scan for timelapse folders.
 */
export async function scanSaveDirectory(): Promise<ScannedTimelapse[]> {
  const dirHandle = await window.showDirectoryPicker!({ id: 'pwste-saves', mode: 'read' });
  const results: ScannedTimelapse[] = [];
  await findTimelapses(dirHandle, results);
  results.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return results;
}

async function findTimelapses(
  dir: FileSystemDirectoryHandle,
  results: ScannedTimelapse[]
): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'directory') continue;
    const lower = name.toLowerCase();
    const dirHandle = handle as FileSystemDirectoryHandle;

    if (lower.endsWith('timelapse') || lower.endsWith('timelapse-comp')) {
      const isComplete = lower.endsWith('timelapse-comp');

      // Check it has at least one .sav file
      let hasSav = false;
      for await (const [childName] of dirHandle.entries()) {
        if (childName.toLowerCase().endsWith('.sav')) {
          hasSav = true;
          break;
        }
      }

      if (hasSav) {
        results.push({
          folderName: name,
          displayName: buildDisplayName(name, isComplete),
          isComplete,
          handle: dirHandle,
        });
      }
    } else {
      // Recurse into subdirectories
      await findTimelapses(dirHandle, results);
    }
  }
}

function buildDisplayName(rawName: string, isComplete: boolean): string {
  const parts = rawName.split('_');
  if (parts.length < 3) return rawName;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  let result = cap(parts[0]) + ':';
  if (!isComplete) result += ' [In Progress]';
  for (let i = 1; i < parts.length - 1; i++) {
    if (i === 2) result += ' -';
    result += ' ' + cap(parts[i]);
  }
  return result;
}

/**
 * Read all .sav files from a scanned timelapse directory handle.
 */
export async function readTimelapseFiles(
  entry: ScannedTimelapse,
  onProgress?: (loaded: number, total: number) => void
): Promise<FileEntry[]> {
  // Collect file handles first
  const fileHandles: { name: string; handle: FileSystemFileHandle }[] = [];
  for await (const [name, handle] of entry.handle.entries()) {
    if (handle.kind === 'file' && name.toLowerCase().endsWith('.sav')) {
      fileHandles.push({ name, handle: handle as FileSystemFileHandle });
    }
  }

  // Read files
  const results: FileEntry[] = [];
  for (let i = 0; i < fileHandles.length; i++) {
    const { name, handle } = fileHandles[i];
    const file = await handle.getFile();
    const data = new Uint8Array(await file.arrayBuffer());
    results.push({ name, data });
    onProgress?.(i + 1, fileHandles.length);
  }

  return results;
}
