/**
 * Create a Blob URL from raw JPEG bytes.
 */
export function jpegBytesToBlobUrl(jpegBytes: Uint8Array): string {
  const blob = new Blob([new Uint8Array(jpegBytes)], { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}

/**
 * Load JPEG bytes into an HTMLImageElement and return it.
 */
export function loadImage(jpegBytes: Uint8Array): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = jpegBytesToBlobUrl(jpegBytes);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load JPEG image'));
    };
    img.src = url;
  });
}

/**
 * Convert JPEG bytes to ImageData via canvas.
 */
export async function jpegToImageData(
  jpegBytes: Uint8Array
): Promise<ImageData> {
  const img = await loadImage(jpegBytes);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Convert JPEG bytes to ImageData at a scaled size.
 */
export async function jpegToScaledImageData(
  jpegBytes: Uint8Array,
  maxWidth: number,
  maxHeight: number
): Promise<ImageData> {
  const img = await loadImage(jpegBytes);
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (w > maxWidth || h > maxHeight) {
    const scale = Math.min(maxWidth / w, maxHeight / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
