import { getFFmpeg } from '../util/ffmpeg-loader';
import { downloadBlob } from '../util/file-save';
import { showProgress, hideProgress } from '../ui/progress';

/**
 * Export frames as an H.264 MP4 video using ffmpeg.wasm.
 */
export async function exportMp4(
  frames: Uint8Array[],
  baseName: string,
  delay: number,
  endPause: number
): Promise<void> {
  const ffmpeg = await getFFmpeg((msg) => showProgress(msg, 0));
  const { fetchFile } = await import('@ffmpeg/util');

  showProgress('Writing frames to virtual filesystem...', 0);

  // Calculate FPS from frame delay
  const fps = Math.max(1, Math.round(1000 / delay));

  // Build frame list: all frames + repeat last frame for end pause
  // Matches Java logic: if endPause > delay*2, add floor(endPause/delay) copies of last frame
  const allFrames: Uint8Array[] = [...frames];

  if (endPause > delay * 2) {
    const numRepetitions = Math.floor(endPause / delay);
    const lastFrame = frames[frames.length - 1];
    for (let i = 0; i < numRepetitions; i++) {
      allFrames.push(lastFrame);
    }
  }

  try {
    // Write frames to ffmpeg virtual FS
    for (let i = 0; i < allFrames.length; i++) {
      const paddedIndex = String(i).padStart(5, '0');
      const filename = `frame_${paddedIndex}.jpg`;
      await ffmpeg.writeFile(
        filename,
        await fetchFile(new Blob([new Uint8Array(allFrames[i])]))
      );

      if (i % 10 === 0) {
        showProgress(
          `Writing frame ${i + 1} of ${allFrames.length}...`,
          ((i + 1) / allFrames.length) * 30
        );
      }
    }

    showProgress('Encoding MP4...', 30);

    ffmpeg.on('progress', ({ progress }) => {
      showProgress('Encoding MP4...', 30 + progress * 65);
    });

    await ffmpeg.exec([
      '-framerate',
      String(fps),
      '-i',
      'frame_%05d.jpg',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '18',
      '-preset',
      'fast',
      'output.mp4',
    ]);

    showProgress('Reading output...', 95);
    const data = (await ffmpeg.readFile('output.mp4')) as Uint8Array;

    const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });
    downloadBlob(blob, `${baseName}.mp4`);
  } finally {
    // Clean up virtual FS even on error
    for (let i = 0; i < allFrames.length; i++) {
      const paddedIndex = String(i).padStart(5, '0');
      try {
        await ffmpeg.deleteFile(`frame_${paddedIndex}.jpg`);
      } catch {
        // ignore cleanup errors
      }
    }
    try {
      await ffmpeg.deleteFile('output.mp4');
    } catch {
      // ignore cleanup errors
    }
  }

  hideProgress();
}
