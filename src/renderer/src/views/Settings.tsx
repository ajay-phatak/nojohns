import { useEffect, useState } from 'react'
import type { AppConfig, CoachKeyStatus } from '../../../preload/index.d'
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
  const [notesFolder, setNotesFolder] = useState(config.notesFolder ?? '')
  const [autoWrite, setAutoWrite] = useState(config.autoWriteNotes)
  const [saved, setSaved] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [keyStatus, setKeyStatus] = useState<CoachKeyStatus | null>(null)
  const [keyError, setKeyError] = useState('')

  useEffect(() => {
    window.api.coachKeyStatus().then(setKeyStatus)
  }, [])

  const browseNotes = async (): Promise<void> => {
    const picked = await window.api.pickNotesFolder()
    if (picked) setNotesFolder(picked)
  }

  const saveKey = async (): Promise<void> => {
    setKeyError('')
    const res = await window.api.setCoachKey(keyInput)
    if (!res.ok) {
      setKeyError(
        res.reason === 'encryption_unavailable'
          ? 'OS keychain unavailable — cannot store the key securely.'
          : `Could not save key (${res.reason ?? 'unknown'}).`
      )
      return
    }
    setKeyInput('')
    setKeyStatus(await window.api.coachKeyStatus())
  }

  const clearKey = async (): Promise<void> => {
    await window.api.clearCoachKey()
    setKeyStatus(await window.api.coachKeyStatus())
  }

  const save = async (): Promise<void> => {
    const next = await window.api.setConfig({
      replayFolder: folder,
      connectCode: code,
      mainCharacters: mains,
      matchups,
      notesFolder: notesFolder || null,
      autoWriteNotes: autoWrite
    })
    onSaved(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h2>Settings</h2>

      <h4>Slippi replay folder</h4>
      <input
        style={{ width: '100%', padding: 6 }}
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
      />

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

      <h4>Notes folder</h4>
      <p style={{ color: '#888', fontSize: 13, marginTop: -8 }}>
        Any folder works — point it at an Obsidian vault to get session, matchup, and progress notes
        there. Your own text in the notes is preserved when they regenerate.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, padding: 6 }}
          value={notesFolder}
          placeholder="No folder set — notes disabled"
          onChange={(e) => setNotesFolder(e.target.value)}
        />
        <button onClick={browseNotes}>Browse…</button>
      </div>
      <label style={{ display: 'block', marginTop: 8, fontSize: 13, color: '#aaa' }}>
        <input
          type="checkbox"
          checked={autoWrite}
          disabled={!notesFolder}
          onChange={(e) => setAutoWrite(e.target.checked)}
        />{' '}
        Write notes automatically after each analysis
      </label>

      <h4>AI coach — Anthropic API key (optional)</h4>
      <p style={{ color: '#888', fontSize: 13, marginTop: -8 }}>
        Stored encrypted with your OS keychain, only ever used to call the Anthropic API from this
        machine. Saved separately from the settings below — no need to hit Save.
      </p>
      {keyStatus?.configured ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#6e9', fontSize: 13 }}>
            Key saved (····{keyStatus.last4 ?? ''})
          </span>
          <button onClick={clearKey}>Remove key</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            style={{ flex: 1, padding: 6 }}
            value={keyInput}
            placeholder="sk-ant-…"
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <button disabled={!keyInput.trim()} onClick={saveKey}>
            Save key
          </button>
        </div>
      )}
      {keyError && <p style={{ color: '#f88', fontSize: 13 }}>{keyError}</p>}

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
