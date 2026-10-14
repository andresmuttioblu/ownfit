// Tap-to-select with SlimSAM: the user taps the item (and optionally what isn't the item), the
// model returns that object's mask. Preprocessing follows Hugging Face's SamImageProcessor.
import { canvas, loadModel, maskCanvas, ort } from "./cutout";

const SIDE = 1024; // the encoder sees the photo resized to 1024 on the long side, padded to a square
const MASK = 256; // decoder masks cover that padded square at 1/4 resolution
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** A tap in photo pixels; include=false marks something that is not the item. */
export type Tap = { x: number; y: number; include: boolean };

type Segmenter = (taps: Tap[]) => Promise<HTMLCanvasElement>;
const encoded = new WeakMap<HTMLCanvasElement, Promise<Segmenter>>(); // re-entering tap mode reuses the encoding

/** Encode the photo once (the slow part), then call the result per set of taps. */
export function tapSegmenter(photo: HTMLCanvasElement): Promise<Segmenter> {
  let s = encoded.get(photo);
  if (!s) {
    s = build(photo);
    s.catch(() => encoded.delete(photo)); // let a retry try again
    encoded.set(photo, s);
  }
  return s;
}

async function build(photo: HTMLCanvasElement): Promise<Segmenter> {
  const scale = SIDE / Math.max(photo.width, photo.height);
  const rw = Math.round(photo.width * scale), rh = Math.round(photo.height * scale);
  const small = canvas(rw, rh);
  small.getContext("2d")!.drawImage(photo, 0, 0, rw, rh);
  const { data } = small.getContext("2d")!.getImageData(0, 0, rw, rh);
  small.width = small.height = 0;
  const plane = SIDE * SIDE;
  const pixels = new Float32Array(3 * plane); // padding stays 0, as in the HF processor (pads after normalizing)
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = (y * rw + x) * 4;
    for (let c = 0; c < 3; c++) pixels[c * plane + y * SIDE + x] = (data[i + c] / 255 - MEAN[c]) / STD[c];
  }
  const [encoder, decoder] = await Promise.all([loadModel("slimsam-encoder"), loadModel("slimsam-decoder")]);
  const embedded = await encoder.run({ pixel_values: new ort.Tensor("float32", pixels, [1, 3, SIDE, SIDE]) });
  const mw = Math.round(rw / (SIDE / MASK)), mh = Math.round(rh / (SIDE / MASK));

  return async (taps: Tap[]): Promise<HTMLCanvasElement> => {
    const points = new Float32Array(taps.flatMap((t) => [t.x * scale, t.y * scale]));
    const labels = BigInt64Array.from(taps.map((t) => (t.include ? BigInt(1) : BigInt(0))));
    const out = await decoder.run({
      input_points: new ort.Tensor("float32", points, [1, 1, taps.length, 2]),
      input_labels: new ort.Tensor("int64", labels, [1, 1, taps.length]),
      image_embeddings: embedded.image_embeddings,
      image_positional_embeddings: embedded.image_positional_embeddings,
    });
    const scores = out.iou_scores.data as Float32Array;
    const best = scores.indexOf(Math.max(...scores));
    const logits = (out.pred_masks.data as Float32Array).subarray(best * MASK * MASK, (best + 1) * MASK * MASK);
    // Crop away the padding; a sigmoid keeps soft edges once the mask is stretched over the photo.
    return maskCanvas(logits, mw, mh, MASK, (v) => Math.round(255 / (1 + Math.exp(-v))));
  };
}
