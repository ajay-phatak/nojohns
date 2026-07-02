"""PyInstaller entry point for the engine exe."""
import sys

from nojohns_engine.cli import main

if __name__ == "__main__":
    sys.exit(main())
