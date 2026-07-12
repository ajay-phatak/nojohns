# Design prompt (paste as-is into a Claude design session)

---

You are doing a visual redesign for **No Johns**, a Windows desktop app
(Electron + React) for Super Smash Bros. Melee players. It analyzes the
player's Slippi netplay replays, compares their stats against pro baselines,
and includes an AI coach that suggests focuses to practice. The audience is
competitive Melee players — think Slippi/start.gg adjacent: dark, sharp,
a little esports, but clean and information-dense, not gamer-RGB.

## What exists today

Dark theme only. No design system — a flat `#1b1b1f` page, default-styled
buttons/inputs with `#555` borders, and gray-on-gray text. Every screen:

1. **App shell** — page with 24px padding; top nav = row of 5 plain buttons
   (Dashboard, Matchups, Pro Replays, Coach, Settings), active one just has a
   blue background; occasional dismissible update banner.
2. **Dashboard** — heading, subtitle line ("Fox / Falco · ABCD#123"), an
   "Analyze recent games" button with a set-count dropdown and live progress
   text, a dashed-border setup hint, then a list of clickable **session cards**:
   date, win–loss record (green/red), matchups played (muted).
3. **Session report** (drill-in from a session card) — per-set sections with a
   **metrics table**: Metric / You / Pros / Gap, where Gap is colored
   good/bad. The core "am I improving" surface.
4. **Matchups** — one card per matchup (e.g. "Fox vs Marth") with trend
   one-liners.
5. **Pro replays** — table of pro-replay datasets (name, downloaded count,
   fetch button) with progress text while downloading.
6. **Coach** — the richest screen: header row (heading + "Coach my latest
   session" button + model dropdown); chat transcript as bordered cards (user
   turns slightly tinted, tiny role label, tiny cost line underneath);
   streaming response; then **focus cards** (green-bordered): bold gap name,
   muted evidence sentence, an editable textarea with the suggested plan, and
   a "Save focuses to notes" action. Follow-up chat input + Send at the bottom.
7. **Settings** — labeled form: folder pickers, text inputs, selects, an
   API-key field, save button.
8. **Onboarding** — 3 numbered steps (replay folder, connect code, character
   picks), finish button.

Current semantic colors to re-derive (values are placeholders, roles matter):
positive/win `#6e9`, negative/loss/error `#f88`, live-progress `#8fc`,
active-nav/primary `#26a`, warning `#c94`, info banner blue; text tiers
`#eee` / `#aaa` / `#888` / `#666`; card borders `#333`, control borders `#555`.

## Constraints

- **Reskin, not rewrite**: the React structure stays; deliver plain CSS only.
  No Tailwind, no component libraries, no fonts that require network fetches
  at runtime (system stack or a bundled-friendly choice like Inter is fine).
- Dark theme only. Desktop window, main content column ~720–900px.
- Information-dense screens (tables, stat lines) must stay scannable — this is
  a stats tool first.
- Keep it implementable by hand in an afternoon: one token sheet, one
  stylesheet, no bespoke illustrations.

## Deliverables

1. **Design direction** — a short rationale: personality, how it nods to Melee
   without being kitsch.
2. **`tokens.css`** — CSS custom properties: full color system (backgrounds,
   3–4 text tiers, borders, primary/accent, semantic win/loss/progress/
   warning/info), spacing scale, radii, type scale (sizes/weights/line-heights),
   font stack, shadows/elevation if any.
3. **`app.css`** — classes for the shared components: nav (with active state),
   button (primary/default/small/disabled), card (default, clickable-hover,
   focus-card accent, user-chat tint), data table, form controls
   (input/select/textarea/label), banners (info/error/warning), callout
   (setup hint), status text (progress/success/error), cost-line micro-text,
   headings.
4. **Static HTML mocks** of the **Dashboard** and **Coach** screens using
   those exact tokens/classes, with realistic Melee content (e.g. "Fox vs
   Marth", "3–2", metrics like "L-cancel rate", "Openings per kill"), so the
   design can be judged before implementation. Use anonymized connect codes
   like ABCD#123.

Make the mocks self-contained (inline the two stylesheets) so they render as
a single file.
