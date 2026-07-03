> Original implementation plan, written 2026-07-02 before the first line of code.
> Kept as a design record — see CLAUDE.md for current state.

# No Johns — Melee Coaching Desktop App

## Context
The Melee Analysis project (Python pipeline + Claude Code slash command) works well as a personal tool. Goal: package it as a downloadable Windows desktop app other players can use, in a **new repo** (public on GitHub from day one, MIT license). Named **No Johns** — Melee slang for excuses; the app replaces them with data.

Three tiers, progressive disclosure in one app:
1. **Tier 1 (core, ships first, zero accounts):** pick Slippi folder + connect code → fetch pro replays per matchup (strongly recommended, not required) → per-session stat reports with you-vs-pro gaps + long-term trends.
2. **Tier 2 (notes):** point at any local folder (Obsidian vault works since it's just a folder) → app writes markdown note stubs per matchup/session: computed gaps filled in, blank sections for the player's own observations. Plain filesystem writes, no Obsidian API.
3. **Tier 3 (AI coach):** paste an Anthropic API key → generated coaching report after a session + follow-up chat panel.

## Locked decisions
- **Stack:** Electron + TypeScript + React (electron-vite), electron-builder NSIS installer. Windows first, architected for Mac/Linux later.
- **Engine:** bundle the existing ~4.8k-line Python pipeline (no TS rewrite — months of tuned state-machine logic). PyInstaller **one-dir** build (fewer AV false positives than one-file), pinned **Python 3.12** (system 3.14 may not be supported by py-slippi — verify day 1).
- **IPC:** spawn-per-job CLI sidecar (not long-running JSON-RPC) — every operation is batch-shaped, caches live on disk. Engine emits **NDJSON events on stdout** (`progress` / `log` / `result` / `error`); Electron main wraps it in an `EngineJob` class (spawn, parse, cancel = kill).
- **Tier 3:** direct Anthropic Messages API via official TS SDK from the main process (not Agent SDK — no tool loop needed; the pipeline already produces the context).

## Repo structure

```
nojohns/
├── package.json / electron-builder.yml / electron.vite.config.ts
├── src/
│   ├── main/          # index.ts, engine/ (spawn+NDJSON+job queue), config.ts,
│   │                  # slippi-detect.ts, notes/ (tier 2), coach/ (tier 3), ipc.ts
│   ├── preload/index.ts
│   ├── renderer/      # React: views/ (Onboarding, Dashboard, SessionReport,
│   │                  #   Matchups, ProReplays, Coach, Settings) + components/
│   └── shared/types.ts   # session.json / trends.json / engine-event types
├── engine/            # vendored + adapted Python pipeline
│   ├── pyproject.toml    # deps: py-slippi, requests; dev: pyinstaller
│   ├── nojohns_engine/   # cli.py, events.py, paths.py,
│   │                     # game_review / set_review / session_review / coach / fetch
│   │   └── tests/        # golden-file tests vs fixture .slp sets
│   └── nojohns-engine.spec   # onedir, --noupx
├── prompts/coach-system.md   # tier 3 prompt (adapted from commands/melee-analysis.md)
├── scripts/build-engine.ps1
└── .github/workflows/release.yml
```

## Python engine adaptation (vendor = copy, not submodule)
Copy the 5 scripts from `Melee Analysis`; the app repo owns them afterward (old repo stays the personal playground; port improvements by diff). Keep module boundaries identical. Changes:

1. **Package + single CLI** (`cli.py`): subcommands `analyze | ingest | trends | fetch | doctor`, preserving current arg semantics. Engine stays stateless/arg-driven — config lives only in the app's config.json.
2. **Path injection:** `session_review.py:47` has script-relative `PRO_REPLAYS_BASE` (breaks under PyInstaller). Add `--data-dir`; route `pro_replays/`, `hf_file_list_cache.json`, `history.json`, outputs through `paths.py`. `.pro_cache.pkl` stays inside each matchup dir.
3. **Replace curl subprocess with `requests`** in fetch ([fetch_pro_replays.py:33](fetch_pro_replays.py:33) `CURL_BASE`): HTTPAdapter with SSL context capped at TLS 1.2 + `verify=False` retry fallback (mirrors today's workaround). System curl.exe fallback path optional.
4. **NDJSON progress** (`events.py`): per-file fetch ticks, per-.slp parse ticks (baseline builds parse dozens of pro games — minutes), stage events. Replace bare prints.
5. **New `doctor` subcommand:** validates replay folder, counts recent .slp, confirms connect code appears — powers onboarding in one spawn.
6. **Not ported to Python:** tier-2 markdown generation → TypeScript in `src/main/notes/` (presentation layer over session/trends JSON). Connect-code auto-suggestion → `slippi-detect.ts` reads `%APPDATA%\Slippi Launcher\...\direct-codes.json`.

## App data — `%APPDATA%\nojohns\`
`config.json` (paths, code, character, matchups, notes dir, model prefs) · `history.json` · `sessions\` (archived session-*.json/.txt) · `trends.json/.txt` · `pro_replays\<mu>\` (+ .pro_cache.pkl) · `cache\hf_file_list_cache.json` · `coach\` (reports + chat transcripts) · `logs\`.
API key: encrypted via Electron `safeStorage` (DPAPI), ciphertext in config.json; key never enters the renderer. Onboarding offers "import existing history.json" (migration path for the author's live data).

## UI (7 views)
1. **Onboarding wizard:** replay folder (auto-detect → browse; validated via `doctor`) → connect code (dropdown from direct-codes.json) → main character + top matchups → recommended pro-replay download with progress (skippable) → Dashboard.
2. **Dashboard:** recent sessions, "Analyze new games" (analyze→ingest→trends chained job + progress toast), focuses + headline trend arrows. Tier 2/3 appear as locked CTA cards until configured.
3. **Session Report:** per-set cards, you-vs-pro metric rows with red/green gap chips, expandable sections mirroring session.txt blocks; collapsible raw report; "Write notes" / "Coach me" buttons.
4. **Matchups:** per-matchup record, gameplan tables (openers/enders, move safety, kill percents, ledge coverage), link to note file.
5. **Pro Replay Manager:** matchup × replay-count grid, fetch with live progress, pro-code filter, rebuild-baseline action, disk usage + per-matchup delete.
6. **AI Coach panel:** streaming report + chat thread, per-response cost readout.
7. **Settings:** paths, code, character, API key (masked), model + spend guardrails, versions, open logs.

## Tier 3 details
- **Prompt:** adapt `commands/melee-analysis.md` metric-interpretation guidance (two reference frames: pro baseline vs own trend; move safety / punish trees / reversals / OOS / ledge coverage semantics) into `prompts/coach-system.md`; strip orchestration steps; add persona + output shape (headline, ≤3 focuses, drills).
- **Calls:** report = one streamed request (system prompt with `cache_control`; user = session.txt + trends.txt — compact text, no JSON in v1). Chat = multi-turn on the same array; stable cached prefix. Model `claude-opus-4-8`, adaptive thinking, streaming deltas over IPC. Handle refusal/rate-limit visibly.
- **Guardrails:** user-initiated only; context capped (trends.txt trimmed); max_tokens ~4K report / ~2K turn; usage-based cost display; local monthly-spend counter with soft warning.

## Build / release
- `scripts/build-engine.ps1`: Python 3.12 venv → pyinstaller onedir → `engine/dist/`; shipped via electron-builder `extraResources`; prod path `process.resourcesPath/engine/nojohns-engine.exe`, dev = `python -m nojohns_engine`.
- CI: GitHub Actions windows-latest — build engine → npm build → electron-builder, publish draft release on tags.
- **Code signing: defer** (document SmartScreen "Run anyway"; submit installer to Microsoft malware portal; Azure Trusted Signing as the later upgrade). **Auto-update: defer** (passive GitHub Releases version check in v1).

## Phases
**Walking skeleton first:** Electron shell + dev-mode Python spawn → `analyze` hardcoded folder → parse NDJSON → ugly metrics table → repeat with PyInstaller exe. De-risks both integration seams before product work.

**Phase A — Tier 1 end-to-end:** (1) day-1 risk check: py-slippi on 3.12 + PyInstaller hello-world parsing one .slp; (2) vendor + refactor engine (package, cli, paths, events, doctor, golden-file test); (3) walking skeleton; (4) main-process plumbing (config, slippi-detect, EngineJob, typed IPC); (5) fetch via requests + Pro Replay Manager; (6) onboarding wizard; (7) Session Report + Dashboard + chained analyze job; (8) Matchups view; (9) Settings, build scripts, installer, CI. **Ship.**

**Phase B — Tier 2 notes:** TS note templates ported from the slash command's Sessions/Matchups/Progress layout; user-authored regions preserved between sentinel HTML comments on rewrite; folder picker + auto-write toggle; idempotency tests (mirror coach.py ingest dedup).

**Phase C — Tier 3 coach:** prompt adaptation (iterate against the author's real session/trends files); Anthropic client in main (safeStorage, streaming, caching, usage); Coach panel UI; guardrails + error surfaces. Optional: signing + auto-update.

## Verification
- **Engine:** golden-file tests — fixture .slp set → expected session.json (guards the vendor/refactor against regressions vs the original scripts; run original vs adapted on the same replays and diff).
- **Skeleton seams:** dev-spawn and PyInstaller-exe paths both produce identical NDJSON for the same job.
- **Tier 1 E2E:** fresh Windows VM (or clean user profile): install from NSIS installer → onboarding with a real Slippi folder → fetch one matchup → analyze a session → gaps render; verify `%APPDATA%\nojohns` layout and second-run idempotency (re-analyze doesn't duplicate history).
- **Tier 2:** write notes into a real Obsidian vault; edit the blank sections; re-run analysis; confirm user text preserved.
- **Tier 3:** real API key; verify streaming, `cache_read_input_tokens` > 0 on chat turns, cost readout matches usage fields.

## Risks (flagged, mitigations in design)
- **HuggingFace dataset** (`erickfm/slippi-public-dataset-v3.7`) could vanish/gate → dataset ID configurable; graceful "baseline unavailable" degradation; check dataset license/ToS before launch.
- **py-slippi Python-version ceiling** → pin build to 3.12, verify day 1.
- **Baseline build time** (minutes of parsing) → always a cancellable background job with per-game progress; never blocks onboarding.
- **PyInstaller AV false positives** → onedir + no-UPX + Microsoft submission + docs page.
- **PRO_CACHE_VERSION bumps after updates** → explicit "rebuilding baselines" job, not silent latency.
- **Slippi Launcher file locations vary** → detection is best-effort, manual fallback everywhere.
- **Open (defer to Phase A implementation):** `analyze` default of "new files since last run" (`--since` flag) vs current `--sets N`.

## Cross-repo note
Per existing memory: when the live melee-analysis skill changes, the anonymized copy in this repo's `commands/` gets synced. Once nojohns exists, engine improvements flow the other way too (old repo → diff → nojohns/engine) — worth a line in nojohns' CONTRIBUTING/README dev notes.
