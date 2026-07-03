import { useState } from 'react'
import type { SetRecord } from '../../../preload/index.d'
import { HEADLINE_METRICS } from '../metrics'

function GapChip({
  mine,
  pro,
  higherIsBetter
}: {
  mine: number | null
  pro: number | null
  higherIsBetter: boolean
}): React.JSX.Element | null {
  if (mine === null || pro === null) return null
  const gap = mine - pro
  const good = higherIsBetter ? gap >= 0 : gap <= 0
  const shown = Math.abs(gap) < 0.05 ? '=' : `${gap > 0 ? '+' : ''}${gap.toFixed(1)}`
  return (
    <span
      style={{
        padding: '1px 8px',
        borderRadius: 10,
        fontSize: 12,
        background: shown === '=' ? '#444' : good ? '#153' : '#511',
        color: shown === '=' ? '#aaa' : good ? '#6e9' : '#f88'
      }}
    >
      {shown}
    </span>
  )
}

function SetCard({ set }: { set: SetRecord }): React.JSX.Element {
  const record = `${set.wins}–${set.losses}`
  return (
    <div style={{ border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>
        {set.my_char} vs {set.opp_char}{' '}
        <span style={{ color: set.wins >= set.losses ? '#6e9' : '#f88' }}>{record}</span>{' '}
        <span style={{ color: '#888', fontWeight: 'normal', fontSize: 14 }}>
          · {set.opp_code} · {set.n_games} games · {set.session_date}
        </span>
      </h3>
      {set.pro_baseline ? (
        <p style={{ color: '#888', fontSize: 12 }}>
          Pro baseline: {set.pro_games} games on {[...new Set(set.stages)].join(', ')}
        </p>
      ) : (
        <p style={{ color: '#c94', fontSize: 12 }}>
          No pro baseline for this matchup yet — download replays in the Pro Replays tab.
        </p>
      )}
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr style={{ color: '#888', textAlign: 'left' }}>
            <th style={{ padding: 4 }}>Metric</th>
            <th style={{ padding: 4 }}>You</th>
            <th style={{ padding: 4 }}>Pros</th>
            <th style={{ padding: 4 }}>Gap</th>
          </tr>
        </thead>
        <tbody>
          {HEADLINE_METRICS.map((m) => {
            const mine = set.metrics[m.key] ?? null
            const pro = set.pro_baseline?.[m.key] ?? null
            if (mine === null && pro === null) return null
            const fmt = (v: number | null): string =>
              v === null ? '—' : `${v.toFixed(m.decimals)}${m.unit}`
            return (
              <tr key={m.key} style={{ borderTop: '1px solid #2a2a2a' }}>
                <td style={{ padding: 4 }}>{m.label}</td>
                <td style={{ padding: 4 }}>{fmt(mine)}</td>
                <td style={{ padding: 4, color: '#888' }}>{fmt(pro)}</td>
                <td style={{ padding: 4 }}>
                  <GapChip mine={mine} pro={pro} higherIsBetter={m.higherIsBetter} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SessionReport({
  sets,
  title,
  onBack,
  sessionFile,
  notesConfigured
}: {
  sets: SetRecord[]
  title: string
  onBack: () => void
  sessionFile?: string
  notesConfigured?: boolean
}): React.JSX.Element {
  const [notesStatus, setNotesStatus] = useState('')
  const [writing, setWriting] = useState(false)

  const writeNotes = async (): Promise<void> => {
    setWriting(true)
    setNotesStatus('Writing…')
    try {
      const res = await window.api.writeNotes(sessionFile)
      if (res.ok) {
        const n = res.written?.length ?? 0
        setNotesStatus(
          n > 0 ? `Notes written (${n} file${n === 1 ? '' : 's'})` : 'Notes up to date'
        )
      } else {
        setNotesStatus(`Notes failed: ${res.reason ?? 'unknown'}`)
      }
    } finally {
      setWriting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onBack}>← Dashboard</button>
        {notesConfigured && (
          <button disabled={writing} onClick={writeNotes}>
            Write notes
          </button>
        )}
        {notesStatus && (
          <span
            style={{
              fontSize: 13,
              color: notesStatus.startsWith('Notes failed') ? '#f88' : '#6e9'
            }}
          >
            {notesStatus}
          </span>
        )}
      </div>
      <h2>{title}</h2>
      {sets.map((s, i) => (
        <SetCard key={i} set={s} />
      ))}
    </div>
  )
}

export default SessionReport
