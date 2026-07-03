// Notes tier invariants: rewrites are idempotent (same data → byte-identical
// file, no write) and user text outside the sentinel blocks survives any
// regeneration. Mirrors the ingest-dedup guarantee on the engine side.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { mergeNote, mergeFrontmatter, extractBlock, type NotePart } from './merge'
import { mergeLogRows } from './render'
import { writeSessionNotes } from './write'
import type { SessionData, SetRecord } from '../../preload/index.d'
import type { TrendsData } from './render'

const template = (body: string): NotePart[] => [
  { kind: 'block', id: 'main', body },
  { kind: 'text', text: '\n## Notes\n\n- \n' }
]

describe('mergeNote', () => {
  it('renders the full template for a new file', () => {
    const out = mergeNote(null, template('generated v1'))
    expect(out).toContain('<!-- nojohns:begin main -->')
    expect(out).toContain('generated v1')
    expect(out).toContain('## Notes')
  })

  it('is idempotent: re-merging the same data changes nothing', () => {
    const first = mergeNote(null, template('generated v1'))
    expect(mergeNote(first, template('generated v1'))).toBe(first)
  })

  it('replaces block content but preserves user text outside the markers', () => {
    const first = mergeNote(null, template('generated v1'))
    const edited = first.replace('- \n', '- watch out for dash-dance grabs\n')
    const merged = mergeNote(edited, template('generated v2'))
    expect(merged).toContain('generated v2')
    expect(merged).not.toContain('generated v1')
    expect(merged).toContain('watch out for dash-dance grabs')
  })

  it('preserves user text the user added between two blocks', () => {
    const parts: NotePart[] = [
      { kind: 'block', id: 'a', body: 'A1' },
      { kind: 'text', text: '' },
      { kind: 'block', id: 'b', body: 'B1' }
    ]
    const first = mergeNote(null, parts)
    const edited = first.replace(
      '<!-- nojohns:begin b -->',
      'my thoughts here\n<!-- nojohns:begin b -->'
    )
    const merged = mergeNote(edited, [
      { kind: 'block', id: 'a', body: 'A2' },
      { kind: 'text', text: '' },
      { kind: 'block', id: 'b', body: 'B2' }
    ])
    expect(merged).toContain('A2')
    expect(merged).toContain('B2')
    expect(merged).toContain('my thoughts here')
  })

  it('appends a block whose markers the user deleted', () => {
    const first = mergeNote(null, template('generated v1'))
    const withoutBlock = first.replace(
      /<!-- nojohns:begin main -->[\s\S]*?<!-- nojohns:end main -->/,
      'user wrote over it'
    )
    const merged = mergeNote(withoutBlock, template('generated v2'))
    expect(merged).toContain('user wrote over it')
    expect(merged).toContain('generated v2')
    // Appended at the end, after the user's text
    expect(merged.indexOf('generated v2')).toBeGreaterThan(merged.indexOf('user wrote over it'))
  })

  it('does not re-emit seed text on merge (user deleted it)', () => {
    const first = mergeNote(null, template('generated v1'))
    const noSeed = first.replace('\n## Notes\n\n- \n', '')
    const merged = mergeNote(noSeed, template('generated v1'))
    expect(merged).not.toContain('## Notes')
  })
})

describe('extractBlock', () => {
  it('returns the inner content without markers', () => {
    const doc = mergeNote(null, template('inner content'))
    expect(extractBlock(doc, 'main')).toBe('inner content')
  })

  it('returns null for missing files and missing blocks', () => {
    expect(extractBlock(null, 'main')).toBeNull()
    expect(extractBlock('no markers here', 'main')).toBeNull()
  })
})

describe('mergeFrontmatter', () => {
  it('creates frontmatter when absent', () => {
    const out = mergeFrontmatter('body\n', { date: '2026-07-01', record: '2-1' })
    expect(out.startsWith('---\ndate: 2026-07-01\nrecord: 2-1\n---\n')).toBe(true)
    expect(out).toContain('body')
  })

  it('updates our keys and preserves user-added keys in place', () => {
    const existing = '---\ndate: 2026-07-01\ntags: melee, practice\nrecord: 0-0\n---\nbody\n'
    const out = mergeFrontmatter(existing, { date: '2026-07-01', record: '2-1' })
    expect(out).toContain('tags: melee, practice')
    expect(out).toContain('record: 2-1')
    expect(out).not.toContain('record: 0-0')
  })
})

describe('mergeLogRows', () => {
  it('appends new dates and keeps rows sorted', () => {
    const one = mergeLogRows(null, '- 2026-07-02 — 2-1 vs ABCD#123 (3g)')
    const two = mergeLogRows(one, '- 2026-07-01 — 0-1 vs WXYZ#456 (1g)')
    const lines = two.split('\n')
    expect(lines[0]).toBe('## Session log')
    expect(lines.indexOf('- 2026-07-01 — 0-1 vs WXYZ#456 (1g)')).toBeLessThan(
      lines.indexOf('- 2026-07-02 — 2-1 vs ABCD#123 (3g)')
    )
  })

  it('replaces the row for a re-analyzed date (idempotent per date)', () => {
    const one = mergeLogRows(null, '- 2026-07-02 — 2-1 vs ABCD#123 (3g)')
    const two = mergeLogRows(one, '- 2026-07-02 — 3-1 vs ABCD#123 (4g)')
    expect(two).toContain('3-1')
    expect(two).not.toContain('2-1')
  })
})

// ---------------------------------------------------------------------------
// End-to-end writer, against a temp "vault"
// ---------------------------------------------------------------------------

const makeSet = (over: Partial<SetRecord> = {}): SetRecord => ({
  session_date: '2026-07-01',
  opp_code: 'ABCD#123',
  my_char: 'Sheik',
  opp_char: 'Fox',
  stages: ['Battlefield'],
  n_games: 3,
  wins: 2,
  losses: 1,
  files: ['a.slp', 'b.slp', 'c.slp'],
  metrics: { lcancel_pct: 85, neutral_win_pct: 52, kill_rate_pct: 40 },
  pro_baseline: { lcancel_pct: 93, neutral_win_pct: 55, kill_rate_pct: 48 },
  pro_games: 40,
  gameplan: { opened_by: { 'nair|whiffed': 4 }, opening_sources: { dash_attack: 5 } },
  ...over
})

const session: SessionData = { generated_at: '2026-07-01T20:00:00', sets: [makeSet()] }

const trends: TrendsData = {
  generated_at: '2026-07-01T20:01:00',
  n_sessions: 3,
  n_sets: 5,
  char_trends: {
    Sheik: {
      n_sessions: 3,
      games: 12,
      metric_trends: {
        lcancel_pct: {
          label: 'L-cancel %',
          higher_is_better: true,
          recent: 82,
          prior: 78,
          all_time: 80,
          direction: 'improving'
        },
        whiff_pct: {
          label: 'Whiff rate',
          higher_is_better: false,
          recent: 26,
          prior: 21,
          all_time: 23,
          direction: 'declining'
        }
      }
    }
  },
  matchups: {
    'Sheik vs Fox': {
      wins: 4,
      losses: 3,
      games: 12,
      sessions: 3,
      headline: { lcancel_pct: 82, neutral_win_pct: 51, kill_rate_pct: 42 },
      gameplan: {
        opened_by: { 'nair|whiffed': 10, 'dash_attack|caught_neutral': 6 },
        opening_sources: { dash_attack: 12, grab: 8 },
        neutral_for: 30,
        neutral_against: 28,
        dmg_per_opening_for: 41.2,
        dmg_per_opening_against: 38.9
      }
    }
  }
}

describe('writeSessionNotes', () => {
  let vault: string
  beforeEach(() => {
    vault = mkdtempSync(join(tmpdir(), 'nojohns-notes-'))
  })
  afterEach(() => {
    rmSync(vault, { recursive: true, force: true })
  })

  it('writes session, matchup, and progress notes', () => {
    const res = writeSessionNotes(vault, session, trends)
    expect(res.written).toHaveLength(3)
    const sessionNote = readFileSync(join(vault, 'Sessions', '2026-07-01.md'), 'utf-8')
    expect(sessionNote.startsWith('---\ndate: 2026-07-01\n')).toBe(true)
    expect(sessionNote).toContain('Sheik vs Fox — 2-1 vs ABCD#123 (3g)')
    expect(sessionNote).toContain('| L-cancel % | 85% | 93% | -8.0 ✗ |')
    const matchupNote = readFileSync(join(vault, 'Matchups', 'Sheik vs Fox.md'), 'utf-8')
    expect(matchupNote).toContain('**Record:** 4-3 · 12 games · 3 session(s)')
    expect(matchupNote).toContain('- 2026-07-01 — 2-1 vs ABCD#123 (3g)')
    const progress = readFileSync(join(vault, 'Progress.md'), 'utf-8')
    expect(progress).toContain('## Sheik trajectory (3 sessions, 12g)')
    expect(progress).toContain('**Whiff rate** declining')
  })

  it('second identical run writes nothing', () => {
    writeSessionNotes(vault, session, trends)
    const res = writeSessionNotes(vault, session, trends)
    expect(res.written).toHaveLength(0)
    expect(res.unchanged).toHaveLength(3)
  })

  it('preserves user notes and frontmatter tags across a re-run', () => {
    writeSessionNotes(vault, session, trends)
    const path = join(vault, 'Matchups', 'Sheik vs Fox.md')
    const edited = readFileSync(path, 'utf-8').replace(
      '- \n',
      '- shine OOS more when he nairs my shield\n'
    )
    writeFileSync(path, edited)
    // New session, updated aggregate
    const later: SessionData = {
      generated_at: '2026-07-02T20:00:00',
      sets: [makeSet({ session_date: '2026-07-02', wins: 3, losses: 0, files: ['d.slp'] })]
    }
    writeSessionNotes(vault, later, trends)
    const after = readFileSync(path, 'utf-8')
    expect(after).toContain('shine OOS more when he nairs my shield')
    // Log accumulated both dates
    expect(after).toContain('- 2026-07-01 — 2-1 vs ABCD#123 (3g)')
    expect(after).toContain('- 2026-07-02 — 3-0 vs ABCD#123 (3g)')
  })

  it('handles a matchup missing from trends via the session fallback', () => {
    const res = writeSessionNotes(vault, session, {
      ...trends,
      matchups: {}
    })
    expect(res.written.some((p) => p.endsWith('Sheik vs Fox.md'))).toBe(true)
    const note = readFileSync(join(vault, 'Matchups', 'Sheik vs Fox.md'), 'utf-8')
    expect(note).toContain('**Record:** 2-1 · 3 games · 1 session(s)')
  })

  it('writes without trends at all (first run, nothing ingested yet)', () => {
    const res = writeSessionNotes(vault, session, null)
    // No Progress.md without trends
    expect(res.written).toHaveLength(2)
    const sessionNote = readFileSync(join(vault, 'Sessions', '2026-07-01.md'), 'utf-8')
    expect(sessionNote).toContain('Sheik vs Fox')
  })
})
