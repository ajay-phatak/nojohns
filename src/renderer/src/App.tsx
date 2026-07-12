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

  if (!config)
    return (
      <p className="dim" style={{ padding: 24 }}>
        Loading…
      </p>
    )
  if (!config.onboarded) return <Onboarding onDone={setConfig} />

  return (
    <div className="app">
      <nav className="nav">
        <span className="brand">No Johns</span>
        {VIEWS.map((v) => (
          <button key={v} onClick={() => setView(v)} className={view === v ? 'active' : undefined}>
            {v}
          </button>
        ))}
      </nav>
      <main className="main">
        {update && (
          <div className="banner-info">
            v{update.latest} is available (you have v{update.current}) —{' '}
            <a href={update.url} target="_blank" rel="noreferrer">
              download it here
            </a>
            .{' '}
            <button className="btn-sm" style={{ marginLeft: 8 }} onClick={() => setUpdate(null)}>
              Dismiss
            </button>
          </div>
        )}
        {view === 'Dashboard' && <Dashboard config={config} />}
        {view === 'Matchups' && <Matchups config={config} />}
        {view === 'Pro Replays' && <ProReplays config={config} />}
        {view === 'Coach' && <Coach />}
        {view === 'Settings' && <Settings config={config} onSaved={setConfig} />}
      </main>
    </div>
  )
}

export default App
