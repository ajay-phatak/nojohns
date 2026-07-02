import { useEffect, useRef, useState } from 'react'
import type { AnalyzeResult, EngineEvent } from '../../preload/index.d'

// Walking skeleton: prove folder+code -> engine spawn -> NDJSON progress ->
// session JSON render. Real views replace this in later phases.
function App(): React.JSX.Element {
  const [folder, setFolder] = useState('')
  const [code, setCode] = useState('')
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
      setResult(await window.api.analyze(folder, code))
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', color: '#eee' }}>
      <h1>No Johns — walking skeleton</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          style={{ flex: 2, padding: 6 }}
          placeholder="Slippi replay folder (e.g. C:\Users\you\Documents\Slippi)"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        />
        <input
          style={{ flex: 1, padding: 6 }}
          placeholder="Connect code (ABCD#123)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button disabled={running || !folder || !code} onClick={run}>
          {running ? 'Analyzing…' : 'Analyze last 2 sets'}
        </button>
      </div>

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

export default App
