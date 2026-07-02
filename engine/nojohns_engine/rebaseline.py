"""Recompute pro baselines on existing session JSONs.

Baselines are embedded at analyze time, so pro replays fetched *afterwards*
wouldn't show up in already-archived sessions without re-parsing the player's
games. This patches pro_baseline/pro_games in place using the (cached) pro
parses only — the player's own metrics are untouched.
"""
import argparse
import json
import os

from . import events, paths
from . import session_review


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="nojohns-engine rebaseline",
        description="Recompute pro baselines in session JSON files.")
    parser.add_argument("paths", nargs="+", help="session JSON file(s) to update")
    parser.add_argument("--data-dir", type=str, default=None,
                        help="Base data directory holding pro_replays/")
    args = parser.parse_args(argv)

    if args.data_dir:
        session_review.PRO_REPLAYS_BASE = paths.pro_replays_base(args.data_dir)

    updated = 0
    for idx, path in enumerate(args.paths, 1):
        events.progress("rebaseline", idx, len(args.paths),
                        detail=os.path.basename(path))
        try:
            with open(path, encoding="utf-8") as f:
                payload = json.load(f)
        except Exception as e:
            events.log(f"  skip {os.path.basename(path)}: {e}", level="warn")
            continue

        changed = False
        for rec in payload.get("sets", []):
            baseline, n_games = session_review.load_pro_metrics(
                rec.get("my_char", ""), rec.get("opp_char", ""),
                stages=set(rec.get("stages", [])))
            if baseline != rec.get("pro_baseline") or n_games != rec.get("pro_games"):
                rec["pro_baseline"] = baseline
                rec["pro_games"] = n_games
                changed = True

        if changed:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            updated += 1

    events.log(f"Rebaselined {updated}/{len(args.paths)} session file(s).")
    events.result(updated=updated, scanned=len(args.paths))
    return 0


if __name__ == "__main__":
    main()
