# No Johns — dev notes

Electron + React (electron-vite) shell around a vendored Python analysis
engine, shipped as a PyInstaller sidecar. Windows-first.

## Commands

- `npm run dev` — dev app. The `-w` flag is load-bearing: without it, main/
  preload changes don't restart Electron and the window calls IPC handlers
  that don't exist yet (symptom: blank screen).
- `npm run typecheck` — run after any TS change.
- `npm test` — vitest; covers the notes tier (sentinel merge idempotency +
  user-text preservation).
- `scripts/build-engine.ps1` — PyInstaller build → `engine/dist/nojohns-engine/`.
  Pinned to Python 3.12 (py-slippi is not validated on newer). Dev engine venv
  lives at `.venv/` (created manually, not by this script).
- `npm run build:win` — installer; expects the engine build to exist first.
- Release: bump `package.json` version, tag `v*`, push the tag — GitHub
  Actions builds and drafts the release. electron-builder often leaves a
  duplicate partial draft: publish the one WITH `latest.yml`, delete the stub.

## Architecture invariants

- Engine is spawn-per-job CLI (`engine/nojohns_engine/`, entry `cli.py`:
  analyze | ingest | trends | fetch | doctor | rebaseline). The app always
  passes `--ndjson` (one JSON event per line on stdout: progress/log/result/
  error) and `--data-dir` (all engine state lives under the app's userData).
  Engine stays stateless and arg-driven — config lives only in the app.
- Without `--ndjson` the engine keeps its original human CLI behavior — keep
  it that way; it's how engine changes get diffed against the source pipeline.
- The engine is VENDORED from a private analysis pipeline; module boundaries
  (game_review → set_review/session_review, coach) are kept identical so
  improvements port by diff. Don't restructure them casually. When engine
  analysis behavior changes, verify with a golden diff: run the original and
  the vendored engine on the same replays; session.txt must stay byte-identical
  (session.json may gain fields).
- `pro_baseline` in session.json is computed by the same `_metrics_dict` as
  the player's metrics — keep both sides of the comparison on one code path.
- Renderer never sees secrets or spawns processes; all engine/IPC work is in
  `src/main/`, typed in `src/preload/index.d.ts`.
- Notes (`src/main/notes/`) are regenerable views over session/trends JSON —
  never a data store. Generated regions sit between `<!-- nojohns:begin/end -->`
  sentinels; everything outside is user text and must survive rewrites
  byte-for-byte. `notes/format.ts` mirrors coach.py's render_trends one-liners —
  keep them in sync when the engine's renderer changes.

## Gotchas

- HuggingFace CDN intermittently connection-resets one HTTP client while
  another works — `fetch.py`'s `hf_get` tries requests then system curl each
  retry round. Don't "simplify" it to one transport.
- Dataset filename tokens: Game & Watch files are inconsistent ("Game _
  Watch" / "Game & Watch") — the filter token is the bare word `Game`.
  Sheik and Zelda share the `ZELDA_SHEIK` dataset dir, split by token.
- `src/renderer/src/characters.ts` `engineName` must match py-slippi enum
  names lowercased (that's what names `pro_replays/<my>_vs_<opp>` dirs).
- PowerShell 5.1: native stderr + `$ErrorActionPreference=Stop` = spurious
  failures (see build-engine.ps1's Invoke-Step pattern).
- Never commit personal data: replays, history.json, session outputs, real
  connect codes. The .gitignore blocks the file types; keep examples
  anonymized (ABCD#123).

## Roadmap state

Tier 1 shipped as v0.1.1; tier 2 (notes) shipped as v0.2.0. Phase C (AI coach)
implemented, unreleased: key via safeStorage ciphertext in userData/coach.key
(deliberately NOT in config.json so the renderer can never see or clobber
it); src/main/coach/client.ts calls the Anthropic API (claude-opus-4-8,
adaptive thinking, streamed over coach:delta, top-level cache_control,
usage→cost + monthly spend in userData/coach/spend.json, transcripts saved
there too); prompts/coach-system.md is bundled into main via ?raw import;
Coach tab (report + chat, per-response cost, model tier picker —
config.coachModel opus/sonnet/haiku, default sonnet since the engine already
did the analysis; per-model pricing in client.ts, --model on the CLI).
Second backend
(config.coachBackend='claude-cli', src/main/coach/cli.ts): spawns the user's
local Claude Code in headless -p stream-json mode so usage bills their
Pro/Max plan — prompt goes over stdin (never argv), --resume for chat,
ANTHROPIC_API_KEY stripped from child env so it can't silently bill credits,
CLI probed at ~/.local/bin + %APPDATA%\npm since Electron's PATH misses
them. Never lift Claude Code's OAuth token for direct API calls (ToS).
Remaining before release:
E2E with a real key (verify cache_read_input_tokens > 0 on chat turns),
iterate the prompt on real sessions, decide the soft spend-warning UX.
Deferred: code signing (Azure Trusted Signing), full auto-update via
electron-updater (blocked on signing).
