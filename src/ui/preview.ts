import { jpegBytesToBlobUrl } from '../util/image';

export class PreviewPlayer {
  private frames: Uint8Array[] = [];
  private blobUrls: string[] = [];
  private currentFrame = 0;
  private timerId: number | null = null;
  private delay = 100;
  private endPause = 1000;
  private imgEl: HTMLImageElement;
  private onFrameChange?: (index: number, total: number) => void;

  constructor(
    imgEl: HTMLImageElement,
    onFrameChange?: (index: number, total: number) => void
  ) {
    this.imgEl = imgEl;
    this.onFrameChange = onFrameChange;
  }

  setFrames(frames: Uint8Array[]): void {
    this.stop();
    this.revokeBlobUrls();
    this.frames = frames;
    this.blobUrls = frames.map((f) => jpegBytesToBlobUrl(f));
    this.currentFrame = 0;
    if (frames.length > 0) {
      this.showFrame(0);
      this.start();
    }
  }

  setDelay(ms: number): void {
    this.delay = ms;
  }

  setEndPause(ms: number): void {
    this.endPause = ms;
  }

  private showFrame(index: number): void {
    if (index < this.blobUrls.length) {
      this.imgEl.src = this.blobUrls[index];
      this.onFrameChange?.(index + 1, this.frames.length);
    }
  }

  private tick = (): void => {
    if (this.frames.length === 0) return;

    this.showFrame(this.currentFrame);

    const isLastFrame = this.currentFrame === this.frames.length - 1;
    const nextDelay = isLastFrame ? this.endPause : this.delay;

    this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    this.timerId = window.setTimeout(this.tick, nextDelay);
  };

  start(): void {
    this.stop();
    this.timerId = window.setTimeout(this.tick, this.delay);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private revokeBlobUrls(): void {
    for (const url of this.blobUrls) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls = [];
  }

  destroy(): void {
    this.stop();
    this.revokeBlobUrls();
    this.frames = [];
  }
}
