import JSZip from 'jszip';
import { downloadBlob } from '../util/file-save';
import { showProgress, hideProgress } from '../ui/progress';

/**
 * Export frames as a ZIP of JPEGs.
 */
export async function exportJpegsAsZip(
  frames: Uint8Array[],
  baseName: string
): Promise<void> {
  showProgress('Creating ZIP...', 0);

  const zip = new JSZip();
  for (let i = 0; i < frames.length; i++) {
    const paddedIndex = String(i).padStart(4, '0');
    zip.file(`${baseName}_${paddedIndex}.jpg`, frames[i]);
    showProgress(
      `Adding frame ${i + 1} of ${frames.length}...`,
      ((i + 1) / frames.length) * 50
    );
  }

  showProgress('Compressing ZIP...', 50);
  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'STORE' },
    (meta) => {
      showProgress('Compressing ZIP...', 50 + (meta.percent / 100) * 50);
    }
  );

  downloadBlob(blob, `${baseName}.zip`);
  hideProgress();
}
