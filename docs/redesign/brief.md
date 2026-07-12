# v0.4.0 visual redesign — brief & plan

Working doc for the redesign release. `design-prompt.md` next to this file is the
self-contained prompt to hand to a Claude design session; this file is the
inventory it was built from plus the implementation plan for bringing the new
design back into the app.

## Current state (v0.3.0)

The app has essentially **no design system**: ~100 lines of leftover
electron-vite starter CSS ([base.css](../../src/renderer/src/assets/base.css),
[main.css](../../src/renderer/src/assets/main.css)) plus ~130 ad-hoc inline
`style={{}}` blocks across 8 files. Dark theme only. No component library, no
icons (two emoji: 📝 🤖), no shared components (`src/renderer/src/components/`
is empty).

### Surfaces (every screen)

| Surface | File | Visual elements |
|---|---|---|
| App shell | `App.tsx` | 24px padded page, horizontal nav of 5 plain buttons (active = `#26a` bg), dismissible blue update banner |
| Dashboard | `views/Dashboard.tsx` | h2 + subtitle (chars · connect code), "Analyze" button + set-count select + live progress text, dashed-border setup callout, clickable session cards (date, W–L colored, matchup list) |
| Session report | `views/SessionReport.tsx` | h2 title, per-set sections, metrics `<table>` (Metric / You / Pros / Gap, gap colored good/bad), notes button |
| Matchups | `views/Matchups.tsx` | per-matchup cards with h3, trend one-liners |
| Pro replays | `views/ProReplays.tsx` | status `<table>` (dataset / count colored / action), fetch buttons, progress text |
| Coach | `views/Coach.tsx` | header row (h2 + report button + model select), chat turns as bordered cards (user turns tinted `#20242c`), streaming card, green-bordered editable **focus cards** (bold gap + gray evidence + textarea plan + reset button), save row, follow-up input + Send, tiny gray cost line under responses |
| Settings | `views/Settings.tsx` | labeled form (text inputs, selects, folder pickers, API-key field), save button |
| Onboarding | `views/Onboarding.tsx` | 3 numbered h2 steps (replay folder, connect code, characters), finish button |

### Current color vocabulary (semantic mapping)

| Role | Value(s) |
|---|---|
| Page background | `#1b1b1f` |
| Raised/user-turn background | `#20242c`, `#26262b` (inputs), `#2f2f35` (buttons) |
| Borders | `#333` (cards), `#444` (dashed callouts), `#555` (controls) |
| Text | `#eee` primary, `#aaa` secondary, `#888` muted, `#666` faint (cost lines) |
| Positive / win / good gap | `#6e9`, focus-card border `#2a5` |
| Negative / loss / error | `#f88`, error bg `#511` |
| In-progress / live status | `#8fc` |
| Active nav / primary-ish | `#26a` |
| Info banner | bg `#1d3a5f`, border `#2a6ac2`, link `#7bf` |
| Warning | `#c94` |

Typography: `system-ui` (shell) / Inter stack (base.css), sizes 11–14px plus
default h2/h3. Radii: 4px controls, 6–8px cards.

## Plan

1. **(done)** Inventory above; self-contained design prompt in `design-prompt.md`.
2. **(done)** Pre-conversion: all appearance styling moved out of the views
   into semantic classes in `src/renderer/src/assets/app.css`, which currently
   reproduces the v0.3.0 look exactly. Verified pixel-identical via Playwright
   `_electron` screenshots of every tab. Also fixed the window title
   ("Electron" → "No Johns") and set the BrowserWindow `backgroundColor`.
3. **(done)** Design pass — the "Ranked" variant (cyan accent, clipped-corner
   geometry, oklch tokens, mono stat styling). Deliverables (tokens.css,
   app.css, HTML mocks of Dashboard + Coach) are in
   `No Johns Visual Redesign.zip` next to this file.
4. **(done)** Implementation — `assets/tokens.css` added verbatim; `main.css`
   rewritten as the element base (body, headings, button, input/select/
   textarea; h4 renders as an uppercase eyebrow for Settings section labels);
   `app.css` rewritten mapping the design onto the existing class vocabulary;
   starter `base.css` deleted. JSX changes were small: App shell restructured
   (top nav bar with `.brand` + centered `.main` column), `btn-primary` on
   key CTAs, `record`/`matchups`/`subtitle`/`eyebrow`/`mono` classes where
   the design uses mono/uppercase treatments. BrowserWindow backgroundColor
   updated to `#07090d` (resolved from the `--bg-0` oklch token via canvas).
   Verified per-tab (incl. session-report drill-in) with the Playwright
   `_electron` screenshot pattern; typecheck, lint, and tests pass. Gotcha
   found: `.nav button:hover` needed `:not(.active)` or it out-specifies the
   active state. Not visually verified: Coach chat/focus-card states (need a
   live report) and Onboarding — check on next real use.
5. **Release** — bump to v0.4.0, tag, publish the draft **with** `latest.yml`.

### Implementation constraints (also baked into the prompt)

- Keep React structure/behavior; this is a reskin, not a rewrite. No CSS
  framework, no component library, no build-config changes.
- Dark theme only (Slippi/Melee audience), Windows desktop, content column
  ~720–900px.
- Renderer-only change — main/preload/engine untouched.
