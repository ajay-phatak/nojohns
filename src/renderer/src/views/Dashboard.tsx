import { useEffect, useState } from 'react'
import type {
  AppConfig,
  EngineEvent,
  SessionSummary,
  SetRecord
} from '../../../preload/index.d'
import SessionReport from './SessionReport'

function Dashboard({ config }: { config: AppConfig }): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState<{ title: string; sets: SetRecord[] } | null>(null)
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
        setOpen({ title: 'Latest session', sets: res.session.sets })
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
    return <SessionReport title={open.title} sets={open.sets} onBack={() => setOpen(null)} />
  }

  return (
    <div>
      <h2>Dashboard</h2>
      <p style={{ color: '#aaa' }}>
        {config.mainCharacters.join(' / ')} · {config.connectCode}
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button disabled={running} onClick={run}>
          {running ? 'Analyzing…' : 'Analyze recent games'}
        </button>
        <label style={{ fontSize: 13, color: '#aaa' }}>
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
        {progress && <span style={{ color: '#8fc', fontSize: 13 }}>{progress}</span>}
      </div>
      {error && <p style={{ color: '#f88' }}>{error}</p>}

      <h3>Recent sessions</h3>
      {sessions.length === 0 && (
        <p style={{ color: '#888' }}>None yet — hit Analyze after a session of netplay.</p>
      )}
      {sessions.map((s) => {
        const wins = s.sets.reduce((n, x) => n + x.wins, 0)
        const losses = s.sets.reduce((n, x) => n + x.losses, 0)
        const matchups = [...new Set(s.sets.map((x) => `${x.my_char} vs ${x.opp_char}`))]
        return (
          <div
            key={s.file}
            onClick={() => setOpen({ title: s.generated_at, sets: s.sets })}
            style={{
              border: '1px solid #333',
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
              cursor: 'pointer'
            }}
          >
            <strong>{s.generated_at}</strong>{' '}
            <span style={{ color: wins >= losses ? '#6e9' : '#f88' }}>
              {wins}–{losses}
            </span>
            <div style={{ color: '#888', fontSize: 13 }}>{matchups.join(' · ')}</div>
          </div>
        )
      })}
    </div>
  )
}

export default Dashboard
