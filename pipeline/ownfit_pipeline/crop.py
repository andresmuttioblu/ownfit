"""Find the held garment by differencing each still moment against an empty-handed reference.

Filming starts with ~3 s of the user standing empty-handed. That first still moment is the
reference: the person and background stay put, so the biggest region that differs from it in a
later still moment is the held garment (plus the arms holding it).
"""

# ponytail: relies on the empty-handed intro and one filming spot per video. If the intro is
# missing, item 1 becomes the reference and is lost. Upgrade path: Claude Code bbox for flagged items.

import cv2
import numpy as np

MAX_BOX_FRACTION = 0.6  # a "garment" bigger than this is likely an exposure shift: flag it


def garment_box(small, ref, diff_threshold, min_area_fraction):
    """(x, y, w, h) of the held garment in small-frame pixels, or None if nothing is held."""
    a = cv2.GaussianBlur(small, (5, 5), 0)
    b = cv2.GaussianBlur(ref, (5, 5), 0)
    diff = cv2.absdiff(a, b).max(axis=2)
    mask = (diff > diff_threshold).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    biggest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(biggest) < min_area_fraction * small.shape[0] * small.shape[1]:
        return None
    return cv2.boundingRect(biggest)


def scale_and_pad(box, small_shape, full_shape, pad_fraction):
    """Map a small-frame box onto the full-res frame, padded and clamped."""
    x, y, w, h = box
    s = full_shape[1] / small_shape[1]
    px, py = w * pad_fraction, h * pad_fraction
    x0, y0 = max(0, int((x - px) * s)), max(0, int((y - py) * s))
    x1 = min(full_shape[1], int((x + w + px) * s))
    y1 = min(full_shape[0], int((y + h + py) * s))
    return x0, y0, x1, y1
