// Notes writer — renders the Sessions / Matchups / Progress notes for one
// analyzed session into the user's notes folder (any folder; an Obsidian vault
// is just a folder). Rewrites regenerate sentinel blocks in place and never
// touch user text (see merge.ts). Unchanged files are not rewritten, so
// vault-sync tools don't see phantom edits.

import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { SessionData, SetRecord } from '../../preload/index.d'
import { mergeNote, mergeFrontmatter, extractBlock } from './merge'
import {
  sessionNoteTemplate,
  sessionFrontmatter,
  matchupNoteTemplate,
  matchupLogRow,
  mergeLogRows,
  progressNoteTemplate,
  mergeFocusGroups,
  type TrendsData,
  type MatchupTrend,
  type FocusItem
} from './render'

export interface NotesWriteResult {
  written: string[]
  unchanged: string[]
}

const safeName = (s: string): string => s.replace(/[\\/:*?"<>|]/g, '-')

const readOrNull = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

function writeIfChanged(path: string, content: string, res: NotesWriteResult): void {
  if (readOrNull(path) === content) {
    res.unchanged.push(path)
    return
  }
  writeFileSync(path, content)
  res.written.push(path)
}

const groupBy = <T>(items: T[], key: (t: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>()
  for (const it of items) {
    const k = key(it)
    const arr = out.get(k)
    if (arr) arr.push(it)
    else out.set(k, [it])
  }
  return out
}

// Minimal matchup summary when trends.json doesn't know this matchup yet
// (e.g. notes written before the first ingest): record from this session's
// sets, gameplan only when there's a single set to take it from.
function fallbackMatchup(sets: SetRecord[]): MatchupTrend {
  return {
    wins: sets.reduce((n, s) => n + s.wins, 0),
    losses: sets.reduce((n, s) => n + s.losses, 0),
    games: sets.reduce((n, s) => n + s.n_games, 0),
    sessions: 1,
    headline: {
      lcancel_pct: sets[0].metrics['lcancel_pct'] ?? null,
      neutral_win_pct: sets[0].metrics['neutral_win_pct'] ?? null,
      kill_rate_pct: sets[0].metrics['kill_rate_pct'] ?? null
    },
    gameplan: sets.length === 1 ? (sets[0].gameplan as MatchupTrend['gameplan']) : undefined
  }
}

export function writeSessionNotes(
  notesFolder: string,
  session: SessionData,
  trends: TrendsData | null,
  coachReport: string | null = null,
  focuses: { date: string; items: FocusItem[] } | null = null
): NotesWriteResult {
  const res: NotesWriteResult = { written: [], unchanged: [] }
  const sessionsDir = join(notesFolder, 'Sessions')
  const matchupsDir = join(notesFolder, 'Matchups')
  mkdirSync(sessionsDir, { recursive: true })
  mkdirSync(matchupsDir, { recursive: true })

  // One session note per date (a session can straddle midnight).
  for (const [date, sets] of groupBy(session.sets, (s) => s.session_date)) {
    const path = join(sessionsDir, `${safeName(date)}.md`)
    const existing = readOrNull(path)
    const merged = mergeNote(existing, sessionNoteTemplate(date, sets, trends, coachReport))
    writeIfChanged(path, mergeFrontmatter(merged, sessionFrontmatter(date, sets)), res)
  }

  // One matchup note per matchup played this session; gameplan comes from the
  // running trends aggregate, the log row from this session.
  for (const [name, sets] of groupBy(session.sets, (s) => `${s.my_char} vs ${s.opp_char}`)) {
    const path = join(matchupsDir, `${safeName(name)}.md`)
    const existing = readOrNull(path)
    const mu = trends?.matchups?.[name] ?? fallbackMatchup(sets)
    // Log rows accumulate across writes: upsert this session's row (grouped
    // per date within the matchup) into whatever the block already holds.
    let logBody = extractBlock(existing, 'log')
    for (const [date, dateSets] of groupBy(sets, (s) => s.session_date)) {
      logBody = mergeLogRows(logBody, matchupLogRow(date, dateSets))
    }
    writeIfChanged(path, mergeNote(existing, matchupNoteTemplate(name, mu, logBody!)), res)
  }

  if (trends) {
    const path = join(notesFolder, 'Progress.md')
    const existing = readOrNull(path)
    const focusesBody = focuses
      ? mergeFocusGroups(extractBlock(existing, 'focuses'), focuses.date, focuses.items)
      : null
    writeIfChanged(path, mergeNote(existing, progressNoteTemplate(trends, focusesBody)), res)
  }

  return res
}
