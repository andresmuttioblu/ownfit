"""Background removal (rembg) -> garment centered on a white square canvas."""

from PIL import Image, ImageOps
from rembg import new_session, remove

CANVAS = 1024
MARGIN = 0.06  # fraction of the canvas left empty on each side
MAX_INPUT = 2048  # downscale huge phone photos before segmentation
MIN_CUTOUT = 0.01  # a cutout smaller than this share of the input is treated as blank


def session(model):
    return new_session(model)


def on_white(img, sess):
    """PIL image -> (RGB square with the garment centered on white, is_blank).

    is_blank means rembg found (almost) nothing, e.g. a white shirt against a white wall.
    """
    img = img.convert("RGB")
    img.thumbnail((MAX_INPUT, MAX_INPUT))
    cut = remove(img, session=sess)  # RGBA
    bbox = cut.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
    is_blank = bbox is None or (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) < MIN_CUTOUT * cut.width * cut.height
    if bbox:
        cut = cut.crop(bbox)
    inner = int(CANVAS * (1 - 2 * MARGIN))
    cut = ImageOps.contain(cut, (inner, inner), Image.LANCZOS)  # scales up small crops too
    canvas = Image.new("RGB", (CANVAS, CANVAS), (255, 255, 255))
    canvas.paste(cut, ((CANVAS - cut.width) // 2, (CANVAS - cut.height) // 2), cut)
    return canvas, is_blank
