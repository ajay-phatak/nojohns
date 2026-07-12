import { useEffect, useRef, useState } from 'react'
import type { CoachModel, CoachResult, CoachStatus, CoachUsage } from '../../../preload/index.d'

const MODEL_LABELS: Record<CoachModel, string> = {
  sonnet: 'Sonnet — fast, recommended',
  haiku: 'Haiku — cheapest',
  opus: 'Opus — deepest read'
}

interface FocusCard {
  gap: string
  evidence: string
  suggestion: string
  plan: string
}

interface Turn {
  role: 'user' | 'assistant'
  text: string
  usage?: CoachUsage
}

const REASON_TEXT: Record<string, string> = {
  no_key: 'No API key configured — add one in Settings.',
  bad_key: 'The API key was rejected — check it in Settings.',
  rate_limited: 'Rate limited by the API — wait a moment and try again.',
  refusal: 'The model declined to answer that — try rephrasing.',
  no_session: 'No analyzed session yet — run an analysis from the Dashboard first.',
  no_conversation: 'Generate a report first, then ask follow-ups.',
  busy: 'A response is already in progress.',
  cli_not_logged_in: 'Claude Code is not logged in — run `claude` in a terminal and log in first.',
  cli_timeout: 'Claude Code took too long to respond — try again.'
}

function CostLine({ usage }: { usage: CoachUsage }): React.JSX.Element {
  return (
    <div className="cost-line">
      ${usage.costUsd.toFixed(3)} this response · ${usage.monthUsd.toFixed(2)} this month
      {usage.cacheReadTokens > 0 && ' · cached'}
    </div>
  )
}

function Coach(): React.JSX.Element {
  const [status, setStatus] = useState<CoachStatus | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [streaming, setStreaming] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [cards, setCards] = useState<FocusCard[]>([])
  const [adviseProse, setAdviseProse] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.coachStatus().then(setStatus)
  }, [])

  useEffect(() => window.api.onCoachDelta((text) => setStreaming((s) => s + text)), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streaming, turns])

  const finish = (res: CoachResult): void => {
    setStreaming('')
    if (res.ok && res.text !== undefined) {
      setTurns((t) => [...t, { role: 'assistant', text: res.text!, usage: res.usage }])
      // Only session reviews carry gaps — chat turns leave the cards alone.
      if (res.gaps) {
        setCards(res.gaps.map((g) => ({ ...g, plan: g.suggestion })))
        setAdviseProse(res.text)
      }
    } else {
      setError(REASON_TEXT[res.reason ?? ''] ?? `Coach failed: ${res.reason ?? 'unknown'}`)
    }
  }

  const report = async (): Promise<void> => {
    setRunning(true)
    setError('')
    setTurns([])
    setStreaming('')
    setCards([])
    setSaveStatus('')
    try {
      finish(await window.api.coachReport())
    } finally {
      setRunning(false)
    }
  }

  const saveFocuses = async (): Promise<void> => {
    setSaveStatus('Saving…')
    const res = await window.api.saveFocuses({
      prose: adviseProse,
      focuses: cards.map(({ gap, plan }) => ({ gap, plan }))
    })
    setSaveStatus(
      res.ok
        ? 'Saved to Progress.md and the session note.'
        : `Save failed: ${res.reason ?? 'unknown'}`
    )
  }

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text) return
    setInput('')
    setError('')
    setTurns((t) => [...t, { role: 'user', text }])
    setRunning(true)
    try {
      finish(await window.api.coachChat(text))
    } finally {
      setRunning(false)
    }
  }

  if (status === null) return <p className="muted">Loading…</p>

  if (!status.ready) {
    return (
      <div>
        <h2>Coach</h2>
        <div className="callout callout-lg">
          🤖 <strong>AI coach</strong> — get a written coaching report after each session, plus a
          chat to dig into the details.{' '}
          {status.backend === 'claude-cli' ? (
            <>
              Claude Code wasn&apos;t detected on this machine — install it and log in with your
              Pro/Max account (reports are then covered by your plan), or switch the coach to an API
              key in Settings.
            </>
          ) : (
            <>
              Add an Anthropic API key in Settings — your key stays on this machine and you pay
              Anthropic directly (a report costs a few cents). Have a Claude Pro/Max plan? Pick the
              Claude Code backend in Settings instead and skip API credits entirely.
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 720 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 className="h-inline">Coach</h2>
        <button className="btn-primary" disabled={running} onClick={report}>
          {turns.length === 0 ? 'Coach my latest session' : 'New report'}
        </button>
        <select
          value={status.model}
          disabled={running}
          style={{ fontSize: 12 }}
          onChange={async (e) => {
            const model = e.target.value as CoachModel
            await window.api.setConfig({ coachModel: model })
            setStatus({ ...status, model })
          }}
        >
          {(Object.keys(MODEL_LABELS) as CoachModel[]).map((m) => (
            <option key={m} value={m}>
              {MODEL_LABELS[m]}
            </option>
          ))}
        </select>
        {running && <span className="live small">Thinking…</span>}
      </div>

      {turns.length === 0 && !streaming && !error && (
        <p className="muted">
          Reads your most recent analyzed session and surfaces the biggest gaps, each with a
          suggested fix — keep the suggestion or write your own plan, then save your focuses to your
          notes. Previous focuses from Progress.md shape the next session&apos;s advice.
        </p>
      )}

      {turns.map((t, i) => (
        <div key={i} className={t.role === 'user' ? 'card card-user' : 'card'}>
          <div className="role-label">{t.role === 'user' ? 'You' : 'Coach'}</div>
          <div className="msg-text">{t.text}</div>
          {t.usage && <CostLine usage={t.usage} />}
          {!t.usage && t.role === 'assistant' && status.backend === 'claude-cli' && (
            <div className="cost-line">covered by your Claude plan</div>
          )}
        </div>
      ))}

      {streaming && (
        <div className="card">
          <div className="role-label">Coach</div>
          <div className="msg-text">{streaming.split('```json')[0]}</div>
        </div>
      )}

      {error && <p className="neg">{error}</p>}

      {cards.length > 0 && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <h3 className="eyebrow" style={{ margin: '12px 0 8px' }}>
            Focuses — keep each suggestion or write your own plan
          </h3>
          {cards.map((c, i) => (
            <div key={i} className="card card-focus">
              <div style={{ marginBottom: 4 }}>
                <strong>{c.gap}</strong> <span className="muted tiny">{c.evidence}</span>
              </div>
              <textarea
                rows={2}
                className="small"
                style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
                value={c.plan}
                onChange={(e) =>
                  setCards((cs) => cs.map((x, j) => (j === i ? { ...x, plan: e.target.value } : x)))
                }
              />
              {c.plan !== c.suggestion && (
                <button
                  className="btn-xs"
                  onClick={() =>
                    setCards((cs) => cs.map((x, j) => (j === i ? { ...x, plan: x.suggestion } : x)))
                  }
                >
                  Reset to suggestion
                </button>
              )}
            </div>
          ))}
          <div className="row">
            <button
              disabled={running || !status.notesConfigured || cards.some((c) => !c.plan.trim())}
              onClick={saveFocuses}
            >
              Save focuses to notes
            </button>
            {!status.notesConfigured && (
              <span className="muted tiny">set a notes folder in Settings to save these</span>
            )}
            {saveStatus && (
              <span className={`small ${saveStatus.startsWith('Save failed') ? 'neg' : 'pos'}`}>
                {saveStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {turns.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            style={{ flex: 1, padding: 8 }}
            value={input}
            disabled={running}
            placeholder="Ask a follow-up…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          <button className="btn-primary" disabled={running || !input.trim()} onClick={send}>
            Send
          </button>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default Coach
