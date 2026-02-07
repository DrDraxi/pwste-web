export interface FileEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Set up drag-and-drop on an element.
 * Calls onFiles when .sav files are dropped or selected.
 */
export function setupDragDrop(
  dropZone: HTMLElement,
  folderInput: HTMLInputElement,
  fileInput: HTMLInputElement,
  onFiles: (files: FileEntry[], folderName: string) => void
): void {
  // Drag visual feedback
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  // Drop handler
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const items = e.dataTransfer?.items;
    if (!items) return;

    const entries: FileEntry[] = [];
    let folderName = 'timelapse';

    // Try to read as directory entries (modern browsers)
    const fileHandles: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) fileHandles.push(entry);
    }

    if (fileHandles.length === 1 && fileHandles[0].isDirectory) {
      // Dropped a folder
      folderName = fileHandles[0].name;
      const dirEntries = await readDirectory(
        fileHandles[0] as FileSystemDirectoryEntry
      );
      for (const entry of dirEntries) {
        if (entry.isFile && entry.name.toLowerCase().endsWith('.sav')) {
          const file = await getFile(entry as FileSystemFileEntry);
          const data = new Uint8Array(await file.arrayBuffer());
          entries.push({ name: entry.name, data });
        }
      }
    } else {
      // Dropped individual files
      for (let i = 0; i < items.length; i++) {
        const file = items[i].getAsFile();
        if (file && file.name.toLowerCase().endsWith('.sav')) {
          const data = new Uint8Array(await file.arrayBuffer());
          entries.push({ name: file.name, data });
        }
      }
      if (entries.length > 0) {
        // Try to extract folder name from file names
        folderName = guessFolderName(entries[0].name);
      }
    }

    if (entries.length > 0) {
      onFiles(entries, folderName);
    }
  });

  // Folder input handler
  folderInput.addEventListener('change', async () => {
    const files = folderInput.files;
    if (!files || files.length === 0) return;

    const entries: FileEntry[] = [];
    let folderName = 'timelapse';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.toLowerCase().endsWith('.sav')) {
        const data = new Uint8Array(await file.arrayBuffer());
        entries.push({ name: file.name, data });
        // Extract folder name from webkitRelativePath
        if (file.webkitRelativePath) {
          const parts = file.webkitRelativePath.split('/');
          if (parts.length > 1) folderName = parts[0];
        }
      }
    }

    if (entries.length > 0) {
      onFiles(entries, folderName);
    }
    folderInput.value = '';
  });

  // File input handler
  fileInput.addEventListener('change', async () => {
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    const entries: FileEntry[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.toLowerCase().endsWith('.sav')) {
        const data = new Uint8Array(await file.arrayBuffer());
        entries.push({ name: file.name, data });
      }
    }

    const folderName =
      entries.length > 0 ? guessFolderName(entries[0].name) : 'timelapse';

    if (entries.length > 0) {
      onFiles(entries, folderName);
    }
    fileInput.value = '';
  });
}

function readDirectory(
  dirEntry: FileSystemDirectoryEntry
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = dirEntry.createReader();
    const results: FileSystemEntry[] = [];

    const readBatch = () => {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(results);
          } else {
            results.push(...entries);
            readBatch();
          }
        },
        reject
      );
    };
    readBatch();
  });
}

function getFile(fileEntry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}

/**
 * Try to extract a timelapse name from a filename like "MAPNAME_LEVELNAME_TIMELAPSE_0.sav"
 */
function guessFolderName(filename: string): string {
  const base = filename.replace(/\.sav$/i, '');
  const parts = base.split('_');
  // Remove the trailing number
  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
    parts.pop();
  }
  // Remove trailing "0-100" for complete saves
  if (parts.length > 1 && parts[parts.length - 1] === '0-100') {
    parts.pop();
  }
  return parts.join('_');
}
