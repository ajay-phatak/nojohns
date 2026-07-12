import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppConfig, EngineEvent, ProDirStatus } from '../../../preload/index.d'
import { charByName } from '../characters'

const FETCH_LIMIT = 30 // replays per matchup; enough for a stable baseline

interface MatchupRow {
  label: string
  dirName: string
  datasetDir: string
  token: string
}

// One row per (main, opponent) pair from config. The dataset is searched by
// MY character's dir, filtered by the opponent's filename token.
function buildRows(config: AppConfig): MatchupRow[] {
  const rows: MatchupRow[] = []
  for (const mainName of config.mainCharacters) {
    const main = charByName(mainName)
    if (!main) continue
    for (const oppName of config.matchups) {
      const opp = charByName(oppName)
      if (!opp) continue
      rows.push({
        label: `${main.name} vs ${opp.name}`,
        dirName: `${main.engineName}_vs_${opp.engineName}`,
        datasetDir: main.datasetDir,
        token: opp.token
      })
    }
  }
  return rows
}

const fmtMB = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(0)} MB`

function ProReplays({ config }: { config: AppConfig }): React.JSX.Element {
  const rows = useMemo(() => buildRows(config), [config])
  const [status, setStatus] = useState<Record<string, ProDirStatus>>({})
  const [fetching, setFetching] = useState<string | null>(null) // dirName
  const [progress, setProgress] = useState('')

  const refresh = useCallback((): void => {
    window.api.proStatus(rows.map((r) => r.dirName)).then((list) => {
      setStatus(Object.fromEntries(list.map((s) => [s.name, s])))
    })
  }, [rows])

  useEffect(refresh, [refresh])

  useEffect(
    () =>
      window.api.onEngineEvent((e: EngineEvent) => {
        if (e.event === 'progress' && e.stage === 'fetch') {
          setProgress(`${e.current}/${e.total} — ${e.detail ?? ''}`)
        }
      }),
    []
  )

  const runFetch = async (row: MatchupRow): Promise<void> => {
    setFetching(row.dirName)
    setProgress('starting…')
    try {
      await window.api.fetchPros({
        datasetDir: row.datasetDir,
        token: row.token,
        outDirName: row.dirName,
        limit: FETCH_LIMIT
      })
    } finally {
      setFetching(null)
      setProgress('')
      refresh()
    }
  }

  const totalBytes = Object.values(status).reduce((s, v) => s + v.bytes, 0)

  return (
    <div>
      <h2>Pro replays</h2>
      <p className="dim small">
        Downloads professional games for your matchups — this is what powers the you-vs-pros
        comparison. ~{FETCH_LIMIT} games per matchup, a few minutes each. Total on disk:{' '}
        {fmtMB(totalBytes)}.
      </p>
      <table className="table-loose">
        <tbody>
          {rows.map((row) => {
            const s = status[row.dirName]
            const busy = fetching === row.dirName
            return (
              <tr key={row.dirName}>
                <td>{row.label}</td>
                <td className={(s?.count ?? 0) > 0 ? 'live' : 'neg'}>
                  {s ? `${s.count} replays (${fmtMB(s.bytes)})` : '…'}
                </td>
                <td>
                  {busy ? (
                    <>
                      <span className="live tiny" style={{ marginRight: 8 }}>
                        {progress}
                      </span>
                      <button onClick={() => window.api.cancelFetch()}>Cancel</button>
                    </>
                  ) : (
                    <button disabled={fetching !== null} onClick={() => runFetch(row)}>
                      {(s?.count ?? 0) > 0 ? 'Fetch more' : 'Download'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="neg">No matchups configured — pick them in Settings.</p>}
    </div>
  )
}

export default ProReplays
