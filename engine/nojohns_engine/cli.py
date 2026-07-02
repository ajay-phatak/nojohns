"""Single CLI entry point for the No Johns engine.

Subcommands map onto the vendored pipeline modules, preserving their
original argument semantics:

    nojohns-engine analyze <folder> --code ABCD#123 [--sets N] [--json p] [--out p] [--data-dir p]
    nojohns-engine ingest <session.json> --history <history.json> [--replace]
    nojohns-engine trends --history <history.json> [--out p] [--json p]
    nojohns-engine fetch --matchup SHEIK/FALCO [--codes ...] [--data-dir p]
    nojohns-engine doctor <folder> --code ABCD#123

The global --ndjson flag (any position) switches stdout to one-JSON-object-
per-line events for the Electron shell; without it the commands behave like
the original human-facing scripts.
"""
import sys

from . import events

USAGE = __doc__

COMMANDS = ("analyze", "ingest", "trends", "fetch", "doctor")


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)

    if "--ndjson" in argv:
        argv.remove("--ndjson")
        events.enabled = True

    if not argv or argv[0] in ("-h", "--help"):
        print(USAGE)
        return 0
    cmd, rest = argv[0], argv[1:]

    if cmd == "analyze":
        from . import session_review
        return session_review.main(rest)
    if cmd in ("ingest", "trends"):
        from . import coach
        return coach.main([cmd] + rest)
    if cmd == "fetch":
        from . import fetch
        return fetch.main(rest)
    if cmd == "doctor":
        from . import doctor
        return doctor.main(rest)

    events.error(f"Unknown command: {cmd} (expected one of {', '.join(COMMANDS)})",
                 code="unknown_command")
    return 2


if __name__ == "__main__":
    sys.exit(main())
