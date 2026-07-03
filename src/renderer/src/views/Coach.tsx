import { useEffect, useRef, useState } from 'react'
import type { CoachKeyStatus, CoachResult, CoachUsage } from '../../../preload/index.d'

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
  busy: 'A response is already in progress.'
}

function CostLine({ usage }: { usage: CoachUsage }): React.JSX.Element {
  return (
    <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
      ${usage.costUsd.toFixed(3)} this response · ${usage.monthUsd.toFixed(2)} this month
      {usage.cacheReadTokens > 0 && ' · cached'}
    </div>
  )
}

function Coach(): React.JSX.Element {
  const [keyStatus, setKeyStatus] = useState<CoachKeyStatus | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [streaming, setStreaming] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.coachKeyStatus().then(setKeyStatus)
  }, [])

  useEffect(() => window.api.onCoachDelta((text) => setStreaming((s) => s + text)), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streaming, turns])

  const finish = (res: CoachResult): void => {
    setStreaming('')
    if (res.ok && res.text !== undefined) {
      setTurns((t) => [...t, { role: 'assistant', text: res.text!, usage: res.usage }])
    } else {
      setError(REASON_TEXT[res.reason ?? ''] ?? `Coach failed: ${res.reason ?? 'unknown'}`)
    }
  }

  const report = async (): Promise<void> => {
    setRunning(true)
    setError('')
    setTurns([])
    setStreaming('')
    try {
      finish(await window.api.coachReport())
    } finally {
      setRunning(false)
    }
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

  if (keyStatus === null) return <p style={{ color: '#888' }}>Loading…</p>

  if (!keyStatus.configured) {
    return (
      <div>
        <h2>Coach</h2>
        <div
          style={{
            border: '1px dashed #444',
            borderRadius: 8,
            padding: 16,
            color: '#888',
            maxWidth: 560
          }}
        >
          🤖 <strong style={{ color: '#aaa' }}>AI coach</strong> — add an Anthropic API key in
          Settings and get a written coaching report after each session, plus a chat to dig into the
          details. Your key stays on this machine, and you pay Anthropic directly for usage (a
          report costs a few cents).
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 720 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Coach</h2>
        <button disabled={running} onClick={report}>
          {turns.length === 0 ? 'Coach my latest session' : 'New report'}
        </button>
        {running && <span style={{ color: '#8fc', fontSize: 13 }}>Thinking…</span>}
      </div>

      {turns.length === 0 && !streaming && !error && (
        <p style={{ color: '#888' }}>
          Generates a coaching read of your most recent analyzed session — pro gaps, trends, and up
          to three focuses with drills. Then ask follow-ups below.
        </p>
      )}

      {turns.map((t, i) => (
        <div
          key={i}
          style={{
            border: '1px solid #333',
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
            background: t.role === 'user' ? '#20242c' : 'transparent'
          }}
        >
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>
            {t.role === 'user' ? 'You' : 'Coach'}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{t.text}</div>
          {t.usage && <CostLine usage={t.usage} />}
        </div>
      ))}

      {streaming && (
        <div style={{ border: '1px solid #333', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Coach</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{streaming}</div>
        </div>
      )}

      {error && <p style={{ color: '#f88' }}>{error}</p>}

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
          <button disabled={running || !input.trim()} onClick={send}>
            Send
          </button>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default Coach
