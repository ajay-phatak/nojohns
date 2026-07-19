import { app } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'
import { loadConfig } from './config'

export interface Moment {
  kind: 'death' | 'missed_edgeguard' | 'best_punish'
  path: string
  file: string
  game_index: number
  frame: number
  start_frame: number
  end_frame: number
  label: string
}

export interface PlaybackStatus {
  dolphin: boolean
  iso: boolean
}

export interface QueuePlaybackResult {
  ok: boolean
  queued?: number
  missing?: number
  reason?: 'no_dolphin' | 'no_iso' | 'no_replays'
}

// Best-effort detection of the Slippi playback Dolphin install. Degrades to
// null — the UI always offers a manual path override in Settings.
export function detectPlaybackDolphin(): string | null {
  const appData = process.env['APPDATA']
  if (!appData) return null
  const dolphin = join(appData, 'Slippi Launcher', 'playback', 'Slippi Dolphin.exe')
  return existsSync(dolphin) ? dolphin : null
}

// Best-effort read of the Melee ISO path from the Slippi Launcher settings.
export function detectMeleeIso(): string | null {
  const appData = process.env['APPDATA']
  if (!appData) return null
  try {
    const settings = JSON.parse(
      readFileSync(join(appData, 'Slippi Launcher', 'Settings'), 'utf-8')
    )
    const isoPath = settings?.settings?.isoPath
    if (typeof isoPath === 'string' && existsSync(isoPath)) return isoPath
  } catch {
    // no settings file / unreadable
  }
  return null
}

// Config overrides win over detection. A stale override must resolve to null
// (not a broken spawn), so both paths are existence-checked here.
function resolveDolphin(): string | null {
  const { playbackDolphin } = loadConfig()
  const path = playbackDolphin || detectPlaybackDolphin()
  return path && existsSync(path) ? path : null
}

function resolveIso(): string | null {
  const { meleeIso } = loadConfig()
  const path = meleeIso || detectMeleeIso()
  return path && existsSync(path) ? path : null
}

export function playbackStatus(): PlaybackStatus {
  return { dolphin: !!resolveDolphin(), iso: !!resolveIso() }
}

const commPath = (): string => join(app.getPath('userData'), 'playback-comm.json')

// Queue moments in Slippi's playback Dolphin via the comm-file protocol.
// Fire-and-forget: no child process tracking, matches how the launcher itself
// hands off to Dolphin.
export function queuePlayback(moments: Moment[]): QueuePlaybackResult {
  const dolphin = resolveDolphin()
  if (!dolphin) return { ok: false, reason: 'no_dolphin' }
  const iso = resolveIso()
  if (!iso) return { ok: false, reason: 'no_iso' }

  const present = moments.filter((m) => existsSync(m.path))
  const missing = moments.length - present.length
  if (present.length === 0) return { ok: false, reason: 'no_replays' }

  const comm = {
    mode: 'queue',
    replay: '',
    isRealTimeMode: false,
    outputOverlayFiles: false,
    queue: present.map((m) => ({
      path: m.path,
      startFrame: m.start_frame,
      endFrame: m.end_frame
    }))
  }
  writeFileSync(commPath(), JSON.stringify(comm))

  const child = spawn(dolphin, ['-i', commPath(), '-b', '-e', iso], {
    detached: true,
    stdio: 'ignore'
  })
  // An unhandled 'error' event would crash the main process.
  child.on('error', () => {})
  child.unref()

  return { ok: true, queued: present.length, missing }
}
