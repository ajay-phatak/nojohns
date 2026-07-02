import { useEffect, useRef, useState } from 'react'
import type { AnalyzeResult, AppConfig, EngineEvent } from '../../preload/index.d'
import Onboarding from './views/Onboarding'
import ProReplays from './views/ProReplays'

// Interim dashboard: config-driven analyze with live progress. Replaced by
// the real Dashboard/SessionReport views in the views milestone.
function Dashboard({ config }: { config: AppConfig }): React.JSX.Element {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const unsubscribe = useRef<(() => void) | null>(null)

  useEffect(() => {
    unsubscribe.current = window.api.onEngineEvent((e: EngineEvent) => {
      if (e.event === 'progress') {
        setProgress(`${e.stage}: ${e.current}/${e.total} — ${e.detail ?? ''}`)
      } else if (e.event === 'log' || e.event === 'error') {
        setLogs((prev) => [...prev.slice(-19), `[${e.event}] ${e.msg}`])
      }
    })
    return () => unsubscribe.current?.()
  }, [])

  const run = async (): Promise<void> => {
    setRunning(true)
    setResult(null)
    setLogs([])
    try {
      setResult(await window.api.analyze(config.replayFolder!, config.connectCode!))
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  return (
    <div>
      <h2>Dashboard</h2>
      <p style={{ color: '#aaa' }}>
        {config.mainCharacters.join(' / ')} · {config.connectCode} · {config.replayFolder}
      </p>
      <button disabled={running} onClick={run}>
        {running ? 'Analyzing…' : 'Analyze last 2 sets'}
      </button>

      {progress && <p style={{ color: '#8fc' }}>{progress}</p>}
      {logs.map((l, i) => (
        <p key={i} style={{ margin: 2, fontSize: 12, color: '#aaa' }}>
          {l}
        </p>
      ))}

      {result?.ok && result.session && (
        <div>
          <h2>{result.session.sets.length} set(s) analyzed</h2>
          <pre
            style={{ fontSize: 11, maxHeight: 400, overflow: 'auto', background: '#111', padding: 12 }}
          >
            {JSON.stringify(result.session, null, 2)}
          </pre>
        </div>
      )}
      {result && !result.ok && (
        <p style={{ color: '#f88' }}>Engine failed (exit {result.exitCode})</p>
      )}
    </div>
  )
}

const VIEWS = ['Dashboard', 'Pro Replays'] as const
type View = (typeof VIEWS)[number]

function App(): React.JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [view, setView] = useState<View>('Dashboard')

  useEffect(() => {
    window.api.getConfig().then(setConfig)
  }, [])

  if (!config) return <p style={{ color: '#aaa', padding: 24 }}>Loading…</p>
  if (!config.onboarded) return <Onboarding onDone={setConfig} />

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', color: '#eee' }}>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '6px 12px',
              background: view === v ? '#26a' : '#333',
              color: '#eee',
              border: '1px solid #555'
            }}
          >
            {v}
          </button>
        ))}
      </nav>
      {view === 'Dashboard' && <Dashboard config={config} />}
      {view === 'Pro Replays' && <ProReplays config={config} />}
    </div>
  )
}

export default App
