/**
 * 解码 /api/image 返回的图像数据为 { width, height, gray: Uint8Array }。
 * 与 ImagePane 内部实现保持一致（u16le 按 min/max 归一化到 0..255；u8 直拷）。
 */
export function decodeImage(img) {
  if (!img) return null;
  const { width, height, encoding, min, max, data } = img;
  if (!data) return null;
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const gray = new Uint8Array(width * height);
  if (encoding === 'u16le') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const range = Math.max(1, max - min);
    for (let i = 0; i < width * height; i++) {
      const v = view.getUint16(i * 2, true);
      gray[i] = Math.max(0, Math.min(255, Math.round(((v - min) / range) * 255)));
    }
  } else {
    gray.set(bytes.subarray(0, gray.length));
  }
  return { width, height, gray };
}
