// Browser image helpers (canvas based).

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.imageSmoothingQuality = "high"; // default "low" aliases on big downscales
  return c;
}

export function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), type, quality));
}

/** Photo file -> upright canvas, at most `maxSide` on the long side. */
export async function loadPhoto(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const photo = canvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  photo.getContext("2d")!.drawImage(bitmap, 0, 0, photo.width, photo.height);
  bitmap.close();
  return photo;
}
