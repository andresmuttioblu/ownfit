"""Generate a synthetic import folder: one tripod-style video + loose photos.

The video mimics real filming: static textured background, a static "person",
an intro with no garment held, then N garments each held still for HOLD_S seconds
with a heavily motion-blurred swap between them.
"""

from pathlib import Path

import cv2
import numpy as np

W, H, FPS = 640, 480, 10
HOLD_S, SWAP_S, INTRO_S = 2.5, 1.0, 1.5

GARMENTS = [  # (BGR color, stripe color, (x, y, w, h)) — held in front of the torso
    ((40, 40, 200), (20, 20, 120), (230, 170, 180, 220)),
    ((60, 170, 60), (240, 240, 240), (240, 160, 160, 260)),
    ((200, 120, 30), (90, 50, 10), (220, 180, 200, 200)),
    ((30, 200, 220), (30, 30, 30), (250, 150, 140, 280)),
    ((180, 60, 160), (250, 200, 250), (225, 175, 190, 210)),
]
PHOTOS = [((20, 90, 160), "circle"), ((120, 120, 120), "rect")]


def _scene(rng):
    bg = rng.integers(150, 200, (H, W, 3), dtype=np.uint8)
    bg = cv2.GaussianBlur(bg, (3, 3), 0)  # textured wall: sharp but not noise
    cv2.rectangle(bg, (0, 380), (W, H), (90, 110, 130), -1)  # floor
    cv2.circle(bg, (320, 110), 40, (140, 170, 210), -1)  # head
    cv2.rectangle(bg, (250, 150), (390, 420), (70, 60, 50), -1)  # torso (worn clothes)
    return bg


def _garment(frame, color, stripe, box, dx=0):
    x, y, w, h = box
    x += dx
    cv2.rectangle(frame, (x, y), (x + w, y + h), color, -1)
    for sy in range(y + 10, y + h, 24):  # stripes give the garment real edges
        cv2.line(frame, (x, sy), (x + w, sy), stripe, 4)
    return frame


def make_video(path, rng):
    scene = _scene(rng)
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (W, H))

    def write(frame):
        noise = rng.normal(0, 3, frame.shape)  # sensor noise
        out.write(np.clip(frame + noise, 0, 255).astype(np.uint8))

    for _ in range(int(INTRO_S * FPS)):
        write(scene.copy())
    for i, (color, stripe, box) in enumerate(GARMENTS):
        for _ in range(int(HOLD_S * FPS)):
            write(_garment(scene.copy(), color, stripe, box))
        if i < len(GARMENTS) - 1:
            for k in range(int(SWAP_S * FPS)):
                f = _garment(scene.copy(), color, stripe, box, dx=60 * (k - 5))
                write(cv2.GaussianBlur(f, (41, 41), 0))  # motion blur
    out.release()


def make_photo(path, color, shape, rng):
    img = rng.integers(225, 245, (900, 1200, 3), dtype=np.uint8)  # tabletop
    if shape == "circle":
        cv2.circle(img, (600, 450), 220, color, -1)
        cv2.circle(img, (600, 450), 120, (240, 240, 240), 12)
    else:
        cv2.rectangle(img, (380, 250), (820, 650), color, -1)
        cv2.rectangle(img, (480, 330), (720, 570), (30, 30, 30), 10)
    cv2.imwrite(str(path), img)


def make_import_folder(folder):
    """Write the synthetic set into folder; return the expected item count."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)
    make_video(folder / "closet.mp4", rng)
    for i, (color, shape) in enumerate(PHOTOS):
        make_photo(folder / f"photo_{i}.jpg", color, shape, rng)
    return len(GARMENTS) + len(PHOTOS)


if __name__ == "__main__":
    import sys

    print(make_import_folder(sys.argv[1] if len(sys.argv) > 1 else "imports/synthetic"), "items expected")
