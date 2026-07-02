#!/usr/bin/env python3
"""
Downloads matchup replays from the HuggingFace tournament dataset,
optionally filtering for specific connect codes.

The dataset is organized by character directory. --matchup specifies which
directory to search and (optionally) which opponent to filter for within it.

Usage:
    nojohns-engine fetch --matchup SHEIK/FALCO --out pro_replays/sheik_vs_falco
    nojohns-engine fetch --matchup FALCO --out pro_replays/falco
    nojohns-engine fetch --matchup SHEIK/FALCO --codes "JM#0" --dry-run
"""

import os
import json
import argparse
import ssl
import tempfile
import time

import requests
import urllib3
from requests.adapters import HTTPAdapter

# verify=False is deliberate (see _TLS12Adapter); don't spam stderr about it.
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from . import events, paths
from .game_review import get_netplay_info

DATASET  = "erickfm/slippi-public-dataset-v3.7"
BASE_URL = f"https://huggingface.co/datasets/{DATASET}/resolve/main"
API_URL  = f"https://huggingface.co/api/datasets/{DATASET}/tree/main"

MAX_RETRIES = 3
RETRY_DELAYS = [3, 10, 30]


class _TLS12Adapter(HTTPAdapter):
    """Cap TLS at 1.2 and skip verification.

    Windows Schannel rejects the HF CDN cert chain with TLS 1.3; the original
    pipeline shelled out to `curl --insecure --tls-max 1.2`. This adapter is
    the bundleable equivalent.
    """

    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


_session = None


def _get_session():
    global _session
    if _session is None:
        _session = requests.Session()
        _session.mount("https://", _TLS12Adapter())
    return _session


def hf_get(url, retries=MAX_RETRIES):
    """Fetch URL bytes, retrying with backoff on transient failures."""
    last_err = None
    for attempt in range(retries):
        try:
            resp = _get_session().get(url, timeout=120, verify=False)
            resp.raise_for_status()
            return resp.content
        except Exception as e:
            last_err = e
        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
        events.log(f"  [retry {attempt+1}/{retries}] {last_err} — waiting {delay}s",
                   level="warn")
        time.sleep(delay)
    raise last_err


# Maps dataset directory names to the string that appears in filenames
CHAR_FILENAME_MAP = {
    "CPTFALCON":   "Captain Falcon",
    "ZELDA_SHEIK": "Sheik",
    "ICE_CLIMBERS": "Ice Climbers",
    "GAMEANDWATCH": "Game And Watch",
}


def _load_cache(cache_file):
    if os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            return json.load(f)
    return {}


def list_matchup_files(char_dir, filter_char=None, cache=True, cache_file=None):
    """Return file paths in char_dir, optionally filtered by opponent name."""
    cache_file = cache_file or paths.hf_cache_file()
    cache_key = f"{char_dir}_{filter_char or 'ALL'}"

    if cache:
        cached = _load_cache(cache_file)
        if cache_key in cached:
            events.log(f"  (using cached file list: {len(cached[cache_key])} files)")
            return cached[cache_key]

    url = f"{API_URL}/{char_dir}?recursive=false"
    data = json.loads(hf_get(url))
    all_paths = [f["path"] for f in data if f.get("path", "").endswith(".slp")]

    if filter_char:
        import re
        # Resolve alias (e.g. CPTFALCON → "Captain Falcon")
        search_term = CHAR_FILENAME_MAP.get(filter_char.upper(), filter_char)
        # Also resolve the directory char for ditto detection
        dir_char_term = CHAR_FILENAME_MAP.get(char_dir.upper(), char_dir.capitalize())
        is_ditto = search_term.lower() == dir_char_term.lower()

        pattern = re.compile(r"(?<![A-Za-z])" + re.escape(search_term) + r"(?![A-Za-z])", re.IGNORECASE)
        if is_ditto:
            # Ditto: require the character name to appear at least twice in the filename
            paths_ = [p for p in all_paths if len(pattern.findall(os.path.basename(p))) >= 2]
        else:
            # Word-boundary match against filename only (avoids Falco matching Falcon)
            paths_ = [p for p in all_paths if pattern.search(os.path.basename(p))]
    else:
        paths_ = all_paths

    if cache:
        existing = _load_cache(cache_file)
        existing[cache_key] = paths_
        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
        with open(cache_file, "w") as f:
            json.dump(existing, f, indent=2)
        events.log(f"  (cached {len(paths_)} file paths to {cache_file})")

    return paths_


def url_encode_path(hf_path):
    """Encode path for HuggingFace URL, preserving slashes."""
    safe = "/:@!$&'()*,;="  # chars safe in URL path
    return "".join(
        c if (c.isalnum() or c in safe or c in "-._~") else f"%{ord(c):02X}"
        for c in hf_path
    )


def download_and_check(hf_path, target_codes, out_dir, dry_run=False):
    """Download a file, check if it contains a target code, keep or discard.

    If target_codes is empty, save all parseable files (no-filter mode).
    """
    url = f"{BASE_URL}/{url_encode_path(hf_path)}"
    filename = os.path.basename(hf_path)

    # Skip files we already have — makes re-fetch incremental.
    if not dry_run and os.path.exists(os.path.join(out_dir, filename)):
        events.log(f"  have: {filename}")
        return True

    try:
        data = hf_get(url)
    except Exception as e:
        events.log(f"  SKIP (download error): {filename} — {e}", level="warn")
        return False

    with tempfile.NamedTemporaryFile(suffix=".slp", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        info = get_netplay_info(tmp_path)
        codes_in_file = {v["code"].upper() for v in info.values() if v.get("code")}

        if target_codes:
            matched = codes_in_file & {c.upper() for c in target_codes}
            keep = bool(matched)
            label = ', '.join(matched) if matched else None
        else:
            # No-filter mode: keep all parseable files
            keep = True
            label = ', '.join(codes_in_file) if codes_in_file else "no codes"

        if keep:
            if not dry_run:
                os.makedirs(out_dir, exist_ok=True)
                dest = os.path.join(out_dir, filename)
                os.replace(tmp_path, dest)
                events.log(f"  SAVED ({label}): {filename}")
            else:
                events.log(f"  MATCH ({label}): {filename}")
            return True
        else:
            events.log(f"  skip: {filename} — codes: {codes_in_file or 'none'}")
            return False
    except Exception as e:
        events.log(f"  SKIP (parse error): {filename} — {e}", level="warn")
        return False
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="nojohns-engine fetch",
        description="Fetch pro player replays from HuggingFace dataset.")
    parser.add_argument("--matchup", type=str, required=True,
                        help="Character directory, optionally with opponent: FALCO or SHEIK/FALCO")
    parser.add_argument("--codes",   type=str, default="",
                        help="Comma-separated connect codes to filter for (e.g. 'JM#0,CODY#007'). Omit to save all.")
    parser.add_argument("--out",     type=str, default="pro_replays",
                        help="Output directory for matched replays")
    parser.add_argument("--dry-run", action="store_true",
                        help="List matches without saving")
    parser.add_argument("--no-cache", action="store_true",
                        help="Force fresh API listing (don't use cached file list)")
    parser.add_argument("--list-only", action="store_true",
                        help="Just list and cache the file paths, don't download")
    parser.add_argument("--limit", type=int, default=None,
                        help="Stop after saving this many replays")
    parser.add_argument("--data-dir", type=str, default=None,
                        help="Base data directory for the file-list cache "
                             "(default: engine dir in dev, %%APPDATA%%\\nojohns when frozen)")
    args = parser.parse_args(argv)

    cache_file = paths.hf_cache_file(args.data_dir)

    # Parse matchup: "SHEIK/FALCO" → dir=SHEIK, filter=Falco
    #                "FALCO"       → dir=FALCO, filter=None
    if "/" in args.matchup:
        char_dir, opp = args.matchup.upper().split("/", 1)
        filter_char = opp.capitalize()
    else:
        char_dir = args.matchup.upper()
        filter_char = None

    target_codes = [c.strip() for c in args.codes.split(",") if c.strip()]
    matchup_str = f"{char_dir}/{filter_char}" if filter_char else char_dir
    if target_codes:
        events.log(f"Searching {matchup_str} for codes: {target_codes}")
    else:
        events.log(f"Searching {matchup_str} — no code filter (saving all parseable files)")

    files = list_matchup_files(char_dir, filter_char=filter_char,
                               cache=not args.no_cache, cache_file=cache_file)
    events.log(f"Found {len(files)} files in dataset")

    if args.list_only:
        for p in files:
            events.log(f"  {p}")
        events.result(listed=len(files))
        return 0

    found = 0
    for idx, hf_path in enumerate(files, 1):
        events.progress("fetch", idx, len(files), detail=os.path.basename(hf_path))
        if download_and_check(hf_path, target_codes, args.out, dry_run=args.dry_run):
            found += 1
            if args.limit and found >= args.limit:
                events.log(f"Reached --limit {args.limit}; stopping.")
                break

    events.log(f"Done. {found}/{len(files)} files matched.")
    if found > 0 and not args.dry_run:
        events.log(f"Saved to: {os.path.abspath(args.out)}")
    events.result(found=found, scanned=len(files), out=os.path.abspath(args.out))
    return 0


if __name__ == "__main__":
    main()
