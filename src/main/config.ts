import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

export interface AppConfig {
  replayFolder: string | null
  connectCode: string | null
  mainCharacter: string | null
  matchups: string[] // opponent characters, e.g. ["fox", "falco", "marth"]
  notesFolder: string | null
  onboarded: boolean
}

const DEFAULTS: AppConfig = {
  replayFolder: null,
  connectCode: null,
  mainCharacter: null,
  matchups: [],
  notesFolder: null,
  onboarded: false
}

const configPath = (): string => join(app.getPath('userData'), 'config.json')

export const dataDir = (): string => join(app.getPath('userData'), 'data')

export function loadConfig(): AppConfig {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf-8'))
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveConfig(patch: Partial<AppConfig>): AppConfig {
  const merged = { ...loadConfig(), ...patch }
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(configPath(), JSON.stringify(merged, null, 2))
  return merged
}
