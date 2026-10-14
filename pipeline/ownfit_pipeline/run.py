"""Import folder -> output/<import-id>/{items,crops}/NNN + manifest.json + contact_sheet.jpg."""

import json
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from pillow_heif import register_heif_opener

from . import clean, crop, video

register_heif_opener()  # iPhone photos are HEIC

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}
PHOTO_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}


@dataclass(frozen=True)
class Settings:
    fps: float = 2.0
    sharp_ratio: float = 0.5  # keep frames at least this sharp relative to neighbours within 1 s
    floor_ratio: float = 0.15  # ...and at least this fraction of the video's median sharpness
    max_gap_s: float = 1.0  # a longer gap between sharp frames = a new item
    min_similarity: float = 0.8  # centre-colour correlation below this = a new item
    min_still_s: float = 1.0  # shorter still moments are swap noise
    diff_threshold: int = 35  # pixel difference vs. the empty-handed reference that counts as "garment"
    min_area_fraction: float = 0.02  # smaller differences = nothing held
    pad_fraction: float = 0.08
    model: str = "u2net"


def log(msg):
    print(msg, flush=True)


def find_inputs(folder):
    files = sorted(p for p in Path(folder).rglob("*") if p.is_file() and not p.name.startswith("."))
    return ([p for p in files if p.suffix.lower() in VIDEO_EXT],
            [p for p in files if p.suffix.lower() in PHOTO_EXT])


MAX_CROP_SIDE = 3000  # crops of huge photos are capped; plenty for tagging and the catalog


class Import:
    """Accumulates items/skips and writes them to disk as it goes, so a crash never loses work."""

    def __init__(self, out_dir, import_id, folder, settings):
        self.out_dir, self.items, self.skipped = out_dir, [], []
        self.header = {"import_id": import_id, "created_at": datetime.now(timezone.utc).isoformat(),
                       "input": str(folder.resolve()), "settings": asdict(settings)}

    def skip(self, source, timestamp, reason):
        self.skipped.append({"source": source, "timestamp": timestamp, "reason": reason})

    def add_crop(self, img, meta, notes=()):
        """Save the crop now (nothing big stays in memory); background removal happens later."""
        item_id = f"{len(self.items) + 1:03d}"
        crop_path = f"crops/{item_id}.jpg"
        img.thumbnail((MAX_CROP_SIDE, MAX_CROP_SIDE))
        img.save(self.out_dir / crop_path, quality=92)
        self.items.append({"id": item_id, "image": None, "crop": crop_path, "notes": list(notes), **meta})

    def save_manifest(self):
        manifest = {**self.header, "items": self.items, "skipped": self.skipped}
        (self.out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def scan_video(path, s, imp):
    """Crop every still moment that has a held garment and hand it to imp."""
    hdr = video.is_hdr(path)
    if hdr:
        log(f"  Warning: {path.name} is HDR video; colours may look washed out. Turn off HDR in the camera settings for future imports.")
    with tempfile.TemporaryDirectory() as tmp:
        frames = video.load_frames(video.extract_frames(path, Path(tmp), s.fps))
        sharp = video.keep_sharp(frames, s.sharp_ratio, s.floor_ratio)
        groups = video.group_stills(sharp, s.max_gap_s, s.min_similarity, max(1, round(s.min_still_s * s.fps)))
        log(f"  {path.name}: {len(frames)} frames, {len(sharp)} sharp, {len(groups)} still moments")
        del frames, sharp  # release the analysis frames before cropping
        bests = [video.best_frame(g) for g in groups]
        if len(bests) < 2:
            imp.skip(path.name, None, "fewer than 2 still moments: need the empty-handed intro plus at least one item")
            return
        ref_frame, bests = bests[0], bests[1:]
        ref = ref_frame.small
        imp.skip(path.name, ref_frame.t, "empty-handed reference")
        log(f"  Using the still moment at {ref_frame.t:.1f}s as the empty-handed reference.")
        frame_area = ref.shape[0] * ref.shape[1]
        for b in bests:
            box = crop.garment_box(b.small, ref, s.diff_threshold, s.min_area_fraction)
            if box is None:
                imp.skip(path.name, b.t, "no held item detected")
                continue
            full = video.read_image(b.path)
            if full is None:
                imp.skip(path.name, b.t, "frame unreadable")
                continue
            x0, y0, x1, y1 = crop.scale_and_pad(box, b.small.shape, full.shape, s.pad_fraction)
            notes = ["hdr video"] if hdr else []
            if box[2] * box[3] > crop.MAX_BOX_FRACTION * frame_area:
                notes.append("crop covers most of the frame (lighting change or moved closer?)")
            imp.add_crop(Image.fromarray(cv2.cvtColor(full[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)),
                         {"source": path.name, "kind": "video", "timestamp": round(b.t, 2),
                          "sharpness": round(b.sharpness, 1), "needs_review": bool(notes)}, notes)


def add_photo(path, imp):
    with Image.open(path) as raw:
        img = ImageOps.exif_transpose(raw).convert("RGB")
    small = video.downscale(cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR))
    imp.add_crop(img, {"source": path.name, "kind": "photo", "timestamp": None,
                       "sharpness": round(video.sharpness(small), 1), "needs_review": False})


def contact_sheet(items, out_dir, cols=6, cell=256):
    items = [i for i in items if i["image"]]
    rows = max(1, -(-len(items) // cols))
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 24)), (235, 235, 235))
    draw = ImageDraw.Draw(sheet)
    for i, item in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + 24)
        with Image.open(out_dir / item["image"]) as im:
            sheet.paste(im.resize((cell - 8, cell - 8)), (x + 4, y + 4))
        label = f"{item['id']} {item['source']}" + (" [review]" if item["needs_review"] else "")
        draw.text((x + 6, y + cell - 2), label[:38], fill=(30, 30, 30))
    sheet.save(out_dir / "contact_sheet.jpg", quality=88)


def remove_backgrounds(imp, model):
    log(f"Loading background-removal model '{model}'...")
    sess = clean.session(model)
    total = len(imp.items)
    for n, item in enumerate(imp.items, 1):
        log(f"Removing backgrounds {n}/{total}...")
        try:
            with Image.open(imp.out_dir / item["crop"]) as im:
                img, is_blank = clean.on_white(im, sess)
            item["image"] = f"items/{item['id']}.png"
            img.save(imp.out_dir / item["image"])
            if is_blank:
                item["needs_review"] = True
                item["notes"].append("background removal found almost nothing")
        except Exception as e:  # one bad item must not sink the import
            item["needs_review"] = True
            item["notes"].append(f"background removal failed: {e}")


def run_import(folder, out_root="output", import_id=None, settings=Settings()):
    folder = Path(folder)
    if not folder.is_dir():
        raise SystemExit(f"Import folder not found: {folder}")
    import_id = import_id or f"{folder.name}-{datetime.now():%Y%m%d-%H%M%S}"
    out_dir = Path(out_root) / import_id
    (out_dir / "items").mkdir(parents=True, exist_ok=True)
    (out_dir / "crops").mkdir(exist_ok=True)

    videos, photos = find_inputs(folder)
    log(f"Import '{import_id}': {len(videos)} video(s), {len(photos)} photo(s)")
    if not videos and not photos:
        raise SystemExit("No videos or photos found in the import folder.")

    imp = Import(out_dir, import_id, folder, settings)
    try:
        for i, path in enumerate(videos, 1):
            log(f"Scanning video {i}/{len(videos)}: {path.name}")
            try:
                scan_video(path, settings, imp)
            except Exception as e:  # corrupt/unsupported file: record it, keep going
                imp.skip(path.name, None, f"video failed: {e}")
                log(f"  Skipped {path.name}: {e}")
        for path in photos:
            try:
                add_photo(path, imp)
            except Exception as e:
                imp.skip(path.name, None, f"photo unreadable: {e}")
        log(f"Found {len(imp.items)} items ({len(imp.skipped)} skipped).")
        imp.save_manifest()
        remove_backgrounds(imp, settings.model)
        contact_sheet(imp.items, out_dir)
    finally:
        imp.save_manifest()
    log(f"Done: {len(imp.items)} items -> {out_dir}")
    return out_dir
