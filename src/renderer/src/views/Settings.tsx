import { useEffect, useState } from 'react'
import type {
  AppConfig,
  CliDetection,
  CoachKeyStatus,
  PlaybackStatus
} from '../../../preload/index.d'
import { CHARACTERS } from '../characters'

interface Props {
  config: AppConfig
  onSaved: (config: AppConfig) => void
}

function TogglePicker({
  selected,
  cap,
  onClass,
  onChange
}: {
  selected: string[]
  cap: number
  onClass: 'on-main' | 'on-opp'
  onChange: (next: string[]) => void
}): React.JSX.Element {
  const toggle = (name: string): void =>
    onChange(
      selected.includes(name)
        ? selected.filter((m) => m !== name)
        : [...selected, name].slice(0, cap)
    )
  return (
    <div className="toggle-row">
      {CHARACTERS.map((c) => (
        <button
          key={c.name}
          onClick={() => toggle(c.name)}
          className={selected.includes(c.name) ? onClass : undefined}
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
  const [backend, setBackend] = useState(config.coachBackend)
  const [cli, setCli] = useState<CliDetection | null>(null)
  const [playbackDolphin, setPlaybackDolphin] = useState(config.playbackDolphin ?? '')
  const [meleeIso, setMeleeIso] = useState(config.meleeIso ?? '')
  const [playback, setPlayback] = useState<PlaybackStatus | null>(null)

  useEffect(() => {
    window.api.coachKeyStatus().then(setKeyStatus)
    window.api.detectClaudeCli().then(setCli)
    window.api.playbackStatus().then(setPlayback)
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
      autoWriteNotes: autoWrite,
      coachBackend: backend,
      playbackDolphin,
      meleeIso
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
      <p className="muted tiny" style={{ marginTop: 4 }}>
        Point at your main Slippi folder — if it has monthly subfolders (2026-07, …), analysis
        always uses the newest month. Picking a month folder directly pins you to it.
      </p>

      <h4>Connect code</h4>
      <input
        style={{ width: 200, padding: 6 }}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />

      <h4>Your character(s) — up to 4</h4>
      <TogglePicker selected={mains} cap={4} onClass="on-main" onChange={setMains} />

      <h4>Common opponents — up to 8</h4>
      <TogglePicker selected={matchups} cap={8} onClass="on-opp" onChange={setMatchups} />

      <h4>Notes folder</h4>
      <p className="muted small" style={{ marginTop: -8 }}>
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
      <label className="check-label" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={autoWrite}
          disabled={!notesFolder}
          onChange={(e) => setAutoWrite(e.target.checked)}
        />{' '}
        Write notes automatically after each analysis
      </label>

      <h4>AI coach (optional)</h4>
      <label className="check-label" style={{ marginBottom: 4 }}>
        <input
          type="radio"
          name="coachBackend"
          checked={backend === 'claude-cli'}
          onChange={() => setBackend('claude-cli')}
        />{' '}
        Claude Code — uses your Pro/Max plan, no API credits
        <span className={`tiny ${cli?.found ? 'pos' : 'warn'}`} style={{ marginLeft: 8 }}>
          {cli === null
            ? 'checking…'
            : cli.found
              ? `detected (${cli.version})`
              : 'not found — install Claude Code and log in'}
        </span>
      </label>
      <label className="check-label">
        <input
          type="radio"
          name="coachBackend"
          checked={backend === 'api'}
          onChange={() => setBackend('api')}
        />{' '}
        Anthropic API key — pay-per-use credits
      </label>
      {backend === 'api' && (
        <div style={{ marginTop: 8 }}>
          <p className="muted small" style={{ marginTop: 0 }}>
            Stored encrypted with your OS keychain, only ever used to call the Anthropic API from
            this machine. Saved immediately — no need to hit Save.
          </p>
          {keyStatus?.configured ? (
            <div className="row">
              <span className="pos small">Key saved (····{keyStatus.last4 ?? ''})</span>
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
          {keyError && <p className="neg small">{keyError}</p>}
        </div>
      )}

      <h4>Playback</h4>
      <p className="muted small" style={{ marginTop: -8 }}>
        Overrides for the Slippi playback Dolphin and Melee ISO used by &quot;Watch these
        moments&quot; chips in the session report. Leave blank to auto-detect.
      </p>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="dim small" style={{ minWidth: 160 }}>
          Playback Dolphin.exe
        </span>
        <input
          style={{ flex: 1, padding: 6 }}
          value={playbackDolphin}
          placeholder={playback?.dolphin ? 'auto-detected' : 'not found — set path'}
          onChange={(e) => setPlaybackDolphin(e.target.value)}
        />
      </div>
      <div className="row">
        <span className="dim small" style={{ minWidth: 160 }}>
          Melee ISO
        </span>
        <input
          style={{ flex: 1, padding: 6 }}
          value={meleeIso}
          placeholder={playback?.iso ? 'auto-detected' : 'not found — set path'}
          onChange={(e) => setMeleeIso(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          className="btn-primary"
          disabled={!folder || !code || mains.length === 0}
          onClick={save}
        >
          Save
        </button>{' '}
        {saved && <span className="pos">Saved.</span>}
      </div>
    </div>
  )
}

export default Settings
