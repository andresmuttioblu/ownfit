"""python -m ownfit_pipeline <import-folder> [--out output] [--sharp-ratio 0.5] …"""

import argparse
import sys
from dataclasses import fields

from .run import Settings, run_import


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows pipes default to cp1252
    p = argparse.ArgumentParser(prog="ownfit_pipeline", description="Wardrobe video + photos -> clean garment images.")
    p.add_argument("folder", help="import folder with videos and/or photos")
    p.add_argument("--out", default="output", help="output root (default: output)")
    p.add_argument("--id", dest="import_id", help="import id (default: <folder>-<timestamp>)")
    for f in fields(Settings):  # every tunable is a flag, e.g. --keep-fraction
        p.add_argument(f"--{f.name.replace('_', '-')}", type=type(f.default), default=f.default)
    a = p.parse_args()
    settings = Settings(**{f.name: getattr(a, f.name) for f in fields(Settings)})
    run_import(a.folder, a.out, a.import_id, settings)


if __name__ == "__main__":
    main()
