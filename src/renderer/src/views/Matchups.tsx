import { useEffect, useState } from 'react'
import type { AppConfig } from '../../../preload/index.d'

interface MatchupSummary {
  wins: number
  losses: number
  games: number
  sessions: number
  headline: Record<string, number | null>
  gameplan: Record<string, unknown>
}

interface Trends {
  n_sessions: number
  n_sets: number
  matchups: Record<string, MatchupSummary>
}

// Top-N entries of a {label: count} distribution.
function TopList({ title, dist }: { title: string; dist: unknown }): React.JSX.Element {
  const entries = Object.entries((dist as Record<string, number>) ?? {})
    .filter(([, n]) => typeof n === 'number')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  return (
    <div className="top-list">
      <h5>{title}</h5>
      {entries.length === 0 && <p className="tiny faint">—</p>}
      {entries.map(([label, n]) => (
        <div key={label} className="top-list-row">
          <span>{label}</span>
          <span className="muted">{n}</span>
        </div>
      ))}
    </div>
  )
}

const HEADLINE_LABELS: Record<string, string> = {
  lcancel_pct: 'L-cancel %',
  shield_s: 'Shield s/game',
  galint_keep_pct: 'GALINT keep %',
  neutral_win_pct: 'Neutral win %',
  kill_rate_pct: 'Kill rate %'
}

function Matchups({ config }: { config: AppConfig }): React.JSX.Element {
  const [trends, setTrends] = useState<Trends | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [noteError, setNoteError] = useState('')

  const openNote = async (name: string): Promise<void> => {
    const res = await window.api.openNote(`Matchups/${name}.md`)
    setNoteError(
      res.ok
        ? ''
        : res.reason === 'missing'
          ? 'No note yet — write notes from a session report first.'
          : `Could not open note (${res.reason ?? 'unknown'}).`
    )
  }

  useEffect(() => {
    window.api.getTrends().then((t) => {
      setTrends(t as Trends | null)
      setLoaded(true)
    })
  }, [])

  if (!loaded) return <p className="muted">Loading…</p>
  if (!trends || !trends.matchups || Object.keys(trends.matchups).length === 0) {
    return (
      <div>
        <h2>Matchups</h2>
        <p className="muted">
          No history yet — analyze a few sessions and your per-matchup record builds up here.
        </p>
      </div>
    )
  }

  const sorted = Object.entries(trends.matchups).sort((a, b) => b[1].games - a[1].games)

  return (
    <div>
      <h2>Matchups</h2>
      <p className="muted small">
        {trends.n_sets} sets over {trends.n_sessions} sessions, most-played first.
      </p>
      {noteError && <p className="warn small">{noteError}</p>}
      {sorted.map(([name, mu]) => {
        const gp = mu.gameplan ?? {}
        return (
          <div key={name} className="card card-lg">
            <h3>
              {name}{' '}
              <span className={`record ${mu.wins >= mu.losses ? 'pos' : 'neg'}`}>
                {mu.wins}–{mu.losses}
              </span>{' '}
              <span className="h-sub">
                · {mu.games} games · {mu.sessions} session(s)
              </span>
              {config.notesFolder && (
                <button
                  onClick={() => openNote(name)}
                  className="btn-sm"
                  style={{ marginLeft: 12 }}
                >
                  Open note
                </button>
              )}
            </h3>
            <div className="small" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(HEADLINE_LABELS).map(([key, label]) =>
                mu.headline[key] !== null && mu.headline[key] !== undefined ? (
                  <span key={key}>
                    <span className="muted">{label}:</span> {mu.headline[key]}
                  </span>
                ) : null
              )}
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 12 }}>
              <TopList title="You open with" dist={gp['opening_sources']} />
              <TopList title="They open you with" dist={gp['opened_by']} />
              <TopList title="Your kill moves" dist={gp['your_kill_moves']} />
              <TopList title="Their kill moves" dist={gp['their_kill_moves']} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Matchups
