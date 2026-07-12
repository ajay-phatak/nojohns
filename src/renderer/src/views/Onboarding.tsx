import { useEffect, useState } from 'react'
import type { AppConfig, DoctorResult, SlippiDetection } from '../../../preload/index.d'
import { CHARACTERS } from '../characters'

interface Props {
  onDone: (config: AppConfig) => void
}

// Steps: 1 folder -> 2 code -> 3 character + matchups -> done.
// Pro-replay download is offered on the dashboard afterward, so onboarding
// never blocks on a multi-minute fetch.
function Onboarding({ onDone }: Props): React.JSX.Element {
  const [step, setStep] = useState(1)
  const [detection, setDetection] = useState<SlippiDetection | null>(null)
  const [folder, setFolder] = useState('')
  const [code, setCode] = useState('')
  const [characters, setCharacters] = useState<string[]>([])
  const [matchups, setMatchups] = useState<string[]>([])
  const [checking, setChecking] = useState(false)
  const [doctorRes, setDoctorRes] = useState<DoctorResult | null>(null)

  useEffect(() => {
    window.api.detectSlippi().then((d) => {
      setDetection(d)
      if (d.replayFolder) setFolder(d.replayFolder)
    })
  }, [])

  const validate = async (): Promise<void> => {
    setChecking(true)
    setDoctorRes(null)
    try {
      setDoctorRes(await window.api.doctor(folder, code))
    } finally {
      setChecking(false)
    }
  }

  const finish = async (): Promise<void> => {
    const config = await window.api.setConfig({
      replayFolder: folder,
      connectCode: code,
      mainCharacters: characters,
      matchups,
      onboarded: true
    })
    onDone(config)
  }

  const toggle =
    (setter: React.Dispatch<React.SetStateAction<string[]>>, cap: number) =>
    (name: string): void =>
      setter((prev) =>
        prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name].slice(0, cap)
      )
  const toggleCharacter = toggle(setCharacters, 4)
  const toggleMatchup = toggle(setMatchups, 8)

  const ok = doctorRes?.exitCode === 0 && (doctorRes.result?.code_seen_in ?? 0) > 0

  return (
    <div className="onboard">
      <h1>Welcome to No Johns</h1>
      <p className="dim">Data instead of excuses. Three quick steps.</p>

      {step === 1 && (
        <section>
          <h2>1. Where are your Slippi replays?</h2>
          {detection?.replayFolder && (
            <p className="live small">
              Detected from Slippi Launcher — change it if it looks wrong.
            </p>
          )}
          <input
            style={{ width: '100%', padding: 8 }}
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="C:\Users\you\Documents\Slippi"
          />
          <p className="muted tiny">
            Point at your main Slippi folder — if it has monthly subfolders (2026-07, …), the newest
            month is used automatically on every analysis.
          </p>
          <button
            className="btn-primary"
            style={{ marginTop: 12 }}
            disabled={!folder}
            onClick={() => setStep(2)}
          >
            Next
          </button>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2>2. What&apos;s your connect code?</h2>
          {detection && detection.codeSuggestions.length > 0 && (
            <p className="small dim">
              Recently seen codes:{' '}
              {detection.codeSuggestions.slice(0, 6).map((c) => (
                <button key={c} style={{ margin: 2 }} onClick={() => setCode(c)}>
                  {c}
                </button>
              ))}
            </p>
          )}
          <input
            style={{ width: 200, padding: 8 }}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD#123"
          />
          <button style={{ marginLeft: 8 }} disabled={!code || checking} onClick={validate}>
            {checking ? 'Checking…' : 'Check'}
          </button>
          {doctorRes && (
            <p className={`small ${ok ? 'live' : 'neg'}`}>
              {doctorRes.error?.msg ??
                (ok
                  ? `Found ${doctorRes.result?.slp_count} replays — ${code} seen in ` +
                    `${doctorRes.result?.code_seen_in}/${doctorRes.result?.code_scanned} newest games.`
                  : `${doctorRes.result?.slp_count ?? 0} replays found, but ${code} wasn't in the ` +
                    `${doctorRes.result?.code_scanned ?? 0} newest games. Double-check the code.`)}
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setStep(1)}>Back</button>{' '}
            <button className="btn-primary" disabled={!ok} onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2>3. Who do you play, and against what?</h2>
          <p>Your character(s) — pick all your mains (up to 4):</p>
          <div className="toggle-row">
            {CHARACTERS.map((c) => (
              <button
                key={c.name}
                onClick={() => toggleCharacter(c.name)}
                className={characters.includes(c.name) ? 'on-main' : undefined}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p style={{ marginTop: 12 }}>Common opponents (up to 8):</p>
          <div className="toggle-row">
            {CHARACTERS.map((c) => (
              <button
                key={c.name}
                onClick={() => toggleMatchup(c.name)}
                className={matchups.includes(c.name) ? 'on-opp' : undefined}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p className="small dim" style={{ marginTop: 8 }}>
            You can download pro replays for these matchups from the dashboard — highly recommended,
            it&apos;s what powers the you-vs-pros comparison.
          </p>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setStep(2)}>Back</button>{' '}
            <button className="btn-primary" disabled={characters.length === 0} onClick={finish}>
              Finish
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

export default Onboarding
