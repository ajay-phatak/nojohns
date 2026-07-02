"""Onboarding validation: one spawn tells the app whether a replay folder and
connect code are usable before any real analysis runs.

Checks, in order:
  1. folder exists and contains .slp files (month-subfolder layout supported)
  2. the given connect code appears in at least one of the newest replays

Result event carries counts so the UI can show "142 replays found, code seen
in 3 of the last 5 games".
"""
import argparse
import os

from . import events
from .game_review import detect_port
from .session_review import get_all_slp_files

# How many of the newest replays to scan for the connect code. Parsing full
# games is slow; detect_port only reads metadata, so a handful is cheap and
# tolerates a few games that predate the code (e.g. local/tournament sets).
CODE_SCAN_LIMIT = 5


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Validate a Slippi replay folder + connect code for No Johns."
    )
    parser.add_argument("folder", help="Path to Slippi folder (or parent with YYYY-MM subfolders)")
    parser.add_argument("--code", type=str, default=None,
                        help="Connect code to look for in recent replays (e.g. ABCD#123)")
    args = parser.parse_args(argv)

    if not os.path.isdir(args.folder):
        events.error(f"Not a directory: {args.folder}", code="bad_folder")
        return 2

    try:
        files, resolved = get_all_slp_files(args.folder, None)
    except Exception as e:
        events.error(f"Could not scan folder: {e}", code="scan_failed")
        return 2

    if not files:
        events.error(f"No .slp files found in: {resolved}", code="no_slp_files",
                     resolved=resolved)
        return 2

    code_seen = None
    scanned = 0
    if args.code:
        code_seen = 0
        for path in reversed(files[-CODE_SCAN_LIMIT:]):
            scanned += 1
            events.progress("doctor", scanned, min(CODE_SCAN_LIMIT, len(files)),
                            detail=os.path.basename(path))
            try:
                if detect_port(path, args.code) is not None:
                    code_seen += 1
            except Exception:
                continue

    events.result(
        resolved=resolved,
        slp_count=len(files),
        newest=os.path.basename(files[-1]),
        code=args.code,
        code_seen_in=code_seen,
        code_scanned=scanned,
    )
    if not events.enabled:
        print(f"Folder : {resolved}")
        print(f"Replays: {len(files)} (.slp), newest: {os.path.basename(files[-1])}")
        if args.code:
            print(f"Code   : {args.code} seen in {code_seen}/{scanned} newest games")

    if args.code and code_seen == 0:
        return 1
    return 0
