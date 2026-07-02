import { useEffect, useRef, useState } from 'react'
import type { AnalyzeResult, AppConfig, EngineEvent } from '../../preload/index.d'
import Onboarding from './views/Onboarding'

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
    <div style={{ padding: 24, fontFamily: 'system-ui', color: '#eee' }}>
      <h1>No Johns</h1>
      <p style={{ color: '#aaa' }}>
        {config.mainCharacter} · {config.connectCode} · {config.replayFolder}
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

function App(): React.JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    window.api.getConfig().then(setConfig)
  }, [])

  if (!config) return <p style={{ color: '#aaa', padding: 24 }}>Loading…</p>
  if (!config.onboarded) return <Onboarding onDone={setConfig} />
  return <Dashboard config={config} />
}

export default App
