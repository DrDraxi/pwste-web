/**
 * Read a little-endian uint32 from a DataView at the given byte offset.
 */
export function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/**
 * Read a little-endian int32 from a DataView at the given byte offset.
 */
export function readI32(view: DataView, offset: number): number {
  return view.getInt32(offset, true);
}

/**
 * Read a little-endian int64 from a DataView as a Number.
 * Safe for values up to Number.MAX_SAFE_INTEGER (~9PB).
 */
export function readI64AsNumber(view: DataView, offset: number): number {
  const lo = view.getUint32(offset, true);
  const hi = view.getInt32(offset + 4, true);
  return hi * 0x100000000 + lo;
}
