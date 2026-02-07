import { decompressLZ4Block } from './lz4';
import { readU32, readI64AsNumber } from './binary';
import { decompress as zstdDecompress } from 'fzstd';

export interface TimeLapse {
  name: string;
  rawName: string;
  isComplete: boolean;
  /** Each element is the raw JPEG bytes of one frame */
  frames: Uint8Array[];
}

/**
 * Determine if a set of files represents a complete save.
 * Complete saves have a file ending in "0-100.sav".
 */
export function isCompleteSave(fileNames: string[]): boolean {
  return fileNames.some((f) => f.toLowerCase().endsWith('0-100.sav'));
}

/**
 * Build a display name from the folder/file name.
 * Mirrors TimeLapse.java name processing.
 */
export function processName(rawName: string, isComplete: boolean): string {
  // Strip trailing -COMP or TIMELAPSE suffix for name processing
  const parts = rawName.split('_');
  if (parts.length < 3) return rawName;

  const capitalize = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  let result = capitalize(parts[0]) + ':';
  if (!isComplete) result += ' [In Progress]';

  // Skip last part (TIMELAPSE or TIMELAPSE-COMP)
  for (let i = 1; i < parts.length - 1; i++) {
    if (i === 2) result += ' -';
    result += ' ' + capitalize(parts[i]);
  }
  return result;
}

/**
 * Parse a single in-progress .sav file into a JPEG frame.
 *
 * File structure (all little-endian):
 *   4B width
 *   4B height
 *   4B uncompressed size
 *   4B compressed size
 *   4B uncompressed size (again)
 *   LZ4 block data
 */
function parseInProgressFrame(data: Uint8Array): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const uncompressedSize = readU32(view, 16);
  const result = new Uint8Array(uncompressedSize);
  decompressLZ4Block(data, 20, result, 0, uncompressedSize);
  return result;
}

/**
 * Load an in-progress timelapse from individual .sav files.
 * Files should be sorted by their numeric suffix.
 */
export function loadInProgressTimelapse(
  files: { name: string; data: Uint8Array }[],
  folderName: string,
  onProgress?: (current: number, total: number) => void
): TimeLapse {
  // Sort files by numeric suffix
  const sorted = [...files]
    .map((f) => {
      const parts = f.name.replace(/\.sav$/i, '').split('_');
      const num = parseInt(parts[parts.length - 1], 10);
      return { ...f, num };
    })
    .filter((f) => !isNaN(f.num))
    .sort((a, b) => a.num - b.num);

  const frames: Uint8Array[] = [];
  for (let i = 0; i < sorted.length; i++) {
    frames.push(parseInProgressFrame(sorted[i].data));
    onProgress?.(i + 1, sorted.length);
  }

  return {
    name: processName(folderName, false),
    rawName: folderName,
    isComplete: false,
    frames,
  };
}

/**
 * Load a complete timelapse from the 0-100.sav file.
 *
 * File structure (all little-endian):
 *   4B unknown (checksum?)
 *   4B width
 *   4B height
 *   8B uncompressed size
 *   8B compressed size
 *   Zstd compressed data containing concatenated in-progress frames
 */
export function loadCompleteTimelapse(
  file: { name: string; data: Uint8Array },
  folderName: string,
  onProgress?: (current: number, total: number) => void
): TimeLapse {
  const data = file.data;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Read uncompressed size at offset 12 (8 bytes, int64)
  const uncompressedSize = readI64AsNumber(view, 12);

  // Zstd decompress from offset 28
  const compressedSlice = data.slice(28);
  const decompressed = zstdDecompress(compressedSlice);

  if (decompressed.length !== uncompressedSize) {
    console.warn(
      `Zstd decompressed size mismatch: expected ${uncompressedSize}, got ${decompressed.length}`
    );
  }

  // Parse concatenated in-progress frames from decompressed data
  const frames: Uint8Array[] = [];
  const dView = new DataView(
    decompressed.buffer,
    decompressed.byteOffset,
    decompressed.byteLength
  );
  let offset = 0;

  for (let i = 0; offset < decompressed.length; i++) {
    const uncompSize = readU32(dView, offset + 8);
    const compSize = readU32(dView, offset + 12);

    const result = new Uint8Array(uncompSize);
    decompressLZ4Block(decompressed, offset + 20, result, 0, uncompSize);

    // Skip first frame (duplicate of last frame in complete saves)
    if (i !== 0) {
      frames.push(result);
    }

    offset += 20 + compSize;
    onProgress?.(frames.length, 0); // total unknown until done
  }

  return {
    name: processName(folderName, true),
    rawName: folderName,
    isComplete: true,
    frames,
  };
}

/**
 * Auto-detect format and load a timelapse from files.
 */
export function loadTimelapse(
  files: { name: string; data: Uint8Array }[],
  folderName: string,
  onProgress?: (current: number, total: number) => void
): TimeLapse {
  const complete = isCompleteSave(files.map((f) => f.name));

  if (complete) {
    const mainFile = files.find((f) =>
      f.name.toLowerCase().endsWith('0-100.sav')
    );
    if (!mainFile) throw new Error('Could not find 0-100.sav in complete save');
    return loadCompleteTimelapse(mainFile, folderName, onProgress);
  } else {
    return loadInProgressTimelapse(files, folderName, onProgress);
  }
}
