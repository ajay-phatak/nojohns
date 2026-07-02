import { useEffect, useState } from 'react'
import type { AppConfig } from '../../preload/index.d'
import Onboarding from './views/Onboarding'
import Dashboard from './views/Dashboard'
import ProReplays from './views/ProReplays'
import Settings from './views/Settings'

const VIEWS = ['Dashboard', 'Pro Replays', 'Settings'] as const
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
      {view === 'Settings' && <Settings config={config} onSaved={setConfig} />}
    </div>
  )
}

export default App
