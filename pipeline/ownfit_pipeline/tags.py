"""Validate tags.json (written by Claude Code during import) against the shared vocabulary.

Usage: python -m ownfit_pipeline.tags output/<import-id>     (exit 0 = valid)
"""

import json
import sys
from pathlib import Path

VOCAB_PATH = Path(__file__).resolve().parents[2] / "app" / "src" / "lib" / "catalog" / "garment-tags.json"
REQUIRED = ["name", "category", "subcategory", "colors", "pattern", "material", "formality", "warmth", "seasons", "tags"]


def load_vocabulary(path=VOCAB_PATH):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _is_scale(v):
    return isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 5


def validate_tag(tag, vocab):
    """List of human-readable problems with one tag record; empty = valid."""
    tid = tag.get("id", "?")
    if "skip" in tag:  # Claude judged it not a garment (person, blur, duplicate frame)
        return [] if isinstance(tag["skip"], str) and tag["skip"] else [f"{tid}: skip needs a reason"]
    missing = [f"{tid}: missing {k}" for k in REQUIRED if k not in tag]
    if missing:
        return missing
    errors = []
    cats, limits = vocab["categories"], vocab["limits"]
    if tag["category"] not in cats:
        errors.append(f"{tid}: unknown category '{tag['category']}'")
    elif tag["subcategory"] not in cats[tag["category"]]:
        errors.append(f"{tid}: subcategory '{tag['subcategory']}' is not in {tag['category']}")
    colors = tag["colors"]
    if not (isinstance(colors, list) and 1 <= len(colors) <= limits["colors"] and all(c in vocab["colors"] for c in colors)):
        errors.append(f"{tid}: colors must be 1-{limits['colors']} of the vocabulary colors, got {colors}")
    for field, allowed in [("pattern", vocab["patterns"]), ("material", vocab["materials"])]:
        if tag[field] not in allowed:
            errors.append(f"{tid}: unknown {field} '{tag[field]}'")
    for field in ["formality", "warmth"]:
        if not _is_scale(tag[field]):
            errors.append(f"{tid}: {field} must be an integer 1-5, got {tag[field]!r}")
    seasons = tag["seasons"]
    if not (isinstance(seasons, list) and seasons and all(s in vocab["seasons"] for s in seasons)):
        errors.append(f"{tid}: seasons must be a non-empty list of {vocab['seasons']}")
    free = tag["tags"]
    if not (isinstance(free, list) and len(free) <= limits["tags"] and all(isinstance(t, str) and len(t) <= limits["tag_length"] for t in free)):
        errors.append(f"{tid}: tags must be up to {limits['tags']} strings of at most {limits['tag_length']} characters")
    if not (isinstance(tag["name"], str) and tag["name"].strip() and len(tag["name"]) <= limits["name"]):
        errors.append(f"{tid}: name must be 1-{limits['name']} characters")
    return errors


def validate_tags_file(tags, manifest, vocab):
    errors = [e for t in tags for e in validate_tag(t, vocab)]
    tagged = {t.get("id") for t in tags}
    expected = {i["id"] for i in manifest["items"] if i.get("image")} or {i["id"] for i in manifest["items"]}
    errors += [f"{i}: not tagged" for i in sorted(expected - tagged)]
    errors += [f"{i}: tagged but not in manifest" for i in sorted(tagged - expected)]
    return errors


def main(out_dir):
    out_dir = Path(out_dir)
    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    tags_path = out_dir / "tags.json"
    if not tags_path.exists():
        raise SystemExit(f"{tags_path} not found. Tag the items first.")
    errors = validate_tags_file(json.loads(tags_path.read_text(encoding="utf-8")), manifest, load_vocabulary())
    for e in errors:
        print(e)
    print(f"{len(errors)} problem(s)" if errors else "tags.json is valid")
    return 1 if errors else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    sys.exit(main(sys.argv[1]))
