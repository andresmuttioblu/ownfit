---
name: ownfit-import
description: Turn a folder of wardrobe video + loose photos into clean, background-removed garment images. Use when the user says "import my closet", "import my wardrobe", "process my video", or points at an import folder.
---

# Ownfit import

Runs the local pipeline: video/photos → one clean, white-background image per garment, plus a contact sheet for review. Everything runs on the user's computer; nothing is uploaded.

## Before running

1. Make sure setup has run (`pipeline/.venv` exists). If not, use the `ownfit-setup` skill first.
2. Ask for the import folder if the user didn't give one. Suggest `imports/<name>/` in this repo (it's gitignored, so their photos never reach GitHub).
3. Confirm the folder contents in one line: how many videos and photos.
4. iPhones record HDR video by default; frames from HDR look washed out. The pipeline warns and flags those items. For future filming, suggest turning HDR off (Settings → Camera → Formats → HDR Video). Long 4K videos need a few GB of free temp disk space while running.
5. Remind them of the one filming rule the pipeline depends on: **each video starts with ~3 s of them standing still, empty-handed.** That frame is the reference used to find the held garment. If they didn't do this, say the first item in that video will likely be missed and they can add it as a photo.

## Run

From the repo root:

- Mac/Linux: `pipeline/.venv/bin/python -m ownfit_pipeline <folder>`
- Windows: `pipeline/.venv/Scripts/python -m ownfit_pipeline <folder>`

Run it in the foreground so the user sees progress ("Scanning video 1/2…", "Removing backgrounds 12/34…"). The first run downloads the background-removal model (~170 MB).

Output lands in `output/<import-id>/`:
- `items/NNN.png` clean garment images
- `crops/NNN.jpg` the original crop each one came from
- `manifest.json` source, timestamp, sharpness, `needs_review`, plus `skipped` still moments
- `contact_sheet.jpg` every item in a grid

## After running

1. Open `contact_sheet.jpg` and look at it yourself. Report: item count vs. what the user expected, anything that looks like a duplicate, a miss, a person instead of a garment, or a bad cutout. Name items by their NNN number.
2. Show the contact sheet to the user and ask for the real count.
3. If results are off, tune and re-run with a new `--id` (every setting is a flag; `--help` lists them):
   - Items missing or merged → lower `--min-similarity` (e.g. 0.7) or `--max-gap-s`.
   - Duplicates of the same item → raise `--min-similarity` (e.g. 0.9) or `--min-still-s`.
   - Crops include too much of the person, or nothing is found → adjust `--diff-threshold` (higher = stricter).
   - Rough cutout edges → try `--model isnet-general-use` or `--model birefnet-general` (better edges, larger download, slower).
4. Tagging and upload are the next step (Stage 3), not part of this skill yet.
