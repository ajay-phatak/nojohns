"""Data-directory resolution for the engine.

All persistent state (pro replays, caches, history) lives under one data
directory. The app always passes --data-dir explicitly; the defaults below
only matter for running the engine by hand.

Frozen (PyInstaller) builds must never derive paths from __file__ — the
package is unpacked into a temp/resources dir that isn't writable or stable.
"""
import os
import sys


def default_data_dir():
    if getattr(sys, "frozen", False):
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, "nojohns")
    # Dev fallback: engine/ directory (sibling of the package), so hand-run
    # commands keep their state in the repo checkout, gitignored.
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def pro_replays_base(data_dir=None):
    return os.path.join(data_dir or default_data_dir(), "pro_replays")


def hf_cache_file(data_dir=None):
    return os.path.join(data_dir or default_data_dir(), "cache",
                        "hf_file_list_cache.json")
