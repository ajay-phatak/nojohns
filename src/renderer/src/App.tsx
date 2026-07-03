import { useEffect, useState } from 'react'
import type { AppConfig, UpdateCheck } from '../../preload/index.d'
import Onboarding from './views/Onboarding'
import Dashboard from './views/Dashboard'
import ProReplays from './views/ProReplays'
import Matchups from './views/Matchups'
import Coach from './views/Coach'
import Settings from './views/Settings'

const VIEWS = ['Dashboard', 'Matchups', 'Pro Replays', 'Coach', 'Settings'] as const
type View = (typeof VIEWS)[number]

function App(): React.JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [view, setView] = useState<View>('Dashboard')
  const [update, setUpdate] = useState<UpdateCheck | null>(null)

  useEffect(() => {
    window.api.getConfig().then(setConfig)
    window.api.checkUpdate().then((u) => {
      if (u.newer) setUpdate(u)
    })
  }, [])

  if (!config) return <p style={{ color: '#aaa', padding: 24 }}>Loading…</p>
  if (!config.onboarded) return <Onboarding onDone={setConfig} />

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', color: '#eee' }}>
      {update && (
        <div
          style={{
            background: '#1d3a5f',
            border: '1px solid #2a6ac2',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 12,
            fontSize: 13
          }}
        >
          v{update.latest} is available (you have v{update.current}) —{' '}
          <a href={update.url} target="_blank" rel="noreferrer" style={{ color: '#7bf' }}>
            download it here
          </a>
          .{' '}
          <button style={{ marginLeft: 8, fontSize: 12 }} onClick={() => setUpdate(null)}>
            Dismiss
          </button>
        </div>
      )}
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
      {view === 'Matchups' && <Matchups config={config} />}
      {view === 'Pro Replays' && <ProReplays config={config} />}
      {view === 'Coach' && <Coach />}
      {view === 'Settings' && <Settings config={config} onSaved={setConfig} />}
    </div>
  )
}

export default App
