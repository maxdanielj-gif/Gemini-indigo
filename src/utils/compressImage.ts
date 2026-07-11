/**
 * Resizes and re-compresses an image before it's stored anywhere in the app.
 *
 * Why this exists: an uncompressed phone camera photo is commonly 5-15MB+.
 * Storing dozens of those as base64 strings (their storage format throughout
 * this app) and loading them all into memory at once — which is exactly what
 * happens when the Gallery screen opens — is a realistic way to exhaust a
 * phone browser's memory and crash the tab. AI-generated images are usually
 * already a sensible size; this mainly matters for direct photo uploads.
 *
 * Resizing to a generous max dimension and re-encoding as JPEG at a solid
 * quality keeps images looking essentially identical for anything short of
 * pixel-peeping, while cutting file size dramatically.
 */
export async function compressImageToDataUrl(
  file: Blob,
  maxDimension: number = 2048,
  quality: number = 0.85
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not load image for compression'));
      el.src = objectUrl;
    });

    const { width, height } = img;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
