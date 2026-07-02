import { useState } from 'react'
import type { AppConfig } from '../../../preload/index.d'
import { CHARACTERS } from '../characters'

interface Props {
  config: AppConfig
  onSaved: (config: AppConfig) => void
}

function TogglePicker({
  selected,
  cap,
  color,
  onChange
}: {
  selected: string[]
  cap: number
  color: string
  onChange: (next: string[]) => void
}): React.JSX.Element {
  const toggle = (name: string): void =>
    onChange(
      selected.includes(name)
        ? selected.filter((m) => m !== name)
        : [...selected, name].slice(0, cap)
    )
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {CHARACTERS.map((c) => (
        <button
          key={c.name}
          onClick={() => toggle(c.name)}
          style={{
            padding: '4px 8px',
            background: selected.includes(c.name) ? color : '#333',
            color: '#eee',
            border: '1px solid #555'
          }}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}

function Settings({ config, onSaved }: Props): React.JSX.Element {
  const [folder, setFolder] = useState(config.replayFolder ?? '')
  const [code, setCode] = useState(config.connectCode ?? '')
  const [mains, setMains] = useState(config.mainCharacters)
  const [matchups, setMatchups] = useState(config.matchups)
  const [saved, setSaved] = useState(false)

  const save = async (): Promise<void> => {
    const next = await window.api.setConfig({
      replayFolder: folder,
      connectCode: code,
      mainCharacters: mains,
      matchups
    })
    onSaved(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h2>Settings</h2>

      <h4>Slippi replay folder</h4>
      <input style={{ width: '100%', padding: 6 }} value={folder} onChange={(e) => setFolder(e.target.value)} />

      <h4>Connect code</h4>
      <input
        style={{ width: 200, padding: 6 }}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />

      <h4>Your character(s) — up to 4</h4>
      <TogglePicker selected={mains} cap={4} color="#26a" onChange={setMains} />

      <h4>Common opponents — up to 8</h4>
      <TogglePicker selected={matchups} cap={8} color="#2a6" onChange={setMatchups} />

      <div style={{ marginTop: 16 }}>
        <button disabled={!folder || !code || mains.length === 0} onClick={save}>
          Save
        </button>{' '}
        {saved && <span style={{ color: '#6e9' }}>Saved.</span>}
      </div>
    </div>
  )
}

export default Settings
