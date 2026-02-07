import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { jpegToScaledImageData } from '../util/image';
import { downloadBlob } from '../util/file-save';
import { showProgress, hideProgress } from '../ui/progress';

// Max GIF dimensions to avoid excessive memory/time
const MAX_GIF_WIDTH = 800;
const MAX_GIF_HEIGHT = 600;

/**
 * Export frames as an animated GIF.
 */
export async function exportGif(
  frames: Uint8Array[],
  baseName: string,
  delay: number,
  endPause: number
): Promise<void> {
  showProgress('Preparing GIF...', 0);

  // Convert first frame to get dimensions
  const firstImageData = await jpegToScaledImageData(
    frames[0],
    MAX_GIF_WIDTH,
    MAX_GIF_HEIGHT
  );
  const { width, height } = firstImageData;

  const gif = GIFEncoder();

  for (let i = 0; i < frames.length; i++) {
    showProgress(
      `Encoding frame ${i + 1} of ${frames.length}...`,
      ((i + 1) / frames.length) * 100
    );

    const imageData = await jpegToScaledImageData(
      frames[i],
      MAX_GIF_WIDTH,
      MAX_GIF_HEIGHT
    );

    const palette = quantize(imageData.data, 256);
    const index = applyPalette(imageData.data, palette);

    const isLast = i === frames.length - 1;
    const frameDelay = isLast ? endPause : delay;

    gif.writeFrame(index, width, height, {
      palette,
      delay: frameDelay,
    });

    // Yield to keep UI responsive
    if (i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  gif.finish();

  const bytes = gif.bytes();
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
  downloadBlob(blob, `${baseName}.gif`);
  hideProgress();
}
