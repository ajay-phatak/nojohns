# No Johns

**Data instead of excuses.** No Johns is a desktop coaching app for Super Smash Bros. Melee that analyzes your [Slippi](https://slippi.gg) replays and shows you exactly where your game falls short of top players — per matchup, per session, over time.

> "Johns" — Melee slang for excuses. This app ends them.

## What it does

Point No Johns at your Slippi replay folder and it:

1. **Compares you to the pros.** Downloads professional replays for the matchups you play and builds per-matchup baselines. After each session you get a report of your stats vs. the pro ceiling — neutral, punish game, edgeguards, tech skill, ledge play — with the gaps highlighted.
2. **Tracks your trajectory.** Every session feeds a long-term history, so you can see which gaps are closing and which habits keep costing you stocks.
3. **Writes your matchup notes** *(optional)*. Point it at any folder — including an Obsidian vault — and it maintains markdown notes per matchup and per session: computed gaps filled in, blank sections for your own observations.
4. **Coaches you** *(optional, bring your own key)*. Add an Anthropic API key and get a written coaching report after each session, plus a chat panel to dig into the details.

Tiers 1–2 require no accounts, no keys, nothing but your replays.

## Download

**[⬇ Get the latest release (Windows)](https://github.com/ajay-phatak/nojohns/releases/latest)** — download the `-setup.exe` under Assets and run it.

> **Windows SmartScreen note:** the installer isn't code-signed yet, so Windows will warn about an unknown publisher. Click **More info → Run anyway**. Signing is planned.

Early release — Mac/Linux planned. If something breaks, [open an issue](https://github.com/ajay-phatak/nojohns/issues).

## Architecture (for the curious)

Electron + React shell around a Python analysis engine (bundled — no Python install needed). The engine parses `.slp` files with [py-slippi](https://github.com/hohav/py-slippi) and pulls pro replays from a public HuggingFace dataset. All your data stays local.

## License

[MIT](LICENSE)
