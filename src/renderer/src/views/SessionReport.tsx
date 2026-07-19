import { useState } from 'react'
import type { Moment, SetRecord } from '../../../preload/index.d'
import { HEADLINE_METRICS } from '../metrics'

const MOMENT_GROUPS: { kind: Moment['kind']; label: string }[] = [
  { kind: 'death', label: 'Deaths' },
  { kind: 'missed_edgeguard', label: 'Missed edgeguards' },
  { kind: 'best_punish', label: 'Best punishes' }
]

const QUEUE_ERROR: Record<string, string> = {
  no_dolphin: 'Playback Dolphin not found — set it in Settings',
  no_iso: 'Melee ISO not found — set it in Settings',
  no_replays: 'Replay files not found (moved or deleted)'
}

function MomentChips({ moments }: { moments: Moment[] }): React.JSX.Element | null {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')

  const groups = MOMENT_GROUPS.map((g) => ({
    ...g,
    items: moments.filter((m) => m.kind === g.kind)
  })).filter((g) => g.items.length > 0)

  if (groups.length === 0) return null

  const queue = async (kind: string, items: Moment[]): Promise<void> => {
    setPending(kind)
    try {
      const res = await window.api.playbackQueue(items)
      if (res.ok) {
        setError('')
      } else {
        setError(QUEUE_ERROR[res.reason ?? ''] ?? `Could not queue playback (${res.reason})`)
      }
    } finally {
      setPending(null)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="row">
        {groups.map((g) => (
          <button
            key={g.kind}
            className="btn-sm"
            disabled={pending === g.kind}
            onClick={() => queue(g.kind, g.items)}
          >
            ▶ {g.label} ({g.items.length})
          </button>
        ))}
      </div>
      {error && <p className="neg tiny">{error}</p>}
    </div>
  )
}

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
    <span className={`chip ${shown === '=' ? 'chip-even' : good ? 'chip-good' : 'chip-bad'}`}>
      {shown}
    </span>
  )
}

function SetCard({ set }: { set: SetRecord }): React.JSX.Element {
  const record = `${set.wins}–${set.losses}`
  return (
    <div className="card card-lg">
      <h3>
        {set.my_char} vs {set.opp_char}{' '}
        <span className={`record ${set.wins >= set.losses ? 'pos' : 'neg'}`}>{record}</span>{' '}
        <span className="h-sub">
          · {set.opp_code} · {set.n_games} games · {set.session_date}
        </span>
      </h3>
      {set.pro_baseline ? (
        <p className="muted tiny">
          Pro baseline: {set.pro_games} games on {[...new Set(set.stages)].join(', ')}
        </p>
      ) : (
        <p className="warn tiny">
          No pro baseline for this matchup yet — download replays in the Pro Replays tab.
        </p>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>You</th>
            <th>Pros</th>
            <th>Gap</th>
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
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>{fmt(mine)}</td>
                <td className="muted">{fmt(pro)}</td>
                <td>
                  <GapChip mine={mine} pro={pro} higherIsBetter={m.higherIsBetter} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {set.moments && <MomentChips moments={set.moments} />}
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
      <div className="row">
        <button onClick={onBack}>← Dashboard</button>
        {notesConfigured && (
          <button disabled={writing} onClick={writeNotes}>
            Write notes
          </button>
        )}
        {notesStatus && (
          <span className={`small ${notesStatus.startsWith('Notes failed') ? 'neg' : 'pos'}`}>
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
