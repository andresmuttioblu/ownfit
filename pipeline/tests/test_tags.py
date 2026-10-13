"""Tag validation against the shared vocabulary. Run from pipeline/: python -m unittest discover tests"""

import unittest

from ownfit_pipeline.tags import load_vocabulary, validate_tag, validate_tags_file

GOOD = {"id": "001", "name": "navy merino crew-neck sweater", "category": "top", "subcategory": "sweater",
        "colors": ["navy"], "pattern": "solid", "material": "wool", "formality": 3, "warmth": 4,
        "seasons": ["autumn", "winter"], "tags": ["crew-neck"]}


class TagValidationTest(unittest.TestCase):
    vocab = load_vocabulary()

    def test_good_tag_passes(self):
        self.assertEqual(validate_tag(GOOD, self.vocab), [])

    def test_subcategory_must_belong_to_category(self):
        errors = validate_tag({**GOOD, "subcategory": "heels"}, self.vocab)
        self.assertTrue(any("subcategory" in e for e in errors))

    def test_unknown_color_and_ranges(self):
        errors = validate_tag({**GOOD, "colors": ["mauve"], "formality": 7, "seasons": []}, self.vocab)
        self.assertEqual(len(errors), 3, errors)

    def test_missing_field(self):
        tag = {k: v for k, v in GOOD.items() if k != "material"}
        self.assertTrue(any("material" in e for e in validate_tag(tag, self.vocab)))

    def test_skipped_item_needs_only_reason(self):
        self.assertEqual(validate_tag({"id": "002", "skip": "person, not a garment"}, self.vocab), [])

    def test_file_must_cover_every_manifest_item(self):
        manifest = {"items": [{"id": "001"}, {"id": "002"}]}
        errors = validate_tags_file([GOOD], manifest, self.vocab)
        self.assertTrue(any("002" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
