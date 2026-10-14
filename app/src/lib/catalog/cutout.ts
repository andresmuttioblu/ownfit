// Browser-side background removal: same model + preprocessing as rembg, same white 1024 canvas
// as the local pipeline (pipeline/ownfit_pipeline/clean.py). Runs on the phone; no server cost.
import * as ort from "onnxruntime-web/wasm";
import { ACTIVE_BG_MODEL, BROWSER_MODELS } from "./bg-models";

const CANVAS = 1024;
const MARGIN = 0.06;
const MAX_INPUT = 1600; // keeps clean PNG + original JPEG under the 4.5 MB request limit
const ALPHA_CUTOFF = 16; // matches clean.py's bbox threshold
const MIN_CUTOUT = 0.01; // a cutout smaller than this share of the photo counts as "found nothing"
ort.env.wasm.wasmPaths = "/ort/"; // self-hosted copy (scripts/copy-ort.mjs)
ort.env.wasm.numThreads = 1; // threads need cross-origin isolation headers

export { ort };

const sessions = new Map<string, Promise<ort.InferenceSession>>();

/** One cached session per model file (served by /api/bg-model). */
export function loadModel(name: string): Promise<ort.InferenceSession> {
  if (!sessions.has(name)) {
    sessions.set(name, ort.InferenceSession.create(`/api/bg-model?name=${name}`, { executionProviders: ["wasm"] }).catch((e) => {
      sessions.delete(name); // let a retry try again
      throw e;
    }));
  }
  return sessions.get(name)!;
}

/** Start the (possibly large) model download early, e.g. when the page opens. */
export function preloadCutoutModel(): void {
  loadModel(ACTIVE_BG_MODEL).catch(() => {}); // surfaced again when autoMask() runs
}

/** Tap-to-select models (about 14 MB): fetch while the user looks at the automatic cutout. */
export function preloadTapModels(): void {
  for (const name of ["slimsam-encoder", "slimsam-decoder"]) loadModel(name).catch(() => {}); // surfaced again on use
}

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

/** Photo file -> upright canvas, at most MAX_INPUT on the long side. */
export async function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_INPUT / Math.max(bitmap.width, bitmap.height));
  const photo = canvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  photo.getContext("2d")!.drawImage(bitmap, 0, 0, photo.width, photo.height);
  bitmap.close();
  return photo;
}

/** Alpha-only canvas (w x h) from model output laid out with `stride` values per row. */
export function maskCanvas(values: Float32Array, w: number, h: number, stride: number, toAlpha: (v: number) => number) {
  const m = canvas(w, h);
  const img = m.getContext("2d")!.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.data[(y * w + x) * 4 + 3] = toAlpha(values[y * stride + x]);
  m.getContext("2d")!.putImageData(img, 0, 0);
  return m;
}

/** Automatic mask of the photo's main subject, rembg-style. */
export async function autoMask(photo: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const { size, mean, std } = BROWSER_MODELS[ACTIVE_BG_MODEL];
  const small = canvas(size, size);
  small.getContext("2d")!.drawImage(photo, 0, 0, size, size);
  const { data } = small.getContext("2d")!.getImageData(0, 0, size, size);
  let max = 1e-6;
  for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i], data[i + 1], data[i + 2]);
  const plane = size * size;
  const chw = new Float32Array(3 * plane);
  for (let p = 0; p < plane; p++) {
    for (let c = 0; c < 3; c++) chw[c * plane + p] = (data[p * 4 + c] / max - mean[c]) / std[c];
  }
  const sess = await loadModel(ACTIVE_BG_MODEL);
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", chw, [1, 3, size, size]) });
  const pred = (out[sess.outputNames[0]].data as Float32Array).subarray(0, plane); // channel 0
  let lo = Infinity, hi = -Infinity;
  for (const v of pred) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const range = hi - lo || 1;
  return maskCanvas(pred, size, size, size, (v) => Math.round(((v - lo) / range) * 255));
}

export type Cutout = { clean: Blob; isBlank: boolean };

/** Photo + mask (any resolution, stretched over the photo) -> item on a white 1024 square (PNG). */
export async function onWhite(photo: HTMLCanvasElement, mask: HTMLCanvasElement): Promise<Cutout> {
  const { width: w, height: h } = photo;
  // Bounding box on the small mask, scaled up.
  const alpha = mask.getContext("2d")!.getImageData(0, 0, mask.width, mask.height).data;
  let x0 = mask.width, y0 = mask.height, x1 = -1, y1 = -1;
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    if (alpha[(y * mask.width + x) * 4 + 3] > ALPHA_CUTOFF) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const found = x1 >= x0 && y1 >= y0;
  // Upscaling spreads the edge about one mask pixel outward: grow the box so the soft fringe isn't clipped.
  if (found) { x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(mask.width - 1, x1 + 1); y1 = Math.min(mask.height - 1, y1 + 1); }
  const sx = w / mask.width, sy = h / mask.height;
  const bx = found ? x0 * sx : 0, by = found ? y0 * sy : 0;
  const bw = found ? (x1 - x0 + 1) * sx : w, bh = found ? (y1 - y0 + 1) * sy : h;
  const isBlank = !found || bw * bh < MIN_CUTOUT * w * h;

  // Photo with the mask as its alpha channel.
  const cut = canvas(w, h);
  const ctx = cut.getContext("2d")!;
  ctx.drawImage(mask, 0, 0, w, h);
  ctx.globalCompositeOperation = "source-in";
  ctx.drawImage(photo, 0, 0);

  const inner = CANVAS * (1 - 2 * MARGIN);
  const fit = Math.min(inner / bw, inner / bh);
  const out = canvas(CANVAS, CANVAS);
  const o = out.getContext("2d")!;
  o.fillStyle = "#fff";
  o.fillRect(0, 0, CANVAS, CANVAS);
  o.drawImage(cut, bx, by, bw, bh, (CANVAS - bw * fit) / 2, (CANVAS - bh * fit) / 2, bw * fit, bh * fit);

  const clean = await toBlob(out, "image/png");
  for (const c of [cut, out]) c.width = c.height = 0; // iOS Safari frees canvas memory late
  return { clean, isBlank };
}
