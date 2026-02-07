/**
 * Minimal LZ4 block decompressor.
 * Handles raw LZ4 block format (not framed) as used by PowerWash Simulator save files.
 */
export function decompressLZ4Block(
  src: Uint8Array,
  srcOffset: number,
  dst: Uint8Array,
  dstOffset: number,
  originalSize: number
): void {
  let sIdx = srcOffset;
  let dIdx = dstOffset;
  const dEnd = dstOffset + originalSize;

  while (dIdx < dEnd) {
    // Read token
    const token = src[sIdx++];
    let literalLength = token >> 4;
    let matchLength = token & 0x0f;

    // Literal length
    if (literalLength === 15) {
      let s: number;
      do {
        s = src[sIdx++];
        literalLength += s;
      } while (s === 255);
    }

    // Copy literals
    for (let i = 0; i < literalLength; i++) {
      dst[dIdx++] = src[sIdx++];
    }

    if (dIdx >= dEnd) break;

    // Read match offset (little-endian 16-bit)
    const offset = src[sIdx] | (src[sIdx + 1] << 8);
    sIdx += 2;

    if (offset === 0) throw new Error('LZ4: invalid offset 0');

    // Match length
    matchLength += 4; // minimum match length is 4
    if ((token & 0x0f) === 15) {
      let s: number;
      do {
        s = src[sIdx++];
        matchLength += s;
      } while (s === 255);
    }

    // Copy match (may overlap - must copy byte by byte)
    let matchPos = dIdx - offset;
    for (let i = 0; i < matchLength; i++) {
      dst[dIdx++] = dst[matchPos++];
    }
  }
}
