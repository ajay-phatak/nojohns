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
    <div style={{ minWidth: 180 }}>
      <h5 style={{ margin: '4px 0', color: '#888' }}>{title}</h5>
      {entries.length === 0 && <p style={{ fontSize: 12, color: '#666' }}>—</p>}
      {entries.map(([label, n]) => (
        <div key={label} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>{label}</span>
          <span style={{ color: '#888' }}>{n}</span>
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

  if (!loaded) return <p style={{ color: '#888' }}>Loading…</p>
  if (!trends || !trends.matchups || Object.keys(trends.matchups).length === 0) {
    return (
      <div>
        <h2>Matchups</h2>
        <p style={{ color: '#888' }}>
          No history yet — analyze a few sessions and your per-matchup record builds up here.
        </p>
      </div>
    )
  }

  const sorted = Object.entries(trends.matchups).sort((a, b) => b[1].games - a[1].games)

  return (
    <div>
      <h2>Matchups</h2>
      <p style={{ color: '#888', fontSize: 13 }}>
        {trends.n_sets} sets over {trends.n_sessions} sessions, most-played first.
      </p>
      {noteError && <p style={{ color: '#c94', fontSize: 13 }}>{noteError}</p>}
      {sorted.map(([name, mu]) => {
        const gp = mu.gameplan ?? {}
        return (
          <div
            key={name}
            style={{ border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 16 }}
          >
            <h3 style={{ marginTop: 0 }}>
              {name}{' '}
              <span style={{ color: mu.wins >= mu.losses ? '#6e9' : '#f88' }}>
                {mu.wins}–{mu.losses}
              </span>{' '}
              <span style={{ color: '#888', fontWeight: 'normal', fontSize: 14 }}>
                · {mu.games} games · {mu.sessions} session(s)
              </span>
              {config.notesFolder && (
                <button
                  onClick={() => openNote(name)}
                  style={{ marginLeft: 12, fontSize: 12, padding: '2px 8px' }}
                >
                  Open note
                </button>
              )}
            </h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
              {Object.entries(HEADLINE_LABELS).map(([key, label]) =>
                mu.headline[key] !== null && mu.headline[key] !== undefined ? (
                  <span key={key}>
                    <span style={{ color: '#888' }}>{label}:</span> {mu.headline[key]}
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
