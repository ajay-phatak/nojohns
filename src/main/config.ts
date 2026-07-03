import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

export interface AppConfig {
  replayFolder: string | null
  connectCode: string | null
  mainCharacters: string[] // one or more mains, e.g. ["Sheik", "Fox"]
  matchups: string[] // opponent characters, e.g. ["Fox", "Falco", "Marth"]
  notesFolder: string | null
  autoWriteNotes: boolean // write notes automatically after each analysis
  // 'api' = Anthropic API key (credits); 'claude-cli' = spawn the user's
  // local Claude Code install (bills their Pro/Max plan).
  coachBackend: 'api' | 'claude-cli'
  // Model tier for coach requests. The heavy analysis is already done by the
  // engine, so sonnet is the default; opus for deeper reads, haiku for cheap.
  coachModel: 'opus' | 'sonnet' | 'haiku'
  onboarded: boolean
}

const DEFAULTS: AppConfig = {
  replayFolder: null,
  connectCode: null,
  mainCharacters: [],
  matchups: [],
  notesFolder: null,
  autoWriteNotes: false,
  coachBackend: 'api',
  coachModel: 'sonnet',
  onboarded: false
}

const configPath = (): string => join(app.getPath('userData'), 'config.json')

export const dataDir = (): string => join(app.getPath('userData'), 'data')

export function loadConfig(): AppConfig {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf-8'))
    // Migrate pre-multiselect configs (mainCharacter: string)
    if (typeof raw.mainCharacter === 'string' && !Array.isArray(raw.mainCharacters)) {
      raw.mainCharacters = raw.mainCharacter ? [raw.mainCharacter] : []
      delete raw.mainCharacter
    }
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
