"""Video -> still moments: extract frames, score sharpness, group, pick the best frame."""

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

ANALYSIS_SIZE = 640  # frames are analysed downscaled; crops come from full-res frames


@dataclass(frozen=True)
class Frame:
    path: Path  # full-resolution extracted frame
    t: float  # seconds into the video
    sharpness: float
    small: np.ndarray  # BGR, longest side ANALYSIS_SIZE


def extract_frames(video, out_dir, fps):
    """ffmpeg -> out_dir/000001.jpg …; returns [(path, timestamp)]. ffmpeg auto-rotates phone video."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found. Run the setup skill (doctor.py) first.")
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(video),
           "-vf", f"fps={fps}", "-q:v", "2", str(out_dir / "%06d.jpg")]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed on {video.name}: {result.stderr.strip()}")
    paths = sorted(out_dir.glob("*.jpg"))
    return [(p, i / fps) for i, p in enumerate(paths)]


def read_image(path):
    """cv2.imread that also works on Windows paths with non-ASCII characters. None if unreadable."""
    data = np.fromfile(str(path), np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_COLOR) if data.size else None


def downscale(img):
    """Longest side -> ANALYSIS_SIZE (portrait phone video stays small in memory)."""
    h, w = img.shape[:2]
    scale = ANALYSIS_SIZE / max(h, w)
    return cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)


def is_hdr(video):
    """True for HLG / PQ video (iPhone default); extracted frames look washed out without tone mapping."""
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return False
    out = subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=color_transfer", "-of", "csv=p=0", str(video)], capture_output=True, text=True)
    return out.stdout.strip() in {"arib-std-b67", "smpte2084"}


def sharpness(small):
    """Variance of the Laplacian: high = crisp edges, low = motion blur."""
    return float(cv2.Laplacian(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())


def load_frames(extracted):
    frames = []
    for path, t in extracted:
        img = read_image(path)
        if img is None:
            continue
        small = downscale(img)
        frames.append(Frame(path, t, sharpness(small), small))
    return frames


def keep_sharp(frames, sharp_ratio, floor_ratio, window_s=1.0):
    """Keep frames nearly as sharp as their neighbours (within window_s), above a global floor.

    Local, not global: a plain tee is much less "sharp" than a striped shirt, but both are far
    sharper than the motion blur of the swap next to them.
    """
    if not frames:
        return []
    floor = floor_ratio * float(np.median([f.sharpness for f in frames]))
    kept = []
    for f in frames:
        local_max = max(g.sharpness for g in frames if abs(g.t - f.t) <= window_s)
        if f.sharpness >= max(floor, sharp_ratio * local_max):
            kept.append(f)
    return kept


def center_hist(small):
    """Hue/saturation histogram of the central region, where the held garment is."""
    h, w = small.shape[:2]
    center = small[h // 5: h * 4 // 5, w // 5: w * 4 // 5]
    hsv = cv2.cvtColor(center, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [32, 32], [0, 180, 0, 256])
    return cv2.normalize(hist, hist).flatten()


def group_stills(frames, max_gap_s, min_similarity, min_frames):
    """Consecutive sharp frames form one still moment; a time gap or a colour change starts a new one."""
    groups, current, prev_hist = [], [], None
    for f in sorted(frames, key=lambda f: f.t):
        hist = center_hist(f.small)
        is_new = (not current or f.t - current[-1].t > max_gap_s
                  or cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL) < min_similarity)
        if is_new and current:
            groups.append(current)
            current = []
        current.append(f)
        prev_hist = hist
    if current:
        groups.append(current)
    return [g for g in groups if len(g) >= min_frames]


def best_frame(group):
    return max(group, key=lambda f: f.sharpness)
