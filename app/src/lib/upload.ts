// Shared checks for routes that accept an image and spend Anthropic credit on it.

export const MAX_IMAGE_BYTES = 3_700_000; // base64 of this stays under Anthropic's 5 MB image limit
export const PNG = [0x89, 0x50, 0x4e, 0x47];
export const JPEG = [0xff, 0xd8, 0xff];

/**
 * A per-hour cap on calls. ponytail: per-instance (serverless instances don't share it); the real
 * cap is the Anthropic workspace spend limit. Upgrade to a DB-backed counter if this ever matters.
 */
export function hourlyLimiter(max: number): () => boolean {
  const recent: number[] = [];
  return function overLimit() {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    while (recent.length && recent[0] < hourAgo) recent.shift();
    if (recent.length >= max) return true;
    recent.push(Date.now());
    return false;
  };
}

/** The bytes of an uploaded file, checked for size and file type (magic bytes). */
export async function readImage(form: FormData, field: string, magic: number[]): Promise<Uint8Array> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) throw new Error(`${field}: missing or too large`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!magic.every((b, i) => bytes[i] === b)) throw new Error(`${field}: unexpected file type`);
  return bytes;
}
