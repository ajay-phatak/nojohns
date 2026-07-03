// Note templates — the Sessions / Matchups / Progress layout from the original
// melee-analysis slash command, rendered from session.json + trends.json.
// Pure functions: no fs, no electron. Generated regions are returned as
// NotePart blocks; user-editable seed content as text parts.

import type { SetRecord } from '../../preload/index.d'
import type { NotePart } from './merge'
import {
  TREND_METRICS,
  fmtMetric,
  fmtDist,
  fmtOpenedBy,
  fmtStringOutcomes,
  fmtStringByPct,
  fmtKillPcts,
  fmtMoveSafety,
  topFollowups,
  type Counts,
  type Nested
} from './format'

export interface Gameplan {
  opened_by?: Counts
  opening_sources?: Counts
  string_outcomes?: Nested
  string_by_pct?: Nested
  followups?: Nested
  your_kill_moves?: Counts
  their_kill_moves?: Counts
  kill_pcts?: Nested
  their_kill_pcts?: Nested
  punished_moves?: Counts
  move_usage?: Nested
  death_geo?: Counts
  kill_geo?: Counts
  oos_categories?: Counts
  eg_finishers?: Counts
  ledge_coverage?: Record<string, { n?: number; punished?: number }>
  reversals?: { n?: number; stocks?: number; dmg_sum?: number; kinds?: Counts; moves?: Counts }
  oos_samples?: number
  oos_resolved?: number
  oos_wait?: number
  eg_att?: number
  eg_free?: number
  recovery_att?: number
  recovery_deaths?: number
  neutral_for?: number
  neutral_against?: number
  dmg_per_opening_for?: number | null
  dmg_per_opening_against?: number | null
  center_win?: number | null
  center_loss?: number | null
}

export interface MetricTrend {
  label: string
  higher_is_better: boolean
  recent: number | null
  prior: number | null
  all_time: number | null
  direction: string
}

export interface CharTrend {
  n_sessions: number
  games: number
  metric_trends: Record<string, MetricTrend>
}

export interface MatchupTrend {
  wins: number
  losses: number
  games: number
  sessions: number
  headline: Record<string, number | null>
  gameplan?: Gameplan
}

export interface TrendsData {
  generated_at: string
  n_sessions: number
  n_sets: number
  char_trends: Record<string, CharTrend>
  matchups: Record<string, MatchupTrend>
}

const NOTES_SEED = '\n## Notes\n\n- \n'

const byKey = new Map(TREND_METRICS.map((m) => [m.key, m]))

// ---------------------------------------------------------------------------
// Session note — Sessions/YYYY-MM-DD.md
// ---------------------------------------------------------------------------

export function sessionFrontmatter(date: string, sets: SetRecord[]): Record<string, string> {
  const wins = sets.reduce((n, s) => n + s.wins, 0)
  const losses = sets.reduce((n, s) => n + s.losses, 0)
  const matchups = [...new Set(sets.map((s) => `${s.my_char} vs ${s.opp_char}`))]
  return {
    date,
    record: `${wins}-${losses}`,
    matchups: `[${matchups.join(', ')}]`,
    generator: 'nojohns'
  }
}

// "vs your trend" — this set against your recent per-character average, only
// where the move is bigger than the metric's noise epsilon. Top 3 by size.
function vsTrendLine(set: SetRecord, trends: TrendsData | null): string | null {
  const ct = trends?.char_trends?.[set.my_char]
  if (!ct || ct.n_sessions < 2) return null
  const moves: { text: string; score: number }[] = []
  for (const m of TREND_METRICS) {
    const mine = set.metrics[m.key]
    const recent = ct.metric_trends[m.key]?.recent
    if (mine === null || mine === undefined || recent === null || recent === undefined) continue
    const delta = (mine - recent) * (m.higherIsBetter ? 1 : -1)
    if (Math.abs(delta) <= m.eps) continue
    moves.push({
      text: `${m.label} ${fmtMetric(mine, m)} (recent ${fmtMetric(recent, m)}, ${delta > 0 ? 'better' : 'worse'})`,
      score: Math.abs(delta) / m.eps
    })
  }
  if (moves.length === 0) return null
  moves.sort((a, b) => b.score - a.score)
  return `vs your trend: ${moves
    .slice(0, 3)
    .map((x) => x.text)
    .join(' · ')}`
}

function setSection(set: SetRecord, trends: TrendsData | null): string {
  const lines: string[] = []
  lines.push(
    `## ${set.my_char} vs ${set.opp_char} — ${set.wins}-${set.losses} vs ${set.opp_code} (${set.n_games}g)`
  )
  lines.push('')
  lines.push(`Stages: ${[...new Set(set.stages)].join(', ')}`)
  lines.push(
    set.pro_baseline
      ? `Pro baseline: ${set.pro_games} games`
      : '_No pro baseline for this matchup yet._'
  )
  lines.push('')
  lines.push('| Metric | You | Pros | Gap |')
  lines.push('| --- | --- | --- | --- |')
  for (const m of TREND_METRICS) {
    const mine = set.metrics[m.key] ?? null
    const pro = set.pro_baseline?.[m.key] ?? null
    if (mine === null && pro === null) continue
    let gap = '—'
    if (mine !== null && pro !== null) {
      const d = mine - pro
      const good = m.higherIsBetter ? d >= 0 : d <= 0
      gap = Math.abs(d) < 0.05 ? '=' : `${d > 0 ? '+' : ''}${d.toFixed(1)} ${good ? '✓' : '✗'}`
    }
    lines.push(`| ${m.label} | ${fmtMetric(mine, m)} | ${fmtMetric(pro, m)} | ${gap} |`)
  }
  const trend = vsTrendLine(set, trends)
  if (trend) {
    lines.push('')
    lines.push(`_${trend}_`)
  }
  return lines.join('\n')
}

export function sessionNoteTemplate(
  date: string,
  sets: SetRecord[],
  trends: TrendsData | null
): NotePart[] {
  const body = [`# Session ${date}`, ...sets.map((s) => setSection(s, trends))].join('\n\n')
  return [
    { kind: 'block', id: 'session', body },
    { kind: 'text', text: NOTES_SEED }
  ]
}

// ---------------------------------------------------------------------------
// Matchup note — Matchups/<My> vs <Opp>.md
// ---------------------------------------------------------------------------

function gameplanBody(name: string, mu: MatchupTrend): string {
  const gp = mu.gameplan ?? {}
  const lines: string[] = []
  const a = (s: string): void => {
    lines.push(s)
  }
  const item = (label: string, value: string | null): void => {
    if (value && value !== '—') a(`- **${label}:** ${value}`)
  }

  a(`# ${name}`)
  a('')
  const h = mu.headline
  const hl = (k: string, fmt: (v: number) => string): string =>
    h[k] !== null && h[k] !== undefined ? fmt(h[k] as number) : '—'
  a(
    `**Record:** ${mu.wins}-${mu.losses} · ${mu.games} games · ${mu.sessions} session(s) — ` +
      `L-cancel ${hl('lcancel_pct', (v) => `${v.toFixed(0)}%`)} · ` +
      `Neutral ${hl('neutral_win_pct', (v) => `${v.toFixed(0)}%`)} · ` +
      `Kill rate ${hl('kill_rate_pct', (v) => `${v.toFixed(0)}%`)}`
  )
  a('')
  a('## Gameplan (running aggregate)')
  a('')
  a('### Neutral')
  const nf = gp.neutral_for ?? 0
  const na = gp.neutral_against ?? 0
  if (nf + na > 0) {
    item(
      'Neutral score',
      `${Math.round((100 * nf) / (nf + na))}% (${nf} openings for / ${na} against)`
    )
  }
  item('Opened by', fmtOpenedBy(gp.opened_by))
  item('You open with', fmtDist(gp.opening_sources))
  item('Punished on', fmtDist(gp.punished_moves))
  item('Move safety', fmtMoveSafety(gp.move_usage))
  a('')
  a('### Conversion')
  item('Strings end', fmtStringOutcomes(gp.string_outcomes))
  item('Convert by %', fmtStringByPct(gp.string_by_pct))
  for (const [opener, line] of topFollowups(gp.followups)) {
    item(`After ${opener}`, line)
  }
  const ykm = fmtDist(gp.your_kill_moves)
  const tkm = fmtDist(gp.their_kill_moves)
  if (ykm !== '—' || tkm !== '—') item('Kill moves', `you ${ykm}  |  them ${tkm}`)
  const ykp = fmtKillPcts(gp.kill_pcts)
  const tkp = fmtKillPcts(gp.their_kill_pcts)
  if (ykp !== '—' || tkp !== '—') item('Kill %', `you ${ykp}  |  die at ${tkp}`)
  const df = gp.dmg_per_opening_for
  const da = gp.dmg_per_opening_against
  if (df !== null && df !== undefined && da !== null && da !== undefined) {
    item('Dmg/opening', `you ${df.toFixed(1)}% / them ${da.toFixed(1)}%`)
  }
  const rv = gp.reversals
  if (rv?.n) {
    const kinds = rv.kinds ?? {}
    let line =
      `${rv.n} (eg-try ${kinds['edgeguard_try'] ?? 0} / combo-ext ${kinds['combo_extension'] ?? 0})` +
      `  cost ${((rv.dmg_sum ?? 0) / rv.n).toFixed(0)}%/ea`
    if (rv.stocks) line += ` + ${rv.stocks} stock(s)`
    if (rv.moves && Object.keys(rv.moves).length) line += `  via ${fmtDist(rv.moves, 3)}`
    item('Reversed', line)
  }
  a('')
  a('### Stocks')
  item('You die', fmtDist(gp.death_geo))
  item('You kill', fmtDist(gp.kill_geo))
  const ra = gp.recovery_att ?? 0
  if (ra) item('Recovery', `${Math.round((100 * (ra - (gp.recovery_deaths ?? 0))) / ra)}% back`)
  if (gp.eg_att) {
    let line = `free ${Math.round((100 * (gp.eg_free ?? 0)) / gp.eg_att)}% (${gp.eg_free ?? 0}/${gp.eg_att})`
    const fin = fmtDist(gp.eg_finishers, 3)
    if (fin !== '—') line += ` · finish ${fin}`
    item('Edgeguards given', line)
  }
  a('')
  a('### Positioning')
  const cw = gp.center_win
  const cl = gp.center_loss
  if (cw !== null && cw !== undefined && cl !== null && cl !== undefined) {
    item('Center stage', `${cw.toFixed(0)}% in wins / ${cl.toFixed(0)}% in losses`)
  }
  if (gp.oos_resolved) {
    const avgW = (gp.oos_wait ?? 0) / gp.oos_resolved
    item(
      'OOS response',
      `${gp.oos_samples ?? 0} shield hits · avg ${avgW.toFixed(1)}f · ${fmtDist(gp.oos_categories, 4)}`
    )
  }
  const lc = gp.ledge_coverage ?? {}
  const lcShown = Object.entries(lc)
    .filter(([, s]) => s.n)
    .sort((a2, b2) => (b2[1].n ?? 0) - (a2[1].n ?? 0))
    .slice(0, 5)
  if (lcShown.length) {
    item(
      'Ledge coverage',
      lcShown.map(([opt, s]) => `${opt} ${s.punished ?? 0}/${s.n}`).join(' · ')
    )
  }
  // Drop trailing blank section markers ("### X" followed by nothing).
  return lines
    .join('\n')
    .replace(/\n### [^\n]+\n(?=\n### |\n*$)/g, '\n')
    .trim()
}

/** One dated row per session; the writer upserts it into the existing log. */
export function matchupLogRow(date: string, sets: SetRecord[]): string {
  const wins = sets.reduce((n, s) => n + s.wins, 0)
  const losses = sets.reduce((n, s) => n + s.losses, 0)
  const games = sets.reduce((n, s) => n + s.n_games, 0)
  const opps = [...new Set(sets.map((s) => s.opp_code))].join(', ')
  return `- ${date} — ${wins}-${losses} vs ${opps} (${games}g)`
}

/** Upsert this session's row into the existing log block content (rows are
 *  `- YYYY-MM-DD — ...`, keyed and sorted by date; same-date rerun replaces). */
export function mergeLogRows(existingBody: string | null, newRow: string): string {
  const date = newRow.slice(2, 12)
  const rows = new Map<string, string>()
  for (const line of (existingBody ?? '').split('\n')) {
    if (/^- \d{4}-\d{2}-\d{2} /.test(line)) rows.set(line.slice(2, 12), line)
  }
  rows.set(date, newRow)
  const sorted = [...rows.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, l]) => l)
  return ['## Session log', '', ...sorted].join('\n')
}

export function matchupNoteTemplate(name: string, mu: MatchupTrend, logBody: string): NotePart[] {
  return [
    { kind: 'block', id: 'gameplan', body: gameplanBody(name, mu) },
    { kind: 'text', text: '' },
    { kind: 'block', id: 'log', body: logBody },
    { kind: 'text', text: NOTES_SEED }
  ]
}

// ---------------------------------------------------------------------------
// Progress note — Progress.md
// ---------------------------------------------------------------------------

function fmtTrendCell(key: string, v: number | null): string {
  if (v === null || v === undefined) return '—'
  const m = byKey.get(key)
  return m ? fmtMetric(v, m) : v.toFixed(1)
}

export function progressBody(trends: TrendsData): string {
  const lines: string[] = []
  const a = (s: string): void => {
    lines.push(s)
  }
  a('# Progress')
  a('')
  a(`_Updated ${trends.generated_at} · ${trends.n_sessions} sessions · ${trends.n_sets} sets_`)

  const chars = Object.entries(trends.char_trends ?? {}).sort((x, y) => y[1].games - x[1].games)
  for (const [ch, ct] of chars) {
    a('')
    a(`## ${ch} trajectory (${ct.n_sessions} sessions, ${ct.games}g)`)
    a('')
    if (ct.n_sessions < 2) {
      a('_Need at least 2 sessions for a trend — accumulating._')
      continue
    }
    a('| Metric | Recent | Prior | All-time | Direction |')
    a('| --- | --- | --- | --- | --- |')
    for (const [key, t] of Object.entries(ct.metric_trends)) {
      a(
        `| ${t.label} | ${fmtTrendCell(key, t.recent)} | ${fmtTrendCell(key, t.prior)} | ` +
          `${fmtTrendCell(key, t.all_time)} | ${t.direction} |`
      )
    }
  }

  const matchups = Object.entries(trends.matchups ?? {}).sort((x, y) => y[1].games - x[1].games)
  if (matchups.length) {
    a('')
    a('## Per-matchup record')
    a('')
    a('| Matchup | Record | Games | Sessions |')
    a('| --- | --- | --- | --- |')
    for (const [name, mu] of matchups) {
      a(`| [[${name}]] | ${mu.wins}-${mu.losses} | ${mu.games} | ${mu.sessions} |`)
    }
  }

  a('')
  a('## Current focuses')
  a('')
  const main = chars[0]
  const declining: { t: MetricTrend; key: string; score: number }[] = []
  if (main && main[1].n_sessions >= 2) {
    for (const [key, t] of Object.entries(main[1].metric_trends)) {
      if (t.direction !== 'declining' || t.recent === null || t.prior === null) continue
      const m = byKey.get(key)
      const eps = m?.eps ?? 1
      const delta = (t.recent - t.prior) * (t.higher_is_better ? 1 : -1)
      declining.push({ t, key, score: Math.abs(delta) / eps })
    }
  }
  declining.sort((x, y) => y.score - x.score)
  if (declining.length === 0) {
    a('- Nothing declining — keep stacking sessions.')
  } else {
    for (const { t, key } of declining.slice(0, 3)) {
      a(
        `- **${t.label}** declining: recent ${fmtTrendCell(key, t.recent)} vs prior ${fmtTrendCell(key, t.prior)}`
      )
    }
  }
  return lines.join('\n')
}

export function progressNoteTemplate(trends: TrendsData): NotePart[] {
  return [
    { kind: 'block', id: 'progress', body: progressBody(trends) },
    { kind: 'text', text: NOTES_SEED }
  ]
}
