"""Check the tools Ownfit needs and print the install command for this OS.

Usage: python .claude/skills/ownfit-setup/scripts/doctor.py         (exit 0 = all good, 1 = something missing)
       python .claude/skills/ownfit-setup/scripts/doctor.py --self-test
Stdlib only, so it runs before anything else is installed.
"""

import platform
import re
import shutil
import subprocess
import sys

OS = {"Darwin": "mac", "Windows": "windows"}.get(platform.system(), "linux")

# name -> (min version, version command, install command per OS)
TOOLS = {
    "python": ((3, 11), None, {
        "mac": "brew install python@3.12",
        "windows": "winget install Python.Python.3.12",
        "linux": "sudo apt install python3 python3-venv  (or your distro's equivalent)",
    }),
    "ffmpeg": ((4, 0), ["ffmpeg", "-version"], {
        "mac": "brew install ffmpeg",
        "windows": "winget install Gyan.FFmpeg",
        "linux": "sudo apt install ffmpeg",
    }),
    "node": ((20, 12), ["node", "--version"], {
        "mac": "brew install node",
        "windows": "winget install OpenJS.NodeJS.LTS",
        "linux": "install Node 20+ from https://nodejs.org (distro packages are often too old)",
    }),
    "pnpm": ((9, 0), ["pnpm", "--version"], {
        "mac": "npm install -g pnpm",
        "windows": "npm install -g pnpm",
        "linux": "npm install -g pnpm",
    }),
}


def parse_version(text):
    """First 'X.Y' found in text -> (X, Y), or None."""
    match = re.search(r"(\d+)\.(\d+)", text)
    return (int(match.group(1)), int(match.group(2))) if match else None


def tool_version(cmd):
    exe = shutil.which(cmd[0])  # resolves .cmd/.exe shims on Windows
    if not exe:
        return None
    try:
        out = subprocess.run([exe, *cmd[1:]], capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return parse_version(out.stdout + out.stderr)


def check():
    missing = []
    for name, (minimum, cmd, install) in TOOLS.items():
        found = sys.version_info[:2] if cmd is None else tool_version(cmd)
        ok = found is not None and found >= minimum
        shown = ".".join(map(str, found)) if found else "not found"
        print(f"{'OK ' if ok else 'MISSING'}  {name:<7} {shown:<10} (need {'.'.join(map(str, minimum))}+)")
        if not ok:
            missing.append((name, install[OS]))
    if missing:
        print(f"\nInstall on {OS}:")
        for name, cmd in missing:
            print(f"  {name}: {cmd}")
    else:
        print("\nAll tools present.")
    return not missing


def self_test():
    assert parse_version("ffmpeg version 8.1 Copyright") == (8, 1)
    assert parse_version("v22.17.1") == (22, 17)
    assert parse_version("ffmpeg version n7.0-12-gabc") == (7, 0)
    assert parse_version("no digits") is None
    assert (3, 11) >= (3, 11) and not (3, 9) >= (3, 11)
    print("self-test passed")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        sys.exit(0 if check() else 1)
