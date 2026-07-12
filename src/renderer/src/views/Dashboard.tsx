import { useEffect, useState } from 'react'
import type { AppConfig, EngineEvent, SessionSummary, SetRecord } from '../../../preload/index.d'
import SessionReport from './SessionReport'

function Dashboard({ config }: { config: AppConfig }): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState<{ title: string; sets: SetRecord[]; file?: string } | null>(null)
  const [sets, setSets] = useState(2)

  const refresh = (): void => {
    window.api.listSessions().then(setSessions)
  }
  useEffect(refresh, [])

  useEffect(
    () =>
      window.api.onEngineEvent((e: EngineEvent) => {
        if (e.event === 'progress' && (e.stage === 'parse' || e.stage === 'baseline')) {
          const what = e.stage === 'parse' ? 'Analyzing your games' : 'Building pro baseline'
          setProgress(`${what}: ${e.current}/${e.total}`)
        }
      }),
    []
  )

  const run = async (): Promise<void> => {
    setRunning(true)
    setError('')
    setProgress('Starting…')
    try {
      const res = await window.api.analyzeSession({ sets })
      if (res.ok && res.session) {
        setOpen({ title: 'Latest session', sets: res.session.sets, file: res.file })
      } else {
        setError(`Analysis failed (${res.reason ?? 'unknown'}) — check the logs.`)
      }
    } finally {
      setRunning(false)
      setProgress('')
      refresh()
    }
  }

  if (open) {
    return (
      <SessionReport
        title={open.title}
        sets={open.sets}
        sessionFile={open.file}
        notesConfigured={!!config.notesFolder}
        onBack={() => setOpen(null)}
      />
    )
  }

  return (
    <div>
      <h2>Dashboard</h2>
      <p className="subtitle">
        {config.mainCharacters.join(' / ')} · {config.connectCode}
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn-primary" disabled={running} onClick={run}>
          {running ? 'Analyzing…' : 'Analyze recent games'}
        </button>
        <label className="small dim">
          last{' '}
          <select value={sets} onChange={(e) => setSets(Number(e.target.value))}>
            {[1, 2, 3, 5, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>{' '}
          set(s)
        </label>
        {progress && <span className="live small">{progress}</span>}
      </div>
      {error && <p className="neg">{error}</p>}

      {!config.notesFolder && (
        <div className="callout">
          📝 <strong>Notes</strong> — point No Johns at a folder (an Obsidian vault works) in
          Settings and it writes markdown notes per session and matchup, with room for your own
          observations.
        </div>
      )}

      <h3 className="eyebrow">Recent sessions</h3>
      {sessions.length === 0 && (
        <p className="muted">None yet — hit Analyze after a session of netplay.</p>
      )}
      {sessions.map((s) => {
        const wins = s.sets.reduce((n, x) => n + x.wins, 0)
        const losses = s.sets.reduce((n, x) => n + x.losses, 0)
        const matchups = [...new Set(s.sets.map((x) => `${x.my_char} vs ${x.opp_char}`))]
        return (
          <div
            key={s.file}
            onClick={() => setOpen({ title: s.generated_at, sets: s.sets, file: s.file })}
            className="card card-click"
          >
            <div className="row-between">
              <span>
                <strong className="mono">{s.generated_at}</strong>{' '}
                <span className={`record ${wins >= losses ? 'pos' : 'neg'}`}>
                  {wins}–{losses}
                </span>
              </span>
              <span className="matchups">{matchups.join(' · ')}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Dashboard
