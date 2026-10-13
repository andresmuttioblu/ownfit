"""End-to-end check: synthetic import folder -> expected number of clean items.

Run from pipeline/:  python -m unittest discover tests
"""

import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from ownfit_pipeline.run import run_import
from tests.synthetic import make_import_folder


class ImportPipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name)
        cls.expected = make_import_folder(root / "in")
        (root / "in" / "broken.mov").write_bytes(b"not a video")  # must not sink the import
        cls.out = run_import(root / "in", root / "out", import_id="test")
        cls.manifest = json.loads((cls.out / "manifest.json").read_text())

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_item_count_matches(self):
        self.assertEqual(len(self.manifest["items"]), self.expected)

    def test_intro_without_garment_is_skipped(self):
        self.assertGreaterEqual(len(self.manifest["skipped"]), 1)

    def test_broken_file_is_recorded_not_fatal(self):
        reasons = [s["reason"] for s in self.manifest["skipped"] if s["source"] == "broken.mov"]
        self.assertEqual(len(reasons), 1)

    def test_items_are_white_squares(self):
        for item in self.manifest["items"]:
            with Image.open(self.out / item["image"]) as im:
                img = im.convert("RGB")
            self.assertEqual(img.size[0], img.size[1])
            for corner in [(0, 0), (img.width - 1, img.height - 1)]:
                self.assertEqual(img.getpixel(corner), (255, 255, 255))

    def test_manifest_fields(self):
        item = self.manifest["items"][0]
        for key in ["id", "image", "crop", "source", "kind", "timestamp", "sharpness", "needs_review"]:
            self.assertIn(key, item)
        self.assertTrue((self.out / item["crop"]).exists())
        self.assertTrue((self.out / "contact_sheet.jpg").exists())

    def test_video_items_are_cropped_to_garment(self):
        # Garments are ~180x220 in a 640x480 frame; a crop near full-frame means the crop failed.
        for item in self.manifest["items"]:
            if item["kind"] == "video":
                with Image.open(self.out / item["crop"]) as im:
                    w, h = im.size
                self.assertLess(w * h, 0.4 * 640 * 480, item["id"])


if __name__ == "__main__":
    unittest.main()
