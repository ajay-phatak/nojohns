// Gameplan/trend formatting ported from the engine's coach.py render_trends —
// same terse one-liners so notes read like session.txt / trends.txt. Keep the
// two in sync when the engine's renderer changes.

export type Counts = Record<string, number>
export type Nested = Record<string, Counts>

export interface MetricDef {
  key: string
  label: string
  higherIsBetter: boolean
  eps: number // polarity-adjusted change below this reads as "stable"
  decimals: number
  unit: string
}

// Mirrors coach.py METRICS (labels/eps) — drives trend tables + "vs your
// trend" lines in notes.
export const TREND_METRICS: MetricDef[] = [
  {
    key: 'lcancel_pct',
    label: 'L-cancel %',
    higherIsBetter: true,
    eps: 2.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'shield_s',
    label: 'Shield time/game',
    higherIsBetter: false,
    eps: 0.5,
    decimals: 1,
    unit: 's'
  },
  {
    key: 'galint_keep_pct',
    label: 'Ledgedash % keep inv',
    higherIsBetter: true,
    eps: 3.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'ledgedash_fall_avg',
    label: 'Ledgedash fall→DJ',
    higherIsBetter: false,
    eps: 0.5,
    decimals: 1,
    unit: 'f'
  },
  {
    key: 'neutral_win_pct',
    label: 'Neutral win %',
    higherIsBetter: true,
    eps: 2.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'kill_rate_pct',
    label: 'Kill rate',
    higherIsBetter: true,
    eps: 1.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'punish_pct',
    label: 'Avg punish %',
    higherIsBetter: true,
    eps: 0.7,
    decimals: 1,
    unit: '%'
  },
  {
    key: 'avg_kill_pct',
    label: 'Avg kill %',
    higherIsBetter: false,
    eps: 4.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'reversals_per_game',
    label: 'Reversals/game',
    higherIsBetter: false,
    eps: 0.3,
    decimals: 2,
    unit: ''
  },
  {
    key: 'whiff_pct',
    label: 'Whiff rate',
    higherIsBetter: false,
    eps: 2.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'whiff_punished_pct',
    label: 'Whiffs punished',
    higherIsBetter: false,
    eps: 3.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'oos_punish_pct',
    label: 'OOS punish %',
    higherIsBetter: true,
    eps: 3.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'free_recovery_given_pct',
    label: 'Free recoveries given',
    higherIsBetter: false,
    eps: 4.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'edgeguard_below_pct',
    label: 'Edgeguard below %',
    higherIsBetter: true,
    eps: 3.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'wavedash_pct',
    label: 'Wavedash %',
    higherIsBetter: true,
    eps: 2.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'f1_pct',
    label: 'Frame-1 aerial %',
    higherIsBetter: true,
    eps: 2.0,
    decimals: 0,
    unit: '%'
  },
  {
    key: 'sd_per_game',
    label: 'SDs / game',
    higherIsBetter: false,
    eps: 0.15,
    decimals: 1,
    unit: ''
  }
]

export const fmtMetric = (v: number | null | undefined, m: MetricDef): string =>
  v === null || v === undefined ? '—' : `${v.toFixed(m.decimals)}${m.unit}`

const PCT_ORDER = ['0-34', '35-79', '80-119', '120+']

const total = (d: Counts): number => Object.values(d).reduce((s, n) => s + n, 0)

const topEntries = (d: Counts, top: number): [string, number][] =>
  Object.entries(d)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)

export function fmtDist(d: Counts | undefined, top = 4): string {
  if (!d) return '—'
  const tot = total(d)
  if (!tot) return '—'
  return topEntries(d, top)
    .map(([k, v]) => `${k} ${Math.round((100 * v) / tot)}%`)
    .join(' · ')
}

const MISTAKE_SHORT: Record<string, string> = {
  caught_neutral: 'caught',
  grabbed_neutral: 'grabbed',
  landing_lag: 'landing-lag',
  whiffed: 'whiffed',
  attacked_into_shield: 'OOS',
  attacked_cc_grabbed: "CC'd",
  missed_tech: 'tech-chase',
  reversal_victim: 'reversed',
  airdodged: 'airdodge',
  unknown: '?'
}

export function fmtOpenedBy(d: Counts | undefined, top = 4): string {
  if (!d) return '—'
  const tot = total(d)
  if (!tot) return '—'
  return topEntries(d, top)
    .map(([k, v]) => {
      const [move, , mistake] = partition(k, '|')
      return `${move}→${MISTAKE_SHORT[mistake] ?? mistake} ${Math.round((100 * v) / tot)}%`
    })
    .join(' · ')
}

export function fmtStringOutcomes(so: Nested | undefined, top = 6): string {
  if (!so) return '—'
  const flat: [string, number][] = []
  for (const [move, oc] of Object.entries(so)) {
    for (const [outcome, c] of Object.entries(oc)) {
      if (c) flat.push([`${move}→${outcome}`, c])
    }
  }
  flat.sort((a, b) => b[1] - a[1])
  return (
    flat
      .slice(0, top)
      .map(([k, c]) => `${k} ${c}`)
      .join(' · ') || '—'
  )
}

export function fmtStringByPct(sbp: Nested | undefined): string {
  if (!sbp) return '—'
  const parts: string[] = []
  for (const label of PCT_ORDER) {
    const b = sbp[label]
    if (!b || !b['n']) continue
    const finished = (b['kill'] ?? 0) + (b['edgeguard'] ?? 0)
    parts.push(`${label} ${Math.round((100 * finished) / b['n'])}% (n=${b['n']})`)
  }
  return parts.join(' · ') || '—'
}

export function fmtKillPcts(d: Nested | undefined, top = 3): string {
  if (!d) return '—'
  const entries = Object.entries(d)
  const tot = entries.reduce((s, [, v]) => s + (v['n'] ?? 0), 0)
  if (!tot) return '—'
  const avg = entries.reduce((s, [, v]) => s + (v['sum_pct'] ?? 0), 0) / tot
  const moves = entries
    .sort((a, b) => (b[1]['n'] ?? 0) - (a[1]['n'] ?? 0))
    .slice(0, top)
    .map(([m, v]) => `${m} ${(v['sum_pct'] / v['n']).toFixed(0)} x${v['n']}`)
    .join(' · ')
  return `avg ${avg.toFixed(0)}% (${moves})`
}

export function fmtMoveSafety(mu: Nested | undefined, top = 4): string {
  if (!mu) return '—'
  const items = Object.entries(mu)
    .filter(([, s]) => s['n'])
    .sort((a, b) => (b[1]['n'] ?? 0) - (a[1]['n'] ?? 0))
    .slice(0, top)
  return (
    items
      .map(([m, s]) => {
        const wf = (100 * (s['whiff'] ?? 0)) / s['n']
        const pwf = s['whiff'] ? (100 * (s['punished_whiff'] ?? 0)) / s['whiff'] : 0
        return `${m} ${s['n']}u wf${wf.toFixed(0)}% pun${pwf.toFixed(0)}%`
      })
      .join(' · ') || '—'
  )
}

export function topFollowups(fu: Nested | undefined, nOpeners = 2, nMoves = 3): [string, string][] {
  if (!fu) return []
  const byOpener: Record<string, Record<string, Counts>> = {}
  for (const [key, dist] of Object.entries(fu)) {
    const [opener, , bucket] = partition(key, '|')
    ;(byOpener[opener] ??= {})[bucket] = dist
  }
  const top = Object.entries(byOpener)
    .sort(
      (a, b) =>
        Object.values(b[1]).reduce((s, d) => s + total(d), 0) -
        Object.values(a[1]).reduce((s, d) => s + total(d), 0)
    )
    .slice(0, nOpeners)
  const out: [string, string][] = []
  for (const [opener, buckets] of top) {
    if (opener === 'other') continue
    const parts: string[] = []
    for (const label of PCT_ORDER) {
      const dist = buckets[label]
      if (!dist) continue
      const tot = total(dist)
      const tops = topEntries(dist, nMoves)
        .map(([m, c]) => `${m} ${Math.round((100 * c) / tot)}%`)
        .join('/')
      parts.push(`${label}: ${tops}`)
    }
    if (parts.length) out.push([opener, parts.join(' · ')])
  }
  return out
}

// str.partition equivalent: split on the FIRST separator only.
function partition(s: string, sep: string): [string, string, string] {
  const i = s.indexOf(sep)
  return i === -1 ? [s, '', ''] : [s.slice(0, i), sep, s.slice(i + sep.length)]
}
