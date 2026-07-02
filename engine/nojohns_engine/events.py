"""NDJSON event stream for the No Johns app.

When enabled (--ndjson on the CLI), every event is one JSON object per line
on stdout, so the Electron shell can stream progress without scraping text:

    {"event": "progress", "stage": "parse", "current": 3, "total": 12, "detail": "Game_...slp"}
    {"event": "log", "level": "info", "msg": "..."}
    {"event": "result", ...}
    {"event": "error", "code": "no_slp_files", "msg": "..."}

When disabled (default), progress/result are silent no-ops and log() falls
back to plain print, preserving the original human-facing CLI behavior.
"""
import json
import sys

enabled = False


def _write(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def progress(stage, current, total, detail=None):
    if not enabled:
        return
    obj = {"event": "progress", "stage": stage, "current": current, "total": total}
    if detail is not None:
        obj["detail"] = detail
    _write(obj)


def log(msg, level="info"):
    if enabled:
        _write({"event": "log", "level": level, "msg": msg})
    else:
        print(msg)


def result(**fields):
    if not enabled:
        return
    _write({"event": "result", **fields})


def error(msg, code=None, **fields):
    if enabled:
        obj = {"event": "error", "msg": msg}
        if code:
            obj["code"] = code
        obj.update(fields)
        _write(obj)
    else:
        print(msg, file=sys.stderr)
